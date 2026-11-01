import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Step 3 of pairing: the Pi polls this with the pairing_id telescope-pair-init
// generated and returned to it in step 1 (unguessable — nobody else learns
// it), waiting for the observer to claim the code (telescope-pair-claim).
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
      if (new Date(r.expires_at).getTime() <= Date.now()) {
        // Claimed but never collected before the window closed (the Pi
        // went offline, say) — delete rather than let a plaintext token
        // sit here indefinitely, and report it the same as any other
        // lapsed attempt.
        await supabase.from('telescope_pairing_requests').delete().eq('id', pairing_id);
        return new Response(JSON.stringify({ status: 'expired' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // One-time handoff as a single conditional delete: two overlapping
      // polls can both read "claimed" above, but only one of their deletes
      // actually removes the row, so only that caller gets the token back.
      const { data: deleted, error: delErr } = await supabase
        .from('telescope_pairing_requests')
        .delete()
        .eq('id', pairing_id)
        .eq('status', 'claimed')
        .select('plaintext_token');
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!deleted || deleted.length === 0) {
        // Lost the race to another concurrent fetch that already collected it.
        return new Response(JSON.stringify({ status: 'expired' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const collected = deleted[0] as { plaintext_token: string };
      return new Response(JSON.stringify({ status: 'claimed', device_token: collected.plaintext_token }), {
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
