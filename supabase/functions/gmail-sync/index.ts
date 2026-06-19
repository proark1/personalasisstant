import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";
import { decryptTokenIfNeeded, encryptTokenIfConfigured } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
};

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    console.error("Token refresh failed:", await response.text());
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
  contactContext: string,
  userName?: string,
): Promise<Record<string, EmailAnalysis>> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY || emails.length === 0) return {};

  const emailSummaries = emails
    .map(
      (e, i) =>
        `${i}: From "${e.from_name}" <${e.from_email}> | Subject: "${e.subject}" | Preview: "${e.snippet?.slice(0, 120)}"`,
    )
    .join("\n");

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model: "gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `You are an email intelligence assistant for ${userName || "the user"}.

Your job is to analyze each email and return structured data. For each email:

1. **Category**: action_required, waiting, fyi, newsletter, promotion, spam, phishing, other
2. **Priority boost**: 0 (normal), 1 (slightly important), 2 (important) — boost emails from known contacts, business partners, or related to his companies
3. **Summary**: One concise sentence summarizing what this email needs or is about
4. **Suggested action**: One of: "Reply needed", "Review", "Just FYI", "Can ignore", "Review attachment", "Urgent action", "Unsubscribe"
5. **Spam detection**: Flag bulk unsolicited emails, suspicious offers, unknown mass senders
6. **Phishing detection**: Flag emails with spoofed domains, urgency manipulation ("account suspended", "verify now"), suspicious links, requests for credentials or money
7. **Threat reason**: If spam or phishing, explain why in one sentence. Empty string if clean.
8. **Sentiment**: positive, neutral, urgent, warning

${contactContext}`,
            },
            { role: "user", content: `Analyze these emails:\n${emailSummaries}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "analyze_emails",
                description:
                  "Analyze a batch of emails for categorization, safety, and suggested actions",
                parameters: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          index: { type: "number" },
                          category: {
                            type: "string",
                            enum: [
                              "action_required",
                              "waiting",
                              "fyi",
                              "newsletter",
                              "promotion",
                              "spam",
                              "phishing",
                              "other",
                            ],
                          },
                          priority_boost: { type: "number", enum: [0, 1, 2] },
                          summary: { type: "string" },
                          suggested_action: {
                            type: "string",
                            enum: [
                              "Reply needed",
                              "Review",
                              "Just FYI",
                              "Can ignore",
                              "Review attachment",
                              "Urgent action",
                              "Unsubscribe",
                            ],
                          },
                          is_spam: { type: "boolean" },
                          is_phishing: { type: "boolean" },
                          threat_reason: { type: "string" },
                          sentiment: {
                            type: "string",
                            enum: ["positive", "neutral", "urgent", "warning"],
                          },
                        },
                        required: [
                          "index",
                          "category",
                          "priority_boost",
                          "summary",
                          "suggested_action",
                          "is_spam",
                          "is_phishing",
                          "threat_reason",
                          "sentiment",
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["results"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "analyze_emails" } },
        }),
      },
    );

    if (!response.ok) {
      console.error("AI analysis failed:", response.status);
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
    console.error("AI analysis error:", e);
    return {};
  }
}

// Fetch the latest historyId from Gmail profile
async function getGmailHistoryId(accessToken: string): Promise<string | null> {
  try {
    const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.historyId || null;
  } catch {
    return null;
  }
}

// Fetch new message IDs via History API
async function getNewMessageIds(
  accessToken: string,
  startHistoryId: string,
): Promise<{ messageIds: string[]; expired: boolean }> {
  try {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded&labelId=INBOX&maxResults=100`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (resp.status === 404) {
      console.log("History expired, falling back to full sync");
      return { messageIds: [], expired: true };
    }

    if (!resp.ok) {
      console.error("History API error:", resp.status, await resp.text());
      return { messageIds: [], expired: true };
    }

    const data = await resp.json();
    const history = data.history || [];
    const ids = new Set<string>();

    for (const record of history) {
      const added = record.messagesAdded || [];
      for (const item of added) {
        if (item.message?.id && item.message?.labelIds?.includes("INBOX")) {
          ids.add(item.message.id);
        }
      }
    }

    return { messageIds: Array.from(ids), expired: false };
  } catch (e) {
    console.error("History API fetch error:", e);
    return { messageIds: [], expired: true };
  }
}

interface GmailConnection {
  id: string;
  access_token: string;
  token_expires_at?: string;
  refresh_token?: string;
  gmail_history_id?: string;
}
interface ParsedEmail {
  [k: string]: unknown;
}

async function processEmails(
  messageIds: { id: string }[],
  accessToken: string,
  adminClient: SupabaseClient,
  userId: string,
  _connection: GmailConnection,
  userName?: string,
): Promise<{ parsedEmails: ParsedEmail[]; highPriorityCount: number; hadUpsertFailure: boolean }> {
  if (messageIds.length === 0) {
    return { parsedEmails: [], highPriorityCount: 0, hadUpsertFailure: false };
  }

  // Fetch message details in parallel batches
  const batchSize = 10;
  const allMessages: Record<string, unknown>[] = [];
  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (msg) => {
        const resp = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!resp.ok) return null;
        return resp.json();
      }),
    );
    allMessages.push(...batchResults.filter(Boolean));
  }

  // Get contacts for matching + AI context
  const { data: contacts } = await adminClient
    .from("user_contacts")
    .select("id, name, email, tier")
    .eq("user_id", userId);

  const contactsByEmail = new Map<string, { id: string; name: string; tier: string }>();
  const contactDomains = new Map<string, { id: string; name: string; tier: string }>();
  const contactContextLines: string[] = [];

  if (contacts) {
    for (const c of contacts) {
      if (c.email) {
        contactsByEmail.set(c.email.toLowerCase(), {
          id: c.id,
          name: c.name,
          tier: c.tier || "acquaintance",
        });
        const domain = c.email.split("@")[1];
        if (
          domain &&
          !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"].includes(domain)
        ) {
          contactDomains.set(domain, { id: c.id, name: c.name, tier: c.tier || "acquaintance" });
        }
      }
      if (contactContextLines.length < 30) {
        contactContextLines.push(
          `- ${c.name} (${c.tier || "acquaintance"}): ${c.email || "no email"}`,
        );
      }
    }
  }

  const contactContext =
    contactContextLines.length > 0
      ? `Known contacts (prioritize emails from these people):\n${contactContextLines.join("\n")}`
      : "";

  // Get sender rules
  const { data: senderRules } = await adminClient
    .from("email_sender_rules")
    .select("*")
    .eq("user_id", userId);

  const rulesMap = new Map<
    string,
    { default_category: string; default_priority: number; auto_archive: boolean }
  >();
  if (senderRules) {
    for (const rule of senderRules) {
      rulesMap.set(rule.sender_pattern, {
        default_category: rule.default_category || "other",
        default_priority: rule.default_priority || 3,
        auto_archive: rule.auto_archive || false,
      });
    }
  }

  // Parse messages
  const parsedEmails: ParsedEmail[] = [];
  for (const msg of allMessages) {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find(
        (h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase(),
      )?.value || "";

    const fromRaw = getHeader("From");
    let fromName = "";
    let fromEmail = "";
    const angleMatch = fromRaw.match(/^(.*?)\s*<([^>]+)>$/);
    if (angleMatch) {
      fromName = angleMatch[1].replace(/^"|"$/g, "").trim();
      fromEmail = angleMatch[2].toLowerCase().trim();
    } else {
      fromEmail = fromRaw.toLowerCase().trim();
      fromName = "";
    }
    const toEmail = getHeader("To");
    const subject = getHeader("Subject");
    const dateStr = getHeader("Date");

    const directContact = contactsByEmail.get(fromEmail);
    const domain = fromEmail.split("@")[1];
    const domainContact = domain ? contactDomains.get(domain) : null;
    const matchedContact = directContact || domainContact;

    let priorityScore = 5;
    if (matchedContact) {
      const tierPriority: Record<string, number> = {
        family: 1,
        close_friend: 1,
        friend: 2,
        business: 3,
        acquaintance: 4,
      };
      priorityScore = tierPriority[matchedContact.tier] || 3;
    }

    const exactRule = rulesMap.get(fromEmail);
    const domainRule = domain ? rulesMap.get(`*@${domain}`) : null;
    const appliedRule = exactRule || domainRule;
    if (appliedRule?.default_priority)
      priorityScore = Math.min(priorityScore, appliedRule.default_priority);

    parsedEmails.push({
      gmail_message_id: msg.id,
      thread_id: msg.threadId,
      from_email: fromEmail,
      from_name: fromName,
      to_email: toEmail,
      subject,
      snippet: msg.snippet || "",
      received_at: dateStr
        ? new Date(dateStr).toISOString()
        : new Date(parseInt(msg.internalDate)).toISOString(),
      is_read: !msg.labelIds?.includes("UNREAD"),
      is_starred: msg.labelIds?.includes("STARRED") || false,
      gmail_labels: msg.labelIds || [],
      matched_contact_id: matchedContact?.id || null,
      priority_score: priorityScore,
      category: appliedRule?.default_category || "other",
      user_archived: appliedRule?.auto_archive || false,
      ai_summary: null,
      ai_suggested_action: null,
      is_spam: false,
      is_phishing: false,
      threat_reason: null,
      sentiment: "neutral",
    });
  }

  // AI analysis (limit to 20)
  const needsAnalysis = parsedEmails.filter((e) => !e.user_archived).slice(0, 20);

  if (needsAnalysis.length > 0) {
    const aiResults = await analyzeWithAI(needsAnalysis, contactContext, userName);

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
        e.category =
          result.category === "spam" || result.category === "phishing"
            ? e.category
            : result.category;
        e.priority_score = Math.max(1, e.priority_score - result.priority_boost);
        e.ai_summary = result.summary;
        e.ai_suggested_action = result.suggested_action;
        e.is_spam = result.is_spam;
        e.is_phishing = result.is_phishing;
        e.threat_reason = result.threat_reason || null;
        e.sentiment = result.sentiment;
        if (result.is_spam) e.category = "spam";
        if (result.is_phishing) e.category = "phishing";
      }
    }
  }

  // Upsert emails
  const emailsToUpsert = parsedEmails.map((e) => ({ user_id: userId, ...e }));

  let hadUpsertFailure = false;
  const { error: upsertError } = await adminClient
    .from("user_emails")
    .upsert(emailsToUpsert, { onConflict: "user_id,gmail_message_id", ignoreDuplicates: false });

  if (upsertError) {
    console.error("Upsert error:", upsertError);
    hadUpsertFailure = true;
  }

  // Notifications for high-priority new emails
  const highPriority = parsedEmails.filter((e) => e.priority_score <= 2 && !e.is_read);
  for (const email of highPriority.slice(0, 5)) {
    await adminClient
      .from("user_notifications")
      .insert({
        user_id: userId,
        type: "email",
        title: `Priority Email from ${email.from_name}`,
        message: email.ai_summary || email.subject || "(No subject)",
        data: { email_id: email.gmail_message_id, from: email.from_email },
        read: false,
      })
      .then(() => {})
      .catch(() => {});
  }

  return { parsedEmails, highPriorityCount: highPriority.length, hadUpsertFailure };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    const internalUserId = req.headers.get("x-internal-user-id");
    let userId: string;

    // Internal/cron mode: service role + x-internal-user-id header
    if (token === serviceRoleKey && internalUserId) {
      userId = internalUserId;
    } else {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub;
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get user's display name for AI prompts
    const { data: profile } = await adminClient
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();
    const userName = profile?.display_name || undefined;

    // Find Google connection
    const { data: connections } = await adminClient
      .from("external_calendar_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "google")
      .limit(1);

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ error: "no_gmail_connection", message: "No Google account connected." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const connection = connections[0];
    // Tokens are encrypted at rest (when BANK_TOKEN_SECRET is set); decrypt for
    // use. Legacy plaintext rows pass through unchanged.
    connection.access_token =
      (await decryptTokenIfNeeded(connection.access_token)) ?? connection.access_token;
    connection.refresh_token =
      (await decryptTokenIfNeeded(connection.refresh_token)) ?? connection.refresh_token;
    let accessToken = connection.access_token;

    // Token refresh
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      if (!connection.refresh_token) {
        return new Response(
          JSON.stringify({ error: "token_expired", message: "Token expired. Please reconnect." }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const refreshed = await refreshAccessToken(connection.refresh_token);
      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: "refresh_failed", message: "Failed to refresh token." }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      accessToken = refreshed.access_token;
      await adminClient
        .from("external_calendar_connections")
        .update({
          access_token: await encryptTokenIfConfigured(accessToken),
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", connection.id);
    }

    const { maxResults } = await req.json().catch(() => ({ maxResults: 30 }));
    const storedHistoryId = connection.gmail_history_id;

    let syncResult: {
      parsedEmails: ParsedEmail[];
      highPriorityCount: number;
      hadUpsertFailure: boolean;
    };
    let syncType: "incremental" | "full";

    if (storedHistoryId) {
      // === INCREMENTAL SYNC via History API ===
      console.log(`Incremental sync from historyId: ${storedHistoryId}`);
      const { messageIds: newIds, expired } = await getNewMessageIds(accessToken, storedHistoryId);

      if (expired) {
        // Fallback to full sync
        console.log("History expired, doing full sync");
        syncType = "full";
        const listResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults || 30}&labelIds=INBOX`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(15_000),
          },
        );

        if (!listResponse.ok) {
          const errText = await listResponse.text();
          console.error("Gmail list failed:", listResponse.status, errText);
          if (listResponse.status === 403) {
            return new Response(
              JSON.stringify({
                error: "gmail_scope_missing",
                message: "Gmail access not authorized.",
              }),
              {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
          return new Response(
            JSON.stringify({ error: "gmail_fetch_failed", message: "Failed to fetch emails" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const listData = await listResponse.json();
        const messageIds = (listData.messages || []).map((m: { id: string }) => ({ id: m.id }));
        syncResult = await processEmails(
          messageIds,
          accessToken,
          adminClient,
          userId,
          connection,
          userName,
        );
      } else if (newIds.length === 0) {
        // No new emails — fast return
        console.log("No new emails since last sync");

        // Still update historyId in case it advanced
        const latestHistoryId = await getGmailHistoryId(accessToken);
        if (latestHistoryId) {
          await adminClient
            .from("external_calendar_connections")
            .update({ gmail_history_id: latestHistoryId, last_synced_at: new Date().toISOString() })
            .eq("id", connection.id);
        }

        return new Response(
          JSON.stringify({ synced: 0, newEmails: 0, highPriority: 0, syncType: "incremental" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } else {
        // Process only new emails
        console.log(`Found ${newIds.length} new emails via History API`);
        syncType = "incremental";
        const messageIdsToFetch = newIds.map((id) => ({ id }));
        syncResult = await processEmails(
          messageIdsToFetch,
          accessToken,
          adminClient,
          userId,
          connection,
          userName,
        );
      }
    } else {
      // === FIRST SYNC — full fetch ===
      console.log("First sync: no historyId, doing full sync");
      syncType = "full";

      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults || 30}&labelIds=INBOX`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!listResponse.ok) {
        const errText = await listResponse.text();
        console.error("Gmail list failed:", listResponse.status, errText);
        if (listResponse.status === 403) {
          return new Response(
            JSON.stringify({
              error: "gmail_scope_missing",
              message: "Gmail access not authorized.",
            }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        return new Response(
          JSON.stringify({ error: "gmail_fetch_failed", message: "Failed to fetch emails" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const listData = await listResponse.json();
      const messageIds = (listData.messages || []).map((m: { id: string }) => ({ id: m.id }));

      if (messageIds.length === 0) {
        return new Response(JSON.stringify({ synced: 0, emails: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      syncResult = await processEmails(
        messageIds,
        accessToken,
        adminClient,
        userId,
        connection,
        userName,
      );
    }

    // Save latest historyId for next incremental sync.
    // If any upsert failed, do NOT advance the historyId — leave it pointing at
    // the previous window so the next incremental sync retries the same emails
    // (the upsert is idempotent on user_id,gmail_message_id, so retries are safe).
    if (syncResult.hadUpsertFailure) {
      console.error(
        "Skipping gmail_history_id advance: an email upsert failed this run; next sync will retry the same window.",
      );
    } else {
      const latestHistoryId = await getGmailHistoryId(accessToken);
      if (latestHistoryId) {
        await adminClient
          .from("external_calendar_connections")
          .update({ gmail_history_id: latestHistoryId, last_synced_at: new Date().toISOString() })
          .eq("id", connection.id);
      }
    }

    // Fire-and-forget: trigger email classification on newly synced emails
    if (syncResult.parsedEmails.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        fetch(`${supabaseUrl}/functions/v1/email-classifier`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            user_id: userId,
            limit: Math.min(syncResult.parsedEmails.length, 25),
          }),
        }).catch((e) => console.error("classifier trigger failed", e));
      }
    }

    return new Response(
      JSON.stringify({
        synced: syncResult.parsedEmails.length,
        newEmails: syncResult.parsedEmails.length,
        highPriority: syncResult.highPriorityCount,
        syncType,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Gmail sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
