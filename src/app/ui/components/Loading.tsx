"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image"

type LoadingCtx = {
    startLoading: () => void;
};

const Ctx = createContext<LoadingCtx | null>(null);

export function useLoading() {
    const v = useContext(Ctx);
    if (!v) throw new Error("useLoading must be used within <LoadingProvider />");
    return v;
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Minimum time the loader must stay visible before fading
    const MIN_VISIBLE_MS = 1500;

    // "mounted overlay" + "fade state"
    const [mounted, setMounted] = useState(true);      // starts ON for initial render
    const [fading, setFading] = useState(false);

    const fadeTimer = useRef<number | null>(null);
    const minTimer = useRef<number | null>(null);
    const shownAt = useRef<number>(Date.now()); // when loader last became visible

    const clearTimers = () => {
        if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
        if (minTimer.current) window.clearTimeout(minTimer.current);
        fadeTimer.current = null;
        minTimer.current = null;
    };

    const startLoading = () => {
        clearTimers();
        shownAt.current = Date.now();
        setMounted(true);
        setFading(false);
    };

    const stopLoading = () => {
        clearTimers();

        const elapsed = Date.now() - shownAt.current;
        const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

        // Wait until minimum duration has passed, then fade out
        minTimer.current = window.setTimeout(() => {
            setFading(true);

            fadeTimer.current = window.setTimeout(() => {
                setMounted(false);
                setFading(false);
                fadeTimer.current = null;
            }, 520); // must match CSS transition
        }, remaining);
    };

    // Initial page hydration -> fade out once React is ready (but enforce min visible time)
    useEffect(() => {
        shownAt.current = Date.now();
        stopLoading();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When route changes, the next screen is now rendered -> fade out (but enforce min visible time)
    useEffect(() => {
        stopLoading();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    const ctxValue = useMemo(
        () => ({
            startLoading,
        }),
        []
    );

    // 🔧 DEV-ONLY DEBUG COMMANDS (kept intact)
    useEffect(() => {
        if (process.env.NODE_ENV !== "development") return;

        (window as any).showMoonLoader = () => {
            clearTimers();
            shownAt.current = Date.now();
            setMounted(true);
            setFading(false);
            console.log("[MoonLoader] shown");
        };

        (window as any).hideMoonLoader = () => {
            stopLoading();
        };

        console.log("%cMoon loader debug ready", "color:#7aa2ff;font-weight:bold");

        return () => {
            delete (window as any).showMoonLoader;
            delete (window as any).hideMoonLoader;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Ctx.Provider value={ctxValue}>
            {children}
            <MoonLoadingOverlay mounted={mounted} fading={fading} />
        </Ctx.Provider>
    );
}

function MoonLoadingOverlay({ mounted, fading }: { mounted: boolean; fading: boolean }) {
    const phases = useMemo(
        () => [
            { key: "new", src: "/assets/moon/new.png" },
            { key: "waxing-crescent", src: "/assets/moon/waxing-crescent.png" },
            { key: "first-quarter", src: "/assets/moon/first-quarter.png" },
            { key: "waxing-gibbous", src: "/assets/moon/waxing-gibbous.png" },
            { key: "full", src: "/assets/moon/full.png" },
            { key: "waning-gibbous", src: "/assets/moon/waning-gibbous.png" },
            { key: "third-quarter", src: "/assets/moon/third-quarter.png" },
            { key: "waning-crescent", src: "/assets/moon/waning-crescent.png" },
        ],
        []
    );

    const [idx, setIdx] = useState(0);

    useEffect(() => {
        if (!mounted) return;
        const id = window.setInterval(() => {
            setIdx((v) => (v + 1) % phases.length);
        }, 800);
        return () => window.clearInterval(id);
    }, [mounted, phases.length]);

    if (!mounted) return null;


    return (
        <>
            <style>{`
        .moonLoaderOverlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: grid;
          place-items: center;
          background: #0a0f18; /* blue-tinted near-black */
          transition: opacity 520ms ease;
          opacity: 1;
          pointer-events: none;
        }

        .moonLoaderOverlay.fadeOut {
          opacity: 0;
        }

        .moonIconWrap {
          width: 140px;
          height: 140px;
          display: grid;
          place-items: center;
          animation: pulse 1.6s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .moonSwap {
          animation: swap 220ms ease both;
        }

        @keyframes swap {
          from {
            opacity: 0;
            transform: translateY(2px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

            <div className={`moonLoaderOverlay ${fading ? "fadeOut" : ""}`}>
                <div className="moonIconWrap">
                    <div key={phases[idx].key} className="moonSwap">
                        <Image
                            src={phases[idx].src}
                            alt="Loading"
                            width={120}
                            height={120}
                            priority
                        />
                    </div>
                </div>
            </div>
        </>
    );
}