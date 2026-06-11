export interface TelegramBotCommand {
  command: string;
  description: string;
}

export const TELEGRAM_COMMAND_LIMIT = 100;

export const TELEGRAM_QUICK_COMMAND_ALIASES = {
  help: ['help', 'commands'],
  cockpit: ['cockpit', 'control', 'controls'],
  brief: ['brief', 'briefing'],
  plan: ['plan'],
  delegate: ['delegate'],
  review: ['review'],
  settings: ['settings', 'prefs', 'preferences'],
  approvals: ['approvals', 'pending'],
  now: ['now', 'next', 'whatnow'],
  memory: ['memory', 'memories'],
} as const;

export type TelegramQuickCommand = keyof typeof TELEGRAM_QUICK_COMMAND_ALIASES;

export function normalizeTelegramCommand(text: string): string {
  const token = text.trim().toLowerCase().split(/\s+/)[0] || '';
  return token.replace(/^\//, '').replace(/@\w+$/, '');
}

export function isTelegramQuickCommand(text: string, command: TelegramQuickCommand): boolean {
  const normalized = normalizeTelegramCommand(text);
  return (TELEGRAM_QUICK_COMMAND_ALIASES[command] as readonly string[]).includes(normalized);
}

export const TELEGRAM_COMMANDS = [
  { command: 'me',         description: '🌤 Your day — digest with overdue, today, tomorrow' },
  { command: 'cockpit',    description: '🕹 Open the Dori assistant cockpit' },
  { command: 'brief',      description: '🗞 Command-center briefing prompt' },
  { command: 'plan',       description: '🧭 Plan a goal, day, or project with Dori' },
  { command: 'delegate',   description: '🪄 Delegate a job to Dori with approval rules' },
  { command: 'review',     description: '✅ Review pending decisions and recent work' },
  { command: 'settings',   description: '⚙️ Steer Dori preferences and scope' },
  { command: 'now',        description: '🎯 Best next move from Dori' },
  { command: 'next',       description: '🎯 Alias for /now' },
  { command: 'whatnow',    description: '🎯 Alias for /now' },
  { command: 'approvals',  description: '📥 Pending Dori actions to approve/cancel' },
  { command: 'pending',    description: '📥 Alias for /approvals' },
  { command: 'memory',     description: '🧠 What Dori remembers + how to forget' },
  { command: 'memories',   description: '🧠 Alias for /memory' },
  { command: 'plans',      description: '📋 Active plans (Run next / Skip / Abort inline)' },
  { command: 'today',      description: "Today's tappable agenda" },
  { command: 'tomorrow',   description: "Tomorrow's tappable agenda" },
  { command: 'week',       description: 'Next 7 days overview' },
  { command: 'digest',     description: '🌅 Family next-7 important items (auto every morning)' },
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
  // Phase 4: new gap-closure commands
  { command: 'budget',     description: '💸 Set/check budget — /budget set food 500 · /budget check food' },
  { command: 'period',     description: '🩸 Log period — /period start · /period end' },
  { command: 'meds',       description: '💊 Log a med — /meds <name>' },
  { command: 'pantry',     description: '🥫 Pantry inventory — /pantry list · /pantry add eggs 12' },
  { command: 'fasting',    description: '⏱ Fasting — /fasting start · /fasting end' },
  { command: 'flight',     description: '✈️ Track flight — /flight LH123 2026-05-10' },
  { command: 'status',     description: '🏠 Set presence — /status home|away|work|travel' },
  { command: 'zakat',      description: '🕌 Zakat calc — /zakat 10000' },
  { command: 'tz',         description: '🌍 Timezone — /tz Tokyo' },
  { command: 'fx',         description: '💱 Convert — /fx 100 EUR USD' },
  { command: 'summary',    description: '📧 Summarise unread emails — /summary' },
  { command: 'subtask',    description: '➕ Add subtask — /subtask <parent> :: <child>' },
  { command: 'tag',        description: '🏷 Tag a task — /tag <task> +work -urgent' },
  { command: 'estimate',   description: '⏳ Estimate task — /estimate <task> 30' },
  { command: 'help',       description: 'Show the full command list' },
  { command: 'commands',   description: 'Alias for /help' },
] as const satisfies readonly TelegramBotCommand[];

export function validateTelegramCommands(commands: readonly TelegramBotCommand[]): string[] {
  const errors: string[] = [];
  if (commands.length > TELEGRAM_COMMAND_LIMIT) {
    errors.push(`Telegram supports at most ${TELEGRAM_COMMAND_LIMIT} commands; got ${commands.length}.`);
  }

  const seen = new Set<string>();
  commands.forEach((cmd, idx) => {
    const label = `commands[${idx}]`;
    if (!/^[a-z0-9_]+$/.test(cmd.command)) {
      errors.push(`${label} has invalid command "${cmd.command}"; use lowercase letters, digits, and underscores only.`);
    }
    if (cmd.command.length < 1 || cmd.command.length > 32) {
      errors.push(`${label} command "${cmd.command}" must be 1-32 characters.`);
    }
    if (seen.has(cmd.command)) {
      errors.push(`${label} duplicates /${cmd.command}.`);
    }
    seen.add(cmd.command);
    if (cmd.description.length < 1 || cmd.description.length > 256) {
      errors.push(`${label} description for /${cmd.command} must be 1-256 characters.`);
    }
  });
  return errors;
}
