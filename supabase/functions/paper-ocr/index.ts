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

    // Single free plan for everyone: 4 AI scans per month. Enterprise accounts
    // get a per-user override negotiated individually (j44soft@gmail.com) and
    // stored on profiles.enterprise_ai_scans_per_month — null means Free.
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('enterprise_ai_scans_per_month')
      .eq('user_id', userId)
      .maybeSingle();
    const enterpriseLimit = (profileRow as any)?.enterprise_ai_scans_per_month;
    const isPlus = false;
    const monthlyLimit = typeof enterpriseLimit === 'number' && enterpriseLimit > 0 ? enterpriseLimit : 4;

    const { image, splitPart, splitTotal } = await req.json();
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'image (data URL) required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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
    const skipQuota = isSplitScan && splitPart > 1;

    // Mesačný agregát: prvý deň mesiaca ako "bucket" v ocr_usage.used_on
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString().slice(0, 10);

    // Reservation, not a plain read: increment_ocr_usage() checks the limit
    // and increments the counter in one atomic statement, so two concurrent
    // requests can't both read the same count, both pass the check, and
    // both write the same incremented value (see #109). Parts after the
    // first in a Free-plan split scan never reserve, so just report the
    // current count for display.
    let used = 0;
    let reserved = false;
    if (skipQuota) {
      const { data: usageRow } = await supabase
        .from('ocr_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('used_on', monthStart)
        .maybeSingle();
      used = (usageRow as any)?.count ?? 0;
    } else {
      const { data: usageResult, error: usageErr } = await supabase
        .rpc('increment_ocr_usage', { _user_id: userId, _used_on: monthStart, _limit: monthlyLimit })
        .single();
      if (usageErr) {
        return new Response(JSON.stringify({ error: `Usage tracking error: ${usageErr.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      used = (usageResult as any).new_count;
      if ((usageResult as any).limit_reached) {
        return new Response(JSON.stringify({
          error: `Mesačný limit AI skenov vyčerpaný (${used}/${monthlyLimit}). Potrebuješ viac? Napíš na j44soft@gmail.com.`,
          limitReached: true, used, monthlyLimit, dailyLimit: monthlyLimit, isPlus,
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      reserved = true;
    }

    // Releases a reservation this request made if it ends up not completing
    // a scan, so a failed attempt doesn't cost the user their quota.
    const releaseReservation = () =>
      reserved
        ? supabase.rpc('decrement_ocr_usage', { _user_id: userId, _used_on: monthStart }).then(() => {})
        : Promise.resolve();

    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      await releaseReservation();
      return new Response(JSON.stringify({ error: 'Missing LOVABLE_API_KEY' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Si expert OCR asistent pre RUČNE písané (ceruzkou) pozorovateľské papiere premenných hviezd.
Text je takmer vždy písaný rukou ceruzkou, často nečitateľne — interpretuj ho najlepšie ako vieš.
${isSplitScan
  ? `Tento obrázok je výrez papiera (${splitPositionLabel(splitPart, splitTotal)}, časť ${splitPart}/${splitTotal} rozdeleného skenu) — obsahuje len časť tabuľky. Ak výrez neobsahuje žiadne vyplnené riadky, vráť prázdne pole observations.`
  : 'Papier môže byť dvojstĺpcový (ľavá aj pravá polovica - prejdi obe).'}

Papier môže mať jeden z DVOCH formátov — najprv zisti ktorý:

FORMÁT 1 (najčastejší, ručne kreslená tabuľka) — 4 stĺpce:
  Hviezda | Odhad | Čas | Pozn.
Stĺpec "Odhad" je JEDEN zložený zápis, ktorý treba rozobrať. Má dva tvary:
  a) Stupňový odhad: A <pasosA>V<pasosB> B
     Písmeno "V" (niekedy vyzerá ako "v") je oddeľovač v STREDE zápisu.
     - pasosA = JEDNA číslica TESNE PRED "V"
     - pasosB = JEDNA číslica TESNE ZA "V"
     - A = celý zvyšok PRED pasosA
     - B = celý zvyšok ZA pasosB
     Príklady (toto je najčastejší zdroj chýb, drž sa ich presne):
       "79 1V3 105"    -> a="79",   pasos_a=1, pasos_b=3, b="105"
       "122 4V1 121"   -> a="122",  pasos_a=4, pasos_b=1, b="121"
       "136 2V1 160"   -> a="136",  pasos_a=2, pasos_b=1, b="160"
       "108 1V1 109"   -> a="108",  pasos_a=1, pasos_b=1, b="109"
       "13.1 2V0 13.4" -> a="13.1", pasos_a=2, pasos_b=0, b="13.4"
       "C 1V2 6"       -> a="C",    pasos_a=1, pasos_b=2, b="6"
     POZOR: A a B sú zvyčajne TROJCIFERNÉ (napr. 122, 136, 160). Nikdy neber
     poslednú číslicu z trojciferného A ako pasosA — "122 4V1 121" je
     a="122", pasos_a=4, NIE a="12", pasos_a=2.
     Ak je pasosB napísané ako "0", zapíš pasos_b=0 (nie 1, nie null).
  b) Medza jasnosti: začína "<" (napr. "<16.0", "<15.7")
     -> limit_value="<16.0", a/b/pasos nechaj null.
Stĺpec "Čas" je zvyčajne bez dvojbodky, 4 číslice: "2124" -> ut_time="21:24".

FORMÁT 2 (predtlačená šablóna z aplikácie) — samostatné stĺpce:
  poradie (#), hviezda, A, Paso A, Paso B, B, Limit, UT (hh:mm), Nota.
Tu čítaj hodnoty priamo z príslušných stĺpcov, nič nerozoberaj.

Spoločné pravidlá:
- "Hviezda" je názov premennej (napr. "RX And", "SS Cyg", "V404 Cyg", "T CrB").
  Zachovaj medzeru medzi označením a súhvezdím.
- A a B sú porovnávacie hviezdy: buď číslo (napr. "105", "79", "13.1"), alebo
  písmeno z mapy jasností (napr. "a", "C", "d3"). Prepíš PRESNE ako je napísané —
  desatinnú čiarku NEDOPĹŇAJ a NEODSTRAŇUJ ("105" nechaj "105", nie "10.5").
- pasos_a / pasos_b sú celé čísla 0–20.
- Ignoruj úplne prázdne riadky. Preškrtnuté riadky vynechaj.
- Ak si pri ručnom písme neistý, urob najpravdepodobnejší odhad, nevynechávaj riadok.
Vráť VÝHRADNE JSON objekt v tvare:
{ "observations": [ { "star_name": string, "a": string|null, "pasos_a": number|null, "pasos_b": number|null, "b": string|null, "limit_value": string|null, "ut_time": string|null, "note": string|null } ] }
Prázdne polia vráť ako null. Nepridávaj žiadny text mimo JSON.`;

    // Model choice is what actually keeps this function inside its time
    // budget, and it's worth spelling out because two previous rewrites
    // failed by ignoring it. On gemini-2.5-pro a single crop took 86-140s
    // (Lovable's AI activity log), most of it extended thinking that an OCR
    // transcription task doesn't need. That is longer than the ~90s the
    // proxy in front of this function allows a client request to live, so a
    // synchronous call lost. Moving the work to EdgeRuntime.waitUntil() lost
    // too — the isolate gets torn down once the response is sent, killing the
    // in-flight body read (surfaced as "Unexpected end of JSON input" at
    // ~52s). Flash answers a small crop in seconds instead, which puts the
    // whole call comfortably inside the request path and makes both of those
    // failure modes unreachable rather than merely less likely.
    let aiRes: Response;
    try {
      aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
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
    } catch (e) {
      await releaseReservation();
      return new Response(JSON.stringify({ error: `AI gateway request failed: ${(e as Error).message}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!aiRes.ok) {
      const txt = await aiRes.text().catch(() => '');
      await releaseReservation();
      return new Response(JSON.stringify({ error: `AI error ${aiRes.status}: ${txt}` }), {
        status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read the body as text first rather than aiRes.json(). If the response
    // is empty or truncated, JSON.parse's own message ("Unexpected end of
    // JSON input") says nothing about where it came from — which cost real
    // debugging time once already. Naming the source here keeps any future
    // occurrence self-explanatory in the client's error log.
    const raw = await aiRes.text();
    if (!raw.trim()) {
      await releaseReservation();
      return new Response(JSON.stringify({ error: 'AI gateway vrátila prázdnu odpoveď. Skús to prosím znova.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let content = '';
    try {
      content = JSON.parse(raw)?.choices?.[0]?.message?.content ?? '';
    } catch {
      await releaseReservation();
      return new Response(JSON.stringify({ error: 'AI gateway vrátila neplatnú odpoveď. Skús to prosím znova.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    return new Response(JSON.stringify({
      observations,
      used,
      monthlyLimit, dailyLimit: monthlyLimit, isPlus,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
