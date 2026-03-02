import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const db = createClient(supabaseUrl, supabaseServiceKey);
    const userId = user.id;
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch cross-module data in parallel
    const [tasksRes, eventsRes, emailsRes, contractsRes, contactsRes, checkinsRes, habitsRes, habitLogsRes, profileRes] = await Promise.all([
      db.from("tasks").select("id, title, priority, completed, due_date").eq("user_id", userId).eq("completed", false).order("priority", { ascending: true }).limit(10),
      db.from("events").select("id, title, start_time, end_time, location").eq("user_id", userId).gte("start_time", todayStart).lte("start_time", todayEnd).order("start_time"),
      db.from("user_emails").select("id, from_name, subject, priority_score, is_read, category").eq("user_id", userId).eq("is_read", false).eq("user_archived", false).order("priority_score").limit(10),
      db.from("contracts").select("id, name, renewal_date, cancellation_notice_days, auto_renews, cost_amount, cost_frequency").eq("user_id", userId).eq("is_active", true).not("renewal_date", "is", null).lte("renewal_date", sevenDaysFromNow).gte("renewal_date", today),
      db.from("user_contacts").select("id, name, last_contacted_at").eq("user_id", userId).lt("last_contacted_at", thirtyDaysAgo).order("last_contacted_at").limit(5),
      db.from("daily_checkins").select("mood, energy_level, sleep_hours").eq("user_id", userId).eq("checkin_date", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]).limit(1),
      db.from("habits").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true),
      db.from("habit_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("log_date", today),
      db.from("profiles").select("display_name").eq("user_id", userId).single(),
    ]);

    const tasks = tasksRes.data || [];
    const events = eventsRes.data || [];
    const unreadEmails = emailsRes.data || [];
    const contracts = contractsRes.data || [];
    const overdueContacts = contactsRes.data || [];
    const yesterdayCheckin = checkinsRes.data?.[0] || null;
    const totalHabits = habitsRes.count || 0;
    const habitsLogged = habitLogsRes.count || 0;
    const userName = profileRes.data?.display_name || "there";

    const highPriorityTasks = tasks.filter((t: any) => t.priority === "high");
    const priorityEmails = unreadEmails.filter((e: any) => e.priority_score <= 2);

    // Build highlights
    const highlights: any[] = [];
    if (tasks.length > 0) highlights.push({ type: "task", label: `${tasks.length} pending task${tasks.length > 1 ? "s" : ""}${highPriorityTasks.length > 0 ? `, ${highPriorityTasks.length} high priority` : ""}` });
    if (events.length > 0) highlights.push({ type: "calendar", label: `${events.length} event${events.length > 1 ? "s" : ""} today` });
    if (unreadEmails.length > 0) highlights.push({ type: "email", label: `${unreadEmails.length} unread email${unreadEmails.length > 1 ? "s" : ""}${priorityEmails.length > 0 ? `, ${priorityEmails.length} priority` : ""}` });
    if (contracts.length > 0) highlights.push({ type: "contract", label: `${contracts.length} contract${contracts.length > 1 ? "s" : ""} renewing soon` });
    if (overdueContacts.length > 0) highlights.push({ type: "contact", label: `${overdueContacts.length} contact${overdueContacts.length > 1 ? "s" : ""} to follow up` });
    if (totalHabits > 0) highlights.push({ type: "habit", label: `${habitsLogged}/${totalHabits} habits logged` });

    // Build context for AI
    const contextParts: string[] = [];
    contextParts.push(`User name: ${userName}`);
    contextParts.push(`Current time: ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`);
    contextParts.push(`Day: ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`);

    if (tasks.length > 0) {
      const topTasks = tasks.slice(0, 3).map((t: any) => `"${t.title}" (${t.priority} priority${t.due_date ? `, due ${t.due_date}` : ""})`).join(", ");
      contextParts.push(`Pending tasks (${tasks.length} total): ${topTasks}`);
    }
    if (events.length > 0) {
      const eventList = events.map((e: any) => `"${e.title}" at ${new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${e.location ? ` (${e.location})` : ""}`).join(", ");
      contextParts.push(`Today's events: ${eventList}`);
    }
    if (unreadEmails.length > 0) {
      const emailList = priorityEmails.slice(0, 3).map((e: any) => `"${e.subject}" from ${e.from_name || "unknown"}`).join(", ");
      contextParts.push(`Unread emails: ${unreadEmails.length} total. Priority: ${emailList || "none"}`);
    }
    if (contracts.length > 0) {
      const contractList = contracts.map((c: any) => `"${c.name}" renews ${c.renewal_date}${c.cost_amount ? ` (${c.cost_amount}€/${c.cost_frequency})` : ""}`).join(", ");
      contextParts.push(`Contract alerts: ${contractList}`);
    }
    if (overdueContacts.length > 0) {
      const contactList = overdueContacts.map((c: any) => c.name).join(", ");
      contextParts.push(`Contacts to follow up: ${contactList}`);
    }
    if (yesterdayCheckin) {
      contextParts.push(`Yesterday's check-in: mood=${yesterdayCheckin.mood || "unknown"}, energy=${yesterdayCheckin.energy_level || "unknown"}, sleep=${yesterdayCheckin.sleep_hours ? yesterdayCheckin.sleep_hours + "h" : "unknown"}`);
    }
    if (totalHabits > 0) {
      contextParts.push(`Habits: ${habitsLogged} of ${totalHabits} logged today`);
    }

    const prompt = `You are Dori, a warm and proactive AI life assistant. Generate a personalized daily briefing for this user. Be concise (max 4-5 sentences), specific (mention names, times, numbers), and encouraging. Sound natural like a friendly assistant, not robotic.

Context:
${contextParts.join("\n")}

Rules:
- Start with a greeting using their name and reference the time of day
- Mention the most important items first (high-priority tasks, upcoming events)
- If there are contract alerts, mention them as a heads-up
- If contacts are overdue, suggest reaching out
- End with an encouraging note
- Keep it under 150 words
- Don't use bullet points, write as flowing speech`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI briefing generation failed");
    }

    const result = await response.json();
    const briefingText = result.choices?.[0]?.message?.content || "Good morning! Have a great day ahead.";

    return new Response(JSON.stringify({ briefingText, highlights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-voice-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
