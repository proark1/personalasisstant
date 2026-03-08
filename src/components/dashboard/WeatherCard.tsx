import { useState } from 'react';
import { useWeather } from '@/hooks/useWeather';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { MapPin, CloudOff } from 'lucide-react';

export function WeatherCard() {
  const { weather, loading, error } = useWeather();
  const [useFahrenheit, setUseFahrenheit] = useState(false);

  if (loading) return null;

  if (error || !weather) {
    return (
      <GlassCard>
        <GlassCardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CloudOff className="w-4 h-4 shrink-0" />
            <span className="text-xs">Weather unavailable</span>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  const temp = useFahrenheit
    ? Math.round(weather.temperature * 9 / 5 + 32)
    : weather.temperature;
  const unit = useFahrenheit ? '°F' : '°C';

  return (
    <GlassCard pressable haptic="light">
      <GlassCardContent className="p-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{weather.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold">{temp}{unit}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setUseFahrenheit(!useFahrenheit); }}
                className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                {useFahrenheit ? '°C' : '°F'}
              </button>
              <span className="text-xs text-muted-foreground">{weather.condition}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{weather.location}</span>
            </div>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
