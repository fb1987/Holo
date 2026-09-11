import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "./SoftBox";

interface Props {
  width: number;
  depth: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  visible: boolean;
}

/** A clearly conceptual board visualization. Fabrication output is managed separately. */
export function CircuitBoard({
  width,
  depth,
  selected,
  onSelect,
  visible,
}: Props) {
  const routes = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const y = 0.04 + (i % 4) * 0.002;
        const start = -depth * 0.25 + (i / 20) * depth * 0.53;
        const end = -depth * 0.36 + (i / 20) * depth * 0.74;
        return [
          [side * width * 0.115, y, start],
          [side * width * (0.17 + (i % 3) * 0.026), y, start],
          [side * width * (0.24 + (i % 3) * 0.026), y, end],
          [side * width * 0.4, y, end],
        ] as [number, number, number][];
      }),
    [width, depth],
  );
  if (!visible) return null;
  const click = (id: string) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta < 5) onSelect(id);
  };
  const hover = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = "pointer";
  };
  return (
    <group>
      <RoundedBox
        args={[width, 0.05, depth]}
        radius={Math.min(0.035, depth * 0.05)}
        smoothness={3}
        onClick={click("pcb")}
        onPointerOver={hover}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <meshStandardMaterial
          color={selected === "pcb" ? "#206266" : "#143d40"}
          roughness={0.5}
          metalness={0.25}
        />
      </RoundedBox>
      <Line
        points={[
          [-width * 0.47, 0.027, -depth * 0.46],
          [width * 0.47, 0.027, -depth * 0.46],
          [width * 0.47, 0.027, depth * 0.46],
          [-width * 0.47, 0.027, depth * 0.46],
          [-width * 0.47, 0.027, -depth * 0.46],
        ]}
        color="#799a8c"
        transparent
        opacity={0.45}
        lineWidth={0.7}
      />
      {routes.map((points, i) => (
        <Line
          key={i}
          points={points}
          color={i % 4 === 0 ? "#a2c08c" : "#528d7a"}
          lineWidth={i % 5 === 0 ? 1.7 : 0.7}
          transparent
          opacity={0.7}
        />
      ))}
      <group
        position={[0, 0.065, -depth * 0.02]}
        onClick={click("controller")}
        onPointerOver={hover}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <RoundedBox
          args={[width * 0.24, 0.075, depth * 0.38]}
          radius={0.012}
          smoothness={2}
        >
          <meshStandardMaterial
            color={selected === "controller" ? "#2b5261" : "#172029"}
            metalness={0.32}
            roughness={0.63}
          />
        </RoundedBox>
        {[-1, 1].flatMap((side) =>
          Array.from({ length: 12 }, (_, i) => (
            <mesh
              key={`${side}-${i}`}
              position={[
                side * width * 0.139,
                -0.023,
                -depth * 0.165 + (i / 11) * depth * 0.33,
              ]}
            >
              <boxGeometry args={[width * 0.036, 0.015, depth * 0.012]} />
              <meshStandardMaterial
                color="#b6b8a0"
                metalness={0.85}
                roughness={0.35}
              />
            </mesh>
          )),
        )}
        <mesh
          position={[-width * 0.07, 0.039, -depth * 0.1]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.013, 12]} />
          <meshBasicMaterial color="#66808a" />
        </mesh>
      </group>
      {[-1, 1].flatMap((side) =>
        Array.from({ length: 7 }, (_, i) => (
          <group
            key={`${side}-${i}`}
            position={[
              side * width * 0.39,
              0.056,
              -depth * 0.31 + i * depth * 0.1,
            ]}
            onClick={click("passives")}
          >
            <mesh>
              <boxGeometry args={[width * 0.066, 0.036, depth * 0.04]} />
              <meshStandardMaterial
                color={
                  selected === "passives"
                    ? "#7bd3c0"
                    : i % 2
                      ? "#26343a"
                      : "#918571"
                }
                roughness={0.5}
                metalness={0.3}
              />
            </mesh>
            {[-1, 1].map((end) => (
              <mesh key={end} position={[end * width * 0.028, 0.001, 0]}>
                <boxGeometry args={[width * 0.013, 0.039, depth * 0.044]} />
                <meshStandardMaterial
                  color="#a5b2ad"
                  metalness={0.85}
                  roughness={0.3}
                />
              </mesh>
            ))}
          </group>
        )),
      )}
      <group
        position={[width * 0.27, 0.085, -depth * 0.39]}
        onClick={click("connector")}
      >
        <RoundedBox
          args={[width * 0.13, 0.12, depth * 0.19]}
          radius={0.012}
          smoothness={2}
        >
          <meshStandardMaterial
            color={selected === "connector" ? "#80d6c4" : "#929da7"}
            metalness={0.95}
            roughness={0.2}
          />
        </RoundedBox>
        <mesh position={[0, 0.009, -depth * 0.1]}>
          <boxGeometry args={[width * 0.105, 0.064, 0.008]} />
          <meshStandardMaterial color="#161f28" roughness={0.6} />
        </mesh>
      </group>
      <group
        position={[-width * 0.25, 0.07, depth * 0.31]}
        onClick={click("headers")}
      >
        <mesh>
          <boxGeometry args={[width * 0.19, 0.072, depth * 0.12]} />
          <meshStandardMaterial
            color={selected === "headers" ? "#499589" : "#18242a"}
            roughness={0.75}
          />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh
            key={i}
            position={[-width * 0.075 + i * width * 0.03, 0.056, 0]}
          >
            <boxGeometry args={[0.013, 0.065, 0.013]} />
            <meshStandardMaterial
              color="#c3a66b"
              metalness={0.9}
              roughness={0.25}
            />
          </mesh>
        ))}
      </group>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group
            key={`${x}-${z}`}
            position={[x * width * 0.44, 0.027, z * depth * 0.4]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <mesh>
              <ringGeometry args={[0.02, 0.04, 24]} />
              <meshStandardMaterial
                color="#bdad78"
                metalness={0.75}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, 0, -0.001]}>
              <circleGeometry args={[0.019, 24]} />
              <meshBasicMaterial color="#070f15" />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}
