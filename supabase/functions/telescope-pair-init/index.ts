import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Step 1 of pairing a JapyScope Remote (Pi) to a Visual Astro account.
// Takes no input: the pairing_id and the 6-digit code are both generated
// HERE, server-side, and returned to the caller in this one response — the
// Pi never invents either value itself and never sends a code_hash.
//
// This matters: if the Pi generated the code/pairing_id and merely told us
// their hash, anyone (this endpoint has no auth — see below) could register
// their own pairing_id against a code_hash of their choosing, including
// pre-registering hashes for the whole 6-digit space. Whichever code the
// observer later types into telescope-pair-claim would then match the
// attacker's row instead of the real Pi's, and the attacker could retrieve
// the resulting device token via telescope-pair-fetch using the pairing_id
// they chose. Minting both values here closes that off: a caller only ever
// learns the pairing_id/code pair this endpoint generated for *their own*
// call, never one influenced by, or usable to intercept, anyone else's.
//
// verify_jwt is off for this function (see supabase/config.toml) — the Pi
// has no Supabase user session at this point.

const PAIRING_TTL_MS = 10 * 60 * 1000;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSixDigitCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => (b % 10).toString()).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const pairingId = crypto.randomUUID();
    const code = randomSixDigitCode();
    const codeHash = await sha256Hex(code);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
    // A lapsed pending row for this exact code_hash (left behind because
    // nobody ever polled it to expiry) would otherwise collide with the
    // partial unique index below and turn a 1-in-10^6 coincidence into a
    // request that always 500s until that row happens to get cleaned up.
    await supabase
      .from('telescope_pairing_requests')
      .delete()
      .eq('code_hash', codeHash)
      .eq('status', 'pending')
      .lte('expires_at', new Date().toISOString());
    const { error } = await supabase.from('telescope_pairing_requests').insert({
      id: pairingId,
      code_hash: codeHash,
      status: 'pending',
      expires_at: expiresAt,
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, pairing_id: pairingId, code, expires_at: expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
