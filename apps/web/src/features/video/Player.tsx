import { useState, useEffect, useRef, useCallback } from "react";
import { WSProvider } from "../../providers/ws-provider.js";
import { useSyncEngine } from "./sync-engine.js";

interface PlayerProps {
  src?: string;
  videoId?: string;
  provider?: WSProvider | null;
  username?: string;
  onStateChange?: (state: string) => void;
}

const DEMO_VIDEOS = [
  {
    name: "Big Buck Bunny (MP4)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    name: "Elephants Dream (MP4)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  },
  {
    name: "For Bigger Blazes (MP4)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
];

export function Player({ src: initialSrc = "", videoId: initialVideoId = "default-video", provider, username = "you", onStateChange }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState(initialSrc || DEMO_VIDEOS[0].url);
  const [videoId, setVideoId] = useState(initialVideoId);
  const [urlInput, setUrlInput] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [syncStatus, setSyncStatus] = useState("Synced");
  const isRemoteUpdate = useRef(false);

  const { applyCorrection } = useSyncEngine({
    serverTimestamp: Date.now(),
    currentTime,
    playbackRate: 1,
  });

  // Listen to remote video sync events from peers
  useEffect(() => {
    if (!provider) return;

    provider.onVideoSync((remoteState) => {
      const v = videoRef.current;
      if (!v) return;

      isRemoteUpdate.current = true;

      if (remoteState.src && remoteState.src !== src) {
        setSrc(remoteState.src);
      }
      if (remoteState.videoId) {
        setVideoId(remoteState.videoId);
      }

      // Check drift
      const latencySec = (Date.now() - (remoteState.serverTimestamp || Date.now())) / 1000;
      const targetTime = remoteState.state === "PLAYING"
        ? remoteState.currentTime + latencySec
        : remoteState.currentTime;

      if (Math.abs(v.currentTime - targetTime) > 0.5) {
        v.currentTime = targetTime;
        setSyncStatus("Resyncing...");
        setTimeout(() => setSyncStatus("Synced"), 800);
      }

      if (remoteState.state === "PLAYING" && v.paused) {
        v.play().catch(() => {});
        setIsPlaying(true);
      } else if (remoteState.state === "PAUSED" && !v.paused) {
        v.pause();
        setIsPlaying(false);
      }

      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 300);
    });
  }, [provider, src]);

  // Broadcast state changes
  const broadcastState = useCallback(
    (actionState: string, time: number) => {
      if (isRemoteUpdate.current || !provider) return;

      provider.sendVideoSync({
        videoId,
        src,
        state: actionState,
        currentTime: time,
        playbackRate: 1.0,
        serverTimestamp: Date.now(),
        initiatorId: username,
        vectorClock: { [username]: Date.now() },
      });
    },
    [provider, videoId, src, username]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => setCurrentTime(video.currentTime);
    const onMeta = () => {
      setDuration(video.duration);
      onStateChange?.("READY");
    };
    const onPlay = () => {
      setIsPlaying(true);
      onStateChange?.("PLAYING");
      broadcastState("PLAYING", video.currentTime);
    };
    const onPause = () => {
      setIsPlaying(false);
      onStateChange?.("PAUSED");
      broadcastState("PAUSED", video.currentTime);
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [broadcastState, onStateChange]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  }, []);

  const seek = useCallback(
    (t: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = t;
        broadcastState(isPlaying ? "PLAYING" : "PAUSED", t);
      }
    },
    [isPlaying, broadcastState]
  );

  const changeVolume = useCallback((v: number) => {
    if (videoRef.current) videoRef.current.volume = v;
    setVolume(v);
  }, []);

  // Handle Local Video File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
    setVideoId(file.name);
    broadcastState("READY", 0);
  };

  const handleUrlLoad = (url: string) => {
    if (!url.trim()) return;
    setSrc(url.trim());
    setVideoId(`vid-${Date.now()}`);
    setUrlInput("");
    broadcastState("READY", 0);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="video-wrapper" style={{ display: "flex", flexDirection: "column", height: "100%", gap: "10px" }}>
      {/* Top Source & Upload Bar */}
      <div
        className="video-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "var(--bg-secondary, #1a1a24)",
          borderRadius: "8px",
          border: "1px solid var(--border-subtle, #333)",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "8px", flex: 1, minWidth: "260px" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Paste video URL (.mp4, .webm)..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlLoad(urlInput)}
            style={{ flex: 1, padding: "6px 10px", fontSize: "12px" }}
          />
          <button
            className="btn-primary"
            style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
            onClick={() => handleUrlLoad(urlInput)}
          >
            Load URL
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="video/*"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "var(--accent-surface, rgba(99, 102, 241, 0.15))",
              color: "var(--accent, #818cf8)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "4px",
              padding: "6px 12px",
              fontSize: "12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            🎬 Upload Video
          </button>

          <select
            style={{
              background: "var(--bg-surface, #222)",
              color: "var(--text-primary, #fff)",
              border: "1px solid var(--border-subtle, #444)",
              borderRadius: "4px",
              padding: "6px 10px",
              fontSize: "12px",
            }}
            onChange={(e) => handleUrlLoad(e.target.value)}
            value={src}
          >
            <option value="" disabled>
              Sample Demos
            </option>
            {DEMO_VIDEOS.map((demo) => (
              <option key={demo.url} value={demo.url}>
                {demo.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div
        className="video-container"
        style={{ flex: 1, position: "relative", minHeight: "360px", background: "#000", borderRadius: "8px", overflow: "hidden" }}
        onMouseEnter={() => setShowControls(true)}
      >
        <video
          ref={videoRef}
          src={src}
          onClick={togglePlay}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />

        <div className="video-sync-badge" style={{ position: "absolute", top: "12px", right: "12px" }}>
          <span className="sync-dot" style={{ background: syncStatus === "Synced" ? "#22c55e" : "#eab308" }} />
          {syncStatus}
        </div>

        {showControls && (
          <div className="video-overlay">
            <div className="video-controls">
              <button className="ctrl-btn" onClick={togglePlay}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <span className="video-time">{fmt(currentTime)}</span>
              <input
                className="video-seek-bar"
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
              />
              <span className="video-time">{fmt(duration)}</span>
              <div className="video-volume">
                <button className="ctrl-btn" onClick={() => changeVolume(volume > 0 ? 0 : 1)}>
                  {volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                />
              </div>
              <button
                className="ctrl-btn"
                title="Fullscreen"
                onClick={() => {
                  if (videoRef.current?.requestFullscreen) {
                    videoRef.current.requestFullscreen();
                  }
                }}
              >
                ⛶
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
