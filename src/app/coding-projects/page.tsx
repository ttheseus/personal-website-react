"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { useLoading } from "../ui/components/Loading";

/*
 * Schwarzschild ray-tracing adaptation of:
 * https://github.com/oseiskar/black-hole
 *
 * The original project ray-traces light paths by integrating the
 * Schwarzschild geodesic ODE in a GLSL fragment shader.
 *
 * This page removes the original GUI, planet, orbit controls, stats,
 * Mustache shader generation, and Milky Way image. The core black-hole
 * ray integration, accretion-disk intersection, Doppler/beaming math,
 * and star/environment lookup are retained/adapted for React Three Fiber.
 *
 * Original repository: MIT license (see its COPYRIGHT.md).
 * The original Milky Way texture is CC-BY-NC 2.0, so it is deliberately
 * NOT used here. Put the MIT-licensed stars/accretion/spectra textures in
 * /public/assets/black-hole/ as described below.
 */

const PROJECT_BLOCKS = [
  {
    title: "project 01",
    content: (
      <>
        {/* =============================================================
            ADD YOUR CONTENT HERE.
            This area is a normal scrollable React element.

            You can use:
              <p>...</p>
              <a href="https://example.com" target="_blank" rel="noreferrer">link</a>
              <img src="/assets/example.png" alt="..." />
              <iframe ... /> for YouTube embeds.
           ============================================================= */}
        <h2 className="cp-content-heading">S-KBD67 - FPS Emulator</h2>
        <p>
          Everyone loves FPS games! It's been a staple of gaming ever since the release of DOOM. Using a nerf gun, we connected a gyroscope, accelerometer and buttons and turned it into a controller that can play FPS games in real life. Cuz who doesn't love guns?
        </p>
        
        <br></br>

        <p>
          We used:
        </p>

        <p>
          - ESP32 | main microcontroller
        </p>

        <p>
          - MPU6050 | aiming
        </p>

        <p>
          - Joystick | WASD movement
        </p> 

        <p>
          - Push buttons | shooting, reloading, swapping weapons
        </p>

        <br></br>

        <p>
          This project was built at Hack the North, and was selected to be a finalist project!
        </p>

        <p>
          <a
            href="https://devpost.com/software/s-kbd67?_gl=1*754mqt*_gcl_au*MTAxMDI4OTc1NC4xNzg1MDkyMDg0*_ga*MjIyNjEzODAyLjE3ODUwOTIwODU.*_ga_0YHJK3Y10M*czE3ODk2MDY4ODYkbzMkZzEkdDE3ODk2MDY4ODgkajU4JGwwJGgw"
            target="_blank"
            rel="noreferrer"
            className="cp-link"
          >
            Devpost →
          </a>
        </p>

        {/* YouTube example — replace VIDEO_ID with the actual video ID. */}
        
        <div className="cp-video-wrap">
          <iframe
            src="https://www.youtube.com/embed/6Td6KtRum8E?si=jqf5BzqLZKiH3L69"
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        
      </>
    ),
  },

  {
    title: "project 02",
    content: (
      <>
        {/* ADD YOUR SECOND PROJECT'S CONTENT HERE. */}
        <h2 className="cp-content-heading">Personal Website</h2>
        <p>
          This website... <br></br> <br></br>I used 3.js for the 3D pages (front page, about me) and referenced a github project for the black hole simulated in the background on this page. 
        </p>

        <p>
          <a
            href="https://github.com/oseiskar/black-hole"
            target="_blank"
            rel="noreferrer"
            className="cp-link"
          >
            Github repo referenced →
          </a>
        </p>
      </>
    ),
  },

  {
    title: "project 03",
    content: (
      <>
        {/* ADD YOUR THIRD PROJECT'S CONTENT HERE. */}
        <h2 className="cp-content-heading">Placeholder</h2>
        <p>
          Test.
        </p>
      </>
    ),
  },
];

const CODING_PROJECTS_PAGE_STYLES = `
  .coding-projects-page {
    position: relative;
    min-height: 100vh;
    width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    background: #030107;
    color: #eee7f2;
    font-family: var(--font-inconsolata, monospace);
  }

  .black-hole-background {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: #030107;
  }

  .black-hole-background canvas {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }

  .coding-projects-window {
    position: relative;
    z-index: 2;
    width: min(700px, calc(100vw - 40px));
    min-height: 585px;
    margin: 9vh auto 14vh;
    border: 1px solid rgba(231, 220, 242, 0.55);
    background: rgba(14, 8, 24, 0.50);
    box-shadow:
      0 0 0 1px rgba(82, 32, 98, 0.38),
      0 24px 90px rgba(0, 0, 0, 0.5),
      0 0 55px rgba(82, 32, 98, 0.18);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
  }

  .coding-projects-titlebar {
    height: 46px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px 0 15px;
    border-bottom: 1px solid rgba(231, 220, 242, 0.34);
    background: rgba(22, 12, 36, 0.68);
  }

  .coding-projects-title {
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(245, 238, 249, 0.9);
  }

  .coding-projects-window-buttons {
    display: flex;
    gap: 5px;
  }

  .retro-nav-button {
    width: 31px;
    height: 25px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(231, 220, 242, 0.55);
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.35);
    color: #eee7f2;
    font-family: monospace;
    font-size: 16px;
    line-height: 1;
    box-shadow: inset 1px 1px rgba(255, 255, 255, 0.07);
  }

  .retro-nav-button:hover {
    background: rgba(82, 32, 98, 0.65);
    transform: none;
    animation: none;
  }

  .retro-nav-button::before,
  .retro-nav-button::after {
    display: none;
  }

  .coding-projects-window-body {
    padding: 16px;
  }

  .coding-projects-project-count {
    margin-bottom: 9px;
    font-size: 10px;
    letter-spacing: 0.16em;
    color: rgba(238, 231, 242, 0.48);
    text-align: right;
  }

  .coding-project-card {
    width: 100%;
    height: 480px;
    border: 1px solid rgba(231, 220, 242, 0.34);
    background: rgba(5, 3, 10, 0.42);
    box-shadow: inset 0 0 35px rgba(0, 0, 0, 0.24);
    display: flex;
    flex-direction: column;
  }

  .coding-project-card > h1 {
    flex: 0 0 auto;
    margin: 0;
    padding: 15px 18px 13px;
    border-bottom: 1px dashed rgba(231, 220, 242, 0.25);
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .coding-project-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 24px;
    scrollbar-width: thin;
    scrollbar-color: rgba(231, 220, 242, 0.45) transparent;
  }

  .coding-project-scroll::-webkit-scrollbar {
    width: 8px;
  }

  .coding-project-scroll::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.18);
  }

  .coding-project-scroll::-webkit-scrollbar-thumb {
    background: rgba(231, 220, 242, 0.35);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .coding-project-scroll p {
    margin: 0 0 17px;
    color: rgba(245, 238, 249, 0.82);
    font-family: var(--font-inconsolata, monospace);
    font-size: 14px;
    line-height: 1.75;
  }

  .cp-content-heading {
    margin: 0 0 18px;
    font-size: 24px;
    font-weight: 500;
    letter-spacing: 0.06em;
  }

  .cp-link {
    color: #c6a5d5;
    text-decoration: none;
  }

  .cp-link:hover {
    color: #faccd0;
  }

  .cp-video-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    margin-top: 22px;
    border: 1px solid rgba(231, 220, 242, 0.28);
  }

  .cp-video-wrap iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .retro-desktop {
    position: fixed;
    top: 24px;
    left: 20px;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .retro-desktop-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 74px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: var(--font-inconsolata, monospace);
    color: #eee7f2;
    text-decoration: none;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }

  /* globals.css puts a decorative purple border + hover underline on every
     <button> via ::after / ::before. Kill both here, the same way
     .retro-nav-button already does, so these icons render clean. */
  .retro-desktop-icon::before,
  .retro-desktop-icon::after {
    display: none;
  }

  .retro-desktop-icon:hover {
    animation: none;
  }

  .retro-desktop-icon:focus-visible .retro-desktop-icon-label {
    color: #faccd0;
  }

  .retro-desktop-icon-box {
    position: relative;
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    background: #2a0e38;
    border: 1.5px solid #ffffff;
    border-radius: 4px;
    box-shadow: none;
    transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
  }

  .retro-desktop-icon:hover .retro-desktop-icon-box {
    transform: scale(1.08);
  }

  .retro-desktop-icon:active .retro-desktop-icon-box {
    transform: scale(0.96);
  }

  .retro-desktop-icon-box.is-off {
    opacity: 0.5;
  }

  .retro-desktop-icon-label {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-align: center;
    line-height: 1.3;
    color: rgba(238, 231, 242, 0.85);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
  }

  .retro-desktop-icon-led {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(231, 220, 242, 0.25);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.4);
  }

  .retro-desktop-icon-led.is-on {
    background: #8ef6a4;
    box-shadow: 0 0 6px rgba(142, 246, 164, 0.85);
  }

  .retro-icon-arrow {
    width: 0;
    height: 0;
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    border-right: 12px solid #eee7f2;
  }

  .retro-icon-window {
    width: 26px;
    height: 20px;
    border: 2px solid #eee7f2;
    border-radius: 1px;
    position: relative;
  }

  .retro-icon-window::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 5px;
    background: #eee7f2;
  }

  .retro-icon-planet {
    position: relative;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #eee7f2;
  }

  .retro-icon-planet::after {
    content: "";
    position: absolute;
    inset: -7px -3px;
    border: 2px solid #eee7f2;
    border-radius: 50%;
    transform: rotate(-24deg) scaleY(0.32);
  }

  @media (max-width: 700px) {
    .coding-projects-window {
      width: calc(100vw - 24px);
      margin-top: 5vh;
    }

    .coding-projects-window-body {
      padding: 10px;
    }

    .coding-project-card {
      height: 68vh;
      min-height: 420px;
    }

    .retro-desktop {
      top: 12px;
      left: 10px;
      gap: 14px;
    }

    .retro-desktop-icon {
      width: 58px;
    }

    .retro-desktop-icon-box {
      width: 40px;
      height: 40px;
    }

    .retro-desktop-icon-label {
      font-size: 9px;
    }
  }
`;

export default function CodingProjectsPage() {
  const router = useRouter();
  const { startLoading } = useLoading();
  const [activeBlock, setActiveBlock] = useState(0);
  const [showPopup, setShowPopup] = useState(true);
  const [showBackground, setShowBackground] = useState(true);

  const goBack = () => {
    startLoading();
    router.push("/");
  };

  const goLeft = () => {
    setActiveBlock((current) =>
      current === 0 ? PROJECT_BLOCKS.length - 1 : current - 1,
    );
  };

  const goRight = () => {
    setActiveBlock((current) =>
      current === PROJECT_BLOCKS.length - 1 ? 0 : current + 1,
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CODING_PROJECTS_PAGE_STYLES }} />
      <main className="coding-projects-page">
      {/* Retro desktop icons: back / pop-up toggle / background toggle. */}
      <nav className="retro-desktop" aria-label="Quick actions">
        <button type="button" className="retro-desktop-icon" onClick={goBack}>
          <span className="retro-desktop-icon-box">
            <span className="retro-icon-arrow" aria-hidden="true" />
          </span>
          <span className="retro-desktop-icon-label">back</span>
        </button>

        <button
          type="button"
          className="retro-desktop-icon"
          onClick={() => setShowPopup((v) => !v)}
          aria-pressed={showPopup}
        >
          <span className={`retro-desktop-icon-box${showPopup ? "" : " is-off"}`}>
            <span
              className={`retro-desktop-icon-led${showPopup ? " is-on" : ""}`}
              aria-hidden="true"
            />
            <span className="retro-icon-window" aria-hidden="true" />
          </span>
          <span className="retro-desktop-icon-label">pop-up toggle</span>
        </button>

        <button
          type="button"
          className="retro-desktop-icon"
          onClick={() => setShowBackground((v) => !v)}
          aria-pressed={showBackground}
        >
          <span className={`retro-desktop-icon-box${showBackground ? "" : " is-off"}`}>
            <span
              className={`retro-desktop-icon-led${showBackground ? " is-on" : ""}`}
              aria-hidden="true"
            />
            <span className="retro-icon-planet" aria-hidden="true" />
          </span>
          <span className="retro-desktop-icon-label">background toggle</span>
        </button>
      </nav>

      {/* Full-screen ray-traced background. It does not participate in page layout. */}
      {showBackground && (
        <div className="black-hole-background" aria-hidden="true">
          <Suspense fallback={null}>
            <Canvas
              // IMPORTANT PERFORMANCE SETTING:
              // 0.70–1.0 DPR is much cheaper than rendering every physical pixel.
              dpr={[0.7, 1]}
              camera={{ position: [0, 0, 1], fov: 45, near: 0.1, far: 10 }}
              gl={{
                antialias: false,
                alpha: false,
                powerPreference: "high-performance",
              }}
              frameloop="always"
            >
              <SchwarzschildBlackHole />
            </Canvas>
          </Suspense>
        </div>
      )}

      {showPopup && (
      <section className="coding-projects-window" aria-label="Coding projects">
        <header className="coding-projects-titlebar">
          <div className="coding-projects-title">
            CODING_PROJECTS.EXE
          </div>

          <div className="coding-projects-window-buttons">
            <button
              type="button"
              onClick={goLeft}
              aria-label="Previous project"
              className="retro-nav-button"
            >
              &lt;
            </button>
            <button
              type="button"
              onClick={goRight}
              aria-label="Next project"
              className="retro-nav-button"
            >
              &gt;
            </button>
          </div>
        </header>

        <div className="coding-projects-window-body">
          <div className="coding-projects-project-count">
            {String(activeBlock + 1).padStart(2, "0")} / {String(PROJECT_BLOCKS.length).padStart(2, "0")}
          </div>

          <article className="coding-project-card">
            <h1>{PROJECT_BLOCKS[activeBlock].title}</h1>
            <div className="coding-project-scroll">
              {PROJECT_BLOCKS[activeBlock].content}
            </div>
          </article>
        </div>
      </section>
      )}
      </main>
    </>
  );
}

function SchwarzschildBlackHole() {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const { gl } = useThree();

  const target = useMemo(() => new THREE.Vector3(), []);
  const worldUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);

  // Keep the camera completely fixed in the webpage.
  // The observer itself orbits the black hole, as in the original demo.
  const uniforms = useMemo(
    () => ({
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      cam_pos: { value: new THREE.Vector3(0, 0, 14) },
      cam_x: { value: new THREE.Vector3(1, 0, 0) },
      cam_y: { value: new THREE.Vector3(0, 1, 0) },
      cam_z: { value: new THREE.Vector3(0, 0, -1) },
      cam_vel: { value: new THREE.Vector3(0, 0, 0) },
      star_texture: { value: null as THREE.Texture | null },
      accretion_disk_texture: { value: null as THREE.Texture | null },
      spectrum_texture: { value: null as THREE.Texture | null },
    }),
    [],
  );

  const [starTexture, diskTexture, spectrumTexture] = useBlackHoleTextures();

  useEffect(() => {
    uniforms.star_texture.value = starTexture;
    uniforms.accretion_disk_texture.value = diskTexture;
    uniforms.spectrum_texture.value = spectrumTexture;
  }, [starTexture, diskTexture, spectrumTexture, uniforms]);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;

    // The camera slowly orbits the black hole (same circular-orbit shape
    // as the original demo), but at a deliberately gentle, hand-tuned pace
    // -- a tiny, very slow drift rather than a fast sweep -- so the star
    // field visibly moves while staying calm as a background.
    const observerDistance = 8.0; // even closer, per request
    const inclination = THREE.MathUtils.degToRad(-10);

    const orbitalV = 1.0 / Math.sqrt(2.0 * (observerDistance - 1.0));
    const ANGULAR_DRIFT_SPEED = 0.015; // radians/sec: tiny, very slow drift
    const angle = elapsed * ANGULAR_DRIFT_SPEED;

    const c = Math.cos(angle);
    const s = Math.sin(angle);

    const px = c * observerDistance;
    const py = s * observerDistance;
    const vx0 = -s * orbitalV;
    const vy0 = c * orbitalV;

    // Rotate the orbital plane around Y, matching the original's inclined
    // observer orbit (Y-axis rotation by orbital_inclination).
    const x = px * Math.cos(inclination) - 0 * Math.sin(inclination);
    const y = py;
    const z = -px * Math.sin(inclination);

    const position = uniforms.cam_pos.value;
    position.set(x, y, z);

    const vx = vx0 * Math.cos(inclination);
    const vy = vy0;
    const vz = -vx0 * Math.sin(inclination);
    uniforms.cam_vel.value.set(vx, vy, vz);

    // Build a camera basis that looks toward the black hole.
    target.set(0, 0, 0);
    forward.copy(target).sub(position).normalize();
    right.crossVectors(forward, worldUp).normalize();
    up.crossVectors(right, forward).normalize();

    // Roll the view 90 degrees clockwise (as seen on screen) by swapping
    // the right/up basis vectors: old "up" becomes the new "right", and
    // the negated old "right" becomes the new "up".
    uniforms.cam_x.value.set(up.x, up.y, up.z);
    uniforms.cam_y.value.set(-right.x, -right.y, -right.z);
    uniforms.cam_z.value.copy(forward);

    uniforms.time.value += delta;

    // Shader resolution follows the actual drawing-buffer size.
    uniforms.resolution.value.set(
      gl.domElement.width,
      gl.domElement.height,
    );
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={BLACK_HOLE_VERTEX_SHADER}
        fragmentShader={BLACK_HOLE_FRAGMENT_SHADER}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function useBlackHoleTextures() {
  const loader = useMemo(() => new THREE.TextureLoader(), []);
  const [textures, setTextures] = useState<
    [THREE.Texture, THREE.Texture, THREE.Texture] | null
  >(null);

  useEffect(() => {
    let alive = true;

    Promise.all([
      loadTexture(loader, "/assets/black-hole/stars.png", THREE.LinearFilter),
      loadTexture(
        loader,
        "/assets/black-hole/accretion-disk.png",
        THREE.LinearFilter,
        THREE.RepeatWrapping,
      ),
      loadTexture(loader, "/assets/black-hole/spectra.png", THREE.LinearFilter),
    ])
      .then((loaded) => {
        if (alive) setTextures(loaded as [THREE.Texture, THREE.Texture, THREE.Texture]);
      })
      .catch(() => {
        // Keep the lightweight fallback if an asset is missing.
      });

    return () => {
      alive = false;
    };
  }, [loader]);

  // A procedural 1x1 fallback prevents the shader from sampling a null texture
  // during the first frame. Real textures replace these immediately after load.
  const fallback = useMemo(() => {
    const make = (rgba: [number, number, number, number]) => {
      const data = new Uint8Array(rgba);
      const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
      texture.needsUpdate = true;
      return texture;
    };

    return [
      make([0, 0, 0, 255]),
      make([255, 255, 255, 255]),
      make([255, 255, 255, 255]),
    ] as [THREE.Texture, THREE.Texture, THREE.Texture];
  }, []);

  return textures ?? fallback;
}

function loadTexture(
  loader: THREE.TextureLoader,
  url: string,
  filter: THREE.MagnificationTextureFilter,
  wrapT?: THREE.Wrapping,
) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        texture.magFilter = filter;
        texture.minFilter = THREE.LinearFilter;
        // The original demo never overrides wrapS/wrapT (three.js defaults
        // both to ClampToEdgeWrapping). The accretion disk is the one
        // exception: its angular coordinate is now animated, so it needs to
        // repeat seamlessly instead of clamping at the wrap point.
        if (wrapT) texture.wrapT = wrapT;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });
}

const BLACK_HOLE_VERTEX_SHADER = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

/*
 * This is the core ray-tracing portion adapted from oseiskar/black-hole's
 * raytracer.glsl. The original integrates the Schwarzschild null-geodesic
 * using a leapfrog stepper on the GPU.
 *
 * Compile-time GUI branches from the original have been removed because this
 * page has one fixed configuration: accretion disk ON, observer motion ON,
 * beaming ON, Doppler shift ON, no planet.
 */
const BLACK_HOLE_FRAGMENT_SHADER = `
#define M_PI 3.141592653589793238462643383279
#define DEG_TO_RAD (M_PI/180.0)
#define SQ(x) ((x)*(x))

const float SPECTRUM_TEX_TEMPERATURE_RANGE = 65504.0;
const float SPECTRUM_TEX_WAVELENGTH_RANGE = 2048.0;
const float SPECTRUM_TEX_RATIO_RANGE = 6.48053329012;

const float BLACK_BODY_TEXTURE_COORD = 1.0;
const float SINGLE_WAVELENGTH_TEXTURE_COORD = 0.5;
const float TEMPERATURE_LOOKUP_RATIO_TEXTURE_COORD = 0.0;

uniform vec2 resolution;
uniform float time;
uniform vec3 cam_pos;
uniform vec3 cam_x;
uniform vec3 cam_y;
uniform vec3 cam_z;
uniform vec3 cam_vel;

uniform sampler2D star_texture;
uniform sampler2D accretion_disk_texture;
uniform sampler2D spectrum_texture;

// Matches the original demo's default "medium" quality preset.
const int NSTEPS = 100;
const float MAX_REVOLUTIONS = 2.0;
const float ACCRETION_MIN_R = 1.5;
const float ACCRETION_WIDTH = 5.0;
const float ACCRETION_BRIGHTNESS = 0.9;
const float ACCRETION_TEMPERATURE = 3900.0;
const float STAR_MIN_TEMPERATURE = 4000.0;
const float STAR_MAX_TEMPERATURE = 15000.0;
const float STAR_BRIGHTNESS = 1.0;
const float FOV_ANGLE_DEG = 90.0;
const float FOV_MULT = 1.0 / tan(DEG_TO_RAD * FOV_ANGLE_DEG * 0.5);

mat3 ROT_Y(float a) {
  return mat3(
    0.0, cos(a), sin(a),
    1.0, 0.0, 0.0,
    0.0, sin(a), -cos(a)
  );
}

const mat3 BG_COORDS = mat3(
  0.70710678, 0.0, -0.70710678,
  0.0, 1.0, 0.0,
  0.70710678, 0.0, 0.70710678
);

vec2 sphere_map(vec3 p) {
  return vec2(
    atan(p.x, p.y) / M_PI * 0.5 + 0.5,
    asin(clamp(p.z, -1.0, 1.0)) / M_PI + 0.5
  );
}

float smooth_step(float x, float threshold) {
  const float STEEPNESS = 1.0;
  return 1.0 / (1.0 + exp(-(x - threshold) * STEEPNESS));
}

vec3 lorentz_velocity_transformation(vec3 moving_v, vec3 frame_v) {
  float v = length(frame_v);
  if (v > 0.0) {
    vec3 v_axis = -frame_v / v;
    float gamma = 1.0 / sqrt(max(0.0001, 1.0 - v*v));
    float moving_par = dot(moving_v, v_axis);
    vec3 moving_perp = moving_v - v_axis * moving_par;
    float denom = 1.0 + v * moving_par;
    return (v_axis * (moving_par + v) + moving_perp / gamma) / denom;
  }
  return moving_v;
}

vec4 BLACK_BODY_COLOR(float t) {
  return texture2D(
    spectrum_texture,
    vec2(clamp(t / SPECTRUM_TEX_TEMPERATURE_RANGE, 0.0, 1.0), BLACK_BODY_TEXTURE_COORD)
  );
}

vec4 SINGLE_WAVELENGTH_COLOR(float lambda) {
  return texture2D(
    spectrum_texture,
    vec2(clamp(lambda / SPECTRUM_TEX_WAVELENGTH_RANGE, 0.0, 1.0), SINGLE_WAVELENGTH_TEXTURE_COORD)
  );
}

float TEMPERATURE_LOOKUP(float ratio) {
  return texture2D(
    spectrum_texture,
    vec2(clamp(ratio / SPECTRUM_TEX_RATIO_RANGE, 0.0, 1.0), TEMPERATURE_LOOKUP_RATIO_TEXTURE_COORD)
  ).r * SPECTRUM_TEX_TEMPERATURE_RANGE;
}

vec4 galaxy_color_removed(vec2 tex_coord) {
  // The original project uses a Milky Way texture here. That texture is
  // CC-BY-NC 2.0, so this page intentionally uses only the star texture.
  return vec4(0.0);
}

void main() {
  vec2 p = -1.0 + 2.0 * gl_FragCoord.xy / resolution.xy;
  p.y *= resolution.y / max(resolution.x, 1.0);

  vec3 pos = cam_pos;
  vec3 ray = normalize(p.x * cam_x + p.y * cam_y + FOV_MULT * cam_z);

  // Retained from the original relativistic observer treatment.
  ray = lorentz_velocity_transformation(ray, cam_vel);

  float ray_intensity = 1.0;
  float ray_doppler_factor = 1.0;
  float gamma = 1.0 / sqrt(max(0.0001, 1.0 - dot(cam_vel, cam_vel)));
  ray_doppler_factor = gamma * (1.0 + dot(ray, -cam_vel));

  // Original beaming contribution.
  ray_intensity /= max(
    0.001,
    ray_doppler_factor * ray_doppler_factor * ray_doppler_factor
  );

  float step = 0.01;
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);

  // Initial conditions for the Schwarzschild geodesic.
  float u = 1.0 / length(pos);
  float old_u;
  float u0 = u;
  vec3 normal_vec = normalize(pos);
  vec3 tangent_vec = normalize(cross(cross(normal_vec, ray), normal_vec));

  float tangentDot = dot(ray, tangent_vec);
  if (abs(tangentDot) < 0.00001) tangentDot = 0.00001;

  float du = -dot(ray, normal_vec) / tangentDot * u;
  float du0 = du;

  float phi = 0.0;
  float t = time;
  float dt = 1.0;
  vec3 old_pos = pos;

  for (int j = 0; j < NSTEPS; j++) {
    step = MAX_REVOLUTIONS * 2.0 * M_PI / float(NSTEPS);

    // Adaptive step size from the original implementation.
    float max_rel_u_change = (1.0 - log(max(u, 0.0001))) * 10.0 / float(NSTEPS);
    if (
      (du > 0.0 || (du0 < 0.0 && u0 / max(u, 0.0001) < 5.0)) &&
      abs(du) > abs(max_rel_u_change * u) / step
    ) {
      step = max_rel_u_change * u / abs(du);
    }

    old_u = u;

    // Leapfrog integration of the Schwarzschild null geodesic.
    u += du * step;
    float ddu = -u * (1.0 - 1.5 * u * u);
    du += ddu * step;

    if (u < 0.0) break;

    phi += step;

    old_pos = pos;
    pos = (cos(phi) * normal_vec + sin(phi) * tangent_vec) / max(u, 0.00001);
    ray = pos - old_pos;

    float solid_isec_t = 2.0;
    float ray_l = length(ray);

    // ------------------------------------------------------------
    // ACCRETION DISK INTERSECTION
    // ------------------------------------------------------------
    if (old_pos.z * pos.z < 0.0) {
      float safeRayZ = abs(ray.z) < 0.00001 ? 0.00001 : ray.z;
      float acc_isec_t = -old_pos.z / safeRayZ;

      if (acc_isec_t < solid_isec_t) {
        vec3 isec = old_pos + ray * acc_isec_t;
        float r = length(isec);

        if (r > ACCRETION_MIN_R) {
          // Animate the disk's own rotation over time, since the camera no
          // longer orbits to create a sense of motion.
          float diskAngle = fract(
            atan(isec.x, isec.y) / M_PI * 0.5 + 0.5 + time * 0.025
          );

          vec2 tex_coord = vec2(
            (r - ACCRETION_MIN_R) / ACCRETION_WIDTH,
            diskAngle
          );

          float accretion_intensity = ACCRETION_BRIGHTNESS;
          float temperature = ACCRETION_TEMPERATURE;

          vec3 accretion_v = vec3(-isec.y, isec.x, 0.0) /
            sqrt(max(0.001, 2.0 * (r - 1.0))) /
            (r * r);

          gamma = 1.0 / sqrt(max(0.0001, 1.0 - dot(accretion_v, accretion_v)));
          float doppler_factor = gamma *
            (1.0 + dot(ray / max(ray_l, 0.0001), accretion_v));

          // Original beaming term.
          accretion_intensity /= max(
            0.001,
            doppler_factor * doppler_factor * doppler_factor
          );

          // Original Doppler temperature shift.
          temperature /= max(0.001, ray_doppler_factor * doppler_factor);

          color += texture2D(accretion_disk_texture, tex_coord) *
            accretion_intensity *
            BLACK_BODY_COLOR(temperature);
        }
      }
    }

    // A little gravitational time evolution is retained through t.
    t -= dt;

    // Event horizon is u = 1 in the normalized units used by the original.
    if (u > 1.0) break;
  }

  // ------------------------------------------------------------
  // BACKGROUND STARS
  // ------------------------------------------------------------
  if (u < 1.0) {
    ray = normalize(pos - old_pos);
    vec2 tex_coord = sphere_map(ray * BG_COORDS);

    vec4 star_color = texture2D(star_texture, tex_coord);

    if (star_color.r > 0.0) {
      float t_coord = (
        STAR_MIN_TEMPERATURE +
        (STAR_MAX_TEMPERATURE - STAR_MIN_TEMPERATURE) * star_color.g
      ) / max(0.001, ray_doppler_factor);

      color += BLACK_BODY_COLOR(t_coord) * star_color.r * STAR_BRIGHTNESS;
    }
  }

  gl_FragColor = color * ray_intensity;
}

`;
