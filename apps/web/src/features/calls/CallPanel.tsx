import { useState, useCallback, useRef, useEffect } from "react";
import { WSProvider, RoomMember } from "../../providers/ws-provider.js";

interface PeerConnection {
  userId: string;
  username: string;
  stream: MediaStream | null;
  connection: RTCPeerConnection | null;
}

interface CallPanelProps {
  roomId: string;
  userId: string;
  token?: string;
  provider?: WSProvider | null;
  members?: RoomMember[];
  onLeave?: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function CallPanel({ roomId, userId, provider, members = [], onLeave }: CallPanelProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize WebRTC signaling listener
  useEffect(() => {
    if (!provider || !isInCall) return;

    provider.onWebRTCSignal(async (signal) => {
      const fromPeer = signal.from;
      if (!fromPeer || fromPeer === userId) return;

      if (signal.type === "offer") {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        if (localStream) {
          localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            provider.sendWebRTCSignal({
              type: "ice-candidate",
              to: fromPeer,
              data: event.candidate,
            });
          }
        };

        pc.ontrack = (event) => {
          setPeers((prev) => {
            const next = new Map(prev);
            const peer = next.get(fromPeer) || {
              userId: fromPeer,
              username: members.find((m) => m.id === fromPeer)?.username || fromPeer,
              stream: null,
              connection: pc,
            };
            peer.stream = event.streams[0];
            next.set(fromPeer, peer);
            return next;
          });
        };

        await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        provider.sendWebRTCSignal({
          type: "answer",
          to: fromPeer,
          data: answer,
        });

        setPeers((prev) => {
          const next = new Map(prev);
          next.set(fromPeer, {
            userId: fromPeer,
            username: members.find((m) => m.id === fromPeer)?.username || fromPeer,
            stream: null,
            connection: pc,
          });
          return next;
        });
      } else if (signal.type === "answer") {
        const peer = peers.get(fromPeer);
        if (peer?.connection) {
          await peer.connection.setRemoteDescription(new RTCSessionDescription(signal.data));
        }
      } else if (signal.type === "ice-candidate") {
        const peer = peers.get(fromPeer);
        if (peer?.connection && signal.data) {
          await peer.connection.addIceCandidate(new RTCIceCandidate(signal.data));
        }
      }
    });
  }, [provider, isInCall, localStream, peers, userId, members]);

  const startCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      setIsInCall(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Send offers to active room peers
      if (provider) {
        for (const m of members) {
          if (m.id !== userId) {
            const pc = new RTCPeerConnection(ICE_SERVERS);
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                provider.sendWebRTCSignal({
                  type: "ice-candidate",
                  to: m.id,
                  data: event.candidate,
                });
              }
            };

            pc.ontrack = (event) => {
              setPeers((prev) => {
                const next = new Map(prev);
                next.set(m.id, {
                  userId: m.id,
                  username: m.username,
                  stream: event.streams[0],
                  connection: pc,
                });
                return next;
              });
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            provider.sendWebRTCSignal({
              type: "offer",
              to: m.id,
              data: offer,
            });

            setPeers((prev) => {
              const next = new Map(prev);
              next.set(m.id, {
                userId: m.id,
                username: m.username,
                stream: null,
                connection: pc,
              });
              return next;
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to get media devices:", err);
      // Fallback: mock call mode for devices without camera/mic permissions
      setIsInCall(true);
    }
  }, [provider, members, userId]);

  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
          setIsScreenSharing(false);
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error("Screen share error:", err);
      }
    } else {
      if (localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      setIsScreenSharing(false);
    }
  }, [isScreenSharing, localStream]);

  const endCall = useCallback(() => {
    localStream?.getTracks().forEach((t) => t.stop());
    peers.forEach((p) => p.connection?.close());
    setPeers(new Map());
    setLocalStream(null);
    setIsInCall(false);
    setIsScreenSharing(false);
    onLeave?.();
  }, [localStream, peers, onLeave]);

  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = isMuted;
    });
    setIsMuted(!isMuted);
  }, [localStream, isMuted]);

  const toggleVideo = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = isVideoOff;
    });
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
      <div className="call-wrapper" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div className="call-empty" style={{ textAlign: "center", padding: "40px" }}>
          <div className="empty-icon" style={{ fontSize: "48px", marginBottom: "16px" }}>
            📞
          </div>
          <h3 style={{ marginBottom: "8px" }}>Live WebRTC Audio & Video Calls</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "20px" }}>
            Peer-to-peer encrypted calls with screensharing and real-time room mesh.
          </p>
          <button className="btn-primary" style={{ padding: "10px 24px", fontSize: "14px", fontWeight: "bold" }} onClick={startCall}>
            Join Room Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="call-wrapper" style={{ display: "flex", flexDirection: "column", height: "100%", gap: "12px" }}>
      <div className="call-grid" style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
        <div className="call-tile speaking" style={{ position: "relative", background: "#111", borderRadius: "8px", overflow: "hidden", minHeight: "200px" }}>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <span className="tile-name" style={{ position: "absolute", bottom: "10px", left: "10px", background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" }}>
            {userId} (you) {isScreenSharing ? "🖥️ Screen" : ""}
          </span>
          <div className="tile-speaking" style={{ position: "absolute", top: "10px", right: "10px" }}>
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
          </div>
        </div>

        {Array.from(peers.entries()).map(([id, peer]) => (
          <div key={id} className="call-tile" style={{ position: "relative", background: "#111", borderRadius: "8px", overflow: "hidden", minHeight: "200px" }}>
            <video
              ref={(el) => {
                if (el && peer.stream) el.srcObject = peer.stream;
              }}
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <span className="tile-name" style={{ position: "absolute", bottom: "10px", left: "10px", background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" }}>
              {peer.username}
            </span>
          </div>
        ))}
      </div>

      <div className="call-controls" style={{ display: "flex", justifyContent: "center", gap: "12px", padding: "12px", background: "var(--bg-secondary, #1a1a24)", borderRadius: "8px" }}>
        <button className={`call-ctrl-btn ${isMuted ? "active" : ""}`} onClick={toggleMute} title="Toggle Mic">
          {isMuted ? "🔇 Muted" : "🎤 Mic On"}
        </button>
        <button className={`call-ctrl-btn ${isVideoOff ? "active" : ""}`} onClick={toggleVideo} title="Toggle Camera">
          {isVideoOff ? "📷 Cam Off" : "📹 Cam On"}
        </button>
        <button className={`call-ctrl-btn ${isScreenSharing ? "active" : ""}`} onClick={toggleScreenShare} title="Toggle Screenshare">
          {isScreenSharing ? "🛑 Stop Share" : "🖥️ Share Screen"}
        </button>
        <button className="call-ctrl-btn leave" onClick={endCall} style={{ background: "var(--red, #ef4444)", color: "#fff" }} title="Leave Call">
          End Call
        </button>
      </div>
    </div>
  );
}
