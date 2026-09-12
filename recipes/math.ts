export type V3 = [number, number, number];
export const add = (a: V3, b: V3): V3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const sub = (a: V3, b: V3): V3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(...a));
export const mean = (points: V3[]): V3 =>
  mul(points.reduce(add, [0, 0, 0]), 1 / points.length);
export function ordered(points: V3[], ids: number[]) {
  const center = mean(ids.map((i) => points[i])),
    normal = norm(center),
    u = norm(sub(points[ids[0]], center)),
    v = cross(normal, u);
  return ids
    .slice()
    .sort(
      (a, b) =>
        Math.atan2(
          dot(sub(points[a], center), v),
          dot(sub(points[a], center), u),
        ) -
        Math.atan2(
          dot(sub(points[b], center), v),
          dot(sub(points[b], center), u),
        ),
    );
}
