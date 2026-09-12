# Phase 2 execution review

Independent review on September 12, 2026, during implementation of `codex/deterministic-workshop`. Scope: typed design requests, recipe geometry, worker and cache ownership, candidate acceptance, cancellation, native adapters and validation. No production projects were changed and no paid model calls were made. Engine integration and packaging were still in progress; unfinished integration is not treated as a defect below.

**Final bounded code recheck: no remaining release blocker found in the reviewed lifecycle, cache, acceptance and export paths.** The original findings and intermediate rechecks below are retained as an audit trail. Installed-app operation and native visual quality have separate validation owners. See the final status section for evidence and remaining validation limits.

## Original findings

### P1 — Shared output directories can be replaced while another build consumes them

`BuildBroker.build` originally allowed two identical output keys to build concurrently in its two-slot queue. Both could miss the cache, then remove and rename the same final directory. The returned directory also served as the native adapter's writable working directory. A second build or pruning could therefore remove a model while its preview, artifact acceptance, STEP exporter or renderer was using it.

Serialize or deduplicate by content key, keep published cache entries immutable, and give consumers explicit ownership until acceptance finishes. Native exports need private working directories. Pruning must exclude leased entries, including geometry data in use. A same-key concurrent-build test should verify both consumers can complete without missing files or replacing one another's outputs.

### P1 — Closed geometry and outer dimensions do not establish recipe correctness

`validateGLB` initially checked non-ball recipes for closed positive-volume meshes and the requested outer envelope, without checking their required features. An isolated adversarial fixture serialized a plain solid 240 × 300 × 180 mm cube named `container-body`, with the expected material and specification hash. The validator returned `valid: true` and all nine checks passed. It contained no cavity, taper, rim or rounded corners.

Add independent checks on the exported geometry for expected component identities and count, open container cavity and floor/wall probes, enclosure body/lid and requested holes/features, and the cradle's usable device envelope. Include known-invalid fixtures such as a filled container, missing lid and blocked cradle. For the ball, logical topology in GLB extras must be linked to actual panel boundaries and measured seam clearance rather than trusted as a generator assertion alone.

### P2 — Mandatory coarse geometry rejects supported ball parameters

The fixed coarse subdivision count can put panel triangle interiors beneath the seam backing. Direct in-memory build/export/reload checks found:

| Diameter | Seam depth | Coarse                 | Refined |
| -------- | ---------- | ---------------------- | ------- |
| 220 mm   | 0.1 mm     | Fails spherical-panels | Passes  |
| 1000 mm  | 0.8 mm     | Fails spherical-panels | Passes  |
| 1000 mm  | 0.1 mm     | Fails spherical-panels | Passes  |
| 20 mm    | 0.1 mm     | Passes                 | Passes  |

All combinations pass request normalization. Because `Workshop.execute` awaited coarse success before refined, a valid final result was unreachable. Choose a minimum tessellation from radius/seam depth, or skip an invalid provisional level and continue to refined. Never publish the invalid coarse mesh.

### P2 — A cache hit is not a worker health probe

`BuildBroker.probe` originally called the ordinary cached build path. Once a probe artifact existed, a missing or crashing worker could still be reported as having passed the production export/reload path. Health checks must force fresh worker execution. Native adapter versions should be checked against the pinned runtime versions, rather than inferred solely from their installation directory names.

### P2 — Validate complete output sets and the accepting design identity

The original cache-hit path validated only `assembly.glb`; required STL and supporting request/validation files were not checked. Missing or corrupt required files could cause repeated accepted cache hits followed by failed artifact registration. Validate hashes and presence of the complete output manifest and rebuild incomplete entries.

The native finalizer originally attached its captured result's STEP/renders to the current accepted design without verifying that the accepted specification hash and assembly ID still matched. Keep that identity check at the publication boundary, even when the orchestration barrier is expected to serialize design changes.

### P2 — Native render labels use the wrong coordinate frame

Holo GLB is +Y-up; Blender's glTF import converts this into Blender's +Z-up frame. The original `render_worker.py` camera directions labeled `(0, 0.1, 3)` as front and `(0, 0.1, -3)` as rear, which produce largely top and bottom views in Blender. Author front/rear/oblique camera directions in the imported model's Blender frame, and verify an asymmetric fixture with a clear front feature.

## Enclosure geometry diagnosis

The lid's annular tongue ended exactly where the lid began, creating a coplanar contact surface in the Boolean union. Direct kernel inspection found six coarse and eighteen refined welded edges with four incident triangles at the contact seam. The kernel still reported `NoError`; independent edge validation correctly rejected it.

An isolated experiment extended the tongue's outer extrusion 0.02 mm into the lid while preserving its bottom position and using the existing taller inner cutter. Both coarse and refined then had zero invalid welded edges. Apply the overlap in the shared solid plan so mesh and STEP remain consistent; the overall assembly envelope does not change. No source was edited by this reviewer to run the experiment.

## Additional delivery checks

- Require own-property membership when accepting parameter names from the registry, so inherited names such as `constructor` cannot pass the declared unknown-parameter check.
- Confirm the installed package contains executable workers, trusted recipe sources and usable pinned adapter paths; source-tree checks alone cannot establish installed capability.
- Include an actually resolvable recipe/dependency lock and rebuild instructions in exported packages. A recipe name and version string by themselves do not preserve the implementation needed for reproduction.
- Document and test cancellation cleanup and cache retention. The renderer and CAD process limits bound time and individual output size; memory ceilings and total scratch/cache retention need separate evidence.

The worker interface has a useful narrow boundary: it accepts normalized parameters and reviewed recipe operations rather than arbitrary project code or shell commands. Cancellation is propagated into queued work and running processes. Acceptance uses candidate project state, and the last accepted assembly can remain intact when geometry construction fails. These properties should be retained while resolving the findings above.

## Recheck status

Findings were sent to the implementation agent as they were established. Fixes are in progress; this document is an initial review, not a release sign-off. Final recheck should record the fixes and resulting regression evidence here.

### Implementation recheck

The following fixes are now present in source: per-output-key serialization; private leased consumer directories; native exports in independent scratch directories returned as bytes; complete required-file cache manifests; forced worker execution during health probes; native runtime-version checks; accepted specification/assembly checks before native publication; exported-triangle occupancy checks for mechanical recipes; adaptive ball tessellation; the enclosure tongue overlap; and Blender-space camera directions. Export includes a bundled rebuild implementation, editable source and pinned dependency files. The focused workshop suite passed **8/8 tests** after the lease changes, including the filled-cube rejection, concurrent identical builds, missing-output repair, actual process cancellation and forced health probe.

The initial ball-boundary concern is only partially covered: the validator checks panel counts, adjacency, radial position, visible area, winding and placement, but it does not independently measure the requested seam width. This remains a validation limit; avoid describing the report as full dimensional verification of every recipe feature.

New issues found while reviewing the integrated orchestration:

1. **Native work can outlive a failed job without ownership.** `Workshop.execute` starts native work, but `StudioEngine.drain` skips its returned finalizer when another specialist rejects. The job leaves the active map while those processes continue on its un-aborted signal; cancellation can no longer reach them and successful files are not registered. A per-job child controller and an unconditional finalization/cancellation barrier should retain ownership until this work stops or its useful results are committed.
2. **Typed builds override declared dependencies.** The engine initially validated the dependency graph, then unconditionally executed a typed design before all specialist layers and removed design from the graph. A valid declaration such as design requiring electronics was silently ignored. Schedule the deterministic node in its actual layer, or explicitly reject dependencies that the immediate-build contract cannot honor.
3. **A failed final correction can retain an earlier success outcome.** The first typed build sets `change.outcome` before arbitration. If a later authorized custom correction returns only source or diagnostics, the model remains unchanged and the final check is skipped because an outcome already exists. Track the correction's required output against its own start revision; preserve the usable model but report partial when the correction did not produce the requested replacement.
4. **Two remaining cache races.** Geometry temporary names used process ID plus millisecond time, which can collide for concurrent material variants sharing a geometry key. Use a unique random/scratch identifier. Pruning checked active pins only before asynchronous directory scanning; a build admitted during that scan could still lose its cache entry. Serialize maintenance with admission or recheck ownership immediately before each deletion.

These findings have been sent to the implementation agent. No application code was edited by this reviewer. This recheck does not establish installed-app or native-render performance; those checks are being performed separately.

### Final status

The integrated-orchestration findings are resolved in the reviewed source:

- Each queued request owns a child abort controller. The engine aborts remaining children and awaits the idempotent native finalizer before releasing job ownership, including after a sibling failure.
- Typed design construction now runs when the design node is reached in the declared dependency layers. Hardware prerequisites complete before that node is accepted.
- Final custom corrections are checked against their own starting revision. A missing corrected model produces partial or failed outcome while preserving the earlier accepted model.
- Geometry publication uses UUID temporary paths. Cache maintenance establishes an admission barrier and checks pins before deletion. Consumers retain independent leased snapshots until disposal.
- Each accepted deterministic design records an immutable recipe-source package artifact. Exports read that accepted snapshot, validate package paths and bounds, and include the captured implementation and dependency locks rather than silently substituting a later installed recipe.

This reviewer independently reran the three targeted integration regressions for dependency/native-worker ownership, failed final corrections, and exported-package rebuilding: **3/3 passed**. The exported rebuild test reproduces the accepted GLB byte-for-byte using its captured package. Together with the earlier independently run **8/8 workshop tests**, this addresses the concrete code defects raised by this review. The implementation agent separately reported the full **47-test** suite passing.

No new material lifecycle, cache or export defect was found in this final bounded pass. Recipe validation still has the stated scope: sampled structural occupancy, topology, surface, color and dimension checks are useful evidence, not complete metrology or fabrication certification. In particular, the current ball validator does not independently measure every seam width. This limitation remains documented and is not presented as a manufacturing guarantee.

### Additional release verification by the implementation agent

The final surface-detail matrix exposed Manifold 3.5.3's scalar `scaleTop` conversion to a zero Y scale despite the TypeScript signature accepting a number. Mesh extrusion now passes an explicit two-axis vector. Independent exported-triangle checks inspect all four container/enclosure walls at three heights. The shared detail matrix passes for recessed grooves and inset raised ribs, and the actual CAD adapter exported/reloaded all three decorated solid families.

Shutdown now awaits active request drains and owns/cancels health probes. Native cache identity includes the adapter source hash. A native-app acceptance run exposed repeated failed legacy Blender import probes on ordinary Codex connections; failed probe results are now cached and only explicit settings refresh retries them. The protocol regression confirms ordinary connections leave the failed probe count unchanged and explicit refresh updates it. The final full suite passes **48/48 tests**.
