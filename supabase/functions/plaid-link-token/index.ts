// Create a Plaid Link token.
//
// Frontend calls this, then opens Plaid Link with the returned
// link_token. After the user completes the bank flow, Plaid hands the
// frontend a public_token, which it sends to /plaid-exchange.
//
// Body:
//   { country_codes?: ['US','GB','DE',...], language?: 'en'|'de'|... }
// Defaults to ['US'] / 'en' to keep development simple; the UI can
// pass user locale + country.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLinkToken, loadConfig } from '../_shared/plaid.ts';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_COUNTRIES = new Set([
  'US', 'CA', 'GB', 'IE', 'FR', 'ES', 'NL', 'DE', 'IT',
  'PL', 'DK', 'NO', 'SE', 'EE', 'LT', 'LV', 'PT', 'BE',
]);
const ALLOWED_LANGS = new Set(['en', 'fr', 'es', 'nl', 'de', 'it', 'pl', 'da', 'no', 'sv', 'pt']);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'Unauthorized' }, 401);

    let cfg;
    try { cfg = loadConfig(); }
    catch (e) { return json({ error: 'Plaid not configured', details: (e as Error).message }, 503); }

    const body = await req.json().catch(() => ({}));
    const countryCodes: string[] = Array.isArray(body.country_codes)
      ? body.country_codes.map((c: unknown) => String(c).toUpperCase()).filter((c: string) => ALLOWED_COUNTRIES.has(c)).slice(0, 5)
      : ['US'];
    if (countryCodes.length === 0) countryCodes.push('US');

    const lang = typeof body.language === 'string' && ALLOWED_LANGS.has(body.language.toLowerCase())
      ? body.language.toLowerCase()
      : 'en';

    // OAuth redirect for European bank flows. Required by PSD2.
    const appUrl = Deno.env.get('APP_URL') || '';
    const redirectUri = appUrl ? `${appUrl.replace(/\/+$/, '')}/finance` : undefined;

    const webhookUrl = `${supabaseUrl}/functions/v1/plaid-webhook`;

    try {
      const lt = await createLinkToken(cfg, {
        userId: user.id,
        language: lang,
        countryCodes,
        products: ['transactions'],
        redirectUri,
        webhookUrl,
      });
      return json({
        link_token: lt.link_token,
        expiration: lt.expiration,
        env: cfg.env,
      });
    } catch (e) {
      console.error('[plaid-link-token] failed', (e as Error).message);
      return json({ error: (e as Error).message }, 502);
    }
  } catch (err) {
    console.error('[plaid-link-token] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
