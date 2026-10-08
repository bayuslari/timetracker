"use client";

import { useSyncExternalStore } from "react";

export type Segment = { start: number; end: number | null };

export type SessionStatus = "running" | "paused" | "ended";

export type Project = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};

export type WorkSession = {
  id: string;
  projectId: string;
  note: string;
  status: SessionStatus;
  segments: Segment[];
};

export type State = {
  projects: Project[];
  sessions: WorkSession[];
};

const STORAGE_KEY = "timetracker:v1";

export const PROJECT_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#d946ef",
  "#84cc16",
  "#f97316",
];

const EMPTY: State = { projects: [], sessions: [] };

let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    state = EMPTY;
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable — keep the in-memory state
  }
}

function setState(next: State) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    try {
      state = e.newValue ? { ...EMPTY, ...JSON.parse(e.newValue) } : EMPTY;
    } catch {
      return;
    }
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

function getServerSnapshot() {
  return EMPTY;
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Close the open segment (if any) of a session at `now`. */
function closeSegments(segments: Segment[], now: number): Segment[] {
  return segments.map((s) => (s.end === null ? { ...s, end: now } : s));
}

/**
 * Move a session's start (and end, for ended sessions) while keeping any
 * pauses that still fall within the new range.
 */
export function retime(
  segments: Segment[],
  status: SessionStatus,
  start: number,
  end: number | null,
): Segment[] {
  const limit = end ?? Infinity;
  const kept = segments
    .filter((seg) => (seg.end ?? Infinity) > start && seg.start < limit)
    .map((seg) => ({
      start: Math.max(seg.start, start),
      end: seg.end === null ? null : Math.min(seg.end, limit),
    }));

  if (kept.length === 0) {
    // New range doesn't overlap any recorded segment: use one segment.
    if (status === "running") return [{ start, end: null }];
    if (status === "paused") return [{ start, end: start }];
    return [{ start, end }];
  }
  kept[0].start = start;
  if (end !== null) kept[kept.length - 1].end = end;
  return kept;
}

export function getActiveSession(s: State): WorkSession | undefined {
  return s.sessions.find((x) => x.status !== "ended");
}

export function sessionDuration(session: WorkSession, now: number): number {
  return session.segments.reduce(
    (sum, seg) => sum + ((seg.end ?? now) - seg.start),
    0,
  );
}

export function sessionStart(session: WorkSession): number {
  return session.segments[0]?.start ?? 0;
}

export function sessionEnd(session: WorkSession): number | null {
  const last = session.segments[session.segments.length - 1];
  return last?.end ?? null;
}

export const actions = {
  addProject(name: string, color: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState({
      ...state,
      projects: [
        ...state.projects,
        { id: uid(), name: trimmed, color, createdAt: Date.now() },
      ],
    });
  },

  renameProject(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState({
      ...state,
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name: trimmed } : p,
      ),
    });
  },

  deleteProject(id: string) {
    setState({
      projects: state.projects.filter((p) => p.id !== id),
      sessions: state.sessions.filter((s) => s.projectId !== id),
    });
  },

  /** Start working on a project. Any other active session is ended first. */
  start(projectId: string, note = "") {
    const now = Date.now();
    const sessions = state.sessions.map((s) =>
      s.status === "ended"
        ? s
        : { ...s, status: "ended" as const, segments: closeSegments(s.segments, now) },
    );
    sessions.push({
      id: uid(),
      projectId,
      note: note.trim(),
      status: "running",
      segments: [{ start: now, end: null }],
    });
    setState({ ...state, sessions });
  },

  pause(sessionId: string) {
    const now = Date.now();
    setState({
      ...state,
      sessions: state.sessions.map((s) =>
        s.id === sessionId && s.status === "running"
          ? { ...s, status: "paused", segments: closeSegments(s.segments, now) }
          : s,
      ),
    });
  },

  resume(sessionId: string) {
    const now = Date.now();
    setState({
      ...state,
      sessions: state.sessions.map((s) =>
        s.id === sessionId && s.status === "paused"
          ? { ...s, status: "running", segments: [...s.segments, { start: now, end: null }] }
          : s,
      ),
    });
  },

  end(sessionId: string) {
    const now = Date.now();
    setState({
      ...state,
      sessions: state.sessions.map((s) =>
        s.id === sessionId && s.status !== "ended"
          ? { ...s, status: "ended", segments: closeSegments(s.segments, now) }
          : s,
      ),
    });
  },

  updateNote(sessionId: string, note: string) {
    setState({
      ...state,
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, note } : s,
      ),
    });
  },

  /** Log a finished session after the fact (for work you forgot to track). */
  addSession(projectId: string, note: string, start: number, end: number) {
    if (!(end > start)) return;
    setState({
      ...state,
      sessions: [
        ...state.sessions,
        {
          id: uid(),
          projectId,
          note: note.trim(),
          status: "ended",
          segments: [{ start, end }],
        },
      ],
    });
  },

  /**
   * Edit a session. `end` is ignored for active sessions (they have no end
   * yet); pauses that still fall inside the new start/end are kept.
   */
  updateSession(
    sessionId: string,
    patch: { projectId: string; note: string; start: number; end: number | null },
  ) {
    setState({
      ...state,
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const end = s.status === "ended" ? patch.end : null;
        if (end !== null && !(end > patch.start)) return s;
        return {
          ...s,
          projectId: patch.projectId,
          note: patch.note.trim(),
          segments: retime(s.segments, s.status, patch.start, end),
        };
      }),
    });
  },

  deleteSession(sessionId: string) {
    setState({
      ...state,
      sessions: state.sessions.filter((s) => s.id !== sessionId),
    });
  },
};
