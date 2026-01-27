// app/components/GalaxyMenu.tsx
"use client";

import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Stars, ScrollControls, useScroll, Billboard, Text, Line, Html, Decal } from "@react-three/drei";
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
  axis: [number, number, number];
};

function axisFromObliquity(obliquityDeg: number, yawDeg: number) {
  // obliquityDeg: tilt away from +Y (0 = straight up)
  // yawDeg: rotates the tilt direction around +Y so planets don’t all “lean” the same way
  const tilt = THREE.MathUtils.degToRad(obliquityDeg);
  const yaw = THREE.MathUtils.degToRad(yawDeg);

  const y = Math.cos(tilt);
  const r = Math.sin(tilt);

  const x = r * Math.cos(yaw);
  const z = r * Math.sin(yaw);

  // normalized already, but keep it safe
  const v = new THREE.Vector3(x, y, z).normalize();
  return [v.x, v.y, v.z] as [number, number, number];
}

function Planet({
  def,
  onNavigate,
  showOverlay,
}: {
  def: PlanetDef;
  onNavigate: (href: string) => void;
  showOverlay?: boolean;
}) {
  const rootRef = useRef<THREE.Group>(null);     // position + hover scale
  const tiltRef = useRef<THREE.Group>(null);     // ✅ fixed axis tilt (static)
  const spinRef = useRef<THREE.Group>(null);     // rotation only (planet spins)
  const meshRef = useRef<THREE.Mesh>(null);      // sphere
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const labelRef = useRef<THREE.Group>(null);    // anchor group on sphere surface

  const { camera } = useThree();
  const overlayTex = useLoader(THREE.TextureLoader, "/assets/Planet1.png");

  useEffect(() => {
    // Three.js version-safe sRGB setup
    if ("colorSpace" in overlayTex) {
      // @ts-ignore
      overlayTex.colorSpace = THREE.SRGBColorSpace;
    } else {
      // older Three
      // @ts-ignore
      overlayTex.encoding = THREE.sRGBEncoding;
    }

    overlayTex.anisotropy = 8;

    // Full-sphere UV wrap behavior
    overlayTex.wrapS = THREE.RepeatWrapping;
    overlayTex.wrapT = THREE.ClampToEdgeWrapping;

    overlayTex.generateMipmaps = true;
    overlayTex.minFilter = THREE.LinearMipmapLinearFilter;
    overlayTex.magFilter = THREE.LinearFilter;

    overlayTex.needsUpdate = true;
  }, [overlayTex]);

  useEffect(() => {
    if (meshRef.current) {
      const m = meshRef.current.material as THREE.MeshStandardMaterial;
      m.needsUpdate = true;
    }
  }, [showOverlay]);

  useEffect(() => {
    if (!tiltRef.current) return;

    const axis = new THREE.Vector3(...def.axis).normalize();

    // orient the tilt group so its local +Y matches the desired axis
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      axis
    );

    tiltRef.current.quaternion.copy(q);
  }, [def.axis]);

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
      color: new THREE.Color(showOverlay ? "#ffffff" : def.color),
      map: showOverlay ? overlayTex : null,
      roughness: 0.5,
      metalness: 0.1,
      emissive: new THREE.Color("#000000"),
      emissiveIntensity: 0.35,
    });
  }, [def.color, overlayTex, showOverlay]);

  // Spin + hover pulse
  useFrame((_, dt) => {
    if (!rootRef.current || !spinRef.current || !meshRef.current) return;

    // Keep label anchored to the same viewing spot while hovered
    if (hovered) updateAnchorFromView();

    // ✅ spin around the planet’s tilted axis (tiltRef defines the axis, spinRef rotates around its local Y)
    spinRef.current.rotation.y += dt * def.rotationSpeed;

    // hover scale on root so label + planet scale together
    const targetScale = hovered ? 1.12 : 1.0;
    rootRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.12
    );

    // emissive highlight
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissive.set("#ffffff");                 // keep emissive white...
    mat.emissiveIntensity = hovered ? 0.05 : 0;  // ...but low intensity (not blown out)


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


  // Keep label dot in the same VIEWING spot (top-visible hemisphere) regardless of planet rotation/axis.
  // This does NOT attach to the spinning surface — it's view-anchored.
  function updateAnchorFromView() {
    if (!rootRef.current) return;

    const centerW = rootRef.current.getWorldPosition(tmpCenterW);
    ndc.copy(centerW).project(camera);

    camera.getWorldDirection(forward).normalize();
    right.copy(forward).cross(camera.up).normalize();
    upOrtho.copy(right).cross(forward).normalize();

    // visible hemisphere direction (planet -> camera)
    toCam.copy(camera.position).sub(centerW).normalize();

    // bias toward upper hemisphere in VIEW space
    dirW.copy(toCam).multiplyScalar(1.0).add(upOrtho.clone().multiplyScalar(0.8));

    // push inward if near edges (so label stays visible)
    const edgeX = 0.78;
    const edgeY = 0.72;
    if (ndc.x > edgeX) dirW.add(right.clone().multiplyScalar(-0.75));
    if (ndc.x < -edgeX) dirW.add(right.clone().multiplyScalar(0.75));
    if (ndc.y > edgeY) dirW.add(upOrtho.clone().multiplyScalar(-0.65));
    if (ndc.y < -edgeY) dirW.add(upOrtho.clone().multiplyScalar(0.25));

    dirW.normalize();

    // ✅ push the dot outward more, and scale with hover growth so it never gets swallowed
    const s = rootRef.current.scale.x || 1;         // root scales uniformly
    const r = def.radius * (1.13 + 0.14 * (s - 1)); // base offset + extra when hovered
    tmpTargetW.copy(centerW).add(dirW.multiplyScalar(r));

    // ✅ convert world point into ROOT LOCAL so label does NOT rotate with spin
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
      {/* ✅ fixed axis tilt (like a planet’s obliquity) */}
      <group ref={tiltRef}>
        {/* ✅ spin happens around the tilted axis */}
        <group ref={spinRef}>
          <mesh
            ref={meshRef}
            material={material}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
              document.body.style.cursor = "pointer";
              triggerFlicker();
              updateAnchorFromView();
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
      </group>

      {/* ✅ label does NOT spin (still outside tilt/spin) */}
      <group ref={labelRef} position={anchorLocalRef.current}>
        {hovered && (
          <group>
            {/* dot */}
            <mesh>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshBasicMaterial
                color={"black"}
                transparent
                opacity={flickerOn ? 0.25 : 0.9} />
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
                  }} >
                  {def.name}
                </Text>
              </group>
            </Billboard>
          </group>)}
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
      el.scrollTop -= e.deltaY;
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
                ref={thumbRef}
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

function StarStreakField({
  count = 1200,
  radius = 22,
  depth = 130,
  scrollOffsetRef,
  scrollVelRef,
}: {
  count?: number;
  radius?: number;
  depth?: number;
  scrollOffsetRef: React.MutableRefObject<number>;
  scrollVelRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const smoothVelRef = useRef(0);

  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(), []);
  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const tmpQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), // align cylinder axis to Z
    []
  );

  const stars = useMemo(() => {
    const arr: { pos: THREE.Vector3; phase: number }[] = [];
    const zMin = -70;
    const zMax = 16;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() * 2 - 1) * radius;
      const y = (Math.random() * 2 - 1) * (radius * 0.7);
      const z = THREE.MathUtils.lerp(zMin, zMax, Math.random());
      arr.push({ pos: new THREE.Vector3(x, y, z), phase: Math.random() * Math.PI * 2 });
    }
    return arr;
  }, [count, radius]);

  useFrame((state, dt) => {
    const im = meshRef.current;
    if (!im) return;

    // velocity is in px/s (we'll map it to world units)
    const vAbsPx = Math.abs(scrollVelRef.current);

    // smooth velocity to avoid jitter
    smoothVelRef.current = THREE.MathUtils.lerp(smoothVelRef.current, vAbsPx, 0.12);

    // map px/s -> world streak length
    const mapped = smoothVelRef.current / 1400; // tune this
    const streakLen = THREE.MathUtils.clamp(0.06 + mapped * 2.2, 0.06, 3.5);

    // recycle stars along camera travel
    const camZ = camera.position.z;
    const behindZ = camZ + 10;
    const aheadZ = camZ - (depth + 40);

    const t = state.clock.getElapsedTime();

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];

      if (s.pos.z > behindZ) {
        s.pos.z = aheadZ - Math.random() * 30;
        s.pos.x = (Math.random() * 2 - 1) * radius;
        s.pos.y = (Math.random() * 2 - 1) * (radius * 0.7);
        s.phase = Math.random() * Math.PI * 2;
      }

      // pulse brightness/size even when stopped
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.2 + s.phase);
      const motionAmt = THREE.MathUtils.clamp(mapped * 2.0, 0, 1);
      const dotScale = THREE.MathUtils.lerp(0.65, 1.0, motionAmt);

      tmpPos.copy(s.pos);
      tmpScale.set(0.065 * pulse * dotScale, streakLen, 0.065 * pulse * dotScale);

      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      im.setMatrixAt(i, tmpMat);
    }

    im.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, stars.length]}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial
        color={"#ffffff"}
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

function ParallaxBackground({
  z = -140,
  width = 260,
  height = 140,
  zoomStrength = 0.22,
  driftX = 0.8,
  driftY = 0.35,
}: {
  z?: number;
  width?: number;
  height?: number;
  zoomStrength?: number;
  driftX?: number;
  driftY?: number;
}) {
  const scroll = useScroll();
  const bgTex = useLoader(THREE.TextureLoader, "/assets/background.png");

  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    // sRGB correct
    if ("colorSpace" in bgTex) {
      // @ts-ignore
      bgTex.colorSpace = THREE.SRGBColorSpace;
    } else {
      // @ts-ignore
      bgTex.encoding = THREE.sRGBEncoding;
    }

    bgTex.anisotropy = 8;
    bgTex.wrapS = THREE.ClampToEdgeWrapping;
    bgTex.wrapT = THREE.ClampToEdgeWrapping;
    bgTex.needsUpdate = true;
  }, [bgTex]);

  useFrame((_, dt) => {
    const off = scroll.offset*0.35; // 0..1

    // "zoom in" slowly with scroll
    const targetScale = 1 + off * zoomStrength;

    if (groupRef.current) {
      // tiny drift for depth feel
      const targetX = -off * driftX;
      const targetY = off * driftY;

      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 1 - Math.pow(0.0001, dt));
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 1 - Math.pow(0.0001, dt));
      groupRef.current.scale.x = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 1 - Math.pow(0.0001, dt));
      groupRef.current.scale.y = THREE.MathUtils.lerp(groupRef.current.scale.y, targetScale, 1 - Math.pow(0.0001, dt));
      groupRef.current.scale.z = 1;
    }
  });

  return (
    <Billboard follow lockZ={false} lockX={false} lockY={false}>
      <group ref={groupRef} position={[0, 0, z]}>
        <mesh ref={meshRef}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={bgTex} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      </group>
    </Billboard>
  );
}

export default function GalaxyMenu() {
  const router = useRouter();
  const { startLoading } = useLoading();
  const scrollOffsetRef = useRef(0); // 0..1
  const scrollVelRef = useRef(0);    // px/s

  useEffect(() => {
    let lastY = window.scrollY;
    let lastT = performance.now();

    const update = () => {
      const y = window.scrollY;
      const t = performance.now();
      const dt = Math.max(1, t - lastT);

      const dy = y - lastY;
      scrollVelRef.current = (dy / dt) * 1000; // px/s

      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      scrollOffsetRef.current = y / maxScroll;

      lastY = y;
      lastT = t;
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Order + spacing matters: closest planet is About Me and always starts “near”
  const planets: PlanetDef[] = useMemo(
    () => [
      {
        name: "about me",
        href: "/about",
        position: [-2.2, 0.6, 0],
        radius: 1.15,
        color: "#538899",
        rotationSpeed: 0.55,
        axis: axisFromObliquity(18, 25), // slight tilt
      },
      {
        name: "coding projects",
        href: "/coding-projects",
        position: [2.5, -0.4, -12],
        radius: 1.35,
        color: "#522062",
        rotationSpeed: 0.35,
        axis: axisFromObliquity(7, 140), // near-upright
      },
      {
        name: "art commissions",
        href: "/art-commissions",
        position: [-1.0, -0.9, -24],
        radius: 1.25,
        color: "#f80780",
        rotationSpeed: 0.7,
        axis: axisFromObliquity(33, 300), // noticeable tilt
      },
    ],
    []
  );


  const closestPlanetIndex = useMemo(() => {
    const cam = new THREE.Vector3(0, 0, 8); // matches CameraRail start
    let bestIdx = 0;
    let bestDist = Infinity;

    planets.forEach((p, i) => {
      const d = cam.distanceTo(new THREE.Vector3(...p.position));
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });

    return bestIdx;
  }, [planets]);


  return (
    <div className="w-screen h-screen relative">
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
        {/* background stars */}
        <Stars radius={120} depth={80} count={2500} factor={3} fade speed={0.6} />
        
        <StarStreakField
          count={1400}
          radius={24}
          depth={140}
          scrollOffsetRef={scrollOffsetRef}
          scrollVelRef={scrollVelRef}
        />

        {/* lighting */}
        <ambientLight intensity={0.7} />
        <pointLight position={[6, 6, 8]} intensity={1.1} color={"#faccd0"} />
        <pointLight position={[-8, -3, -10]} intensity={0.7} color={"#538899"} />

        {/* Scroll moves camera forward through 3D space */}
        <ScrollControls pages={3.2} damping={0.2}>
          <ParallaxBackground />

          {/* background starfield parallax (also slower) */}
          <group position={[0, 0, -90]}>
            <Stars radius={140} depth={120} count={2500} factor={3} fade speed={0.2} />
          </group>
          <CameraRail />
          <InvertScrollWheel />
          <DistanceScrollbar />
          {/* planets */}
          {planets.map((p, i) => (
            <Planet
              key={p.href}
              def={p}
              onNavigate={(href) => {
                startLoading();
                router.push(href)
              }}
              showOverlay={i === closestPlanetIndex} />
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
