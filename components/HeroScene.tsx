"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

// WebGL hero: two interlocking gears, a hex nut and a needle-and-thread knot floating in
// a teal/marigold glow, a "workshop" metaphor for repair. Follows the pointer gently.

function gearShape(teeth: number, outer: number, inner: number, hole: number) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [inner, a],
      [outer, a + step * 0.15],
      [outer, a + step * 0.45],
      [inner, a + step * 0.6],
    ];
    pts.forEach(([r, ang], j) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && j === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  shape.holes.push(h);
  return shape;
}

function Gear({ teeth, radius, color, speed, position, emissive }: { teeth: number; radius: number; color: string; speed: number; position: [number, number, number]; emissive: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(gearShape(teeth, radius, radius * 0.82, radius * 0.32), { depth: radius * 0.28, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    g.center();
    return g;
  }, [teeth, radius]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * speed;
  });
  return (
    <mesh ref={ref} geometry={geometry} position={position}>
      <meshStandardMaterial color={color} metalness={0.55} roughness={0.28} emissive={emissive} emissiveIntensity={0.25} />
    </mesh>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, state.pointer.x * 0.35, 0.05);
    ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -state.pointer.y * 0.25 + 0.15, 0.05);
  });
  return <group ref={ref}>{children}</group>;
}

export default function HeroScene() {
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0, 7.5], fov: 42 }} frameloop={reduced ? "demand" : "always"} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      <pointLight position={[-4, -2, 3]} intensity={30} color="#2dd4bf" />
      <pointLight position={[4, 2, 2]} intensity={22} color="#fbbf24" />
      <Rig>
        <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
          <Gear teeth={14} radius={1.55} color="#14b8a6" emissive="#0f766e" speed={0.25} position={[-0.6, 0.2, 0]} />
        </Float>
        <Float speed={1.8} rotationIntensity={0.3} floatIntensity={0.7}>
          <Gear teeth={9} radius={0.95} color="#f59e0b" emissive="#b45309" speed={-0.39} position={[1.75, -1.1, 0.4]} />
        </Float>
        <Float speed={2.2} rotationIntensity={1.2} floatIntensity={1.2}>
          <mesh position={[1.9, 1.5, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 6]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />
          </mesh>
        </Float>
        <Float speed={1.6} rotationIntensity={1} floatIntensity={0.9}>
          <mesh position={[-2.6, -1.4, 0.3]}>
            <torusKnotGeometry args={[0.42, 0.06, 160, 12, 2, 3]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.3} roughness={0.35} emissive="#fbbf24" emissiveIntensity={0.35} />
          </mesh>
        </Float>
      </Rig>
      <Sparkles count={70} scale={[9, 5, 3]} size={2.2} speed={0.35} color="#5eead4" opacity={0.7} />
    </Canvas>
  );
}
