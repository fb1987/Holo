# Live engine validation

Validated on macOS on 11 September 2026 with the installed Codex app-server, GPT-6-Astra at high reasoning effort, and an existing Python environment containing Blender `bpy` 5.2.1 LTS. Authentication used the local Codex account. No credentials or account state were copied into Holo or its build package.

## Confirmed outcome

A real planning agent handed a narrowly scoped geometry request to a separate, persistent design-agent thread. The design agent wrote and executed a Blender Python script, producing an editable `.blend` file and a binary `.glb` for a conceptual 10 mm cube. It also produced source, a README, and a validation report. Holo ultimately accepted the complete structured result and registered the artifacts at revision 3.

The successful finalization request ran from 22:58:20 to 22:59:35 UTC, approximately 75 seconds. It involved both planning and design. It inspected and finalized already generated files without repeating the successful modeling and export commands.

| Artifact                 |  Bytes | Evidence                                                                                     |
| ------------------------ | -----: | -------------------------------------------------------------------------------------------- |
| `validation_cube.blend`  | 88,522 | Produced by Blender and reopened by the agent's verification script                          |
| `validation_cube.glb`    |  2,072 | Independently parsed after registration; glTF 2, one node, declared and actual lengths match |
| `validation_cube.py`     |  3,598 | Actual editable generator source                                                             |
| `README.md`              |  1,358 | Dimensions, units and limitations                                                            |
| `validation_report.json` |    607 | Recorded geometry and output checks                                                          |

Independent GLB inspection found approximately `0.009999999776` metres along each axis, consistent with a 10 mm cube and floating-point storage. This verifies the generated test geometry, not any physical fabrication process.

The actual HTTP export endpoint returned status 200 and a 100,574-byte ZIP containing 13 entries. All 12 files listed in its manifest matched their recorded SHA-256 digest and byte count. Every ZIP entry passed its CRC check. Older planning artifacts retained their original source revisions; the current design artifacts were recorded at revision 3.

## Recovery history

The validation did not succeed on its first attempt. Those failures were visible and were not relabeled as successful work.

- The first provider request rejected Zod's tuple representation. Holo now translates homogeneous three-number tuples into supported array schemas while retaining strict tuple validation before committing any result.
- A later test streamed thousands of whitespace characters after an incomplete `affected` field. Inspection of the running test confirmed an incomplete JSON response, not useful ongoing reasoning. A specialist-specific `maxItems: 0` constraint was removed. Domain ownership remains enforced when applying validated output.
- Holo now interrupts excessive structured whitespace or oversized output and permits one bounded formatting retry in the same thread. The retry explicitly preserves successful tool work. Tests cover interruption, reuse of the thread, and the one-retry limit.
- Incomplete output never committed the design revision. The final successful request inspected the real existing artifacts and completed the ordinary planner-to-design transaction. No project state was manually fabricated to make the test pass.

## Blender execution boundary

The configured `bpy` executable was discovered through a local `tools.json` configuration, not a hardcoded personal path in the application. The application verifies that the executable can import `bpy` and gives the exact interpreter path to the agents.

A packaged native launch initially reported Blender unavailable; a subsequent full relaunch detected it. The exact cause of that transient detection failure was not established. Discovery now makes at most two import attempts within the existing 15-second probe budget, deduplicates concurrent checks, and rechecks unavailable tools when the user explicitly connects. Missing or non-executable paths are not retried.

The final diagnostic build was launched as the installed native application. At 23:14:16 UTC, its Electron 44.3.0 utility process (Node 24.20.0) successfully imported `bpy` on the first attempt in 4,481 ms, returning `5.2.1 LTS` with empty stderr. Discovery records bounded per-attempt timing, exit/signal details and output in a private `tool-diagnostics.json` in the application-data directory. It does not dump environment variables or account state. This successful check does not establish the cause of the earlier intermittent failures; no interpreter-shutdown workaround was introduced.

During the live generation, Blender could not complete its initial sandboxed invocation. Holo displayed an approval request for the exact project-local script. That narrowly scoped test command was explicitly approved, and the retry produced and verified the files.

Guidance now asks agents to place temporary files inside their own workstation directory. A separate restricted execution probe nevertheless crashed this installed environment's native USD library with exit code 139. Therefore this environment still requires explicit command approval for Blender work. The validation does **not** establish that arbitrary Blender workloads run successfully inside the workspace sandbox.

## Automated checks

`npm run check` and all 18 engine/protocol tests passed after the final changes. Coverage includes:

- Real JSONL handshake, authentication/model discovery, streamed turns and approval requests through a deterministic subprocess fixture.
- Bounded native-tool probe retry, deduplication, refresh on explicit connection, and recorded success/failure diagnostics.
- Planner-first routing, persistent specialist threads, bounded arbitration and cancellation.
- Transaction rollback on invalid structured output or invalid artifact paths.
- Formatting-stall detection, bounded retry, and turn-event isolation.
- Immutable artifact snapshots, path and symlink restrictions, spreadsheet-safe CSV output, and export hashes.
- Cross-origin request rejection, process locking with stale recovery, and durable preferences across service restarts on independently assigned ports.
- Executable conceptual wheel and timer behavior examples.

The real-provider and real-Blender checks above are separate from those deterministic tests. They establish a working integration path; they do not verify autonomous PCB routing, component availability, electrical safety, supplier acceptance, or manufacturing readiness. The studio continues to label such work as conceptual or in development until supporting evidence exists.
