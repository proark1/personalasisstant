import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthMetric {
  metric_type: string;
  value: number;
  recorded_at: string;
  unit: string;
}

interface DailyCheckin {
  checkin_date: string;
  sleep_hours: number | null;
  mood: string | null;
  energy_level: string | null;
  stress_level: number | null;
  exercise_minutes: number | null;
  water_glasses: number | null;
}

interface HealthCoachRequest {
  metrics: HealthMetric[];
  checkins: DailyCheckin[];
  userQuestion?: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  goals?: Record<string, number>;
}

function calculateTrends(metrics: HealthMetric[]) {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const trends: Record<string, { thisWeek: number[]; lastWeek: number[]; thisMonth: number[] }> = {};

  metrics.forEach(m => {
    const date = new Date(m.recorded_at);
    if (!trends[m.metric_type]) {
      trends[m.metric_type] = { thisWeek: [], lastWeek: [], thisMonth: [] };
    }

    if (date >= oneWeekAgo) {
      trends[m.metric_type].thisWeek.push(m.value);
    } else if (date >= twoWeeksAgo) {
      trends[m.metric_type].lastWeek.push(m.value);
    }
    if (date >= oneMonthAgo) {
      trends[m.metric_type].thisMonth.push(m.value);
    }
  });

  const trendAnalysis: Array<{
    metric: string;
    trend: 'improving' | 'declining' | 'stable';
    thisWeekAvg: number;
    lastWeekAvg: number;
    percentChange: number;
  }> = [];

  Object.entries(trends).forEach(([metric, data]) => {
    if (data.thisWeek.length > 0 && data.lastWeek.length > 0) {
      const thisWeekAvg = data.thisWeek.reduce((a, b) => a + b, 0) / data.thisWeek.length;
      const lastWeekAvg = data.lastWeek.reduce((a, b) => a + b, 0) / data.lastWeek.length;
      const percentChange = lastWeekAvg > 0 ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 : 0;

      // Determine if improving based on metric type
      const higherIsBetter = ['steps', 'exercise_minutes', 'hrv', 'sleep_hours', 'water_glasses', 'blood_oxygen'].includes(metric);
      const lowerIsBetter = ['resting_heart_rate', 'stress_level'].includes(metric);

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (Math.abs(percentChange) > 5) {
        if (higherIsBetter) {
          trend = percentChange > 0 ? 'improving' : 'declining';
        } else if (lowerIsBetter) {
          trend = percentChange < 0 ? 'improving' : 'declining';
        } else {
          trend = Math.abs(percentChange) > 10 ? (percentChange > 0 ? 'improving' : 'declining') : 'stable';
        }
      }

      trendAnalysis.push({
        metric,
        trend,
        thisWeekAvg: Math.round(thisWeekAvg * 10) / 10,
        lastWeekAvg: Math.round(lastWeekAvg * 10) / 10,
        percentChange: Math.round(percentChange * 10) / 10,
      });
    }
  });

  return trendAnalysis;
}

function findCorrelations(metrics: HealthMetric[], checkins: DailyCheckin[]) {
  const correlations: Array<{ finding: string; confidence: 'high' | 'medium'; suggestion: string }> = [];

  // Group metrics by date
  const metricsByDate: Record<string, Record<string, number>> = {};
  metrics.forEach(m => {
    const date = m.recorded_at.split('T')[0];
    if (!metricsByDate[date]) metricsByDate[date] = {};
    if (!metricsByDate[date][m.metric_type]) {
      metricsByDate[date][m.metric_type] = m.value;
    } else {
      // Average if multiple readings
      metricsByDate[date][m.metric_type] = (metricsByDate[date][m.metric_type] + m.value) / 2;
    }
  });

  // Add checkin data
  checkins.forEach(c => {
    const date = c.checkin_date;
    if (!metricsByDate[date]) metricsByDate[date] = {};
    if (c.sleep_hours) metricsByDate[date]['sleep_hours'] = c.sleep_hours;
    if (c.exercise_minutes) metricsByDate[date]['exercise_minutes'] = c.exercise_minutes;
    if (c.stress_level) metricsByDate[date]['stress_level'] = c.stress_level;
    if (c.water_glasses) metricsByDate[date]['water_glasses'] = c.water_glasses;
  });

  const dates = Object.keys(metricsByDate).sort();
  if (dates.length < 5) return correlations;

  // Check steps vs next-day sleep
  let highStepsBetterSleep = 0;
  let lowStepsBetterSleep = 0;
  let comparisons = 0;

  for (let i = 0; i < dates.length - 1; i++) {
    const today = metricsByDate[dates[i]];
    const tomorrow = metricsByDate[dates[i + 1]];
    
    if (today.steps && tomorrow.sleep_hours) {
      comparisons++;
      if (today.steps > 7000 && tomorrow.sleep_hours > 7) highStepsBetterSleep++;
      if (today.steps < 5000 && tomorrow.sleep_hours < 6.5) lowStepsBetterSleep++;
    }
  }

  if (comparisons >= 5 && (highStepsBetterSleep / comparisons > 0.5 || lowStepsBetterSleep / comparisons > 0.4)) {
    correlations.push({
      finding: "On days you walk more, you tend to sleep better that night",
      confidence: highStepsBetterSleep / comparisons > 0.6 ? 'high' : 'medium',
      suggestion: "Aim for 7000+ steps to improve your sleep quality"
    });
  }

  // Check exercise vs energy
  let exerciseDays: number[] = [];
  let noExerciseDays: number[] = [];

  dates.forEach(date => {
    const d = metricsByDate[date];
    const energyMap: Record<string, number> = { low: 1, medium: 2, high: 3 };
    const checkin = checkins.find(c => c.checkin_date === date);
    const energy = checkin?.energy_level ? energyMap[checkin.energy_level] || 2 : null;
    
    if (energy !== null) {
      if (d.exercise_minutes && d.exercise_minutes > 20) {
        exerciseDays.push(energy);
      } else {
        noExerciseDays.push(energy);
      }
    }
  });

  if (exerciseDays.length >= 3 && noExerciseDays.length >= 3) {
    const avgExerciseEnergy = exerciseDays.reduce((a, b) => a + b, 0) / exerciseDays.length;
    const avgNoExerciseEnergy = noExerciseDays.reduce((a, b) => a + b, 0) / noExerciseDays.length;
    
    if (avgExerciseEnergy > avgNoExerciseEnergy + 0.3) {
      correlations.push({
        finding: "You report higher energy levels on days you exercise",
        confidence: avgExerciseEnergy - avgNoExerciseEnergy > 0.5 ? 'high' : 'medium',
        suggestion: "Even a 20-minute workout can boost your energy for the day"
      });
    }
  }

  // Check sleep vs stress
  let goodSleepStress: number[] = [];
  let badSleepStress: number[] = [];

  dates.forEach(date => {
    const d = metricsByDate[date];
    if (d.sleep_hours && d.stress_level) {
      if (d.sleep_hours >= 7) {
        goodSleepStress.push(d.stress_level);
      } else if (d.sleep_hours < 6) {
        badSleepStress.push(d.stress_level);
      }
    }
  });

  if (goodSleepStress.length >= 3 && badSleepStress.length >= 3) {
    const avgGoodSleepStress = goodSleepStress.reduce((a, b) => a + b, 0) / goodSleepStress.length;
    const avgBadSleepStress = badSleepStress.reduce((a, b) => a + b, 0) / badSleepStress.length;
    
    if (avgBadSleepStress > avgGoodSleepStress + 1) {
      correlations.push({
        finding: "Poor sleep is linked to higher stress levels the next day",
        confidence: avgBadSleepStress - avgGoodSleepStress > 1.5 ? 'high' : 'medium',
        suggestion: "Prioritize 7+ hours of sleep to manage stress better"
      });
    }
  }

  return correlations;
}

function calculateWeeklyScore(metrics: HealthMetric[], checkins: DailyCheckin[], goals: Record<string, number>) {
  let score = 50; // Start at 50
  const highlights: string[] = [];
  const improvements: string[] = [];

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Filter to this week
  const weekMetrics = metrics.filter(m => new Date(m.recorded_at) >= oneWeekAgo);
  const weekCheckins = checkins.filter(c => new Date(c.checkin_date) >= oneWeekAgo);

  // Steps score
  const stepsData = weekMetrics.filter(m => m.metric_type === 'steps');
  if (stepsData.length > 0) {
    const avgSteps = stepsData.reduce((a, b) => a + b.value, 0) / stepsData.length;
    const stepGoal = goals.steps || 8000;
    const stepScore = Math.min((avgSteps / stepGoal) * 20, 20);
    score += stepScore - 10;
    
    if (avgSteps >= stepGoal) {
      highlights.push(`Averaged ${Math.round(avgSteps).toLocaleString()} steps/day (goal: ${stepGoal.toLocaleString()})`);
    } else {
      improvements.push(`Step count ${Math.round((1 - avgSteps/stepGoal) * 100)}% below goal`);
    }
  }

  // Sleep score
  const sleepData = weekCheckins.filter(c => c.sleep_hours);
  if (sleepData.length > 0) {
    const avgSleep = sleepData.reduce((a, b) => a + (b.sleep_hours || 0), 0) / sleepData.length;
    const sleepGoal = goals.sleep || 7.5;
    
    if (avgSleep >= sleepGoal) {
      score += 15;
      highlights.push(`Great sleep averaging ${avgSleep.toFixed(1)} hours/night`);
    } else if (avgSleep >= 6) {
      score += 5;
      improvements.push(`Sleep ${((sleepGoal - avgSleep) * 60).toFixed(0)} minutes below goal`);
    } else {
      score -= 10;
      improvements.push(`Significant sleep debt - averaging only ${avgSleep.toFixed(1)} hours`);
    }
  }

  // Exercise score
  const exerciseData = weekCheckins.filter(c => c.exercise_minutes && c.exercise_minutes > 0);
  if (exerciseData.length >= 3) {
    score += 10;
    highlights.push(`Exercised ${exerciseData.length} days this week`);
  } else if (exerciseData.length > 0) {
    improvements.push(`Only ${exerciseData.length} active days - aim for 3+`);
  } else {
    score -= 5;
    improvements.push("No recorded exercise this week");
  }

  // HRV score (if available)
  const hrvData = weekMetrics.filter(m => m.metric_type === 'hrv');
  if (hrvData.length > 0) {
    const avgHrv = hrvData.reduce((a, b) => a + b.value, 0) / hrvData.length;
    if (avgHrv >= 50) {
      score += 10;
      highlights.push(`Strong HRV averaging ${Math.round(avgHrv)}ms - good recovery`);
    } else if (avgHrv < 30) {
      score -= 5;
      improvements.push("Low HRV suggests elevated stress or fatigue");
    }
  }

  // Mood score
  const moodData = weekCheckins.filter(c => c.mood);
  if (moodData.length > 0) {
    const moodMap: Record<string, number> = { terrible: 1, bad: 2, okay: 3, good: 4, great: 5 };
    const avgMood = moodData.reduce((a, b) => a + (moodMap[b.mood || 'okay'] || 3), 0) / moodData.length;
    
    if (avgMood >= 4) {
      score += 10;
      highlights.push("Consistently positive mood this week");
    } else if (avgMood < 2.5) {
      improvements.push("Mood has been lower than usual");
    }
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, highlights, improvements };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { metrics, checkins, userQuestion, timeOfDay, goals = {} }: HealthCoachRequest = await req.json();

    // Calculate trends
    const trendAnalysis = calculateTrends(metrics);
    
    // Find correlations
    const correlations = findCorrelations(metrics, checkins);
    
    // Calculate weekly score
    const { score: weeklyScore, highlights, improvements } = calculateWeeklyScore(metrics, checkins, goals);

    // Build context for AI
    const trendSummary = trendAnalysis.map(t => 
      `${t.metric}: ${t.trend} (${t.percentChange > 0 ? '+' : ''}${t.percentChange}% vs last week, now averaging ${t.thisWeekAvg})`
    ).join('\n');

    const correlationSummary = correlations.map(c => c.finding).join('\n');

    // Recent data summary
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentMetrics = metrics.filter(m => new Date(m.recorded_at) >= yesterday);
    const recentCheckin = checkins.find(c => new Date(c.checkin_date) >= yesterday);

    const recentSummary = recentMetrics.map(m => `${m.metric_type}: ${m.value} ${m.unit}`).join(', ');
    const checkinSummary = recentCheckin ? 
      `Sleep: ${recentCheckin.sleep_hours || 'unknown'}h, Mood: ${recentCheckin.mood || 'unknown'}, Energy: ${recentCheckin.energy_level || 'unknown'}, Stress: ${recentCheckin.stress_level || 'unknown'}/10` 
      : 'No recent check-in';

    const systemPrompt = `You are a caring, knowledgeable AI health coach. You analyze health data and provide personalized, actionable advice.

IMPORTANT RULES:
- Be warm and encouraging, never judgmental
- Focus on small, achievable improvements
- Acknowledge what's going well before suggesting changes
- Be specific with recommendations (times, amounts, actions)
- Consider the time of day for relevant suggestions
- Keep responses concise but meaningful
- Use the user's actual data to personalize advice

Current time: ${timeOfDay}
Weekly Health Score: ${weeklyScore}/100

TREND DATA:
${trendSummary || 'Limited trend data available'}

CORRELATIONS DISCOVERED:
${correlationSummary || 'Still gathering data for correlations'}

RECENT DATA (last 24h):
${recentSummary || 'No recent metrics'}
${checkinSummary}

WEEKLY HIGHLIGHTS:
${highlights.join('\n') || 'No highlights yet'}

AREAS FOR IMPROVEMENT:
${improvements.join('\n') || 'Keep up the good work!'}

USER GOALS:
${Object.entries(goals).map(([k, v]) => `${k}: ${v}`).join(', ') || 'No specific goals set'}`;

    const userPrompt = userQuestion || 
      `Based on my health data, provide:
1. TODAY'S FOCUS: What should I prioritize today based on my trends and the time of day?
2. KEY INSIGHT: The most important observation from my recent data
3. QUICK WIN: One simple action I can take right now to improve my health
4. WEEKLY OUTLOOK: Brief assessment of how my week is going

Keep it personal and actionable. Reference my actual numbers.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const coachingAdvice = aiData.choices?.[0]?.message?.content || 'Unable to generate coaching advice.';

    return new Response(JSON.stringify({
      advice: coachingAdvice,
      trends: trendAnalysis,
      correlations,
      weeklyScore,
      highlights,
      improvements,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Health coach error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
