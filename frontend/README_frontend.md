# CRAGS Frontend

## Compute Resource Allocation and Governance System (CRAGS)

This directory contains the **frontend application** for the Compute Resource Allocation and Governance System (CRAGS).
The frontend provides the user interface through which users can:

* View available compute systems
* Create and manage resource bookings
* Monitor scheduled allocations
* Interact with governance and audit features

The frontend communicates with the **FastAPI backend** through REST APIs.

---

# 1. Technology Stack

The frontend application is built using modern web technologies designed for maintainability and performance.

| Component         | Technology |
| ----------------- | ---------- |
| Framework         | React      |
| Language          | TypeScript |
| Build Tool        | Vite       |
| Styling           | CSS        |
| Linting           | ESLint     |
| API Communication | Fetch API  |
| Package Manager   | npm        |

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
│   └── vite.svg
│
├── src/
│   ├── api/
│   │   └── api.ts
│   │
│   ├── assets/
│   │   └── react.svg
│   │
│   ├── pages/
│   │   └── Systems.tsx
│   │
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx
│
├── tsconfig.json
├── tsconfig.app.json
└── tsconfig.node.json
```

---

# 3. Description of Key Files

## 3.1 Entry Files

### `index.html`

The main HTML entry point for the application.
This file loads the React application through the Vite development server.

---

### `src/main.tsx`

Application bootstrap file.

Responsibilities:

* Initializes the React application
* Attaches the root component (`App.tsx`) to the DOM
* Configures application rendering

---

### `src/App.tsx`

Main application component.

Responsibilities:

* Defines the root component of the UI
* Handles routing and page switching
* Defines the application layout

Future updates will introduce **navigation, authentication routing, and dashboards** in this file.

---

# 4. Pages

Pages represent major UI views.

## `src/pages/Systems.tsx`

This page displays available compute systems.

Responsibilities:

* Fetch system information from the backend
* Display system specifications
* Provide entry point for resource booking

Future improvements may include:

* System status indicators
* Capacity visualization
* Resource utilization metrics

---

# 5. API Integration

The frontend communicates with backend services through API helper functions.

## `src/api/api.ts`

This file centralizes all HTTP communication with the backend.

Example responsibilities:

* Fetch list of compute systems
* Submit booking requests
* Retrieve scheduled bookings
* Request audit summaries

Centralizing API logic ensures:

* Maintainable network layer
* Consistent error handling
* Simplified frontend components

Example API structure:

```ts
const API_BASE = "http://localhost:8000";

export async function getSystems() {
    const response = await fetch(`${API_BASE}/resources/systems`);
    return response.json();
}
```

---

# 6. Configuration Files

## `vite.config.ts`

Defines build configuration for the Vite development server.

Responsibilities:

* Local development server configuration
* Build optimization
* Module resolution

---

## `tsconfig.json`

TypeScript configuration for the project.

Defines:

* Type checking behavior
* Module resolution
* Compiler options

---

## `eslint.config.js`

Defines code quality rules and linting configuration.

This ensures:

* Consistent coding style
* Early detection of errors
* Maintainable codebase

---

# 7. Installation

## 7.1 Prerequisites

Ensure the following software is installed:

* Node.js (version 18 or later recommended)
* npm

Check installation:

```
node -v
npm -v
```

---

## 7.2 Install Dependencies

Navigate to the frontend directory:

```
cd frontend
```

Install required packages:

```
npm install
```

---

# 8. Running the Development Server

Start the development server:

```
npm run dev
```

The application will be available at:

```
http://localhost:5173
```

The development server provides:

* Hot module reloading
* Fast rebuild times
* Error overlays

---

# 9. Connecting to the Backend

By default, the frontend expects the backend API at:

```
http://localhost:8000
```

Ensure the FastAPI backend server is running before starting the frontend.

To change the API endpoint, modify:

```
src/api/api.ts
```

Example:

```
const API_BASE = "http://localhost:8000";
```

---

# 10. Development Workflow

Recommended development cycle:

1. Start backend server
2. Start frontend development server
3. Implement UI components
4. Connect components to backend APIs
5. Validate functionality through browser

---

# 11. Future Improvements

The current frontend provides foundational structure. Planned enhancements include:

### Booking Interface

* Booking creation forms
* Calendar-based scheduling interface
* Resource availability visualization

### User Authentication

* Login interface
* Role-based access control
* Secure API authentication

### Dashboard

* Resource utilization statistics
* Weekly compute consumption metrics
* Governance analytics visualization

### Improved UI

* Navigation bar
* Layout system
* Responsive design

---

# 12. Contribution Guidelines

When contributing to the frontend:

1. Maintain consistent TypeScript usage
2. Keep API communication centralized in `api.ts`
3. Avoid embedding backend URLs inside components
4. Document new components and modules

---

# 13. License

This project is distributed under the license specified in the root repository.

---

# 14. Maintainers

CRAGS Development Team

---

# 15. Additional Notes

The frontend is intentionally designed as a **lightweight interface layer**, with most logic handled by the backend scheduling engine. This ensures maintainability and flexibility for future extensions such as dashboards, advanced scheduling visualization, and governance analytics.
