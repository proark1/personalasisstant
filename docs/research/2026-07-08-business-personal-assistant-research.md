# Business Personal Assistant Product Research

Date: 2026-07-08

## Executive Summary

The opportunity is real, but the winning product is not a generic chatbot. Business users want something closer to a reliable executive assistant: a trusted operator that watches email, calendar, meetings, tasks, and commitments, then turns chaos into a clear day plan.

The strongest wedge for a OneBrain-connected assistant is:

1. Inbox triage and response drafting.
2. Calendar protection, free-slot finding, buffers, and conflict detection.
3. Morning, mid-day, and end-of-day briefings.
4. Meeting prep and follow-up.
5. A persistent "waiting on / promised / delegated" tracker.
6. Proactive suggestions that are explainable and reversible.
7. A trust ladder that starts read-only, then earns drafting, approval-based actions, and only later narrow autonomy.

The main user fear is not "can AI write an email?" It is: will it misunderstand context, leak private information, schedule the wrong thing, send something embarrassing, or become another dashboard to manage?

That makes OneBrain important. The assistant should not own long-term memory or business data. It should run as a work assistant module on top of OneBrain, with all captured data, derived memories, permissions, audit logs, retention rules, and retrieval governed by OneBrain spaces and purposes.

OneBrain is not a nice-to-have integration. It is the brain and canonical database. The assistant product may keep short-lived runtime state, queues, and caches, but all durable user, business, assistant, memory, calendar, email, task, and audit data must live in OneBrain from the beginning.

Deployment should start on Railway for speed, but the architecture must be portable. Railway should be a runtime target, not a product dependency. The same services should be deployable later to a Yameena server or another GDPR-compliant environment through environment variables, Dockerized services, replaceable adapters, and clear service boundaries.

The main user surfaces should be web, voice, and Telegram. Telegram is not just "notifications later"; it should be one of the primary ways the user talks to the assistant and receives private push-style updates, daily briefs, follow-up nudges, action approvals, and quick answers. The web interface should be built first, but it must be mobile-first and app-ready so it can later ship as Android and iOS with minimal rework.

The extra July 2026 research adds one especially important design principle: users want autonomy, but they hate losing control. The assistant should "work while you sleep" by triaging, preparing drafts, creating briefs, and finding follow-ups, but irreversible actions must remain human-approved until trust is earned by category.

Recommended positioning:

> A real business personal assistant for your workday: inbox, calendar, follow-ups, meetings, and daily briefings, powered by your governed OneBrain.

## Research Inputs

This report combines:

- Current web research on executive assistant responsibilities and best practices.
- Reddit/community research from small business, productivity, automation, AI agent, and executive assistant discussions.
- YouTube search-pattern research around AI assistants, email assistants, calendar management, executive assistant workflows, and product reviews.
- Competitor scan across Google Gemini for Workspace, Microsoft 365 Copilot, Lindy, Superhuman, Motion, Reclaim, Fyxer, Granola, Read AI, and Otter.
- Local OneBrain context from the sibling repository, especially its governed data platform direction and service client surface.
- Supplemental July 2026 research provided by the user, covering G2/Trustpilot/Capterra/Reddit review syntheses, EA-industry commentary, and 2026 AI-assistant benchmark themes.

This is qualitative product discovery, not a statistically representative survey.

## Market Context

AI adoption is broad, but most organizations are still learning how to make it operational. McKinsey reports that 88 percent of surveyed organizations use AI in at least one business function, while most are still experimenting or piloting rather than scaling. It also reports that 23 percent are scaling agentic AI somewhere and another 39 percent are experimenting with agents.

Deloitte's 2026 enterprise AI research says productivity and efficiency are the most common benefits achieved so far, with two-thirds of organizations reporting gains. It also highlights that virtual assistants and chatbots are among the generative AI areas leaders expect to have meaningful impact.

PwC's AI agent survey found strong executive interest: 79 percent of surveyed companies are adopting AI agents, 88 percent expect higher AI budgets due to agentic AI, and 66 percent of adopters report productivity value. But PwC also warns that isolated agents and weak trust limit deeper transformation.

For this product, the implication is simple: companies are ready to buy, but they will reward narrow, reliable, workflow-native assistants more than broad demos.

Sources:

- McKinsey, "The State of AI: Global Survey 2025": https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- Deloitte, "The State of AI in the Enterprise - 2026": https://www.deloitte.com/us/en/what-we-do/capabilities/applied-artificial-intelligence/content/state-of-ai-in-the-enterprise.html
- PwC, "AI agent survey": https://www.pwc.com/us/en/tech-effect/ai-analytics/ai-agent-survey.html

## What A Real Business Personal Assistant Does

Across executive assistant resources, the job is not just "admin." It is operating leverage.

Core responsibilities:

- Keep the executive's calendar accurate and strategically aligned.
- Review the day, week, and month ahead.
- Process overnight emails and flag urgent matters.
- Prepare meeting materials.
- Track pending items and follow up.
- Coordinate with team members.
- Manage travel and logistics where relevant.
- Maintain confidentiality.
- Act as a gatekeeper for time and attention.
- Create a day-end summary and prepare tomorrow.

Professional EA guidance repeatedly frames the calendar as a business tool, not just a logistical record. High-performing assistants protect energy, prep time, follow-up time, deep work, and priority alignment. They do not simply fill open slots.

Sources:

- ASAP, "What High-Performing Assistants Get Right About Calendar Strategy": https://www.asaporg.com/articles/what-high-performing-assistants-get-right-about-calendar-strategy/
- ProAssisting, "Executive Assistant Daily Checklist": https://proassisting.com/resources/articles/executive-assistant-daily-checklist/
- Trainual, "Executive Assistant Role and Responsibilities": https://trainual.com/template/executive-assistant

## Community Demand Signals

### 1. Small business owners want relief from email, appointments, and forgotten commitments.

One r/smallbusiness owner described being overwhelmed by Outlook email traffic and appointments, and wanted help with travel and routine responses. Another small business owner with around 40 employees described wanting an AI assistant with access to email and calendar, usable while driving, that could summarize email, add items to calendar and todo lists, prioritize, delegate to employees, and track dependencies.

This is exactly the target customer: busy owner, fragmented communication, too many decisions, too much follow-up, and a clear desire for "structure so things do not get forgotten."

Sources:

- Reddit r/smallbusiness, "How to hire an assistant?": https://www.reddit.com/r/smallbusiness/comments/wj66bw/how_to_hire_an_assistant/
- Reddit r/smallbusiness, "AI personal assistant": https://www.reddit.com/r/smallbusiness/comments/1q5q469/ai_personal_assistant/

### 2. Scheduling automation is painful enough that users build hacks.

A Reddit user described building an agent that scans meeting-request emails, extracts proposed times, checks the calendar, replies with confirmation or alternatives, and blocks the slot. They reported saving 3-4 hours per week. The comments immediately turned to trust, hallucination rate, and whether a traditional script would be safer than an agent.

The product lesson: scheduling is a strong wedge, but customers need visible reliability and constrained behavior.

Source:

- Reddit r/smallbusiness, "I built an AI agent that reads my emails, schedules meetings, and updates my calendar automatically": https://www.reddit.com/r/smallbusiness/comments/1ptoggy/i_built_an_ai_agent_that_reads_my_emails/

### 3. Users are skeptical of all-in-one AI assistants.

In r/productivity, users complained that many AI assistants are slow, misunderstand context, and mess up scheduling. Several said native apps plus manual rules still work better. But one positive pattern emerged: users like connecting a strong LLM to email, calendar, and todo systems when it can give a morning summary, scan missed emails, schedule across time zones, and work flexibly.

The product lesson: do not compete as "one more app." Compete as a governed assistant layer over the systems people already use.

Source:

- Reddit r/productivity, "What AI apps are you using to manage your emails, calendar?": https://www.reddit.com/r/productivity/comments/1rdwig3/what_ai_apps_are_you_using_to_manage_your_emails/

### 4. Executive assistants still rely on simple, durable systems.

In r/ExecutiveAssistants discussions, many EAs rely on notebooks, inbox flags, Outlook categories, pinned emails, waiting folders, calendar reminders, and recurring task lists. The recurring pattern is not tool obsession. It is reliability, visibility, and status.

Users often track:

- Action needed.
- Waiting on reply.
- For later.
- By executive/person.
- Due date.
- Follow-up date.
- Done / archived.

The assistant product should not bury this in a chat transcript. It needs a clear operational board for commitments.

Source:

- Reddit r/ExecutiveAssistants, "How do you keep track of your to-do's and remember when to follow up?": https://www.reddit.com/r/ExecutiveAssistants/comments/1nuh4xg/how_do_you_keep_track_of_your_todos_and_remember/

### 5. AI tools help EAs most with drafting, summaries, meeting notes, policy search, and calendar analysis.

In r/ExecutiveAssistants, EAs described using AI for email rewriting, meeting minutes, action items, templates, policy Q&A, calendar overviews, time-spend analysis, Excel checks, presentations, and executive summaries. The same thread also contained strong resistance: hallucination, sensitive information, legal restrictions around recording, environmental concerns, job-replacement anxiety, and the need to double-check outputs.

The product lesson: build for controlled assistance, not blind automation.

Source:

- Reddit r/ExecutiveAssistants, "What AI tools are you using daily as an EA?": https://www.reddit.com/r/ExecutiveAssistants/comments/1p3w8vh/what_ai_tools_are_you_using_daily_as_an_ea/

### 6. There is demand for tedious "assistant calls" and external coordination.

One EA said the AI they wanted most would handle annoying small calls, like waiting on hold for 25 minutes to ask someone to resend a PDF. This is not a V1 core, but it is a high-value future direction: vendor calls, appointment confirmations, document chasing, and routine external admin.

Source:

- Same r/ExecutiveAssistants thread above.

### 7. Basic email/calendar VA work is being compressed by native tools.

In r/smallbusinessuk, one commenter said built-in filters, in-app copilots, and booking links have reduced demand for a basic VA who only manages email and calendar. They still saw demand for trusted admin tasks that are time-consuming and messy.

The product lesson: basic "sort my inbox" is not enough. The assistant must connect inbox, calendar, tasks, follow-up, business context, and proactive preparation.

Source:

- Reddit r/smallbusinessuk, "Is there still a strong need for virtual assistants to manage emails and calendars for small business owners?": https://www.reddit.com/r/smallbusinessuk/comments/1lpe6fq/is_there_still_a_strong_need_for_virtual/

### 8. YouTube search patterns show demand for practical workflows, not theory.

YouTube results are packed with tutorials and reviews: calendar management for executive assistants, best AI personal assistants for work, AI email assistant comparisons, Lindy reviews, Motion/Reclaim tutorials, Fyxer walkthroughs, and "build an AI assistant to schedule meetings and send follow-ups." This suggests users are already actively searching for usable setups.

Representative YouTube patterns:

- "Calendar Management for Executive Assistants"
- "5 Best AI Personal Assistants for Work"
- "The Best AI Email Assistants"
- "Lindy AI Review"
- "Build an AI Assistant to Schedule Meetings and Send Follow-Ups"
- "How To Plan Your Day and Week As An Executive Assistant"

### 9. The category is splitting into reactive chatbots and autonomous assistants.

The supplemental research makes this distinction sharper: business users judge an assistant by whether it closes admin loops without the user thinking about them. If the product only answers when prompted, users treat it as a chatbot. If it triages overnight, prepares drafts, builds the morning brief, flags commitments, and proposes safe next actions, users begin to experience it as an assistant.

The practical test for this product should be:

- How many admin loops did the assistant prepare, close, or prevent this week?
- How many things did it catch before the user remembered them?
- How many drafts, follow-ups, and scheduling actions were ready before the user opened the app?

### 10. "AI Calendar Anxiety" is a real emotional failure mode.

The extra research calls out a recurring complaint: tools that aggressively reshuffle the day make users feel less in control. The lesson is not to avoid calendar automation. It is to make the default behavior calm: defend focus time, suggest one change at a time, explain why, and avoid silent cascading reschedules.

The assistant should protect the day before it redesigns the day.

## Competitor Landscape

### Google Gemini for Workspace

Gemini in Gmail can summarize threads, suggest replies, draft emails, find information in previous emails and Drive, get Calendar information, create Calendar events, suggest todos, and search emails. This is a major default competitor for Google Workspace users.

Strength: deep native integration.

Weakness/opportunity: not a dedicated assistant operating model. It is still mostly embedded AI inside Google apps, and business owners still need cross-system memory, follow-up ownership, and a clear daily operating surface.

Source: https://support.google.com/mail/answer/14355636

### Microsoft 365 Copilot

Copilot in Outlook supports triage actions, natural-language rules, summaries, drafting, coaching, and chat. It can schedule meetings from email threads and create agendas. Outlook Calendar Instructions can auto-accept, auto-decline, follow meetings, and remove canceled meetings with reviewable instructions.

Strength: enterprise trust, Outlook/Teams/Graph integration, compliance posture.

Weakness/opportunity: still tied to Microsoft 365. A OneBrain assistant can become the cross-product governed layer for companies that use Microsoft, Google, WhatsApp, Telegram, CRM, custom docs, and internal knowledge together.

Sources:

- https://support.microsoft.com/en-us/outlook/frequently-asked-questions-about-copilot-in-outlook
- https://support.microsoft.com/en-us/outlook/copilot-outlook/create-a-meeting-agenda-with-copilot-in-outlook
- https://support.microsoft.com/en-us/outlook/calendar-instructions-in-outlook-and-copilot

### Lindy

Lindy positions itself as an AI work assistant that proactively manages inbox, meetings, and calendar. Its Plus plan advertises iMessage access, inbox management, draft replies, meeting scheduling/prep/follow-up, meeting recording/notes, style learning, and many integrations.

Strength: strong "text your assistant" positioning.

Weakness/opportunity: businesses with GDPR/data-governance needs may prefer a OneBrain-native assistant where data lives in their own governed platform.

Source: https://www.lindy.ai/

### Superhuman Mail

Superhuman focuses on email speed: drafting in your voice, follow-up reminders, instant replies, AI search across inbox/calendar/web, and email workflows.

Strength: excellent email-productivity positioning.

Weakness/opportunity: mostly email-first. The OneBrain assistant should be workday-first: email is an input, not the whole assistant.

Source: https://superhuman.com/products/mail/ai

### Motion

Motion sells AI calendar/task scheduling that prioritizes tasks, alerts on at-risk deadlines, schedules meetings, and protects deep work.

Strength: task-to-calendar planning.

Weakness/opportunity: less focused on inbox, follow-up, and broader business memory.

Source: https://www.usemotion.com/features/ai-calendar

### Reclaim

Reclaim focuses on protecting focus time, auto-scheduling tasks and habits, buffer time, conflict resolution, calendar sync, and time analytics.

Strength: calendar intelligence, team scheduling, and the calmer "defend my time" posture that users often prefer over aggressive rescheduling.

Weakness/opportunity: not a full executive-assistant workflow covering inbox, meeting prep, business memory, and action follow-up.

Source: https://reclaim.ai/

### Fyxer

Fyxer organizes the inbox, prioritizes urgent items, drafts replies in the user's tone, and joins meetings to take notes and inform drafts with business context.

Strength: low-friction inbox assistant.

Weakness/opportunity: email and meetings are strong, but OneBrain can differentiate through governed long-term business memory and modular product suites.

Source: https://www.fyxer.com/

### Granola, Read AI, Otter

These products show a strong demand for meeting capture and follow-up:

- Granola syncs with calendars and makes meeting notes usable by AI tools.
- Read AI captures and summarizes meetings, generates action items, searches across meetings/emails/chats, and shares decisions.
- Otter captures conversations, creates summaries, tracks takeaways, handles action items, integrates with calendar/Zoom/Meet/Teams/Slack/CRM, and presents itself as an executive-assistant-like meeting agent.

Strength: meeting intelligence.

Weakness/opportunity: meeting notes alone do not close the loop. The OneBrain assistant should turn meetings into follow-ups, calendar blocks, drafts, decisions, and memory.

Sources:

- https://www.granola.ai/
- https://www.read.ai/
- https://otter.ai/

### Additional Landscape Notes From The Supplemental Research

The extra research adds a few important market neighbors:

- Shortwave and Superhuman represent AI-native or AI-enhanced inboxes.
- Clockwise and Reclaim represent calmer calendar optimization.
- Saner.ai points at the ADHD/executive-function market: people want help getting started and reducing cognitive load, not just scheduling.
- alfred_, Arahi, Sai/Simular, Lindy, and similar tools position around "AI EA" autonomy, persistent memory, and cross-app workflows.
- OpenClaw, n8n, Gumloop, and other DIY systems show power-user demand for private/local or deeply customizable agents.

These do not change the recommended wedge. They reinforce it: the winning assistant must own the email/calendar/follow-up loop with trust, not simply list integrations.

## What People Like

Users respond positively to:

- Summaries that reduce reading time.
- Drafts that sound like them.
- Automatic follow-up reminders.
- Calendar conflict detection.
- Free-slot suggestions.
- Protected focus time.
- Morning summaries that identify what matters.
- Meeting notes with decisions and action items.
- Search across old emails, meetings, and docs.
- Background monitoring that does not require constant prompting.
- Overnight triage and drafts ready before the workday starts.
- Voice input while driving or moving.
- Telegram private messages for briefings, alerts, approvals, and quick assistant conversations.
- Working inside existing Gmail/Outlook/Calendar tools.
- Simple categories like urgent, waiting, needs action, FYI, follow-up.
- Human confirmation before sensitive actions.
- Calm calendar protection that explains changes instead of thrashing the whole day.
- Text-it-like-a-human interaction with very low surface area.
- Meeting prep briefs that include relationship and history context.

## What People Dislike

Users complain about:

- Slowness.
- Context mistakes.
- Scheduling errors.
- AI trying to do everything but doing nothing well.
- Extra dashboards.
- Needing to double-check so much that time savings disappear.
- Hallucinated meeting minutes.
- Poor tone in emails.
- "AI-isms" in drafts: generic formality, too many bullet lists, business jargon, placeholders, and relationship-blind wording.
- Calendar tools that keep reshuffling the day without explaining what changed.
- Lack of Outlook support.
- Black-box access to email/calendar.
- Security and privacy uncertainty.
- Recording/legal concerns.
- AI tools pushed by leadership without clear workflow value.
- Agents with too much autonomy too early.
- Setup that takes longer than the trial period to prove value.
- Mobile apps that feel like stripped-down afterthoughts.
- Creeping prices without clear weekly time saved.

## Core Jobs To Be Done

### Job 1: "Tell me what needs my attention."

Inputs:

- Unread email.
- Calendar.
- Tasks.
- Meeting notes.
- Slack/Teams later.
- OneBrain business memory.

Output:

- "Urgent now."
- "Needs reply."
- "Can wait."
- "Waiting on someone else."
- "Delegatable."
- "Should become a task."
- "Should become a calendar block."

### Job 2: "Structure my day."

The assistant should produce a daily plan that includes:

- Meetings.
- Prep blocks.
- Follow-up blocks.
- Deep work.
- Breaks and buffers.
- Travel time if relevant.
- Conflicts and risks.
- Tasks that fit real free time.

### Job 3: "Find time without making a mess."

This includes:

- Free slots.
- Priority-aware availability.
- Time-zone handling.
- Meeting length suggestions.
- Buffer rules.
- Protected focus time.
- Avoiding gaps that ruin larger useful blocks.
- Drafting scheduling replies.

### Job 4: "Prepare me before meetings."

Meeting prep should include:

- Attendees.
- Relevant recent emails.
- Related docs.
- Past decisions.
- Open tasks.
- Suggested agenda.
- Risks/questions.
- Customer/account context if allowed.

### Job 5: "Do not let anything fall through."

This is the follow-up brain:

- Waiting on replies.
- Promises made by the user.
- Promises made by others.
- Delegated tasks.
- Due dates.
- No-response nudges.
- Meeting action items.
- Recurring admin obligations.

### Job 6: "Write the first draft."

The assistant should draft:

- Replies.
- Follow-up emails.
- Scheduling emails.
- Internal updates.
- Meeting agendas.
- Briefing notes.
- Delegation messages.
- End-of-day summaries.

### Job 7: "Give proactive ideas."

Proactive ideas should be practical:

- "You have a client call tomorrow and no prep block."
- "This email asks for a decision, but no task exists."
- "You promised to send the proposal by Friday."
- "Your Thursday has six back-to-back meetings. Add buffers?"
- "This contact has gone cold. Follow up?"
- "You have 90 minutes free this morning; this is the best deep-work item."
- "This meeting has no agenda. Ask for one or decline?"

### Job 8: "Earn autonomy without making me nervous."

The assistant must let the user choose how much control it has by action type.

Autonomy levels:

- Read-only: summarize, classify, and brief.
- Suggest: recommend actions with reasons and sources.
- Draft: prepare replies, follow-ups, tasks, and calendar events without executing.
- Act with approval: batch safe proposed actions for one-tap review.
- Narrow autonomy: only whitelisted, low-risk actions such as labeling newsletters, creating internal reminders, or drafting scheduling replies for approved senders.

This should be visible and adjustable per workflow. For example: auto-label newsletters, draft scheduling replies, but always ask before sending to clients.

## Recommended Product Direction

Build the new product as:

> WorkPA: a OneBrain-powered business personal assistant.

This should be a module that works with OneBrain as the master data and governance layer.

### The Product Promise

"Every morning, your assistant has already checked your inbox, calendar, meetings, commitments, and business memory. It gives you the day, drafts the obvious replies, protects your calendar, and keeps track of everything waiting on someone."

Weekly proof should be concrete: tasks prepared, follow-ups caught, conflicts avoided, drafts accepted, and hours saved. The product should report operational wins, not just AI activity.

### The V1 User

Primary:

- Founder, owner, consultant, agency lead, real-estate operator, sales leader, or small business executive.

Secondary:

- Existing executive assistants who want a tool that helps them support one or more executives.

Avoid starting with large enterprise IT as the primary buyer. Enterprise will care deeply about compliance and governance, but the fastest learning will come from owner-led businesses where the pain is direct.

## Recommended V1 Scope

### 1. Morning Brief

Runs automatically every workday.

Includes:

- Today's meetings.
- Prep needed.
- Calendar conflicts.
- Free slots.
- Urgent emails.
- Emails awaiting reply.
- Follow-ups due.
- Suggested top 3 priorities.
- Risks for the day.

### 2. Inbox Triage

Connect Gmail and Outlook.

Classify email into:

- Reply needed.
- FYI.
- Waiting on them.
- Waiting on me.
- Scheduling.
- Invoice/document/admin.
- Newsletter/noise.
- Potential task.
- Potential meeting prep.

V1 should create drafts, labels, and suggestions. It should not send external emails without confirmation.

### 3. Calendar Intelligence

Features:

- Free-slot finder.
- Conflict detector.
- Buffer suggestion.
- Focus-time protection.
- Meeting density warnings.
- Prep/follow-up block suggestions.
- Working-hours and preference learning.

### 4. Scheduling Drafts

When an email asks for a meeting:

- Extract proposed date/time.
- Check availability.
- Suggest 2-3 options.
- Draft a reply.
- Prepare a calendar event.
- Ask for confirmation.

### 5. Meeting Prep

Before each important meeting:

- Pull relevant emails, notes, docs, and prior decisions from OneBrain.
- Summarize context.
- Show open tasks and promises.
- Suggest agenda/questions.

### 6. Meeting Follow-Up

After meetings:

- Import notes/transcripts where available.
- Extract decisions, tasks, owners, due dates.
- Draft follow-up email.
- Add action items to the follow-up tracker.
- Store derived memory with provenance in OneBrain.

### 7. Follow-Up Tracker

This is a core surface, not a side feature.

Views:

- Waiting on me.
- Waiting on others.
- Delegated.
- Due this week.
- No reply after X days.
- High-value contacts.
- Needs calendar block.

### 8. Proactive Suggestions

Every suggestion should include:

- What it noticed.
- Why it matters.
- Suggested action.
- Confidence level.
- Source links.
- Confirm / dismiss / remind later.

No spooky autonomy. The assistant should feel observant, not invasive.

### 9. Trust Ladder And Calm Autonomy

V1 should include an explicit autonomy model from the start, even if most actions begin at read-only or draft-only.

Rules:

- Start every customer and every new action type in read-only or suggest mode.
- Promote actions only after repeated user acceptance.
- Let users set autonomy by sender, domain, action type, and space.
- Batch confirmations so review feels like an assistant handoff, not constant nagging.
- Never silently cascade calendar changes.
- For calendar planning, default to "defend and explain," not "rebuild my day."

### 10. Voice-Matched Drafts

Email quality is a trust lever, not polish. The assistant should learn from sent mail, adapt tone by recipient, and avoid generic AI style.

Drafting rules:

- Use relationship history and thread context.
- Match brevity, warmth, formality, and sign-off style.
- Avoid reflexive bullet lists unless the user writes that way.
- Say "I need more context" instead of producing a confident generic draft.
- Let the user correct tone quickly and save that feedback as a preference memory.

### 11. First-Session Win

Setup friction kills this category. The first session should deliver a visible win within minutes:

- Connect mailbox/calendar.
- Show a triaged inbox sample.
- Produce tomorrow or today's brief.
- Identify at least one follow-up risk.
- Find one calendar conflict or missing prep block.

The first experience should feel like "it already helped," not "now configure your assistant."

## What Not To Build First

Avoid in V1:

- Full autonomous email sending.
- Phone-call automation.
- Travel booking.
- Expense reports.
- Full CRM.
- Social media posting.
- Complex project management.
- Broad "agent marketplace."
- Personal/family assistant scope.
- Replacing Gmail or Outlook as the email client.

These can come later, but the first product should win the daily work rhythm.

## Foundational Architecture Constraints

These constraints should guide every implementation decision.

### OneBrain Owns The Data

The assistant must treat OneBrain as the only durable data layer.

Rules:

- Do not create an independent long-term assistant database for user, business, email, calendar, task, memory, meeting, document, or audit data.
- Store canonical records in OneBrain with `account_id`, `space_id`, purpose, provenance, classification, retention policy, and audit metadata.
- Allow assistant services to keep ephemeral runtime state only: job IDs, retry state, connector cursors, temporary cache entries, session state, and provider request metadata.
- Any cache must be rebuildable from OneBrain and connector APIs.
- Any derived memory, summary, action proposal, briefing, task, or follow-up must be written back to OneBrain.
- OneBrain permissions and purpose checks happen before retrieval and before any action proposal.

This keeps the product modular and prevents the assistant from becoming a second brain that later has to be migrated, reconciled, or deleted separately.

### Railway First, Portable By Design

Railway is the first deployment target because it is fast for testing. It should not shape the product architecture.

Portability requirements:

- Every service runs in Docker.
- Runtime configuration comes from environment variables, not Railway-specific code.
- Services expose standard health checks.
- Background workers run as separate processes that can run on Railway, Docker Compose, a VM, or Kubernetes.
- Persistent storage is OneBrain-owned. If the assistant needs object storage for temporary audio or files, use a storage adapter.
- Secrets are accessed through a provider-neutral secret interface.
- Logs are structured JSON so they can go to Railway logs first and later to another logging stack.
- Scheduled jobs use an adapter so cron can run via Railway now and another scheduler later.
- Provider integrations use interfaces: AI provider, speech-to-text, text-to-speech, email, calendar, notification, queue, storage, observability.

The target migration path should be: Railway prototype -> Docker Compose on a Yameena server or EU VM -> optional orchestrated deployment later. The code should not need rewrites for that move.

### Modular Product Boundary

The assistant should be a OneBrain module, not a monolith.

Recommended services:

- Assistant web app: simple user-facing UI.
- Telegram gateway: private bot messages, commands, brief delivery, approval prompts, and Telegram-originated assistant turns.
- Assistant API: product-specific orchestration endpoints.
- Connector workers: Gmail, Outlook, Google Calendar, Microsoft Calendar, later Slack/Teams/WhatsApp/Telegram.
- Briefing worker: daily brief generation and refresh.
- Follow-up worker: commitment extraction, waiting-on detection, and reminders.
- Voice gateway: speech capture, transcription, assistant turn handling, and spoken response.
- Action executor: executes approved actions only.

Each service should communicate through explicit APIs and event contracts, not shared internal state.

### Provider Independence

No core feature should be locked to a single AI, voice, cloud, queue, database, or deployment provider.

Interfaces to define early:

- `BrainClient`: OneBrain capture, retrieval, policy, and action records.
- `LLMProvider`: generation, extraction, classification, summarization.
- `SpeechToTextProvider`: voice input transcription.
- `TextToSpeechProvider`: spoken assistant responses.
- `EmailConnector`: Gmail/Outlook message read, draft, label, send-after-approval.
- `CalendarConnector`: availability, event draft, event write-after-approval.
- `TelegramChannel`: private assistant chat, outbound brief/notification delivery, inbound commands, action approvals, and optional voice-message intake.
- `QueueProvider`: background jobs.
- `SchedulerProvider`: recurring briefs and checks.
- `NotificationProvider`: provider-neutral delivery orchestration across Telegram, email, web push, and later native push/WhatsApp.
- `StorageProvider`: temporary audio/file objects if needed.
- `ObservabilityProvider`: logs, metrics, traces, audit correlation.

This is the practical path to keeping the product open-ended without making V1 over-engineered.

## OneBrain Integration Strategy

OneBrain should be the system of record.

The assistant module should not own long-term data. It should use OneBrain for:

- Accounts.
- Spaces.
- App installations.
- Service keys.
- Permissions.
- Purposes.
- Captured messages.
- Calendar mirrors.
- Tasks and commitments.
- Meeting notes.
- Contact memories.
- Preference memories.
- Documents.
- Retrieval.
- Audit logs.
- Retention/deletion/export.

### Data Spaces

Suggested spaces:

- `business`: normal company work context.
- `personal_work`: private work assistant context for the owner/executive.
- `shared`: explicitly approved overlap between personal work and business context.
- `customer_service`: only if communication module data is relevant, and only by approved purpose.

### Purposes

Suggested purposes:

- `assistant_context`
- `assistant_inbox_triage`
- `assistant_calendar_planning`
- `assistant_meeting_prep`
- `assistant_followup_tracking`
- `assistant_action_proposal`
- `assistant_action_execution`
- `assistant_daily_briefing`
- `assistant_autonomy_policy`
- `assistant_voice_profile`
- `assistant_telegram_message`
- `assistant_notification_delivery`

### Service Surface

The current OneBrain service client already has:

- `GET /api/service/capabilities`
- `POST /api/service/capture`
- `POST /api/service/ask`

For the assistant, OneBrain will likely need additional contract concepts:

- Capture structured communication events.
- Capture calendar events.
- Capture action proposals.
- Store action audit logs.
- Store preference memories with provenance.
- Store recipient-specific tone and channel preferences.
- Store autonomy policies by sender, space, and action type.
- Store Telegram chat binding, delivery preferences, message provenance, and approval callbacks.
- Store notification delivery events and user responses.
- Query tasks/follow-ups by state.
- Retrieve context by purpose and source type.

### Suggested Canonical Data Objects

- `captured_messages`
- `calendar_events`
- `calendar_availability_snapshots`
- `assistant_tasks`
- `assistant_followups`
- `meeting_records`
- `meeting_action_items`
- `contact_profiles`
- `preference_memories`
- `daily_briefs`
- `action_proposals`
- `action_executions`
- `assistant_feedback`
- `assistant_autonomy_policies`
- `assistant_tone_profiles`
- `assistant_uncertainty_events`
- `assistant_channel_bindings`
- `assistant_notification_events`
- `assistant_telegram_messages`

Every row should include:

- `account_id`
- `space_id`
- `source_app`
- `purpose`
- `classification`
- `provenance`
- `retention_policy_id`
- `created_by`
- `created_at`

## Trust And Safety Requirements

The assistant will touch email and calendar. That means trust is the product.

### Main Risks

1. Sending or drafting the wrong thing.
2. Scheduling a wrong or embarrassing meeting.
3. Leaking private or confidential data.
4. Prompt injection from malicious emails/calendar invites.
5. Storing raw sensitive content in long-term memory.
6. Acting outside intended permissions.
7. Making hallucinated summaries or action items.
8. Becoming annoying through over-alerting.
9. Causing "calendar anxiety" by reshuffling the day too aggressively.
10. Producing relationship-blind email drafts that sound automated.

### Required Mitigations

- Human confirmation for external sends and calendar writes in V1.
- Draft-first workflow.
- Structured action proposals before any execution.
- Separate reader/planner/actor components.
- Least-privilege OAuth scopes.
- Per-sender and per-action autonomy controls.
- VIP and sensitive-sender rules such as "never auto-act."
- Scoped OneBrain service keys.
- Purpose-based retrieval.
- Source citations for briefings and suggestions.
- Audit log for every sensitive read/write.
- Undo where possible.
- Allowlist for low-risk autonomous actions.
- Never persist raw untrusted instructions as memory.
- Store structured derived facts with provenance.
- Prompt-injection scanning and validation.
- Action validators that check sender, recipients, dates, permissions, and confidence.
- Explicit meeting-recording consent and organization policy controls.
- Refuse or hand back drafts when the assistant lacks enough context.
- Explain calendar changes before applying them, especially when moving protected focus time.

Security references:

- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
- Microsoft 365 Copilot enterprise data protection: https://learn.microsoft.com/en-us/microsoft-365/copilot/enterprise-data-protection
- Google Workspace Gemini Privacy Hub: https://knowledge.workspace.google.com/admin/generative-ai/generative-ai-in-google-workspace-privacy-hub
- Reddit r/aiagents prompt-injection discussion: https://www.reddit.com/r/aiagents/comments/1spsidw/how_do_you_protect_autonomous_agents_that_read/

## Product Architecture Recommendation

### Modules

1. Connector layer
   - Gmail.
   - Outlook/Microsoft Graph.
   - Google Calendar.
   - Outlook Calendar.
   - Telegram as a primary assistant channel.
   - Later: Slack, Teams, WhatsApp, CRM.

2. Capture pipeline
   - Normalize emails, events, meeting notes, tasks.
   - Send to OneBrain with account, space, purpose, classification, provenance.
   - Keep connector cursors and retries as ephemeral operational state, not product data.

3. Intelligence layer
   - Email classifier.
   - Calendar planner.
   - Briefing generator.
   - Meeting prep generator.
   - Follow-up extractor.
   - Draft writer.
   - Preference learner.

4. Action proposal layer
   - Structured proposals only.
   - Confidence and reason.
   - Source references.
   - Validation checks.

5. Execution layer
   - Create draft email.
   - Create draft calendar event.
   - Apply label.
   - Create task.
   - Archive/snooze only when allowed.

6. User surfaces
   - Daily cockpit.
   - Inbox triage view.
   - Follow-up board.
   - Calendar plan.
   - Assistant chat.
   - Voice-first assistant entry point.
   - Telegram private assistant chat and push messages.
   - Email/WhatsApp brief delivery later.

7. Deployment layer
   - Dockerized services.
   - Provider-neutral adapters.
   - Railway deployment config for prototype.
   - Docker Compose/Yameena deployment path for later GDPR-oriented hosting.

## Product UX Principles

- Start with the day, not a landing page.
- Show what changed since yesterday.
- Make every suggestion dismissible.
- Never hide sources.
- Make follow-ups impossible to miss.
- Let users teach preferences quickly.
- Use plain assistant language, not AI jargon.
- Avoid "magic" in high-risk areas.
- Prefer small confirmations over big settings screens.
- Make confidence visible without making the UI academic.
- Keep the assistant quiet unless it has a reason.
- Treat the Daily Brief as the flagship ritual.
- Defend time before reshuffling time.
- Show memory with receipts, and let users edit what the assistant "knows."
- Admit uncertainty clearly.
- Make mobile a first-class surface, not a companion afterthought.
- Treat Telegram as a first-class assistant surface.
- Build the web UI mobile-first and app-ready from the start.

## Voice-First Simple UX

Voice should be a primary interface, not an add-on. The product should feel like talking to a business PA who can also show the minimum useful screen.

### Interaction Model

Primary interaction:

- User speaks naturally.
- Assistant responds with a short spoken answer.
- Screen shows only the supporting artifact: brief, draft, schedule choice, follow-up list, or confirmation card.
- Sensitive actions require a clear approval step.

The assistant should support short commands:

- "What does my day look like?"
- "Do I have space for a 30-minute call with Sarah this week?"
- "Draft a reply to Ahmed."
- "What am I waiting on?"
- "Move my prep block if it conflicts."
- "What changed overnight?"
- "Give me the quick version."

### Minimal Screens

V1 should avoid a large dashboard. The product needs only a few clear surfaces:

- Today: morning brief, next meetings, top priorities, risks, and quick actions.
- Inbox Review: emails that need decisions, drafts, scheduling requests, and ignored noise.
- Follow-Ups: waiting on me, waiting on others, delegated, overdue, and due soon.
- Calendar Plan: protected focus blocks, conflicts, free slots, and suggested changes.
- Assistant: voice/text conversation with action cards.
- Settings: connectors, autonomy ladder, privacy, voice, language, and notification preferences.

Every screen should answer: "What needs my attention, what can I approve, and what can I ignore?"

### Voice And Language Requirements

- Support push-to-talk first; always-listening can wait.
- Keep responses short by default, with "more detail" available.
- Let the user interrupt, correct, or cancel.
- Persist voice-derived actions as structured OneBrain records with transcript provenance.
- Make German and English first-class if the product is intended for DACH buyers.
- Let users choose spoken style: concise, warm, formal, or direct.
- Never speak sensitive content aloud unless the user explicitly asks and the context is safe.

### UX Quality Bar

The assistant should feel calm, quiet, and useful.

- No marketing homepage as the first screen inside the app.
- No crowded command center.
- No unnecessary charts.
- No nested cards.
- No heavy settings before first value.
- No visible AI jargon unless needed for trust.
- Confirmation cards should be fast: approve, edit, dismiss, remind later.
- The mobile experience must be complete for the core loop: brief, voice, drafts, follow-ups, and approvals.

## Telegram Assistant Layer

Telegram should be a primary communication layer beside the web app and voice interface.

### Telegram Jobs

Telegram should handle:

- Morning brief delivery.
- Important inbox/calendar/follow-up updates.
- Quiet push-style reminders.
- Approval prompts for draft replies and scheduling actions.
- Quick text questions.
- Quick voice-message questions if enabled.
- "What changed?" and "What am I waiting on?" commands.
- Links back to the relevant web screen when deeper review is needed.

### Telegram UX Rules

- The assistant talks to the user as a private Telegram chat.
- Messages stay short and decision-oriented.
- Every Telegram push has a clear reason.
- Approval prompts use simple actions: approve, edit on web, dismiss, remind later.
- No sensitive content is sent to Telegram unless the user has explicitly enabled that category.
- Telegram delivery preferences are per user, per space, and per notification type.
- The user can pause, quiet, or change notification timing from Telegram.
- Telegram inbound messages are stored in OneBrain with channel provenance.

### Telegram Architecture

- Use a dedicated Telegram gateway service.
- Webhooks are verified and routed through the assistant API.
- Telegram chat IDs are treated as sensitive channel bindings and stored through OneBrain.
- Outbound messages are generated from structured notification/action records, not ad hoc worker strings.
- Every delivered message writes a notification event for audit and troubleshooting.
- Telegram is one channel behind a broader `NotificationProvider`, so future native push, email, or WhatsApp can reuse the same notification model.

## Web Now, App-Ready Later

V1 should be web-based, but every UI decision should assume future Android and iOS packaging.

Requirements:

- Mobile-first responsive layout.
- PWA-friendly structure where possible.
- Avoid desktop-only interactions.
- Keep voice capture behind an interface so browser, Android, and iOS implementations can differ later.
- Keep notifications behind an interface so Telegram works now and native push can be added later.
- Avoid hard dependencies on browser APIs that do not work reliably in mobile WebViews.
- Keep authentication and OAuth callback flows compatible with mobile deep-linking later.
- Keep file/audio upload flows compatible with mobile capture.
- Consider Capacitor-style wrapping later, but do not require native apps for V1.

This keeps the first product simple while avoiding a rewrite when Android and iOS become priorities.

## Pricing Hypothesis

Competitors cluster around:

- Email/calendar assistant: roughly $20-50 per user/month.
- Meeting assistants: free to $20+ per user/month.
- Work assistants with broader automation: $30-100+ per user/month depending on scope.

Suggested pricing tests:

1. Solo Business Assistant: $39-59/month.
2. Pro Business Assistant: $79-99/month with multiple inboxes/calendars, meeting prep, and OneBrain memory.
3. Team/Company: per-seat plus OneBrain core, with admin controls and shared spaces.
4. Concierge/onboarding package for business owners who want setup done.

The product should justify price through hours saved, fewer dropped balls, and better preparedness, not by token count or number of AI features.

## MVP Success Metrics

Measure:

- Time from connect to first useful brief.
- Number of accepted suggestions per week.
- Draft acceptance/edit rate.
- Follow-ups caught before user reminder.
- Calendar conflicts prevented.
- Prep blocks created.
- Meeting-prep open rate.
- False positive rate in urgent email classification.
- False negative rate for missed urgent messages.
- User trust rating after each action.
- Undo/revert usage.
- Weekly active users.
- Retention after 4 weeks.

Qualitative success:

- "It caught something I would have missed."
- "It wrote the draft I needed."
- "My day feels structured."
- "I trust it because it shows sources."
- "It works in the tools I already use."

## Strategic Differentiation

The market is full of AI assistants. The differentiator should be:

1. Governed memory through OneBrain.
2. Business-first daily operations, not general chat.
3. Cross-tool context with strict permission boundaries.
4. Follow-up ownership as a first-class product.
5. Progressive autonomy.
6. One assistant across future modules: assistant, communication, CRM, booking, finance/admin, internal helpdesk.
7. Calm calendar automation that avoids "AI Calendar Anxiety."
8. Voice-matched, recipient-aware drafting.
9. DACH/German-language and GDPR-forward positioning for buyers who distrust US-first assistant tools.

Google and Microsoft will own the default app-level AI experience. This product should own the customer-specific operating layer across tools and data spaces.

## Recommended Product Name Direction

Possible internal names:

- WorkPA
- OneBrain Assistant
- BusinessPA
- Chief of Day
- Operator
- DarAI Business Assistant

Best short-term recommendation:

> OneBrain Assistant

It ties directly to the platform promise: the assistant is not a standalone toy; it is powered by the company's governed brain.

## Recommended Build Sequence

### Phase 0: Foundations

- OneBrain service contracts for assistant capture and retrieval.
- OAuth connector proof for Gmail/Google Calendar or Outlook first.
- Data model for messages, calendar events, tasks, follow-ups, briefings, and action proposals.
- Audit logging.
- Human confirmation model.
- Trust ladder and autonomy policy model.
- Prompt-injection and action-validation pipeline.
- Dockerized service skeleton that runs on Railway and locally.
- Provider interfaces for AI, voice, queues, schedules, storage, and observability.
- Voice gateway proof with push-to-talk and transcript capture.
- Telegram gateway proof with private message binding and test notification delivery.
- Mobile-first web/PWA shell constraints.

### Phase 1: Daily Brief + Follow-Up Board

- Morning brief.
- Email triage.
- Calendar conflict/free-slot analysis.
- Waiting-on tracker.
- Manual feedback on classifications.
- First-session win flow: connect, triage, brief, and one follow-up risk within minutes.
- Today screen and voice/text assistant entry point.
- Telegram delivery for the morning brief and urgent follow-up updates.

### Phase 2: Drafts + Scheduling

- Email reply drafts.
- Scheduling drafts.
- Draft calendar events.
- Confirmed action execution.
- Preference learning.
- Voice-matched drafting and recipient tone profiles.

### Phase 3: Meeting Prep + Meeting Follow-Up

- Pre-meeting brief.
- Import notes/transcripts.
- Extract action items.
- Draft follow-up email.
- Store decisions and memories in OneBrain.

### Phase 4: Controlled Autopilot

- Allowlisted actions.
- Auto-labeling.
- Auto-snoozing newsletters/noise.
- Auto-follow-up reminders.
- Internal-only messages.
- Calendar instructions for safe cases.

### Phase 5: Voice And External Admin

- Voice while driving.
- Telegram voice-message intake if useful.
- Vendor calls.
- Appointment confirmations.
- Document chasing.
- Travel/admin workflows.
- More advanced hands-free workflows once the trust ladder has enough acceptance history.

## Final Recommendation

Build a business personal assistant that behaves like a disciplined executive assistant, not a chatty AI companion.

V1 should center on:

- Morning brief.
- Inbox triage.
- Calendar planning.
- Scheduling drafts.
- Follow-up tracker.
- Meeting prep.
- Human-approved actions.

Use OneBrain as the governed memory and data system from day one. The assistant should be the work interface; OneBrain should be the trusted brain.

Build on Railway first, but keep the system portable from day one. The assistant should run as modular Dockerized services with provider-neutral adapters so it can move later to a Yameena server or another GDPR-ready environment without redesigning the product.

Make voice and simplicity core to the product. The best UI is not a big dashboard; it is a calm assistant surface that lets the user speak, review the few things that matter, approve actions, and get back to work.

The wedge is not "AI can do everything." The wedge is "your business day is finally under control."
