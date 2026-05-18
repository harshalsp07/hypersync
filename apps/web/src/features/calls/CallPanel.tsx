import { useState, useCallback, useRef, useEffect } from "react";

interface PeerConnection {
  userId: string;
  username: string;
  stream: MediaStream | null;
  connection: RTCPeerConnection | null;
}

interface CallPanelProps {
  roomId: string;
  userId: string;
  token: string;
  onLeave?: () => void;
}

export function CallPanel({ roomId, userId, token, onLeave }: CallPanelProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [peers] = useState<Map<string, PeerConnection>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const startCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      setIsInCall(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Failed to get media:", err);
    }
  }, []);

  const endCall = useCallback(() => {
    localStream?.getTracks().forEach((t) => t.stop());
    peers.forEach((p) => p.connection?.close());
    setLocalStream(null);
    setIsInCall(false);
    onLeave?.();
  }, [localStream, peers, onLeave]);

  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted(!isMuted);
  }, [localStream, isMuted]);

  const toggleVideo = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => { t.enabled = isVideoOff; });
    setIsVideoOff(!isVideoOff);
  }, [localStream, isVideoOff]);

  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
      peers.forEach((p) => p.connection?.close());
    };
  }, []);

  if (!isInCall) {
    return (
      <div className="call-wrapper">
        <div className="call-empty">
          <div className="empty-icon">📞</div>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>Start a voice/video call</p>
          <button className="btn-join-call" onClick={startCall}>Join Call</button>
        </div>
      </div>
    );
  }

  return (
    <div className="call-wrapper">
      <div className="call-grid">
        <div className="call-tile speaking">
          <video ref={localVideoRef} autoPlay muted playsInline />
          <span className="tile-name">{userId} (you)</span>
          <div className="tile-speaking">
            <div className="bar" /><div className="bar" /><div className="bar" />
          </div>
        </div>
        {Array.from(peers.entries()).map(([id, peer]) => (
          <div key={id} className="call-tile">
            <video
              ref={(el) => { if (el && peer.stream) el.srcObject = peer.stream; }}
              autoPlay playsInline
            />
            <span className="tile-name">{peer.username}</span>
          </div>
        ))}
      </div>

      <div className="call-controls">
        <button className={`call-ctrl-btn ${isMuted ? "active" : ""}`} onClick={toggleMute} title="Mute">
          {isMuted ? "🔇" : "🎤"}
        </button>
        <button className={`call-ctrl-btn ${isVideoOff ? "active" : ""}`} onClick={toggleVideo} title="Camera">
          {isVideoOff ? "📷" : "📹"}
        </button>
        <button className="call-ctrl-btn" title="Screenshare">🖥</button>
        <button className="call-ctrl-btn leave" onClick={endCall} title="Leave">📞</button>
      </div>
    </div>
  );
}
