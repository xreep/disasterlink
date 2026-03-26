# DisasterLink — Real-time Disaster Resource Coordination Platform

## Overview
A React + TypeScript + Vite frontend-only web application for real-time disaster resource coordination. Users can choose roles: reporting an emergency, volunteering, or accessing an emergency operations center (coordinator view).

## Tech Stack
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS v4 + shadcn/ui component patterns
- **Routing:** React Router v7
- **UI Components:** Radix UI primitives + Lucide React icons
- **Maps:** Leaflet + React Leaflet
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts
- **Animations:** Framer Motion
- **Data Fetching:** TanStack Query (React Query)

## Project Structure
```
/
├── src/
│   ├── App.tsx              # Main app with routing
│   ├── main.tsx             # Entry point
│   ├── ThemeContext.tsx      # Light/dark mode context
│   ├── index.css            # Global styles
│   ├── components/
│   │   ├── ui/              # shadcn/ui-style base components
│   │   └── layout/          # Layout components (RoleNavbar, etc.)
│   ├── pages/               # Page components
│   │   ├── LandingPage.tsx  # Role selection landing
│   │   ├── ReportPage.tsx   # Emergency reporting
│   │   ├── VolunteerPage.tsx # Volunteer operations
│   │   └── CoordinatorPage.tsx # Emergency ops center
│   ├── hooks/               # Custom hooks
│   └── lib/                 # Utility functions
├── public/                  # Static assets
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Running the App
The app requires two environment variables:
- `PORT=5000` — port to run on
- `BASE_PATH=/` — base URL path

Run command: `PORT=5000 BASE_PATH=/ pnpm run dev`

## Package Manager
Uses **pnpm** (v10.26.1). Install dependencies with `pnpm install`.

## Deployment
Configured as a **static** deployment:
- Build: `pnpm run build`
- Output: `dist/public/`
- The build requires `PORT` and `BASE_PATH` env vars to be set

## Notes
- The app is purely frontend — no backend server required
- Uses localStorage to persist volunteer and affected user session IDs
- Supports offline mode with queue sync on reconnect
- Has light/dark theme toggle (bottom-right corner)
