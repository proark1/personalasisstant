import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthMetric {
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
}

interface HealthInsightsRequest {
  metrics: HealthMetric[];
  goals: {
    steps: number;
    calories: number;
    sleepHours: number;
    waterIntake: number;
    activeMinutes: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { metrics, goals } = await req.json() as HealthInsightsRequest;

    if (!metrics || metrics.length === 0) {
      return new Response(
        JSON.stringify({ 
          insights: [{
            type: 'info',
            title: 'No Data Yet',
            message: 'Start tracking your health metrics to receive personalized insights and recommendations.'
          }]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate metrics by type
    const aggregated: Record<string, { total: number; count: number; latest: number }> = {};
    
    for (const metric of metrics) {
      if (!aggregated[metric.metric_type]) {
        aggregated[metric.metric_type] = { total: 0, count: 0, latest: metric.value };
      }
      aggregated[metric.metric_type].total += metric.value;
      aggregated[metric.metric_type].count += 1;
      aggregated[metric.metric_type].latest = metric.value;
    }

    const prompt = `You are a health insights AI assistant. Based on the following health data from the last 24 hours, provide 2-4 personalized insights that include recommendations, warnings, or positive feedback.

Health Data (last 24 hours):
${Object.entries(aggregated).map(([type, data]) => {
  const avg = data.total / data.count;
  return `- ${type.replace('_', ' ')}: total=${data.total.toFixed(1)}, average=${avg.toFixed(1)}, latest=${data.latest}`;
}).join('\n')}

Health Goals:
- Steps goal: ${goals.steps}
- Calories goal: ${goals.calories} kcal
- Sleep goal: ${goals.sleepHours} hours
- Water intake goal: ${goals.waterIntake} glasses
- Active minutes goal: ${goals.activeMinutes} minutes

Respond with a JSON array of insights. Each insight should have:
- type: "warning" (for health concerns), "recommendation" (for improvement tips), "success" (for goals met), or "info" (general health tip)
- title: A short title (max 6 words)
- message: A personalized message (max 50 words)

Focus on:
1. Goal progress (are they meeting their goals?)
2. Any concerning patterns (low activity, poor sleep, etc.)
3. Positive reinforcement for achievements
4. Actionable recommendations

Respond ONLY with a valid JSON array, no other text.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Parse the JSON response
    let insights;
    try {
      // Clean up the response - remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      insights = JSON.parse(cleanedContent);
    } catch {
      insights = [{
        type: 'info',
        title: 'Stay Active',
        message: 'Keep tracking your health metrics for personalized insights.'
      }];
    }

    return new Response(
      JSON.stringify({ insights }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating health insights:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate insights',
        insights: [{
          type: 'info',
          title: 'Stay Healthy',
          message: 'Continue tracking your daily health metrics for personalized recommendations.'
        }]
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
