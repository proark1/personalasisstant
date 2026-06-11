import { describe, expect, it } from 'vitest';
import {
  TELEGRAM_COMMAND_LIMIT,
  TELEGRAM_COMMANDS,
  isTelegramQuickCommand,
  normalizeTelegramCommand,
  validateTelegramCommands,
} from '../../supabase/functions/_shared/telegram-commands';

describe('Telegram command registration', () => {
  it('keeps the registered command list valid for Telegram Bot API limits', () => {
    expect(TELEGRAM_COMMANDS.length).toBeLessThanOrEqual(TELEGRAM_COMMAND_LIMIT);
    expect(validateTelegramCommands(TELEGRAM_COMMANDS)).toEqual([]);
    expect(TELEGRAM_COMMANDS.map((c) => c.command)).toEqual(
      expect.arrayContaining(['now', 'next', 'whatnow', 'approvals', 'pending', 'memory', 'memories', 'help', 'commands']),
    );
  });

  it('reports invalid names, duplicates, descriptions, and list length', () => {
    const tooMany = Array.from({ length: TELEGRAM_COMMAND_LIMIT + 1 }, (_, i) => ({
      command: `cmd_${i}`,
      description: 'ok',
    }));
    const errors = validateTelegramCommands([
      ...tooMany,
      { command: 'Bad-Name', description: 'ok' },
      { command: 'cmd_1', description: '' },
    ]);

    expect(errors.some((e) => e.includes('at most'))).toBe(true);
    expect(errors.some((e) => e.includes('invalid command'))).toBe(true);
    expect(errors.some((e) => e.includes('duplicates /cmd_1'))).toBe(true);
    expect(errors.some((e) => e.includes('description'))).toBe(true);
  });
});

describe('Telegram quick command aliases', () => {
  it('normalizes slash commands and bot suffixes safely enough for private quick routing', () => {
    expect(normalizeTelegramCommand('/now')).toBe('now');
    expect(normalizeTelegramCommand('  /PENDING please  ')).toBe('pending');
    expect(normalizeTelegramCommand('/now@darai_bot')).toBe('now');
  });

  it('matches all quick-command aliases through the shared alias map', () => {
    expect(isTelegramQuickCommand('/commands', 'help')).toBe(true);
    expect(isTelegramQuickCommand('/pending', 'approvals')).toBe(true);
    expect(isTelegramQuickCommand('/whatnow', 'now')).toBe(true);
    expect(isTelegramQuickCommand('/memories', 'memory')).toBe(true);
    expect(isTelegramQuickCommand('/memory', 'now')).toBe(false);
  });
});
