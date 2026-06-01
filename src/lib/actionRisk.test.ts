import { describe, expect, it } from 'vitest';
import { classifyActionRisk, requiresConfirmation } from './actionRisk';

describe('classifyActionRisk', () => {
  it('always confirms outward-facing / high-stakes tools', () => {
    expect(classifyActionRisk('send_email')).toBe('confirm');
    expect(classifyActionRisk('bulk_delete_events')).toBe('confirm');
    expect(classifyActionRisk('bulk_reschedule')).toBe('confirm');
    expect(classifyActionRisk('budget')).toBe('confirm');
    expect(classifyActionRisk('meds')).toBe('confirm');
  });

  it('confirms destructive operations on otherwise-auto CRUD tools', () => {
    expect(classifyActionRisk('manage_task', 'delete')).toBe('confirm');
    expect(classifyActionRisk('manage_contract', 'cancel')).toBe('confirm');
    expect(classifyActionRisk('manage_event', 'remove')).toBe('confirm');
    expect(classifyActionRisk('email_action', 'send')).toBe('confirm');
  });

  it('auto-runs reversible, own-data operations', () => {
    expect(classifyActionRisk('manage_task', 'create')).toBe('auto');
    expect(classifyActionRisk('manage_note', 'update')).toBe('auto');
    expect(classifyActionRisk('compose_email')).toBe('auto'); // draft only
    expect(classifyActionRisk('find_time')).toBe('auto');
    expect(classifyActionRisk('web_search')).toBe('auto');
    expect(classifyActionRisk('save_memory')).toBe('auto');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(classifyActionRisk('  SEND_EMAIL ')).toBe('confirm');
    expect(classifyActionRisk('manage_task', 'DELETE')).toBe('confirm');
  });

  it('defaults unknown tools without a destructive op to auto', () => {
    expect(classifyActionRisk('some_new_tool')).toBe('auto');
    expect(classifyActionRisk('some_new_tool', 'delete')).toBe('confirm');
  });

  it('requiresConfirmation mirrors the classification', () => {
    expect(requiresConfirmation('send_email')).toBe(true);
    expect(requiresConfirmation('manage_task', 'create')).toBe(false);
  });
});
