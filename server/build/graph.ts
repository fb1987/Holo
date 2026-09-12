import type { Station } from "../../shared/types.js";
export interface Dependency {
  station: Station;
  requires: Station[];
}
/** Layers are calculated before execution; cycles never start partial work. */
export function dependencyLayers(
  affected: Station[],
  declared: Dependency[] | null,
): Station[][] {
  const nodes: Station[] = [
    ...new Set(affected.filter((s) => s !== "planning")),
  ];
  const dependencies = new Map<Station, Set<Station>>();
  if (declared === null) {
    const order: Station[] = ["design", "electronics", "software"];
    for (const station of nodes)
      dependencies.set(
        station,
        new Set(
          order
            .slice(0, order.indexOf(station))
            .filter((s) => nodes.includes(s)),
        ),
      );
  } else {
    for (const entry of declared) {
      if (
        entry.station === "planning" ||
        dependencies.has(entry.station) ||
        entry.requires.includes(entry.station)
      )
        throw new Error("Invalid or duplicate specialist dependency.");
      dependencies.set(
        entry.station,
        new Set(entry.requires.filter((s) => nodes.includes(s))),
      );
    }
    // Missing entries conservatively retain the established domain order.
    const order: Station[] = ["design", "electronics", "software"];
    for (const station of nodes)
      if (!dependencies.has(station))
        dependencies.set(
          station,
          new Set(
            order
              .slice(0, order.indexOf(station))
              .filter((s) => nodes.includes(s)),
          ),
        );
  }
  const layers: Station[][] = [],
    remaining = new Set(nodes),
    done = new Set<Station>();
  while (remaining.size) {
    const ready = [...remaining].filter((station) =>
      [...dependencies.get(station)!].every((dep) => done.has(dep)),
    );
    if (!ready.length)
      throw new Error(
        "Specialist dependency cycle: the strategist must resolve the interface order.",
      );
    layers.push(ready);
    for (const station of ready) {
      remaining.delete(station);
      done.add(station);
    }
  }
  return layers;
}
