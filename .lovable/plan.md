# Telegram Assistant — Round 3 (50 new scenarios)

50 fresh scenarios (no overlap with Rounds 1-2), grouped by area. After each block, ✅ = already covered, ⚠️ = partial, ❌ = missing. Implementation focuses only on the gaps.

## The 50 scenarios

### Calendar & time intelligence (1-7)
1. "When's my next free 2-hour block this week?" — ⚠️ `/free` only finds 30-min slots; duration is hardcoded.
2. "Block 9-11 every weekday for deep work" — ❌ no recurring-block creator.
3. "Reschedule everything from Friday to Monday" — ⚠️ `bulk_reschedule` exists for tasks, not events.
4. "What did I have last Tuesday?" — ❌ no past-date agenda lookup.
5. "How many hours of meetings do I have this week?" — ❌ no meeting-load summary.
6. "Add 30 min travel buffer before tomorrow's dentist" — ❌ no buffer/travel-time tool.
7. "Cancel my 3pm" — ⚠️ works only with title; ambiguous time-only references not resolved.

### Tasks & productivity (8-14)
8. "Snooze all today's tasks to tomorrow" — ⚠️ `bulk_reschedule` exists but no `snooze_all_today` shortcut.
9. "What's blocked?" — ❌ no `status='blocked'` query.
10. "Show me tasks tagged #invoice" — ❌ no tag filter via TG.
11. "Estimate this task at 45 min" — ❌ no estimate field update tool.
12. "Mark task done with note 'paid via SEPA'" — ⚠️ complete works, but no completion comment.
13. "Show what I finished this week" — ❌ no /done command.
14. "Convert this note to a task" — ❌ no note→task conversion tool.

### Shopping & meals (15-19)
15. "Move 'milk' from shopping to dairy section" — ❌ no category/aisle field tool.
16. "What's on the shopping list under €10?" — N/A (prices not tracked).
17. "Plan dinners for next week using what's in the fridge" — ⚠️ `meal_plan` tool exists; pantry inventory not modeled.
18. "Add the ingredients of 'lasagna' to shopping" — ❌ recipe→shopping not wired through TG.
19. "What's for dinner tonight?" — ❌ no `/menu` shortcut.

### Money, contracts, expenses (20-24)
20. "How much do my subscriptions cost per month?" — ✅ `manage_contract` action `get_costs`.
21. "Cancel my Netflix" — ⚠️ marks as cancelled in DB but no draft cancellation email.
22. "Log €23.50 lunch expense" — ❌ no expense-logging tool (only contracts).
23. "What did I spend on groceries this month?" — ❌ no expense aggregation.
24. "Remind me 30 days before any contract auto-renews" — ⚠️ contracts tracked, but no automatic reminder generation on add.

### Health, habits, wellbeing (25-30)
25. "Log 8000 steps today" — ❌ `log_wellbeing` covers mood/sleep/water/exercise but not steps explicitly.
26. "How's my mood trended this month?" — ❌ no aggregate query.
27. "Start my morning routine" — ❌ no routine/sequence trigger.
28. "Log period started today" — ❌ no menstrual cycle tracking.
29. "Remind me to take meds at 8am daily" — ⚠️ recurring reminders not first-class via TG.
30. "Did I hit my water goal yesterday?" — ❌ no goal-vs-actual comparison.

### Family & household (31-35)
31. "Whose turn is it to take out the trash?" — ⚠️ `/chores` lists chores but doesn't show rotation.
32. "Assign 'pick up Lina' to my partner" — ⚠️ task creation works but no assignee field exposed in tool.
33. "What did Sarah do today?" — ⚠️ partial — `manage_task` queries are per-user; no per-member day digest.
34. "Send 'on my way' to my partner via app message" — ❌ no in-app message tool from TG.
35. "Who's home tonight?" — ❌ no presence/availability concept.

### Email (36-39)
36. "Summarize my unread emails" — ⚠️ `/inbox` lists; no AI summary.
37. "Unsubscribe me from this sender" — ❌ no unsubscribe action.
38. "Forward the latest invoice from Vodafone to my accountant" — ❌ no forward tool.
39. "Star this email" — ❌ no star/flag action.

### Notes, knowledge, search (40-43)
40. "Search my notes for 'visa interview'" — ✅ `/notes <query>`.
41. "Read me my note from yesterday's meeting" — ⚠️ search works; voice playback of note content not wired.
42. "What did I say about the apartment last week?" — ❌ no semantic search across history.
43. "Save this voice memo as a journal entry" — ⚠️ append_note exists; no auto-target to "Journal" note.

### Travel & location (44-46)
44. "What's the weather in Berlin tomorrow?" — ⚠️ `web_search` can answer; no first-class weather tool.
45. "Add 'Dubai trip' as an upcoming trip with 3 packing tasks" — ❌ no trip/template generator.
46. "Remind me to check in for my flight 24h before" — ❌ no flight-aware reminder.

### Islam (47-48)
47. "When's the next prayer?" — ✅ `/prayers`.
48. "Add a fasting day on Monday" — ❌ no fasting log.

### Misc UX (49-50)
49. "Show me Dori's last 5 actions" — ❌ no `/recent` history.
50. "Switch language to German" — ⚠️ Dori auto-mirrors but no explicit `/lang` command.

## Audit summary
- ✅ fully working: 4 (20, 40, 47, +chat free-text variants)
- ⚠️ partial: 17
- ❌ missing: 29

## Implementation plan (gap fixes only)

To keep scope reasonable, implement the highest-leverage fixes that touch many scenarios. Defer the niche ones (28 menstrual, 35 presence, 46 flights, 48 fasting) — note them in HELP_TEXT as "coming soon" or skip.

### A. New tools in `dori-tools.ts` + executors in `chat/index.ts`
1. **`log_expense`** — `{amount, currency, category, note, date?}` → insert into `expenses` table (create if missing). Covers 22, 23.
2. **`query_expenses`** — `{period, category?}` aggregate. Covers 23.
3. **`block_time`** — `{title, start_time, end_time, recurrence?, days_of_week?}` creates a recurring calendar block via `events` with RRULE. Covers 2.
4. **`bulk_reschedule_events`** — extend bulk tool to accept `entity:'event'`. Covers 3.
5. **`assign_task`** — extend `manage_task` add/update to accept `assignee` (resolves email/name to user_id within household). Covers 32.
6. **`tag_filter`** — extend `manage_task` `search` action with `tag` and `status` ('blocked'). Covers 9, 10.
7. **`update_task_estimate`** / **completion_note** — extend `manage_task` update/complete. Covers 11, 12.
8. **`note_to_task`** — extend `append_note`-style tool with `convert_to_task`. Covers 14.
9. **`recipe_to_shopping`** — `{recipe_name|recipe_id}` → expand ingredients to shopping list. Covers 18.
10. **`weather`** — `{location, when}` → call open-meteo (no key) inside the tool. Covers 44.
11. **`trip_template`** — `{destination, start, end, packing?:bool}` → creates trip event + N packing tasks. Covers 45.
12. **`recurring_reminder`** — extend `set_reminder` with `recurrence`. Covers 29.
13. **`steps_log`** — extend `log_wellbeing` with `steps`. Covers 25.
14. **`wellbeing_summary`** — `{metric, period}` aggregate from `daily_checkins` / `mood_logs`. Covers 26, 30.
15. **`email_action`** — extend `manage_email` with actions `summarize` (uses LOVABLE_API_KEY+gemini-flash on subject+snippet), `unsubscribe` (mailto:list-unsubscribe), `forward`, `star`. Covers 36-39.
16. **`recent_actions`** — query `dori_undo_log` for the user's last 5 mutations. Covers 49.
17. **`set_language`** — `{lang:'de'|'en'}` updates `profiles.locale`. Covers 50.
18. **`contract_cancel_email`** — when `manage_contract` sets cancelled, auto-call `compose_email` with provider's address. Covers 21.
19. **`contract_renewal_reminder`** — on contract create with `renewal_date`, auto-create a reminder 30 days before. Covers 24.

### B. Telegram-router shortcuts (`telegram-router/index.ts`)
- `/free <duration>` — accept duration arg (default 30); Covers 1.
- `/agenda <date>` — past or future date lookup. Covers 4.
- `/load` — meeting hours this week per member. Covers 5.
- `/snooze` — bulk snooze today's tasks to tomorrow. Covers 8.
- `/done` — completed tasks since Monday. Covers 13.
- `/menu` (today's planned meal) — pulls from `meal_plans`. Covers 19.
- `/expense <amount> <category> [note]` — direct insert via `log_expense`. Covers 22.
- `/spent <category> [period]` — calls `query_expenses`. Covers 23.
- `/weather [city]` — calls weather tool. Covers 44.
- `/lang de|en` — calls `set_language`. Covers 50.
- `/recent` — calls `recent_actions`. Covers 49.
- `/whoseturn <chore>` — rotation logic on `chores` table. Covers 31.

### C. System prompt updates (`chat/index.ts`)
- Document new tools and tags (`<expense>`, `<weather>`, `<trip>`, `<lang>`).
- Update XML-strip regex to swallow new tags so they don't bleed to user.
- Add few-shot for "what's blocked?", "log €23 lunch", "trip to Dubai", "weather Berlin tomorrow".

### D. Help & registration
- Update `HELP_TEXT` with the new commands, grouped under existing sections.
- Update `telegram-register-commands/index.ts` with new slash commands so the Telegram client autocompletes them.

### E. Database migrations
- New table `expenses` (id, user_id, amount, currency, category, note, occurred_at, created_at) with RLS (user-owned + space-shared via existing pattern).
- Optional `task_completion_notes` column on `tasks` (or reuse `comments`); prefer adding `completion_note text` column to `tasks`.
- Add `assignee_id uuid` to `tasks` if not present (check first; many sharing tables already exist).

## Files to edit
- `supabase/functions/_shared/dori-tools.ts` — add new tool definitions.
- `supabase/functions/chat/index.ts` — add executors, update system prompt + regex.
- `supabase/functions/telegram-router/index.ts` — add new shortcuts.
- `supabase/functions/telegram-register-commands/index.ts` — register commands + update help.
- New migration: `expenses` table + RLS, optional `tasks.completion_note`/`assignee_id`.

## Out of scope (intentionally skipped)
- 28 menstrual cycle tracking, 35 presence, 46 flight integration, 48 fasting log — niche, would each require their own data models. Will add a one-line note in HELP_TEXT pointing users to free-text Dori for these.
- 16 price-aware shopping — no price field on shopping items.
- 42 semantic history search — would need new embeddings infra; existing `/notes` ILIKE covers most cases.
