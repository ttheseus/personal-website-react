// src/app/coding-projects/page.tsx
"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { useLoading } from "../ui/components/Loading";

export default function CodingProjectsPage() {
  const { startLoading } = useLoading();

  // Ensure the loader is shown while this page mounts + shader compiles on first frame
  useEffect(() => {
    startLoading();
    // LoadingProvider will fade out after route change AND min duration (see tweak below)
    // so we don't need an explicit "stop" here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="w-screen h-screen relative"
      style={{
        // dark indigo, nearly black
        background: "radial-gradient(1200px 900px at 50% 40%, rgba(26,16,54,0.55), rgba(0,0,0,1) 62%)",
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 6], fov: 50 }}
      >
        {/* 3D star overlay */}
        <Stars radius={120} depth={90} count={2800} factor={3} fade speed={0.25} />

        {/* Black hole shader pass (1 plane, 1 draw call) */}
        <BlackHoleLook2D />

        {/* Tiny ambient so Drei stars look crisp without lighting artifacts */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 5]} intensity={0.7} />
      </Canvas>

      {/* Optional small title overlay (remove if you want it totally clean) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-7">
        <div className="border border-white/10 bg-black/20 text-[#f2eef5] px-4 py-2 rounded-[14px] backdrop-blur-sm">
          <span className="font-[family-name:var(--font-inconsolata)] tracking-[0.22em] text-[12px] uppercase opacity-80">
            coding projects
          </span>
        </div>
      </div>
    </div>
  );
}

function BlackHoleLook2D() {
  return (
    <group>
      {/* Center black sphere (shadow) */}
      <mesh>
        <sphereGeometry args={[0.85, 64, 64]} />
        <meshStandardMaterial color="#000000" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Thin photon ring outline */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.98, 1.01, 256]} />
        <meshBasicMaterial
          color="#ffcf8a"
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Main 2D-ish accretion disk ring (animated shader) */}
      <DiskRing inner={1.05} outer={2.35} y={0} />

      {/* Far-side lensed image (top arc) */}
      <ArcRing inner={1.05} outer={2.15} y={1.08} arc={Math.PI * 1.1} />

      {/* Underside lensed image (smaller bottom arc) */}
      <ArcRing inner={1.05} outer={1.85} y={-1.05} arc={Math.PI * 0.85} />

      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 3, 5]} intensity={0.65} />
    </group>
  );
}

function DiskRing({ inner, outer, y }: { inner: number; outer: number; y: number }) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uInner: { value: inner },
      uOuter: { value: outer },
    }),
    [inner, outer]
  );

  useFrame((_, dt) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += dt;
  });

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <ringGeometry args={[inner, outer, 512]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vPos;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vPos = wp.xz;               // ring plane coords
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          precision highp float;
          varying vec2 vPos;
          uniform float uTime;
          uniform float uInner;
          uniform float uOuter;

          float hash12(vec2 p){
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
          }

          float noise(vec2 p){
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash12(i);
            float b = hash12(i + vec2(1.0,0.0));
            float c = hash12(i + vec2(0.0,1.0));
            float d = hash12(i + vec2(1.0,1.0));
            vec2 u = f*f*(3.0-2.0*f);
            return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
          }

          void main() {
            float r = length(vPos);
            float ang = atan(vPos.y, vPos.x);

            // mask inside ring
            float ring = smoothstep(uOuter, uOuter - 0.06, r) * smoothstep(uInner, uInner + 0.04, r);

            // “hotter” near inner edge
            float heat = pow(clamp((uOuter - r) / (uOuter - uInner), 0.0, 1.0), 0.55);

            // Doppler-ish bright side
            float beam = 0.35 + 1.85 * smoothstep(-0.2, 1.0, cos(ang - 0.9));

            // flowing streak bands (this is the key)
            float t = uTime * 0.9;
            float bands = sin(ang * 20.0 + r * 7.5 - t * 2.3) * 0.5 + 0.5;
            float grit = noise(vec2(ang * 4.0, r * 6.0 + t * 1.3));
            float detail = mix(bands, grit, 0.45);

            // palette like reference (red→orange→hot)
            vec3 deepRed = vec3(0.65, 0.06, 0.02);
            vec3 orange  = vec3(1.10, 0.30, 0.05);
            vec3 hot     = vec3(1.25, 0.85, 0.18);

            vec3 col = mix(deepRed, orange, smoothstep(0.10, 0.70, heat));
            col = mix(col, hot, smoothstep(0.55, 1.0, heat));

            float intensity = ring * (0.25 + 2.2 * heat) * (0.65 + 1.2 * detail) * beam;

            // soften edges
            float feather = smoothstep(uInner + 0.02, uInner + 0.20, r) * smoothstep(uOuter - 0.20, uOuter - 0.02, r);

            col *= intensity * feather;

            // tonemap-ish clamp
            col = col / (1.0 + col);

            gl_FragColor = vec4(col, clamp(intensity, 0.0, 0.95));
          }
        `}
      />
    </mesh>
  );
}

function ArcRing({
  inner,
  outer,
  y,
  arc,
}: {
  inner: number;
  outer: number;
  y: number;
  arc: number;
}) {
  // Use a partial torus band, flattened to feel “2D”, then placed above/below.
  return (
    <group position={[0, y, 0]} scale={[1.0, 0.32, 1.0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[1.65, (outer - inner) * 0.35, 24, 320, arc]} />
        <meshBasicMaterial
          color="#ff9a3b"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[1.65, (outer - inner) * 0.65, 18, 260, arc]} />
        <meshBasicMaterial
          color="#ff3f1f"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
