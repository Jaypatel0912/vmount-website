import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { MotionValue } from "motion/react";

type V3 = [number, number, number];

const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder stretched between two points. */
function Tube({ a, b, r = 0.035, color, metal = 0.6, rough = 0.25 }: { a: V3; b: V3; r?: number; color: string; metal?: number; rough?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    return {
      pos: va.clone().add(vb).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
      len: dir.length(),
    };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, 20]} />
      <meshStandardMaterial color={color} metalness={metal} roughness={rough} />
    </mesh>
  );
}

const SPOKES = 18;

function Wheel({ position, spin }: { position: V3; spin: React.RefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = -spin.current!;
  });
  return (
    <group position={position}>
      <group ref={ref}>
        {/* tyre */}
        <mesh castShadow>
          <torusGeometry args={[0.68, 0.045, 20, 80]} />
          <meshStandardMaterial color="#111114" roughness={0.9} />
        </mesh>
        {/* rim */}
        <mesh>
          <torusGeometry args={[0.62, 0.022, 12, 80]} />
          <meshStandardMaterial color="#d4d4d8" metalness={1} roughness={0.2} />
        </mesh>
        {Array.from({ length: SPOKES }, (_, i) => {
          const t = (i / SPOKES) * Math.PI * 2;
          const z = i % 2 ? 0.04 : -0.04;
          return <Tube key={i} a={[0, 0, z]} b={[Math.cos(t) * 0.61, Math.sin(t) * 0.61, 0]} r={0.004} color="#a1a1aa" metal={1} />;
        })}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.12, 20]} />
          <meshStandardMaterial color="#27272a" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function Bike({ color, scroll }: { color: string; scroll?: MotionValue<number> }) {
  const root = useRef<THREE.Group>(null);
  const crank = useRef<THREE.Group>(null);
  const spin = useRef(0);

  useFrame((state, delta) => {
    spin.current += delta * 2.2;
    if (crank.current) crank.current.rotation.z = -spin.current * 0.5;
    if (!root.current) return;
    // Follow the pointer gently, and turn the bike as the page scrolls.
    const p = scroll ? scroll.get() : 0;
    const targetY = -0.5 + state.pointer.x * 0.35 + p * Math.PI * 1.2;
    const targetX = state.pointer.y * -0.08;
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, targetY, 4, delta);
    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, targetX, 4, delta);
  });

  const R: V3 = [-1.02, 0, 0];
  const F: V3 = [1.02, 0, 0];
  const BB: V3 = [-0.1, 0.02, 0];
  const S: V3 = [-0.36, 0.96, 0];
  const H: V3 = [0.7, 0.92, 0];
  const HB: V3 = [0.78, 0.64, 0];
  const dark = "#18181b";

  return (
    <group ref={root} position={[0, -0.25, 0]}>
      <Wheel position={R} spin={spin} />
      <Wheel position={F} spin={spin} />

      {/* main frame */}
      <Tube a={BB} b={S} r={0.045} color={color} />
      <Tube a={S} b={H} r={0.04} color={color} />
      <Tube a={BB} b={HB} r={0.055} color={color} />
      <Tube a={HB} b={H} r={0.055} color={color} />
      {/* stays */}
      {[0.08, -0.08].map((z) => (
        <group key={z}>
          <Tube a={[BB[0], BB[1], z]} b={[R[0], R[1], z]} r={0.025} color={color} />
          <Tube a={[-0.33, 0.86, z * 0.5]} b={[R[0], R[1], z]} r={0.022} color={color} />
          <Tube a={[HB[0], HB[1], z * 0.6]} b={[F[0], F[1], z]} r={0.026} color={dark} metal={0.9} />
        </group>
      ))}

      {/* cockpit */}
      <Tube a={H} b={[0.66, 1.08, 0]} r={0.03} color={dark} />
      <Tube a={[0.66, 1.08, -0.24]} b={[0.66, 1.08, 0.24]} r={0.022} color={dark} />
      {[0.24, -0.24].map((z) => (
        <Tube key={z} a={[0.66, 1.08, z]} b={[0.82, 1.0, z]} r={0.024} color="#3f3f46" rough={0.8} metal={0} />
      ))}

      {/* seat */}
      <Tube a={S} b={[-0.42, 1.16, 0]} r={0.022} color="#d4d4d8" metal={1} />
      <mesh position={[-0.4, 1.19, 0]} scale={[0.32, 0.05, 0.11]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color={dark} roughness={0.7} />
      </mesh>

      {/* drivetrain */}
      <group position={[BB[0], BB[1], 0.11]}>
        <mesh>
          <torusGeometry args={[0.17, 0.018, 10, 48]} />
          <meshStandardMaterial color="#d4d4d8" metalness={1} roughness={0.25} />
        </mesh>
        <group ref={crank}>
          <Tube a={[0, 0, 0.02]} b={[0, -0.3, 0.06]} r={0.02} color="#27272a" metal={0.9} />
          <mesh position={[0, -0.3, 0.12]}>
            <boxGeometry args={[0.12, 0.025, 0.08]} />
            <meshStandardMaterial color={dark} />
          </mesh>
        </group>
      </group>
      <Tube a={[BB[0], 0.19, 0.11]} b={[R[0], 0.08, 0.11]} r={0.008} color="#71717a" metal={1} />
      <Tube a={[BB[0], -0.15, 0.11]} b={[R[0], -0.08, 0.11]} r={0.008} color="#71717a" metal={1} />
    </group>
  );
}

export default function Bike3D({ color, scroll }: { color: string; scroll?: MotionValue<number> }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.6, 5.3], fov: 38 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.35} />
      <spotLight position={[4, 6, 4]} angle={0.4} penumbra={1} intensity={60} castShadow />
      <pointLight position={[-4, 2, -2]} intensity={20} color={color} />
      <Float speed={1.6} rotationIntensity={0.15} floatIntensity={0.5}>
        <Bike color={color} scroll={scroll} />
      </Float>
      <ContactShadows position={[0, -1.05, 0]} opacity={0.55} scale={7} blur={2.6} far={2} />
      {/* Lightformers instead of an HDR file, so nothing is downloaded at runtime */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 4, -4]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={2} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="ring" intensity={4} color={color} position={[5, 2, 2]} scale={2} />
      </Environment>
    </Canvas>
  );
}
