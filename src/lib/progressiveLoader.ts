/**
 * ProgressiveLoader — priority-based data loading.
 *
 * Solves: 30+ hooks fired their fetches simultaneously on login. The
 * thundering herd hammered Supabase, exhausted realtime connections,
 * and on mobile produced visible blank screens for 3-5 seconds.
 *
 * Now: tiers run sequentially. Tier 1 (critical: tasks, events) loads
 * first; the UI is interactive. Tier 2 (secondary: emails, contacts,
 * contracts) follows. Tier 3 (background: health, insights, analytics)
 * fills in last.
 */

export type LoadTier = 1 | 2 | 3;

export type LoadFn = () => Promise<void>;

interface PendingLoad {
  id: string;
  tier: LoadTier;
  fn: LoadFn;
}

class ProgressiveLoader {
  private queues: Record<LoadTier, PendingLoad[]> = { 1: [], 2: [], 3: [] };
  private running = false;
  private completed = new Set<string>();
  private currentTier: LoadTier | null = null;

  /** Register a loader. Returns a promise that resolves when this loader runs. */
  register(id: string, tier: LoadTier, fn: LoadFn): Promise<void> {
    if (this.completed.has(id)) {
      return Promise.resolve();
    }

    return new Promise((resolve, _reject) => {
      const wrapped: LoadFn = async () => {
        try {
          await fn();
          this.completed.add(id);
          resolve();
        } catch (err) {
          // Swallow — module health already records the failure.
          // Resolve anyway so subsequent tiers don't block.
          this.completed.add(id);
          resolve();
          console.warn(`[ProgressiveLoader] ${id} failed:`, err);
        }
      };
      this.queues[tier].push({ id, tier, fn: wrapped });
      // Kick off if idle.
      if (!this.running) {
        void this.drain();
      }
    });
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;

    for (const tier of [1, 2, 3] as LoadTier[]) {
      this.currentTier = tier;
      const queue = this.queues[tier];
      // Run a tier in parallel internally, but tiers are sequential.
      while (queue.length > 0) {
        const batch = queue.splice(0, queue.length);
        await Promise.all(batch.map((p) => p.fn()));
      }
      // Short yield between tiers so the UI can paint.
      await new Promise((r) => setTimeout(r, 0));
    }

    this.currentTier = null;
    this.running = false;

    // If new loaders arrived while we were finishing, drain again.
    if (this.queues[1].length || this.queues[2].length || this.queues[3].length) {
      void this.drain();
    }
  }

  /** For use in tests / sign-out: reset state. */
  reset(): void {
    this.queues = { 1: [], 2: [], 3: [] };
    this.completed.clear();
    this.running = false;
    this.currentTier = null;
  }
}

export const progressiveLoader = new ProgressiveLoader();
