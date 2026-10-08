"use client";

import { useMemo, useState } from "react";
import {
  PROJECT_COLORS,
  actions,
  getActiveSession,
  sessionDuration,
  sessionEnd,
  sessionStart,
  useStore,
  type Project,
  type WorkSession,
} from "@/lib/store";
import { useNow } from "@/lib/useNow";
import SessionEditor, { type EditorTarget } from "@/components/SessionEditor";
import {
  dayKey,
  formatDay,
  formatDuration,
  formatTime,
  startOfDay,
} from "@/lib/format";

/** Time a session spent inside [from, to). */
function overlap(session: WorkSession, from: number, to: number) {
  return session.segments.reduce((sum, seg) => {
    const a = Math.max(seg.start, from);
    const b = Math.min(seg.end ?? to, to);
    return sum + Math.max(0, b - a);
  }, 0);
}

export default function TimeTracker() {
  const state = useStore();
  const active = getActiveSession(state);
  const now = useNow(active?.status === "running", state);

  const projectsById = useMemo(
    () => new Map(state.projects.map((p) => [p.id, p])),
    [state.projects],
  );

  const todayStart = startOfDay(now);
  const todayTotal = state.sessions.reduce(
    (sum, s) => sum + overlap(s, todayStart, now),
    0,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time Tracker</h1>
          <p className="text-sm text-muted">
            Log projects, start working, pause, and end sessions.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-muted">
            Tracked today
          </div>
          <div className="font-mono text-2xl tabular-nums">
            {formatDuration(todayTotal)}
          </div>
        </div>
      </header>

      <ActiveTimer
        session={active}
        project={active ? projectsById.get(active.projectId) : undefined}
        now={now}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <ProjectsPanel
          projects={state.projects}
          sessions={state.sessions}
          active={active}
          now={now}
          todayStart={todayStart}
        />
        <SessionLog
          projects={state.projects}
          sessions={state.sessions}
          projectsById={projectsById}
          now={now}
        />
      </div>
    </div>
  );
}

function ActiveTimer({
  session,
  project,
  now,
}: {
  session?: WorkSession;
  project?: Project;
  now: number;
}) {
  if (!session || !project) {
    return (
      <section className="card flex flex-col items-center justify-center gap-1 py-10 text-center">
        <div className="font-mono text-5xl tabular-nums text-muted">
          00:00:00
        </div>
        <p className="text-sm text-muted">
          Not tracking. Pick a project below and press <b>Start</b>.
        </p>
      </section>
    );
  }

  const running = session.status === "running";

  return (
    <section
      className="card flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: project.color }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`size-2.5 rounded-full ${running ? "animate-pulse" : ""}`}
            style={{ background: running ? project.color : "var(--muted)" }}
          />
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {running ? "Working on" : "Paused"}
          </span>
        </div>
        <h2 className="mt-1 truncate text-xl font-semibold">{project.name}</h2>
        <input
          className="input mt-3 w-full"
          placeholder="What are you working on?"
          value={session.note}
          onChange={(e) => actions.updateNote(session.id, e.target.value)}
        />
        <p className="mt-2 text-xs text-muted">
          Started {formatTime(sessionStart(session))}
          {session.segments.length > 1 &&
            ` · ${session.segments.length - 1} pause${session.segments.length > 2 ? "s" : ""}`}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 sm:items-end">
        <div className="font-mono text-5xl tabular-nums">
          {formatDuration(sessionDuration(session, now))}
        </div>
        <div className="flex gap-2">
          {running ? (
            <button
              className="btn btn-secondary"
              onClick={() => actions.pause(session.id)}
            >
              Pause
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => actions.resume(session.id)}
            >
              Resume
            </button>
          )}
          <button
            className="btn btn-danger"
            onClick={() => actions.end(session.id)}
          >
            End
          </button>
        </div>
      </div>
    </section>
  );
}

function ProjectsPanel({
  projects,
  sessions,
  active,
  now,
  todayStart,
}: {
  projects: Project[];
  sessions: WorkSession[];
  active?: WorkSession;
  now: number;
  todayStart: number;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    actions.addProject(name, color);
    setName("");
    setColor(PROJECT_COLORS[(projects.length + 1) % PROJECT_COLORS.length]);
  };

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Projects
      </h2>

      <form onSubmit={add} className="card mb-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="New project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Project color">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={`size-6 rounded-full ring-offset-2 ring-offset-[var(--card)] transition ${
                c === color ? "ring-2 ring-[var(--foreground)]" : ""
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </form>

      {projects.length === 0 ? (
        <p className="card text-sm text-muted">
          No projects yet. Add one above to start tracking time.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((p) => {
            const projectSessions = sessions.filter((s) => s.projectId === p.id);
            const today = projectSessions.reduce(
              (sum, s) => sum + overlap(s, todayStart, now),
              0,
            );
            const total = projectSessions.reduce(
              (sum, s) => sum + sessionDuration(s, now),
              0,
            );
            const isActive = active?.projectId === p.id;
            return (
              <ProjectRow
                key={p.id}
                project={p}
                today={today}
                total={total}
                isActive={isActive}
                activeStatus={isActive ? active?.status : undefined}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ProjectRow({
  project,
  today,
  total,
  isActive,
  activeStatus,
}: {
  project: Project;
  today: number;
  total: number;
  isActive: boolean;
  activeStatus?: WorkSession["status"];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);

  const save = () => {
    actions.renameProject(project.id, draft);
    setEditing(false);
  };

  return (
    <li className="card flex items-center gap-3 py-3">
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ background: project.color }}
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            className="input w-full py-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraft(project.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className="block max-w-full truncate text-left font-medium hover:underline"
            title="Rename"
            onClick={() => {
              setDraft(project.name);
              setEditing(true);
            }}
          >
            {project.name}
          </button>
        )}
        <div className="text-xs text-muted tabular-nums">
          Today {formatDuration(today, false)} · Total {formatDuration(total, false)}
        </div>
      </div>
      {isActive ? (
        <span className="text-xs font-medium text-muted">
          {activeStatus === "running" ? "Tracking…" : "Paused"}
        </span>
      ) : (
        <button
          className="btn btn-primary"
          onClick={() => actions.start(project.id)}
        >
          Start
        </button>
      )}
      <button
        className="btn btn-ghost px-2"
        aria-label={`Delete ${project.name}`}
        title="Delete project"
        onClick={() => {
          if (
            confirm(
              `Delete "${project.name}" and all of its logged sessions?`,
            )
          )
            actions.deleteProject(project.id);
        }}
      >
        ✕
      </button>
    </li>
  );
}

function SessionLog({
  projects,
  sessions,
  projectsById,
  now,
}: {
  projects: Project[];
  sessions: WorkSession[];
  projectsById: Map<string, Project>;
  now: number;
}) {
  const [editor, setEditor] = useState<{ key: number; target: EditorTarget } | null>(null);
  const openEditor = (target: EditorTarget) =>
    setEditor((prev) => ({ key: (prev?.key ?? 0) + 1, target }));

  const groups = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => sessionStart(b) - sessionStart(a),
    );
    const map = new Map<string, WorkSession[]>();
    for (const s of sorted) {
      const key = dayKey(sessionStart(s));
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return [...map.values()];
  }, [sessions]);

  const exportCsv = () => {
    const rows = [
      ["Project", "Note", "Status", "Start", "End", "Duration (minutes)", "Pauses"],
      ...[...sessions]
        .sort((a, b) => sessionStart(a) - sessionStart(b))
        .map((s) => {
          const end = s.status === "ended" ? sessionEnd(s) : null;
          return [
            projectsById.get(s.projectId)?.name ?? "",
            s.note,
            s.status,
            new Date(sessionStart(s)).toISOString(),
            end ? new Date(end).toISOString() : "",
            (sessionDuration(s, Date.now()) / 60000).toFixed(1),
            String(Math.max(0, s.segments.length - 1)),
          ];
        }),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `timetracker-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Log
        </h2>
        <div className="flex gap-1">
          {sessions.length > 0 && (
            <button className="btn btn-ghost text-xs" onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button
            className="btn btn-ghost text-xs"
            disabled={projects.length === 0}
            title={projects.length === 0 ? "Add a project first" : undefined}
            onClick={() => openEditor({ mode: "add" })}
          >
            + Add missed time
          </button>
        </div>
      </div>

      {editor && (
        <SessionEditor
          key={editor.key}
          target={editor.target}
          projects={projects}
          sessions={sessions}
          onClose={() => setEditor(null)}
        />
      )}

      {groups.length === 0 ? (
        <p className="card text-sm text-muted">
          Your work sessions will appear here.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => {
            const dayTotal = group.reduce(
              (sum, s) => sum + sessionDuration(s, now),
              0,
            );
            return (
              <div key={dayKey(sessionStart(group[0]))}>
                <div className="mb-2 flex items-baseline justify-between text-sm">
                  <span className="font-medium">
                    {formatDay(sessionStart(group[0]), now)}
                  </span>
                  <span className="font-mono text-muted tabular-nums">
                    {formatDuration(dayTotal)}
                  </span>
                </div>
                <ul className="card divide-y divide-[var(--border)] p-0">
                  {group.map((s) => {
                    const project = projectsById.get(s.projectId);
                    const end = sessionEnd(s);
                    return (
                      <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: project?.color ?? "var(--muted)" }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {project?.name ?? "Deleted project"}
                            {s.note && (
                              <span className="font-normal text-muted"> — {s.note}</span>
                            )}
                          </div>
                          <div className="text-xs text-muted tabular-nums">
                            {formatTime(sessionStart(s))} –{" "}
                            {s.status === "ended" && end
                              ? formatTime(end)
                              : s.status === "running"
                                ? "now"
                                : "paused"}
                            {s.segments.length > 1 &&
                              ` · ${s.segments.length - 1} pause${s.segments.length > 2 ? "s" : ""}`}
                          </div>
                        </div>
                        {s.status !== "ended" && (
                          <span className="badge">{s.status}</span>
                        )}
                        <span className="font-mono text-sm tabular-nums">
                          {formatDuration(sessionDuration(s, now))}
                        </span>
                        <button
                          className="btn btn-ghost px-2 text-xs"
                          aria-label="Edit entry"
                          title="Edit entry"
                          onClick={() => openEditor({ mode: "edit", session: s })}
                        >
                          ✎
                        </button>
                        <button
                          className="btn btn-ghost -ml-2 px-2 text-xs"
                          aria-label="Delete entry"
                          title="Delete entry"
                          onClick={() => {
                            if (confirm("Delete this entry?"))
                              actions.deleteSession(s.id);
                          }}
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
