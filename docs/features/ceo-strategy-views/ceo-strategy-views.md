# CEO strategy & preview views

## Summary

Non-operational CEO screens: product roadmap timeline, investor presentation mode, preview of AI inbound calls (Vapi-style), and org settings. Supports demos and stakeholder conversations.

## Scope

**In scope:** Roadmap page, `Presentation`, `AIInboundCalls` preview route, `CEOSettingsPage`.

**Out of scope:** Production AI agent config (`ai-agents`); public marketing routes (`marketing-pages`).

## Primary responsibilities

- Communicate phased delivery (live vs planned).
- Showcase AI voice value prop with mock transcripts and waveforms.
- Host CEO-level settings placeholders.

## Dependencies

- **Features:** `app-shell`, `ai-agents` (conceptual link to Voice agent).

## How to navigate the code

- Roadmap: `src/pages/ceo/CEORoadmapPage.tsx`, `src/components/ceo/RoadmapView.tsx`.
- Presentation: `src/components/ceo/Presentation.tsx`.
- AI calls preview: `src/components/ceo/AIInboundCalls.tsx` (`/ceo/preview/ai-calls`).
- Settings: `src/pages/ceo/CEOSettingsPage.tsx`.

## Open questions / gaps

- `AIInboundCalls` is preview/mock; production needs Vapi webhooks and storage.
