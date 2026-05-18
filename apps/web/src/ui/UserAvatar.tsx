const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface UserAvatarProps {
  username: string;
  size?: "sm" | "md" | "lg";
  showOnline?: boolean;
}

export function UserAvatar({ username, size = "md", showOnline = false }: UserAvatarProps) {
  const color = COLORS[hashString(username) % COLORS.length];
  const initials = getInitials(username);

  return (
    <div className={`avatar avatar-${size}`} style={{ background: color }} title={username}>
      {initials}
      {showOnline && <span className="online-dot" />}
    </div>
  );
}
