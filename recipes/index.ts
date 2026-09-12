import type { DesignSpec } from "../shared/design.js";
import { buildBall } from "./ball.js";
import { buildSolids } from "./solids.js";
import type { Fidelity } from "./mesh.js";
export function buildGeometry(spec: DesignSpec, fidelity: Fidelity) {
  return spec.recipe === "paneled-ball"
    ? Promise.resolve(buildBall(spec, fidelity))
    : buildSolids(spec, fidelity);
}
