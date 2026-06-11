import { strictAppOrigin } from '../_shared/cors.ts';
import { TELEGRAM_COMMANDS, validateTelegramCommands } from '../_shared/telegram-commands.ts';
// One-shot registration of Dori's slash commands with Telegram (BotFather menu).
// Call this once after deploy to populate the autocomplete menu users see when typing "/".
const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const validationErrors = validateTelegramCommands(TELEGRAM_COMMANDS);
    if (validationErrors.length > 0) {
      return new Response(JSON.stringify({ ok: false, errors: validationErrors }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/setMyCommands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands: TELEGRAM_COMMANDS }),
    });
    const data = await r.json();
    return new Response(JSON.stringify({ ok: r.ok, telegram: data, registered: TELEGRAM_COMMANDS.length }), {
      status: r.ok ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
