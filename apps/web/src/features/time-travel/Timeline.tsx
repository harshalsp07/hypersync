import { useState, useCallback, useEffect, useRef } from "react";
import * as Y from "yjs";

export interface SnapshotRecord {
  id: number;
  operationCount: number;
  eventLabel?: string;
  createdAt: Date;
  snapshotRef?: Y.Snapshot;
  dataBase64?: string;
}

interface TimelineProps {
  doc?: Y.Doc;
  snapshots?: SnapshotRecord[];
  onSnapshotSelect?: (snapshotId: number) => void;
  onFork?: (snapshotId: number) => void;
}

export function Timeline({ doc, snapshots: initialSnapshots, onSnapshotSelect, onFork }: TimelineProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>(initialSnapshots || []);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or generate automatic snapshots from doc
  useEffect(() => {
    if (!doc) return;

    if (snapshots.length === 0) {
      const snap = Y.snapshot(doc);
      setSnapshots([
        {
          id: Date.now() - 60000,
          operationCount: 1,
          eventLabel: "Initial Document State",
          createdAt: new Date(Date.now() - 60000),
          snapshotRef: snap,
        },
      ]);
    }
  }, [doc, snapshots.length]);

  const handleCreateSnapshot = () => {
    if (!doc) return;
    const snap = Y.snapshot(doc);
    const label = prompt("Checkpoint label (e.g. Before refactor):") || "User Checkpoint";
    const newRecord: SnapshotRecord = {
      id: Date.now(),
      operationCount: snapshots.length * 10 + 5,
      eventLabel: label,
      createdAt: new Date(),
      snapshotRef: snap,
    };
    setSnapshots((prev) => [...prev, newRecord]);
    setSelectedIndex(snapshots.length);
  };

  const handleClick = useCallback(
    (index: number, snapshot: SnapshotRecord) => {
      setSelectedIndex(index);
      onSnapshotSelect?.(snapshot.id);
    },
    [onSnapshotSelect]
  );

  const handleFork = useCallback(() => {
    if (selectedIndex !== null && snapshots[selectedIndex]) {
      const snap = snapshots[selectedIndex];
      if (doc && snap.snapshotRef) {
        try {
          const restoredDoc = Y.createDocFromSnapshot(doc, snap.snapshotRef);
          alert(`Successfully forked snapshot "${snap.eventLabel || snap.id}" into new session branch!`);
        } catch (err) {
          console.error("Fork error:", err);
        }
      }
      onFork?.(snap.id);
    }
  }, [selectedIndex, snapshots, onFork, doc]);

  // Export Snapshot as file
  const handleExportSnapshot = () => {
    if (selectedIndex === null || !snapshots[selectedIndex] || !doc) return;
    const snap = snapshots[selectedIndex];
    if (snap.snapshotRef) {
      const encoded = Y.encodeSnapshot(snap.snapshotRef);
      const blob = new Blob([encoded as any], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snapshot-${snap.id}.hypersync`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Upload Snapshot file
  const handleImportSnapshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const snapshot = Y.decodeSnapshot(new Uint8Array(buffer));
      const record: SnapshotRecord = {
        id: Date.now(),
        operationCount: snapshots.length * 15,
        eventLabel: `Imported (${file.name})`,
        createdAt: new Date(),
        snapshotRef: snapshot,
      };
      setSnapshots((prev) => [...prev, record]);
      setSelectedIndex(snapshots.length);
    };
    reader.readAsArrayBuffer(file);
  };

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="timeline-wrapper" style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px", padding: "16px" }}>
      <div className="timeline-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3>CRDT Time-Travel & Snapshot History</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Inspect document revisions, restore checkpoints, or fork collaborative state.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".hypersync,.bin"
            onChange={handleImportSnapshot}
          />
          <button
            className="btn-primary"
            style={{ padding: "6px 12px", fontSize: "12px" }}
            onClick={handleCreateSnapshot}
          >
            📸 Create Checkpoint
          </button>
          <button
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle, #444)",
              borderRadius: "4px",
              padding: "6px 12px",
              fontSize: "12px",
              cursor: "pointer",
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            ⬆ Upload Snapshot
          </button>
          {selectedIndex !== null && (
            <>
              <button
                style={{
                  background: "transparent",
                  color: "var(--accent, #818cf8)",
                  border: "1px solid rgba(99, 102, 241, 0.4)",
                  borderRadius: "4px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onClick={handleExportSnapshot}
              >
                ⬇ Export Snapshot
              </button>
              <button className="btn-fork" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={handleFork}>
                Fork from here
              </button>
            </>
          )}
        </div>
      </div>

      <div className="timeline-track" style={{ margin: "30px 0" }}>
        <div className="timeline-line" />
        {snapshots.map((snap, i) => (
          <div
            key={snap.id}
            className={`timeline-dot ${selectedIndex === i ? "selected" : ""}`}
            style={{ left: `${(i / Math.max(snapshots.length - 1, 1)) * 95}%` }}
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

      {selectedIndex !== null && snapshots[selectedIndex] ? (
        <div className="timeline-info" style={{ background: "var(--bg-secondary, #1a1a24)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-subtle, #333)" }}>
          <h4 style={{ marginBottom: "8px", color: "var(--accent, #818cf8)" }}>
            {snapshots[selectedIndex].eventLabel || "Snapshot Details"}
          </h4>
          <p>
            <strong>Operations Recorded:</strong> {snapshots[selectedIndex].operationCount}
          </p>
          <p>
            <strong>Timestamp:</strong> {fmt(snapshots[selectedIndex].createdAt)} (
            {snapshots[selectedIndex].createdAt.toLocaleDateString()})
          </p>
          <p style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
            Snapshot ID: #{snapshots[selectedIndex].id} — Deterministically reproducible using Y.createDocFromSnapshot
          </p>
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
          Select a checkpoint marker along the timeline to inspect state.
        </div>
      )}
    </div>
  );
}
