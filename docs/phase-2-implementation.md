# Holo 0.2.0 — deterministic workshop

Implemented September 12, 2026. The investigation and approved scope are in [the phase-two plan](phase-2-deterministic-workshop.md). Independent reviews are in [execution review](phase-2-execution-review.md) and [UX/creative review](phase-2-ux-review.md).

## What changed

Astra-high converts intent into a bounded, versioned design specification. Supported designs go directly to application-owned workers: routine construction requires no second design-model call, generated Python, or per-step permission requests. Luna remains available for specialist and custom work. The planner can correct an invalid specification once; native crashes never launch an unbounded debugging loop.

The four initial recipes share topology or constructive-solid operations:

- Classic soccer ball: 12 pentagons, 20 hexagons, spherical panel surfaces, recessed seams and black/white materials. No valve. This is a visual surface model, not an inflatable-ball manufacturing design.
- Hollow container: rounded opening, real floor/cavity/walls, taper and inward rim.
- Enclosure: separate seated lid, locating tongue, four drilled standoffs, matching lid holes and vents.
- Cradle: device envelope, clearance, rear wall, shelf, retention and mounting holes.

The three solid families share repeated horizontal detail: debossed grooves or ribs raised inside a recessed field. This preserves the outer envelope. Tapered detail follows the wall; cradle decoration uses its continuous rear wall. Arbitrary text, logos, sculpting and unrestricted embossing are outside these first bounded recipes.

Coarse and detailed geometry use one approved specification. A provisional sketch can appear during planning; it remains distinct from accepted geometry. A valid detailed GLB replaces the coarse build immediately. Optional STEP and three static Blender views follow without hiding the model. A failed correction retains the previous assembly.

## Execution and evidence

`shared/design.ts` defines dimensions, units, axes, materials, component identity, required outputs and parameter limits. `recipes/` contains reviewed construction and adapters. `server/build/` owns worker execution, validation, dependency scheduling, caching and publication. These boundaries are additive to existing projects.

The mesh worker uses pinned Manifold 3.5.3 and glTF Transform 4.5.0. CAD uses an app-owned CadQuery 2.6.1 environment; presentation uses a separate bpy 5.2.1 environment. Neither relies on the steering-wheel project's virtualenv. Health checks exercise actual production worker paths and report mesh, CAD and rendering separately. Import-only legacy probes are explicitly weaker evidence.

The native import crash originally reported inside the agent workspace was not diagnosed to a precise Blender backtrace. The chosen app-owned bpy worker successfully imports the actual exported GLB and renders it. No unsupported claim is made that Blender's internals were repaired.

Independent GLB checks cover exported dimensions, topology, indices, material round-trip, normals and appropriate solid/surface properties. Occupancy probes reject filled substitutes and inspect walls, cavities, clearance, holes and vents. The review found and fixed missing-output acceptance, shallow seam occlusion, a coplanar lid seam, and a Manifold scalar-scale wrapper discrepancy. Four-wall checks now exercise both solid axes at multiple heights. These checks are not a manufacturing certificate or an exhaustive proof of all seam distances.

Deliverable outcomes are distinct from agent processing status: succeeded, partial, blocked or failed. Optional render failure can be partial while retaining useful geometry. Deliberate source-only work needs new source; a model request needs a new loadable assembly. Legacy unchecked runs do not gain retroactive verification.

## Rebuilding and retaining projects

Each accepted build stores the normalized request/specification, implementation lock, validation report and a snapshot of its rebuild implementation. ZIP exports include that exact source snapshot, a bundled rebuild command, exact dependency locks and instructions. Rebuilding the exported soccer fixture produced a byte-identical GLB without an AI call. Future app changes cannot silently substitute a different recipe implementation into old exports.

Cache keys distinguish geometry from materials and outputs. Color-only changes reuse geometry. Python adapter source is part of the native cache key. Full manifests verify all cached output hashes. Consumer leases, atomic commits and dependency revision checks prevent concurrent jobs, cache eviction or stale native results from replacing accepted files.

Mesh workers have a 384 MiB JS heap cap, input/output limits, bounded logs and wall time. Native workers have CPU/file limits and parent timeouts. Two mesh slots and one native slot limit local contention. Reconstructible mesh/native caches are capped at 256/128 MiB. Scratch and leases are cleaned after completion/cancellation and on startup; accepted artifacts are never quota-pruned. Shutdown aborts and drains owned work before releasing the project-data lock. These process limits are not an OS security sandbox for arbitrary code; trusted workers execute only installed recipe code.

## Measured evidence

One isolated live Codex acceptance run on this Mac requested a classic 220 mm soccer ball:

| Stage                         | Measured time |
| ----------------------------- | ------------: |
| Astra-high planning           |  23.3 seconds |
| Local geometry and validation |  0.76 seconds |
| Total request                 |  25.0 seconds |

There were zero planner tool calls, zero retries and no design-model call. These are individual observations, not latency guarantees. Network/model planning can vary.

Separate native adapter runs measured approximately 2.6–3.6 seconds for STEP and 6.5 seconds for three 640×640 static ball views. The independent creative review accepted front/rear/oblique views after lighting and seam fixes. No video generation or capture is used.

Automated coverage includes recipe/fidelity matrices, diameter and seam extremes, known-invalid exported models, materials/winding, shared relief, crash/timeout/cancellation, forced health probes, cache concurrency/corruption, dependency order/parallelism, failed correction outcomes, native-worker ownership and independent exported-package rebuilding. Browser checks cover the visible accepted ball, Activity, settings and preserving the model on a blocked correction. Packaged/native release verification is recorded below when complete.

## Using this release

Try: “Create a classic 220 mm soccer ball with black pentagons, white hexagons and no valve. Give me the interactive model and rebuild package.” Other examples: a tapered recycling bin, a vented controller enclosure, or a portrait phone cradle. Specify dimensions when they matter.

Settings has an **Allow built-in recipe operations** switch and a **Test workshop** action. Mesh generation ships with the app. Optional native runtimes can be installed from the repository using `npm run setup:workshop`; this installs pinned environments under Holo's application-data directory. They are already provisioned on the development Mac. The Python wheels are not redistributed inside the app ZIP.

The electronics and software perspectives retain their agent workflows. Deterministic PCB routing, supplier stock/quotes, ordering and physical fabrication validation remain later work, as the approved plan specified.

## Release acceptance

The Apple silicon package passed ad-hoc signature verification. Its packaged Electron/ASAR worker path passed mesh export/reload (0.19 s), STEP export/reload (2.67 s), and three actual GLB renders (4.70 s), using an isolated data directory.

A real request sent through the installed native UI created **Phase Two Soccer Ball** in a new project. It produced accepted GLB and three static renders, with no design-model call or planner tool calls. Local geometry/validation took 0.49 seconds and rendering 7.11 seconds. The initial run took 47 seconds after queue entry and exposed redundant legacy native probes during Codex connection; that delay was subsequently removed and covered by the protocol regression. The native viewer and Activity showed the correct ball and actual operations. All 155 pre-existing project/artifact hashes matched the pre-install backup; the five existing projects were not regenerated or rewritten.

Final required checks: TypeScript check, 48 automated tests, production build, browser interactions, native UI generation, static-view creative review, independent execution review, packaged worker health checks and signature validation passed. Native STEP verification also passed for all three decorated solid families. The Vite build retains its existing advisory about the large lazy-loaded 3D scene chunk. The app remains an ad-hoc signed developer preview without Apple notarization.

After the connection-probe fix, a native rebuild of the same ball completed in **15.24 seconds**: Astra-high planning 14.74 s, local execution 0.46 s with `geometryCached: true`, zero tools and zero retries. The failed legacy probe timestamp did not change across the ordinary connections. The final installed workshop again reported all three capabilities ready. Settings distinguishes these tested workers from separately discovered custom specialist tools.
