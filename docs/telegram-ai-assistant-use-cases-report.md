# Telegram AI Assistant Use Case and Gap Report

Date: 2026-07-03

## Executive Summary

Telegram is one of the strongest surfaces for DarAI/Dori because it supports quick capture, voice notes, family groups, workspace groups, inline approvals, reminders, and daily briefings in the place users already talk. The current implementation already covers a large share of the expected assistant behavior: private chat, group routing, voice transcription, voice replies, photo/document intake, tasks, calendar, reminders, shopping, notes, approvals, undo, morning/family digests, workspace standups, recap, news voice summaries, web search, and Content Studio generation.

The biggest product gaps are not raw AI intelligence. They are Telegram-specific workflows:

- Voice notes need reliable "transcribe and act" behavior in groups, not just transcript echo.
- Old group history must never create fresh confirmations or actions.
- Emoji feedback is only partially understood as yes/no; it is not yet a feedback-learning interface.
- News works for current answers and voice summaries, but topic subscriptions and "news to content idea" flows are not fully exposed in Telegram.
- Content Studio exists, but Telegram does not yet feel like a creator command center.
- Group privacy, permission, and identity rules need more explicit UX.

## Current Capability Snapshot

Observed code paths:

- `supabase/functions/telegram-poll/index.ts`: Telegram webhook/poll entry, voice/audio transcription, private chat, callbacks, photo/document intake, group routing, news voice detection.
- `supabase/functions/telegram-router/index.ts`: family/workspace group routing, agenda/digest/news commands, group history, command shortcuts, natural-language handoff to `chat`.
- `supabase/functions/chat/index.ts`: core agent, tools, server-side execution, confirmation gate, web search, memory/state, productivity/family/workspace tools.
- `supabase/functions/_shared/telegram-commands.ts`: scoped private/group/workspace commands, German command sets, actionable group keyword detection.
- `supabase/functions/_shared/telegram-control.ts`: cockpit, quick commands, approvals, memory, now, brief, plan, delegate, review, settings.
- `supabase/functions/_shared/briefingNews.ts`: live Google Search-grounded news generation.
- `supabase/functions/_shared/contentIdeas.ts`, `content-ideas`, `content-script`, `content-ideas-cron`: Content Studio ideas and scripts with trending/evergreen modes.

Status labels:

- Supported: implemented as a clear Telegram or core assistant flow.
- Partial: possible today, but reliability, UX, or Telegram-specific handling is incomplete.
- Gap: app/backend capability exists or is feasible, but Telegram does not expose it well.
- Not built: no clear implementation path visible in the current Telegram surface.

## 100 Telegram Use Cases

|   # | User Use Case                                                    | Status    | Notes / Gap                                                                                      |
| --: | ---------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
|   1 | Send a voice note to add a task.                                 | Partial   | STT exists and injects text; reported group acting bug means reliability is not done.            |
|   2 | Send a voice note to create a calendar event.                    | Partial   | Core event tools exist; needs robust group execution after transcript.                           |
|   3 | Send a voice note to set a reminder.                             | Partial   | Reminder tool exists; ambiguity/confirmation handling needs stronger voice UX.                   |
|   4 | Dictate a long brain dump and ask Dori to turn it into tasks.    | Partial   | `delegate` pattern exists; needs better batching and confirmation summary in Telegram.           |
|   5 | Dictate a note for later.                                        | Supported | Notes tools and voice transcription exist.                                                       |
|   6 | Voice ask "what's today?" and receive agenda.                    | Supported | `/me`, `/today`, agenda and voice reply preference exist.                                        |
|   7 | Voice ask for a news summary.                                    | Supported | `/news voice` and natural "news + voice" detection exist.                                        |
|   8 | Voice ask to summarize a document previously uploaded.           | Partial   | Document extraction and summarize tool exist; voice follow-up context may be fragile.            |
|   9 | Voice ask in German to add "Termin morgen 14 Uhr".               | Partial   | German support exists, but needs golden voice/action tests.                                      |
|  10 | Voice ask for a shopping item to be added.                       | Partial   | Shopping tools exist; group voice action reliability needs hardening.                            |
|  11 | Voice correct a previous transcript.                             | Gap       | Transcript echo exists, but no explicit correction workflow.                                     |
|  12 | Voice reply "yes, do it" to approve a pending action.            | Partial   | Yes/no classifier includes German and casual terms, but voice quirks need test coverage.         |
|  13 | Voice reply "cancel" to reject an action.                        | Partial   | Classifier supports no/cancel terms; needs STT confidence handling.                              |
|  14 | Voice enable or disable voice replies.                           | Supported | `/voice on/off` and settings command can steer preferences.                                      |
|  15 | Receive long answers as a short voice summary plus text details. | Partial   | Voice digest pattern exists; generic long-answer audio summary button is not built.              |
|  16 | Type natural-language task creation.                             | Supported | Core task tools and private/group routing exist.                                                 |
|  17 | Type natural-language calendar creation.                         | Supported | Event tools, recurrence, household/workspace context exist.                                      |
|  18 | Type "move dentist to Friday".                                   | Supported | Event update/search tools exist; ambiguity still needs confirmation.                             |
|  19 | Type "delete that task".                                         | Partial   | Delete tools exist; pronoun/history scoping must be reliable per chat.                           |
|  20 | Type "undo that".                                                | Supported | `/undo`, inline undo buttons, and undo log exist.                                                |
|  21 | Type a slash command like `/add Pay electricity bill`.           | Supported | Command list and router support quick add.                                                       |
|  22 | Type in German without slash commands.                           | Partial   | Model and command sets support German; deterministic German NLU tests are thin.                  |
|  23 | Paste a long article and ask for a summary.                      | Partial   | Web/document summarization exists; long Telegram text can confuse action history unless guarded. |
|  24 | Paste a URL and ask for key points.                              | Supported | Webpage summarization tool exists.                                                               |
|  25 | Ask "what can you do?"                                           | Supported | Capability/help tools and help commands exist.                                                   |
|  26 | Ask "what did you do today?"                                     | Supported | Recap/recent actions tools exist.                                                                |
|  27 | Ask "what should I do now?"                                      | Supported | `/now` quick command exists.                                                                     |
|  28 | Ask for a structured plan.                                       | Supported | `/plan` and planning prompt exist.                                                               |
|  29 | Delegate a multi-step job.                                       | Partial   | `/delegate` exists; execution plans exist, but Telegram plan UX needs polish.                    |
|  30 | Search memories or ask what Dori remembers.                      | Supported | `/memory`, memory state and semantic memory exist.                                               |
|  31 | Send 👍 as approval.                                             | Supported | Confirmation classifier treats thumbs up as yes.                                                 |
|  32 | Send ✅ as approval.                                             | Supported | Confirmation classifier handles checkmark.                                                       |
|  33 | Send ❌ as rejection.                                            | Supported | Confirmation classifier handles cross mark.                                                      |
|  34 | Send 👎 as rejection.                                            | Supported | Confirmation classifier handles thumbs down.                                                     |
|  35 | React to a bot message with an emoji reaction.                   | Gap       | Telegram `message_reaction` updates are not in allowed update types.                             |
|  36 | Send 😂/❤️ as emotional feedback.                                | Gap       | No learning loop maps general emoji sentiment to preferences.                                    |
|  37 | Tap inline "Yes, do it" / "Cancel" buttons.                      | Supported | Confirmation keyboards and callback handlers exist.                                              |
|  38 | Use emoji to rate news/content ideas.                            | Gap       | Content idea liking exists in app; Telegram emoji feedback is not wired.                         |
|  39 | Ask "what's the latest news?"                                    | Supported | Chat web search detects news/current queries.                                                    |
|  40 | Ask for a spoken news briefing.                                  | Supported | News voice path exists in poll/router.                                                           |
|  41 | Ask for local news based on location.                            | Partial   | News generator accepts location; Telegram topic/location preferences need clearer UX.            |
|  42 | Subscribe to daily news topics.                                  | Partial   | Briefing/news preferences exist, but Telegram setup commands are not obvious.                    |
|  43 | Ask for tech/business/productivity headlines.                    | Supported | `generateNews` defaults to technology/business/productivity.                                     |
|  44 | Ask for "only AI startup news".                                  | Partial   | News generator accepts topics, but Telegram `/news voice` currently calls empty topics.          |
|  45 | Ask "send links too".                                            | Supported | News message includes links after voice summary.                                                 |
|  46 | Ask for news in German.                                          | Partial   | Locale exists; news voice title/copy appears English-centric.                                    |
|  47 | Ask for "why this news matters to me".                           | Partial   | Core model can reason; no saved interest-weighting/ranking loop in Telegram.                     |
|  48 | Ask for a weekly news recap.                                     | Partial   | Briefing machinery exists; Telegram weekly personalized news workflow is unclear.                |
|  49 | Ask to save a news item as a note.                               | Supported | Web/news plus note tools can do this.                                                            |
|  50 | Ask to create reminders from news events.                        | Partial   | Possible via tool chaining; high risk of hallucinated dates without explicit confirmation.       |
|  51 | Ask "turn today's AI news into content ideas".                   | Gap       | Content Studio can generate trending ideas, but Telegram command bridge is missing.              |
|  52 | Receive daily creator content ideas in Telegram.                 | Partial   | Content profile supports `channels: ["push","telegram"]`; delivery UX needs verification.        |
|  53 | Like/dismiss a content idea from Telegram.                       | Gap       | Content idea statuses exist; Telegram inline buttons are not exposed for ideas.                  |
|  54 | Generate a TikTok/Reels/Shorts script from an idea.              | Gap       | `content-script` exists, but Telegram command/callback is not wired.                             |
|  55 | Ask for YouTube long-form script from a liked idea.              | Gap       | Backend exists; Telegram UX absent.                                                              |
|  56 | Ask for captions/hashtags per platform.                          | Gap       | Script generator supports platform variants; Telegram workflow absent.                           |
|  57 | Ask for "make it punchier/shorter/longer".                       | Gap       | Script variations exist; Telegram bridge absent.                                                 |
|  58 | Ask for evergreen content ideas, not news.                       | Gap       | Content Studio supports knowledge mode; no Telegram command.                                     |
|  59 | Ask for a content calendar from ideas.                           | Partial   | Calendar tools and content ideas exist, but no direct content scheduling flow.                   |
|  60 | Ask "what should I post today?"                                  | Partial   | App feature exists; Telegram could answer through general AI, but not a polished flow.           |
|  61 | Get morning family digest.                                       | Supported | Family digest and cron/morning flow exist.                                                       |
|  62 | Get morning voice digest.                                        | Supported | Group voice digest settings and voice script exist.                                              |
|  63 | Ask for today's agenda with tappable cards.                      | Supported | `/today`, `/tomorrow`, event/task row keyboards exist.                                           |
|  64 | Mark a task done from an inline button.                          | Supported | Task callback handlers exist.                                                                    |
|  65 | Snooze a task from Telegram.                                     | Supported | Agenda/task callbacks and `/snooze` exist.                                                       |
|  66 | Search notes from Telegram.                                      | Supported | `/notes` and note tools exist.                                                                   |
|  67 | Append to an existing note.                                      | Supported | `append_note` exists.                                                                            |
|  68 | Log an expense.                                                  | Supported | `/expense` and expense tool exist.                                                               |
|  69 | Ask "how much did I spend this month?"                           | Supported | `/spent` and spend summary tool exist.                                                           |
|  70 | Ask weather.                                                     | Supported | `/weather` and weather tool exist.                                                               |
|  71 | Convert currency.                                                | Supported | `/fx` exists.                                                                                    |
|  72 | Ask timezone/time in another city.                               | Supported | `/tz` exists.                                                                                    |
|  73 | Track a flight.                                                  | Partial   | `/flight` command exists; depth of live flight integration unclear.                              |
|  74 | Set focus/quiet mode.                                            | Supported | `/focus`, `/quiet`, settings command exist.                                                      |
|  75 | Ask for last actions/recent mutations.                           | Supported | `/recent`, recent action tool exist.                                                             |
|  76 | Add family shopping items.                                       | Supported | `/buy`, `/shopping`, shopping tools exist.                                                       |
|  77 | Check off shopping list items with buttons.                      | Supported | Shopping callback handlers exist.                                                                |
|  78 | Ask who has a chore next.                                        | Supported | `/whoseturn` and chores command exist.                                                           |
|  79 | Ask for today's meal/menu.                                       | Supported | `/menu` exists.                                                                                  |
|  80 | Send a message to spouse/family member through Dori.             | Partial   | `send_family_message` exists and approval-gated; Telegram recipient linking must be reliable.    |
|  81 | Create a family poll.                                            | Supported | Telegram native poll tool exists.                                                                |
|  82 | Ask about birthdays.                                             | Supported | `/birthdays` exists.                                                                             |
|  83 | Add school/kid logistics.                                        | Partial   | Family tools exist; Telegram-specific structured kid workflows are not visible.                  |
|  84 | Share a school notice photo and extract tasks/events.            | Partial   | Photo intake exists; needs strong confirmation and extraction tests.                             |
|  85 | Link family members by Telegram username.                        | Supported | Roster auto-accept and `/linkme` exist.                                                          |
|  86 | Link a workspace group.                                          | Supported | `/linkworkspace` and workspace links exist.                                                      |
|  87 | Add workspace task from group chat.                              | Supported | Workspace route exists; should still be regression-tested after recent fixes.                    |
|  88 | Assign a task to teammate by name.                               | Partial   | Workspace members are injected; assignee resolution needs tests.                                 |
|  89 | Add a workspace event.                                           | Supported | Workspace event scoping exists.                                                                  |
|  90 | Find a meeting time with teammates.                              | Supported | `/schedule` and slot ranking exist.                                                              |
|  91 | Run standup summary.                                             | Supported | `/standup` exists.                                                                               |
|  92 | Run weekly workspace recap.                                      | Supported | `/recap` exists.                                                                                 |
|  93 | Comment on a workspace task.                                     | Supported | `/comment <task> :: <text>` exists.                                                              |
|  94 | Review workspace blockers and next moves.                        | Partial   | `/review` exists; workspace-specific review quality depends on context hydration.                |
|  95 | Use Telegram supergroup topics as separate project threads.      | Not built | No topic/thread-specific routing visible.                                                        |
|  96 | Onboard a new Telegram user safely.                              | Partial   | Link codes exist; setup UX and diagnostics can improve.                                          |
|  97 | Diagnose webhook/bot health.                                     | Supported | Telegram diagnostics exist, but should cover permission/privacy more deeply.                     |
|  98 | Manage approval inbox.                                           | Supported | `/approvals`, inline approvals, pending queue exist.                                             |
|  99 | Avoid accidental duplicate actions from old group history.       | Gap       | This is the reported replay bug; needs deterministic latest-turn guard.                          |
| 100 | Enforce privacy/security for group actions.                      | Partial   | User mapping and callback ownership checks exist; group mode/privacy diagnostics need more UX.   |

## Coverage Summary

Approximate state across the 100 use cases:

- Supported: 55
- Partial: 32
- Gap: 12
- Not built: 1

The assistant can already handle the majority of classic personal-assistant work in Telegram. The missing pieces are mostly about turning Telegram into a polished product surface: feedback loops, subscriptions, content workflow commands, group safety, and deterministic replay protection.

## Key Gaps By Theme

### 1. Voice Is Capable, But Needs Trust Guarantees

Current implementation transcribes Telegram voice/audio, persists transcript metadata, echoes "Heard", and injects the transcript into the normal text path. That is the right architecture. The product expectation is stricter: after a user sends a voice command, Dori must either act, ask a clear follow-up, or say why it did not act. A transcript echo alone feels broken.

Recommended improvements:

- Add an invariant: every actionable voice note must produce one of `executed`, `queued`, `clarification`, or `not actionable`.
- Add German/English voice fixture tests for tasks, calendar, shopping, and approvals.
- For low confidence transcripts, ask for confirmation before mutating data.
- Let users correct transcript text with "No, I meant ..." and retry the original intent.

### 2. Emoji Feedback Is Underused

Telegram users naturally reply with ✅, 👍, ❌, 👎, ❤️, 😂, 👀, or 🔁. Today the system handles a few as yes/no confirmation, but not as a wider interaction layer.

Recommended improvements:

- Add `message_reaction` to allowed updates if supported by the deployed Bot API path.
- Map emoji feedback to product semantics:
  - 👍 / ✅: approve, like, useful, more like this
  - 👎 / ❌: reject, dismiss, less like this
  - ❤️: save/favorite
  - 👀: remind me to review
  - 🔁: regenerate
  - 🧠: remember this
- Store feedback events with source message id, surface, content type, and action id.
- Use feedback for news ranking and Content Studio idea preferences.

### 3. News Needs Topic Control And Personalization In Telegram

The news generator is solid: it uses Gemini with Google Search grounding, recent-news constraints, and URL validation. Telegram exposes voice news summary, and core chat can use web search for current questions. The missing product layer is user control.

Recommended improvements:

- Add `/news` and `/news voice` with optional topic arguments:
  - `/news ai startups`
  - `/news germany economy`
  - `/news voice product launches`
- Add `/news follow <topic>` and `/news unfollow <topic>`.
- Add `/news settings` for time, language, region, max items, sources, and blocked topics.
- Let users react to stories with 👍/👎 to tune ranking.
- Add "why this matters to me" using user profile, businesses, projects, and interests.

### 4. News-To-Content Is The Biggest Creator Opportunity

Content Studio can already generate current and evergreen ideas, then turn liked ideas into scripts, captions, hashtags, thumbnails, and platform variants. Telegram should expose that loop directly.

Recommended Telegram workflow:

1. User: `/ideas ai startups`
2. Dori: sends 5 compact idea cards.
3. Buttons per idea: `Like`, `Dismiss`, `Script`, `Schedule`.
4. User taps `Script`.
5. Dori asks format: `Short`, `Long`, `Both`.
6. Dori returns hook, script, caption, hashtags, and shot list.
7. Buttons: `Shorter`, `Punchier`, `Schedule`, `Save`.

This would turn Telegram into a creator command center rather than just a notification channel.

### 5. Group Safety And History Replay Are Product-Critical

Family/workspace groups are high value but risky. Users paste long text, chat casually, reply with pronouns, and expect the assistant to know when not to act. The reported duplicate confirmations show that prompt-only "latest message only" protection is not enough.

Recommended improvements:

- Treat previous group turns as inert context, not instructions.
- Filter mutating tool calls before queue/execution unless grounded in the latest user message.
- Add group behavior modes:
  - Mention-only
  - Action-detect
  - Slash-only
- Add diagnostics for whether the bot can actually see ordinary group messages.
- Add topic/thread scope before supporting supergroups deeply.

## Prioritized Backlog

### P0: Reliability And Trust

1. Fix voice transcript action execution in groups.
2. Add deterministic latest-turn guard to stop old confirmations.
3. Add Telegram replay/voice fixtures for German and English.
4. Make every voice note end in one clear outcome: acted, queued, clarified, or ignored with reason.

### P1: News And Creator Workflows

5. Add `/news [topics]`, `/news voice [topics]`, `/news follow`, `/news settings`.
6. Add Telegram idea cards backed by Content Studio.
7. Add idea feedback buttons: like, dismiss, script, schedule.
8. Add "turn news into content ideas" command.
9. Add emoji feedback storage for news and content ideas.

### P2: Group Productization

10. Add group mode settings: mention-only, action-detect, slash-only.
11. Add permission/privacy diagnostics.
12. Add workspace Telegram setup UX.
13. Add supergroup topic/thread support if target users use Telegram topics.

### P3: Assistant Polish

14. Add correction flow for voice transcripts.
15. Add "send audio summary" button for long answers.
16. Improve German copy for news, confirmations, and content workflows.
17. Add personalized "why this matters" for news and creator ideas.

## Suggested Metrics

- Voice note action completion rate.
- Voice note clarification rate.
- Transcript correction rate.
- Old-action replay incidents.
- Approval accept/reject rate.
- News open/click/reaction rate.
- Content idea like/dismiss/script rate.
- Telegram command usage by category.
- Group false-positive action rate.
- Time from message to first useful response.

## Conclusion

DarAI/Dori can already support a surprisingly broad Telegram assistant surface. The platform has enough primitives for real daily use: voice capture, tasks, calendar, reminders, family/workspace groups, approvals, news, and content generation. The gaps are now product-integration gaps rather than "the AI cannot do it" gaps.

The highest leverage next step is to make Telegram interactions deterministic and feedback-aware: voice must act reliably, old context must never create new actions, emoji/buttons should teach preferences, and news/content workflows should become first-class Telegram commands.
