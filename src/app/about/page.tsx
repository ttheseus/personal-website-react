"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Text } from "@react-three/drei";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { panels } from "./panels";

type PopupState =
  | { open: false }
  | { open: true; id: string; title?: string };

export default function AboutPage() {
  const router = useRouter();
  const [popup, setPopup] = useState<PopupState>({ open: false });
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);

  // Shared handler for both click-to-select and crosshair-select.
  // The exit door reuses the same hotspot mechanism with a reserved
  // id of "exit" — instead of opening a panel, it navigates home.
  const handleSelect = (id: string, title?: string) => {
    if (id === "exit") {
      router.push("/");
      return;
    }
    setPopup({ open: true, id, title });
  };

  return (
    <div className="w-screen h-screen relative">
      <Canvas camera={{ position: [0, 2.2, 7.5], fov: 55 }}>
        <ambientLight intensity={4} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1.6}
          castShadow
        />

        <pointLight position={[0, 4, 2]} intensity={0.9} />
        <pointLight position={[-6, 3, -4]} intensity={0.6} />

        <Room
          panels={panels}
          hoveredHotspotId={hoveredHotspotId}
          onHotspotClick={handleSelect}
        />

        <WASDCameraController
          enabled={!popup.open}
          moveSpeed={6.2}
          damping={0.12}
          minX={-8.2}
          maxX={8.2}
          minZ={-7.2}
          maxZ={7.2}
          onHoverHotspot={(id) => setHoveredHotspotId(id)}
          onSelectHotspot={handleSelect}
        />

      </Canvas>

      {/* Controls overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-8">
        <div className="pointer-events-none border border-[rgba(250,204,208,0.35)] bg-[rgba(0,0,0,0.35)] text-[#f2eef5] px-4 py-2 rounded-[14px] backdrop-blur-sm">
          W/S: forward/back • A/D: left/right • click objects to open a panel
        </div>
      </div>

      {/* Crosshair (center) */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <div className="w-[14px] h-[14px] rounded-full border border-white/90 opacity-90" />
      </div>

      {/* Popup */}
      {popup.open && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onMouseDown={() => setPopup({ open: false })}
        >
          <div
            className="w-[min(820px,92vw)] h-[min(520px,80vh)] rounded-[18px] shadow-xl border border-[rgba(0,0,0,0.12)]"
            style={{
              background: "#f2eef5", // off-white
              color: "#121212",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.12)]">
              <div className="font-[family-name:var(--font-inconsolata)] tracking-[0.18em] text-[12px] uppercase opacity-80">
                {popup.title ?? "panel"}
              </div>

              <button
                className="px-3 py-1 rounded-[10px] bg-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.10)] transition"
                onClick={() => setPopup({ open: false })}
              >
                close
              </button>
            </div>

            {/* Content comes from panels.tsx — edit that file, not here */}
            <div className="p-6 h-[calc(100%-56px)] overflow-auto">
              {panels.find((p) => p.id === popup.id)?.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Room({
  panels: panelDefs,
  onHotspotClick,
  hoveredHotspotId,
}: {
  panels: { id: string; title: string; position: [number, number, number] }[];
  onHotspotClick: (id: string, title?: string) => void;
  hoveredHotspotId: string | null;
}) {
  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0b0f16"),
        roughness: 0.95,
        metalness: 0.05,
      }),
    []
  );

  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1e293b"),
        roughness: 0.85,
        metalness: 0.0,
        emissive: new THREE.Color("#000000"),
        emissiveIntensity: 0.08,
      }),
    []
  );

  return (
    <group>
      {/* Floor (3D plane) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        material={floorMat}
        receiveShadow
      >
        <planeGeometry args={[18, 18]} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 2.3, -8]} material={wallMat}>
        <planeGeometry args={[18, 6]} />
      </mesh>
      <mesh position={[0, 2.3, 8]} rotation={[0, Math.PI, 0]} material={wallMat}>
        <planeGeometry args={[18, 6]} />
      </mesh>

      <mesh
        position={[-9, 2.3, 0]}
        rotation={[0, Math.PI / 2, 0]}
        material={wallMat}
      >
        <planeGeometry args={[18, 6]} />
      </mesh>

      <mesh
        position={[9, 2.3, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        material={wallMat}
      >
        <planeGeometry args={[18, 6]} />
      </mesh>

      {/* Simple props */}
      <mesh position={[0, 0.45, -4]} castShadow>
        <boxGeometry args={[3.2, 0.9, 1.2]} />
        <meshStandardMaterial color={"#522062"} roughness={0.55} metalness={0.05} />
      </mesh>

      <mesh position={[4.2, 0.55, 3.8]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 1.1, 22]} />
        <meshStandardMaterial color={"#538899"} roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Clickable hotspots — driven by panels.tsx, add a panel there to add one here */}
      {panelDefs.map((h) => (
        <Hotspot
          key={h.id}
          id={h.id}
          title={h.title}
          position={h.position}
          onClick={onHotspotClick}
          externallyHovered={hoveredHotspotId === h.id}
        />
      ))}

      {/* Exit door — behind the desk, on the back wall. Bright + crude
          on purpose; swap the mesh/sign for real 3D assets later. */}
      <ExitDoor onExit={() => onHotspotClick("exit")} />
    </group>
  );
}

function ExitDoor({ onExit }: { onExit: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    // Positioned on the back wall (z = -8), directly behind the desk (x = 0)
    <group position={[0, 0, -7.9]}>
      {/* Door slab — bright placeholder color, easy to spot */}
      <mesh
        position={[0, 1.3, 0]}
        userData={{ selectable: true, hotspotId: "exit", hotspotTitle: "exit" }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = "default";
        }}
        onClick={(e) => {
          e.stopPropagation();
          document.exitPointerLock?.();
          document.body.style.cursor = "default";
          onExit();
        }}
      >
        <boxGeometry args={[1.6, 2.6, 0.12]} />
        <meshStandardMaterial
          color={hovered ? "#ff4fb8" : "#f80780"}
          roughness={0.4}
          metalness={0.05}
          emissive={new THREE.Color("#f80780")}
          emissiveIntensity={hovered ? 0.5 : 0.3}
        />
      </mesh>

      {/* Exit sign — deliberately crude placeholder, swap for a 3D asset later */}
      <group position={[0, 2.95, 0.02]}>
        <mesh>
          <boxGeometry args={[1.3, 0.42, 0.08]} />
          <meshStandardMaterial
            color="#0b0f16"
            emissive={new THREE.Color("#00ff6a")}
            emissiveIntensity={0.6}
          />
        </mesh>
        <Text
          position={[0, 0, 0.05]}
          fontSize={0.22}
          color="#00ff6a"
          anchorX="center"
          anchorY="middle"
        >
          EXIT
        </Text>
      </group>

      {hovered && (
        <Html position={[0, 1.3, 0.1]} center style={{ pointerEvents: "none" }}>
          <div className="planet-label">
            <span className="cyber-arrow">leave</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function Hotspot({
  id,
  title,
  position,
  onClick,
  externallyHovered,
}: {
  id: string;
  title?: string;
  position: [number, number, number];
  onClick: (id: string, title?: string) => void;
  externallyHovered: boolean;
}) {
  const [pointerHovered, setPointerHovered] = useState(false);

  const hovered = externallyHovered || pointerHovered;

  return (
    <group position={position}>
      <mesh
        // Mark as selectable for crosshair raycasting:
        userData={{ selectable: true, hotspotId: id, hotspotTitle: title }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setPointerHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setPointerHovered(false);
          document.body.style.cursor = "default";
        }}
        onClick={(e) => {
          e.stopPropagation();
          document.exitPointerLock?.();
          document.body.style.cursor = "default";
          onClick(id, title);
        }}
      >
        <boxGeometry args={[1.1, 1.1, 1.1]} />
        <meshStandardMaterial
          color={hovered ? "#faccd0" : "#1f2937"}
          roughness={0.35}
          metalness={0.05}
          emissive={new THREE.Color("#000000")}
          emissiveIntensity={hovered ? 0.14 : 0.06}
        />
      </mesh>

      {hovered && (
        <Html center style={{ pointerEvents: "none" }}>
          <div className="planet-label">
            <span className="cyber-arrow">{title ?? id}</span>
            <span className="cyber-dots">
              <span className="cyber-dot" />
              <span className="cyber-dot" />
              <span className="cyber-dot" />
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

function WASDCameraController({
  enabled,
  moveSpeed = 6,
  damping = 0.12,
  minX = -Infinity,
  maxX = Infinity,
  minZ = -Infinity,
  maxZ = Infinity,
  onHoverHotspot,
  onSelectHotspot,
}: {
  enabled: boolean;
  moveSpeed?: number;
  damping?: number;
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  onHoverHotspot?: (id: string | null) => void;
  onSelectHotspot?: (id: string, title?: string) => void;
}) {
  const { camera, gl, scene } = useThree();

  const keys = useRef({ w: false, a: false, s: false, d: false });
  const targetPos = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0);

  const radius = 0.45;

  const isAltDown = useRef(false);
  const raycaster = useRef(new THREE.Raycaster());
  const hoveredId = useRef<string | null>(null);

  useEffect(() => {
    targetPos.current.copy(camera.position);

    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw.current = euler.y;
    pitch.current = euler.x;

    const preventContext = (e: MouseEvent) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", preventContext);

    return () => {
      gl.domElement.removeEventListener("contextmenu", preventContext);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard movement + Alt mouse-free
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "alt") {
        isAltDown.current = true;
        // free the mouse
        if (document.pointerLockElement === gl.domElement) {
          document.exitPointerLock?.();
        }
        document.body.style.cursor = "default";
      }
      if (k in keys.current) keys.current[k as "w" | "a" | "s" | "d"] = true;
    };

    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "alt") {
        isAltDown.current = false;
        // we don't auto-relock; user can click to re-lock
      }
      if (k in keys.current) keys.current[k as "w" | "a" | "s" | "d"] = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [gl.domElement]);

  // Pointer lock + mouse look
  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      if (!enabled) return;

      // If Alt is held, we want normal mouse behavior (no pointer lock)
      if (isAltDown.current) return;

      // Pointer lock for FPS look + center crosshair interaction
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
        return;
      }

      // If already locked, treat left click as "select what crosshair is on"
      if (e.button === 0) {
        const hit = getCrosshairHit();
        if (hit?.id && onSelectHotspot) {
          onSelectHotspot(hit.id, hit.title);
          document.exitPointerLock?.();
          document.body.style.cursor = "default";
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!enabled) return;
      if (isAltDown.current) return;
      if (document.pointerLockElement !== canvas) return;

      const sensitivity = 0.0022;
      yaw.current -= e.movementX * sensitivity;
      pitch.current -= e.movementY * sensitivity;

      const maxPitch = Math.PI / 2 - 0.08;
      pitch.current = Math.max(-maxPitch, Math.min(maxPitch, pitch.current));
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [enabled, gl.domElement, onSelectHotspot]);

  function getCrosshairHit(): { id: string; title?: string } | null {
    // Ray from the center of the screen
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Intersect everything, then walk up parents to find selectable hotspot
    const hits = raycaster.current.intersectObjects(scene.children, true);
    for (const h of hits) {
      let obj: THREE.Object3D | null = h.object;
      while (obj) {
        const ud: any = obj.userData;
        if (ud?.selectable && ud?.hotspotId) {
          return { id: String(ud.hotspotId), title: ud.hotspotTitle };
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  useFrame((_, dt) => {
    if (!enabled) return;

    const canvas = gl.domElement;
    const locked = document.pointerLockElement === canvas;

    // Cursor visibility behavior:
    // - locked & not Alt => hide cursor
    // - otherwise => normal cursor
    if (locked && !isAltDown.current) {
      document.body.style.cursor = "none";
    } else {
      // don't force pointer cursor; let hover handlers do that
      if (!isAltDown.current) document.body.style.cursor = "default";
    }

    // Apply look rotation
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;
    camera.rotation.z = 0;

    // Crosshair hover (only when locked & not Alt)
    if (locked && !isAltDown.current) {
      const hit = getCrosshairHit();
      const nextId = hit?.id ?? null;

      if (nextId !== hoveredId.current) {
        hoveredId.current = nextId;
        onHoverHotspot?.(nextId);
      }
    } else {
      if (hoveredId.current !== null) {
        hoveredId.current = null;
        onHoverHotspot?.(null);
      }
    }

    // Movement relative to POV (project direction onto ground)
    const k = keys.current;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0) forward.normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();

    const move = new THREE.Vector3();
    if (k.w) move.add(forward);
    if (k.s) move.sub(forward);
    if (k.d) move.add(right);
    if (k.a) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(moveSpeed * dt);

      const next = targetPos.current.clone().add(move);

      // Wall collision (simple clamp “run into wall”)
      next.x = Math.max(minX + radius, Math.min(maxX - radius, next.x));
      next.z = Math.max(minZ + radius, Math.min(maxZ - radius, next.z));

      targetPos.current.copy(next);
    }

    camera.position.lerp(targetPos.current, 1 - Math.pow(1 - damping, dt * 60));

    // stable standing height
    camera.position.y = 2.2;
    targetPos.current.y = 2.2;
  });

  return null;
}
