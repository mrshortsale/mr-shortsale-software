# Team performance

## Summary

CEO operations screen for comparing reps: calls made, connections, pipeline cases, and conversion. Clicking a rep opens `AgentDrillDown` with 7-day call trends, connect-time heatmap, and connection rate by filing type (Recharts).

## Scope

**In scope:** Team table and drill-down analytics UI.

**Out of scope:** Rep-facing personal stats (`rep-workspace`).

## Primary responsibilities

- Rank and compare rep activity.
- Explain performance patterns via charts.

## Dependencies

- **Features:** `app-shell`, `user-management` (rep roster conceptually).
- **Data:** Mock agents/calls data under `src/data/`.

## How to navigate the code

- `src/components/ceo/TeamPerformance.tsx`
- `src/components/ceo/AgentDrillDown.tsx`

## Open questions / gaps

- Metrics should eventually query call logs and inventory assignment tables instead of static JSON.
