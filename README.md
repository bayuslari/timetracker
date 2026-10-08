# Time Tracker

A simple project time tracker built with **Next.js 16** (App Router), React 19, TypeScript and Tailwind CSS v4.

## Features

- **Projects** — add, rename (click the name), color-code and delete projects.
- **Start working** — press **Start** on a project to begin a work session. Starting another project automatically ends the current session.
- **Pause / Resume** — pause a session and resume it later; paused time is not counted.
- **End** — finish the session and log it.
- **Notes** — describe what you're working on while the timer runs.
- **Add missed time** — forgot to start the timer? Log a past entry with project, date, start and end time.
- **Edit entries** — fix the project, note or times of any entry (✎ in the log). For a running session you can move the start time back. Pauses inside the new time range are kept, and overlapping entries are flagged.
- **Log** — sessions grouped by day with daily totals, per-project today/total time, and a "tracked today" counter.
- **Export CSV** — download all sessions.

Data is stored in the browser's `localStorage` (no backend needed) and stays in sync across open tabs.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command         | Description                 |
| --------------- | --------------------------- |
| `npm run dev`   | Start the dev server        |
| `npm run build` | Production build            |
| `npm run start` | Serve the production build  |
| `npm run lint`  | Run ESLint                  |

## Project structure

```
src/
  app/                  # Next.js App Router (layout, page, global styles)
  components/
    TimeTracker.tsx     # Timer, projects panel and session log
    SessionEditor.tsx   # Dialog to add missed time or edit an entry
  lib/
    store.ts            # localStorage-backed store + actions (start/pause/resume/end)
    useNow.ts           # ticking clock hook
    format.ts           # duration/date formatting helpers
```
