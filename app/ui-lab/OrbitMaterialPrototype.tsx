"use client";

import { ContactShadows, Html, OrthographicCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera as ThreeOrthographicCamera,
} from "three";
import styles from "./OrbitMaterialPrototype.module.css";

type OrbitNode = {
  id: string;
  name: string;
  role: string;
  position: readonly [number, number];
  completed?: boolean;
  current?: boolean;
};

const PROVIDERS: OrbitNode[] = [
  {
    id: "current",
    name: "Kristine",
    role: "O.T.",
    position: [-2.55, -1.65],
    completed: true,
    current: true,
  },
  { id: "caretaker", name: "Mona", role: "Caretaker", position: [0, -2.52] },
  { id: "supervisor", name: "Erin", role: "BCBA", position: [2.55, -1.6] },
  { id: "behavior", name: "Michael", role: "Bx Tech", position: [2.75, 1.05] },
  { id: "educator", name: "Casey", role: "Educator", position: [0.45, 2.55] },
  { id: "speech", name: "Erika", role: "S.P.", position: [-2.55, 1.25] },
];

const GRAPHITE = "#29323c";
const PROVIDER_SURFACE = "#f0f0ee";
const CLIENT_SURFACE = "#e8e9e7";

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

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
      position={[0, 9.2, 9.2]}
      near={0.1}
      far={100}
      zoom={zoom}
    />
  );
}

function Ripple({ reduceMotion }: { reduceMotion: boolean }) {
  const groupRef = useRef<Group | null>(null);
  const materialRefs = useRef<Array<MeshBasicMaterial | null>>([]);
  const startedAt = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || reduceMotion) {
      return;
    }

    startedAt.current ??= clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAt.current;

    groupRef.current.children.forEach((child, index) => {
      const delayed = (elapsed - index * 0.1) / 0.72;
      const progress = Math.min(1, Math.max(0, delayed));
      const scale = 1 + easeOutCubic(progress) * 0.62;
      child.scale.setScalar(scale);
      child.visible = delayed >= 0 && delayed < 1;

      const material = materialRefs.current[index];
      if (material) {
        material.opacity = Math.pow(1 - progress, 1.8) * 0.36;
      }
    });
  });

  if (reduceMotion) {
    return null;
  }

  return (
    <group ref={groupRef} position={[0, 0.34, 0]}>
      {[0, 1, 2].map((ring) => (
        <mesh key={ring} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.94, 0.022, 12, 96]} />
          <meshBasicMaterial
            ref={(material) => {
              materialRefs.current[ring] = material;
            }}
            color={GRAPHITE}
            transparent
            depthWrite={false}
            opacity={0}
          />
        </mesh>
      ))}
    </group>
  );
}

type MatteDiscProps = {
  name: string;
  role?: string;
  radius: number;
  depth: number;
  color: string;
  delay: number;
  position: readonly [number, number];
  completed?: boolean;
  pulseKey?: number;
  reduceMotion: boolean;
  client?: boolean;
  onActivate?: () => void;
};

function MatteDisc({
  name,
  role,
  radius,
  depth,
  color,
  delay,
  position,
  completed = false,
  pulseKey,
  reduceMotion,
  client = false,
  onActivate,
}: MatteDiscProps) {
  const groupRef = useRef<Group | null>(null);
  const discRef = useRef<Mesh | null>(null);
  const entered = useRef(reduceMotion ? 1 : 0.02);
  const velocity = useRef(0);
  const [pressed, setPressed] = useState(false);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) {
      return;
    }

    const canEnter = reduceMotion || clock.elapsedTime >= delay;
    const target = canEnter ? (pressed ? 0.96 : 1) : 0.02;
    const stiffness = pressed ? 42 : 28;
    const damping = pressed ? 14 : 11;

    velocity.current += (target - entered.current) * stiffness * delta;
    velocity.current *= Math.exp(-damping * delta);
    entered.current += velocity.current;

    groupRef.current.scale.setScalar(entered.current);
    groupRef.current.position.y = (1 - entered.current) * 0.65;

    if (discRef.current) {
      discRef.current.rotation.y += delta * 0.025;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[position[0], 0, position[1]]}
      onPointerDown={(event) => {
        event.stopPropagation();
        setPressed(true);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        setPressed(false);
        onActivate?.();
      }}
      onPointerLeave={() => setPressed(false)}
    >
      <mesh ref={discRef} castShadow receiveShadow position={[0, depth / 2, 0]}>
        <cylinderGeometry args={[radius, radius, depth, 96]} />
        <meshPhysicalMaterial
          color={color}
          roughness={0.76}
          metalness={0}
          clearcoat={0.08}
          clearcoatRoughness={0.78}
        />
      </mesh>

      <mesh position={[0, depth + 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[radius * 0.89, radius * 0.035, 16, 96]} />
        <meshStandardMaterial color="#fafaf8" roughness={0.82} metalness={0} />
      </mesh>

      {completed ? (
        <mesh position={[0, depth + 0.085, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[radius * 1.08, radius * 0.045, 18, 128]} />
          <meshPhysicalMaterial
            color={GRAPHITE}
            roughness={0.52}
            metalness={0.08}
            clearcoat={0.12}
            clearcoatRoughness={0.68}
          />
        </mesh>
      ) : null}

      {completed && pulseKey !== undefined ? (
        <group key={pulseKey} position={[0, depth - 0.25, 0]} scale={radius / 0.8}>
          <Ripple reduceMotion={reduceMotion} />
        </group>
      ) : null}

      <Html center position={[0, depth + 0.12, 0]} zIndexRange={[2, 0]}>
        <div
          className={`${styles.objectLabel} ${client ? styles.objectLabelStrong : ""}`}
          aria-hidden="true"
        >
          <span className={client ? styles.clientName : styles.name}>{name}</span>
          {role ? <span className={styles.role}>{role}</span> : null}
        </div>
      </Html>
    </group>
  );
}

function MaterialScene({ pulseKey, reduceMotion }: { pulseKey: number; reduceMotion: boolean }) {
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
        <MatteDisc
          name="SuDo"
          radius={1.34}
          depth={0.34}
          color={CLIENT_SURFACE}
          delay={0.05}
          position={[0, 0]}
          reduceMotion={reduceMotion}
          client
        />

        {providers.map((provider, index) => (
          <MatteDisc
            key={provider.id}
            name={provider.name}
            role={provider.role}
            radius={0.78}
            depth={0.25}
            color={PROVIDER_SURFACE}
            delay={0.16 + index * 0.065}
            position={provider.position}
            completed={provider.completed}
            pulseKey={provider.current ? pulseKey : undefined}
            reduceMotion={reduceMotion}
          />
        ))}
      </group>

      <ContactShadows
        position={[0, -0.03, 0]}
        opacity={0.34}
        scale={13}
        blur={2.25}
        far={4.5}
        resolution={512}
        color="#11151a"
        frames={1}
      />
    </>
  );
}

export default function OrbitMaterialPrototype() {
  const [pulseKey, setPulseKey] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <main className={styles.lab}>
      <header className={styles.header}>
        <p className={styles.brand}>AutConnect</p>
        <p className={styles.studyLabel}>Spatial material study</p>
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
          Completed note
        </div>
        <motion.button
          type="button"
          className={styles.replayButton}
          onClick={() => setPulseKey((current) => current + 1)}
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
