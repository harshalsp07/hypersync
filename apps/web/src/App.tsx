import { useState, useCallback } from "react";
import { Workspace } from "./features/workspace/Workspace.js";

const DEMO_ROOMS = [
  { id: "standup", icon: "☕", name: "Daily Standup", desc: "Team sync" },
  { id: "design-review", icon: "🎨", name: "Design Review", desc: "Visual feedback" },
  { id: "hackathon", icon: "🚀", name: "Hackathon", desc: "Build together" },
];

const WORDS = [
  "alpha", "nebula", "quantum", "vertex", "prism", "echo", "pulse", "flux",
  "nova", "apex", "drift", "spark", "bolt", "haze", "dawn", "frost",
];

function generateRoomName() {
  const a = WORDS[Math.floor(Math.random() * WORDS.length)];
  const b = WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${a}-${b}`;
}

export default function App() {
  const [screen, setScreen] = useState<"landing" | "workspace">("landing");
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("dev-token");

  const joinRoom = useCallback((id: string) => {
    const name = username.trim() || `user-${Math.floor(Math.random() * 9999)}`;
    setUsername(name);
    setRoomId(id);
    setToken(`token-${name}-${Date.now()}`);
    setScreen("workspace");
  }, [username]);

  const handleJoin = useCallback(() => {
    const id = roomId.trim() || generateRoomName();
    joinRoom(id);
  }, [roomId, joinRoom]);

  const handleLeave = useCallback(() => {
    setScreen("landing");
    setRoomId("");
  }, []);

  if (screen === "workspace") {
    return (
      <Workspace
        roomId={roomId}
        username={username}
        token={token}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="mesh-orb" />
        <div className="mesh-orb" />
        <div className="mesh-orb" />
      </div>
      <div className="landing-grid" />

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">⚡</div>
          <h1>HyperSync Engine</h1>
          <p>Real-Time Collaborative Workspace</p>
        </div>

        <div className="form-group">
          <label>Your Name</label>
          <input
            className="form-input"
            type="text"
            placeholder="e.g. alice"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Room</label>
          <div className="form-input-row">
            <input
              className="form-input"
              type="text"
              placeholder="e.g. design-review"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            <button
              className="btn-random"
              onClick={() => setRoomId(generateRoomName())}
              title="Generate random room name"
            >
              🎲
            </button>
          </div>
        </div>

        <button className="btn-primary" onClick={handleJoin}>
          Join Room
        </button>

        <div className="login-divider">or join a quick room</div>

        <div className="quick-rooms">
          {DEMO_ROOMS.map((room) => (
            <button
              key={room.id}
              className="quick-room-btn"
              onClick={() => joinRoom(room.id)}
            >
              <span className="room-icon">{room.icon}</span>
              <span className="room-name">{room.name}</span>
              <span className="room-desc">{room.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
