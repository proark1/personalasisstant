import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/contexts/LanguageContext";
import { Play, Pause, RotateCcw, X, Type } from "lucide-react";

// Full-screen scrolling teleprompter for recording a script from your phone.
// Pure frontend — auto-scrolls the text at an adjustable speed, no backend.
export function Teleprompter({
  open,
  onOpenChange,
  title,
  text,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text: string;
}) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(45); // px per second
  const [fontSize, setFontSize] = useState(32);

  // Reset to top + paused whenever it opens.
  useEffect(() => {
    if (open) {
      setPlaying(false);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  }, [open]);

  // Smooth auto-scroll via rAF; stops at the bottom.
  useEffect(() => {
    if (!open || !playing) return;
    let raf = 0;
    let last = performance.now();
    const el = scrollRef.current;
    // scrollTop is integer-rounded in many browsers, so sub-pixel increments at
    // low speeds get dropped and the scroll sticks. Track a precise position and
    // resync if the user scrolls manually.
    let precise = el ? el.scrollTop : 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (el) {
        if (Math.abs(el.scrollTop - precise) > 1) precise = el.scrollTop;
        precise += speed * dt;
        el.scrollTop = precise;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
          setPlaying(false);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, playing, speed]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black text-white flex flex-col pointer-events-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <span className="text-sm text-white/60 truncate pr-2">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 shrink-0"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 text-center"
        style={{ paddingTop: "45vh", paddingBottom: "45vh" }}
      >
        <p
          className="whitespace-pre-wrap font-semibold max-w-3xl mx-auto"
          style={{ fontSize, lineHeight: 1.5 }}
        >
          {text || t("content.nothingToRead")}
        </p>
      </div>

      <div className="px-4 py-3 border-t border-white/10 space-y-3 shrink-0">
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => {
              if (scrollRef.current) scrollRef.current.scrollTop = 0;
              setPlaying(false);
            }}
            title={t("content.restart")}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="lg" className="gap-2 w-32" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            {playing ? t("content.pause") : t("content.play")}
          </Button>
        </div>
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <span className="text-xs text-white/60 w-12 shrink-0">{t("content.speed")}</span>
          <Slider
            value={[speed]}
            min={15}
            max={120}
            step={5}
            onValueChange={([v]) => setSpeed(v)}
          />
        </div>
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <Type className="h-4 w-4 text-white/60 shrink-0" />
          <Slider
            value={[fontSize]}
            min={20}
            max={56}
            step={2}
            onValueChange={([v]) => setFontSize(v)}
          />
        </div>
      </div>
    </div>
  );
}
