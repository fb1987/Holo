# First-pass experience review

Independent reviewer: UX and creative direction. Reviewed the first-pass changes on 2026-09-11 using the built app served from an isolated local review service. The service used a copy of an existing generated-controller project and a fake model runtime. Production application data and the installed production app were not operated. No model request was submitted.

## Outcome

The reviewed first pass meets the requested visual simplification. The actual generated assembly remains the focal object, while the idle interface occupies one compact row at the bottom. No blocking UX or creative issue was observed in the tested paths. This is an experience review, not engineering validation or a certification of the complete agent workflow.

## Observed behavior

| Check                  | Result                                                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default composition    | Full generated assembly is visible with materials and a coherent upright orientation. The centered project heading, generic left geometry label, and bottom instruction/status row are absent.                                                                                         |
| Compact dock           | One row contains the Holo/project menu, prompt, send control, and current-perspective control. Measured height was 62 px at 680 × 620. No permanent top or side navigation was introduced.                                                                                             |
| Desktop layout         | Reviewed at the default 1461 × 836 viewport and at 1440 × 960. The assembly and dock are separated, with substantial usable stage space.                                                                                                                                               |
| Narrow layout          | At 680 × 620 the assembly settles fully in view. The long project name truncates visually while retaining its full accessible name. The perspective control becomes an icon while retaining its accessible perspective name. Document scroll dimensions equal the viewport dimensions. |
| Expanded mode          | The optional station row and quick actions fit at desktop and narrow sizes. The same prompt row remains anchored at the bottom. Returning to minimal mode removes the extra rows.                                                                                                      |
| Perspective continuity | Keyboard `2` changes to Design while retaining the generated assembly. The selected tab, accent, prompt, and dock perspective identity update together.                                                                                                                                |
| Controls sheet         | Four named perspectives, current model selection, view tools, activity, files, history, package, settings, and navigation are reachable. At the narrow size, the content scrolls while the close control stays visible.                                                                |
| Nested keyboard focus  | Controls → Settings → Tab places focus on the Settings close button. Escape closes the sheet and returns focus to the persistent dock control.                                                                                                                                         |
| Focus trap             | Shift+Tab from the Controls dialog reaches its last control and scrolls it into view. Tab from that control wraps to the close button.                                                                                                                                                 |
| Cleanup                | Restored minimal mode, Plan perspective, and the browser's default viewport after testing. No project selection or project content was changed.                                                                                                                                        |

## Findings addressed during implementation

1. **Modal spacing:** the original tray offset assumed the tall cockpit. The revised layout uses the measured dock height, so collapsing the cockpit also releases space to the tray.
2. **Nested focus:** replacing Controls with another sheet previously risked leaving focus on a removed element. The tray now refocuses when its title changes while preserving the original dock opener. An initial effect-order regression was identified in static review, corrected, and the nested Settings path was verified in the browser.
3. **Perspective discoverability:** a generic gear alone would hide Holo's central navigation concept. The compact control retains the current perspective's icon, name where space permits, and accessible name. All four named perspectives remain together in Controls.
4. **View-change feedback:** model selection and discrete view actions dismiss the modal Controls sheet so it does not obscure their result. Root validation covers the model/part selection path; this reviewer inspected the implementation and exercised the default assembly presentation.

## Creative assessment

The reduction strengthens Holo's identity. The object, lighting, and circular stage carry the experience, and the dock reads as a tool within that space. The expanded option preserves convenient access for longer sessions without making every user carry that density. The generated assembly is now recognizable as the intended product rather than an enlarged internal part.

The on-demand Controls sheet is functional and appropriately secondary. Future improvements can make model labels shorter and more descriptive; current labels inherit verbose artifact names. This does not block the first pass.

## Review boundaries

- The fixture had reduced motion enabled. This review establishes accessible station changes and stable final poses, not continuous animation smoothness or frame-rate performance.
- No live model turn, cancellation, approval, connection recovery, manufacturing export, supplier action, or physical validation was exercised by this reviewer. Those paths require separate integration evidence.
- File selection, historical/current domain semantics, and export correctness are covered by implementation tests and root validation rather than this UX review.
- Private model assets and screenshots are intentionally excluded from the repository.
