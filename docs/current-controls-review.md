# Current controls and activity review

Reviewed on 2026-09-11 and 2026-09-12. The user's current request explicitly replaces the earlier bottom-only navigation rule: project identity now belongs in the upper-left corner, and Activity may remain open on the right.

## Interaction decisions

- The project selector sits below macOS's traffic-light controls and outside the draggable titlebar region. Its full name remains available to assistive technology and in the hover title when visually truncated.
- The prompt has one compact layout. Perspective and studio options have separate, same-height buttons. The perspective chooser is an anchored menu rather than a modal sheet; its checked item describes the active perspective.
- Arrow keys move through the chooser without changing the scene. Enter or Space commits a choice; Escape dismisses it. Closing returns focus to the persistent chooser button. Numeric perspective shortcuts remain available outside dialogs.
- Activity is a nonmodal, independently controlled aside. It does not dim the scene or trap focus, and remains open across perspective changes, prompt submission, and temporary dialogs. Its close button and Escape while focused inside return focus to studio options.
- Activity scrolls with new content only while the reader is near the bottom. Reading older messages pauses following; a Jump to latest button resumes it. Scrolling is immediate, including for reduced-motion users.
- The latest run's optional details expose model, thinking depth, elapsed time, status, tool-call count, and retry count. These are execution metadata, not internal reasoning.
- Model selection, assembly/part selection, exploded conceptual views, files, history, exports, and connection settings remain available in Studio options. Visible zoom/reset controls and the expanded cockpit are removed; direct scene gestures and the R shortcut remain.
- Automatic team is the empty model selection: Astra plans at high depth; Luna uses the chosen specialist depth, with Sol as an availability fallback. Choosing a specific model continues to override the whole team.
- Early generated visuals carry a quiet Provisional label above the dock. The label communicates their temporary status without recreating the removed permanent stage captions.

## Validation

`npm run check` and `npm run build` pass with the implementation and current shared contracts. Browser checks used the isolated fake-runtime fixture at port 4319. No production application data or paid model request was used by this reviewer.

| Check                       | Result                                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default desktop composition | Reviewed at 1461 × 836. Identity, central stage, dock, and inset Activity have distinct space; the provisional concept is prominent.                                                   |
| Minimum native viewport     | At 680 × 620, document scroll dimensions match the viewport. The compact dock measures 62 px; Activity is 285 px wide and ends 16 px above it.                                         |
| Long title                  | A 90-character fixture title truncates visually in the upper-left selector; its full accessible name remains intact.                                                                   |
| Multiline draft             | A three-line prompt grows the dock and raises Activity's bottom edge without overlap or document scrolling.                                                                            |
| Quick switcher              | Opening focuses the checked perspective. Down moves focus without switching the scene; Enter commits and returns focus to the trigger. Tab dismisses into the separate options button. |
| Persistent Activity         | Activity remains visible during fake prompt submission, station changes, and a nested Options → Settings → Escape round trip.                                                          |
| Nested modal focus          | Tab after Options → Settings lands on the Settings close button. Escape returns to the persistent options control.                                                                     |
| Scroll restraint            | With earlier activity at scrollTop 25.5 px, a new fake request and streamed output preserve that position and reveal Jump to latest. Clicking it resumes bottom following.             |
| Activity keyboard access    | Tab from options reaches Activity. Escape from Activity closes it and restores focus to options. It does not trap focus.                                                               |
| Automatic team settings     | The default selection is Automatic team; specialist depth is labeled independently from the planner's fixed high depth.                                                                |
| Provisional display         | The fake concept model and Concept study / Provisional label appear while work continues. The label clears when the fake run terminates.                                               |

The initial fixture returned an invalid structured design result; its missing part descriptions were corrected by the runtime implementer and the isolated service restarted. A final fresh fake request completed successfully: a provisional blue bin appeared during work, then the accepted canonical scene remained visible after 14 seconds with no Provisional label, busy state, or error toast. This verifies the preview-to-project transition, not manufacturing validity or a real model's generation quality.

Three initial simulated requests exercised progress and scrolling; one fresh request verified the corrected final transition. The initial fixture project received a long review-only name for truncation validation. The temporary viewport was reset after testing. Screenshots were inspected inline through CUA; private production assets were not opened or added to the repository.

## Findings addressed

1. Resizing the window or growing the prompt could create overflow while Activity was following without moving to the new bottom. A ResizeObserver now preserves bottom following only when that mode was already active; reading older activity remains undisturbed.
2. The removed zoom/reset buttons left obsolete scene accessibility instructions. The implementation now describes direct scroll/pinch and the R shortcut.
3. Empty projects initially showed an empty MODEL section in options. That section is now absent when no model control applies.
4. Jump to latest now focuses the message viewport when its own button disappears, retaining a usable keyboard position. This final focus adjustment was type-checked and reviewed in source after the browser scroll check.
5. Settings uses the same shared routing helper as request submission to normalize unsupported persisted thinking depth. Changing models therefore updates both the displayed value and the saved selection; the runtime model’s supported default is used when needed.

## Layout constraints

The scene keeps its full viewport and stable center. Activity is an inset glass panel that stops above the measured prompt height. At the supported 680 × 620 minimum, the panel narrows to 285 px and the perspective button keeps its accessible label while visually using its icon. Full-width drawer treatment applies only below the native minimum, for browser-based small-screen use.
