"use client";

import { ContactShadows, Html, OrthographicCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExtrudeGeometry, MathUtils, Shape } from "three";
import type {
  Group,
  MeshBasicMaterial,
  OrthographicCamera as ThreeOrthographicCamera,
} from "three";
import styles from "./OrbitMaterialPrototype.module.css";

type OrbitNode = {
  id: string;
  name: string;
  role: string;
  position: readonly [number, number];
  current?: boolean;
};

const PROVIDERS: OrbitNode[] = [
  {
    id: "current",
    name: "Kristine",
    role: "O.T.",
    position: [-2.55, -1.65],
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
      position={[0, 10, 0]}
      up={[0, 0, -1]}
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
    <group ref={groupRef} position={[0, 0.03, 0]}>
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
  showAdd?: boolean;
  pulseKey?: number | null;
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
  showAdd = false,
  pulseKey,
  reduceMotion,
  client = false,
  onActivate,
}: MatteDiscProps) {
  const groupRef = useRef<Group | null>(null);
  const entered = useRef(reduceMotion ? 1 : 0.94);
  const [pressed, setPressed] = useState(false);

  // Extrusion supplies a true rounded edge while keeping the badge face circular.
  const discGeometry = useMemo(() => {
    const shape = new Shape();
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false);

    return new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: Math.min(0.055, radius * 0.07),
      bevelThickness: Math.min(0.035, depth * 0.28),
      curveSegments: 96,
    });
  }, [depth, radius]);

  useEffect(() => () => discGeometry.dispose(), [discGeometry]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) {
      return;
    }

    const canEnter = reduceMotion || clock.elapsedTime >= delay;
    const target = canEnter ? (pressed ? 0.975 : 1) : 0.94;

    // A damped settle keeps the launch calm and prevents spring overshoot.
    entered.current = MathUtils.damp(entered.current, target, pressed ? 18 : 10, delta);

    groupRef.current.scale.setScalar(entered.current);
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
      <mesh
        castShadow
        receiveShadow
        geometry={discGeometry}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshPhysicalMaterial
          color={color}
          roughness={0.82}
          metalness={0}
          clearcoat={0.035}
          clearcoatRoughness={0.88}
        />
      </mesh>

      <mesh position={[0, depth + 0.016, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[radius * 0.88, radius * 0.022, 12, 96]} />
        <meshStandardMaterial color="#f7f7f4" roughness={0.9} metalness={0} />
      </mesh>

      {showAdd ? (
        <>
          <mesh position={[0, depth + 0.026, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius * 1.075, radius * 0.046, 16, 128]} />
            <meshBasicMaterial color="#9d9f9c" transparent opacity={0.2} depthWrite={false} />
          </mesh>
          <mesh position={[0, depth + 0.062, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[radius * 1.075, radius * 0.038, 16, 128]} />
            <meshPhysicalMaterial
              color="#ffffff"
              roughness={0.9}
              metalness={0}
              clearcoat={0.025}
              clearcoatRoughness={0.92}
            />
          </mesh>
        </>
      ) : null}

      {showAdd ? (
        <group position={[radius * 0.5, depth + 0.025, -radius * 0.67]}>
          <mesh castShadow>
            <cylinderGeometry args={[radius * 0.3, radius * 0.3, 0.05, 48]} />
            <meshPhysicalMaterial color={PROVIDER_SURFACE} roughness={0.84} metalness={0} />
          </mesh>
          <mesh position={[0, 0.034, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius * 0.3, radius * 0.027, 12, 64]} />
            <meshStandardMaterial color="#fafaf8" roughness={0.92} />
          </mesh>
          <Html center position={[0, 0.052, 0]} zIndexRange={[3, 0]}>
            <span className={styles.addIcon} aria-hidden="true">
              +
            </span>
          </Html>
        </group>
      ) : null}

      {pulseKey !== null && pulseKey !== undefined ? (
        <group key={pulseKey} position={[0, depth + 0.06, 0]} scale={radius / 0.8}>
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
        <MatteDisc
          name="SuDo"
          radius={1.34}
          depth={0.16}
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
            depth={0.12}
            color={PROVIDER_SURFACE}
            delay={0.16 + index * 0.065}
            position={provider.position}
            showAdd={provider.current}
            pulseKey={provider.current ? pulseKey : undefined}
            reduceMotion={reduceMotion}
          />
        ))}
      </group>

      <ContactShadows
        position={[0, -0.03, 0]}
        opacity={0.62}
        scale={10}
        blur={0.42}
        far={0.62}
        resolution={1024}
        color="#11151a"
        frames={1}
      />
    </>
  );
}

export default function OrbitMaterialPrototype() {
  const [pulseKey, setPulseKey] = useState<number | null>(null);
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
