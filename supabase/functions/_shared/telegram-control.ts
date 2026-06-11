import {
  type TelegramQuickCommand,
  isTelegramQuickCommand,
} from './telegram-commands.ts';

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

export interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineButton[][];
}

export const TELEGRAM_STEERING_COMMANDS = {
  brief: {
    title: '🗞 Brief',
    headline: 'Ask Dori for a compact command-center brief across today, blockers, inbox, and upcoming deadlines.',
    examples: [
      'Brief me for the next 8 hours.',
      'Give me an executive brief: calendar, tasks, emails, and risks.',
    ],
  },
  plan: {
    title: '🧭 Plan',
    headline: 'Turn a messy goal into a step-by-step plan that Dori can help execute.',
    examples: [
      'Plan my day around deep work and meetings.',
      'Plan the launch checklist for Friday and ask before creating tasks.',
    ],
  },
  delegate: {
    title: '🪄 Delegate',
    headline: 'Hand Dori a job, constraints, and approval rules so it can draft, schedule, or queue actions.',
    examples: [
      'Delegate: draft replies to urgent emails, but ask before sending.',
      'Delegate: turn this voice note into tasks and reminders.',
    ],
  },
  review: {
    title: '✅ Review',
    headline: 'Review pending decisions, unfinished work, recent actions, and anything that needs your OK.',
    examples: [
      'Review what changed today and what still needs me.',
      'Review pending approvals and risky tasks before I log off.',
    ],
  },
  settings: {
    title: '⚙️ Settings',
    headline: 'Steer Dori preferences like focus mode, voice replies, timezone, workspace scope, and memory.',
    examples: [
      'Set voice replies on and focus mode for 2 hours.',
      'Switch to my work workspace and remember meetings after 10.',
    ],
  },
} as const;

export type TelegramSteeringCommand = keyof typeof TELEGRAM_STEERING_COMMANDS;

export type TelegramControlCommand = TelegramQuickCommand | 'cockpit' | TelegramSteeringCommand;

export interface TelegramControlDispatchArgs {
  text: string;
  updateId?: number;
  chatId: number;
  userId: string;
  rawUpdate?: unknown;
  workspaceId?: string | null;
  source: 'slash' | 'callback';
  handlers: {
    sendHelp: () => Promise<void>;
    sendCockpit: () => Promise<void>;
    sendApprovals: () => Promise<void>;
    sendNow: () => Promise<void>;
    sendMemory: () => Promise<void>;
    sendSteering: (command: TelegramSteeringCommand, args: string) => Promise<void>;
    recordMetric?: (command: TelegramControlCommand) => Promise<void>;
    markProcessed?: () => Promise<void>;
  };
}

export function resolveTelegramControlCommand(text: string): TelegramControlCommand | null {
  if (isTelegramQuickCommand(text, 'cockpit')) return 'cockpit';
  if (isTelegramQuickCommand(text, 'help')) return 'help';
  if (isTelegramQuickCommand(text, 'approvals')) return 'approvals';
  if (isTelegramQuickCommand(text, 'now')) return 'now';
  if (isTelegramQuickCommand(text, 'memory')) return 'memory';
  if (isTelegramQuickCommand(text, 'brief')) return 'brief';
  if (isTelegramQuickCommand(text, 'plan')) return 'plan';
  if (isTelegramQuickCommand(text, 'delegate')) return 'delegate';
  if (isTelegramQuickCommand(text, 'review')) return 'review';
  if (isTelegramQuickCommand(text, 'settings')) return 'settings';
  return null;
}

export async function dispatchTelegramControlCommand(args: TelegramControlDispatchArgs): Promise<boolean> {
  const command = resolveTelegramControlCommand(args.text);
  if (!command) return false;

  await args.handlers.recordMetric?.(command);

  if (command === 'help') await args.handlers.sendHelp();
  else if (command === 'cockpit') await args.handlers.sendCockpit();
  else if (command === 'approvals') await args.handlers.sendApprovals();
  else if (command === 'now') await args.handlers.sendNow();
  else if (command === 'memory') await args.handlers.sendMemory();
  else await args.handlers.sendSteering(command, telegramCommandArgs(args.text));

  if (args.source === 'slash') {
    await args.handlers.markProcessed?.();
  }
  return true;
}

export function telegramCommandArgs(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const [, ...rest] = trimmed.split(/\s+/);
  return rest.join(' ').trim();
}

export function buildSteeringPrompt(command: TelegramSteeringCommand, args: string): string {
  const subject = args.trim();
  switch (command) {
    case 'brief':
      return `Create a compact command-center brief for me about: ${subject}. Prioritize calendar, tasks, inbox, risks, and the best next decision. Keep it concise and actionable for Telegram.`;
    case 'plan':
      return `Plan this with clear next steps, tradeoffs, and any actions you should queue for my approval: ${subject}`;
    case 'delegate':
      return `I want to delegate this to Dori: ${subject}. Ask for approval before any irreversible action, but otherwise draft the plan, identify needed context, and queue safe next steps.`;
    case 'review':
      return `Review this for me and tell me what needs attention, what can be approved, and what the next decision is: ${subject}`;
    case 'settings':
      return `Help me update or reason about my Dori settings/preferences based on this request: ${subject}. If it implies a settings change, queue it for approval when needed.`;
  }
}

export function buildAssistantCockpitMessage(): string {
  return `<b>🕹 Dori cockpit</b>\n\nPick a control, or keep talking naturally. Use this when you want to steer Dori instead of writing a perfect prompt.\n\n<b>Fast controls</b>\n🎯 Now — best next action\n📥 Approvals — things waiting for your OK\n🧠 Memory — what Dori remembers\n\n<b>Steering modes</b>\n🗞 Brief · 🧭 Plan · 🪄 Delegate · ✅ Review · ⚙️ Settings`;
}

export function buildAssistantCockpitKeyboard(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '🎯 Now', callback_data: 'dori_cmd:now' },
        { text: '📥 Approvals', callback_data: 'dori_cmd:approvals' },
      ],
      [
        { text: '🗞 Brief', callback_data: 'dori_cmd:brief' },
        { text: '🧭 Plan', callback_data: 'dori_cmd:plan' },
      ],
      [
        { text: '🪄 Delegate', callback_data: 'dori_cmd:delegate' },
        { text: '✅ Review', callback_data: 'dori_cmd:review' },
      ],
      [
        { text: '🧠 Memory', callback_data: 'dori_cmd:memory' },
        { text: '⚙️ Settings', callback_data: 'dori_cmd:settings' },
      ],
      [{ text: '✖️ Close', callback_data: 'dori_dismiss' }],
    ],
  };
}

export function buildSteeringCommandMessage(command: TelegramSteeringCommand): string {
  const def = TELEGRAM_STEERING_COMMANDS[command];
  return `<b>${def.title}</b>\n\n${def.headline}\n\n<b>Try saying</b>\n• <code>${def.examples[0]}</code>\n• <code>${def.examples[1]}</code>\n\nOr tap another cockpit control below.`;
}
