import type { V3 } from "./math.js";
export interface MeshPart {
  id: string;
  material: "body" | "accent";
  positions: number[];
  indices: number[];
  normals?: number[];
  closed: boolean;
}
export interface Geometry {
  parts: MeshPart[];
  topology?: { vertices: V3[]; faces: { id: string; vertices: number[] }[] };
}
export type Fidelity = "coarse" | "refined";
