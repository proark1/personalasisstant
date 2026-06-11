import { describe, expect, it } from 'vitest';
import {
  buildBestNextActionMessage,
  buildMemorySnapshotMessage,
  escapeTelegramHtml,
  formatTelegramDate,
  truncateTelegramText,
  userDayYmd,
} from '../../supabase/functions/_shared/telegram-quick';

describe('telegram quick command formatting', () => {
  it('escapes Telegram HTML control characters', () => {
    expect(escapeTelegramHtml('Meet <Ali> & team')).toBe('Meet &lt;Ali&gt; &amp; team');
  });

  it('truncates long values with an ellipsis', () => {
    expect(truncateTelegramText('  alpha   beta gamma  ', 10)).toBe('alpha bet…');
    expect(truncateTelegramText('abc', 1)).toBe('…');
    expect(truncateTelegramText('abc', 0)).toBe('');
  });

  it('formats dates in the user timezone and falls back for invalid dates', () => {
    expect(formatTelegramDate('not-a-date', 'Europe/Berlin')).toBe('unknown time');
    expect(userDayYmd(new Date('2026-06-10T23:30:00.000Z'), 'Europe/Berlin')).toBe('2026-06-11');
    expect(userDayYmd(new Date('2026-06-10T23:30:00.000Z'), 'Definitely/NotAZone')).toBe('2026-06-10');
  });

  it('prioritizes pending approvals for best-next-action', () => {
    const text = buildBestNextActionMessage({
      pendingCount: 2,
      workspaceId: null,
      nextEvent: { title: 'Board sync', start_time: '2026-06-11T09:30:00.000Z' },
      now: new Date('2026-06-11T09:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(text).toContain('<b>2</b> pending approvals');
    expect(text).toContain('/approvals');
  });

  it('escapes event titles in best-next-action output', () => {
    const text = buildBestNextActionMessage({
      pendingCount: 0,
      workspaceId: 'workspace-1',
      nextEvent: { title: 'Discuss <pricing> & launch', start_time: '2026-06-11T09:30:00.000Z' },
      now: new Date('2026-06-11T09:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(text).toContain('Best next move — workspace');
    expect(text).toContain('Discuss &lt;pricing&gt; &amp; launch');
  });



  it('does not treat past events as imminent prep', () => {
    const text = buildBestNextActionMessage({
      pendingCount: 0,
      workspaceId: null,
      nextEvent: { title: 'Already happened', start_time: '2026-06-11T08:30:00.000Z' },
      now: new Date('2026-06-11T09:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(text).not.toContain('Prep for');
    expect(text).toContain('Your next event');
  });

  it('scopes memory output and escapes saved facts/preferences', () => {
    const text = buildMemorySnapshotMessage({
      workspaceId: 'workspace-1',
      memoryRows: [{ key: 'client <tone>', category: 'work & sales', value: 'Prefers concise <updates>' }],
      prefRows: [{ key: 'meeting_style', value: 'No calls before 10 & after 17', confidence: 0.82, times_seen: 3 }],
    });

    expect(text).toContain('active workspace facts');
    expect(text).toContain('client &lt;tone&gt;');
    expect(text).toContain('work &amp; sales');
    expect(text).toContain('No calls before 10 &amp; after 17');
    expect(text).toContain('(82%)');
  });

  it('truncates long memory values before escaping', () => {
    const text = buildMemorySnapshotMessage({
      workspaceId: null,
      memoryRows: [{ key: 'long', value: '<' + 'x'.repeat(260) + '>' }],
      prefRows: [],
    });

    expect(text.length).toBeLessThan(400);
    expect(text).toContain('&lt;');
    expect(text).toContain('…');
  });
});
