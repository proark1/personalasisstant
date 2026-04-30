// One-shot registration of Dori's slash commands with Telegram (BotFather menu).
// Call this once after deploy to populate the autocomplete menu users see when typing "/".
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;

const COMMANDS = [
  { command: 'me',         description: '🌤 Your day — digest with overdue, today, tomorrow' },
  { command: 'plans',      description: '📋 Active plans (Run next / Skip / Abort inline)' },
  { command: 'today',      description: "Today's tappable agenda" },
  { command: 'tomorrow',   description: "Tomorrow's tappable agenda" },
  { command: 'week',       description: 'Next 7 days overview' },
  { command: 'overdue',    description: '⚠️ Tasks past their due date' },
  { command: 'free',       description: 'Free slots — /free [2h] [day]' },
  { command: 'agenda',     description: 'Agenda for a date — /agenda YYYY-MM-DD' },
  { command: 'load',       description: '📆 Meeting hours this week' },
  { command: 'snooze',     description: '💤 Push today\'s tasks to tomorrow' },
  { command: 'done',       description: '✅ What you completed this week' },
  { command: 'menu',       description: '🍽 Today\'s planned meals' },
  { command: 'expense',    description: '💶 Log expense — /expense 23.50 food lunch' },
  { command: 'spent',      description: '💶 Spend totals — /spent food month' },
  { command: 'weather',    description: '🌤 Weather — /weather Berlin' },
  { command: 'lang',       description: '🌐 Switch language — /lang de|en' },
  { command: 'recent',     description: '🕓 Dori\'s last 5 actions' },
  { command: 'whoseturn',  description: '🧹 Next in chore rotation — /whoseturn trash' },
  { command: 'standup',    description: '🧑‍🤝‍🧑 Team standup (workspace group)' },
  { command: 'recap',      description: '📦 Weekly recap (workspace group)' },
  { command: 'schedule',   description: '🗓 Find-a-time — /schedule <title> with @a @b for 30m' },
  { command: 'shopping',   description: 'Shopping list (tap to check off)' },
  { command: 'add',        description: 'Add a task — /add <task>' },
  { command: 'buy',        description: 'Add to shopping — /buy <item>' },
  { command: 'event',      description: 'Create event — /event <title> @ <time>' },
  { command: 'note',       description: 'Save a note — /note <text>' },
  { command: 'notes',      description: 'Search notes — /notes <query>' },
  { command: 'remind',     description: 'Set a reminder — /remind <text>' },
  { command: 'undo',       description: '↩️ Undo the last action (5-min window)' },
  { command: 'focus',      description: '🔇 Focus mode — /focus on 2h · /focus off' },
  { command: 'workspace',  description: '🧑‍🤝‍🧑 Switch scope — /workspace Acme · /workspace off · /workspace list' },
  { command: 'comment',    description: '💬 Comment on a workspace task — /comment <title> :: <text>' },
  { command: 'birthdays',  description: 'Upcoming birthdays (30 days)' },
  { command: 'contacts',   description: 'Search contacts — /contacts <name>' },
  { command: 'contracts',  description: 'Active contracts & subscriptions' },
  { command: 'expiring',   description: 'Contracts expiring in 60 days' },
  { command: 'properties', description: 'Your properties' },
  { command: 'vehicles',   description: 'Your vehicles' },
  { command: 'health',     description: "Today's health metrics" },
  { command: 'checkin',    description: "Today's check-in status" },
  { command: 'inbox',      description: 'Priority unread emails' },
  { command: 'actions',    description: 'Email todos / payments / questions' },
  { command: 'draft',      description: 'AI-draft an email reply — /draft <subject>' },
  { command: 'prayers',    description: "Today's prayer times" },
  { command: 'qibla',      description: '🧭 Qibla direction — /qibla [city]' },
  { command: 'quran',      description: '📖 Surah snippet — /quran <name or 1-114>' },
  { command: 'dhikr',      description: '📿 Log dhikr — /dhikr [count]' },
  { command: 'chores',     description: '🧹 Recurring household chores' },
  { command: 'quiet',      description: 'Quiet hours — /quiet on|off' },
  { command: 'voice',      description: 'Voice replies — /voice on|off' },
  { command: 'linkme',     description: 'Link your Telegram to your Dori user' },
  { command: 'linkworkspace', description: 'Link this group to a workspace' },
  { command: 'help',       description: 'Show the full command list' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const r = await fetch(`${GATEWAY_URL}/setMyCommands`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands: COMMANDS }),
    });
    const data = await r.json();
    return new Response(JSON.stringify({ ok: r.ok, telegram: data, registered: COMMANDS.length }), {
      status: r.ok ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
