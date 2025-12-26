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
    const { interests, skills, businesses, location } = await req.json();
    
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
    
    // Build location context
    let locationContext = '';
    if (location?.city && location?.country) {
      locationContext = ` The user is located in ${location.city}, ${location.country}.`;
    } else if (location?.country) {
      locationContext = ` The user is located in ${location.country}.`;
    } else if (location?.latitude && location?.longitude) {
      locationContext = ` The user's coordinates are approximately ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}.`;
    }
    
    console.log('Generating news for topics:', topicsString, 'Location:', locationContext || 'not provided');

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
            content: `You are a helpful news curator. Provide a brief summary of 3-4 relevant news items or trends from the last 24 hours. Focus on topics that would be interesting to someone interested in: ${topicsString}.${locationContext} If location is provided, include at least one local or regional news item relevant to that area.
            
            Format your response as a JSON array with objects containing:
            - "headline": A brief headline (max 80 chars)
            - "summary": A 1-2 sentence summary
            - "category": The topic category
            - "searchQuery": A short search query (2-5 words) that would find articles about this news item
            
            Only return the JSON array, no other text. Do NOT include any URLs.`
          },
          {
            role: 'user',
            content: `What are the most important news and trends in ${topicsString} from the last 24 hours?${locationContext} Today's date is ${new Date().toISOString().split('T')[0]}.`
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
      const parsedItems = JSON.parse(cleanContent);
      
      // Generate Google News search URLs for each item
      newsItems = parsedItems.map((item: { headline: string; summary: string; category: string; searchQuery?: string }) => ({
        headline: item.headline,
        summary: item.summary,
        category: item.category,
        url: `https://news.google.com/search?q=${encodeURIComponent(item.searchQuery || item.headline)}&hl=en`
      }));
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', content);
      newsItems = [
        {
          headline: 'Unable to fetch personalized news',
          summary: 'Check back later for updates on your interests.',
          category: 'General',
          url: 'https://news.google.com'
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
