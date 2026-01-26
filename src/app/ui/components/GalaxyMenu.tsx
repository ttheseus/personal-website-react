// app/components/GalaxyMenu.tsx
"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, ScrollControls, useScroll, Billboard, Text, Line, Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { useLoading } from "./Loading";

type PlanetDef = {
  name: string;
  href: string;
  position: [number, number, number]; // x, y, z
  radius: number;
  color: string;
  rotationSpeed: number;
};

function Planet({
  def,
  onNavigate,
}: {
  def: PlanetDef;
  onNavigate: (href: string) => void;
}) {
  const rootRef = useRef<THREE.Group>(null);     // position + hover scale
  const spinRef = useRef<THREE.Group>(null);     // rotation only (planet spins)
  const meshRef = useRef<THREE.Mesh>(null);      // sphere
  const labelRef = useRef<THREE.Group>(null);    // anchor group on sphere surface

  const { camera } = useThree();

  const [hovered, setHovered] = useState(false);
  const [flickerOn, setFlickerOn] = useState(false);

  // anchor local position on the sphere (locked)
  const anchorLocalRef = useRef(new THREE.Vector3(def.radius * 0.55, def.radius * 0.85, def.radius * 0.1));

  // label sizing clamps
  const [textSize, setTextSize] = useState(0.24); // world units
  const [lineLen, setLineLen] = useState(1.8);    // world units

  const textRef = useRef<any>(null); // Troika Text instance (drei Text)
  const flickerTimerRef = useRef<number | null>(null);

  const [underlineLen, setUnderlineLen] = useState(1.2); // world units, will be updated from text width

  // temps
  const tmpCenterW = useMemo(() => new THREE.Vector3(), []);
  const tmpTargetW = useMemo(() => new THREE.Vector3(), []);
  const tmpLocal = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const upOrtho = useMemo(() => new THREE.Vector3(), []);
  const toCam = useMemo(() => new THREE.Vector3(), []);
  const dirW = useMemo(() => new THREE.Vector3(), []);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.color),
      roughness: 0.5,
      metalness: 0.1,
      emissive: new THREE.Color("#000000"),
      emissiveIntensity: 0.35,
    });
  }, [def.color]);

  // Spin + hover pulse
  useFrame((_, dt) => {
    if (!rootRef.current || !spinRef.current || !meshRef.current) return;

    // spin the planet
    spinRef.current.rotation.y += dt * def.rotationSpeed;
    spinRef.current.rotation.x += dt * def.rotationSpeed * 0.25;

    // hover scale on root so label + planet scale together
    const targetScale = hovered ? 1.12 : 1.0;
    rootRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.12
    );

    // emissive highlight
    (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set(
      hovered ? "#ffffff" : "#000000"
    );
    (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = hovered ? 0.9 : 0.35;

    // clamp label size based on camera distance (min/max)
    const centerW = rootRef.current.getWorldPosition(tmpCenterW);
    const dist = camera.position.distanceTo(centerW);

    // smaller when far, bigger when close, clamped
    const tSize = THREE.MathUtils.clamp(0.34 - dist * 0.015, 0.16, 0.26);
    setTextSize(tSize);

    const lLen = THREE.MathUtils.clamp(2.2 - dist * 0.06, 1.2, 2.1);
    setLineLen(lLen);
  });

  // Hologram flicker (2 quick flickers) only at hover start
  function triggerFlicker() {
    setFlickerOn(true);
    // two quick toggles
    setTimeout(() => setFlickerOn(false), 60);
    setTimeout(() => setFlickerOn(true), 110);
    setTimeout(() => setFlickerOn(false), 160);
  }

  function scheduleRandomFlicker() {
    // clear any existing timer
    if (flickerTimerRef.current) {
      window.clearTimeout(flickerTimerRef.current);
      flickerTimerRef.current = null;
    }

    const nextMs = 4000 + Math.random() * 4000; // 4–8 seconds
    flickerTimerRef.current = window.setTimeout(() => {
      // only flicker if still hovered
      if (hovered) {
        triggerFlicker();
        scheduleRandomFlicker(); // schedule the next one
      }
    }, nextMs);
  }

  function stopRandomFlicker() {
    if (flickerTimerRef.current) {
      window.clearTimeout(flickerTimerRef.current);
      flickerTimerRef.current = null;
    }
  }


  // Compute anchor ONCE at hover start, in mesh-local space (correct for different sizes)
  function computeAnchorOnce() {
    if (!rootRef.current || !meshRef.current) return;

    const centerW = rootRef.current.getWorldPosition(tmpCenterW);
    ndc.copy(centerW).project(camera);

    camera.getWorldDirection(forward).normalize();
    right.copy(forward).cross(camera.up).normalize();
    upOrtho.copy(right).cross(forward).normalize();

    // visible hemisphere direction (planet -> camera)
    toCam.copy(camera.position).sub(centerW).normalize();

    // upper + visible bias
    dirW.copy(toCam).multiplyScalar(1.0).add(upOrtho.clone().multiplyScalar(0.8));

    // push inward if near edges (so label stays visible)
    const edgeX = 0.78;
    const edgeY = 0.72;
    if (ndc.x > edgeX) dirW.add(right.clone().multiplyScalar(-0.75));
    if (ndc.x < -edgeX) dirW.add(right.clone().multiplyScalar(0.75));
    if (ndc.y > edgeY) dirW.add(upOrtho.clone().multiplyScalar(-0.65));
    if (ndc.y < -edgeY) dirW.add(upOrtho.clone().multiplyScalar(0.25));

    dirW.normalize();

    // world target on sphere surface
    const r = def.radius * 1.06;
    tmpTargetW.copy(centerW).add(dirW.multiplyScalar(r));

    // convert world point to MESH LOCAL so it stays on the same spinning spot
    tmpLocal.copy(tmpTargetW);
    rootRef.current.worldToLocal(tmpLocal);

    anchorLocalRef.current.copy(tmpLocal);

    // apply immediately
    if (labelRef.current) labelRef.current.position.copy(anchorLocalRef.current);
  }

  // Line points: start at dot (0,0,0), go diagonally outward, then underline
  function getLinePoints() {
    const diag = new THREE.Vector3(lineLen * 0.7, lineLen * 0.5, 0);

    // underline starts at end of diagonal and extends to match text width (+ a tiny padding)
    const underlinePad = textSize * 0.8;
    const underlineEndX = diag.x + underlineLen + underlinePad;

    const under = new THREE.Vector3(underlineEndX, diag.y, 0);
    return [new THREE.Vector3(0, 0, 0), diag, under];
  }

  return (
    <group ref={rootRef} position={def.position}>
      {/* ✅ planet spins here */}
      <group ref={spinRef}>
        <mesh
          ref={meshRef}
          material={material}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
            triggerFlicker();
            computeAnchorOnce(); // anchor computed in ROOT space now
            scheduleRandomFlicker();
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
            document.body.style.cursor = "default";
            stopRandomFlicker();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(def.href);
          }}
        >
          <sphereGeometry args={[def.radius, 64, 64]} />
        </mesh>
      </group>

      {/* ✅ label does NOT spin (not inside spinRef / mesh) */}
      <group ref={labelRef} position={anchorLocalRef.current}>
        {hovered && (
          <group>
            {/* dot */}
            <mesh>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshBasicMaterial
                color={"black"}
                transparent
                opacity={flickerOn ? 0.25 : 0.9}
              />
            </mesh>

            {/* line */}
            <Line
              points={getLinePoints()}
              color="black"
              lineWidth={1}
              transparent
              opacity={flickerOn ? 0.25 : 0.9}
            />

            {/* text (billboard) */}
            <Billboard follow>
              <group position={[lineLen * 0.75, lineLen * 0.58, 0]}>
                <Text
                  ref={textRef}
                  fontSize={textSize}
                  color="black"
                  anchorX="left"
                  anchorY="middle"
                  outlineWidth={0}
                  fillOpacity={flickerOn ? 0.25 : 0.95}
                  onSync={() => {
                    const w = textRef.current?.textRenderInfo?.blockBounds?.[2] ?? 0;
                    // blockBounds: [minX, minY, maxX, maxY] in local text units
                    // width = maxX - minX
                    const minX = textRef.current?.textRenderInfo?.blockBounds?.[0] ?? 0;
                    const maxX = textRef.current?.textRenderInfo?.blockBounds?.[2] ?? 0;
                    const width = Math.max(0, maxX - minX);

                    // clamp underline length
                    setUnderlineLen(THREE.MathUtils.clamp(width, 0.6, 3.5));
                  }}
                >
                  {def.name}
                </Text>
              </group>
            </Billboard>
          </group>
        )}
      </group>
    </group>
  );
}


function CameraRail() {
  // Moves camera “forward” through z-space based on scroll
  const scroll = useScroll();
  const camTarget = useRef(new THREE.Vector3(0, 0, 0));
  const camPos = useRef(new THREE.Vector3(0, 0, 8)); // fixed start distance every reload

  useFrame(({ camera }) => {
    // scroll.offset goes 0..1 across all pages
    const t = scroll.offset;

    // Move forward through space (more negative z)
    const z = THREE.MathUtils.lerp(8, -34, t); // camera travels from z=8 to z=-34
    camPos.current.set(0, 0, z);
    camera.position.lerp(camPos.current, 0.08);

    // look slightly ahead
    camTarget.current.set(0, 0, z - 6);
    camera.lookAt(camTarget.current);
  });

  return null;
}

function InvertScrollWheel() {
  const scroll = useScroll();

  useEffect(() => {
    const el = scroll.el;
    if (!el) return;

    el.classList.add("hide-native-scrollbar");

    const onWheel = (e: WheelEvent) => {
      // Only invert vertical scrolling
      if (e.deltaY === 0) return;

      // Prevent the default scroll behavior (required to override)
      e.preventDefault();

      // Invert: wheel down normally increases scrollTop; we subtract instead
      el.scrollTop += e.deltaY;
    };

    // Must be non-passive to call preventDefault
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel as any);
      el.classList.remove("hide-native-scrollbar");
    };
  }, [scroll]);

  return null;
}

function DistanceScrollbar() {
  const scroll = useScroll();

  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const pctRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  const setOffset = (offset01: number) => {
    const el = scroll.el;
    if (!el) return;

    const max = el.scrollHeight - el.clientHeight;
    const clamped = Math.max(0, Math.min(1, offset01));
    el.scrollTop = clamped * max;
  };

  const updateFromClientY = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return;

    const r = track.getBoundingClientRect();
    const y = clientY - r.top;
    setOffset(y / r.height);
  };
  
  useFrame(() => {
    const p = scroll.offset; // 0..1

    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return;

    const PAD = 10;                  // px margin inside track (top+bottom)
    const THUMB_H = 3;               // your h-[3px]

    const h = track.clientHeight;
    const minTop = PAD;
    const maxTop = Math.max(minTop, h - PAD - THUMB_H);

    // map full 0..1 range into the padded travel area (no range limiting)
    const topPx = minTop + p * (maxTop - minTop);

    thumb.style.top = `${topPx}px`;
  });

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      updateFromClientY(e.clientY);
    };
    const onPointerUp = (e: PointerEvent) => {
      draggingRef.current = false;
      (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove as any);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const progress = scroll.offset; // now safe
  const percent = Math.round(progress * 100);

  if (!portalEl) return null;

  return (
    <Html
      transform={false}
      prepend
      // @ts-ignore
      portal={{ current: portalEl }}
      style={{ pointerEvents: "none" }}
    >
      {/* Full-screen overlay layer */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999999,
          pointerEvents: "none",
        }}
      >
        {/* Right-side anchored scrollbar */}
        <div
          style={{
            position: "fixed",
            right: "-45vw",              // ✅ always right side, responsive to window
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "auto",  // ✅ interactable
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="text-[#f2eef5] font-[family-name:var(--font-inconsolata)] text-xs tracking-[0.25em] opacity-80">
              {percent}%
            </div>

            <div
              ref={trackRef}
              className="relative h-[320px] w-[44px] rounded-[18px] border border-[rgba(242,238,245,0.22)] bg-[rgba(0,0,0,0.25)] backdrop-blur-sm"
              onPointerDown={(e) => {
                draggingRef.current = true;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                updateFromClientY(e.clientY);
              }}
            >
              <div className="absolute inset-0 px-[10px] py-[10px] flex flex-col justify-between opacity-60">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-[1px] w-full bg-[rgba(242,238,245,0.25)]" />
                ))}
              </div>

              <div
                ref = {thumbRef}
                className="absolute left-[6px] right-[6px] h-[3px] rounded-full bg-[#f2eef5] shadow-[0_0_14px_rgba(242,238,245,0.25)]"
                style={{ top: `calc(0% - 1px)` }}
                onPointerDown={(e) => {
                  e.stopPropagation(); // don't let the track handler also fire
                  draggingRef.current = true;
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  updateFromClientY(e.clientY); // jump to where you grabbed
                }}
              />
              <div
                className="absolute left-0 right-0 h-[18px]"
                style={{ top: `calc(${progress * 100}% - 9px)` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Html>
  );
}

export default function GalaxyMenu() {
  const router = useRouter();
  const { startLoading } = useLoading();

  // Order + spacing matters: closest planet is About Me and always starts “near”
  const planets: PlanetDef[] = useMemo(
    () => [
      {
        name: "about me",
        href: "/about",
        position: [-2.2, 0.6, 0],
        radius: 1.15,
        color: "#538899", // blue
        rotationSpeed: 0.55,
      },
      {
        name: "coding projects",
        href: "/coding-projects",
        position: [2.5, -0.4, -12],
        radius: 1.35,
        color: "#522062", // purple
        rotationSpeed: 0.35,
      },
      {
        name: "art commissions",
        href: "/art-commissions",
        position: [-1.0, -0.9, -24],
        radius: 1.25,
        color: "#f80780", // accent pink
        rotationSpeed: 0.7,
      },
    ],
    []
  );

  return (
    <div className="w-screen h-screen relative">
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
        {/* background stars */}
        <Stars radius={120} depth={80} count={2500} factor={3} fade speed={0.6} />

        {/* lighting */}
        <ambientLight intensity={0.35} />
        <pointLight position={[6, 6, 8]} intensity={1.1} color={"#faccd0"} />
        <pointLight position={[-8, -3, -10]} intensity={0.7} color={"#538899"} />

        {/* Scroll moves camera forward through 3D space */}
        <ScrollControls pages={3.2} damping={0.2}>
          <CameraRail />
          <InvertScrollWheel />
          <DistanceScrollbar />
          {/* planets */}
          {planets.map((p) => (
            <Planet 
              key={p.href} 
              def={p} 
              onNavigate={(href) => {
                startLoading();
                router.push(href)
              }} />
          ))}

          {/* subtle “nebula fog” planes for vibes */}
          <mesh position={[0, 0, -10]}>
            <planeGeometry args={[40, 24]} />
            <meshBasicMaterial color={"#522062"} transparent opacity={0.05} />
          </mesh>
          <mesh position={[0, 0, -22]}>
            <planeGeometry args={[40, 24]} />
            <meshBasicMaterial color={"#538899"} transparent opacity={0.05} />
          </mesh>
        </ScrollControls>
      </Canvas>

      {/* UI overlay (instructions) */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-8 z-10">
        <div className="pointer-events-none border border-[rgba(250,204,208,0.35)] bg-[rgba(0,0,0,0.35)] text-[#f2eef5] px-4 py-2 rounded-[14px] backdrop-blur-sm">
          scroll to travel • hover planets • click to enter
        </div>
      </div>
    </div>
  );
}
