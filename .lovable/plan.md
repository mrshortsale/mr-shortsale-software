## Goal

Cristina found Phase 2 features mixed into the live demo confusing. She should experience the Phase 1 product cleanly, and only see Phase 2 when she explicitly opens the Roadmap.

## What changes

### 1. Hide Phase 2 surfaces from the CEO sidebar

In `src/pages/CEODashboard.tsx`, remove (or gate behind a "Show Phase 2 preview" toggle, off by default) these sidebar items, since they are Phase 2 deliverables:

- AI Agents Roster
- AI Inbound Calls
- AI Activity Ticker
- Realtor Short Sale section (Realtor Pipeline, Realtor Lead Queue, Realtor Scripts, Realtor Reports)
- Data Sources cards for ATOM and Zillow (keep Batch Leads + Realie only)

Phase 1 items that stay visible: Morning Briefing, Pipeline, Lead Queue / Mojo Dialer, Speed-to-Lead, Team Performance, Case details, SMS, Roadmap, Proposal, Costs.

### 2. Hide Phase 2 from the Rep dashboard

In `src/pages/RepDashboard.tsx`, remove the "Realtor Queue" tab. Rep sees only the foreclosure lead queue, active call, call history, stats.

### 3. Keep everything browsable from Roadmap

`src/components/ceo/RoadmapView.tsx` already lists all three phases with deliverables. Update it so Phase 2 and Phase 3 are the place she goes to preview what's coming:

- Change Phase 2 status from "Live in Demo" to "Preview" (new badge style, amber).
- Collapse Phase 2 and Phase 3 by default; only Phase 1 expanded.
- Inside each Phase 2 deliverable that has a working screen (Realtor Pipeline, AI Agents, ATOM/Zillow sources), add a small "Preview screen" link that opens that screen in a modal/drawer or routes to a `/preview/...` path. This way she can still see what we built without it polluting her main nav.
- Update the top callout from "Phases 1 & 2 are live in this prototype" to "Phase 1 is live. Click Phase 2 below to preview what's coming in Weeks 5–8."

### 4. Routing

In `src/App.tsx`, keep the Phase 2 components mounted but only reachable via roadmap-triggered preview routes (e.g. `/preview/realtor-pipeline`, `/preview/ai-agents`). They are not linked from the sidebar.

## Out of scope

- No deletion of Phase 2 code — everything stays in the repo, just gated.
- No data model changes.
- Proposal and Costs pages unchanged (they already correctly describe phases).

## Confirm before I build

1. "Hide" = remove from sidebar entirely, with previews accessible only via Roadmap. OK? (Alternative: add a CEO toggle "Show Phase 2 preview in sidebar" defaulted off.)
2. Should the Realtor Short Sale chain be treated as Phase 2 (hidden) or kept visible since Cristina specifically asked for it in the last meeting? My read: hide it, surface via Roadmap preview, because she also said the realtor chain is a future workflow she does not run today.
