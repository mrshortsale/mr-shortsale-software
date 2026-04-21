

# Goal

Add a new **"AI Agents"** section to the CEO sidebar that lets Cristina see — at a glance — every AI agent working inside her business, what each one does, and the impact it has. This makes the "invisible AI" tangible and sellable.

# What we'll build

### 1. New sidebar item: "AI Agents"
Add a new nav item between **AI Inbound Calls** and **Data Sources** in `CEODashboard.tsx`, using the `Bot` icon from lucide-react.

### 2. New page: `AIAgentsRoster.tsx`
A beautifully designed "AI Workforce" page that presents each agent like a team member card. Layout:

**Top hero strip:**
- "Your AI Workforce" headline
- Live counter: *"6 agents active · 1,247 actions taken today · Saved 23.4 hrs this week"*
- Soft pulsing green dot indicating "All systems operational"

**Grid of 6 Agent Cards** — each card shows:
- **Avatar/icon** with brand-colored gradient background (unique color per agent)
- **Agent name** (e.g. "Scout", "Sherlock", "Voice", "Dispatch", "Pulse", "Echo")
- **Role tagline** (e.g. "Lead Hunter", "Research Analyst")
- **Status badge** — Active / Working / Idle with colored dot
- **What I do** — 2-line plain-English description
- **Powered by** — tech stack chips (Realie.ai, GPT-4o, Vapi, Twilio, ATTOM)
- **Today's stats** — 2-3 mini metrics (e.g. "47 leads pulled · 100% verified")
- **Last action** — live-feeling line ("Cross-verified 33 Birch Ln · 2m ago")
- **"See activity →"** button → opens a drawer with that agent's recent log

### 3. The 6 Agents (mapped to actual platform features)

1. **Scout** 🎯 — *Lead Hunter*
   Pulls fresh foreclosure filings from Realie.ai + BatchData every morning at 6 AM. Powered by: Realie.ai, BatchData APIs.

2. **Sherlock** 🔍 — *Research Analyst*
   Cross-verifies every lead against ATTOM, calculates equity, flags discrepancies. Powered by: ATTOM, GPT-4o.

3. **Pulse** ⚡ — *Urgency Scorer*
   Scores every lead 1–10 based on auction date, equity, and prior contact. Powered by: GPT-4o.

4. **Echo** 💬 — *Script Writer*
   Generates personalized bilingual call scripts for every lead in seconds. Powered by: GPT-4o.

5. **Voice** 📞 — *24/7 Receptionist*
   Answers every inbound call in English or Spanish, transcribes, extracts data. Powered by: Vapi, GPT-4o.

6. **Dispatch** 📱 — *Follow-Up Bot*
   Sends bilingual SMS the moment a call goes unanswered. Powered by: Twilio.

### 4. Agent Activity Drawer (`AgentActivityDrawer.tsx`)
Click "See activity" on any card → right-side `Sheet` drawer opens with:
- Agent header with avatar, role, status
- "What I do" expanded explanation (3-4 bullets)
- **Live activity log** — last 15 actions with timestamps (pulled from existing `aiActivityFeed` in `src/data/activity.ts`, filtered/labeled per agent)
- **This week's impact** — small stat block ("Saved 4.2 hours · 312 actions · 100% accuracy")
- **"How it integrates"** — a 1-line flow diagram (e.g. "Realie.ai → Scout → Sherlock → Your Pipeline")

### 5. Cross-link from existing screens
- On `AIInboundCalls.tsx`: small chip *"Powered by Voice agent →"* that navigates to the AI Agents tab
- On `MorningBriefing.tsx` AI Activity ticker: each line gets a tiny agent-name tag (e.g. `[Scout]`, `[Sherlock]`)

# Files

**New:**
- `src/components/ceo/AIAgentsRoster.tsx` — the main agents page
- `src/components/ceo/AgentActivityDrawer.tsx` — per-agent detail drawer
- `src/data/agents.ts` — the 6 agents seed data (id, name, role, color, icon, description, stack, stats, last_action)

**Edited:**
- `src/pages/CEODashboard.tsx` — add nav item + route case for `'ai-agents'`
- `src/data/activity.ts` — tag each activity feed entry with `agent_id` so the drawer can filter
- `src/components/ceo/MorningBriefing.tsx` — show agent tag on ticker lines (small)
- `src/components/ceo/AIInboundCalls.tsx` — add "Powered by Voice agent" link chip

# Design notes

- Cards: rounded-2xl, soft shadow, brand navy header strip with agent's accent color as gradient
- Each agent gets a unique accent (within brand palette): Scout=teal, Sherlock=indigo, Pulse=red/orange, Echo=purple, Voice=blue, Dispatch=green
- Status dots: animated pulse for "Working", solid for "Active", muted for "Idle"
- Drawer matches existing `LeadDetailDrawer` width (≈520px) and styling for consistency
- Fully responsive — cards collapse 3-col → 2-col → 1-col

# Out of scope

- No real agent execution / backend (still seed data + simulated activity)
- No ability to "pause" or "configure" agents (read-only showcase)
- No agent for Phase 3 features beyond what's already shown

