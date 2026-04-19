
The user wants the proactive assistant (Telegram nudges, voice briefings) to be **multi-profile aware** when a family/space has multiple connected accounts (e.g., spouses). When health, email, or any person-specific data triggers a nudge, Dori must **explicitly name the person** ("Sarah has 3 unread important emails", "Asad's sleep was only 5h last night").

## Current state (verified via memory + recent edits)
- `dori-proactive` runs per-user. Email action items, prayer reminders, birthdays — all scoped to single `user_id`.
- Spouses link via **space sharing** (`space_members` + `space_share_settings`) and via **Family Telegram group** (`mem://features/telegram-family-shared-assistant`).
- Profiles store `display_name`. Health data lives in per-user health tables; emails in per-user gmail tables.
- Telegram family group: a shared `chat_id` where messages from Dori currently lack person attribution when the data crosses members.

## Gap
When Dori posts to the **shared family Telegram chat**, it currently speaks as if for one user. If both spouses are connected, a message like "You have 3 important emails" is ambiguous. Same for health ("Sleep was poor") and birthdays ("Mom's birthday next week" — whose mom?).

## Plan — Person-attributed proactive messaging

### 1. Resolve the "family group" → list of connected members
Add a helper in `dori-proactive/index.ts`:
```
getFamilyGroupMembers(groupId) → [{ user_id, display_name, telegram_user_id }]
```
Source: `family_agent_members` (existing table per memory) joined with `profiles`.

### 2. Refactor proactive triggers to iterate per-member, then aggregate
For each shared-Telegram-group nudge cycle:
- **Email action items**: loop members → collect per-person digest → post one combined message:
  > 📧 *Action items*  
  > **Asad**: 2 todos, 1 payment  
  > **Sarah**: 1 question awaiting reply
- **Health alerts** (low sleep, missed workouts, abnormal metrics): always prefix with name.
  > 💤 **Sarah** slept 4h 30m — consider a lighter day.
- **Birthdays**: include whose contact it is.
  > 🎂 Next week is **Oma Müller**'s birthday (Sarah's mom).
- **Prayer reminders**: keep generic (shared) — no name needed.
- **Evening dua**: generic.

### 3. Personal (DM) channel stays single-user
If a user has a private Dori chat (not the family group), keep current behavior — no name prefix needed.

### 4. New helper: `formatPersonAttributedMessage(items, members)`
Single utility that:
- Groups items by `owner_user_id`
- Looks up `display_name` from members map
- Builds markdown with bold names
- Falls back to "You" when only one member present (preserves current UX for solo users)

### 5. Voice briefing parity
Update `morning-briefing` edge function similarly: when family context has 2+ connected adults, the briefing text mentions names ("Sarah has a dentist appointment at 10am, Asad has 3 priority emails"). Reuses same member-resolution helper (extract to shared util or duplicate — Edge Functions can't share imports easily, so duplicate the small helper).

### 6. Settings
No new settings needed — behavior auto-activates when `family_agent_members` has ≥2 accepted members linked to a Telegram group.

## Files to change
- `supabase/functions/dori-proactive/index.ts` — add member resolver, refactor `emailActionItems`, `birthdayReminders`, and any health alert paths to be person-attributed when posting to shared family chat.
- `supabase/functions/morning-briefing/index.ts` — name-aware phrasing when 2+ connected members in same household.
- (No DB migration, no UI changes.)

## Out of scope
- Building new health-alert triggers (only attribute existing ones).
- Changing solo-user experience.
- Per-person mute/opt-out (can be a follow-up).
