# Holo creative and experience review

Review date: 2026-09-11. Reviewer: independent creative-direction agent.

## Final visual recheck — supersedes initial outcome

Revisited the running app in a fresh Chrome tab after the scene and interface refinements. Created a fresh graphite wheel reference and a blank idea through the UI. Rechecked Plan, Software, an actual example software artifact, Electronics, flat board, exploded assembly, drag and click behavior, export presentation, and the flame. The viewport remained 1461×836. No AI request was submitted and no export was downloaded. The app was still receiving live development updates, so this is an observed review of those UI states rather than a claim about a frozen release binary.

**Outcome: the main visual and interaction blockers from the first review are resolved. The assessed creative score is now approximately 4.3/5.** Holo meets the proposed creative bar for an immediately explorable invention-studio prototype in the reviewed desktop viewport. This is not a sign-off on engineering validation, live agent reliability, narrow-window layouts, or the complete prompt-to-manufacturing workflow; those were not exercised by this reviewer.

| Dimension                     | Final score         | Actual recheck evidence                                                                                                                                                                               |
| ----------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idea continuity               | 4.5                 | Graphite wheel remains the focal artifact through workstation changes; Software keeps its silhouette behind the glass behavior surface                                                                |
| Spatial navigation            | 4                   | Workstation and assembly changes settle into deliberate poses; drag orbit does not accidentally select a part; continuous frame rate remains unmeasured                                               |
| Visual authorship             | 4.5                 | Warm filament spine, coherent flame silhouette, restrained graphite material, calm lighting, and spatial evidence produce a recognizable studio identity                                              |
| Bottom cockpit                | 4.5                 | Prompt and primary controls remain stable at the bottom, zoom controls are available, and export action/readiness stay together in the tray footer                                                    |
| Useful perspectives           | 4                   | Plan shows the example's actual intent; Software shows a proposed behavior chain and links to a real conceptual file; Electronics reveals circuitry; Design explains assembly                         |
| Exploration                   | 4.5                 | Explode immediately reveals front/board/rear; the board fits in a predictable landscape orientation; dragging does not select; a deliberate display click still selects                               |
| Intent to consequence         | Not scored          | No live model request submitted in either review                                                                                                                                                      |
| Trust                         | 4.5                 | Software surface says “Example behaviour · Proposed,” its real file explicitly says conceptual and untested as firmware, dimensions say Product envelope, and package sections use neutral file icons |
| Legibility                    | 4                   | Canonical wheel, board, explosion, and flame views fit without heading or cockpit collisions; Electronics can still benefit from slightly stronger illumination                                       |
| Accessibility and performance | 4 for tested access | Prior Escape, keyboard, and reduced-motion checks passed; the false WebGL fallback announcement is replaced by an interactive-model description; no performance or narrow-layout certification        |

Resolution of the first review's findings:

- **Distinct perspectives:** resolved for the reference experience. Plan displays “Explore a compact simulator steering wheel with configurable controls.” Software shows `Push button → Controller digital input → Button mapping → USB HID button → Simulator action`, clearly marked as proposed. “Open the work” opened the actual revision-zero `behavior.ts` content, with example mappings and an explicit note that pins, electrical interfaces, descriptors, and debounce are unassigned.
- **Electronics transparency:** resolved in the observed wheel. The shell is ghosted and the board/traces are visible inside its silhouette.
- **Canonical framing:** resolved in the reviewed viewport. The wheel clears its heading; the board is fully visible in landscape around y=234–444; the exploded structure fits around y=213–520; the flame fits around y=240–545. These are approximate screenshot coordinates, not responsive-layout guarantees.
- **Orbit versus selection:** resolved. A drag across the wheel changed the viewing angle without adding a selection; a subsequent deliberate display click selected `display`.
- **Exploded assembly:** resolved. The default exploded pose immediately exposes separate front, circuit-board, and rear-housing layers, aided by subtle assembly lines.
- **Flame identity:** substantially improved. It now has a concentrated warm spine and recognizable upward silhouette, retains colored filament edges, and no longer intersects the heading or upper viewport.
- **Package presentation:** resolved. Neutral file icons replace completion checkmarks, four example artifacts are listed, and the visible fixed footer puts the “Prepared for review” qualification directly above Export build package.

Optional refinements that remain worthwhile:

1. Increase board and rim illumination slightly in ghost Electronics mode so the spatial silhouette remains clear on dimmer displays.
2. For a newly created blank idea, retain the welcoming “What would you like to make?” heading until the user provides a name; “Untitled invention” is accurate but less inviting.
3. Develop a more continuous assembly-to-board unfold transition and richer links between selected physical parts and their behavior evidence. The current usable board mode remains a scene replacement.
4. Continue improving text density and short-window handling as more project data accumulates. The current Software example surface and code viewer are useful but will need content-aware limits for much larger contracts/files.

The original review below is retained as the iteration record. Its unresolved-language and initial scores describe the earlier build and should be read alongside the final results above.

## Scope and method

Reviewed the actual app at `http://127.0.0.1:4317/` in a separate Chrome tab with a 1461×836 content viewport. Used live mouse, drag, keyboard, and checkbox interactions, with initial and settled screenshots. Reviewed the initial flame, steering-wheel reference project, all four workstations, exploded assembly, board view, and the parts, intent, software, build-package, and settings trays. Inspected scene source only to clarify observed behavior. No production UI code was changed, no model requests were submitted, and no build package was exported.

The app received live updates during this review. Initial title/artifact overlap was reported immediately; later screenshots showed the wheel clearing the title after the root agent changed camera framing and added zoom buttons. Findings below distinguish that observed improvement from remaining issues. Frame rate and continuous motion smoothness were not instrumented. A narrower viewport and a real agent error/busy state were outside this review's tested scope.

## Initial assessment

Holo already has a recognizable and coherent visual foundation: a continuous dark stage, a physical focal object, one restrained bottom cockpit, and a direct invitation to make something. It avoids the usual dashboard and robot-avatar vocabulary. The project remains legible as the same idea while switching stations, and the floating controls feel like a studio rather than a portal.

The next quality threshold is **making the perspectives reveal distinct information**, not merely a different camera angle. In the reviewed sample, Plan and Software largely show the same wheel with different text; their contextual trays are mostly empty. Electronics does offer a board view, but its main view did not visibly make the enclosure transparent. Those gaps matter more than additional bloom or animation.

The implementation is promising and immediately explorable. It does not yet meet the creative-direction document's proposed 4/5 release bar across assessed dimensions. The priority should be a richer truthful reference project and reliable framing/evidence layers.

## Initial scores

Scores refer to observed experience, with 1 meaning missing and 5 meaning excellent. Untested areas are not assigned an invented score.

| Dimension                     | Score               | Evidence                                                                                                                                                                                     |
| ----------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idea continuity               | 4                   | Same named wheel remains present through ordinary station changes; the PCB view replaces it abruptly rather than unfolding from an identifiable component                                    |
| Spatial navigation            | 3.5                 | Camera interpolates to useful different views without page replacement; user orbit also accidentally selected a part, and board-to-software travel passes through an awkward steep angle     |
| Visual authorship             | 4                   | Confident dark stage, considered color and material lighting, restrained cockpit; flame currently resembles translucent line cloth more than concentrated fire                               |
| Bottom cockpit                | 4.5                 | Persistent controls are correctly anchored below the stage; coherent hierarchy; supporting labels and secondary actions remain small                                                         |
| Useful perspectives           | 2.5                 | Design exploration works; board mode adds useful differentiation; Plan and Software need distinct in-scene evidence; main Electronics view stays visually opaque                             |
| Exploration                   | 3.5                 | Orbit, reset, explode, board, and part selection work; new zoom buttons improve access; exploded parts are insufficiently separated from the default angle                                   |
| Intent to consequence         | Not scored          | No live model request submitted in this review                                                                                                                                               |
| Trust                         | 4                   | Clear “Example concept” and component proposal language; artifact empty state is honest; export checkmarks misleadingly include zero generated files                                         |
| Legibility                    | 3.5                 | Initial wheel/title collision fixed during review; contextual trays read well at rest; board lower edge intersects cockpit; small metadata needs more contrast/size                          |
| Accessibility and performance | 4 for tested access | Escape restored invoking-button focus; keyboard station switching works; reduced-motion setting retains station access without camera travel; performance and narrow layout not instrumented |

Assessed average: approximately 3.7/5. This is a useful iteration baseline, not a claim about untested functionality or manufacturing quality.

## Initial highest-impact refinements

### 1. Give each station evidence that belongs to it

**Priority: high.** The software station currently changes the wheel angle and opens an empty generic artifact tray. The planning tray likewise says the goals will take shape later, although the user deliberately opened a reference project.

Seed an explicit, clearly labeled example brief with a few real design assumptions: intended use, assembly preference, provisional envelope, and outstanding decisions. Display two or three of those as quiet labels around the wheel in Plan. The example must be clearly identified as illustrative rather than user-approved.

In Software, show a small screen-facing proposed behavior chain or actual architecture summary derived from project data. For example, a generic proposed `Input → Controller → Connected application` structure can be explicitly labeled as a proposal and linked to the planning request that would develop it. Avoid fabricated working firmware or fake generated-file names. If nothing exists yet, give a specific useful next action, such as asking the planner to define input behaviors.

Acceptance: a silent observer can distinguish the four perspectives without reading the selected tab, and can name one meaningful thing learned in each.

### 2. Make Electronics actually reveal the inside

**Priority: high.** After selecting Electronics, waiting for the camera to settle, and clearing selection, the wheel shell and grips remained visibly solid purple. The board was mostly hidden. This was also reproduced after a live app refresh.

Scene source intends to use a ghost material with low opacity; the actual rendered result needs investigation. Ensure transparency, depth handling, and material updates apply correctly to the wheel. If an imported mesh cannot provide an electronic separation, indicate that limitation and make the board/part view a deliberate alternative.

Acceptance: the normal Electronics perspective visibly reveals the board and important interfaces inside the same physical silhouette, without requiring the user to discover a hidden toggle.

### 3. Fit every canonical view within a deliberate stage region

**Priority: high.** Initially, both flame and wheel intersected the heading and subtitle. The first flame also extended beyond the upper viewport. The root agent's live camera adjustment fixed the wheel's title collision in later screenshots; retain that improvement.

At the reviewed 1461×836 viewport, reserve roughly y=60–165 for the title region, y=185–510 for the main artifact, and y=540 onward for contextual controls and the cockpit. The exact numbers should adapt to window height and object bounds.

The board currently settles into a diagonal portrait-like placement whose lower edge runs behind the cockpit. A board view should fit entirely in its inspection region, have a predictable screen orientation, and offer reset. Prefer landscape alignment when that suits the board geometry. If dimensions describe the full product, call them “Product envelope”; do not present them as the dimensions of the enlarged conceptual board.

Acceptance: reset view produces a complete, unobscured object in every station and mode; readable text does not compete with geometry. Review at both default and shorter window heights.

### 4. Separate an orbit gesture from a selection click

**Priority: high.** Dragging across the wheel to inspect it also selected “Custom wheel shell,” changed its appearance, and created a selection chip. This makes ordinary exploration feel unpredictable.

Only trigger part selection when pointer travel remains under a small threshold. Apply the same rule to meshes, PCB elements, and loaded artifacts. Leave a simple click as selection. Preserve the current good selection-dismiss affordance.

Acceptance: repeated drag-orbit gestures do not change selection; clicks still select the intended object.

### 5. Let “Explode” explain the assembly immediately

**Priority: medium.** From the default Design angle, explode creates some depth separation, but the front still occludes most of the board and rear housing. The result is easy to miss.

Increase separation to reveal at least three distinct layers, and consider a small camera adjustment to an assembly-friendly angle. Add restrained guide lines or named layer callouts. Keep the artifact focal point stable and the assembled state one click away.

Acceptance: a user who clicks Explode can immediately point to front structure, electronics, and rear housing without an additional orbit gesture.

### 6. Make the first flame feel like concentrated possibility

**Priority: medium.** The initial filament composition is unusual and attractive, but lacks the dense warm core and coherent fire silhouette described in the creative direction. It reads as cool gauze.

After fitting it below the heading, strengthen a narrower ivory/amber core with coral detail and keep violet/cyan at the edges. Use opacity variation and a small luminous inner volume rather than uniformly bright lines. Retain the base anchor and upward movement. Do not add a dense starfield or more concentric decoration.

Acceptance: the entire flame is visible and recognizable at normal display brightness, and the title remains cleanly readable throughout its motion.

### 7. Keep package contents and readiness truthful at a glance

**Priority: medium.** The export tray places a checkmark next to “Generated artifacts — 0 files.” The readiness qualification and export button fall below the initial fold.

Use a neutral document icon for package sections or an explicit missing/pending state for zero files. A checkmark should represent inclusion or verified completion, with those meanings kept distinct. Put the export action and “Prepared for review” qualification together in a sticky tray footer. Preserve the current clear explanation that supplier confirmation and physical validation are separate.

Acceptance: without scrolling, the user can see what the next action does and the package's actual maturity. No icon implies the existence of files that do not exist.

## Details worth retaining

- The “What would you like to make?” invitation is strong and immediately understandable.
- The Holo wordmark belongs in the bottom cockpit. Resist moving it into a conventional header.
- The prompt changes with station but continues to explain that the planner coordinates work.
- “Example concept · Make it yours” and component-level “Proposed” labels set appropriate expectations.
- Parts and settings trays have a good calm resting appearance, useful grouping, and restrained borders.
- Escape closes a tray and returns focus to the invoking control.
- Keyboard `3` selects Electronics. Reduced motion removes camera travel without removing the station.
- The board rendering has enough recognizable component and trace structure to support conceptual exploration once framing is corrected.
- The object survives station transitions; no route change or loading-page replacement breaks the studio illusion.

## Smaller polish items

- Convert raw account-plan text such as “prolite subscription” into a user-facing phrase, for example “ChatGPT subscription.”
- Standardize thinking-depth capitalization so “low thinking” and “ultra thinking” do not sit awkwardly beside “Deep thinking.”
- Increase small cockpit labels and metadata modestly before adding new controls. Primary stage control text should be readable without leaning toward the screen.
- The generic WebGL fallback text appears in the accessibility tree even while the scene renders. Verify that a screen reader does not announce a false failure state.
- Consider preserving an identifiable wheel silhouette or a small return-to-assembly affordance while the PCB is unfolded, to strengthen the “same idea” connection.

## Follow-up review required

Recheck the flame, all reset camera poses, Electronics transparency, drag-versus-click behavior, exploded assembly, and export footer after refinements. Then review one actual change from prompt to a visible proposal or artifact, including a busy state and a recoverable failure. That final journey is necessary before assigning a score to intent-to-consequence or claiming the complete product experience meets the creative bar.
