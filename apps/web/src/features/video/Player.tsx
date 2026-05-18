import { useState, useEffect, useRef, useCallback } from "react";

interface PlayerProps {
  src: string;
  videoId: string;
  onStateChange?: (state: string) => void;
}

export function Player({ src, videoId, onStateChange }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentTime(video.currentTime);
    const onMeta = () => { setDuration(video.duration); onStateChange?.("READY"); };
    const onPlay = () => { setIsPlaying(true); onStateChange?.("PLAYING"); };
    const onPause = () => { setIsPlaying(false); onStateChange?.("PAUSED"); };
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
  }, [onStateChange]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  }, []);

  const seek = useCallback((t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  }, []);

  const changeVolume = useCallback((v: number) => {
    if (videoRef.current) videoRef.current.volume = v;
    setVolume(v);
  }, []);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!src) {
    return (
      <div className="video-wrapper">
        <div className="video-empty">
          <div className="empty-icon">🎬</div>
          <p>No video loaded</p>
          <p style={{ fontSize: "0.82rem" }}>Share a video URL to start watching together</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-wrapper">
      <div
        className="video-container"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(true)}
      >
        <video ref={videoRef} src={src} onClick={togglePlay} />

        <div className="video-sync-badge">
          <span className="sync-dot" />
          Synced
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
              <button className="ctrl-btn" title="Fullscreen">
                ⛶
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
