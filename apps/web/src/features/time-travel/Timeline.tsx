import { useState, useCallback } from "react";

interface Snapshot {
  id: number;
  operationCount: number;
  eventLabel?: string;
  createdAt: Date;
}

interface TimelineProps {
  snapshots: Snapshot[];
  onSnapshotSelect?: (snapshotId: number) => void;
  onFork?: (snapshotId: number) => void;
}

export function Timeline({ snapshots, onSnapshotSelect, onFork }: TimelineProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleClick = useCallback(
    (index: number, snapshot: Snapshot) => {
      setSelectedIndex(index);
      onSnapshotSelect?.(snapshot.id);
    },
    [onSnapshotSelect]
  );

  const handleFork = useCallback(() => {
    if (selectedIndex !== null && snapshots[selectedIndex]) {
      onFork?.(snapshots[selectedIndex].id);
    }
  }, [selectedIndex, snapshots, onFork]);

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (snapshots.length === 0) {
    return (
      <div className="timeline-wrapper">
        <div className="timeline-empty">
          <div className="empty-icon">🕐</div>
          <p style={{ color: "var(--text-secondary)" }}>No history yet</p>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Snapshots are created automatically as you edit
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-wrapper">
      <div className="timeline-header">
        <h3>Document History</h3>
        {selectedIndex !== null && (
          <button className="btn-fork" onClick={handleFork}>Fork from here</button>
        )}
      </div>

      <div className="timeline-track">
        <div className="timeline-line" />
        {snapshots.map((snap, i) => (
          <div
            key={snap.id}
            className={`timeline-dot ${selectedIndex === i ? "selected" : ""}`}
            style={{ left: `${(i / Math.max(snapshots.length - 1, 1)) * 100}%` }}
            onClick={() => handleClick(i, snap)}
          >
            <div className="dot-marker" />
            <div className="dot-label">
              {fmt(snap.createdAt)}
              {snap.eventLabel && <span className="event-tag">{snap.eventLabel}</span>}
            </div>
          </div>
        ))}
      </div>

      {selectedIndex !== null && snapshots[selectedIndex] && (
        <div className="timeline-info">
          <p><strong>Operations:</strong> {snapshots[selectedIndex].operationCount}</p>
          <p><strong>Time:</strong> {fmt(snapshots[selectedIndex].createdAt)}</p>
          {snapshots[selectedIndex].eventLabel && (
            <p><strong>Event:</strong> {snapshots[selectedIndex].eventLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
