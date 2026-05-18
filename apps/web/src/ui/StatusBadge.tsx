type Status = "connected" | "reconnecting" | "offline";

interface StatusBadgeProps {
  status: Status;
  label?: string;
}

const LABELS: Record<Status, string> = {
  connected: "Connected",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${status}`}>
      <span className="status-dot" />
      {label || LABELS[status]}
    </span>
  );
}
