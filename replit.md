# DisasterLink — Real-time Disaster Resource Coordination Platform

## Overview
A React + TypeScript + Vite web application for real-time disaster resource coordination backed by Supabase. Three roles: victim (emergency report), volunteer (task queue), and EOC coordinator (dashboard with map, requests, volunteers, resources, analytics).

## Tech Stack
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite 6
- **Backend/DB:** Supabase (PostgreSQL + Realtime subscriptions)
- **Styling:** Tailwind CSS v4 + shadcn/ui component patterns
- **Routing:** React Router v7
- **UI Components:** Radix UI primitives + Lucide React icons
- **Maps:** Leaflet + React Leaflet
- **Package Manager:** pnpm

## Environment Variables (Secrets)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

## Supabase Schema (run in Supabase SQL Editor)
```sql
-- Active disaster configuration
create table if not exists disasters (
  id serial primary key,
  name text not null,
  type text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Help requests submitted via "I Need Help" form
create table if not exists help_requests (
  id text primary key,
  victim_name text,
  victim_phone text,
  need_type text not null,
  description text,
  location_state text not null,
  location_district text not null,
  latitude float,
  longitude float,
  severity text not null default 'Urgent',
  people integer not null default 1,
  status text not null default 'Pending',
  source text not null default 'web',
  created_at timestamptz default now()
);

-- Volunteers
create table if not exists volunteers (
  id text primary key,
  name text not null,
  district text not null,
  state text not null,
  skill text not null,
  status text not null default 'Available',
  task_id text references help_requests(id)
);

-- Physical resources
create table if not exists resources (
  id serial primary key,
  name text not null,
  category text not null,
  available integer not null default 0,
  deployed integer not null default 0,
  total integer not null default 0,
  location text not null
);

-- Enable Realtime on all tables
alter publication supabase_realtime add table disasters;
alter publication supabase_realtime add table help_requests;
alter publication supabase_realtime add table volunteers;
alter publication supabase_realtime add table resources;

-- Seed active disaster
insert into disasters (name, type, is_active) values ('India Flood Response', 'Flood', true);
```

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
