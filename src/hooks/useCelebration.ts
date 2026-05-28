import { useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';

interface CelebrationOptions {
  type: 'taskComplete' | 'highPriorityComplete' | 'streak';
  streakCount?: number;
}

export function useCelebration() {
  const lastCelebrationRef = useRef<number>(0);

  const celebrate = useCallback((options: CelebrationOptions) => {
    const now = Date.now();
    // Debounce celebrations (at least 500ms apart)
    if (now - lastCelebrationRef.current < 500) return;
    lastCelebrationRef.current = now;

    switch (options.type) {
      case 'highPriorityComplete':
        // Big confetti burst for high priority tasks
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00d4ff', '#7c3aed', '#10b981', '#f59e0b'],
        });
        break;

      case 'taskComplete':
        // Subtle celebration for regular task completion
        confetti({
          particleCount: 30,
          spread: 50,
          origin: { y: 0.7 },
          colors: ['#00d4ff', '#7c3aed'],
          gravity: 1.2,
          scalar: 0.8,
        });
        break;

      case 'streak': {
        // Epic celebration for streak milestones
        const duration = 2000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        const randomInRange = (min: number, max: number) =>
          Math.random() * (max - min) + min;

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);

          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            colors: ['#00d4ff', '#7c3aed', '#10b981'],
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            colors: ['#f59e0b', '#ef4444', '#7c3aed'],
          });
        }, 250);
        break;
      }
    }
  }, []);

  // Check for streak milestones
  const checkStreak = useCallback((consecutiveDays: number) => {
    const milestones = [7, 14, 30, 60, 100];
    if (milestones.includes(consecutiveDays)) {
      celebrate({ type: 'streak', streakCount: consecutiveDays });
      return true;
    }
    return false;
  }, [celebrate]);

  return { celebrate, checkStreak };
}
