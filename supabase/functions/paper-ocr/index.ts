import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// The model's JSON output can end up incomplete if it hits its own output
// limit mid-object. Rather than discard everything because the outer
// `{ "observations": [...] }` never closed, walk the text and pull out
// whichever individual observation objects DID finish (each is
// self-contained JSON), skipping only the trailing, still-open one.
function extractPartialObservations(text: string): unknown[] {
  const marker = '"observations"';
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) return [];
  const bracketIdx = text.indexOf('[', markerIdx);
  if (bracketIdx === -1) return [];
  const results: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = bracketIdx + 1; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const chunk = text.slice(start, i + 1);
        try { results.push(JSON.parse(chunk)); } catch { /* cut off mid-object, skip */ }
        start = -1;
      }
    } else if (c === ']' && depth === 0) {
      break;
    }
  }
  return results;
}

// Slovak label for where a split's part sits on the page — used only in the
// prompt so the model doesn't get confused about why it's looking at a crop
// instead of the whole table.
function splitPositionLabel(part: number, total: number): string {
  if (total === 4) {
    return ['vľavo hore', 'vpravo hore', 'vľavo dole', 'vpravo dole'][part - 1] ?? `časť ${part}`;
  }
  if (total === 2) {
    return part === 1 ? 'ĽAVÁ polovica' : 'PRAVÁ polovica';
  }
  return `časť ${part}/${total}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;
    const email = (userData.user.email ?? '').toLowerCase();

    // Determine plan limit
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('status,current_period_end,environment')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const subActive = !!subRow && (
      (['active','trialing','past_due'].includes((subRow as any).status) &&
        (!(subRow as any).current_period_end || new Date((subRow as any).current_period_end) > new Date())) ||
      ((subRow as any).status === 'canceled' && (subRow as any).current_period_end && new Date((subRow as any).current_period_end) > new Date())
    );
    const { data: prof } = await supabase
      .from('profiles').select('dev_plus_override').eq('user_id', userId).maybeSingle();
    const devOverride = !!(prof as any)?.dev_plus_override && email === 'var@kozmos.sk';
    // Bonus (milestone free Plus)
    const { data: bonusRow } = await supabase
      .from('plus_bonuses')
      .select('id')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();
    const bonusActive = !!bonusRow;
    const isPlus = subActive || devOverride || bonusActive;
    const monthlyLimit = isPlus ? 40 : 5;

    const { image, splitPart, splitTotal, scanId } = await req.json();
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'image (data URL) required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!scanId || typeof scanId !== 'string') {
      return new Response(JSON.stringify({ error: 'scanId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const part = typeof splitPart === 'number' ? splitPart : 1;
    // A "split scan" is the client cutting one paper photo into several crops
    // (currently a 2x2 grid) and calling this function once per crop (see
    // SessionEditor's handleOcrFile), which keeps each AI call's *content*
    // small enough for the model to answer quickly. On the Free plan all
    // crops together are billed as a single scan — only part 1 is
    // quota-checked and charged, the rest ride along for free. On Plus each
    // crop is billed normally (N scans for an N-way split), same as calling
    // this function N times for unrelated images.
    const isSplitScan = typeof splitTotal === 'number' && splitTotal >= 2 &&
      typeof splitPart === 'number' && splitPart >= 1 && splitPart <= splitTotal;
    const skipQuota = isSplitScan && !isPlus && splitPart > 1;

    // Mesačný agregát: prvý deň mesiaca ako "bucket" v ocr_usage.used_on
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString().slice(0, 10);
    const { data: usageRow } = await supabase
      .from('ocr_usage')
      .select('id,count')
      .eq('user_id', userId)
      .eq('used_on', monthStart)
      .maybeSingle();
    const used = (usageRow as any)?.count ?? 0;
    if (!skipQuota && used >= monthlyLimit) {
      return new Response(JSON.stringify({
        error: `Mesačný limit AI skenov vyčerpaný (${used}/${monthlyLimit}). ${isPlus ? '' : 'Upgraduj na Plus pre 40 skenov mesačne.'}`,
        limitReached: true, used, monthlyLimit, dailyLimit: monthlyLimit, isPlus,
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing LOVABLE_API_KEY' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Si expert OCR asistent pre RUČNE písané (ceruzkou) pozorovateľské papiere premenných hviezd.
Text je takmer vždy písaný rukou ceruzkou, často nečitateľne — interpretuj ho najlepšie ako vieš.
Papier obsahuje tabuľku s pevnými stĺpcami v poradí:
poradie (#), hviezda, A, Paso A, Paso B, B, Limit, UT (čas hh:mm), Nota.
${isSplitScan
  ? `Tento obrázok je výrez papiera (${splitPositionLabel(splitPart, splitTotal)}, časť ${splitPart}/${splitTotal} rozdeleného skenu) — obsahuje len časť tabuľky. Ak výrez neobsahuje žiadne vyplnené riadky, vráť prázdne pole observations.`
  : 'Papier môže byť dvojstĺpcový (ľavá aj pravá polovica - prejdi obe).'}
Pravidlá:
- Stĺpce "A" a "B" sú porovnávacie hviezdy (zvyčajne 1–3 znaky, písmená a číslice, napr. "a", "B2", "12").
- "Paso A" a "Paso B" sú celé čísla (typicky 1–20).
- "Limit" má prefix "<" (napr. "<14.9").
- "UT" je čas vo formáte hh:mm (24h).
- "Hviezda" je názov premennej (napr. "RX And", "SS Cyg", "V404 Cyg").
- Ignoruj úplne prázdne riadky.
- Ak si pri ručnom písme neistý, urob najpravdepodobnejší odhad, nevynechávaj riadok.
Vráť VÝHRADNE JSON objekt v tvare:
{ "observations": [ { "star_name": string, "a": string|null, "pasos_a": number|null, "pasos_b": number|null, "b": string|null, "limit_value": string|null, "ut_time": string|null, "note": string|null } ] }
Prázdne polia vráť ako null. Nepridávaj žiadny text mimo JSON.`;

    // Claim the job row right away so the client can start polling immediately
    // instead of waiting on this HTTP response — see processInBackground
    // below for why. If a row from a previous attempt at the same
    // (scanId, part) is somehow still around, this resets it to pending.
    await supabase.from('ocr_scan_progress').upsert({
      scan_id: scanId, part, user_id: userId, status: 'pending',
      observations: [], error_message: null, updated_at: new Date().toISOString(),
    });

    // The AI gateway does not actually stream its response through to us —
    // Lovable's own request log shows it as "Buffered": the model can take
    // 60-140s+ to answer and nothing comes back until it's fully done. The
    // proxy in front of this edge function has been observed to give up on
    // the client's HTTP connection at roughly that same ~90s mark, well
    // before Supabase's own execution limit (150-400s) would ever kick in —
    // so a synchronous request/response here loses the race almost by
    // design. Instead: respond to the client immediately, do the actual
    // work in the background (EdgeRuntime.waitUntil keeps this isolate
    // alive well past the response), and let the client poll ocr_scan_progress
    // for the result — each poll is a cheap DB read, never a slow request.
    const processInBackground = async () => {
      try {
        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: [
                { type: 'text', text: 'Prečítaj túto ručne písanú tabuľku (ceruzkou) a vráť JSON. Snaž sa rozlúštiť aj nečitateľné políčka.' },
                { type: 'image_url', image_url: { url: image } },
              ]},
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (!aiRes.ok) {
          const txt = await aiRes.text().catch(() => '');
          await supabase.from('ocr_scan_progress').upsert({
            scan_id: scanId, part, user_id: userId, status: 'error',
            error_message: `AI error ${aiRes.status}: ${txt}`, updated_at: new Date().toISOString(),
          });
          return;
        }

        const data = await aiRes.json();
        const content = data?.choices?.[0]?.message?.content ?? '';
        let observations: unknown[];
        try {
          const parsed = JSON.parse(content);
          observations = Array.isArray(parsed?.observations) ? parsed.observations : [];
        } catch {
          // Whole-text parse failed — most likely the model got cut off
          // mid-object (its own output limit). Salvage whatever rows did
          // complete instead of returning nothing.
          observations = extractPartialObservations(content);
        }

        // Increment usage counter (best effort) — skipped for parts after
        // the first in a Free-plan split scan, see skipQuota above.
        if (!skipQuota) {
          if (usageRow) {
            await supabase.from('ocr_usage').update({ count: used + 1 }).eq('id', (usageRow as any).id);
          } else {
            await supabase.from('ocr_usage').insert({ user_id: userId, used_on: monthStart, count: 1 });
          }
        }

        await supabase.from('ocr_scan_progress').upsert({
          scan_id: scanId, part, user_id: userId, status: 'done', observations,
          used: skipQuota ? used : used + 1, monthly_limit: monthlyLimit, is_plus: isPlus,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        try {
          await supabase.from('ocr_scan_progress').upsert({
            scan_id: scanId, part, user_id: userId, status: 'error',
            error_message: (e as Error).message, updated_at: new Date().toISOString(),
          });
        } catch { /* best effort — client's poll will eventually time out */ }
      }
    };

    // EdgeRuntime is a Supabase/Deno Deploy global (not declared in any lib
    // this project's tsc checks — this file isn't part of that project).
    EdgeRuntime.waitUntil(processInBackground());

    return new Response(JSON.stringify({ scanId, part, status: 'pending' }), {
      status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
