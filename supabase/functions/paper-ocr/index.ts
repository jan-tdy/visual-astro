import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
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

    const systemPrompt = `Si OCR asistent pre pozorovateľský papier premenných hviezd.
Papier obsahuje tabuľku s riadkami pozorovaní. Stĺpce (v poradí):
poradie, hviezda, a, paso a, paso b, b, limit, ut, nota.
Papier môže byť dvojstĺpcový (ľavá aj pravá polovica).
Vráť VÝHRADNE JSON objekt v tvare:
{ "observations": [ { "star_name": string, "a": string|null, "pasos_a": number|null, "pasos_b": number|null, "b": string|null, "limit_value": string|null, "ut_time": string|null, "note": string|null } ] }
Prázdne polia vráť ako null. Čísla v paso ako celé čísla. Časy ako "hh:mm". Nepridávaj žiadny text mimo JSON.`;

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
            { type: 'text', text: 'Prečítaj tabuľku z tohto papiera a vráť JSON.' },
            { type: 'image_url', image_url: { url: image } },
          ]},
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI error ${aiRes.status}: ${txt}` }), {
        status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { observations: [] }; }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});