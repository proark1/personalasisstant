
User wants all 13 ideas. That's too much for one batch — I'll group into 4 focused batches that build on each other, prioritizing the 3 I recommended + finishing Batch B (family agent) which is already approved.

Plan: present batched roadmap, build Batch 1 immediately after approval, then continue sequentially.

---

# Proactive Intelligence Roadmap — 4 Batches

## Batch 1 — Foundation Intelligence (build first)
**Why first:** unlocks data signals every other batch needs.

1. **Email → Action Pipeline** — After each Gmail sync, Gemini classifies new emails: `bill/invoice` → contract candidate, `meeting request` → event suggestion, `family logistics` → task. Batched into ONE daily digest (Telegram + dashboard card), not 50 pings.
2. **Outcome tracking** — Add 👍/👎 buttons on every proactive message (Telegram inline keyboard + web notifications). Store in `proactive_feedback` table → tune trigger thresholds per user over time.
3. **Conflict Detective** — Cron job (every 30 min) cross-checks calendar+tasks+travel. Flags overlaps, tight transitions, kid-pickup clashes. Posts to action inbox.

## Batch 2 — Anticipatory Layer
4. **Travel Intelligence** — Detect flights/trips from email+calendar → auto-block travel time, surface contacts in destination city, prayer times in new tz, packing reminder.
5. **Energy-Aware Scheduling** — Combine mood/energy logs + calendar density → "low-energy day, move deep work to Thursday" suggestions in morning brief.
6. **Decision Pre-flight** — 30-sec brief auto-generated 15 min before any meeting: who, last contact, open email threads, related contracts, recent notes. Pushed to Telegram + meeting card.

## Batch 3 — Memory & Learning
7. **Auto-learned routines** — Background job analyzes 30-day patterns, proposes automations ("Email Ahmed every Monday 9am — automate?").
8. **Episodic memory** — New `episodic_memories` table stores events with date+location+people. Dori references naturally ("last Dubai trip you met Ahmed at Emirates Towers").
9. **Life-Score commentary** — Dori reads daily Life Score deltas, proactively comments when patterns emerge.

## Batch 4 — Family + Friction Reduction (combines pending Batch B)
10. **Shared Family Agent** (the originally-approved Batch B) — Multi-user Telegram group with combined context.
11. **Spouse Handoff** — Routes household tasks based on real-time availability of both calendars.
12. **Mental Load Tracker** — Counts who handled what household admin, surfaces imbalance.
13. **Unified Morning Thread** — Replaces separate brief+meeting prep+renewals with ONE ranked daily Telegram thread + voice-reply affordance.

---

## Tech Building Blocks (shared across batches)

- **New tables:** `email_classifications`, `proactive_feedback`, `episodic_memories`, `family_agent_members`, `mental_load_log`
- **New edge functions:** `email-classifier`, `conflict-detector`, `travel-intelligence`, `meeting-preflight`, `routine-learner`, `family-router`
- **Cron schedule additions:** every 30 min (conflicts), daily 06:30 (digest), 7d (routine learning)
- **Telegram upgrades:** inline keyboards for feedback, voice-reply transcription pipeline
- **Reuse:** existing `auto_actions_log` (approval gate), `proactive_settings` (toggles), Lovable AI Gateway (Gemini Flash for classification — cheap)

## Execution Plan

I'll build **Batch 1 now** in this turn (3 features). Then ask you to test before moving to Batch 2. Each batch ≈ 6-10 files. Total roadmap ≈ 4 turns.

**Reply "go" to start Batch 1, or pick a different starting batch.**
