import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    console.error('Token refresh failed:', await response.text());
    return null;
  }

  return response.json();
}

async function categorizeWithAI(emails: { subject: string; from_name: string; from_email: string; snippet: string }[]): Promise<Record<string, { category: string; priority_boost: number }>> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY || emails.length === 0) return {};

  const emailSummaries = emails.map((e, i) => `${i}: From "${e.from_name}" <${e.from_email}> | Subject: "${e.subject}" | Preview: "${e.snippet?.slice(0, 80)}"`).join('\n');

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: 'You categorize emails. For each email index, return a category and priority_boost. Categories: action_required, waiting, fyi, newsletter, promotion, other. Priority_boost: 0 (normal), 1 (slightly important), 2 (important).'
          },
          { role: 'user', content: `Categorize these emails:\n${emailSummaries}` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'categorize_emails',
            description: 'Categorize a batch of emails',
            parameters: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      index: { type: 'number' },
                      category: { type: 'string', enum: ['action_required', 'waiting', 'fyi', 'newsletter', 'promotion', 'other'] },
                      priority_boost: { type: 'number', enum: [0, 1, 2] }
                    },
                    required: ['index', 'category', 'priority_boost'],
                    additionalProperties: false
                  }
                }
              },
              required: ['results'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'categorize_emails' } },
      }),
    });

    if (!response.ok) {
      console.error('AI categorization failed:', response.status);
      return {};
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return {};

    const parsed = JSON.parse(toolCall.function.arguments);
    const map: Record<string, { category: string; priority_boost: number }> = {};
    for (const r of parsed.results) {
      map[String(r.index)] = { category: r.category, priority_boost: r.priority_boost };
    }
    return map;
  } catch (e) {
    console.error('AI categorization error:', e);
    return {};
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    // Use service role to access tokens (stored in external_calendar_connections)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find Google connection with Gmail scopes (we reuse calendar connection tokens)
    const { data: connections } = await adminClient
      .from('external_calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .limit(1);

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ error: 'no_gmail_connection', message: 'No Google account connected. Please connect your Google account first.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const connection = connections[0];
    let accessToken = connection.access_token;

    // Check if token is expired and refresh
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      if (!connection.refresh_token) {
        return new Response(JSON.stringify({ error: 'token_expired', message: 'Token expired and no refresh token available. Please reconnect.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const refreshed = await refreshAccessToken(connection.refresh_token);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: 'refresh_failed', message: 'Failed to refresh token. Please reconnect.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await adminClient
        .from('external_calendar_connections')
        .update({ access_token: accessToken, token_expires_at: newExpiry })
        .eq('id', connection.id);
    }

    // Fetch recent emails from Gmail API
    const { maxResults } = await req.json().catch(() => ({ maxResults: 30 }));

    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults || 30}&labelIds=INBOX`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listResponse.ok) {
      const errText = await listResponse.text();
      console.error('Gmail list failed:', listResponse.status, errText);
      
      if (listResponse.status === 403) {
        return new Response(JSON.stringify({ 
          error: 'gmail_scope_missing', 
          message: 'Gmail access not authorized. Please reconnect your Google account with Gmail permissions.' 
        }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'gmail_fetch_failed', message: 'Failed to fetch emails' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const listData = await listResponse.json();
    const messageIds = listData.messages || [];

    if (messageIds.length === 0) {
      return new Response(JSON.stringify({ synced: 0, emails: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch full message details in parallel (batch of 10)
    const batchSize = 10;
    const allMessages: any[] = [];

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (msg: { id: string }) => {
          const resp = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!resp.ok) return null;
          return resp.json();
        })
      );
      allMessages.push(...batchResults.filter(Boolean));
    }

    // Get user's contacts for matching
    const { data: contacts } = await adminClient
      .from('user_contacts')
      .select('id, name, email, tier')
      .eq('user_id', userId);

    const contactsByEmail = new Map<string, { id: string; name: string; tier: string }>();
    const contactDomains = new Map<string, { id: string; name: string; tier: string }>();
    
    if (contacts) {
      for (const c of contacts) {
        if (c.email) {
          contactsByEmail.set(c.email.toLowerCase(), { id: c.id, name: c.name, tier: c.tier || 'acquaintance' });
          const domain = c.email.split('@')[1];
          if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
            contactDomains.set(domain, { id: c.id, name: c.name, tier: c.tier || 'acquaintance' });
          }
        }
      }
    }

    // Get existing sender rules
    const { data: senderRules } = await adminClient
      .from('email_sender_rules')
      .select('*')
      .eq('user_id', userId);

    const rulesMap = new Map<string, { default_category: string; default_priority: number; auto_archive: boolean }>();
    if (senderRules) {
      for (const rule of senderRules) {
        rulesMap.set(rule.sender_pattern, {
          default_category: rule.default_category || 'other',
          default_priority: rule.default_priority || 3,
          auto_archive: rule.auto_archive || false,
        });
      }
    }

    // Parse messages and prepare for AI categorization
    const parsedEmails: any[] = [];

    for (const msg of allMessages) {
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const fromRaw = getHeader('From');
      const fromMatch = fromRaw.match(/^(?:"?(.+?)"?\s*)?<?([^>]+@[^>]+)>?$/);
      const fromName = fromMatch?.[1]?.trim() || fromRaw;
      const fromEmail = (fromMatch?.[2] || fromRaw).toLowerCase().trim();
      const toEmail = getHeader('To');
      const subject = getHeader('Subject');
      const dateStr = getHeader('Date');

      // Contact matching
      const directContact = contactsByEmail.get(fromEmail);
      const domain = fromEmail.split('@')[1];
      const domainContact = domain ? contactDomains.get(domain) : null;
      const matchedContact = directContact || domainContact;

      // Priority based on contact tier
      let priorityScore = 5; // default low
      if (matchedContact) {
        const tierPriority: Record<string, number> = {
          family: 1, close_friend: 1, friend: 2, business: 3, acquaintance: 4,
        };
        priorityScore = tierPriority[matchedContact.tier] || 3;
      }

      // Check sender rules
      const exactRule = rulesMap.get(fromEmail);
      const domainRule = domain ? rulesMap.get(`*@${domain}`) : null;
      const appliedRule = exactRule || domainRule;

      if (appliedRule) {
        if (appliedRule.default_priority) priorityScore = Math.min(priorityScore, appliedRule.default_priority);
      }

      parsedEmails.push({
        gmail_message_id: msg.id,
        thread_id: msg.threadId,
        from_email: fromEmail,
        from_name: fromName,
        to_email: toEmail,
        subject,
        snippet: msg.snippet || '',
        received_at: dateStr ? new Date(dateStr).toISOString() : new Date(parseInt(msg.internalDate)).toISOString(),
        is_read: !msg.labelIds?.includes('UNREAD'),
        is_starred: msg.labelIds?.includes('STARRED') || false,
        gmail_labels: msg.labelIds || [],
        matched_contact_id: matchedContact?.id || null,
        priority_score: priorityScore,
        category: appliedRule?.default_category || 'other',
        user_archived: appliedRule?.auto_archive || false,
      });
    }

    // AI categorization for uncategorized emails
    const needsCategorization = parsedEmails
      .filter((e, i) => e.category === 'other' && !e.user_archived)
      .slice(0, 20); // Limit AI calls

    if (needsCategorization.length > 0) {
      const aiResults = await categorizeWithAI(needsCategorization);
      
      // Map AI results back by finding their original index
      const uncatIndexMap = new Map<number, number>();
      let uncatIdx = 0;
      parsedEmails.forEach((e, i) => {
        if (e.category === 'other' && !e.user_archived && uncatIdx < 20) {
          uncatIndexMap.set(uncatIdx, i);
          uncatIdx++;
        }
      });

      for (const [aiIdx, result] of Object.entries(aiResults)) {
        const originalIdx = uncatIndexMap.get(parseInt(aiIdx));
        if (originalIdx !== undefined) {
          parsedEmails[originalIdx].category = result.category;
          parsedEmails[originalIdx].priority_score = Math.max(1, parsedEmails[originalIdx].priority_score - result.priority_boost);
        }
      }
    }

    // Upsert emails into database
    const emailsToUpsert = parsedEmails.map(e => ({
      user_id: userId,
      ...e,
    }));

    const { error: upsertError } = await adminClient
      .from('user_emails')
      .upsert(emailsToUpsert, { onConflict: 'user_id,gmail_message_id', ignoreDuplicates: false });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return new Response(JSON.stringify({ error: 'db_error', message: 'Failed to save emails' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create notifications for high-priority new emails (P1-P2)
    const highPriority = parsedEmails.filter(e => e.priority_score <= 2 && !e.is_read);
    for (const email of highPriority.slice(0, 5)) {
      await adminClient.from('user_notifications').insert({
        user_id: userId,
        type: 'email',
        title: `Priority Email from ${email.from_name}`,
        message: email.subject || '(No subject)',
        data: { email_id: email.gmail_message_id, from: email.from_email },
        read: false,
      }).then(() => {}).catch(() => {});
    }

    return new Response(JSON.stringify({ synced: parsedEmails.length, highPriority: highPriority.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Gmail sync error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
