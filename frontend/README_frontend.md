# CRAGS Frontend

## Compute Resource Allocation and Governance System (CRAGS)

This directory contains the **frontend application** for CRAGS. It provides the
user interface through which users log in, view compute systems, create and
modify resource bookings, manage group quotas, review the audit trail, and
inspect usage analytics.

The frontend is a single-page React application that communicates with the
**FastAPI backend** over REST. In production it is built to static assets and
served by Nginx, which proxies `/api` to the backend.

---

# 1. Technology Stack

| Component          | Technology                              |
| ------------------ | --------------------------------------- |
| Framework          | React 18                                |
| Language           | TypeScript                              |
| Build Tool         | Vite                                    |
| UI Components       | Material UI (MUI) v7                     |
| Charts             | Recharts                                |
| Routing            | React Router                            |
| API Communication  | Axios (`api/client.ts`)                 |
| Data Fetching      | React Query (`@tanstack/react-query` v5)|
| App State          | React Query cache + React Context (theme)|
| Linting            | ESLint + TypeScript ESLint              |
| Package Manager    | npm                                     |

There is no Redux in the project; server state lives in the React Query cache
and the only global UI state (theme mode) lives in a React context.

---

# 2. Directory Structure

```
frontend/
│
├── index.html              # Loads Roboto + Roboto Mono web fonts
├── package.json
├── vite.config.ts
├── eslint.config.js
│
└── src/
    ├── main.tsx            # React root: QueryClient, BrowserRouter, AppThemeProvider
    ├── App.tsx             # Route table; role-gated routes via RequireRole
    ├── index.css           # Minimal global styles
    │
    ├── api/
    │   ├── client.ts       # Axios instance: baseURL, withCredentials, 401 auto-refresh
    │   ├── cragsApi.ts     # Typed wrappers for every backend endpoint
    │   └── api.ts          # Thin legacy re-export helpers
    │
    ├── hooks/              # React Query hooks (one concern per file)
    │   ├── useCurrentUserQuery.ts
    │   ├── useSystemsQuery.ts
    │   ├── useBookingsQuery.ts
    │   ├── useAvailabilityQuery.ts
    │   ├── useAuditTrailQuery.ts
    │   ├── useCreateBooking.ts
    │   ├── useCreateSystem.ts
    │   ├── useLoginMutation.ts
    │   ├── useLogoutMutation.ts
    │   ├── useSessionExpiry.ts
    │   └── shared/useDebouncedValue.ts
    │
    ├── context/
    │   └── ThemeContext.tsx    # Light/dark mode, persisted to localStorage
    │
    ├── theme/
    │   └── index.ts            # Centralised design system (see §7)
    │
    ├── pages/                  # One file per route
    │   ├── DashboardPage.tsx
    │   ├── SchedulerPage.tsx
    │   ├── SystemsPage.tsx
    │   ├── MonitoringPage.tsx
    │   ├── AnalyticsPage.tsx
    │   ├── TeamPage.tsx
    │   └── LoginPage.tsx
    │
    ├── components/
    │   ├── layout/             # AppShell, Sidebar (collapsible), TopBar
    │   ├── panels/             # MissionControlDashboard, ApprovalQueuePanel,
    │   │                       #   WaitlistPanel, MaintenanceWindowsPanel,
    │   │                       #   SystemInventoryPanel, AuditTrailPanel,
    │   │                       #   BookingLifecycle, BookingActionsPanel, …
    │   ├── forms/              # BookingRequestForm, SystemRegistrationForm
    │   ├── charts/             # ResourceConstraintChart, TemporalGantt
    │   └── ErrorBoundary.tsx
    │
    ├── lib/                    # explainableError, policy, time helpers
    ├── utils/                  # simulateBooking (client-side booking preview)
    └── types/crags.ts         # Shared TypeScript types for all API shapes
```

---

# 3. Application Shell and Routing

`main.tsx` mounts the React root with the `QueryClientProvider`,
`BrowserRouter`, and the theme provider. `App.tsx` defines the route table and
wraps protected routes in a `RequireRole` guard that checks the current user's
role before rendering.

`components/layout/AppShell.tsx` is the authenticated frame: a collapsible
`Sidebar`, a `TopBar`, and the routed page content. On logout (or a
`crags:session-expired` event) it clears the React Query cache and navigates to
`/login`.

| Route        | Access                          | Page             |
| ------------ | ------------------------------- | ---------------- |
| `/`          | Any authenticated               | Dashboard        |
| `/scheduler` | Any authenticated               | Scheduler        |
| `/systems`   | RESOURCE_ADMIN, SUPER_ADMIN     | Systems          |
| `/monitoring`| GROUP_LEAD and above            | Monitoring       |
| `/analytics` | GROUP_LEAD and above            | Analytics        |
| `/team`      | RESOURCE_ADMIN, SUPER_ADMIN     | Team             |
| `/login`     | Public                          | Login            |

---

# 4. Data Flow

```
Component → React Query hook (src/hooks) → cragsApi.ts → Axios client → backend
```

- Components call **hooks**, never `cragsApi.ts` or Axios directly. This keeps
  caching, loading/error states, and invalidation centralised.
- `api/client.ts` sets `baseURL` from `VITE_API_BASE_URL` (default `/api/v1`)
  and enables `withCredentials` so the HTTP-only session cookie is sent.
- On a `401`, the client's interceptor calls `/auth/refresh` once; if that also
  fails it dispatches a `crags:session-expired` DOM event, which the shell
  handles by clearing the cache and redirecting to login.

> Note: because `baseURL` already includes `/api/v1`, endpoint paths in
> `cragsApi.ts` must **not** repeat that prefix.

---

# 5. Installation

## Prerequisites

- Node.js 18 or later
- npm

```bash
node -v
npm -v
```

## Install Dependencies

```bash
cd frontend
npm install
```

---

# 6. Running, Building, and Linting

Development server (start the backend first):

```bash
npm run dev      # http://localhost:5173, proxies /api to http://localhost:8000
```

Production build (also runs `tsc`):

```bash
npm run build    # output to frontend/dist; Nginx serves this in Docker
```

Linting and type checking:

```bash
npm run lint
npx tsc --noEmit
```

---

# 7. Design System

All colour, typography, and shape live in `src/theme/index.ts`, the single
source of truth for the UI. To restyle the app, edit this file rather than
individual components:

- `buildTheme(mode)` — MUI theme factory for light/dark. Flat bordered cards
  (no elevation), 8px radius, no gradients or glow effects (Google Workspace
  style).
- `BRAND` — the Material palette (`blue #1A73E8`, `green #1E8E3E`,
  `amber #F9AB00`, `red #D93025`, `purple #9334E6`, `teal #12A4AF`).
- `STATUS_COLOR` / `statusTone(status)` — semantic `{ color, bg }` tones for
  booking and system statuses; panels call `statusTone()` instead of hardcoding
  hex values.
- `CHART_COLORS` — ordered series colours for Recharts views.
- `FONT_SANS` / `FONT_MONO` — Roboto and Roboto Mono, loaded in `index.html`.

Theme mode is persisted to `localStorage` via `context/ThemeContext.tsx` and
defaults to light. Components should consume semantic tokens (`primary.main`,
`text.secondary`, `action.hover`, `divider`) rather than literal colours.

---

# 8. Contribution Guidelines

1. Keep shared types in `src/types/crags.ts`.
2. Add new API calls to `src/api/cragsApi.ts` and wrap them in a React Query
   hook under `src/hooks/`.
3. Do not embed backend URLs or raw Axios calls inside components.
4. Use design-system tokens from `src/theme/index.ts`; do not introduce ad-hoc
   colours or fonts.
5. Document non-obvious components and hooks with a brief comment.

---

# 9. License

This project is distributed under the license specified in the root repository.
</content>
</invoke>
