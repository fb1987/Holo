# Independent UX review

Reviewed the running development app at `http://127.0.0.1:4317` in a separate Chrome tab on 2026-09-11. This review used the rendered interface, accessibility tree, actual keyboard and pointer interaction, and downloaded ZIP contents. It was not a source-code-only assessment.

The implementation was being refined during review, so resolved observations and still-open findings are separated. The live Codex execution pipeline is being tested independently by the backend reviewer; this review did not run a paid model request or claim to validate generated manufacturing outputs.

## Overall result

The local exploration journey is usable and unusually coherent. The same central object persists across four perspectives, the bottom cockpit remains stable, examples are explicitly disclosed, and empty engineering states do not pretend to contain finished files. The parts tray and build package communicate uncertainty concretely. The flame gives an original project an attractive, meaningful starting state.

The significant project-draft issue and all four focused accessibility/framing findings were fixed and independently rechecked. The local exploration, artifact-preview, and export journeys pass this review's scope.

No P0 failure was observed. Live change routing, stopping an active run, and live tool approvals remain outside this review's demonstrated coverage. Actual authored sample files were previewed and exported during the follow-up; they are distinct from files produced by a live model run.

## Verified journeys

| Journey                          | Observation                                                                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First entry without connection   | Flame, direct invitation, two example starting points, four stations, and prompt are present. Example exploration works before connecting Codex.                                                                                              |
| Steering wheel example           | One click creates a local example project. Persistent “Example concept · Make it yours” text prevents confusion with completed engineering.                                                                                                   |
| Station navigation               | Pointer selection, `1`–`4`, and right-arrow movement within the station selector work. The object stays visible and its focal context is retained.                                                                                            |
| Object exploration               | Explode changes the visual arrangement; electronics exposes a separate conceptual board view; reset is available. Zoom buttons were added during review and are keyboard reachable.                                                           |
| Components                       | Three proposed component classes are listed with explicit limits, including unresolved exact board choice, mounting design, and manufacturing review. Selecting a part closes the tray and labels the selected part; Escape clears selection. |
| Software and design empty states | The app says generated files will appear and differentiates conceptual geometry from engineering files. No fake repository is presented.                                                                                                      |
| Local project creation           | “Begin with an idea” creates a separate `Untitled invention`, focuses the prompt, and does not copy the wheel's model or parts.                                                                                                               |
| Drafting                         | Multiline text works; typing `1`, `2`, `3`, `4` in the prompt does not switch stations. Draft survives station and settings changes.                                                                                                          |
| Project settings                 | Renaming and choosing a build preference save immediately, increment revision, and add a decision explaining the preference update.                                                                                                           |
| Codex connection                 | Connect succeeds with the installed local account and populates actual available model choices and reasoning depths. No model turn was submitted.                                                                                             |
| Modal keyboard behavior          | Opening the components/settings/export trays places focus inside; Tab cycles among available controls; Escape closes and returns focus to the opener. DOM confirms `role="dialog"`, `aria-modal="true"`, and accessible title.                |
| Reduced motion                   | Settings expose a labeled checkbox. The altered state retains the flame, station access, and editable draft. Restored the original off state after testing. Full frame-by-frame motion timing was not measured.                               |
| Desktop layout                   | At 1100×720 the object, station selector, prompt, and action row are reachable without page overflow.                                                                                                                                         |
| Narrow layout                    | At 760×650 the cockpit condenses without hiding essential controls. Export tray scrolls to the actual export action; its close control stays visible. One icon loses its accessible name, recorded below.                                     |
| Project retention                | Reviewer-created projects, renamed identity, build preference, decisions, and revisions remain available through project selection and a development hot reload.                                                                              |

## Actual export validation

Used the visible Export build package action three times on the reviewer-created `UX review wheel` project. Chrome downloaded real ZIP files:

- `UX-review-wheel-r2.zip`: finished mode.
- `UX-review-wheel-r3.zip`: DIY mode.
- `UX-review-wheel-r4.zip`: mixed mode.

Inspected their archive listings and the contained `ASSEMBLY.md`, `REQUEST-FOR-QUOTE.md`, and `MANIFEST.json`. The package includes project state, BOM, intent, assembly handoff, quote draft, and a manifest with file hashes. Each assembly handoff contains different mode-specific guidance. The finished quote draft explicitly says no supplier has been contacted and it is not a purchase order. All three say the concept is incomplete without project-specific engineering artifacts and that no engineering work has yet been completed.

This initial pass validates a truthful concept handoff. It does not validate manufacturing readiness or the correctness of a generated mechanical/electrical design. The first-pass example had zero generated artifacts; the follow-up below extends coverage to actual sample-file preview and older-revision export metadata.

## Findings and verified fixes

### UX-01 — P1: a draft can be submitted to the wrong project

**Reproduction:** Create a new idea. Type a desk-controller brief without sending it. Open projects and select an existing steering wheel project. The whole draft remains in the prompt beneath the wheel's name, with Send to planner enabled.

**Impact:** The draft's intended target silently changes. A user returning from comparing ideas could apply a substantial design request to the wrong project.

**Expected:** Store drafts by project ID. Switching projects should restore that project's own draft, with a separate entry for the uncreated/first-run state if needed. Keep the current correct behavior of preserving a draft across stations and contextual trays.

**Status:** Resolved and verified. Created fresh wheel and enclosure projects, entered distinct drafts, switched between them repeatedly, and explicitly reloaded each. Each project restored only its own draft; the new enclosure started empty rather than inheriting the wheel draft.

### UX-02 — P2: the narrow export icon loses its accessible name

**Reproduction:** At 760×650, the Build package text disappears as intended, but the remaining download-icon button appears as an unnamed `button` in the accessibility tree.

**Expected:** Add an always-present accessible name independent of responsive visual text, such as `aria-label="Build package"`.

**Status:** Resolved and verified. At 760×650, the icon-only control retains the accessible name “Build package.”

### UX-03 — P2: the working canvas announces a WebGL failure

**Reproduction:** In the first-run flame, wheel, and board states, the accessibility tree exposes the canvas as an image containing “Holo needs WebGL to display your invention.” The rendered scene works correctly at the same time.

**Expected:** The canvas should expose a useful accessible description of the current conceptual scene, or be decorative when equivalent project information is available outside it. A WebGL error should be announced only if rendering actually fails.

**Status:** Resolved and verified. The accessibility tree now describes the interactive 3D model and its orbit/zoom/reset controls. The erroneous WebGL-failure text is no longer exposed during successful rendering.

### UX-04 — P2: build preference selection is visual only

**Reproduction:** In both intent settings and export, the three build modes have a visible selected treatment, but the accessibility tree exposes ordinary buttons without selected or pressed state.

**Expected:** Use a labeled radio group or provide appropriate `aria-pressed` state on the existing controls so the selected preference is discernible without seeing its color/checkmark.

**Status:** Resolved and verified. Intent and export modes expose pressed state; changing DIY/mixed/finished updates the selected semantics correctly.

### UX-05 — P2: board view still intersects the cockpit

**Reproduction:** On the default 1461×836 viewport, switch the example to Electronics and enable Board view. The board's lowest corner extends behind the cockpit, which begins at roughly y=593. This remained after the general object-framing improvement.

**Expected:** Fit the board inside the usable stage area at its default/reset pose, reserving space for both heading and cockpit. User-driven zoom can intentionally move content beyond that area.

**Status:** Resolved and verified. The settled board now unfolds into a horizontal face-on view entirely above the cockpit for both fresh wheel and enclosure samples. Checked default 1461×836 and the 1100×720 layout.

## Findings fixed during review

### UX-06 — P2: object overlaps project title

The initial wheel was large enough that its upper rim intersected the project title. A subsequent scene-framing update made the heading and wheel distinct at 1100×720 and 760×650. Normal object framing passes; the separate board case was subsequently resolved as UX-05.

### UX-07 — P2: zoom depends exclusively on gestures

The initial control set provided reset, explode, and help but no zoom buttons. Zoom in and Zoom out were added during review, have accessible names, and are reachable from the keyboard.

## Follow-up verification

Created new `UX wheel recheck` and `UX enclosure recheck` samples after the backend restarted so the test included the current authored files. The enclosure's software tray contained an actual TypeScript behavior model, signal-path JSON, architecture brief, and assembly brief. Opening the TypeScript file displayed its real content and a download link. The header and code explicitly identify it as a conceptual example rather than tested device firmware.

The Software perspective now includes a readable, screen-facing signal-path overlay linking a physical input to hardware, firmware, interface, and experience. It is explicitly labeled “Example behaviour · Proposed” and says the system still needs connection and testing. The physical object remains visible behind and below this deliberately foregrounded software surface. Returning to a physical station removes the overlay.

At 760×650, the export action and “Prepared for review” qualification stay visible in a fixed footer while the package details scroll. The contents list uses document icons rather than checkmarks implying engineering completion. The mode controls remain reachable and semantically selected.

Downloaded fresh enclosure ZIPs in all three modes: revision 1 mixed, revision 2 DIY, revision 3 finished. The finished archive includes all four actual sample artifacts, and its manifest records `sourceRevision: 0` and `currentRevision: false` for each artifact retained from the earlier revision. Their paths, file hashes, and revision metadata are present. No live model inference was needed to exercise the full local preview/export loop.

A real development service restart occurred during this pass. The interface temporarily showed “Workshop disconnected,” disabled sending, and retained the object and draft. It recovered the local service; Connect restored authenticated Codex status and real model options. Refresh completed without changing the project or its draft. This establishes recovery from that observed local restart, not every possible model/tool failure.

All original findings are resolved within the tested scope. Temporary viewport overrides were reset. No paid AI requests were submitted by this reviewer.

## Suggested regression checks

1. Type different drafts in two projects, switch back and forth, and verify each project restores only its own draft. Also verify send/clear affects only the active project's draft.
2. Inspect accessible names at desktop and narrow widths; every icon-only action must remain named.
3. Verify each build preference's semantic selected state changes with both pointer and keyboard interaction.
4. Verify the canvas exposes an accurate label in a successful WebGL context and that the renderer's error fallback is distinct.
5. Capture normal and board reset poses at 1100×720 and 1461×836 and confirm the entire artifact fits between the heading and cockpit.
6. Export after changing each build preference and inspect the real ZIP manifest and instructions, including a project containing both current and older generated artifacts.

## Remaining review boundaries

- No paid intent request, live cancellation, or real approval prompt was exercised here; backend/live integration review must establish those paths. A local service restart and reconnect were observed successfully, but live model/tool failure recovery remains untested here.
- No supplier, catalogue, or physical prototype was contacted or validated.
- Responsive viewport overrides and reduced-motion preference were restored after testing.
- Review-only projects and downloaded packages are local test artifacts; they were not committed to the repository.
