import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, MapPin, Cloud, Sun, CloudRain } from 'lucide-react';
import { useFamilyAssistant } from '@/hooks/useFamilyAssistant';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useWeather } from '@/hooks/useWeather';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FamilyActivityFinderProps {
  onClose?: () => void;
}

export function FamilyActivityFinder({ onClose }: FamilyActivityFinderProps) {
  const { members } = useFamilyMembers();
  const { weather } = useWeather();
  const { findActivities, isLoading, streamingResponse } = useFamilyAssistant();
  const [customQuery, setCustomQuery] = useState('');
  const [response, setResponse] = useState('');

  const getWeatherIcon = () => {
    if (!weather) return <Cloud className="w-4 h-4" />;
    if (weather.condition.toLowerCase().includes('rain')) return <CloudRain className="w-4 h-4" />;
    if (weather.condition.toLowerCase().includes('clear') || weather.condition.toLowerCase().includes('sunny')) 
      return <Sun className="w-4 h-4" />;
    return <Cloud className="w-4 h-4" />;
  };

  const handleFindActivities = async (query?: string) => {
    try {
      const result = await findActivities(
        members,
        weather ? { temperature: weather.temperature, condition: weather.condition } : undefined,
        query || customQuery || undefined
      );
      setResponse(result);
    } catch (error) {
      console.error('Error finding activities:', error);
    }
  };

  const quickSuggestions = [
    { label: 'Rainy day fun', query: 'What indoor activities can we do on a rainy day?' },
    { label: 'Educational games', query: 'Suggest educational activities that are also fun' },
    { label: 'Outdoor adventures', query: 'What outdoor activities can we do as a family?' },
    { label: 'Weekend plans', query: 'Plan a fun family weekend with different activities' },
    { label: 'Quick activities', query: 'Suggest fun activities we can do in under 30 minutes' },
  ];

  const children = members.filter(m => m.relationship === 'child');

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Family Activity Finder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Context summary */}
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {weather && (
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              {getWeatherIcon()}
              <span>{weather.temperature}°C, {weather.condition}</span>
            </div>
          )}
          {weather?.location && (
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <MapPin className="w-3 h-3" />
              <span>{weather.location}</span>
            </div>
          )}
          {children.length > 0 && (
            <div className="bg-muted px-2 py-1 rounded-full">
              {children.length} {children.length === 1 ? 'child' : 'children'}
            </div>
          )}
        </div>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2">
          {quickSuggestions.map((suggestion) => (
            <Button
              key={suggestion.label}
              variant="outline"
              size="sm"
              onClick={() => handleFindActivities(suggestion.query)}
              disabled={isLoading}
            >
              {suggestion.label}
            </Button>
          ))}
        </div>

        {/* Custom query */}
        <div className="space-y-2">
          <Textarea
            placeholder="Or describe what kind of activities you're looking for..."
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            className="min-h-[60px]"
          />
          <Button 
            onClick={() => handleFindActivities()} 
            disabled={isLoading || !customQuery.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Finding activities...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Get Suggestions
              </>
            )}
          </Button>
        </div>

        {/* Response */}
        {(streamingResponse || response) && (
          <ScrollArea className="h-[300px] border rounded-lg p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {isLoading ? streamingResponse : response}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
