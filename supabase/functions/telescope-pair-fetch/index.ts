import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Step 3 of pairing: the Pi polls this with the pairing_id it generated in
// step 1, waiting for the observer to claim the code (telescope-pair-claim).
// Once claimed, this hands back the plaintext device token exactly once —
// the row is deleted immediately after, so a device token never sits
// readable in the database beyond this single handoff. verify_jwt is off
// for this function (see supabase/config.toml): the Pi has no Visual Astro
// user session.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { pairing_id } = await req.json();
    if (typeof pairing_id !== 'string' || !UUID_RE.test(pairing_id)) {
      return new Response(JSON.stringify({ error: 'pairing_id must be a uuid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: row } = await supabase
      .from('telescope_pairing_requests')
      .select('status, plaintext_token, expires_at')
      .eq('id', pairing_id)
      .maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ status: 'expired' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const r = row as { status: string; plaintext_token: string | null; expires_at: string };

    if (r.status === 'claimed' && r.plaintext_token) {
      // One-time read: delete immediately so the plaintext token can't be
      // fetched twice, and can't linger in the table.
      await supabase.from('telescope_pairing_requests').delete().eq('id', pairing_id);
      return new Response(JSON.stringify({ status: 'claimed', device_token: r.plaintext_token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(r.expires_at).getTime() <= Date.now()) {
      await supabase.from('telescope_pairing_requests').delete().eq('id', pairing_id);
      return new Response(JSON.stringify({ status: 'expired' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'pending' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
