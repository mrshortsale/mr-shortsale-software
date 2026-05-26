# AI agents & pipeline

## Summary

Manages the platform’s AI agent definitions (models, prompts, ordering) and runs the agent pipeline against leads. Includes the CEO Agents and Logs pages plus preview roster components for the six-agent “workforce” narrative.

## Scope

**In scope:** `AgentsPage`, `LogsPage`, `aiAgents` service, `ai-agents-manage` and `ai-agent-pipeline` Edge Functions, agent roster preview UI.

**Out of scope:** Voice inbound call UI (`ceo-strategy-views` preview); mock-only agent stats in briefing unless wired to live logs.

## Primary responsibilities

- List and update agent configuration (model, system prompt, enabled flag).
- Trigger pipeline runs and surface execution logs.
- Display agent roster and activity drawer for demos/previews.

## Dependencies

- **Features:** `integrations-hub` (OpenAI credentials), `lead-inventory` (pipeline input data).
- **External:** OpenAI API.

## How to navigate the code

- Production UI: `src/pages/ceo/ai/AgentsPage.tsx`, `LogsPage.tsx`.
- Service: `src/services/aiAgents.ts`.
- Backend: `supabase/functions/ai-agents-manage/`, `ai-agent-pipeline/`.
- Preview: `src/components/ceo/AIAgentsRoster.tsx`.

## Open questions / gaps

- Scout/Sherlock/Pulse/Echo/Voice/Dispatch personas in `Spec/01-modules.md` are partly narrative; map each to concrete DB rows and pipeline stages as they go live.
