# Phase 2 — a deterministic workshop

Status: implemented for Holo 0.2.0, September 12, 2026. See [implementation and acceptance evidence](phase-2-implementation.md). The original investigation below did not modify the installed app or the user's soccer-ball project.

## Why the soccer ball failed

Inspection of the saved project, generator, runtime diagnostics and tool-event logs found four different failures:

1. **The capability probe runs in a different execution context.** Holo's host probe reports successful bpy import, while the design agent reports exit 139 during import in its restricted execution context. A fresh, bounded host-side import succeeded in 0.89 seconds with Blender 5.2.1 LTS. The logs include a USD cache-line assertion warning. This strongly points to an execution-context incompatibility; the precise native crash cause has not been established with a crash backtrace. Reinstalling Blender or increasing model depth is not yet a justified fix.
2. **Names substitute for geometry.** Revision 6 declares three coincident 220 mm spheres: a white shell, a sphere named 20 white hexagons, and a sphere named 12 black pentagons. Its seam network is one torus. The renderer correctly draws those declared primitives. The black layer can obscure the white layers; no panel topology exists in the displayed scene. Descriptive claims are not executable modeling instructions.
3. **The unexecuted source still has defects.** The generator distributes polygon patches around independently chosen directions instead of deriving a shared soccer-panel topology; three great circles substitute for seams. It calls `bpy.ops.wm.glTF_export`, while inspection of the installed runtime finds the glTF exporter under `bpy.ops.export_scene.gltf`. Merely resolving the import crash would not make this script a trustworthy soccer-ball model. Its separately authored multi-angle SVG is not verification of exported geometry.
4. **Completion checks the agent transaction, not the requested deliverable.** No primary assembly or actual GLB/STL/Blender output was registered. Source and illustrations were saved and the change became completed. The messages do disclose missing binary exports, but the user-facing workflow still suggests a finished design correction.

The response to each failure needs a different mechanism: a tested execution path, richer geometry operations, executable recipes, and evidence-based completion.

## Architectural decision

Keep Holo's spatial UI and specialist responsibilities. Move routine construction, exports and checks out of free-form agent scripts into an application-owned build system.

`User intent → planner → typed design change → specialist recipe selection → deterministic build → independent checks → accepted model → presentation renders`

The agent supplies intent, parameter choices and exceptional design judgment. The application owns routine geometry algorithms, environment setup, file paths, exporter calls, validation and publication. A standard recipe should require no generated Python or shell commands during normal use. Unsupported inventions can still require new algorithms; those extensions are developed and tested before joining the trusted library.

## 2A — reliable execution and honest outcomes

Create a local tool broker and short-lived workers. A worker receives a validated recipe ID/version, parameters, input artifact IDs and output profile. It does not accept arbitrary shell strings or arbitrary Python disguised as a recipe.

- Pin engine/dependency versions and provision an app-owned environment independent of another project's virtualenv. Start with the existing environment as a diagnostic reference, not a permanent distribution dependency.
- Exercise import, tiny geometry creation, material assignment, GLB export, reload and one render through **the exact worker path used for builds**. Report separate mesh, CAD and rendering capabilities, not one optimistic Blender flag.
- Identify whether the native issue is specific to the current bpy wheel/restricted context. Evaluate a pinned Blender background executable against the wheel using the same smoke fixture. Choose from those results; a background executable alone is not a promised cure.
- Run installed, reviewed recipe code with explicit input/output handles, constrained job directories, no network requirement, bounded process time, memory/disk budgets and capped logs. Keep tool access narrower than giving the agent general machine access. User access settings may allow routine trusted local recipe jobs; new custom code or broader access remains a separate path.
- Treat a crashed backend as unavailable for this session/version until re-probed. Do not ask every agent to rediscover the same crash. Retry only a classified transient failure, with a small fixed limit.
- Track processing state separately from deliverable outcome: queued/running/stopped and succeeded/partial/blocked/failed. A request for a model requires a loadable model; a deliberate source-only request has a different output contract.
- Preserve the last accepted assembly when a correction fails. Keep failed candidate source and diagnostics inspectable without making them the current design. Display an accurate reason, such as “Model build blocked; source saved.”

Exit criterion: a forced worker crash cannot mark a model request successful, overwrite the last good assembly, or trigger an unbounded repair loop. Trusted recipe operations can run through the chosen worker path without repeatedly requesting permission for individual subprocess steps.

## 2B — a shared design specification and reusable recipes

Use a versioned, typed intermediate representation rather than prose-labeled primitives. Start with a small contract, not a general replacement for CAD:

- Units and axes, dimensions, materials and stable component IDs.
- Recipe identity/version and bounded parameters.
- Geometry operations and shared topology where required.
- Assembly transforms and mating/reference interfaces.
- Required deliverables and checks for the user's task.
- Declared dependencies and build provenance.

A recipe contains its parameter schema, implementation, preview strategy, supported exports, validation rules, reference fixtures and license. Library edits create versions; existing projects retain their original version. Every exported build package includes its recipe/specification, versioned editable implementation or resolvable dependency lock, assets and rebuild instructions.

First reusable families:

| Family             | Reusable behavior                                                                                  | First examples                                    |
| ------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Paneled surfaces   | Shared polygon topology, spherical projection, panel offsets, seam boundaries, material assignment | Classic soccer ball; later other paneled surfaces |
| Hollow containers  | Wall/base thickness, taper, opening, rim, rounding                                                 | Recycling bin, cup, tray                          |
| Enclosures         | Split body/lid, standoffs, bosses, vents, fasteners                                                | Small controller case                             |
| Mounts and cradles | Fit envelopes, clearance, retention, attachment patterns                                           | Portrait phone cradle, bracket                    |
| Surface detail     | Repeated motifs, emboss/deboss, grooves                                                            | Bin decoration, grip/detail patterns              |

These are composable operations and recipes, not a list of hard-coded finished products. A soccer recipe is useful as a demanding first test, but a larger example library without shared algorithms would reproduce the original problem.

Recommended backend roles:

- A lightweight mesh path produces real interactive geometry and GLB without requiring Blender for every model. Evaluate a shared TypeScript mesh kernel with Holo's renderer and deterministic topology helpers; use established libraries for serialization and checks rather than hand-writing formats.
- A single solid-CAD adapter supports dimensional mechanical parts and STEP, likely CadQuery/OpenCascade. CadQuery is designed for parametric, GUI-less modeling and CAD exports: [official introduction](https://cadquery.readthedocs.io/en/stable/intro.html).
- Blender handles presentation rendering and workflows that actually need its modeling tools, behind a tested adapter. Agents never guess exporter API names.
- Trimesh is a candidate for independent mesh inspection/reload and GLB handling: [mesh API](https://trimesh.org/trimesh.html), [GLB export and reload](https://trimesh.org/trimesh.exchange.gltf.html). Watertightness is one property, not a certificate of manufacturability.

Do not integrate several competing CAD stacks initially. Version-pin the selected adapters after smoke tests on this Mac. Review redistribution licenses before bundling engines or third-party recipe assets.

## 2C — progressive fidelity from one design

Keep the successful early visual feedback, but make subsequent levels refine a shared recipe/specification:

1. While intent is unresolved, the existing cheap sketch may remain explicitly provisional.
2. Once a supported recipe is selected, build its low-resolution **real geometry** immediately. This is the same topology/parameter set as the detailed model, not a second model inventing a substitute.
3. Rebuild only the necessary geometry at higher resolution, including seams, bevels and materials. Show it as soon as geometry checks pass.
4. Produce polished images from the accepted model in the background. Rendering failure must not hide an already valid interactive mesh.

Use the same artifact for the app's viewer and verification views. Separate source-code authorship, illustrative SVGs, actual model renders and engineering checks in the evidence contract. A written description cannot promote a sketch to a verified model.

Version the active request and specification; discard late results from superseded jobs. Preserve camera orientation and stable selection across compatible refinements. Avoid arbitrary 10s/60s/3min replacement timers: actual completed work should determine the transition.

Initial performance **targets**, to validate on representative tasks: supported low-resolution geometry in under 1 second after parameters are available; refined common geometry in roughly 1–5 seconds; presentation images later without blocking interaction. These exclude model planning and do not apply to arbitrary complex CAD. Measure distributions before advertising guarantees.

## 2D — validation and the soccer-ball acceptance test

Checks read the actual generated/exported artifact, not just agent assertions or object names.

For a classic 220 mm black-and-white soccer ball, require:

- A tested 32-panel layout with 12 pentagons and 20 hexagons, generated from shared topology. Validate logical face boundaries and adjacency before tessellation; increasing mesh resolution must not change panel counts.
- Spherical panel surfaces, consistent outward normals, bounded diameter and seam gaps/depth. Ensure backing geometry cannot obscure panel faces. Use boundaries between neighboring panels to derive seams.
- White/black material assignments preserved on GLB reload, with no valve when the request excludes it.
- Front, rear and oblique views rendered from the exported model through a controlled fixture, including the same display path/material assumptions used in Holo. Automated checks catch gross missing/occluded colors; image review checks the perceptual result. Neither alone establishes full correctness.
- Repeated builds produce equivalent topology and geometry within declared numeric tolerances. Byte-identical rendering across hardware is not required.
- A change of diameter updates shape scale without silently changing panel layout. A color-only change does not rebuild topology or trigger hardware/software work.
- If fabrication is requested, separately check the exported fabrication bodies, intersections and relevant dimensional properties. A high-fidelity visual soccer ball is not thereby a designed inflatable sports product.

For other recipes add fit/clearance, expected-component and engineering checks appropriate to that recipe. Do not apply closed-solid tests blindly to intentionally open surface models. Preserve independent validators and known-invalid fixtures so the generator cannot merely repeat its own assumptions as a test.

Exit criterion: a standard soccer-ball request builds without newly generated source, renders with the intended visible pattern, survives exports/reloads and controlled edits, and reports failed or blocked when required evidence is missing.

## 2E — dependency-aware orchestration and bounded repairs

After the vertical build path works, introduce a dependency graph instead of blanket serial turns or indiscriminate parallel workers.

- Agents consume immutable input revisions and publish proposals/results. Commit accepted results atomically through the planner's intent/constraint policy.
- Run independent recipe builds, component lookups and checks concurrently, subject to CPU/GPU and memory limits. Rendering uses a small separate queue; more workers can slow a laptop down.
- Use declared interfaces to decide dependencies. Software may draft against an approved hardware interface while mechanical details are refined; incompatible hardware changes invalidate dependent results.
- Cache geometry using normalized parameters, recipe version, dependencies, units and engine version. Cache rendering separately using geometry/material/camera/lighting settings. Rebuild only changed dependencies.
- Retain Astra planning and Luna execution as the current policy. Routine deterministic recipe jobs do not need an additional model call merely to run a tool. Escalate actual unresolved design judgment to a stronger model using a compact failure report, not the entire task from scratch.
- Classify failures: invalid parameters → targeted correction; unavailable backend → capability handling; geometry check failure → bounded recipe repair; ambiguous intent → planner; provider failure → bounded retry. Persistent native crashes must not become repeated model debugging tasks.
- A missing capability enters a contained extension workflow: implement a reusable operation, test boundary cases and exports, review it, then admit a new recipe version. Do not automatically promote arbitrary generated code into the trusted runner.

## Implementation slices and acceptance gates

| Order | Deliverable                                                         | Evidence required before advancing                                                                                      |
| ----- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1     | Worker broker, end-to-end health probe, truthful deliverable states | Cube with materials exports/reloads through real installed path; induced crashes handled correctly                      |
| 2     | Shared specification plus first soccer-ball recipe                  | Correct panels/materials/seams; visible result in Holo; no generated source on normal runs                              |
| 3     | One-model progressive fidelity and independent validation           | Fast coarse model becomes detailed model without inventing a different object; export/view parity; cancellation tests   |
| 4     | Container/enclosure/cradle recipes and versioned package convention | Reproduce the bin and a controller enclosure; parameter-range and fit tests; reproducible exported package              |
| 5     | Dependency scheduling, caching and targeted repair                  | Color/dimension/interface edits invalidate only the right jobs; speed/quality benchmarks and bounded resource use       |
| Later | Deterministic electronics/software adapters                         | Selected component envelopes, connector/pin contracts, BOM provenance, firmware templates and real tool-specific checks |

Keep UI change scope small: accurate build state and useful operation-level Activity such as “Building 32 panels”, “Checking seams”, “Exporting assembly”. Broader electronics routing and supplier integration should not block fixing the design foundation.

## Build/package convention

A proposed project-local layout (additive migration; preserve existing artifact history):

```
intent/brief.json
spec/design.json
spec/interfaces.json
recipes/lock.json
builds/<content-key>/request.json
builds/<content-key>/result.json
builds/<content-key>/validation.json
builds/<content-key>/assembly.glb
builds/<content-key>/renders/
artifacts/<accepted-revision>/...
```

Application source modules can begin as `server/tools/{broker,health,workers}`, `shared/design`, `recipes/{panels,containers,enclosures}`, `server/build/{graph,cache,validate}` and a viewer adapter. The exact package/module names are implementation choices; the boundary between intent, deterministic construction, candidate evidence and accepted deliverables is the essential contract.

Build scratch space and caches need explicit quotas, cancellation cleanup and bounded retention. Reuse immutable blobs/references rather than copying entire workspaces for every preview. Keep accepted outputs and user exports until the user removes them; prune only reconstructible cache data under a documented policy.

## Decision to make concrete first

The first phase-two milestone should be a trustworthy soccer ball produced through a reusable build path, including a deliberately broken-worker test. That demonstrates the architectural improvement directly. It also gives us a repeatable benchmark for the later recipe library and orchestration work, rather than relying on more convincing agent descriptions.
