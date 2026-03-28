import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Auth gate
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  {
    const _sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await _sb.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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
            content: `You are a news curator that provides REAL, SPECIFIC news from the last 24 hours. You must provide actual current events that happened recently, NOT generic topic summaries.

Focus on topics: ${topicsString}.${locationContext}

CRITICAL REQUIREMENTS:
1. Each news item must be a SPECIFIC real event/announcement (e.g., "OpenAI announces GPT-5 release date" NOT "AI continues to evolve")
2. Include company names, product names, or specific details
3. The searchQuery must be VERY SPECIFIC - include proper nouns, dates, or unique identifiers
4. Each searchQuery should be 3-8 words that would find the EXACT news article

Format your response as a JSON array with objects containing:
- "headline": Specific headline with names/dates (max 100 chars)
- "summary": 1-2 sentences with specific details
- "category": The topic category
- "searchQuery": Highly specific search terms (e.g., "OpenAI GPT-5 December 2024" NOT "AI news")

GOOD searchQuery examples:
- "Apple Vision Pro sales January 2025"
- "SpaceX Starship test flight December"
- "Microsoft Copilot new features update"
- "Tesla FSD v13 release"

BAD searchQuery examples:
- "AI news" (too vague)
- "tech updates" (too generic)
- "new tools" (not specific)

Only return the JSON array, no other text.`
          },
          {
            role: 'user',
            content: `What are the most important SPECIFIC news events and announcements in ${topicsString} from the last 24-48 hours?${locationContext} Today's date is ${new Date().toISOString().split('T')[0]}. Give me real headlines with company/product names.`
          }
        ],
        temperature: 0.5,
        max_tokens: 700,
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
