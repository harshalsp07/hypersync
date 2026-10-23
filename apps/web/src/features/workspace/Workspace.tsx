import { useState, useEffect, useRef } from "react";
import * as Y from "yjs";
import { UserAvatar } from "../../ui/UserAvatar.js";
import { StatusBadge } from "../../ui/StatusBadge.js";
import { Editor } from "../editor/Editor.js";
import { Canvas } from "../whiteboard/Canvas.js";
import { Player } from "../video/Player.js";
import { CallPanel } from "../calls/CallPanel.js";
import { Timeline } from "../time-travel/Timeline.js";
import { WSProvider, RoomMember } from "../../providers/ws-provider.js";
import config from "../../config.js";

type Feature = "editor" | "whiteboard" | "video" | "calls" | "history";

const FEATURES: { id: Feature; icon: string; label: string }[] = [
  { id: "editor", icon: "⌨", label: "Editor" },
  { id: "whiteboard", icon: "✏", label: "Whiteboard" },
  { id: "video", icon: "▶", label: "Video" },
  { id: "calls", icon: "📞", label: "Calls" },
  { id: "history", icon: "⏱", label: "History" },
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
  const [members, setMembers] = useState<{ id: string; username: string; isYou: boolean }[]>([
    { id: "you", username, isYou: true },
  ]);

  const docRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<WSProvider | null>(null);

  useEffect(() => {
    const doc = docRef.current;
    const wsUrl = `${config.wsUrl}/ws?token=${encodeURIComponent(token)}&room=${encodeURIComponent(roomId)}`;
    const provider = new WSProvider(wsUrl, doc);
    providerRef.current = provider;

    provider.onStatusChange((status) => {
      setConnected(status);
    });

    provider.onMemberList((mList: RoomMember[]) => {
      if (mList && mList.length > 0) {
        setMembers(
          mList.map((m) => ({
            id: m.id,
            username: m.username,
            isYou: m.username === username,
          }))
        );
      }
    });

    provider.connect();

    return () => {
      provider.disconnect();
      doc.destroy();
    };
  }, [roomId, token, username]);

  // Global Drag-and-Drop Auto-Routing to relevant page
  const handleGlobalDrop = (e: React.DragEvent) => {
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      setActiveFeature("whiteboard");
    } else if (file.type.startsWith("video/")) {
      setActiveFeature("video");
    } else {
      setActiveFeature("editor");
    }
  };

  const renderFeature = () => {
    const doc = docRef.current;
    const provider = providerRef.current;

    switch (activeFeature) {
      case "editor":
        return (
          <Editor
            roomId={roomId}
            doc={doc}
            provider={provider}
            members={members}
            connected={connected}
          />
        );
      case "whiteboard":
        return <Canvas doc={doc} username={username} />;
      case "video":
        return <Player provider={provider} username={username} />;
      case "calls":
        return (
          <CallPanel
            roomId={roomId}
            userId={username}
            provider={provider}
            members={members}
          />
        );
      case "history":
        return <Timeline doc={doc} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="workspace"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleGlobalDrop}
    >
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="logo-icon" style={{ fontSize: "20px" }}>⚡</div>
            <span className="brand-text" style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>HyperSync</span>
          </div>
          <div className="room-info">
            <div className="room-name">{roomId}</div>
            <div className="room-id" style={{ fontSize: "11px", color: "var(--text-muted)" }}>Room session</div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Pages & Tools</div>
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
              <div key={m.id || m.username} className="member-item">
                <UserAvatar username={m.username} size="sm" showOnline />
                <span className="member-name">{m.username}</span>
                {m.isYou && <span className="member-you">you</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Global drag-drop hint */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-subtle, #333)", fontSize: "11px", color: "var(--text-muted)" }}>
          💡 Drop code, image, or video anywhere to upload to page
        </div>

        <div style={{ padding: "12px", borderTop: "1px solid var(--border-subtle, #333)" }}>
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
        <div className="content-area">{renderFeature()}</div>
      </div>
    </div>
  );
}
