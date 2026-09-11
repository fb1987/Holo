import type { Station } from "../shared/types.js";

export interface SampleFile {
  station: Station;
  filename: string;
  name: string;
  content: string;
}
export function sampleFiles(template: string): SampleFile[] {
  if (template === "blank") return [];
  const wheel = template === "wheel";
  const chains = wheel
    ? [
        {
          id: "button",
          input: "Push button",
          controller: "Controller digital input",
          behavior: "Button mapping",
          output: "USB HID button",
          consumer: "Simulator action",
        },
        {
          id: "encoder",
          input: "Rotary encoder",
          controller: "Controller edge inputs",
          behavior: "Detent mapping",
          output: "USB HID adjustment",
          consumer: "Brake-bias setting",
        },
      ]
    : [
        {
          id: "button",
          input: "Front button",
          controller: "Controller digital input",
          behavior: "Start / pause timer",
          output: "Display state",
          consumer: "Time remaining",
        },
        {
          id: "tick",
          input: "Clock tick",
          controller: "Controller timebase",
          behavior: "Countdown update",
          output: "Completion signal",
          consumer: "Timer finished",
        },
      ];
  const assumptions = wheel
    ? [
        "A USB-capable controller has not yet been selected.",
        "Pins, voltage levels, debounce timing and encoder pull-ups remain unspecified.",
        "HID report descriptors and simulator bindings require implementation and testing.",
        "Button and encoder mounting clearances require physical review.",
      ]
    : [
        "The controller, display and power source have not yet been selected.",
        "Pins, voltage levels, display protocol and button debounce remain unspecified.",
        "Timing accuracy, power behaviour and firmware upload require implementation and testing.",
        "The enclosure needs dimensions checked against actual selected components.",
      ];
  const contract = {
    status: "conceptual",
    projectKind: wheel ? "wheel" : "enclosure",
    description: wheel
      ? "A proposed input-to-simulator signal path."
      : "A proposed desktop timer behaviour.",
    chains,
    unverifiedAssumptions: assumptions,
  };
  const behavior = wheel
    ? `/** Holo conceptual example. Pure software behaviour, not tested device firmware.
 * Hardware pins, electrical interfaces, USB descriptors and debounce are unassigned.
 */
export type Input =
  | { type: 'button'; pressed: boolean }
  | { type: 'encoder'; delta: -1 | 1 };
export type Action =
  | { type: 'hid-button'; button: 1; pressed: boolean }
  | { type: 'hid-adjustment'; control: 'brake-bias'; delta: -1 | 1 };

export function interpret(input: Input): Action {
  return input.type === 'button'
    ? { type: 'hid-button', button: 1, pressed: input.pressed }
    : { type: 'hid-adjustment', control: 'brake-bias', delta: input.delta };
}

export const examples: Array<{ input: Input; expected: Action }> = [
  { input: { type: 'button', pressed: true }, expected: { type: 'hid-button', button: 1, pressed: true } },
  { input: { type: 'encoder', delta: 1 }, expected: { type: 'hid-adjustment', control: 'brake-bias', delta: 1 } },
];
`
    : `/** Holo conceptual example. Pure timer state model, not tested device firmware.
 * The clock, GPIO, display driver and power system are not implemented.
 */
export type State = { remainingMs: number; running: boolean; completed: boolean };
export type Input = { type: 'button' } | { type: 'tick'; elapsedMs: number } | { type: 'reset'; durationMs: number };
export const initialState: State = { remainingMs: 5 * 60 * 1000, running: false, completed: false };

export function update(state: State, input: Input): State {
  if (input.type === 'reset') {
    if (!Number.isFinite(input.durationMs) || input.durationMs < 0) throw new Error('Duration must be finite and nonnegative.');
    return { remainingMs: input.durationMs, running: false, completed: false };
  }
  if (input.type === 'button') return { ...state, running: state.remainingMs > 0 && !state.running };
  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < 0) throw new Error('Elapsed time must be finite and nonnegative.');
  if (!state.running) return state;
  const remainingMs = Math.max(0, state.remainingMs - input.elapsedMs);
  return { remainingMs, running: remainingMs > 0, completed: remainingMs === 0 };
}
`;
  return [
    {
      station: "software",
      filename: "behavior.ts",
      name: "Conceptual behaviour model",
      content: behavior,
    },
    {
      station: "software",
      filename: "behavior-contract.json",
      name: "Signal path contract",
      content: JSON.stringify(contract, null, 2) + "\n",
    },
    {
      station: "software",
      filename: "architecture.md",
      name: "Software architecture brief",
      content: `# ${wheel ? "Steering wheel" : "Desktop timer"} — conceptual software architecture\n\nThis example contains an editable TypeScript behaviour model and a proposed signal path. It is not flashed firmware, a selected hardware platform, or a completed device.\n\n## Behaviour\n\n${chains.map((c) => `- ${c.input} → ${c.controller} → ${c.behavior} → ${c.output} → ${c.consumer}`).join("\n")}\n\n## Boundaries\n\nThe pure functions in behavior.ts describe the intended response to input. A future firmware implementation must connect them to a selected controller, electrical interfaces and device drivers. Keep those interfaces explicit so mechanical design and board planning can review any footprint or power changes.\n\n## Still to establish\n\n${assumptions.map((a) => "- " + a).join("\n")}\n\n## Explore\n\nRead or import behavior.ts in a TypeScript project. For local exploration with an existing tsx installation, import its exported functions and feed them sample events. No package installation or firmware upload is performed by this example.\n`,
    },
    {
      station: "planning",
      filename: "assembly-brief.md",
      name: "Conceptual assembly brief",
      content: `# ${wheel ? "Steering wheel" : "Connected enclosure"} — starting assembly brief\n\n**Status: conceptual example. Not a production or ordering package.**\n\nThe scene and component classes are placeholders for exploration. Start by deciding which parts you want to assemble yourself, which parts should arrive assembled, and which finishing work you want a supplier to perform.\n\n## Before fabrication\n\n- Select actual boards, connectors and controls, then check their dimensions against the enclosure.\n- Resolve wall thickness, fastening, access, cable exits, material and finish.\n- Generate and inspect dimensioned editable CAD and fabrication exports.\n\n## Before electronics assembly\n\n- Establish the power tree and signal levels, schematic and connector pinout.\n- Verify components and supplier availability from current sources.\n- Review a real PCB design where needed; this example does not include a fabricated board layout.\n\n## Before use\n\n- Implement and test the firmware against the selected hardware.\n- Check assembly fit, electrical behaviour, controls and programming procedure on a physical prototype.\n- Confirm responsibilities, quantities, file revisions and acceptance criteria with suppliers before ordering.\n`,
    },
  ];
}
