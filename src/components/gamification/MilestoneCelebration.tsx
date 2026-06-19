import React, { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Sparkles, X } from "lucide-react";
import confetti from "canvas-confetti";

interface UserChallenge {
  id: string;
  challenge: {
    title: string;
    description: string | null;
    xpReward: number;
    badgeName: string | null;
  };
}

interface MilestoneCelebrationProps {
  challenge: UserChallenge | null;
  onDismiss: () => void;
}

export function MilestoneCelebration({ challenge, onDismiss }: MilestoneCelebrationProps) {
  useEffect(() => {
    if (challenge) {
      // Fire confetti!
      const duration = 3000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          particleCount,
          startVelocity: 30,
          spread: 360,
          origin: {
            x: randomInRange(0.1, 0.9),
            y: randomInRange(0.1, 0.5),
          },
          colors: ["#FFD700", "#FFA500", "#FF6347", "#7B68EE", "#00CED1"],
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [challenge]);

  if (!challenge) return null;

  return (
    <Dialog open={!!challenge} onOpenChange={() => onDismiss()}>
      <DialogContent className="sm:max-w-md text-center">
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="py-6 space-y-6">
          {/* Trophy Animation */}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-amber-400 animate-pulse" />
            <Star className="absolute -bottom-1 -left-2 w-6 h-6 text-amber-400 animate-pulse" />
          </div>

          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              Challenge Complete!
            </h2>
            <p className="text-muted-foreground mt-1">Amazing work! 🎉</p>
          </div>

          {/* Challenge Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-lg">{challenge.challenge.title}</h3>
            {challenge.challenge.description && (
              <p className="text-sm text-muted-foreground">{challenge.challenge.description}</p>
            )}
          </div>

          {/* Rewards */}
          <div className="flex items-center justify-center gap-3">
            <Badge className="bg-amber-500 text-white text-lg px-4 py-2">
              <Sparkles className="w-4 h-4 mr-2" />+{challenge.challenge.xpReward} XP
            </Badge>
            {challenge.challenge.badgeName && (
              <Badge
                variant="outline"
                className="text-lg px-4 py-2 border-amber-500 text-amber-600"
              >
                <Star className="w-4 h-4 mr-2" />
                {challenge.challenge.badgeName.replace("_", " ")}
              </Badge>
            )}
          </div>

          {/* CTA */}
          <Button onClick={onDismiss} size="lg" className="w-full">
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
