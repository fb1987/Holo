# Holo: creative direction and experience review

## The promise

**An idea you can walk around, then make real.**

Holo is an invention studio. Its central experience is one shared object becoming progressively more understandable and buildable as a person moves between four specialist perspectives. The interface should communicate continuous custody of the same idea. An attractive scene without continuity, usable exploration, and visible consequences is not enough.

The visual metaphor is a quiet circular studio with one illuminated worktable. The user is the person visiting specialists around that table. There are no floating robot portraits, simulated conversations, decorative terminal logs, or planets representing tools.

## Art direction: a precious object in a dark room

Use near-black graphite with a perceptible blue-green atmosphere, warm off-white typography, controlled luminous detail, and real depth. Aim for the care of an industrial design presentation combined with the intimacy of a physical workbench. The scene should remain beautiful with the bloom turned off.

Suggested tokens:

| Role          | Value                       | Use                                           |
| ------------- | --------------------------- | --------------------------------------------- |
| Deep room     | `#070B10`                   | Main background; avoid pure black everywhere  |
| Raised glass  | `#101A23`                   | Bottom cockpit and inspection surfaces        |
| Primary ink   | `#E8EEE8`                   | Essential text                                |
| Secondary ink | `#9AAFB8`                   | Supporting text on sufficiently dark surfaces |
| Hairline      | `rgba(170, 207, 216, 0.14)` | Sparse separators                             |
| Planning      | `#E7B78B`                   | Warm intention and unresolved possibility     |
| Design        | `#9DDDD8`                   | Dimensions and geometry                       |
| Electronics   | `#D6DC99`                   | Board detail and selected connections         |
| Software      | `#B8B4ED`                   | Logic and architecture                        |
| Attention     | `#F39A7D`                   | Changes requiring a decision                  |

Station accents identify disciplines; they are not instructions to recolor the entire application. Reserve intense light for the central object, selected evidence, and actual activity. Buttons should be legible without glowing.

Use one highly readable sans family. Give the name of the idea enough typographic confidence to act as the scene's title. Use monospaced text selectively for dimensions, part numbers, revision IDs, and code. Avoid all-caps paragraphs and tiny technical decorations. Secondary text should usually be at least 12–13 px; essential interaction labels should be 14 px or larger.

## Composition

- The stage occupies the whole window. The focal point is approximately 50% across and 43% down on a desktop window, leaving physical space for the bottom controls.
- The object or flame should use roughly 35–50% of the available scene height. It must remain large enough to reward inspection, rather than becoming a token floating above a huge control panel.
- A low, subtle elliptical light pool gives the object a place in space. One partial table ring can express the workstations. Additional concentric rings should require a purpose.
- Keep all application chrome in the bottom zone. Window traffic lights are an operating-system exception, not an excuse for a top toolbar. In-scene labels may be above the bottom, but they annotate the idea and are not application navigation.
- Place the project name and a short truthful state near the scene or at the leading edge of the cockpit. Avoid a top-left dashboard header.
- The persistent prompt is the strongest piece of chrome. The station selector is immediately adjacent, spatially stable, and usable without opening a menu.
- One contextual tray may rise from the cockpit when the user asks for details. It must have a clear close action and return the user to the stage. Do not make a permanent left rail, right inspector, or two-column portal.
- Empty space should frame the artifact. It should not result from undersized content.

The first frame should communicate, without reading documentation: **this is the object, these are its four perspectives, and this is where I describe what I want.**

## The four workstations

Use the same object, camera target, project identity, and revision across all workstations. A station changes which evidence is visible and what the user can examine. A tab that swaps unrelated content does not satisfy the concept.

| Station     | Dominant view                                                                          | Useful first action                                     | Example prompt                                        |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Plan        | Flame or complete object, with a few spatial intent annotations                        | Choose an ambition or resolve a tradeoff                | “A desk controller I can assemble without soldering.” |
| Design      | Physical geometry, finish, mounting, and dimensions                                    | Orbit, isolate, explode, or change material             | “Make the grips narrower, but keep room for gloves.”  |
| Electronics | Enclosure becomes translucent; boards and connectors become clear                      | Isolate a part, inspect a connection, unfold a board    | “Show me what changes if this becomes wireless.”      |
| Software    | Physical object remains contextual; readable code or architecture appears in the stage | Select a behavior, inspect a file, examine a dependency | “What runs when I press this button?”                 |

Use “Plan,” “Design,” “Electronics,” and “Software” in navigation. Specialist names can appear as contextual explanations, but the user should not have to decode personas.

Labels in the scene are anchored to meaningful features. If a label says “USB-C,” it must correspond to an actual connector in the shown model. Keep only a few labels visible at once. A selected label receives a leader line or clear spatial connection rather than more glow.

Software and PCB work may need a large flat plane. Let that plane unfold into the spotlight and remain screen-facing. Text should never tilt away from the reader to prove that the world is three-dimensional.

## Motion: perspective changes, the idea stays

Separate **navigation orbit** from **object inspection**. Station changes orbit the presentation around the fixed idea. Dragging the object changes the user's inspection angle and should not change the active specialist.

Suggested initial transition specification:

1. On station selection, change selected-state feedback immediately.
2. Begin a 650–850 ms eased orbit using the shortest angular path to the selected station. The apparent camera target remains the idea's center throughout.
3. Fade departing station annotations over the first 150–220 ms. Keep the object continuously visible.
4. Change material emphasis, transparency, and lighting through the middle of the orbit, rather than at a single abrupt threshold.
5. Introduce new annotations during the final 200–300 ms, once they will be readable.
6. End in a calm scene, with no spring overshoot on the object and no repeating label animation.

Use ease-in-out curves for the camera. More energetic easing may suit a tray opening, but the studio should have weight. New navigation during a transition must smoothly redirect from its current position, not queue several full revolutions. Repeatedly choosing the same station should not replay the transition.

Avoid rotating the entire UI, spinning the object 90 degrees for every station, showing a loading screen between perspectives, or replacing continuity with a large crossfade. Prompt position remains fixed.

## The flame before form

The pre-design state should have a slender, coherent flame-like core with curling filaments and an upward tendency. It should have a recognizable silhouette and contrast with the dark studio. Think of matter gathering around an idea, not a fog ball or a random particle explosion.

- A warm ivory/amber core grades through coral into restrained lilac and cyan fringes.
- Layer slow silhouette evolution with faster small detail. Do not move every layer at the same rate.
- Let the base stay near the table focal point. Filaments may reach upward, but the whole form should not drift around the scene.
- A small number of sparks can break away. A dense starfield weakens the object focus.
- Keep bloom localized. Preserve a visible structure at normal display brightness.
- The flame is the real empty state, not proof that a model is thinking. If no generation is running, it is simply an ambient representation of the idea.
- When geometry becomes available, preserve scale and focal position during the handoff. A brief silhouette overlap or dissolve is preferable to an unrelated object popping into existence.

Honor reduced motion with an attractive mostly static filament composition. A reduced-motion user should receive the same visual identity and information.

## Truthful working states

Distinguish these states visibly:

| State             | What to show                                                                      |
| ----------------- | --------------------------------------------------------------------------------- |
| Example project   | A concise “Example project” label; usable exploration and explicit sample data    |
| Ready for intent  | A calm stage and one useful starter prompt                                        |
| Request received  | The user's request and a short pending state                                      |
| Agent running     | Real streamed progress or a concise tool/activity description                     |
| Proposed change   | What will change, why, affected disciplines, and acceptance action if needed      |
| Applied revision  | The updated object plus a compact change summary                                  |
| Blocked or failed | The concrete blocker and the next available action; preserve the current artifact |

Never animate fake multi-agent activity. Never label placeholder geometry “manufacturing ready.” If an agent wrote a specification but did not generate a new model, describe precisely that result. Retain the last working render during generation.

Long-running work should not monopolize the app. Let the user inspect the current revision, visit another station, or read the plan while work continues. Clearly indicate when that view is of the previous revision.

## Voice and microcopy

Write like a thoughtful workshop collaborator. Concrete verbs and material facts provide the futurism more convincingly than invented command names.

Candidate strings:

- First-run invitation: **“What would you like to make?”**
- Supporting line: “Explore the shape. Work through the details. Get it made.”
- Prompt placeholder: “Describe an idea, or change what you see…”
- Project starter: “A controller that fits the way I work.”
- Change review: **“A smaller board makes room for the battery.”**
- Consequence: “This keeps the outer shape and changes two mounting points.”
- Planning question: “Would you rather keep the size, or extend battery life?”
- Build preference: **“How hands-on do you want to be?”**
- Options: “Build it myself,” “Some assembly,” “Arrives finished.”
- Download action: “Export build package.”
- Export qualification: “Prepared for review” or “Ready to request quotes,” when those descriptions are accurate.
- Empty electronics state: “The shape is taking form. Next we will choose what goes inside.”
- Failure state: “The model could not be updated. Your last revision is still here.”

Avoid “Initializing cognitive mesh,” “Agent swarm activated,” “Quantum workbench,” and decorative confidence percentages. Avoid saying “approved” unless a named person, tool, or process actually approved it.

## Interaction and accessibility

- Orbit, zoom, and reset must be convenient and discoverable. Use a short hint that disappears after successful use, with help available again.
- Provide real buttons for zoom and reset so precision trackpad gestures are not required.
- Support `1`–`4` to choose stations when focus is outside editable controls. Provide arrow-key navigation within the station control and a clearly visible focus ring.
- `Escape` closes contextual surfaces and cancels selection before doing anything destructive. It should never discard a prompt draft.
- `Cmd+Enter` submits a multiline prompt; preserve normal text editing conventions. Any plain-Enter submission behavior must be documented in the control.
- Respect `prefers-reduced-motion`: replace camera travel with a short crossfade, stop continuous camera drift, and substantially reduce flame motion.
- Do not communicate station, verification state, or activity with color alone. Pair color with labels, icons, or text.
- Keep selected and keyboard-focus states distinct.
- Keep controls reachable at 1100×720, and ensure essential interaction still works in a narrower window through a condensed cockpit rather than horizontal page overflow.
- Pause expensive ambient rendering when the window is hidden. Prefer smooth interaction and crisp type over expensive post-processing.

## Review rubric

Score each dimension from 1 (missing) to 5 (excellent). A release should average at least 4 and pass every critical gate. Polish cannot compensate for a failed critical gate.

| Dimension                     | A score of 5 means                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Idea continuity               | The same focal artifact survives every station transition; selection and project identity remain understandable          |
| Spatial navigation            | Moving stations feels like changing perspective around the same work; motion is smooth and interruptible                 |
| Visual authorship             | Composition, materials, typography, flame, and lighting form a recognizable identity without decorative clutter          |
| Bottom cockpit                | All persistent controls live at the bottom, have a clear hierarchy, and preserve space for the object                    |
| Useful perspectives           | Each station makes a distinct real part of the project easier to inspect or change                                       |
| Exploration                   | A person can orbit, zoom, reset, select, and discover a meaningful detail within a minute                                |
| Intent to consequence         | One input produces a comprehensible change or proposal with affected disciplines and revision context                    |
| Trust                         | Sample data, generated artifacts, live execution, and validation state are accurately identified                         |
| Legibility                    | Scene annotations, code, controls, and supporting text are comfortably readable without defeating the spatial experience |
| Accessibility and performance | Keyboard flow, focus, reduced motion, window resizing, and interaction performance remain sound                          |

Critical gates:

1. No permanent top or side application navigation that converts the experience into a conventional portal.
2. The central artifact never disappears solely because the user switches workstations.
3. Prompt input is usable, the visible submission path works, and failure leaves the project recoverable.
4. Examples and simulations cannot be mistaken for completed engineering or live agent output.
5. Reduced motion does not prevent access to any station or project capability.
6. The app provides a concrete usable journey immediately, even if that journey begins with a clearly labeled reference project.

## The review sequence

Review the actual running app, not source code alone. Capture the first-run flame, each workstation, an open contextual tray, a busy state, a failed action, and a smaller window. Inspect a screen recording or actual interaction for station transitions; screenshots cannot establish motion quality.

Then perform one narrative test: **“I want this controller to arrive with no soldering required.”** Follow the visible result. Can the user tell whether the plan changed, which electronics or assembly assumptions were affected, and what remains to be done? The first implementation may only propose the change, but its claim must match its output.

Finish with a 30-second silent test. A new person should be able to point to the idea, switch disciplines, and find where to ask for a change. If they cannot, simplify the cockpit and strengthen the focal object before adding features.
