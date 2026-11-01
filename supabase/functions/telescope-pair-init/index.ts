import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Step 1 of pairing a JapyScope Remote (Pi) to a Visual Astro account. The
// Pi generates a short-lived pairing_id + 6-digit code locally, shows the
// code on its own display, and registers the code's hash here so that once
// the observer types the same code into Settings → "Prepojiť teleskop"
// (telescope-pair-claim), that function can find this request and hand a
// freshly issued device token back to the Pi via telescope-pair-fetch.
// verify_jwt is off for this function (see supabase/config.toml) — the Pi
// has no Supabase user session at this point.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const PAIRING_TTL_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { pairing_id, code_hash } = await req.json();
    if (typeof pairing_id !== 'string' || !UUID_RE.test(pairing_id)) {
      return new Response(JSON.stringify({ error: 'pairing_id must be a uuid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // The Pi hashes its own plaintext code before sending it here — the
    // plaintext never leaves the device at this step.
    if (typeof code_hash !== 'string' || !HEX64_RE.test(code_hash)) {
      return new Response(JSON.stringify({ error: 'code_hash must be a hex-encoded sha256 digest' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const hash = code_hash.toLowerCase();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
    const { error } = await supabase.from('telescope_pairing_requests').insert({
      id: pairing_id,
      code_hash: hash,
      status: 'pending',
      expires_at: expiresAt,
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, expires_at: expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
