"use client";

import { ContactShadows, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExtrudeGeometry, MathUtils, Shape } from "three";
import type { Group, MeshBasicMaterial } from "three";
import type { BadgeAppearance } from "./badgeAppearance";
import { DEFAULT_BADGE_APPEARANCE } from "./badgeAppearance";
import styles from "./SpatialBadge.module.css";

const GRAPHITE = "#29323c";

function CompletionRipple({
  reduceMotion,
  radius,
}: {
  reduceMotion: boolean;
  radius: number;
}) {
  const groupRef = useRef<Group | null>(null);
  const materialRefs = useRef<Array<MeshBasicMaterial | null>>([]);
  const startedAt = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || reduceMotion) return;

    startedAt.current ??= clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAt.current;

    groupRef.current.children.forEach((child, index) => {
      const delayed = (elapsed - index * 0.09) / 0.9;
      const progress = Math.min(1, Math.max(0, delayed));
      const pulse = Math.sin(progress * Math.PI);
      child.scale.setScalar(1 + pulse * 0.72);
      child.visible = delayed >= 0 && delayed < 1;

      const material = materialRefs.current[index];
      if (material) material.opacity = pulse * 0.2;
    });
  });

  if (reduceMotion) return null;

  return (
    <group ref={groupRef} position={[0, 0.058, 0]}>
      {[0, 1, 2].map((ring) => (
        <mesh key={ring} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 1.16, radius * 0.045, 12, 96]} />
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

function CompletionSignal({ radius }: { radius: number }) {
  const coreRadius = radius * 0.28;

  return (
    <group position={[0, 0.055, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[coreRadius, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          color="#4b5661"
          roughness={0.72}
          metalness={0}
          clearcoat={0.08}
          clearcoatRoughness={0.82}
        />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[coreRadius * 1.35, coreRadius * 0.1, 12, 72]} />
        <meshStandardMaterial color="#737c85" roughness={0.86} metalness={0} />
      </mesh>
    </group>
  );
}

export type SpatialBadgeProps = {
  name: string;
  role?: string;
  radius: number;
  position?: readonly [number, number];
  delay?: number;
  showAdd?: boolean;
  pulseKey?: number | null;
  reduceMotion: boolean;
  client?: boolean;
  appearance?: BadgeAppearance;
  onActivate?: () => void;
};

/**
 * Reusable Three.js badge used by both the single-object lab and the orbit lab.
 * It owns only visual geometry and pointer feedback, never application data.
 */
export function SpatialBadge({
  name,
  role,
  radius,
  position = [0, 0],
  delay = 0,
  showAdd = false,
  pulseKey,
  reduceMotion,
  client = false,
  appearance = DEFAULT_BADGE_APPEARANCE,
  onActivate,
}: SpatialBadgeProps) {
  const groupRef = useRef<Group | null>(null);
  const entered = useRef(reduceMotion ? 1 : 0.94);
  const [pressed, setPressed] = useState(false);
  const depth = client ? appearance.depth * 1.34 : appearance.depth;

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
    if (!groupRef.current) return;

    const canEnter = reduceMotion || clock.elapsedTime >= delay;
    const target = canEnter ? (pressed ? 0.975 : 1) : 0.94;
    entered.current = MathUtils.damp(entered.current, target, pressed ? 18 : 10, delta);
    groupRef.current.scale.setScalar(entered.current);
  });

  const plusRadius = radius * appearance.plusRadiusRatio;
  const plusCenterDistance = radius + plusRadius - plusRadius * 2 * appearance.plusOverlap;
  const plusOffset = plusCenterDistance / Math.sqrt(2);
  const plusElevation = depth + appearance.torusLift + Math.max(0.075, plusRadius * 0.22);
  const signalActive = pulseKey !== null && pulseKey !== undefined;

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
      <mesh castShadow receiveShadow geometry={discGeometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshPhysicalMaterial
          color={appearance.badgeColor}
          roughness={0.86}
          metalness={0}
          clearcoat={0.025}
          clearcoatRoughness={0.92}
        />
      </mesh>

      {showAdd ? (
        <>
          <mesh position={[0, depth + 0.026, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius * 1.075, radius * 0.046, 16, 128]} />
            <meshBasicMaterial color="#a7adb3" transparent opacity={0.18} depthWrite={false} />
          </mesh>
          <mesh
            position={[0, depth + appearance.torusLift, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <torusGeometry args={[radius * 1.075, radius * 0.038, 16, 128]} />
            <meshPhysicalMaterial
              color={appearance.torusColor}
              roughness={0.9}
              metalness={0}
              clearcoat={0.02}
              clearcoatRoughness={0.94}
            />
          </mesh>
        </>
      ) : null}

      {showAdd ? (
        <group position={[plusOffset, plusElevation, -plusOffset]}>
          <mesh castShadow>
            <cylinderGeometry args={[plusRadius, plusRadius, 0.05, 48]} />
            <meshPhysicalMaterial color={appearance.badgeColor} roughness={0.86} metalness={0} />
          </mesh>
          <mesh position={[0, 0.034, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[plusRadius, radius * 0.027, 12, 64]} />
            <meshStandardMaterial color={appearance.torusColor} roughness={0.92} />
          </mesh>
          {signalActive ? <CompletionSignal radius={plusRadius} /> : null}
          {!signalActive ? (
            <Html center position={[0, 0.052, 0]} zIndexRange={[3, 0]}>
              <span className={styles.addIcon} aria-hidden="true">
                +
              </span>
            </Html>
          ) : null}
          {signalActive ? (
            <group key={pulseKey}>
              <CompletionRipple reduceMotion={reduceMotion} radius={plusRadius} />
            </group>
          ) : null}
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

export function SpatialBadgeShadows({ appearance }: { appearance: BadgeAppearance }) {
  return (
    <>
      <ContactShadows
        position={[0, -0.028, 0]}
        opacity={appearance.contactShadowOpacity}
        scale={10}
        blur={0.4}
        far={0.62}
        resolution={1024}
        color="#11151a"
        frames={1}
      />
      <ContactShadows
        position={[0, -0.036, 0]}
        opacity={appearance.diffuseShadowOpacity}
        scale={11.5}
        blur={1.35}
        far={1.6}
        resolution={512}
        color="#30353b"
        frames={1}
      />
    </>
  );
}
