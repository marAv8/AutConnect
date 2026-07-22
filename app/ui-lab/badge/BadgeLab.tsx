"use client";

import { OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { ArrowLeft, RotateCcw, Waves } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { OrthographicCamera as ThreeOrthographicCamera } from "three";
import type { BadgeAppearance } from "../badgeAppearance";
import { DEFAULT_BADGE_APPEARANCE } from "../badgeAppearance";
import { SpatialBadge, SpatialBadgeShadows } from "../SpatialBadge";
import styles from "./BadgeLab.module.css";

type NumericControl = {
  key: keyof Pick<
    BadgeAppearance,
    | "depth"
    | "torusLift"
    | "torusTubeRatio"
    | "plusRadiusRatio"
    | "plusRimTubeRatio"
    | "plusOverlap"
    | "contactShadowOpacity"
    | "diffuseShadowOpacity"
  >;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
};

const NUMERIC_CONTROLS: NumericControl[] = [
  { key: "depth", label: "Badge depth", min: 0.06, max: 0.22, step: 0.005, format: decimals },
  { key: "torusLift", label: "Torus lift", min: 0.025, max: 0.14, step: 0.005, format: decimals },
  {
    key: "torusTubeRatio",
    label: "Torus thickness",
    min: 0.014,
    max: 0.045,
    step: 0.001,
    format: decimals,
  },
  { key: "plusRadiusRatio", label: "Plus size", min: 0.2, max: 0.42, step: 0.01, format: percent },
  {
    key: "plusRimTubeRatio",
    label: "Plus rim",
    min: 0.012,
    max: 0.04,
    step: 0.001,
    format: decimals,
  },
  { key: "plusOverlap", label: "Plus overlap", min: 0.05, max: 0.5, step: 0.01, format: percent },
  {
    key: "contactShadowOpacity",
    label: "Contact shadow",
    min: 0.15,
    max: 0.8,
    step: 0.01,
    format: percent,
  },
  {
    key: "diffuseShadowOpacity",
    label: "Diffuse shadow",
    min: 0,
    max: 0.3,
    step: 0.01,
    format: percent,
  },
];

function decimals(value: number) {
  return value.toFixed(3);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ResponsiveBadgeCamera() {
  const cameraRef = useRef<ThreeOrthographicCamera | null>(null);
  const { size } = useThree();
  const zoom = size.width < 720 ? Math.max(88, size.width / 4.25) : 118;

  useEffect(() => {
    cameraRef.current?.lookAt(0, 0, 0);
    cameraRef.current?.updateProjectionMatrix();
  }, [size.height, size.width, zoom]);

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      position={[0, 8, 0]}
      up={[0, 0, -1]}
      near={0.1}
      far={50}
      zoom={zoom}
    />
  );
}

function BadgeScene({
  appearance,
  pulseKey,
  reduceMotion,
}: {
  appearance: BadgeAppearance;
  pulseKey: number | null;
  reduceMotion: boolean;
}) {
  const shadowKey = `${appearance.contactShadowOpacity}-${appearance.diffuseShadowOpacity}`;

  return (
    <>
      <ResponsiveBadgeCamera />
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
        shadow-camera-far={18}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.00035}
      />
      <SpatialBadge
        name="Kristine"
        role="O.T."
        radius={1.15}
        showAdd
        pulseKey={pulseKey}
        reduceMotion={reduceMotion}
        appearance={appearance}
      />
      <SpatialBadgeShadows key={shadowKey} appearance={appearance} />
    </>
  );
}

/**
 * Browser-based material workbench for the orbit badge. It deliberately uses
 * the same SpatialBadge component as the full orbit, so approved settings can
 * move into the dashboard without recreating the object.
 */
export default function BadgeLab() {
  const [appearance, setAppearance] = useState<BadgeAppearance>(DEFAULT_BADGE_APPEARANCE);
  const [pulseKey, setPulseKey] = useState<number | null>(null);
  const reduceMotion = useReducedMotion() ?? false;

  function updateNumeric(key: NumericControl["key"], value: number) {
    setAppearance((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className={styles.lab}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/ui-lab">
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          Orbit study
        </Link>
        <div>
          <h1 className={styles.title}>Badge material lab</h1>
          <p className={styles.subtitle}>Kristine · O.T.</p>
        </div>
      </header>

      <div className={styles.stage} aria-label="Interactive Three.js provider badge study">
        <Canvas
          className={styles.canvas}
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <BadgeScene
            appearance={appearance}
            pulseKey={pulseKey}
            reduceMotion={reduceMotion}
          />
        </Canvas>
      </div>

      <aside className={styles.controls} aria-label="Badge appearance controls">
        <div className={styles.colorRow}>
          <label className={styles.colorControl}>
            <span>Badge</span>
            <input
              type="color"
              value={appearance.badgeColor}
              onChange={(event) =>
                setAppearance((current) => ({ ...current, badgeColor: event.target.value }))
              }
            />
          </label>
          <label className={styles.colorControl}>
            <span>Torus</span>
            <input
              type="color"
              value={appearance.torusColor}
              onChange={(event) =>
                setAppearance((current) => ({ ...current, torusColor: event.target.value }))
              }
            />
          </label>
        </div>

        <div className={styles.sliderList}>
          {NUMERIC_CONTROLS.map((control) => (
            <label className={styles.sliderControl} key={control.key}>
              <span className={styles.sliderLabel}>
                <span>{control.label}</span>
                <output>{control.format(appearance[control.key])}</output>
              </span>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={appearance[control.key]}
                onChange={(event) => updateNumeric(control.key, Number(event.target.value))}
              />
            </label>
          ))}
        </div>

        <div className={styles.controlActions}>
          <motion.button
            type="button"
            className={styles.iconButton}
            onClick={() => setPulseKey((current) => (current ?? 0) + 1)}
            whileTap={{ scale: 0.9 }}
            aria-label="Replay completion ripple"
            title="Replay completion ripple"
          >
            <Waves size={18} strokeWidth={1.8} aria-hidden="true" />
          </motion.button>
          <motion.button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              setAppearance(DEFAULT_BADGE_APPEARANCE);
              setPulseKey(null);
            }}
            whileTap={{ scale: 0.9 }}
            aria-label="Reset badge appearance"
            title="Reset badge appearance"
          >
            <RotateCcw size={18} strokeWidth={1.8} aria-hidden="true" />
          </motion.button>
        </div>
      </aside>
    </main>
  );
}
