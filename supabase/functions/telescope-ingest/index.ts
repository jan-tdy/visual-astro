import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Receives raw GoTo+tracking events from a paired JapyScope Remote (Pi),
// authenticated by its device token (not a Visual Astro user session —
// verify_jwt is off for this function, see supabase/config.toml). Every
// event lands as status='pending' regardless of how long the Pi tracked
// the target: the 1.42 min "observed" duration threshold is applied on the
// Pi itself (configurable there) before it ever queues an event to send —
// this function never re-filters by duration.
//
// Idempotent: the Pi's offline queue can resend a whole batch after a
// dropped connection, so a duplicate event_id for the same user is a no-op,
// not an error.

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type IncomingEvent = {
  event_id: string;
  object_name: string;
  started_at: string;
  ended_at: string;
  ra?: string | null;
  dec?: string | null;
};

function isValidEvent(e: unknown): e is IncomingEvent {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  if (typeof o.event_id !== 'string' || !UUID_RE.test(o.event_id)) return false;
  if (typeof o.object_name !== 'string' || !o.object_name.trim()) return false;
  if (typeof o.started_at !== 'string' || isNaN(new Date(o.started_at).getTime())) return false;
  if (typeof o.ended_at !== 'string' || isNaN(new Date(o.ended_at).getTime())) return false;
  if (o.ra !== undefined && o.ra !== null && typeof o.ra !== 'string') return false;
  if (o.dec !== undefined && o.dec !== null && typeof o.dec !== 'string') return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const deviceToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!deviceToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const tokenHash = await sha256Hex(deviceToken);
    const { data: link } = await supabase
      .from('telescope_links')
      .select('id, user_id, revoked_at')
      .eq('device_token_hash', tokenHash)
      .maybeSingle();
    const l = link as { id: string; user_id: string; revoked_at: string | null } | null;
    if (!l || l.revoked_at) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const rawEvents = Array.isArray(body) ? body : Array.isArray(body?.events) ? body.events : [body];
    const events = rawEvents.filter(isValidEvent);
    if (events.length === 0) {
      return new Response(JSON.stringify({ error: 'no valid events in request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows = events.map((e) => ({
      event_id: e.event_id,
      user_id: l.user_id,
      device_id: l.id,
      object_name: e.object_name.trim(),
      started_at: e.started_at,
      ended_at: e.ended_at,
      ra: e.ra ?? null,
      dec: e.dec ?? null,
    }));
    const { error: insertErr, count } = await supabase
      .from('telescope_events')
      .upsert(rows, { onConflict: 'user_id,event_id', ignoreDuplicates: true })
      .select('id', { count: 'exact' });
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Opportunistic cleanup of this user's stale pending backlog — no
    // separate cron job needed for the "auto-discard after 14 days" rule.
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('telescope_events')
      .delete()
      .eq('user_id', l.user_id)
      .eq('status', 'pending')
      .lt('created_at', cutoff);

    return new Response(JSON.stringify({ ok: true, inserted: count ?? rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
