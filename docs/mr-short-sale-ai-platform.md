# Mr. Short Sale — AI Operations Platform

| Field | Value |
|---|---|
| **Project Name** | Mr. Short Sale — AI Operations Platform |
| **Code Name** | `ai-foreclose-pro` |
| **Version** | v1.0.0 (Phase 1 + Phase 2 Combined Demo) |
| **Document Date** | April 29, 2026 |
| **Status** | High-fidelity interactive prototype |
| **Owner** | BuildYourAI Consulting |
| **Client** | Cristina — Mr. Short Sale (Westchester / Bronx / Queens) |
| **Live Demo** | https://mrshortsale.buildyourai.consulting |

---

## 1. Executive Summary

Mr. Short Sale is an **AI-powered foreclosure lead-generation and short-sale operations platform** built for a boutique real-estate brokerage operating in Westchester, the Bronx, and Queens.

The platform replaces a fragmented manual workflow (county clerk scraping, spreadsheet research, cold-call dialing, missed inbound calls) with an **autonomous AI workforce of 6 specialized agents** that pull, verify, score, script, answer, and follow up on every foreclosure opportunity — 24/7, in English and Spanish.

**Core value proposition:** *"You wake up to a curated list of qualified, equity-verified, urgency-scored leads — with bilingual scripts already written and after-hours calls already answered."*

---

## 2. Target Users & Roles

| Role | Persona | Primary Screens |
|---|---|---|
| **CEO** | Cristina — owner / operator. Wants pipeline visibility, team performance, and ROI proof. | Morning Briefing, Pipeline Board, Team Performance, AI Inbound Calls, AI Agents, Data Sources, Roadmap, Presentation |
| **Sales Rep** | Maria, James, Luis — bilingual closers. Wants the next best lead and a script ready. | Lead Queue, Active Call, Call History, Rep Stats |

Authentication is a simplified one-click prototype login (`AuthContext`) — no backend auth in v1.

---

## 3. Product Pillars

1. **Triple-Source Lead Intelligence** — Realie.ai + Batch Leads API + ATTOM cross-verification.
2. **Autonomous AI Workforce** — 6 named agents with explainable behavior.
3. **Bilingual by Default** — every voice and SMS interaction supports EN/ES.
4. **Urgency-First Workflow** — explainable 1–10 scoring on every lead.
5. **Live Operations Feel** — simulated real-time activity ticker, toasts, counters.

---

## 4. Feature Map

### 4.1 CEO Dashboard

| # | Feature | File | Description |
|---|---|---|---|
| 1 | **Morning Briefing** | `src/components/ceo/MorningBriefing.tsx` | Hero KPIs, animated counters, AI activity ticker, top priority leads. |
| 2 | **Short Sale Pipeline** | `src/components/ceo/PipelineBoard.tsx` | Kanban of cases (Lead → Listed → Offer → Bank Review → Approved → Closed). Click → `CaseDetailDrawer`. |
| 3 | **Team Performance** | `src/components/ceo/TeamPerformance.tsx` | Per-rep stats; click → `AgentDrillDown` with 7-day trend, best-connect-time, connection rate by filing type (Recharts). |
| 4 | **AI Inbound Calls** | `src/components/ceo/AIInboundCalls.tsx` | Vapi mock transcripts, waveform, structured data extraction, EN/ES detection. |
| 5 | **AI Agents** | `src/components/ceo/AIAgentsRoster.tsx` | 6-agent roster with status, stats, last action; click → `AgentActivityDrawer`. |
| 6 | **Data Sources** | `src/components/ceo/DataSources.tsx` | Realie / Batch Leads API / ATTOM connection health and sync logs. |
| 7 | **Roadmap** | `src/components/ceo/RoadmapView.tsx` | Phase 1 + 2 marked **Live in Demo**; Phase 3 forward-looking. |
| 8 | **Presentation Mode** | `src/components/ceo/Presentation.tsx` | Sales-deck view for showing the platform to investors / partners. |

### 4.2 Rep Dashboard

| # | Feature | File | Description |
|---|---|---|---|
| 1 | **Lead Queue** | `src/components/rep/LeadQueue.tsx` | Urgency-sorted list; click → `LeadDetailDrawer`. |
| 2 | **Active Call** | `src/components/rep/ActiveCall.tsx` | Auto-loaded bilingual script, live note-taking. |
| 3 | **Call History** | `src/components/rep/CallHistory.tsx` | Past calls with outcomes and SMS threads. |
| 4 | **Rep Stats** | `src/components/rep/RepStats.tsx` | Personal KPIs and trend charts. |

### 4.3 Shared Components

- `LeadDetailDrawer.tsx` — property + owner intel, equity %, urgency reasoning, multi-source verification, prior contact log.
- `SMSThread.tsx` — bilingual Twilio thread mock.
- `AIActivityTicker.tsx` — live-feeling activity feed with agent tags.

---

## 5. The AI Workforce (6 Agents)

Defined in `src/data/agents.ts`. Each agent has: id, role, status, stack, today's stats, last action, weekly impact, integration flow.

| Agent | Role | Powered By | What It Does |
|---|---|---|---|
| 🎯 **Scout** | Lead Hunter | Realie.ai, Batch Leads API | Pulls fresh NOD/NTS filings every day at 6 AM, filters by target ZIPs, de-dupes. |
| 🔍 **Sherlock** | Research Analyst | ATTOM, GPT-4o | Cross-verifies property data, calculates true equity, flags discrepancies. |
| ⚡ **Pulse** | Urgency Scorer | GPT-4o | Scores leads 1–10 from auction date, equity %, prior touches. Re-scores on new signals. |
| 💬 **Echo** | Script Writer | GPT-4o | Generates personalized bilingual call scripts per lead in seconds. |
| 📞 **Voice** | 24/7 Receptionist | Vapi, GPT-4o | Answers inbound calls in EN/ES, qualifies, extracts structured data, creates leads. |
| 📱 **Dispatch** | Follow-Up Bot | Twilio | Sends bilingual SMS the moment a call goes unanswered; flags hot replies. |

**Aggregate KPIs (demo):** 6 agents active · 1,247 actions today · 23.4 hrs saved this week.

---

## 6. Data Strategy

### 6.1 Source Stack
- **Realie.ai** — primary foreclosure filings feed (NOD, LP, NTS).
- **Batch Leads API** — secondary filings + skip-trace contact data.
- **ATTOM** — property valuation, mortgage balance, owner records.

### 6.2 Filtering Rules
- Target ZIPs: Westchester, Bronx, Queens (12 ZIPs in demo).
- **Equity rule:** lead is *qualified* only when equity ≤ 25% (short-sale candidate).
- De-duplication across Realie + Batch Leads API via address + APN match.

### 6.3 Urgency Scoring (1–10)
Inputs: days-to-auction, equity %, prior contact count, filing chain stage.
Output: numeric score + plain-English reasoning string (e.g., *"9/10: 28 days to auction, 11% equity, never contacted"*).
Implementation: `getUrgencyReason()` in `src/data/activity.ts`.

---

## 7. Technical Architecture

### 7.1 Stack
- **Frontend:** React 18 + Vite 5 + TypeScript 5
- **Styling:** Tailwind CSS v3 + semantic HSL tokens (`src/index.css`, `tailwind.config.ts`)
- **UI Library:** shadcn/ui (Radix primitives)
- **State:** React Context (`AuthContext`, `AppContext`) + TanStack Query
- **Charts:** Recharts
- **Routing:** React Router v6
- **Notifications:** Sonner
- **Testing:** Vitest + Testing Library

### 7.2 Backend (current state)
- **None.** v1 is a fully client-side prototype with rich seed data in `src/data/`.
- All "live" feel comes from `src/hooks/useLiveSimulation.ts` driving timers and toasts.

### 7.3 Future Backend (Lovable Cloud)
When greenlit for production:
- Database tables for `leads`, `cases`, `calls`, `sms`, `activity`, `users`, `user_roles`.
- Edge Functions for Realie / Batch Leads API / ATTOM / Vapi / Twilio integrations.
- RLS policies with `has_role()` security-definer pattern (CEO vs. Rep).

### 7.4 Project Structure
```
src/
├── pages/           # CEODashboard, RepDashboard, LoginPage, NotFound, Index
├── components/
│   ├── ceo/         # 8 CEO-side feature screens + drawers
│   ├── rep/         # 4 Rep-side feature screens
│   ├── shared/      # LeadDetailDrawer, SMSThread
│   └── ui/          # shadcn primitives
├── data/            # Seed data: leads, calls, pipeline, agents, activity, sms, caseDetails, users
├── contexts/        # AuthContext, AppContext
├── hooks/           # useLiveSimulation, use-toast, use-mobile
└── index.css        # Design tokens (HSL semantic colors)
```

---

## 8. Design System

- **Primary brand:** Navy `#042C53` (HSL token `--primary`).
- **Status semantics:** Teal = healthy/connected, Red = urgent/alert, Amber = warning.
- **Per-agent accents (within brand):** Scout = teal, Sherlock = indigo, Pulse = red/orange, Echo = purple, Voice = blue, Dispatch = green.
- **Typography:** Distinctive display + refined body pairing (no Inter/Poppins defaults).
- **Motion:** Pulsing dots for "Working" status, animated counters, toast slide-ins.
- **Tokens only:** No hard-coded color classes in components — all via `index.css` HSL tokens.

---

## 9. Roadmap

### Phase 1 — Foundation (✅ Live in Demo)
- Lead aggregation (Scout)
- Property verification (Sherlock)
- Urgency scoring (Pulse)
- Bilingual script generation (Echo)
- CEO + Rep dashboards

### Phase 2 — Communication Layer (✅ Live in Demo)
- 24/7 AI receptionist (Voice — Vapi)
- Bilingual SMS auto-follow-up (Dispatch — Twilio)
- Live activity ticker & morning briefing
- Pipeline board with case milestones
- Team performance drill-downs

### Phase 3 — Intelligence Expansion (🔜 Planned)
- Predictive close-rate modeling per lead
- Bank-negotiator behavior insights
- Document automation (hardship letters, financials)
- Mobile-native rep app
- CRM + DocuSign + e-mail integrations

---

## 10. Out of Scope (v1)

- Real backend / persistence (all in-memory seed data)
- Real Realie / Batch Leads API / ATTOM / Vapi / Twilio API calls
- Drag-and-drop on kanban
- Mobile-first redesign of drawers (responsive but desktop-primary)
- Agent configuration / pause controls (read-only showcase)

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **NOD** | Notice of Default — first foreclosure filing |
| **NTS** | Notice of Trustee Sale — auction scheduled |
| **LP** | Lis Pendens — pending lawsuit notice |
| **APN** | Assessor's Parcel Number — unique property ID |
| **Short Sale** | Sale of a home for less than the mortgage owed |
| **Equity %** | (Market Value − Mortgage Balance) / Market Value |
| **Urgency Score** | 1–10 priority assigned by Pulse agent |

---

## 12. Change Log

| Version | Date | Notes |
|---|---|---|
| **v1.0.0** | 2026-04-29 | Initial technical product doc. Phase 1 + 2 combined demo live. AI Agents roster shipped. |

---

*Maintained by the BuildYourAI Consulting product team. Update this document with every feature ship, agent addition, or scope change.*
