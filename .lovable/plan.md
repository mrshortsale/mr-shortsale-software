

# Goal

Transform the prototype from "Phase 1 lite" into a **Phase 1 + Phase 2 combined experience** — so when Cristina logs in, she sees what her business will actually feel like 8 weeks from now: AI-researched leads, urgency scoring, live activity, prior contact intelligence, and rich interactive workflows everywhere.

# What's missing today (the "demo gap")

Right now the prototype shows the structure but feels static:
- Lead cards don't fully show AI research (only basic script)
- No urgency scoring 1–10 visible
- No "prior contact history" surfaced
- Pipeline kanban isn't draggable, case detail is thin
- No live activity feel (no incoming leads, no real-time counters)
- AI inbound transcripts are short
- No SMS conversation thread
- No lead detail drill-down for the CEO
- Team performance is just bars — no drill-down per agent
- No "AI is working" moments (the magic Cristina is paying for)

# What we'll build

### 1. Rich AI Research Panel (Lead detail)
Expand every lead card click into a full **right-side drawer** (not just inline) with all 6 sections from the spec, beautifully rendered:
- **Property summary** — beds/baths/sqft/year/value/mortgage/equity with mini visual
- **Data verification** — Realie ✓ / BatchData ✓ / ATTOM ✓ row with timestamps + any flagged discrepancy
- **Owner profile** — ownership length, purchase price, lender, phone, email
- **Urgency signals** — auction countdown, opening bid, filing chain
- **Prior contact history** — timeline of past touches (some leads "never contacted", some "called 3x, last outcome: callback declined")
- **AI call script** — full personalized script with opening / key points / objection handlers / close
- **Urgency score 1–10** badge at top with color + reasoning ("9/10: 28 days to auction, 8% equity, never contacted")

### 2. Live "Pulse" feel on CEO Dashboard
- Animated counter on "New leads today" that ticks up every ~20 seconds with a toast: *"New lead from Realie.ai: 33 Birch Ln, Yonkers — 14% equity"*
- Live "AI Activity" ticker strip showing recent automated actions: *"AI cross-verified 3 leads via ATTOM · 2m ago"*, *"AI scored 12 leads · 5m ago"*, *"Twilio sent SMS to Robert Chen · 8m ago"*
- "Calls completed" updates if the rep logs a call in another tab

### 3. Pipeline Case Detail Drawer
Click any case in kanban → drawer opens with:
- Timeline of milestones (offer received, BPO ordered, bank submitted, etc.)
- Documents checklist (Hardship Letter ✓, Bank Statements ✓, Tax Returns ☐, Pay Stubs ☐)
- Bank contact + negotiator name + last contact date
- Attorney info
- Activity log (notes from Cristina/agents)
- Days in stage indicator

### 4. SMS Conversation Threads
For leads with `sms_sent`, clicking the SMS badge opens a chat-style modal showing the bilingual SMS thread (auto-sent message + any homeowner reply), with status: delivered / read / replied.

### 5. Team Performance drill-down
Click any agent bar → modal with that agent's:
- Last 7 days call trend (line chart)
- Best time-of-day to connect
- Connection rate by filing type
- Top 5 recent qualified leads they passed up

### 6. Enhanced AI Inbound Call detail
Expand each inbound call row into full transcript view with:
- Turn-by-turn AI ↔ caller dialogue (10–15 lines per call, realistic Spanish/English)
- Structured data extracted panel (name, address, mortgage status, callback time)
- "Lead created" link if applicable → jumps to that lead
- Audio waveform mock + play button (visual only)

### 7. Rep Dashboard upgrades
- **Urgency score badge** on every lead card (color-coded 1–10)
- **"AI Researched ✓"** green checkmark badge when research is ready
- **"Prior contact"** amber badge with hover tooltip on leads previously called
- Lead queue **filter/sort**: by urgency, days to auction, equity, language, status
- Mini "Today" stats banner at top: *"You: 4 calls, 2 connected, 1 qualified · Goal: 12 calls"*

### 8. New Data: enrich seed data
- Add `urgency_score` (1–10) to all 50 leads
- Add `prior_contact_history` array to ~30% of leads (1–3 past touches each)
- Add `bank_negotiator`, `documents_checklist`, `milestones[]`, `activity_log[]` to all 12 pipeline cases
- Add `sms_thread` (2–4 messages) to leads with `sms_sent`
- Expand AI inbound transcripts from 1 line to full 10–15 line dialogues
- Add `ai_activity_feed` array (20+ recent automated actions with timestamps)

### 9. Roadmap update
Update `RoadmapView.tsx` to mark **Phase 2 as "Live in Demo"** so Cristina understands the prototype already shows the 8-week vision, not just week 4.

# Files

**New:**
- `src/components/shared/LeadDetailDrawer.tsx` — full AI research drawer
- `src/components/shared/SMSThread.tsx` — chat-style SMS modal
- `src/components/ceo/CaseDetailDrawer.tsx` — pipeline case detail
- `src/components/ceo/AgentDrillDown.tsx` — agent performance modal
- `src/components/ceo/AIActivityTicker.tsx` — live AI activity strip
- `src/components/ceo/LiveLeadFeed.tsx` — incoming lead simulator hook + toast
- `src/data/activity.ts` — AI activity feed seed data
- `src/data/sms.ts` — SMS thread seed data
- `src/hooks/useLiveSimulation.ts` — interval-based "new lead" + counter ticking

**Edited:**
- `src/data/leads.ts` — add urgency_score, prior_contact_history, expand records
- `src/data/pipeline.ts` — add negotiator, docs, milestones, activity log
- `src/data/calls.ts` — expand AI inbound transcripts to full dialogues
- `src/components/rep/LeadQueue.tsx` — wire to new drawer, add filters/sort, urgency badges
- `src/components/rep/ActiveCall.tsx` — pull richer script from new research data
- `src/components/ceo/MorningBriefing.tsx` — add live ticker, animated counters, AI activity strip
- `src/components/ceo/PipelineBoard.tsx` — wire case detail drawer
- `src/components/ceo/TeamPerformance.tsx` — wire agent drill-down
- `src/components/ceo/AIInboundCalls.tsx` — full transcript expansion
- `src/components/ceo/RoadmapView.tsx` — mark Phase 2 deliverables as live in demo
- `src/contexts/AppContext.tsx` — add live simulation state + selectedLeadId for drawer

# Design notes

- All drawers: right-side slide-in (using existing `Sheet` component), 480–560px wide, brand navy header
- Urgency score colors: 1–3 muted gray, 4–6 amber, 7–8 orange, 9–10 red pulsing
- AI Activity ticker: monospace, soft animated fade-in per new line, max 5 visible
- Live toast: bottom-right, navy with Realie/BatchData logo dot, auto-dismiss 4s
- All new interactive elements respect the existing brand palette — no new colors

# Out of scope

- Real backend / persistence (still all in-memory seed data)
- Phase 3 features (24/7 AI voice agent UI is already mocked, won't expand further)
- Drag-and-drop on kanban (can add later if she asks)
- Mobile redesign of new drawers (they'll be responsive but designed primarily for desktop demo)

