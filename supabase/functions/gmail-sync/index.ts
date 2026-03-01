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

interface EmailAnalysis {
  index: number;
  category: string;
  priority_boost: number;
  summary: string;
  suggested_action: string;
  is_spam: boolean;
  is_phishing: boolean;
  threat_reason: string;
  sentiment: string;
}

async function analyzeWithAI(
  emails: { subject: string; from_name: string; from_email: string; snippet: string }[],
  contactContext: string
): Promise<Record<string, EmailAnalysis>> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY || emails.length === 0) return {};

  const emailSummaries = emails.map((e, i) =>
    `${i}: From "${e.from_name}" <${e.from_email}> | Subject: "${e.subject}" | Preview: "${e.snippet?.slice(0, 120)}"`
  ).join('\n');

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
            content: `You are an email intelligence assistant for Asad Dar. He is co-founder of Medieval Empires (strategy game), OYA Play (AI game publisher), and Eleven Labs (Web3 growth agency). He is based in Germany and frequently travels to Dubai.

Your job is to analyze each email and return structured data. For each email:

1. **Category**: action_required, waiting, fyi, newsletter, promotion, spam, phishing, other
2. **Priority boost**: 0 (normal), 1 (slightly important), 2 (important) — boost emails from known contacts, business partners, or related to his companies
3. **Summary**: One concise sentence summarizing what this email needs or is about
4. **Suggested action**: One of: "Reply needed", "Review", "Just FYI", "Can ignore", "Review attachment", "Urgent action", "Unsubscribe"
5. **Spam detection**: Flag bulk unsolicited emails, suspicious offers, unknown mass senders
6. **Phishing detection**: Flag emails with spoofed domains, urgency manipulation ("account suspended", "verify now"), suspicious links, requests for credentials or money
7. **Threat reason**: If spam or phishing, explain why in one sentence. Empty string if clean.
8. **Sentiment**: positive, neutral, urgent, warning

${contactContext}`
          },
          { role: 'user', content: `Analyze these emails:\n${emailSummaries}` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'analyze_emails',
            description: 'Analyze a batch of emails for categorization, safety, and suggested actions',
            parameters: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      index: { type: 'number' },
                      category: { type: 'string', enum: ['action_required', 'waiting', 'fyi', 'newsletter', 'promotion', 'spam', 'phishing', 'other'] },
                      priority_boost: { type: 'number', enum: [0, 1, 2] },
                      summary: { type: 'string' },
                      suggested_action: { type: 'string', enum: ['Reply needed', 'Review', 'Just FYI', 'Can ignore', 'Review attachment', 'Urgent action', 'Unsubscribe'] },
                      is_spam: { type: 'boolean' },
                      is_phishing: { type: 'boolean' },
                      threat_reason: { type: 'string' },
                      sentiment: { type: 'string', enum: ['positive', 'neutral', 'urgent', 'warning'] }
                    },
                    required: ['index', 'category', 'priority_boost', 'summary', 'suggested_action', 'is_spam', 'is_phishing', 'threat_reason', 'sentiment'],
                    additionalProperties: false
                  }
                }
              },
              required: ['results'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'analyze_emails' } },
      }),
    });

    if (!response.ok) {
      console.error('AI analysis failed:', response.status);
      return {};
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return {};

    const parsed = JSON.parse(toolCall.function.arguments);
    const map: Record<string, EmailAnalysis> = {};
    for (const r of parsed.results) {
      map[String(r.index)] = r;
    }
    return map;
  } catch (e) {
    console.error('AI analysis error:', e);
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find Google connection
    const { data: connections } = await adminClient
      .from('external_calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .limit(1);

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ error: 'no_gmail_connection', message: 'No Google account connected.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const connection = connections[0];
    let accessToken = connection.access_token;

    // Token refresh
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      if (!connection.refresh_token) {
        return new Response(JSON.stringify({ error: 'token_expired', message: 'Token expired. Please reconnect.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const refreshed = await refreshAccessToken(connection.refresh_token);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: 'refresh_failed', message: 'Failed to refresh token.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      accessToken = refreshed.access_token;
      await adminClient
        .from('external_calendar_connections')
        .update({ access_token: accessToken, token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString() })
        .eq('id', connection.id);
    }

    // Fetch emails from Gmail
    const { maxResults } = await req.json().catch(() => ({ maxResults: 30 }));

    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults || 30}&labelIds=INBOX`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listResponse.ok) {
      const errText = await listResponse.text();
      console.error('Gmail list failed:', listResponse.status, errText);
      if (listResponse.status === 403) {
        return new Response(JSON.stringify({ error: 'gmail_scope_missing', message: 'Gmail access not authorized.' }), {
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

    // Fetch message details in parallel batches
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

    // Get contacts for matching + AI context
    const { data: contacts } = await adminClient
      .from('user_contacts')
      .select('id, name, email, tier')
      .eq('user_id', userId);

    const contactsByEmail = new Map<string, { id: string; name: string; tier: string }>();
    const contactDomains = new Map<string, { id: string; name: string; tier: string }>();
    const contactContextLines: string[] = [];

    if (contacts) {
      for (const c of contacts) {
        if (c.email) {
          contactsByEmail.set(c.email.toLowerCase(), { id: c.id, name: c.name, tier: c.tier || 'acquaintance' });
          const domain = c.email.split('@')[1];
          if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
            contactDomains.set(domain, { id: c.id, name: c.name, tier: c.tier || 'acquaintance' });
          }
        }
        // Build context for AI (limit to top contacts)
        if (contactContextLines.length < 30) {
          contactContextLines.push(`- ${c.name} (${c.tier || 'acquaintance'}): ${c.email || 'no email'}`);
        }
      }
    }

    const contactContext = contactContextLines.length > 0
      ? `Known contacts (prioritize emails from these people):\n${contactContextLines.join('\n')}`
      : '';

    // Get sender rules
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

    // Parse messages
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

      const directContact = contactsByEmail.get(fromEmail);
      const domain = fromEmail.split('@')[1];
      const domainContact = domain ? contactDomains.get(domain) : null;
      const matchedContact = directContact || domainContact;

      let priorityScore = 5;
      if (matchedContact) {
        const tierPriority: Record<string, number> = { family: 1, close_friend: 1, friend: 2, business: 3, acquaintance: 4 };
        priorityScore = tierPriority[matchedContact.tier] || 3;
      }

      const exactRule = rulesMap.get(fromEmail);
      const domainRule = domain ? rulesMap.get(`*@${domain}`) : null;
      const appliedRule = exactRule || domainRule;
      if (appliedRule?.default_priority) priorityScore = Math.min(priorityScore, appliedRule.default_priority);

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
        ai_summary: null,
        ai_suggested_action: null,
        is_spam: false,
        is_phishing: false,
        threat_reason: null,
        sentiment: 'neutral',
      });
    }

    // AI analysis for emails that need it (limit to 20 for cost efficiency)
    const needsAnalysis = parsedEmails
      .filter((e) => !e.user_archived)
      .slice(0, 20);

    if (needsAnalysis.length > 0) {
      const aiResults = await analyzeWithAI(needsAnalysis, contactContext);

      // Map AI results back
      const analysisIndexMap = new Map<number, number>();
      let aiIdx = 0;
      parsedEmails.forEach((e, i) => {
        if (!e.user_archived && aiIdx < 20) {
          analysisIndexMap.set(aiIdx, i);
          aiIdx++;
        }
      });

      for (const [aiIdxStr, result] of Object.entries(aiResults)) {
        const originalIdx = analysisIndexMap.get(parseInt(aiIdxStr));
        if (originalIdx !== undefined) {
          const e = parsedEmails[originalIdx];
          e.category = result.category === 'spam' || result.category === 'phishing' ? e.category : result.category;
          e.priority_score = Math.max(1, e.priority_score - result.priority_boost);
          e.ai_summary = result.summary;
          e.ai_suggested_action = result.suggested_action;
          e.is_spam = result.is_spam;
          e.is_phishing = result.is_phishing;
          e.threat_reason = result.threat_reason || null;
          e.sentiment = result.sentiment;
          if (result.is_spam) e.category = 'spam';
          if (result.is_phishing) e.category = 'phishing';
        }
      }
    }

    // Upsert emails
    const emailsToUpsert = parsedEmails.map(e => ({ user_id: userId, ...e }));

    const { error: upsertError } = await adminClient
      .from('user_emails')
      .upsert(emailsToUpsert, { onConflict: 'user_id,gmail_message_id', ignoreDuplicates: false });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return new Response(JSON.stringify({ error: 'db_error', message: 'Failed to save emails' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Notifications for high-priority new emails
    const highPriority = parsedEmails.filter(e => e.priority_score <= 2 && !e.is_read);
    for (const email of highPriority.slice(0, 5)) {
      await adminClient.from('user_notifications').insert({
        user_id: userId,
        type: 'email',
        title: `Priority Email from ${email.from_name}`,
        message: email.ai_summary || email.subject || '(No subject)',
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
