
The user wants a strategic audit: what life-data categories are missing so Dori can be maximally useful. Read-only — propose, don't build. I already explored the codebase recently (see `.lovable/plan.md` for family-data gap analysis) and have strong context on existing modules from memory index.

## What DarAI already tracks well
Tasks, events, calendar (now multi-provider), contacts/CRM, contracts/subscriptions, family members (basic), email, health (Apple Health metrics), habits/goals, mood/energy/sleep check-ins, focus sessions, notes, cooking/meals, Islam suite, gamification, weekly reviews, patterns, automation rules, life score, Telegram family group.

## What's missing — categorized by life domain

---

# Life-Data Gaps for Dori

## 1. Finances (biggest gap — almost nothing tracked)
- **Bank accounts & balances** (read-only via Plaid/GoCardless/Tink)
- **Income streams** (salary, dividends, royalties — Medieval Empires, OYA, ElevenLabs)
- **Expense tracking** (auto-categorized from bank feed)
- **Budgets per category** (groceries, dining, travel)
- **Net worth** (assets - liabilities snapshot)
- **Investments** (stocks, crypto, real-estate value)
- **Tax docs & deadlines** (German Steuererklärung, UAE filings)
- **Recurring bills** beyond contracts (utilities tracked separately)
- **Savings goals** (kids' college, house, sabbatical)
- **Receipts** (photo → OCR → expense)

## 2. Work & Business (you have 3 companies — barely modeled)
- **Companies/ventures** (Medieval Empires, OYA Play, ElevenLabs as first-class entities)
- **Per-company contacts, tasks, contracts, finances** (tag/scope existing data)
- **Investors & cap table** (rounds, ownership, board)
- **Team/employees per company** (org chart, comp, reviews)
- **OKRs / KPIs per company**
- **Revenue & burn dashboards**
- **Meeting notes & decisions log** (notes exist — link to companies)
- **Pitch decks & legal docs library**
- **Travel for work** (trip planner, expensable)

## 3. Travel (you fly Mönchengladbach ↔ Dubai often)
- **Trips** (dates, purpose, family travelling)
- **Flights, hotels, car rentals** (PNR, confirmations — auto-parse from email)
- **Visas, passports, ESTAs** (expiry → already in family plan)
- **Loyalty programs** (Miles & More, Emirates Skywards, hotel chains)
- **Packing lists** (templated by trip type)
- **Per-country essentials** (plug type, embassy, emergency #, currency)
- **Travel companions** (link to family/contacts)

## 4. Properties & Assets
- **Properties** (home Mönchengladbach, Dubai apt?, rentals)
- **Per-property: address, mortgage, insurance, utilities, maintenance log, warranties**
- **Vehicles** (car, bike — service, insurance, tax, fuel log)
- **Valuables/inventory** (electronics, jewelry — for insurance claims)
- **Subscriptions to physical things** (gym, magazines)

## 5. Personal Health (deeper than current Apple Health pull)
- **Medications** (you, not just kids — dose, refill)
- **Doctors & specialists** (dentist, GP, optician — last/next visit)
- **Lab results history** (cholesterol, vitamin D, blood sugar)
- **Allergies, conditions, surgeries**
- **Therapy/coaching sessions** (notes, takeaways)
- **Fitness plan & workouts** (sets, reps, PRs)
- **Nutrition log** (calories/macros if user opts in)
- **Mental health journal** (private, encrypted)
- **Female cycle tracking** (for spouse if shared)

## 6. Relationships (CRM exists but shallow)
- **Birthdays & anniversaries** (with auto gift suggestions + budget)
- **Interaction log** ("last spoke March 12 — about kids' school")
- **Relationship tier follow-up cadence** (already exists — extend)
- **Gift history** (what given, when, reaction)
- **Friend groups & circles** (school parents, founders, mosque, family)
- **Conflict/sensitive notes** (private — "don't bring up X")

## 7. Learning & Growth
- **Books reading list** (queue, current, finished + notes)
- **Courses** (in-progress, certifications)
- **Podcasts/articles saved**
- **Skills tracker** (want to learn Arabic to X level)
- **Languages practiced** (German daily, Arabic 2x/week)
- **Quotes & ideas captured**

## 8. Memories & Journal
- **Daily journal** (free-form, AI-prompted)
- **Photos auto-tagged with people/places** (link to family)
- **Milestones** (kids' first words, business launches)
- **Annual review answers** (recurring)
- **Bucket list & life goals**

## 9. Spiritual (Islam suite exists — extend)
- **Quran reading progress** (already partial)
- **Sadaqah / Zakat log** (charitable giving with tax category)
- **Hajj/Umrah planning**
- **Islamic calendar events linked to family** (Eid prep, Ramadan meal plans)

## 10. Daily Operations
- **Shopping inventory** (what's in fridge/pantry — AI re-orders)
- **Wardrobe** (outfits, what fits, weather-aware suggestions)
- **Personal care schedule** (haircut every 4w, dentist 6mo)
- **Plant/pet care** (in family plan)
- **Errands log** (one-off "pick up at post office")

## 11. Digital Life
- **Password manager integration** (1Password/Bitwarden — not store, just remind)
- **Subscription audit** (extend contracts — flag unused)
- **Device inventory** (laptop, phone — warranty, AppleCare expiry)
- **Important account recovery info** (emergency access for spouse)

## 12. Civic & Legal
- **ID renewals** (driver's license, residence permit — DE Aufenthaltstitel)
- **Voting / civic dates**
- **Will & estate docs** (location pointer, executor)
- **Legal contracts non-business** (rental agreement, prenup)

---

# Highest-ROI Build Batches

**Batch 1 — Finances Core** (biggest unlock for productivity + ADHD relief)
Tables: `accounts`, `transactions`, `budgets`, `financial_goals`, `receipts`
Bank-feed connector (Plaid EU / GoCardless), AI categorization, monthly review thread.

**Batch 2 — Companies/Ventures** (you run 3 — turn DarAI into founder OS)
Tables: `companies`, scope existing contacts/tasks/contracts/events to company_id, KPI dashboards per company.

**Batch 3 — Travel Hub**
Tables: `trips`, `flights`, `accommodations`, `loyalty_programs`, `travel_docs`
Email auto-parse for confirmations, packing-list templates, trip-prep checklist 7d before.

**Batch 4 — Properties & Vehicles**
Tables: `properties`, `vehicles`, `maintenance_log`, `inventory_items`
Auto-alert on service due, insurance renewal, warranty expiry.

**Batch 5 — Personal Health Deep-Dive** (extends Apple Health)
Tables: `medications`, `doctors`, `lab_results`, `health_appointments`
Refill alerts, lab-trend charts.

**Batch 6 — Relationships Plus**
Birthdays/anniversaries auto-import, interaction log, gift tracker.

**Batch 7 — Learning, Memories, Civic** (lower urgency, high delight)

---

# Recommendation

Start with **Batch 1 (Finances)** — single biggest missing domain, unlocks budgeting + tax + business cashflow + family spending visibility in one shot. Combined with Batch 2 (Companies), DarAI becomes a true *founder + family OS*.

**Reply with: "go 1" / "go 1+2" / "go all" / pick specific items.**
