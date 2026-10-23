# NanoLabs Hub — Product & Interface Direction

## North star
NanoLabs Hub is the single **governance workspace** for NanoLabs. A user should be able to answer, in one place: what do we operate, which customers do we serve, what needs attention, and which action should we take?

The Hub is not a collection of unconnected admin dashboards. It has a unified navigation, a consistent visual language and clear distinctions between **verified live data**, **configured values**, and **unavailable information**.

## Information architecture

1. **Resumen ejecutivo** (`/`) — cross-product KPIs, direct actions, server health and applications.
2. **Clientes y SaaS** (`/governance`) — universal tenants, plans, states, products and modules.
3. **Productos y versiones** (`/software`) — repositories, changes and production actions.
4. **Infraestructura** (`/hardware`) — server, processes and Docker operations.
5. **Copias de seguridad** (`/backups`) — backup inventory and manual procedures.
6. **Dominios y red** (`/networking`) — declared proxy routes, networking and certificates.

The navigation is grouped by *business and products* versus *platform operations*. Critical actions remain gated behind existing confirmations. No change in this design branch alters authentication, database schemas, APIs, Docker, live container state or deployment configuration.

## Design language — first pass

| Element | Direction |
|---|---|
| Foundation | Graphite/blue-black backgrounds: `#0b1220`, `#101827` |
| Surface | Soft navy `#172233` with low-contrast, consistent borders |
| Primary | Muted periwinkle `#9db5ff`, reserved for navigation and actions |
| Semantic success | Green for confirmed active conditions only |
| Semantic warning | Amber for degraded, pending or unverified states |
| Semantic danger | Rose for failure or destructive actions |
| Typography | Inter for reading/UI, JetBrains Mono only for technical identifiers |
| Cards | Unified 16px corners, no default neon glow |
| Motion | Restrained, respects reduced-motion preferences |

## Key UX rules

- Never use fictional counts, fixed operational badges or static values presented as live readings.
- Use one clear title and one explanation per section; avoid jargon when plain labels are possible.
- Keep tenants discoverable with search, status and product filters.
- A tenant card shows only the most relevant modules; the full list remains in tenant controls.
- Show a data-unavailable state instead of silently fabricating information.
- Maintain responsive navigation, visible focus states and accessible action labels.
- Retain existing API contracts and functional actions when redesigning presentation.

## Delivered in this branch

- Redesigned responsive sidebar, contextual toolbar and login.
- Centralized design tokens, surfaces, component primitives and table styles.
- Home with live governance KPI summary and actionable shortcuts, plus existing operations.
- Reframed hero sections across SaaS, versions, hardware, backups and network.
- Reduced tag density in tenant cards and eliminated selected misleading status labels.
- Automated type-check/build workflow.

## Next product-level work (not implied as complete by UI changes)

- Business-level revenue/collections and onboarding KPIs, if APIs can supply verified data.
- Global task/incident center, audit history, permissions and role model.
- Unified per-tenant drilldown and cross-product reporting.
- Live network, TLS and remote-backup verification (currently some views use static configuration).
- Visual regression checks, usability review on phone and desktop, and real authenticated screen review.

A visual design change alone does **not** complete full organizational governance.
