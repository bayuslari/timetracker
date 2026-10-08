"use client";

import { useEffect, useRef, useState } from "react";
import {
  actions,
  retime,
  sessionEnd,
  sessionStart,
  type Project,
  type WorkSession,
} from "@/lib/store";
import { formatDuration } from "@/lib/format";

const pad = (n: number) => n.toString().padStart(2, "0");

function toDateInput(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputs(date: string, time: string): number | null {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if ([y, m, d, h, mi].some((n) => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d, h, mi).getTime();
}

export type EditorTarget =
  | { mode: "add" }
  | { mode: "edit"; session: WorkSession };

/**
 * Dialog for adding a missed entry or correcting an existing one.
 * Mount it with a `key` per target so the form resets for each open.
 */
export default function SessionEditor({
  target,
  projects,
  sessions,
  onClose,
}: {
  target: EditorTarget;
  projects: Project[];
  sessions: WorkSession[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editing = target.mode === "edit" ? target.session : undefined;
  const isActive = editing !== undefined && editing.status !== "ended";

  const [initial] = useState(() => {
    const now = Date.now();
    if (editing) {
      const start = sessionStart(editing);
      return {
        start,
        end: editing.status === "ended" ? (sessionEnd(editing) ?? now) : now,
        now,
      };
    }
    // Default a new entry to the hour that just ended.
    return { start: now - 3_600_000, end: now, now };
  });

  const [projectId, setProjectId] = useState(
    editing?.projectId ?? projects[0]?.id ?? "",
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [date, setDate] = useState(toDateInput(initial.start));
  const [startTime, setStartTime] = useState(toTimeInput(initial.start));
  const [endTime, setEndTime] = useState(toTimeInput(initial.end));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const start = fromInputs(date, startTime);
  let end = isActive ? null : fromInputs(date, endTime);
  // An end time earlier than the start means the work ran past midnight.
  const crossesMidnight = start !== null && end !== null && end <= start;
  if (crossesMidnight && end !== null) end += 86_400_000;

  const segments =
    start === null
      ? []
      : editing
        ? retime(editing.segments, editing.status, start, end)
        : end !== null
          ? [{ start, end }]
          : [];
  const duration = segments.reduce(
    (sum, seg) => sum + ((seg.end ?? initial.now) - seg.start),
    0,
  );
  const paused =
    start !== null && end !== null ? end - start - duration : 0;

  let error: string | null = null;
  if (!projectId) error = "Pick a project.";
  else if (start === null || (!isActive && end === null))
    error = "Enter a valid date and time.";
  else if (start > initial.now) error = "Start can't be in the future.";
  else if (end !== null && end > initial.now) error = "End can't be in the future.";
  else if (end !== null && end - start > 24 * 3_600_000)
    error = "An entry can't be longer than 24 hours.";

  const overlaps =
    !error && start !== null
      ? sessions.filter((s) => {
          if (s.id === editing?.id) return false;
          const sStart = sessionStart(s);
          const sEnd = s.status === "ended" ? (sessionEnd(s) ?? sStart) : Infinity;
          return sStart < (end ?? Infinity) && sEnd > start;
        })
      : [];

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (error || start === null) return;
    if (editing) {
      actions.updateSession(editing.id, { projectId, note, start, end });
    } else if (end !== null) {
      actions.addSession(projectId, note, start, end);
    }
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop closes the dialog.
        if (e.target === dialogRef.current) onClose();
      }}
      className="dialog"
    >
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">
            {editing ? "Edit entry" : "Add missed time"}
          </h2>
          <p className="text-sm text-muted">
            {editing
              ? isActive
                ? "Forgot to start the timer? Move the start time back."
                : "Fix the project, note or times of this entry."
              : "Forgot to track? Log the time you worked here."}
          </p>
        </div>

        <label className="field">
          <span>Project</span>
          <select
            className="input"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {!projects.some((p) => p.id === projectId) && (
              <option value={projectId}>Deleted project</option>
            )}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Note</span>
          <input
            className="input"
            placeholder="What did you work on?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-3">
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              className="input"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Start</span>
            <input
              type="time"
              className="input"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="field">
            <span>End</span>
            {isActive ? (
              <input
                className="input"
                disabled
                value={editing?.status === "running" ? "Running" : "Paused"}
              />
            ) : (
              <input
                type="time"
                className="input"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            )}
          </label>
        </div>

        <div className="rounded-lg bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Duration</span>
            <span className="font-mono tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>
          {paused > 0 && (
            <div className="flex justify-between text-xs text-muted">
              <span>Excludes paused time</span>
              <span className="font-mono tabular-nums">
                {formatDuration(paused)}
              </span>
            </div>
          )}
          {crossesMidnight && (
            <p className="text-xs text-muted">Ends the next day.</p>
          )}
        </div>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {overlaps.length > 0 && (
          <p className="text-sm text-[var(--warning)]">
            Heads up: this overlaps {overlaps.length} other entr
            {overlaps.length === 1 ? "y" : "ies"}.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!!error}>
            {editing ? "Save" : "Add entry"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
