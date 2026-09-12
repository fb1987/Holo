# Phase 2 UX and state contract

Independent implementation review, September 12, 2026. Based on `phase-2-deterministic-workshop.md`, the current App, panels, shared contracts, artifact selection, and scene adapter. This review changes documentation only; it does not operate production projects or invoke models.

## Keep the existing spatial experience

Retain the fixed central stage, top-left project selector, compact bottom prompt, separate perspective/options controls, and optional nonmodal Activity. Add truthful build feedback within those surfaces. Do not introduce another dashboard, automatic panel opening, permanent stage heading, or expanded cockpit.

## 1. Separate processing from delivery

Keep `ChangeRequest.status` compatible with queued/running/completed and existing failed/cancelled records. Add a separate nullable outcome for the requested deliverable contract. `completed` means processing has settled; it is not the green success condition. An outcome remains absent while work is unresolved. Cancellation displays **Stopped**, not a successful result or an unexplained failure.

| Outcome     | Evidence rule                                                                                                  | Example UI text                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `succeeded` | Every required deliverable exists, passes its required checks, and is accepted for the intended specification. | “Model ready” / “Source ready” for an explicit source-only request. |
| `partial`   | At least one requested deliverable is valid and usable; another required deliverable is missing or invalid.    | “Model ready; STEP export blocked.”                                 |
| `blocked`   | A missing capability, access decision, dependency, or clarification prevents the requested result.             | “Model build blocked; source saved.”                                |
| `failed`    | Construction, reload, validation, or publication was attempted and failed without a usable requested result.   | “Model checks failed; showing the previous model.”                  |

Source or an illustration saved incidentally does **not** make an unfulfilled model request partial. Optional presentation-render failure does not downgrade a successful interactive model request. If presentation images were explicitly required, their failure can make the overall result partial. A native crash fails the current attempt; later attempts on that quarantined worker are blocked until a successful recheck.

Persist the requested deliverables/checks, their individual results, a concise reason code/message, and accepted artifact IDs. Derive the displayed summary from those facts rather than agent prose. Legacy records without this evidence display their existing processing status with “Delivery not checked”; do not retroactively certify or reject them.

History currently paints every `completed` request green. Change it to use outcome; put processing detail behind the existing expandable metadata. Activity must include deterministic jobs even when there is no model-run record. Useful operations are “Building 32 panels”, “Checking seams”, and “Reloading model”. Show measured duration and actual counts where available; do not invent percentages or time promises.

## 2. Give the accepted design its own identity

Persist an accepted-design reference independently of the newest request/specification revision: accepted specification identity/hash, design revision, assembly artifact ID/hash, and any compatible scene/component metadata. Candidate source, diagnostics, and failed output belong to an attempt, not the current accepted artifact set.

Publication is atomic: required model checks and artifact reload succeed before replacing the accepted reference and its associated scene. A failed correction must not update `project.scene` into a substitute that hides the accepted assembly. The current latest-domain artifact inference is presentation metadata, not evidence of acceptance.

For an existing accepted design, keep that model visible while a replacement builds. Do not automatically replace it with a coarse candidate. An optional “Preview this change” action in Activity may opt into the candidate; failure or cancellation returns to the accepted model. For a new project with no accepted model, show the provisional candidate as it becomes available.

The viewer must also swap atomically: keep the previous loaded object while the candidate loads; a parse/GPU-load error reports the candidate problem without tripping a permanent whole-scene error boundary. A later valid build can recover without restarting Holo.

Use one durable, compact outcome entry in Activity. When Activity is closed, a short actionable notice above the dock is enough: “Change blocked · previous model kept”. Keep that result available in History after the notice is dismissed. A blank project with failed generation returns to plasma with the failure reason; no unmarked failed candidate remains as the design.

Current files and the default build package refer to accepted outputs. Failed-attempt source and diagnostics remain inspectable from the relevant Activity/History entry and are labeled as such. Export names/manifests distinguish the latest request revision from the accepted model revision; an earlier model must not be packaged as a successful newer correction.

## 3. Refine the same specification

After recipe selection, both coarse and refined geometry carry the same semantic specification hash, recipe/version, units, component IDs, materials, and assembly frame. Resolution is a build profile, not another interpretation of intent. Keep the cheap intent sketch distinct from recipe-generated geometry.

| Stage                  | Display condition                                              | Label                                                                 |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Intent sketch          | No accepted model and intent still unresolved.                 | “First sketch · Provisional”                                          |
| Coarse recipe geometry | Real geometry for the active specification is loadable.        | “Model preview · Refining”                                            |
| Refined candidate      | The same specification has completed its geometry/check stage. | “Checking model” only while checks remain.                            |
| Accepted model         | Required checks pass and accepted state commits.               | Remove the provisional label; report “Model ready” in Activity.       |
| Presentation renders   | Produced later from the accepted artifact.                     | Report rendering independently; keep the interactive model available. |

Preview messages need `projectId`, `jobId/attemptId`, specification hash, and a monotonic generation/sequence. Clear messages need the same ownership fields. The current project-only null clear can erase a newer preview, so ownership applies to clearing as well as replacing. Reject late results after cancellation, supersession, project changes, and acceptance; a late coarse result cannot replace a refined one. On reconnect, hydrate the current owned preview/build state or discard it, never rely on an old in-memory preview alone.

Keep camera orientation, pan, user zoom, and selection across compatible refinements. Use the specification's stable frame/envelope rather than independently normalizing each mesh's bounding box. Select components by stable component ID, not generated mesh index; clear selection only when that component disappears. Avoid incrementing the scene reset key for a fidelity-only replacement.

Rendering evidence records its source model artifact/hash. Distinguish illustrations, model-derived renders, and check reports; the current inference that any image is a render is insufficient. “Mesh checks passed” describes its actual scope; it does not imply fabrication, electronics, or supplier approval.

## 4. Worker health and scoped access

Replace optimistic tool-presence booleans in Settings with operation capabilities: **Interactive mesh**, **Solid CAD / STEP**, and **Presentation rendering**. A compact row shows Not checked, Checking, Ready, or Unavailable, with expandable backend/version, last exact-path smoke result/time, failure reason, and Recheck. Busy/queued is job state, not a health failure. A missing renderer must not disable a healthy mesh worker.

Ready requires the actual worker path's build/export/reload smoke evidence; installed executables or import alone are not sufficient. A worker crash quarantines that backend/version for this session. Explicit Recheck can restore it; ordinary project activity does not silently repeat the crash probe. Missing legacy health evidence starts as Not checked.

Add **Run built-in recipes automatically** in Settings, backed by server-persisted policy and broker enforcement. Supporting copy: “Local builds and exports from Holo's reviewed recipe library.” The permission covers the reviewed recipe/version, validated parameters, declared input handles, and project-local output budget. It grants no arbitrary shell/Python, imported recipe execution, network access, or unrelated filesystem access. Those remain separate approval/extension paths.

When automatic execution is off, request permission once for the bounded recipe job, not for each internal subprocess. Show the recipe, purpose, and resulting files. Record the effective policy at dispatch; queued jobs re-evaluate the current policy, while already running jobs keep their declared scope. Worker availability and permission state remain distinct: allowing a recipe does not make a broken backend healthy.

## Acceptance cases

1. A model request saves source but no loadable assembly: no success indication; source is inspectable as an attempt; the previous model/export set remains current.
2. An explicit source-only request produces the requested source: it can succeed without a GLB.
3. A required GLB succeeds and a required STEP fails: partial result identifies both outputs; the valid GLB remains usable. Failure of an optional render leaves model success intact.
4. Force a worker crash and then submit again: first attempt fails, later attempt is blocked with one clear reason; there is no automatic repair loop or repeated subprocess approval.
5. Correct an existing model, then cancel or fail validation: the last accepted geometry, camera pose, current files, and accepted revision remain unchanged.
6. Submit a new supported soccer-ball request: coarse and refined views use one specification, retain the 12-pentagon/20-hexagon identity, and clear provisional status only after acceptance.
7. Select a panel and orbit while refinement finishes: the same panel and pose persist; only removal of that component clears the selection.
8. Deliver preview/clear messages out of order and from a cancelled job: neither can replace or erase the newer owned preview/model.
9. Fail candidate parsing in the viewer, then provide a valid replacement: the previous loaded model stays available and the viewer recovers.
10. Restart/reconnect during a build: queued/running/result state and accepted geometry are restored without a stale preview claiming success.
11. Disable presentation rendering while mesh health is Ready: normal model generation remains enabled and its outcome is accurate.
12. Toggle built-in recipe access: the broker follows persisted policy, one approval covers a bounded job when needed, and imported/custom code does not inherit that allowance.
13. Open an old project: unprobed capabilities and unchecked historical deliveries are labeled honestly without modifying its geometry or manufacturing readiness.
14. At 680 × 620 and normal desktop size, Activity remains optional/nonmodal, the prompt stays usable, long failure reasons wrap, and progress does not steal focus or a reader's scroll position. Reduced-motion behavior remains intact.

These are implementation gates, not claims that phase-two behavior is already present. The first release should prioritize state/acceptance, owned previews, accurate worker health, and the soccer-ball path; additional navigation or visualization modes are unnecessary for that milestone.

## Native soccer-ball render review

Reviewed the actual `front.png`, `rear.png`, and `oblique.png` from the temporary `holo-native-benchmark-ntzZoy/paneled-ball` output on September 12, 2026, using direct image inspection. No image was edited and the production app was not operated.

**Initial assessment (superseded by the accepted revision below): recognizable geometry; presentation acceptance needs another pass.** All three views clearly read as a classic soccer ball. The visible pentagons/hexagons meet at coherent boundaries, and the overall silhouette is spherical. There is no large backing layer visibly covering the panel pattern as in the earlier failed design. Image inspection alone does not certify the complete 12/20 counts, adjacency, export correctness, or fabrication suitability.

| Priority                                             | Finding                                                                                                                                                                                                                                                                 | Required response                                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blocker for presentation and visual-check acceptance | Large white regions clip to featureless white. In the front/oblique views, central white panels become close to background gray, while several black pentagons in the rear wash out to gray. This makes material identity and surface shape inconsistent between views. | Produce another controlled render set with preserved highlight detail, a neutral diffuse light setup, and a matte or moderately rough ball material. Verify the exported material interpretation; do not assume light intensity alone is responsible.                      |
| Check before declaring panel-curvature acceptance    | The shell is round, but strong face-by-face glossy gradients and abrupt shading changes make individual curved panel surfaces difficult to judge. Some large panel interiors read nearly flat.                                                                          | Inspect normal interpolation, material assignments, and any view-dependent shading with the neutral render. Confirm sphere-projected panel curvature separately in geometry checks. These images do not prove an inverted-normal defect, but they also do not rule it out. |
| Polish / targeted seam check                         | Small silhouette nicks and gray slivers appear at several perimeter panel junctions. They are minor at the current image scale and do not establish gross backing occlusion.                                                                                            | Inspect the exported mesh near the silhouette to distinguish intentional seam/backing visibility from coarse tessellation or incomplete coverage. Keep intentional seam width consistent and reduce visible contour stepping if present.                                   |

The current glossy appearance resembles coated or metallic material more than a softly lit sports ball. Removing highlight clipping and stabilizing black/white appearance is the immediate priority; adding textures, logos, a valve, decorative lighting, or a new UI is unnecessary. Keep the current framing and background while fixing the render so the before/after comparison isolates the actual change.

Acceptance for the next visual pass: front/rear/oblique all retain clearly black pentagons and white hexagons; highlights preserve surface detail; curved panel surfaces can be judged; no backing obscures a face; and the small perimeter gaps read as controlled seams. A successful image review supports the deterministic geometry evidence, rather than replacing it.

### Revised render acceptance

Re-inspected all three views from `holo-native-benchmark-D7wQqw/paneled-ball` after the lighting reduction and surface/sidewall tessellation alignment.

**The visual blocker is resolved.** Front, rear, and oblique views now retain clear black pentagons and white hexagons. The white surfaces have useful tonal gradients rather than the earlier broad highlight clipping and near-background gray patches. Black panels stay recognizably dark in every view. Curved panel surfaces and the spherical shell read coherently, with a matte appearance rather than the earlier metallic-looking patchwork. Panel junctions are cleaner, and no visible backing layer obscures a face.

Remaining polish is minor: the lower silhouette has relatively low contrast against the gray background, and a few perimeter junctions retain small contour transitions at this image scale. Neither prevents recognition, material assessment, or inspection of the panel layout. A slightly more contrasting neutral background can improve future presentation without altering geometry.

This revised set passes visual acceptance for the deterministic soccer-ball milestone. It supports the separate topology, normals/material, reload, and dimensional checks; image inspection does not replace those checks or establish fabrication suitability. No further visual blocker was observed in these three views. This review edited documentation only and did not operate the production app.
