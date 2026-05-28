import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'X-Content-Type-Options': 'nosniff',
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
  userAge?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { metrics, goals, userAge } = await req.json() as HealthInsightsRequest;

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
    const aggregated: Record<string, { total: number; count: number; latest: number; min: number; max: number }> = {};
    
    for (const metric of metrics) {
      if (!aggregated[metric.metric_type]) {
        aggregated[metric.metric_type] = { 
          total: 0, 
          count: 0, 
          latest: metric.value,
          min: metric.value,
          max: metric.value
        };
      }
      aggregated[metric.metric_type].total += metric.value;
      aggregated[metric.metric_type].count += 1;
      aggregated[metric.metric_type].latest = metric.value;
      aggregated[metric.metric_type].min = Math.min(aggregated[metric.metric_type].min, metric.value);
      aggregated[metric.metric_type].max = Math.max(aggregated[metric.metric_type].max, metric.value);
    }

    const prompt = `You are a health insights AI assistant with expertise in analyzing Apple Watch and health data. Based on the following health data from the last 24 hours, provide 3-5 personalized insights that include recommendations, warnings, or positive feedback.

Health Data (last 24 hours):
${Object.entries(aggregated).map(([type, data]) => {
  const avg = data.total / data.count;
  return `- ${type.replace(/_/g, ' ')}: total=${data.total.toFixed(1)}, average=${avg.toFixed(1)}, latest=${data.latest}, min=${data.min}, max=${data.max}`;
}).join('\n')}

Health Goals:
- Steps goal: ${goals.steps}
- Calories goal: ${goals.calories} kcal
- Sleep goal: ${goals.sleepHours} hours
- Water intake goal: ${goals.waterIntake} glasses
- Active minutes goal: ${goals.activeMinutes} minutes
${userAge ? `\nUser age: ${userAge} years old` : ''}

ENHANCED METRICS CONTEXT:
- HRV (Heart Rate Variability): Higher is better. Low HRV (<20ms) indicates stress/poor recovery. Optimal range: 50-100ms.
- Resting Heart Rate: Lower is typically better for cardiovascular fitness. Athletes: 40-60 bpm. Average adult: 60-80 bpm.
- Blood Oxygen (SpO2): Normal range 95-100%. Below 92% is concerning.
- Respiratory Rate: Normal adult range 12-20 breaths/min. During sleep, 12-16 is normal.
- Body Fat: Healthy ranges vary by gender and age. Men: 10-20%, Women: 18-28%.

Respond with a JSON array of insights. Each insight should have:
- type: "warning" (for health concerns), "recommendation" (for improvement tips), "success" (for goals met), or "info" (general health tip)
- title: A short title (max 6 words)
- message: A personalized message (max 60 words)

Focus on:
1. Goal progress (are they meeting their goals?)
2. HRV and stress/recovery analysis if data available
3. Cardiovascular health (heart rate trends, blood oxygen)
4. Sleep quality insights
5. Any concerning patterns (low SpO2, high resting HR, low HRV)
6. Positive reinforcement for achievements
7. Actionable recommendations for improvement

Respond ONLY with a valid JSON array, no other text.`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GEMINI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
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
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
