import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DoriBar } from './DoriBar';

// useNextUp pulls from supabase/auth; stub it so the bar renders in isolation.
vi.mock('@/hooks/useNextUp', () => ({
  useNextUp: () => ({ items: [], loading: false }),
}));

describe('DoriBar', () => {
  let dispatched: CustomEvent[];
  let listener: (e: Event) => void;

  beforeEach(() => {
    dispatched = [];
    listener = (e: Event) => dispatched.push(e as CustomEvent);
    window.addEventListener('dori:ask', listener);
  });
  afterEach(() => window.removeEventListener('dori:ask', listener));

  it('dispatches dori:ask with the typed text on Enter and clears the input', () => {
    const { getByLabelText } = render(<DoriBar onVoiceMode={vi.fn()} />);
    const input = getByLabelText('Ask Dori anything') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'add milk to my shopping list' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].detail).toEqual({ text: 'add milk to my shopping list' });
    expect(input.value).toBe('');
  });

  it('does not dispatch for empty/whitespace input', () => {
    const { getByLabelText } = render(<DoriBar onVoiceMode={vi.fn()} />);
    const input = getByLabelText('Ask Dori anything');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(dispatched).toHaveLength(0);
  });

  it('invokes voice mode from the mic button', () => {
    const onVoiceMode = vi.fn();
    const { getByLabelText } = render(<DoriBar onVoiceMode={onVoiceMode} />);
    fireEvent.click(getByLabelText('Talk to Dori'));
    expect(onVoiceMode).toHaveBeenCalledOnce();
  });

  it('shows a working state and hides the input while processing', () => {
    const { queryByLabelText, getByText } = render(
      <DoriBar onVoiceMode={vi.fn()} isProcessing thinkingStatus="Creating task…" />,
    );
    expect(getByText('Creating task…')).toBeInTheDocument();
    expect(queryByLabelText('Ask Dori anything')).toBeNull();
  });

  it('renders nothing when hidden', () => {
    const { container } = render(<DoriBar onVoiceMode={vi.fn()} hidden />);
    expect(container.firstChild).toBeNull();
  });
});
