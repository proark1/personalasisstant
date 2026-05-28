import { describe, expect, it } from 'vitest';
import { detectContextIntents } from './smartPayloadBuilder';

describe('detectContextIntents', () => {
  it('detects email intent across phrasings', () => {
    expect(detectContextIntents('reply to that email')).toContain('email');
    expect(detectContextIntents('anything in my inbox?')).toContain('email');
  });

  it('detects contracts from synonyms the old list missed', () => {
    expect(detectContextIntents('cancel my subscriptions')).toContain('contracts');
    expect(detectContextIntents('how much is my internet bill')).toContain('contracts');
    expect(detectContextIntents('that invoice from the provider')).toContain('contracts');
  });

  it('detects wellbeing/overwhelm signals', () => {
    expect(detectContextIntents("I'm so overwhelmed today")).toContain('wellbeing');
    expect(detectContextIntents('feeling burned out and exhausted')).toContain('wellbeing');
    expect(detectContextIntents('ich bin total gestresst')).toContain('wellbeing');
  });

  it('detects contacts from relationship/action phrasings', () => {
    expect(detectContextIntents('I need to follow up with my client')).toContain('contacts');
    expect(detectContextIntents('reach out to a recruiter')).toContain('contacts');
  });

  it('returns multiple intents when a message spans domains', () => {
    const intents = detectContextIntents('email my lawyer about the contract');
    expect(intents).toEqual(expect.arrayContaining(['email', 'contacts', 'contracts']));
  });

  it('returns empty for a neutral message', () => {
    expect(detectContextIntents('what time is it')).toEqual([]);
  });

  it('never includes the dynamic location bucket', () => {
    expect(detectContextIntents('anything at all')).not.toContain('location');
  });
});
