"use client";

import { OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { OrthographicCamera as ThreeOrthographicCamera } from "three";
import { DEFAULT_BADGE_APPEARANCE } from "./badgeAppearance";
import { SpatialBadge, SpatialBadgeShadows } from "./SpatialBadge";
import styles from "./OrbitMaterialPrototype.module.css";

type OrbitNode = {
  id: string;
  name: string;
  role: string;
  position: readonly [number, number];
  current?: boolean;
};

const PROVIDERS: OrbitNode[] = [
  { id: "current", name: "Kristine", role: "O.T.", position: [-2.55, -1.65], current: true },
  { id: "caretaker", name: "Mona", role: "Caretaker", position: [0, -2.52] },
  { id: "supervisor", name: "Erin", role: "BCBA", position: [2.55, -1.6] },
  { id: "behavior", name: "Michael", role: "Bx Tech", position: [2.75, 1.05] },
  { id: "educator", name: "Casey", role: "Educator", position: [0.45, 2.55] },
  { id: "speech", name: "Erika", role: "S.P.", position: [-2.55, 1.25] },
];

function ResponsiveCamera() {
  const cameraRef = useRef<ThreeOrthographicCamera | null>(null);
  const { size } = useThree();
  const zoom =
    size.width < 640
      ? Math.max(46, Math.min(52, size.width / 7.5))
      : Math.min(72, size.width / 14);

  useEffect(() => {
    cameraRef.current?.lookAt(0, 0, 0);
    cameraRef.current?.updateProjectionMatrix();
  }, [size.height, size.width, zoom]);

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      position={[0, 10, 0]}
      up={[0, 0, -1]}
      near={0.1}
      far={100}
      zoom={zoom}
    />
  );
}

function MaterialScene({
  pulseKey,
  reduceMotion,
}: {
  pulseKey: number | null;
  reduceMotion: boolean;
}) {
  const providers = useMemo(() => PROVIDERS, []);
  const { size } = useThree();
  const sceneScale = size.width < 640 ? 0.94 : 1;

  return (
    <>
      <ResponsiveCamera />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={["#ffffff", "#b7b9bb", 1.15]} />
      <directionalLight
        castShadow
        color="#ffffff"
        intensity={2.05}
        position={[-5.5, 9, 6]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={24}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.00035}
      />

      <group scale={sceneScale} position={[0, 0.1, 0]}>
        <SpatialBadge
          name="SuDo"
          radius={1.34}
          delay={0.05}
          reduceMotion={reduceMotion}
          appearance={DEFAULT_BADGE_APPEARANCE}
          client
        />

        {providers.map((provider, index) => (
          <SpatialBadge
            key={provider.id}
            name={provider.name}
            role={provider.role}
            radius={0.78}
            delay={0.16 + index * 0.065}
            position={provider.position}
            showAdd={provider.current}
            pulseKey={provider.current ? pulseKey : undefined}
            reduceMotion={reduceMotion}
            appearance={DEFAULT_BADGE_APPEARANCE}
          />
        ))}
      </group>

      <SpatialBadgeShadows appearance={DEFAULT_BADGE_APPEARANCE} />
    </>
  );
}

export default function OrbitMaterialPrototype() {
  const [pulseKey, setPulseKey] = useState<number | null>(null);
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <main className={styles.lab}>
      <header className={styles.header}>
        <div>
          <p className={styles.brand}>AutConnect</p>
          <p className={styles.studyLabel}>Spatial material study</p>
        </div>
        <Link className={styles.labLink} href="/ui-lab/badge">
          Badge lab
          <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </header>

      <div
        className={styles.stage}
        data-testid="spatial-prototype"
        aria-label="AutConnect client orbit material prototype"
      >
        <Canvas
          className={styles.canvas}
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <MaterialScene pulseKey={pulseKey} reduceMotion={reduceMotion} />
        </Canvas>
      </div>

      <div className={styles.controls}>
        <div className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          Ready to add note
        </div>
        <motion.button
          type="button"
          className={styles.replayButton}
          onClick={() => setPulseKey((current) => (current ?? 0) + 1)}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 520, damping: 30 }}
          aria-label="Replay completion ripple"
          title="Replay completion ripple"
        >
          <RotateCcw size={18} strokeWidth={1.8} aria-hidden="true" />
        </motion.button>
      </div>
    </main>
  );
}
