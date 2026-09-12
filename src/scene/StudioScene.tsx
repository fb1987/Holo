import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  Environment,
  Html,
  Lightformer,
  Line,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { ScenePart, SceneSpec, Station } from "../../shared/types";
import { Plasma } from "./Plasma";
import { CircuitBoard } from "./CircuitBoard";
import { RoundedBox } from "./SoftBox";

export interface StudioSceneProps {
  station: Station;
  scene: SceneSpec;
  exploded: boolean;
  flat: boolean;
  selectedPart: string | null;
  onSelectPart: (id: string | null) => void;
  resetKey: number;
  zoomKey?: number;
  reducedMotion: boolean;
  busy: boolean;
  artifactUrl?: string;
  artifactScopeKey?: string;
}

const PALETTE: Record<Station, string> = {
  planning: "#e7b78b",
  design: "#9dddd8",
  electronics: "#d6dc99",
  software: "#b8b4ed",
};
const TARGET = new THREE.Vector3(0, 0, 0);
const ANGLES: Record<Station, number> = {
  planning: 0.12,
  design: 0.47,
  electronics: 0.79,
  software: -0.55,
};

function CameraRig({
  station,
  flat,
  exploded,
  resetKey,
  reducedMotion,
  zoomKey = 0,
}: Pick<
  StudioSceneProps,
  "station" | "flat" | "exploded" | "resetKey" | "reducedMotion" | "zoomKey"
>) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const transition = useRef({
    active: true,
    progress: 0,
    from: new THREE.Spherical(),
    to: new THREE.Spherical(),
    fromTarget: TARGET.clone(),
  });

  useEffect(() => {
    const currentTarget = controls.current?.target ?? TARGET;
    const next = transition.current;
    next.from.setFromVector3(camera.position.clone().sub(currentTarget));
    next.fromTarget.copy(currentTarget);
    next.to.set(
      flat ? 10.2 : exploded ? 10.6 : 8.8,
      flat && station === "electronics" ? 0.075 : exploded ? 1.23 : 1.25,
      flat
        ? 0
        : exploded
          ? station === "software"
            ? -1.02
            : 1.02
          : ANGLES[station],
    );
    while (next.to.theta - next.from.theta > Math.PI)
      next.to.theta -= Math.PI * 2;
    while (next.to.theta - next.from.theta < -Math.PI)
      next.to.theta += Math.PI * 2;
    next.progress = reducedMotion ? 1 : 0;
    next.active = true;
  }, [station, flat, exploded, resetKey, reducedMotion, camera]);

  const previousZoom = useRef(zoomKey);
  useEffect(() => {
    const difference = zoomKey - previousZoom.current;
    previousZoom.current = zoomKey;
    if (!difference || !controls.current) return;
    transition.current.active = false;
    const offset = camera.position.clone().sub(controls.current.target);
    offset.setLength(
      THREE.MathUtils.clamp(
        offset.length() * Math.pow(0.82, difference),
        2.3,
        15,
      ),
    );
    camera.position.copy(controls.current.target).add(offset);
    controls.current.update();
  }, [zoomKey, camera]);

  useFrame((_, delta) => {
    const next = transition.current;
    if (!next.active || !controls.current) return;
    next.progress = Math.min(1, next.progress + delta / 0.85);
    const t = next.progress * next.progress * (3 - 2 * next.progress);
    const spherical = new THREE.Spherical(
      THREE.MathUtils.lerp(next.from.radius, next.to.radius, t),
      THREE.MathUtils.lerp(next.from.phi, next.to.phi, t),
      THREE.MathUtils.lerp(next.from.theta, next.to.theta, t),
    );
    controls.current.target.lerpVectors(
      next.fromTarget,
      flat && station === "electronics"
        ? new THREE.Vector3(0, 0, 0.65)
        : exploded
          ? new THREE.Vector3(0, -0.2, 0)
          : TARGET,
      t,
    );
    camera.position.setFromSpherical(spherical).add(controls.current.target);
    controls.current.update();
    if (next.progress === 1) next.active = false;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={TARGET}
      minDistance={2.3}
      maxDistance={15}
      enableDamping={!reducedMotion}
      dampingFactor={0.085}
      rotateSpeed={0.65}
      zoomSpeed={0.85}
      panSpeed={0.65}
      minPolarAngle={0.04}
      maxPolarAngle={Math.PI * 0.88}
      onStart={() => {
        transition.current.active = false;
      }}
    />
  );
}

function Dust({ reducedMotion }: { reducedMotion: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const a = new Float32Array(330 * 3);
    let seed = 211;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 330; i++) {
      a[i * 3] = (random() - 0.5) * 27;
      a[i * 3 + 1] = (random() - 0.35) * 16;
      a[i * 3 + 2] = (random() - 0.5) * 25;
    }
    return a;
  }, []);
  useFrame((_, dt) => {
    if (points.current && !reducedMotion)
      points.current.rotation.y += dt * 0.005;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.013}
        transparent
        opacity={0.24}
        depthWrite={false}
        color="#8aa8be"
        sizeAttenuation
      />
    </points>
  );
}

function Stage({
  station,
  busy,
  reducedMotion,
  flat,
}: Pick<StudioSceneProps, "station" | "busy" | "reducedMotion" | "flat">) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const color = useMemo(() => new THREE.Color(PALETTE[station]), [station]);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#b2a4fa") },
      uTime: { value: 0 },
      uBusy: { value: 0 },
      uOpacity: { value: 1 },
    }),
    [],
  );
  useFrame((state, dt) => {
    if (!mat.current) return;
    mat.current.uniforms.uColor.value.lerp(color, Math.min(1, dt * 3));
    mat.current.uniforms.uTime.value = reducedMotion
      ? 0
      : state.clock.elapsedTime;
    mat.current.uniforms.uBusy.value = busy ? 1 : 0;
    mat.current.uniforms.uOpacity.value = THREE.MathUtils.damp(
      mat.current.uniforms.uOpacity.value,
      flat ? 0.16 : 1,
      5,
      dt,
    );
  });
  return (
    <group position={[0, -1.68, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 15]} />
        <shaderMaterial
          ref={mat}
          transparent
          depthWrite={false}
          uniforms={uniforms}
          vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
          fragmentShader={`varying vec2 vUv;uniform vec3 uColor;uniform float uTime;uniform float uBusy;uniform float uOpacity;
        void main(){vec2 p=(vUv-.5)*15.;float r=length(p);float a=atan(p.y,p.x);
        float glow=exp(-r*r*.26)*.055;
        float ring=exp(-pow((r-2.48)*100.,2.))*.21+exp(-pow((r-2.56)*120.,2.))*.055;
        float ticks=pow(max(0.,cos(a*100.)),50.)*smoothstep(2.40,2.43,r)*(1.-smoothstep(2.46,2.48,r))*.13;
        float sweep=exp(-pow((r-2.48)*30.,2.))*pow(max(0.,sin(a-uTime*.55)),14.)*(.13+uBusy*.2);
        float center=exp(-r*r*2.8)*.045;gl_FragColor=vec4(uColor,(glow+ring+ticks+sweep+center)*uOpacity);}`}
        />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <group key={angle} rotation={[0, angle, 0]}>
          <mesh position={[0, 0.004, 2.48]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry
              args={[
                i ===
                ["planning", "design", "electronics", "software"].indexOf(
                  station,
                )
                  ? 0.23
                  : 0.1,
                0.022,
              ]}
            />
            <meshBasicMaterial
              color={PALETTE[station]}
              transparent
              opacity={flat ? 0.09 : 0.65}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

interface PartProps {
  selected: string | null;
  onSelect: (id: string | null) => void;
  electronic: boolean;
  exploded: boolean;
  reducedMotion: boolean;
  color: string;
}
function usePartClick(id: string, onSelect: (id: string | null) => void) {
  return {
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (event.delta < 5) onSelect(id);
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
    },
  };
}

function ShellMaterial({
  color,
  ghost,
  selected,
}: {
  color: string;
  ghost: boolean;
  selected: boolean;
}) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.43}
      metalness={0.55}
      transparent
      opacity={ghost ? 0.09 : 1}
      depthWrite={!ghost}
      emissive={selected ? "#66dbed" : "#000000"}
      emissiveIntensity={selected ? 0.24 : 0}
    />
  );
}

function AnimatedPart({
  position,
  children,
  reducedMotion,
  ...props
}: {
  position: [number, number, number];
  children: ReactNode;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const target = useMemo(
    () => new THREE.Vector3(...position),
    [position[0], position[1], position[2]],
  );
  useFrame((_, dt) => {
    group.current?.position.lerp(
      target,
      reducedMotion ? 1 : 1 - Math.exp(-dt * 7),
    );
  });
  return (
    <group ref={group} {...props}>
      {children}
    </group>
  );
}

function Screw({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.041, 0.041, 0.024, 12]} />
        <meshStandardMaterial
          color="#8a949e"
          metalness={0.95}
          roughness={0.27}
        />
      </mesh>
      <mesh position={[0, 0.014, 0]}>
        <boxGeometry args={[0.04, 0.003, 0.007]} />
        <meshBasicMaterial color="#171b21" />
      </mesh>
    </group>
  );
}

function Wheel({ scene, ...props }: PartProps & { scene: SceneSpec }) {
  const shellEvents = usePartClick("enclosure", props.onSelect);
  const screenEvents = usePartClick("display", props.onSelect);
  const wheelCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          [-1.53, 0.77, 0],
          [-1.69, 0.36, 0],
          [-1.7, -0.3, 0],
          [-1.3, -0.82, 0],
          [-0.62, -0.92, 0],
          [0.62, -0.92, 0],
          [1.3, -0.82, 0],
          [1.7, -0.3, 0],
          [1.69, 0.36, 0],
          [1.53, 0.77, 0],
          [1.11, 0.73, 0],
          [0.55, 0.42, 0],
          [-0.55, 0.42, 0],
          [-1.11, 0.73, 0],
        ].map((p) => new THREE.Vector3(...(p as [number, number, number]))),
        true,
        "catmullrom",
        0.4,
      ),
    [],
  );
  const rimGeometry = useMemo(
    () => new THREE.TubeGeometry(wheelCurve, 120, 0.145, 16, true),
    [wheelCurve],
  );
  useEffect(() => () => rimGeometry.dispose(), [rimGeometry]);
  const scale: [number, number, number] = [
    THREE.MathUtils.clamp(scene.width / 300, 0.45, 1.5),
    THREE.MathUtils.clamp(scene.height / 180, 0.5, 1.7),
    THREE.MathUtils.clamp(scene.depth / 70, 0.5, 1.5),
  ];
  return (
    <group position={[0, 0.25, 0]} scale={scale}>
      <AnimatedPart
        position={[0, props.exploded ? 0.3 : 0, props.exploded ? 1.75 : 0.03]}
        reducedMotion={props.reducedMotion}
      >
        <group {...shellEvents}>
          <mesh geometry={rimGeometry}>
            <ShellMaterial
              color={props.color}
              ghost={props.electronic}
              selected={props.selected === "enclosure"}
            />
          </mesh>
          <RoundedBox
            args={[2.7, 0.9, 0.25]}
            radius={0.19}
            smoothness={5}
            position={[0, -0.07, 0]}
          >
            <ShellMaterial
              color={props.color}
              ghost={props.electronic}
              selected={props.selected === "enclosure"}
            />
          </RoundedBox>
          <RoundedBox
            args={[1.62, 0.52, 0.25]}
            radius={0.09}
            smoothness={4}
            position={[0, 0.38, -0.01]}
          >
            <ShellMaterial
              color={props.color}
              ghost={props.electronic}
              selected={props.selected === "enclosure"}
            />
          </RoundedBox>
          {[-1, 1].map((side) => (
            <group
              key={side}
              position={[side * 1.53, 0.02, 0]}
              rotation={[0, 0, side * 0.05]}
            >
              <RoundedBox
                args={[0.35, 0.94, 0.37]}
                radius={0.16}
                smoothness={5}
              >
                <meshStandardMaterial
                  color="#20252b"
                  roughness={0.87}
                  transparent={props.electronic}
                  opacity={props.electronic ? 0.12 : 1}
                  depthWrite={!props.electronic}
                />
              </RoundedBox>
              {Array.from({ length: 12 }, (_, n) => (
                <mesh
                  key={n}
                  position={[0.012 * side, -0.37 + n * 0.066, 0.183]}
                >
                  <boxGeometry args={[0.2, 0.009, 0.009]} />
                  <meshStandardMaterial
                    color="#343b43"
                    roughness={0.85}
                    transparent
                    opacity={props.electronic ? 0.08 : 0.7}
                  />
                </mesh>
              ))}
            </group>
          ))}
        </group>
        <group position={[0, 0.34, 0.144]} {...screenEvents}>
          <RoundedBox args={[1.35, 0.41, 0.065]} radius={0.055} smoothness={4}>
            <meshStandardMaterial
              color={props.selected === "display" ? "#32646c" : "#040a0d"}
              emissive={props.selected === "display" ? "#48a7b1" : "#000000"}
              emissiveIntensity={0.3}
              metalness={0.35}
              roughness={0.16}
            />
          </RoundedBox>
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[1.2, 0.28]} />
            <meshBasicMaterial color="#081f2a" />
          </mesh>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[-0.49 + i * 0.09, 0.07, 0.037]}>
              <planeGeometry args={[0.067, 0.03]} />
              <meshBasicMaterial
                color={i < 7 ? "#73eed6" : i < 10 ? "#daaf6c" : "#ba617c"}
                toneMapped={false}
              />
            </mesh>
          ))}
          <Line
            points={[
              [-0.49, -0.055, 0.038],
              [-0.27, -0.055, 0.038],
              [-0.2, -0.075, 0.038],
              [0.03, -0.075, 0.038],
              [0.08, -0.015, 0.038],
              [0.15, -0.075, 0.038],
              [0.48, -0.075, 0.038],
            ]}
            color="#62c8d9"
            lineWidth={1.1}
          />
        </group>
        {[-1, 1].map((side) => (
          <group key={side}>
            {[0, 1, 2].map((i) => (
              <group
                key={i}
                position={[
                  side * (0.87 + (i % 2) * 0.27),
                  0.09 - Math.floor(i / 2) * 0.3,
                  0.17,
                ]}
                {...usePartClick(`button-${side}-${i}`, props.onSelect)}
              >
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.107, 0.12, 0.1, 28]} />
                  <meshStandardMaterial
                    color="#131c21"
                    metalness={0.7}
                    roughness={0.3}
                  />
                </mesh>
                <mesh position={[0, 0, 0.055]}>
                  <circleGeometry args={[0.079, 28]} />
                  <meshStandardMaterial
                    color={
                      i === 0
                        ? side === -1
                          ? "#d26e56"
                          : "#51a8b2"
                        : "#52616c"
                    }
                    roughness={0.42}
                    emissive={
                      props.selected === `button-${side}-${i}`
                        ? "#44c9d8"
                        : "#000000"
                    }
                    emissiveIntensity={0.5}
                  />
                </mesh>
              </group>
            ))}
            <group
              position={[side * 0.45, -0.2, 0.2]}
              {...usePartClick(`encoder-${side}`, props.onSelect)}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 0.15, 32]} />
                <meshStandardMaterial
                  color={
                    props.selected === `encoder-${side}` ? "#80d6da" : "#7d8a92"
                  }
                  roughness={0.25}
                  metalness={0.9}
                />
              </mesh>
              <mesh position={[0, 0, 0.08]}>
                <circleGeometry args={[0.12, 32]} />
                <meshStandardMaterial color="#171d26" roughness={0.45} />
              </mesh>
              <mesh position={[0, 0.075, 0.083]}>
                <boxGeometry args={[0.018, 0.055, 0.004]} />
                <meshBasicMaterial color="#9de6e1" />
              </mesh>
            </group>
          </group>
        ))}
        {[-1.23, 1.23].flatMap((x) =>
          [-0.31, 0.29].map((y) => (
            <Screw key={`${x}-${y}`} position={[x, y, 0.137]} />
          )),
        )}
      </AnimatedPart>
      <AnimatedPart
        position={[0, -0.02, props.exploded ? -0.16 : -0.11]}
        reducedMotion={props.reducedMotion}
      >
        <group rotation={[Math.PI / 2, 0, 0]}>
          <CircuitBoard
            width={2.13}
            depth={0.69}
            selected={props.selected}
            onSelect={props.onSelect}
            visible={props.electronic || props.exploded}
          />
        </group>
      </AnimatedPart>
      <AnimatedPart
        position={[
          0,
          props.exploded ? -0.32 : -0.07,
          props.exploded ? -1.85 : -0.29,
        ]}
        reducedMotion={props.reducedMotion}
      >
        <group {...usePartClick("rear-housing", props.onSelect)}>
          <RoundedBox args={[2.31, 0.77, 0.25]} radius={0.13} smoothness={4}>
            <ShellMaterial
              color="#18202b"
              ghost={props.electronic}
              selected={props.selected === "rear-housing"}
            />
          </RoundedBox>
          <mesh position={[0, -0.05, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.28, 48]} />
            <meshStandardMaterial
              color="#434d58"
              metalness={0.85}
              roughness={0.3}
            />
          </mesh>
          {[-1, 1].map((side) => (
            <RoundedBox
              key={side}
              args={[0.25, 0.7, 0.06]}
              radius={0.05}
              smoothness={3}
              position={[side * 0.92, 0.17, -0.23]}
              rotation={[0, side * -0.2, side * -0.12]}
            >
              <meshStandardMaterial
                color="#4a555d"
                metalness={0.8}
                roughness={0.26}
              />
            </RoundedBox>
          ))}
        </group>
      </AnimatedPart>
      {props.exploded && (
        <Line
          points={[
            [0, -0.65, -1.85],
            [0, -0.65, 1.75],
          ]}
          color="#91bbb9"
          transparent
          opacity={0.28}
          lineWidth={0.75}
          dashed
          dashSize={0.07}
          gapSize={0.09}
        />
      )}
    </group>
  );
}

function Enclosure({ scene, ...props }: PartProps & { scene: SceneSpec }) {
  const w = THREE.MathUtils.clamp(scene.width / 70, 1, 3.8);
  const h = THREE.MathUtils.clamp(scene.height / 70, 0.65, 2.8);
  const d = THREE.MathUtils.clamp(scene.depth / 70, 0.45, 2.1);
  const events = usePartClick("enclosure", props.onSelect);
  return (
    <group position={[0, 0.05, 0]}>
      <AnimatedPart
        position={[0, props.exploded ? 0.8 : 0, 0]}
        reducedMotion={props.reducedMotion}
      >
        <group {...events}>
          <RoundedBox args={[w, h, d]} radius={0.13} smoothness={5}>
            <ShellMaterial
              color={props.color}
              ghost={props.electronic || props.exploded}
              selected={props.selected === "enclosure"}
            />
          </RoundedBox>
          <RoundedBox
            args={[w * 0.69, h * 0.39, 0.026]}
            radius={0.05}
            smoothness={4}
            position={[0, h * 0.11, d / 2 + 0.016]}
          >
            <meshStandardMaterial
              color="#081921"
              roughness={0.22}
              metalness={0.5}
              transparent
              opacity={props.electronic ? 0.22 : 1}
            />
          </RoundedBox>
          <mesh position={[-w * 0.23, -h * 0.25, d / 2 + 0.035]}>
            <circleGeometry args={[0.042, 24]} />
            <meshBasicMaterial color="#a2f5d7" toneMapped={false} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <RoundedBox
              key={i}
              args={[0.035, h * 0.26, 0.012]}
              radius={0.015}
              smoothness={2}
              position={[w * 0.13 + i * 0.082, -h * 0.23, d / 2 + 0.013]}
            >
              <meshStandardMaterial color="#121b25" roughness={0.7} />
            </RoundedBox>
          ))}
        </group>
      </AnimatedPart>
      <CircuitBoard
        width={w * 0.8}
        depth={d * 0.77}
        visible={props.electronic || props.exploded}
        selected={props.selected}
        onSelect={props.onSelect}
      />
      <AnimatedPart
        position={[0, props.exploded ? -h / 2 - 0.47 : -h / 2, 0]}
        reducedMotion={props.reducedMotion}
      >
        <RoundedBox
          args={[w * 0.96, 0.065, d * 0.96]}
          radius={0.03}
          smoothness={3}
          {...usePartClick("baseplate", props.onSelect)}
        >
          <ShellMaterial
            color="#202936"
            ghost={props.electronic}
            selected={props.selected === "baseplate"}
          />
        </RoundedBox>
      </AnimatedPart>
    </group>
  );
}

function CustomPart({
  part,
  props,
  scale,
}: {
  part: ScenePart;
  props: PartProps;
  scale: number;
}) {
  const offset = props.exploded
    ? part.domain === "electronics"
      ? 0.55
      : -0.25
    : 0;
  const events = usePartClick(part.id, props.onSelect);
  const dims = part.size.map((n) => Math.max(0.005, n * scale)) as [
    number,
    number,
    number,
  ];
  return (
    <AnimatedPart
      position={[
        part.position[0] * scale,
        part.position[1] * scale + offset,
        part.position[2] * scale,
      ]}
      reducedMotion={props.reducedMotion}
    >
      <mesh rotation={part.rotation ?? [0, 0, 0]} {...events}>
        {part.shape === "box" && <boxGeometry args={dims} />}
        {part.shape === "sphere" && (
          <sphereGeometry args={[dims[0] / 2, 32, 24]} />
        )}
        {part.shape === "cylinder" && (
          <cylinderGeometry args={[dims[0] / 2, dims[0] / 2, dims[1], 40]} />
        )}
        {part.shape === "torus" && (
          <torusGeometry
            args={[
              Math.max(0.001, (dims[0] - dims[1]) / 2),
              dims[1] / 2,
              16,
              64,
            ]}
          />
        )}
        <ShellMaterial
          color={part.color || props.color}
          ghost={props.electronic && part.domain !== "electronics"}
          selected={props.selected === part.id}
        />
      </mesh>
    </AnimatedPart>
  );
}

function ParametricObject({
  scene,
  ...props
}: PartProps & { scene: SceneSpec }) {
  if (!scene.parts.length && scene.kind === "wheel")
    return <Wheel scene={scene} {...props} />;
  if (!scene.parts.length && scene.kind === "enclosure")
    return <Enclosure scene={scene} {...props} />;
  const scale = 3.2 / Math.max(scene.width, scene.height, scene.depth, 1);
  return (
    <group>
      {scene.parts.map((part) => (
        <CustomPart key={part.id} part={part} props={props} scale={scale} />
      ))}
    </group>
  );
}

function UnfoldedBoard({
  selected,
  onSelect,
  reducedMotion,
  fromWheel,
}: {
  selected: string | null;
  onSelect: (id: string | null) => void;
  reducedMotion: boolean;
  fromWheel: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const progress = useRef(reducedMotion ? 1 : 0);
  useFrame((_, dt) => {
    if (!group.current) return;
    progress.current = Math.min(1, progress.current + dt / 0.85);
    const t = progress.current * progress.current * (3 - 2 * progress.current);
    group.current.rotation.x = fromWheel ? ((1 - t) * Math.PI) / 2 : 0;
    group.current.scale.set(
      THREE.MathUtils.lerp(0.69, 1, t),
      1,
      THREE.MathUtils.lerp(0.4, 1, t),
    );
  });
  return (
    <group
      ref={group}
      rotation={fromWheel && !reducedMotion ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
      scale={reducedMotion ? [1, 1, 1] : [0.69, 1, 0.4]}
    >
      <CircuitBoard
        width={3.1}
        depth={1.75}
        visible
        selected={selected}
        onSelect={onSelect}
      />
    </group>
  );
}

function LoadedArtifact({
  url,
  fallback,
  onSelect,
}: {
  url: string;
  fallback: ReactNode;
  onSelect: (id: string | null) => void;
}) {
  const [loaded, setLoaded] = useState<{
    url: string;
    object: THREE.Object3D;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const accepted = useRef<THREE.Object3D | null>(null);
  const release = (obj: THREE.Object3D) =>
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (Array.isArray(child.material)
          ? child.material
          : [child.material]
        ).forEach((m: THREE.Material) => m.dispose());
      }
    });
  useEffect(
    () => () => {
      if (loaded) release(loaded.object);
    },
    [loaded],
  );
  useEffect(() => {
    let disposed = false;
    let object: THREE.Object3D | undefined;
    const release = (obj: THREE.Object3D) =>
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (Array.isArray(child.material)
            ? child.material
            : [child.material]
          ).forEach((m: THREE.Material) => m.dispose());
        }
      });
    const load = async () => {
      try {
        const parsedUrl = new URL(url, window.location.origin);
        const path = (
          parsedUrl.searchParams.get("path") || parsedUrl.pathname
        ).toLowerCase();
        if (path.endsWith(".stl") || /[?&]format=stl(?:&|$)/i.test(url)) {
          const geometry = await new STLLoader().loadAsync(url);
          geometry.computeVertexNormals();
          object = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
              color: "#698999",
              metalness: 0.5,
              roughness: 0.35,
            }),
          );
        } else {
          object = (await new GLTFLoader().loadAsync(url)).scene;
        }
        if (disposed) {
          release(object);
          return;
        }
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        // Frame the complete assembly, including thick models at an angle.
        const scale = 3.7 / Math.max(size.length(), 0.001);
        object.position.copy(center.multiplyScalar(-scale));
        object.scale.setScalar(scale);
        accepted.current = object;
        setLoaded({ url, object });
        setFailed(null);
      } catch {
        if (!disposed) setFailed(url);
      }
    };
    void load();
    return () => {
      disposed = true;
      if (object && object !== accepted.current) release(object);
    };
  }, [url]);
  if (loaded)
    return (
      <group
        onClick={(event) => {
          event.stopPropagation();
          if (event.delta < 5) onSelect(event.object.name || "model");
        }}
      >
        <primitive object={loaded.object} />
        {failed === url && (
          <Html position={[0, -1.1, 0]} center>
            <span className="error-note">
              New model unavailable · previous model retained
            </span>
          </Html>
        )}
      </group>
    );
  return (
    <>
      {fallback}
      {failed === url && (
        <Html position={[0, -1.1, 0]} center style={{ pointerEvents: "none" }}>
          <span
            style={{
              whiteSpace: "nowrap",
              font: "11px ui-monospace, monospace",
              color: "#a7a5b2",
              background: "#10151dcc",
              padding: "7px 11px",
              borderRadius: 20,
            }}
          >
            Mesh unavailable · showing project preview
          </span>
        </Html>
      )}
    </>
  );
}

function SceneContents(props: StudioSceneProps) {
  const electronic = props.station === "electronics";
  const partProps: PartProps = {
    selected: props.selectedPart,
    onSelect: props.onSelectPart,
    electronic,
    exploded: props.exploded,
    reducedMotion: props.reducedMotion,
    color: props.scene.color || "#617481",
  };
  const object = <ParametricObject scene={props.scene} {...partProps} />;
  return (
    <>
      <color attach="background" args={["#060a11"]} />
      <fog attach="fog" args={["#060a11", 12, 28]} />
      <ambientLight intensity={0.5} color="#90a3bf" />
      <hemisphereLight args={["#b9d1ec", "#151021", 1.25]} />
      <spotLight
        position={[3, 6, 4]}
        intensity={100}
        angle={0.42}
        penumbra={1}
        decay={2}
        color="#d2eef5"
      />
      <pointLight position={[-4, 1, -1]} intensity={25} color="#8675c2" />
      <pointLight position={[4, 0, -3]} intensity={28} color="#4d8f9f" />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={3}
          color="#cde8f6"
          position={[0, 5, -2]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[8, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          color="#8b7fb5"
          position={[-4, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[4, 7, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          color="#89bacb"
          position={[4, 1, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[3, 6, 1]}
        />
      </Environment>
      <Dust reducedMotion={props.reducedMotion} />
      <Stage
        station={props.station}
        busy={props.busy}
        reducedMotion={props.reducedMotion}
        flat={props.flat}
      />
      {props.artifactUrl ? (
        <LoadedArtifact
          key={props.artifactScopeKey}
          url={props.artifactUrl}
          fallback={
            props.scene.kind === "plasma" ? (
              <Plasma reducedMotion={props.reducedMotion} busy={props.busy} />
            ) : (
              object
            )
          }
          onSelect={props.onSelectPart}
        />
      ) : props.scene.kind === "plasma" ? (
        <Plasma reducedMotion={props.reducedMotion} busy={props.busy} />
      ) : electronic &&
        props.flat &&
        !props.scene.parts.length &&
        (props.scene.kind === "wheel" || props.scene.kind === "enclosure") ? (
        <UnfoldedBoard
          selected={props.selectedPart}
          onSelect={props.onSelectPart}
          reducedMotion={props.reducedMotion}
          fromWheel={props.scene.kind === "wheel"}
        />
      ) : (
        object
      )}
      <CameraRig
        station={props.station}
        flat={props.flat}
        exploded={props.exploded}
        resetKey={props.resetKey}
        reducedMotion={props.reducedMotion}
        zoomKey={props.zoomKey}
      />
    </>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div
        style={{
          color: "#acbacd",
          position: "absolute",
          inset: "30% 15% auto",
          textAlign: "center",
        }}
      >
        The spatial preview could not start. Your project is still available
        below.
      </div>
    ) : (
      this.props.children
    );
  }
}

export default function StudioScene(props: StudioSceneProps) {
  return (
    <SceneBoundary>
      <Canvas
        aria-label="Interactive 3D model. Drag to orbit, scroll or pinch to zoom, and press R to reset."
        role="img"
        dpr={[1, 1.7]}
        camera={{ position: [0.86, 1.75, 7.15], fov: 37, near: 0.05, far: 60 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{ position: "absolute", inset: 0, touchAction: "none" }}
        onPointerMissed={() => props.onSelectPart(null)}
        fallback={
          <div style={{ color: "#bcc8d4", padding: "20vh 20vw" }}>
            Holo needs WebGL to display your invention.
          </div>
        }
      >
        <Suspense fallback={null}>
          <SceneContents {...props} />
        </Suspense>
      </Canvas>
    </SceneBoundary>
  );
}
