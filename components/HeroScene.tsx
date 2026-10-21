"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

// WebGL hero in Sudhaar's warm palette: two interlocking clay-coloured gears, a brass nut and a
// marigold thread knot floating over the cream page. Light on purpose (low dpr, few meshes)
// so it stays smooth on everyday phones; follows the pointer gently.

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

function Gear({ teeth, radius, color, speed, position }: { teeth: number; radius: number; color: string; speed: number; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(gearShape(teeth, radius, radius * 0.82, radius * 0.32), { depth: radius * 0.3, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 });
    g.center();
    return g;
  }, [teeth, radius]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * speed;
  });
  return (
    <mesh ref={ref} geometry={geometry} position={position}>
      <meshStandardMaterial color={color} metalness={0.15} roughness={0.55} />
    </mesh>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, state.pointer.x * 0.35, 0.05);
    ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -state.pointer.y * 0.25 + 0.12, 0.05);
  });
  return <group ref={ref}>{children}</group>;
}

export default function HeroScene() {
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 7.5], fov: 42 }} frameloop={reduced ? "demand" : "always"} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1.1} color="#fff4e6" />
      <directionalLight position={[4, 6, 6]} intensity={2.2} color="#fff1dc" />
      <directionalLight position={[-5, -2, 4]} intensity={0.7} color="#ffd0b0" />
      <Rig>
        <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
          <Gear teeth={14} radius={1.5} color="#d9572b" speed={0.25} position={[-0.6, 0.2, 0]} />
        </Float>
        <Float speed={1.8} rotationIntensity={0.3} floatIntensity={0.7}>
          <Gear teeth={9} radius={0.92} color="#1f8a7a" speed={-0.4} position={[1.7, -1.05, 0.4]} />
        </Float>
        <Float speed={2.2} rotationIntensity={1.2} floatIntensity={1.2}>
          <mesh position={[1.9, 1.5, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 6]} />
            <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.35} />
          </mesh>
        </Float>
        <Float speed={1.6} rotationIntensity={1} floatIntensity={0.9}>
          <mesh position={[-2.5, -1.4, 0.3]}>
            <torusKnotGeometry args={[0.42, 0.07, 160, 12, 2, 3]} />
            <meshStandardMaterial color="#f4a62a" roughness={0.45} />
          </mesh>
        </Float>
      </Rig>
      <Sparkles count={40} scale={[9, 5, 3]} size={3} speed={0.3} color="#f4a62a" opacity={0.8} />
    </Canvas>
  );
}
