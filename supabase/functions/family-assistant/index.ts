import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  'X-Content-Type-Options': 'nosniff',
};

interface FamilyMember {
  name: string;
  age: number | null;
  relationship: string;
  school?: string;
  grade?: string;
  activities?: { name: string; schedule: string; location?: string }[];
  allergies?: string[];
}

interface FamilyContext {
  members: FamilyMember[];
  todayEvents?: { title: string; time: string; location?: string }[];
  weather?: { temperature: number; condition: string };
  userLocation?: string;
}

interface AssistantRequest {
  action: 'activity_finder' | 'homework_helper' | 'parenting_coach';
  query: string;
  familyContext: FamilyContext;
  // Activity finder specific
  weatherCondition?: string;
  // Homework helper specific
  subject?: string;
  childAge?: number;
  problemType?: string;
  // Parenting coach specific
  childAges?: number[];
  topic?: string;
}

const activityFinderPrompt = (context: FamilyContext, weather?: string, query?: string) => `You are a family activity expert. Based on the family composition and conditions, suggest fun, age-appropriate activities.

FAMILY CONTEXT:
${context.members.map(m => `- ${m.name}: ${m.age || 'unknown'} years old (${m.relationship})`).join('\n')}

TODAY'S WEATHER: ${weather || 'Unknown'}
LOCATION: ${context.userLocation || 'Unknown'}

${context.todayEvents?.length ? `TODAY'S SCHEDULE:\n${context.todayEvents.map(e => `- ${e.title} at ${e.time}`).join('\n')}` : 'No events scheduled today.'}

USER QUERY: ${query || 'Suggest activities for today'}

Provide 3-5 activity suggestions that are:
1. Age-appropriate for all children
2. Consider the weather conditions
3. Fit around the day's schedule
4. Mix of indoor/outdoor, active/calm, educational/fun

Format each suggestion with:
- **Activity Name**
- Why it's great for this family
- Approximate duration
- What you'll need
- Tips for making it special`;

const homeworkHelperPrompt = (subject: string, childAge: number, problemType: string, query: string) => `You are a patient, encouraging tutor helping a ${childAge}-year-old student with ${subject}.

STUDENT AGE: ${childAge} years old
SUBJECT: ${subject}
PROBLEM TYPE: ${problemType}

STUDENT'S QUESTION: ${query}

Provide help that is:
1. Age-appropriate language and explanations
2. Encouraging and supportive
3. Uses relatable examples
4. Breaks down complex concepts into simple steps
5. Includes practice tips

If this is a math problem, show step-by-step solution.
If this is a writing task, provide structure and examples.
If this is a science question, explain with real-world connections.

Always end with an encouraging note and a suggestion for how to practice more.`;

const parentingCoachPrompt = (childAges: number[], topic: string, query: string) => `You are a supportive parenting coach with expertise in child development and family dynamics.

CHILDREN'S AGES: ${childAges.length > 0 ? childAges.join(', ') : 'Not specified'}
TOPIC: ${topic}

PARENT'S QUESTION: ${query}

Provide guidance that is:
1. Empathetic and non-judgmental
2. Based on child development principles
3. Practical and actionable
4. Age-appropriate for the children involved
5. Considers the whole family dynamic

Structure your response:
1. Acknowledge the parent's concern
2. Provide developmental context (what's normal for this age)
3. Offer 2-3 specific strategies to try
4. Give an example script or scenario if helpful
5. Share encouragement

Important: Always remind parents that every child is different and to trust their instincts while seeking professional help if needed for serious concerns.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { 
      action, 
      query, 
      familyContext,
      weatherCondition,
      subject,
      childAge,
      problemType,
      childAges,
      topic,
    }: AssistantRequest = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    let systemPrompt = "";
    
    switch (action) {
      case 'activity_finder':
        systemPrompt = activityFinderPrompt(familyContext, weatherCondition, query);
        break;
      case 'homework_helper':
        systemPrompt = homeworkHelperPrompt(
          subject || 'general',
          childAge || 10,
          problemType || 'general question',
          query
        );
        break;
      case 'parenting_coach':
        systemPrompt = parentingCoachPrompt(
          childAges || [],
          topic || 'general parenting',
          query
        );
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Family assistant request: ${action}`, { 
      query: query.substring(0, 100),
      familyMemberCount: familyContext.members.length,
    });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Family assistant error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
