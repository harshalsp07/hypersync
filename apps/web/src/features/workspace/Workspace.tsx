import { useState } from "react";
import { UserAvatar } from "../../ui/UserAvatar.js";
import { StatusBadge } from "../../ui/StatusBadge.js";
import { Editor } from "../editor/Editor.js";
import { Canvas } from "../whiteboard/Canvas.js";
import { Player } from "../video/Player.js";
import { CallPanel } from "../calls/CallPanel.js";
import { Timeline } from "../time-travel/Timeline.js";

type Feature = "editor" | "whiteboard" | "video" | "calls" | "history";

const FEATURES: { id: Feature; icon: string; label: string }[] = [
  { id: "editor", icon: "⌨", label: "Editor" },
  { id: "whiteboard", icon: "✏", label: "Whiteboard" },
  { id: "video", icon: "▶", label: "Video" },
  { id: "calls", icon: "📞", label: "Calls" },
  { id: "history", icon: "🕐", label: "History" },
];

interface WorkspaceProps {
  roomId: string;
  username: string;
  token: string;
  onLeave: () => void;
}

export function Workspace({ roomId, username, token, onLeave }: WorkspaceProps) {
  const [activeFeature, setActiveFeature] = useState<Feature>("editor");
  const [connected, setConnected] = useState(false);
  const [members] = useState([
    { username, isYou: true },
    { username: "alice", isYou: false },
    { username: "bob", isYou: false },
  ]);

  const renderFeature = () => {
    switch (activeFeature) {
      case "editor":
        return <Editor roomId={roomId} token={token} onConnect={() => setConnected(true)} />;
      case "whiteboard":
        return <Canvas shapes={[]} />;
      case "video":
        return <Player src="" videoId="" />;
      case "calls":
        return <CallPanel roomId={roomId} userId={username} token={token} />;
      case "history":
        return <Timeline snapshots={[]} />;
      default:
        return null;
    }
  };

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">⚡</div>
            <span className="brand-text">HyperSync</span>
          </div>
          <div className="room-info">
            <div className="room-name">{roomId}</div>
            <div className="room-id">{roomId}</div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Features</div>
          <nav className="sidebar-nav">
            {FEATURES.map((f) => (
              <button
                key={f.id}
                className={`sidebar-item ${activeFeature === f.id ? "active" : ""}`}
                onClick={() => setActiveFeature(f.id)}
              >
                <span className="item-icon">{f.icon}</span>
                {f.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-section" style={{ flex: 1, overflow: "auto" }}>
          <div className="sidebar-section-title">
            Members ({members.length})
          </div>
          <div className="member-list">
            {members.map((m) => (
              <div key={m.username} className="member-item">
                <UserAvatar username={m.username} size="sm" showOnline />
                <span className="member-name">{m.username}</span>
                {m.isYou && <span className="member-you">you</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px", borderTop: "1px solid var(--border-subtle)" }}>
          <StatusBadge status={connected ? "connected" : "reconnecting"} />
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-breadcrumb">
              Room / <span className="crumb-active">{FEATURES.find((f) => f.id === activeFeature)?.label}</span>
            </div>
          </div>
          <div className="topbar-right">
            <UserAvatar username={username} size="sm" />
            <button className="topbar-btn danger" onClick={onLeave}>
              Leave
            </button>
          </div>
        </header>
        <div className="content-area">
          {renderFeature()}
        </div>
      </div>
    </div>
  );
}
