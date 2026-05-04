## Sidebar reorganization

Restructure the CEO sidebar into 4 clear groups so the two main daily-use sections (Lead Inventory + Realtor Short Sale) sit together at the top, and admin-only items (Data Sources, Settings) drop to the bottom.

### New order

```text
Morning Briefing

— Leads —
Lead Inventory
Realtor Lead Queue
Realtor Pipeline
Realtor Scripts
Realtor Reports

— Operations —
Active Pipeline
Speed-to-Lead
Mojo Dialer
Team Performance

— Other —
Roadmap & Previews
Presentation
View Proposal
Cost Transparency

— Admin —
Data Sources
Settings
```

### File to edit

- `src/pages/CEODashboard.tsx` — reorder `navItems` array only. No component changes, no behavior changes.

That's it — purely a navigation regroup.
