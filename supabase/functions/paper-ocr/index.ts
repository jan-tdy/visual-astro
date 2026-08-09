import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

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
    if (used >= monthlyLimit) {
      return new Response(JSON.stringify({
        error: `Mesačný limit AI skenov vyčerpaný (${used}/${monthlyLimit}). ${isPlus ? '' : 'Upgraduj na Plus pre 40 skenov mesačne.'}`,
        limitReached: true, used, monthlyLimit, dailyLimit: monthlyLimit, isPlus,
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { image } = await req.json();
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'image (data URL) required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
Papier môže byť dvojstĺpcový (ľavá aj pravá polovica - prejdi obe).
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
        stream: true,
      }),
    });

    if (!aiRes.ok || !aiRes.body) {
      const txt = await aiRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: `AI error ${aiRes.status}: ${txt}` }), {
        status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Relay the model's streamed output to the client as it arrives, so the
    // UI can show live progress instead of a single opaque wait. We forward
    // our own small SSE protocol (progress/done/error), not the raw
    // upstream chunks, so the client never needs to know about the AI
    // gateway's wire format.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        const reader = aiRes.body!.getReader();
        let buf = '';
        let full = '';
        let lastCount = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const evt = JSON.parse(payload);
                const delta = evt?.choices?.[0]?.delta?.content;
                if (typeof delta === 'string' && delta) {
                  full += delta;
                  // Each observation object starts with "star_name" per the
                  // schema in the system prompt, so counting occurrences is
                  // a cheap live proxy for "rows recognized so far".
                  const count = (full.match(/"star_name"/g) ?? []).length;
                  if (count !== lastCount) {
                    lastCount = count;
                    send({ type: 'progress', count });
                  }
                }
              } catch {
                // Partial line split across chunks — ignore, it'll complete
                // on a later read.
              }
            }
          }

          let parsed: any = {};
          try { parsed = JSON.parse(full); } catch { parsed = { observations: [] }; }
          const observations = Array.isArray(parsed?.observations) ? parsed.observations : [];

          // Increment usage counter (best effort)
          if (usageRow) {
            await supabase.from('ocr_usage').update({ count: used + 1 }).eq('id', (usageRow as any).id);
          } else {
            await supabase.from('ocr_usage').insert({ user_id: userId, used_on: monthStart, count: 1 });
          }

          send({ type: 'done', observations, used: used + 1, monthlyLimit, dailyLimit: monthlyLimit, isPlus });
        } catch (e) {
          send({ type: 'error', message: (e as Error).message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});