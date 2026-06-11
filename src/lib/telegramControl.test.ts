import { describe, expect, it, vi } from 'vitest';
import {
  buildAssistantCockpitKeyboard,
  buildAssistantCockpitMessage,
  buildSteeringCommandMessage,
  buildSteeringPrompt,
  dispatchTelegramControlCommand,
  resolveTelegramControlCommand,
  telegramCommandArgs,
} from '../../supabase/functions/_shared/telegram-control';
import { decodeCallback } from '../../supabase/functions/_shared/telegram-inline';

describe('Telegram cockpit controls', () => {
  it('builds a real inline-button cockpit instead of only slash-command help text', () => {
    const message = buildAssistantCockpitMessage();
    const keyboard = buildAssistantCockpitKeyboard();

    expect(message).toContain('Dori cockpit');
    expect(keyboard.inline_keyboard.flat().map((b) => b.callback_data)).toEqual(
      expect.arrayContaining(['dori_cmd:now', 'dori_cmd:approvals', 'dori_cmd:brief', 'dori_cmd:settings', 'dori_dismiss']),
    );
    expect(decodeCallback('dori_cmd:delegate')).toEqual({ kind: 'quick_command', command: 'delegate' });
  });

  it('resolves richer steering aliases', () => {
    expect(resolveTelegramControlCommand('/cockpit')).toBe('cockpit');
    expect(resolveTelegramControlCommand('/briefing')).toBe('brief');
    expect(resolveTelegramControlCommand('/prefs')).toBe('settings');
    expect(resolveTelegramControlCommand('/unknown')).toBeNull();
  });

  it('builds steering command guidance with actionable prompt examples', () => {
    const message = buildSteeringCommandMessage('delegate');

    expect(message).toContain('Delegate');
    expect(message).toContain('ask before sending');
    expect(message).toContain('cockpit control');
  });

  it('extracts steering arguments and turns them into executable Dori prompts', () => {
    expect(telegramCommandArgs('/plan launch checklist by Friday')).toBe('launch checklist by Friday');
    expect(telegramCommandArgs('/brief')).toBe('');
    expect(buildSteeringPrompt('plan', 'launch checklist by Friday')).toContain('launch checklist by Friday');
    expect(buildSteeringPrompt('delegate', 'draft urgent replies')).toContain('Ask for approval');
  });
});

describe('Telegram poll quick request/response flow', () => {
  it('dispatches a slash-command update through mocked Telegram and Supabase side effects', async () => {
    const calls: string[] = [];
    const handlers = {
      sendHelp: vi.fn(async () => { calls.push('telegram:send_help_keyboard'); }),
      sendCockpit: vi.fn(async () => { calls.push('telegram:send_cockpit_keyboard'); }),
      sendApprovals: vi.fn(async () => { calls.push('telegram:send_approvals'); }),
      sendNow: vi.fn(async () => { calls.push('telegram:send_now'); }),
      sendMemory: vi.fn(async () => { calls.push('telegram:send_memory'); }),
      sendSteering: vi.fn(async (command: string) => { calls.push(`telegram:send_${command}_steering`); }),
      recordMetric: vi.fn(async (command: string) => { calls.push(`supabase:analytics:${command}`); }),
      markProcessed: vi.fn(async () => { calls.push('supabase:telegram_messages:processed'); }),
    };

    const handled = await dispatchTelegramControlCommand({
      text: '/cockpit',
      updateId: 42,
      chatId: 123,
      userId: 'user-1',
      rawUpdate: { update_id: 42, message: { text: '/cockpit' } },
      workspaceId: null,
      source: 'slash',
      handlers,
    });

    expect(handled).toBe(true);
    expect(calls).toEqual([
      'supabase:analytics:cockpit',
      'telegram:send_cockpit_keyboard',
      'supabase:telegram_messages:processed',
    ]);
  });


  it('passes slash-command arguments into steering handlers for executable /plan requests', async () => {
    const handlers = {
      sendHelp: vi.fn(async () => undefined),
      sendCockpit: vi.fn(async () => undefined),
      sendApprovals: vi.fn(async () => undefined),
      sendNow: vi.fn(async () => undefined),
      sendMemory: vi.fn(async () => undefined),
      sendSteering: vi.fn(async () => undefined),
      recordMetric: vi.fn(async () => undefined),
      markProcessed: vi.fn(async () => undefined),
    };

    const handled = await dispatchTelegramControlCommand({
      text: '/plan launch checklist by Friday',
      chatId: 123,
      userId: 'user-1',
      source: 'slash',
      handlers,
    });

    expect(handled).toBe(true);
    expect(handlers.sendSteering).toHaveBeenCalledWith('plan', 'launch checklist by Friday');
    expect(handlers.recordMetric).toHaveBeenCalledWith('plan');
    expect(handlers.markProcessed).toHaveBeenCalledOnce();
  });

  it('dispatches a cockpit button callback without marking a Telegram message as processed', async () => {
    const handlers = {
      sendHelp: vi.fn(async () => undefined),
      sendCockpit: vi.fn(async () => undefined),
      sendApprovals: vi.fn(async () => undefined),
      sendNow: vi.fn(async () => undefined),
      sendMemory: vi.fn(async () => undefined),
      sendSteering: vi.fn(async () => undefined),
      recordMetric: vi.fn(async () => undefined),
      markProcessed: vi.fn(async () => undefined),
    };

    const handled = await dispatchTelegramControlCommand({
      text: '/review',
      chatId: 123,
      userId: 'user-1',
      source: 'callback',
      handlers,
    });

    expect(handled).toBe(true);
    expect(handlers.recordMetric).toHaveBeenCalledWith('review');
    expect(handlers.sendSteering).toHaveBeenCalledWith('review', '');
    expect(handlers.markProcessed).not.toHaveBeenCalled();
  });
});
