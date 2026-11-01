import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Step 2 of pairing: the observer, logged into Visual Astro, types the code
// shown on the Pi's display into Settings → "Prepojiť teleskop". This
// function matches it against the pending request telescope-pair-init
// registered, mints a device token, stores only its hash in
// telescope_links, and stashes the plaintext token on the pairing row for
// the Pi to pick up once (telescope-pair-fetch). Requires a normal Visual
// Astro user session (verify_jwt stays on for this function).
//
// A 6-digit code is only ~20 bits of entropy, and this endpoint is reachable
// by any logged-in Visual Astro user against *any* currently-pending
// request, not just their own — without a limit, an attacker could script
// through the whole code space within a pairing request's ~10-minute TTL
// and hijack someone else's telescope link. telescope_pair_claim_attempts
// locks out the calling user_id after a few wrong guesses.

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomDeviceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url, no padding — safe to use verbatim in an Authorization header.
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

    const { data: lockState } = await supabase
      .from('telescope_pair_claim_attempts')
      .select('failed_count, locked_until')
      .eq('user_id', userId)
      .maybeSingle();
    const locked = lockState as { failed_count: number; locked_until: string | null } | null;
    if (locked?.locked_until && new Date(locked.locked_until).getTime() > Date.now()) {
      return new Response(JSON.stringify({ error: 'Príliš veľa nesprávnych kódov. Skúste znova neskôr.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recordFailure = async () => {
      const nextCount = (locked?.failed_count ?? 0) + 1;
      await supabase.from('telescope_pair_claim_attempts').upsert({
        user_id: userId,
        failed_count: nextCount >= MAX_FAILED_ATTEMPTS ? 0 : nextCount,
        locked_until: nextCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null,
      });
    };

    const { code } = await req.json();
    if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return new Response(JSON.stringify({ error: 'code must be 6 digits' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const codeHash = await sha256Hex(code.trim());

    const { data: pending } = await supabase
      .from('telescope_pairing_requests')
      .select('id, expires_at')
      .eq('code_hash', codeHash)
      .eq('status', 'pending')
      .maybeSingle();
    if (!pending || new Date((pending as { expires_at: string }).expires_at).getTime() <= Date.now()) {
      await recordFailure();
      return new Response(JSON.stringify({ error: 'Kód je nesprávny alebo vypršal.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deviceToken = randomDeviceToken();
    const deviceTokenHash = await sha256Hex(deviceToken);

    const { error: linkErr } = await supabase.from('telescope_links').insert({
      user_id: userId,
      device_token_hash: deviceTokenHash,
    });
    if (linkErr) {
      return new Response(JSON.stringify({ error: linkErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Claim the pairing row atomically against the "pending" status read
    // above — a retried/duplicate claim of the same code can't mint a
    // second link once this update's WHERE no longer matches.
    const { data: claimed, error: claimErr } = await supabase
      .from('telescope_pairing_requests')
      .update({ status: 'claimed', user_id: userId, plaintext_token: deviceToken })
      .eq('id', (pending as { id: string }).id)
      .eq('status', 'pending')
      .select('id');
    if (claimErr || !claimed || claimed.length === 0) {
      // Lost the race to another concurrent claim of the same code — undo
      // the link we just created rather than leaving an orphan.
      await supabase.from('telescope_links').delete().eq('user_id', userId).eq('device_token_hash', deviceTokenHash);
      return new Response(JSON.stringify({ error: 'Kód je nesprávny alebo vypršal.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clear any accumulated failures now that this user has proven they hold
    // a valid code.
    await supabase.from('telescope_pair_claim_attempts').delete().eq('user_id', userId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
