import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { interests, skills, businesses } = await req.json();
    
    // Build a personalized query based on user's profile
    const topicsToSearch = [
      ...(interests || []),
      ...(skills || []),
      ...(businesses || []),
    ].slice(0, 5); // Limit to 5 topics

    if (topicsToSearch.length === 0) {
      topicsToSearch.push('technology', 'business', 'productivity');
    }

    const topicsString = topicsToSearch.join(', ');
    
    console.log('Generating news for topics:', topicsString);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful news curator. Provide a brief summary of 3-4 relevant news items or trends from the last 24 hours. Focus on topics that would be interesting to someone interested in: ${topicsString}. 
            
            Format your response as a JSON array with objects containing:
            - "headline": A brief headline (max 80 chars)
            - "summary": A 1-2 sentence summary
            - "category": The topic category
            - "url": A real URL to a reputable news source where the user can read more about this topic (e.g., Reuters, BBC, TechCrunch, Bloomberg, etc.)
            
            Only return the JSON array, no other text.`
          },
          {
            role: 'user',
            content: `What are the most important news and trends in ${topicsString} from the last 24 hours? Today's date is ${new Date().toISOString().split('T')[0]}.`
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI error:', errorData);
      throw new Error('Failed to fetch news from AI');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let newsItems;
    try {
      // Clean up the response in case it has markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      newsItems = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', content);
      newsItems = [
        {
          headline: 'Unable to fetch personalized news',
          summary: 'Check back later for updates on your interests.',
          category: 'General'
        }
      ];
    }

    return new Response(JSON.stringify({ news: newsItems }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in morning-briefing function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      news: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
