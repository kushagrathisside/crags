# CRAGS Frontend

## Compute Resource Allocation and Governance System (CRAGS)

This directory contains the **frontend application** for CRAGS. The frontend
provides the user interface through which users log in, view compute systems,
create resource bookings, manage group quotas, and review audit history.

The frontend communicates with the **FastAPI backend** through REST APIs.

---

# 1. Technology Stack

| Component         | Technology                         |
| ----------------- | ---------------------------------- |
| Framework         | React 18                           |
| Language          | TypeScript                         |
| Build Tool        | Vite                               |
| UI Components     | Material UI (MUI)                  |
| API Communication | Axios (`api/client.ts`)            |
| Data Fetching     | React Query (`@tanstack/react-query`) |
| State Management  | Redux Toolkit                      |
| Linting           | ESLint + TypeScript ESLint         |
| Package Manager   | npm                                |

---

# 2. Directory Structure

```
frontend/
│
├── index.html
├── package.json
├── package-lock.json
├── vite.config.ts
├── eslint.config.js
│
├── public/
│
└── src/
    ├── api/
    │   ├── api.ts          # Legacy / thin re-export helpers
    │   ├── client.ts       # Axios instance (baseURL, credentials)
    │   └── cragsApi.ts     # Typed CRAGS API functions
    │
    ├── hooks/              # React Query hooks
    │   ├── useAuditTrailQuery.ts
    │   ├── useAvailabilityQuery.ts
    │   ├── useBookingsQuery.ts
    │   ├── useCreateBooking.ts
    │   ├── useCreateSystem.ts
    │   ├── useCurrentUserQuery.ts
    │   ├── useLoginMutation.ts
    │   ├── useLogoutMutation.ts
    │   └── useSystemsQuery.ts
    │
    ├── components/
    │   ├── panels/
    │   │   ├── AuditTrailPanel.tsx
    │   │   ├── BookingLifecycle.tsx
    │   │   ├── DecisionPanel.tsx
    │   │   ├── LoginPanel.tsx
    │   │   ├── MissionControlDashboard.tsx
    │   │   ├── SystemInventoryPanel.tsx
    │   │   └── TeamManagementPanel.tsx
    │   ├── forms/
    │   │   ├── BookingRequestForm.tsx
    │   │   └── SystemRegistrationForm.tsx
    │   ├── charts/
    │   │   ├── ResourceConstraintChart.tsx
    │   │   └── TemporalGantt.tsx
    │   ├── layout/          # Shell, nav, layout wrappers
    │   └── shared/          # Reusable UI primitives
    │
    ├── pages/
    │   └── Systems.tsx
    │
    ├── types/
    │   └── crags.ts         # Shared TypeScript types for API shapes
    │
    ├── utils/
    │   └── simulateBooking.ts
    │
    ├── App.tsx              # Authenticated app shell and tab composition
    ├── App.css
    ├── index.css
    └── main.tsx
```

---

# 3. Key Files

### `src/api/client.ts`

Creates the shared Axios instance used by all API calls.

- Sets `baseURL` from `VITE_API_BASE_URL` or falls back to `/api/v1`
- Enables `withCredentials` so the session cookie is sent automatically

### `src/api/cragsApi.ts`

Typed functions wrapping Axios calls to the CRAGS REST API. Components and
hooks import from here rather than calling Axios directly.

### `src/hooks/`

React Query hooks wrap `cragsApi.ts` functions. Components call hooks; they
never import `cragsApi.ts` directly. This keeps cache invalidation and loading
states centralised.

### `src/App.tsx`

Authenticated application shell. Renders the `MissionControlDashboard` when the
user is logged in; shows `LoginPanel` otherwise.

---

# 4. Installation

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

# 5. Running the Development Server

Start the backend first, then:

```bash
npm run dev
```

The app is available at `http://localhost:5173`. The Vite dev server proxies
`/api` requests to `http://localhost:8000`.

---

# 6. Production Build

```bash
npm run build
```

The build output goes to `frontend/dist`. In Docker, Nginx serves this directory
and proxies `/api/` to the backend Compose service.

---

# 7. Linting and Type Checking

```bash
npm run lint
npm run build   # also runs tsc
```

---

# 8. Development Workflow

1. Start the full stack: `docker-compose up --build` from the repo root.
2. Or run backend and frontend separately for faster iteration (see
   [local-development.md](../docs/local-development.md)).
3. Keep API functions in `src/api/cragsApi.ts` and expose them through hooks in
   `src/hooks/`.
4. Do not embed backend URLs inside components; use the Axios client.

---

# 9. Contribution Guidelines

1. Maintain consistent TypeScript types in `src/types/crags.ts`.
2. Add new API calls to `src/api/cragsApi.ts` and wrap them in a React Query
   hook under `src/hooks/`.
3. Do not embed backend URLs or raw Axios calls inside components.
4. Document new components and hooks with a brief JSDoc comment when their
   purpose is non-obvious.

---

# 10. License

This project is distributed under the license specified in the root repository.
