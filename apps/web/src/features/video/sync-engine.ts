import { useState, useEffect, useRef, useCallback } from "react";

interface SyncEngineOptions {
  serverTimestamp: number;
  currentTime: number;
  playbackRate: number;
  driftThreshold?: number;
}

interface DriftZone {
  type: "deadband" | "soft" | "hard";
  adjustment: number;
}

export function useSyncEngine(options: SyncEngineOptions) {
  const [drift, setDrift] = useState(0);
  const [currentRate, setCurrentRate] = useState(options.playbackRate);
  const lastUpdateRef = useRef(Date.now());
  const rateRef = useRef(options.playbackRate);

  const computeDrift = useCallback(
    (serverNow: number, videoCurrentTime: number, stateCurrentTime: number, playbackRate: number) => {
      const expectedTime = stateCurrentTime + (serverNow - options.serverTimestamp) * playbackRate;
      return expectedTime - videoCurrentTime;
    },
    [options.serverTimestamp]
  );

  const classifyDrift = useCallback((driftMs: number): DriftZone => {
    const absDrift = Math.abs(driftMs);

    if (absDrift < 50) {
      return { type: "deadband", adjustment: 0 };
    }

    if (absDrift < 500) {
      const adjustment = Math.min(0.1, absDrift / 2000);
      return {
        type: "soft",
        adjustment: driftMs > 0 ? -adjustment : adjustment,
      };
    }

    return { type: "hard", adjustment: 1.0 };
  }, []);

  const applyCorrection = useCallback(
    (videoElement: HTMLVideoElement, driftMs: number) => {
      const zone = classifyDrift(driftMs);

      switch (zone.type) {
        case "deadband":
          videoElement.playbackRate = rateRef.current;
          break;

        case "soft":
          videoElement.playbackRate = rateRef.current + zone.adjustment;
          break;

        case "hard":
          const expectedTime =
            options.currentTime + (performance.now() - lastUpdateRef.current) * rateRef.current;
          videoElement.currentTime = expectedTime;
          videoElement.playbackRate = rateRef.current;
          break;
      }

      setCurrentRate(videoElement.playbackRate);
    },
    [classifyDrift, options.currentTime]
  );

  return {
    drift,
    currentRate,
    computeDrift,
    classifyDrift,
    applyCorrection,
    setDrift,
  };
}
