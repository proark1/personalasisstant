import { describe, it, expect } from 'vitest';
import {
  computeIdeaSplit,
  groupIdeasByKind,
  platformLabel,
  formatDuration,
  type ContentIdea,
} from './content';

describe('computeIdeaSplit', () => {
  it('splits 10 ideas evenly at a 0.5 ratio', () => {
    expect(computeIdeaSplit(10, 0.5)).toEqual({ current: 5, evergreen: 5 });
  });

  it('honours a trending-heavy ratio and always sums to the total', () => {
    const { current, evergreen } = computeIdeaSplit(10, 0.8);
    expect(current).toBe(8);
    expect(evergreen).toBe(2);
    expect(current + evergreen).toBe(10);
  });

  it('handles the all-evergreen and all-trending extremes', () => {
    expect(computeIdeaSplit(7, 0)).toEqual({ current: 0, evergreen: 7 });
    expect(computeIdeaSplit(7, 1)).toEqual({ current: 7, evergreen: 0 });
  });

  it('clamps the total to the 1..20 range', () => {
    expect(computeIdeaSplit(0, 0.5)).toEqual({ current: 1, evergreen: 0 });
    const big = computeIdeaSplit(999, 0.5);
    expect(big.current + big.evergreen).toBe(20);
  });

  it('clamps an out-of-range ratio rather than throwing', () => {
    expect(computeIdeaSplit(10, 2)).toEqual({ current: 10, evergreen: 0 });
    expect(computeIdeaSplit(10, -1)).toEqual({ current: 0, evergreen: 10 });
    expect(computeIdeaSplit(10, NaN)).toEqual({ current: 5, evergreen: 5 });
  });
});

describe('groupIdeasByKind', () => {
  it('partitions ideas into current and evergreen buckets', () => {
    const ideas = [
      { id: '1', kind: 'current' },
      { id: '2', kind: 'evergreen' },
      { id: '3', kind: 'current' },
    ] as ContentIdea[];
    const grouped = groupIdeasByKind(ideas);
    expect(grouped.current.map((i) => i.id)).toEqual(['1', '3']);
    expect(grouped.evergreen.map((i) => i.id)).toEqual(['2']);
  });
});

describe('platformLabel', () => {
  it('maps known platforms and falls back to General', () => {
    expect(platformLabel('youtube')).toBe('YouTube');
    expect(platformLabel('instagram')).toBe('Instagram');
    expect(platformLabel('tiktok')).toBe('TikTok');
    expect(platformLabel('generic')).toBe('General');
  });
});

describe('formatDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(30)).toBe('0:30');
    expect(formatDuration(420)).toBe('7:00');
    expect(formatDuration(95)).toBe('1:35');
  });

  it('renders an em dash for empty durations', () => {
    expect(formatDuration(0)).toBe('—');
    expect(formatDuration(null)).toBe('—');
  });
});
