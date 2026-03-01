import { useWeather } from '@/hooks/useWeather';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { MapPin } from 'lucide-react';

export function WeatherCard() {
  const { weather, loading, error } = useWeather();

  if (loading || error || !weather) return null;

  return (
    <GlassCard>
      <GlassCardContent className="p-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{weather.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold">{weather.temperature}°C</span>
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
