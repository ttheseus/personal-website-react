// app/ui/components/RecordPlayer.tsx
"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

type Track = {
  uri: string;
  name: string;
  artist: string;
  image: string | null;
  durationMs: number;
};

type PlaybackUpdateEvent = { data?: { isPaused?: boolean; isBuffering?: boolean } };

type EmbedController = {
  play: () => void;
  pause: () => void;
  resume: () => void;
  loadUri: (uri: string) => void;
  destroy: () => void;
  addListener: (event: string, cb: (e: PlaybackUpdateEvent) => void) => void;
  removeListener: (event: string, cb?: (e: PlaybackUpdateEvent) => void) => void;
};

type IFrameAPI = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: EmbedController) => void
  ) => void;
};

type SpotifyWindow = Window & {
  onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  __spotifyIframeApi?: IFrameAPI;
};

const SPOTIFY_SCRIPT_SRC = "https://open.spotify.com/embed/iframe-api/v1";
const SPOTIFY_SCRIPT_ID = "spotify-iframe-api";

let iframeApiPromise: Promise<IFrameAPI> | null = null;

function loadSpotifyIframeApi(): Promise<IFrameAPI> {
  if (typeof window === "undefined") return new Promise(() => {});
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve) => {
    const w = window as SpotifyWindow;

    if (w.__spotifyIframeApi) {
      resolve(w.__spotifyIframeApi);
      return;
    }

    w.onSpotifyIframeApiReady = (api: IFrameAPI) => {
      w.__spotifyIframeApi = api;
      resolve(api);
    };

    if (!document.getElementById(SPOTIFY_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SPOTIFY_SCRIPT_ID;
      script.src = SPOTIFY_SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return iframeApiPromise;
}

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RecordPlayer() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [elapsedDisplay, setElapsedDisplay] = useState(0);

  const embedHostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<EmbedController | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orderRef = useRef<number[]>([]);
  const posRef = useRef(0);
  const tracksRef = useRef<Track[]>([]);
  const startedRef = useRef(false);
  const elapsedMsRef = useRef(0);
  const playStartedAtRef = useRef<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const clearAdvanceTimer = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  function scheduleAdvanceTimer(durationMs: number) {
    clearAdvanceTimer();
    const ms = durationMs && durationMs > 2000 ? durationMs + 500 : 30000;
    advanceTimer.current = setTimeout(() => {
      goNext();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, ms);
  }

  function advanceToIndex(newPos: number) {
    setPos(newPos);
    posRef.current = newPos;

    const track = tracksRef.current[orderRef.current[newPos]];
    if (!track || !controllerRef.current) return;

    controllerRef.current.loadUri(track.uri);
    elapsedMsRef.current = 0;
    playStartedAtRef.current = Date.now();

    // Some embed instances need a brief tick after loadUri before play() sticks.
    setTimeout(() => {
      try {
        controllerRef.current?.play();
      } catch {
        // ignore
      }
    }, 120);

    scheduleAdvanceTimer(track.durationMs);
  }

  function goNext() {
    const currentOrder = orderRef.current;
    let nextPos = posRef.current + 1;

    if (nextPos >= currentOrder.length) {
      const lastIdx = currentOrder[currentOrder.length - 1];
      const reshuffled = shuffle(tracksRef.current.map((_, i) => i));
      if (reshuffled.length > 1 && reshuffled[0] === lastIdx) {
        [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
      }
      orderRef.current = reshuffled;
      setOrder(reshuffled);
      nextPos = 0;
    }

    advanceToIndex(nextPos);
  }

  // Fetch the playlist (server route) and pick a random starting order once.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/spotify-playlist")
      .then((r) => r.json())
      .then((data: { tracks?: Track[]; error?: string }) => {
        if (cancelled) return;
        if (!data.tracks || !data.tracks.length) {
          setLoadError(data.error || "No tracks found.");
          return;
        }
        setTracks(data.tracks);
        setOrder(shuffle(data.tracks.map((_, i) => i)));
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Once tracks + a shuffled order exist, spin up the (hidden) Spotify embed
  // and attempt to start playback immediately.
  useEffect(() => {
    if (!tracks.length || !order.length) return;
    if (controllerRef.current) return;
    if (!embedHostRef.current) return;

    let cancelled = false;

    loadSpotifyIframeApi().then((IFrameAPI) => {
      if (cancelled || controllerRef.current || !embedHostRef.current) return;

      const firstTrack = tracks[order[0]];

      IFrameAPI.createController(
        embedHostRef.current,
        { uri: firstTrack.uri, width: "1", height: "1" },
        (controller) => {
          controllerRef.current = controller;

          controller.addListener("playback_update", (e) => {
            const paused = e?.data?.isPaused;
            if (typeof paused === "boolean") {
              setIsPlaying(!paused);
              if (!paused) {
                startedRef.current = true;
                setHasStarted(true);
              }
            }
          });

          elapsedMsRef.current = 0;
          playStartedAtRef.current = Date.now();

          try {
            controller.play();
          } catch {
            // Browser likely blocked autoplay-with-sound; we fall back to
            // starting on the visitor's first interaction with the page.
          }

          scheduleAdvanceTimer(firstTrack.durationMs);
        }
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, order]);

  // Browsers block audio-with-sound autoplay until the visitor interacts
  // with the page at least once. Catch the first interaction, anywhere,
  // and use it to (re)try starting playback.
  useEffect(() => {
    function onFirstGesture() {
      if (startedRef.current) return;
      try {
        controllerRef.current?.play();
        controllerRef.current?.resume();
      } catch {
        // ignore
      }
    }

    document.addEventListener("pointerdown", onFirstGesture, { passive: true });
    document.addEventListener("keydown", onFirstGesture);

    return () => {
      document.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("keydown", onFirstGesture);
    };
  }, []);

  // Close the popup when clicking outside it.
  useEffect(() => {
    if (!popupOpen) return;

    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (iconRef.current?.contains(target)) return;
      setPopupOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [popupOpen]);

  // Live-ish elapsed time for the progress bar.
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const started = playStartedAtRef.current ?? Date.now();
      setElapsedDisplay(elapsedMsRef.current + (Date.now() - started));
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying, pos]);

  useEffect(() => {
    return () => {
      clearAdvanceTimer();
      try {
        controllerRef.current?.destroy();
      } catch {
        // ignore
      }
    };
  }, []);

  function handleIconClick() {
    setPopupOpen((p) => !p);
    if (!startedRef.current) {
      try {
        controllerRef.current?.play();
      } catch {
        // ignore
      }
    }
  }

  function togglePlayPause() {
    if (!controllerRef.current) return;

    if (isPlaying) {
      elapsedMsRef.current += Date.now() - (playStartedAtRef.current ?? Date.now());
      playStartedAtRef.current = null;
      clearAdvanceTimer();
      controllerRef.current.pause();
      setIsPlaying(false);
    } else {
      playStartedAtRef.current = Date.now();
      startedRef.current = true;
      setHasStarted(true);
      controllerRef.current.resume();
      setIsPlaying(true);

      const track = tracksRef.current[orderRef.current[posRef.current]];
      if (track) {
        const remaining = track.durationMs - elapsedMsRef.current;
        scheduleAdvanceTimer(remaining > 0 ? remaining : 1000);
      }
    }
  }

  function handleSkipNext(e: ReactMouseEvent) {
    e.stopPropagation();
    goNext();
  }

  const currentTrack =
    tracks.length && order.length ? tracks[order[pos]] : null;

  return (
    <div className="recordPlayerRoot">
      <style>{`
        .recordPlayerRoot {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 999998;
          font-family: 'Nunito', sans-serif;
        }

        .recordIcon {
          position: relative;
          width: 68px;
          height: 68px;
          cursor: pointer;
          filter: drop-shadow(0 0 14px rgba(147, 91, 168, 0.55));
          transition: transform 0.25s ease, filter 0.25s ease;
        }

        .recordIcon:hover {
          transform: scale(1.06);
          filter: drop-shadow(0 0 20px rgba(250, 204, 208, 0.75));
        }

        .recordIcon:focus-visible {
          outline: 2px solid #faccd0;
          outline-offset: 4px;
          border-radius: 999px;
        }

        .recordLayer {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          user-select: none;
        }

        .recordShine {
          animation: recordSpin 2.6s linear infinite;
          animation-play-state: paused;
        }

        .recordShine.spinning {
          animation-play-state: running;
        }

        @keyframes recordSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .recordHint {
          position: absolute;
          right: 78px;
          bottom: 22px;
          white-space: nowrap;
          padding: 6px 10px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(250, 204, 208, 0.45);
          color: #faccd0;
          font-family: var(--font-inconsolata, monospace);
          font-size: 12px;
          letter-spacing: 0.04em;
          backdrop-filter: blur(6px);
          animation: hintPulse 1.8s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes hintPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }

        .recordPopup {
          position: absolute;
          right: 0;
          bottom: 84px;
          width: 250px;
          padding: 14px;
          border-radius: 16px;
          background: rgba(10, 6, 14, 0.72);
          border: 1px solid rgba(250, 204, 208, 0.4);
          box-shadow: 0 0 26px rgba(147, 91, 168, 0.35);
          backdrop-filter: blur(10px);
          color: #f2eef5;
          animation: popupIn 220ms ease-out forwards;
        }

        @keyframes popupIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .recordPopupRow {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .recordPopupArt {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
          background: rgba(255,255,255,0.08);
        }

        .recordPopupMeta {
          min-width: 0;
        }

        .recordPopupTitle {
          font-family: var(--font-inconsolata, monospace);
          font-size: 13px;
          font-weight: 700;
          color: #faccd0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .recordPopupArtist {
          font-size: 12px;
          opacity: 0.8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .recordPopupBar {
          margin-top: 10px;
          height: 3px;
          border-radius: 999px;
          background: rgba(255,255,255,0.15);
          overflow: hidden;
        }

        .recordPopupBarFill {
          height: 100%;
          background: linear-gradient(90deg, #935ba8, #faccd0);
          transition: width 0.4s linear;
        }

        .recordPopupTime {
          margin-top: 4px;
          font-size: 10px;
          opacity: 0.6;
          text-align: right;
          font-family: var(--font-inconsolata, monospace);
        }

        .recordPopupControls {
          margin-top: 12px;
          display: flex;
          justify-content: center;
          gap: 14px;
        }

        .recordPopupBtn {
          all: unset;
          cursor: pointer;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(250, 204, 208, 0.35);
          color: #f2eef5;
          transition: background 0.2s ease;
        }

        .recordPopupBtn:hover {
          background: rgba(250, 204, 208, 0.18);
        }

        .recordPopupNote {
          font-size: 12px;
          opacity: 0.75;
          line-height: 1.4;
        }
      `}</style>

      {/* Hidden Spotify embed — this is the actual audio engine; we drive it
          entirely with our own shuffled track list and UI. */}
      <div
        ref={embedHostRef}
        style={{ position: "fixed", width: 1, height: 1, overflow: "hidden", opacity: 0 }}
        aria-hidden
      />

      {!hasStarted && !loadError && tracks.length > 0 && (
        <div className="recordHint">♪ click to start music</div>
      )}

      <div
        ref={iconRef}
        className="recordIcon"
        role="button"
        tabIndex={0}
        aria-label={currentTrack ? `Now playing: ${currentTrack.name} by ${currentTrack.artist}` : "Music player"}
        onClick={handleIconClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleIconClick();
          }
        }}
      >
        <img src="/assets/record/record1.PNG" alt="" className="recordLayer" draggable={false} />
        <img
          src="/assets/record/record2.PNG"
          alt=""
          className={`recordLayer recordShine ${isPlaying ? "spinning" : ""}`}
          draggable={false}
        />
        <img src="/assets/record/record3.PNG" alt="" className="recordLayer" draggable={false} />
      </div>

      {popupOpen && (
        <div className="recordPopup" ref={popupRef}>
          {currentTrack ? (
            <>
              <div className="recordPopupRow">
                {currentTrack.image ? (
                  <img src={currentTrack.image} alt="" className="recordPopupArt" />
                ) : (
                  <div className="recordPopupArt" />
                )}
                <div className="recordPopupMeta">
                  <div className="recordPopupTitle">{currentTrack.name}</div>
                  <div className="recordPopupArtist">{currentTrack.artist}</div>
                </div>
              </div>

              <div className="recordPopupBar">
                <div
                  className="recordPopupBarFill"
                  style={{
                    width: currentTrack.durationMs
                      ? `${Math.min(100, (elapsedDisplay / currentTrack.durationMs) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <div className="recordPopupTime">
                {formatTime(elapsedDisplay)} / {formatTime(currentTrack.durationMs)}
              </div>

              <div className="recordPopupControls">
                <button className="recordPopupBtn" onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} aria-label={isPlaying ? "Pause" : "Play"}>
                  {isPlaying ? "❚❚" : "▶"}
                </button>
                <button className="recordPopupBtn" onClick={handleSkipNext} aria-label="Skip to next song">
                  ⏭
                </button>
              </div>
            </>
          ) : loadError ? (
            <div className="recordPopupNote">
              {loadError.includes("NOT_CONNECTED") ? (
                <>
                  Spotify isn&apos;t connected yet.{" "}
                  <a href="/api/spotify-login" style={{ color: "#faccd0", textDecoration: "underline" }}>
                    Connect Spotify
                  </a>
                </>
              ) : loadError.includes("SPOTIFY_CLIENT") ? (
                "Music unavailable (Spotify credentials not set up yet)."
              ) : (
                "Music unavailable (couldn't load playlist)."
              )}
            </div>
          ) : (
            <div className="recordPopupNote">Loading playlist…</div>
          )}
        </div>
      )}
    </div>
  );
}
