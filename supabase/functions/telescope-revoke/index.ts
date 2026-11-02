import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Lets a paired JapyScope Remote (Pi) revoke its own link — used by its Web
// UI's "Disconnect Visual Astro" action in connectors.html. Same
// device-token auth as telescope-ingest (verify_jwt is off, see
// supabase/config.toml). Idempotent: revoking an already-revoked (or
// unknown) token still returns ok so a retried request never errors.

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
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
    const { error: revokeError } = await supabase
      .from('telescope_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('device_token_hash', tokenHash)
      .is('revoked_at', null);
    if (revokeError) {
      return new Response(JSON.stringify({ error: revokeError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
