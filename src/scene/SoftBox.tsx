import { RoundedBox as DreiRoundedBox } from "@react-three/drei";
import type { ComponentProps } from "react";

/** Keep bevels within every dimension, including thin PCB and enclosure walls. */
export function RoundedBox({
  args = [1, 1, 1],
  radius = 0.05,
  ...props
}: ComponentProps<typeof DreiRoundedBox>) {
  const safeRadius = Math.min(
    radius,
    ...args.map((value) => (value ?? 1) * 0.49),
  );
  return <DreiRoundedBox args={args} radius={safeRadius} {...props} />;
}
