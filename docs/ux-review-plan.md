# Holo independent UX review plan

Review basis: the product conversation, `AGENTS.md`, `shared/types.ts`, and `docs/creative-direction.md`. The intended first release is a usable local invention studio on macOS, with Codex specialists coordinated through a planning agent. It must make exploration enjoyable while being explicit about the difference between a concept and a physically verified build.

This is a plan and a set of release gates, not a claim that the running implementation has passed them. Record observed findings and their resolution separately after exercising the actual app.

## The first minute

With no documentation and no Codex login, a new user should understand all three of these:

1. The object or flame is their idea.
2. The four bottom stations reveal different aspects of that same idea.
3. The floating prompt is where they ask for a change.

The user must also find a clearly labeled example and a way to start their own project. Exploring an example should not require a paid model invocation. A connection problem must not leave the first frame empty or make the local visualizer unusable.

### Acceptance

- The first frame contains a focal object/flame, a plain-language invitation, the four station labels, and an actionable prompt or starter choice.
- The strongest focal point is the idea; the next strongest control is the prompt.
- All persistent application controls remain in the bottom area. A dismissed tray returns to the uninterrupted stage.
- An example is visibly labeled wherever it could be mistaken for the user's work, including its export metadata.
- Navigation and local inspection work without authentication; actions requiring a connection explain that requirement at the moment of use.
- No decorative animation claims an agent is working unless execution is actually active.

## Journey 1: explore the reference project

Start the steering wheel example. Orbit and zoom its geometry. Visit Design, Electronics, and Software, then return to Plan. Inspect a meaningful part and open one artifact.

### Acceptance

- One click opens the example, and it can be explored immediately.
- The selected project, artifact, and focal position remain continuous between stations. Changing station never silently changes project or revision.
- Station selection responds immediately; an in-progress orbit can redirect smoothly to another station.
- Drag inspection does not change the chosen station. Zoom and reset are available as labeled or accessibly named buttons.
- A short discoverable gesture hint explains pan/orbit/zoom; no essential action depends exclusively on a trackpad gesture.
- Each perspective exposes different useful evidence. Its labels describe actual shown content, with empty states when that evidence does not exist.
- Electronics transparency does not make mechanical context disappear entirely. PCB and parts views clearly distinguish a conceptual layout from an authored fabrication artifact.
- Software provides legible screen-facing text, while maintaining a recognizable relation to the object.
- A sample board, component choice, price, or code file is not presented as verified engineering.

## Journey 2: begin an original idea

Create a new project using: “A small desk controller with three buttons and a dial. I can assemble parts, but I do not want to solder.” Inspect its initial state, choose a build preference, and submit the intent.

### Acceptance

- New idea is reachable from the bottom cockpit without reading help or abandoning a draft unexpectedly.
- Creation does not overwrite the reference or another project.
- The original project begins with its own identity and honest empty state. It does not silently inherit the reference wheel's parts or claims.
- Project creation requires only a useful minimum of information. The planning conversation can refine budget, dimensions, finish, and assembly comfort later.
- DIY, some assembly, and arrives finished have concise explanations of their consequences. Changing the preference is reversible and stays consistent with the project plan.
- Multiline composition works. The visible submit button and keyboard submission behave consistently; a draft survives station changes and a failed submission.
- Before generation begins, the interface distinguishes saving a project locally from asking the model to work.
- Inputs entered from Design, Electronics, or Software retain that context but still reach the planning agent for intent coordination.
- A newly created project can be reopened after reload with its identity, messages, build preference, and last saved revision intact.

## Journey 3: connect Codex and choose how it works

Open connection settings, inspect current status, authenticate if required, and choose an available model and reasoning effort. Close settings and return to the same scene.

### Acceptance

- A compact bottom status identifies whether Codex is ready, disconnected, signing in, or unavailable. “Connected” must not imply “authenticated.”
- The connection surface offers the appropriate concrete next step and explains local requirements in plain language.
- Authentication is performed through the supported provider flow; the UI does not invite the user to paste account passwords.
- Model choices come from the available runtime and identify the active selection. Reasoning options match the selected model's supported values.
- A busy state, cancel/back action, and retry path prevent authentication from becoming a dead end.
- Costs or usage are not invented. If a request uses a provider or billing mode, disclose that mode accurately; expose spend controls only when they actually constrain execution.
- No credential or raw authentication token is displayed in activity messages, artifacts, exports, or error details.
- Closing the tray preserves project, camera context, and prompt draft.

## Journey 4: ask for a change and follow its consequences

From Electronics, submit: “Make this possible to assemble without soldering.” Watch the request, move to another station while work runs, then inspect the result.

### Acceptance

- The submitted message appears once, immediately, with a real pending/running state. Double submission cannot start duplicate work accidentally.
- The planner receives the request and records the relevant intent before downstream specialist work is reported as applied.
- Status identifies real active work in plain language. Streamed model prose remains separate from authoritative project state.
- The user can tell which disciplines are affected and why. Stage changes do not imply fabrication files were generated unless corresponding artifacts exist.
- The previous usable geometry remains inspectable while generation runs. If visible artifacts belong to an earlier revision, the UI identifies that fact.
- Switching projects or stations does not send streamed output or completed changes to the wrong project.
- A completed change includes its summary, result or proposal, affected stations, and resulting revision. A plan-only result is labeled as a plan or proposal.
- A change invalidating older artifacts makes their revision status visible; those artifacts are not silently included as current in a build package.
- A user can inspect the final result without needing to read every streamed token.

## Journey 5: interrupt, approve, and recover

Cancel an active run. Deny one concrete approval request if the runtime produces one. Test an unavailable runtime or intentional failed request. Retry after restoring the prerequisite.

### Acceptance

- Stop is visible while a run is active and is distinguishable from dismissing the conversation tray.
- Stopping a run acknowledges cancellation, stops further dependent scheduling, and leaves the last saved revision available. If a tool cannot stop immediately, the UI says it is stopping rather than claiming completion.
- Approval requests identify the requesting operation, project, relevant paths or external effect, and available decisions. There is no vague global “trust agent” action masquerading as scoped approval.
- Approval controls cannot be confused with accepting a design tradeoff. The application distinguishes tool authorization from product decisions.
- Denial and cancellation have terminal states and a next action; neither leaves an endless spinner.
- Errors identify the failed operation and useful next step without exposing secrets or hiding the existing project.
- A failed send preserves the draft or supplies a clear retry using the original request.
- Closing/reopening a tray or switching stations never implicitly approves, discards, or resubmits work.
- Reloading during or after a failure does not falsely mark an interrupted change as completed.

## Journey 6: inspect the evidence

Inspect an artifact, identify which revision generated it, return to its station, and inspect the parts list and decisions.

### Acceptance

- Every artifact has a human-readable name, type, domain, and revision. The user can open, reveal, or download the actual file through an appropriate action.
- Artifact actions have meaningful empty, missing-file, and unsupported-preview states.
- The UI differentiates rendered concept geometry, editable CAD, manufacturing files, source code, and documentation.
- Parts distinguish quantities, estimated prices, source links, and verification status where available. Missing price or availability is “not checked,” never zero or available by implication.
- Supplier links correspond to actual available source URLs. Verification has a clear meaning and is not inferred merely because a model named a part.
- A readable decision trail explains the current shape or part choice without exposing unnecessary internal tool details.
- A large artifact inspection surface has a clear close action and restores focus and spatial context when dismissed.

## Journey 7: prepare to get it made

Export the same project in DIY, some assembly, and finished modes. Open the produced package or folder and inspect its manifest and instructions.

### Acceptance

- Export is discoverable from the bottom cockpit and names the selected build mode before completion.
- The package actually exists and has a straightforward reveal/download action. A button that only changes a success label does not pass.
- A manifest binds project identity, export time, build preference, revision, and included artifacts. Exports cannot silently mix incompatible revisions.
- The package states what is included, what is missing, and its readiness accurately. Concept-only output is marked prepared for review; no fabrication or supplier confirmation is implied.
- DIY emphasizes parts, available fabrication files, assembly/programming steps, and unresolved checks.
- Some assembly identifies which work should be outsourced and what the user will assemble, including the no-soldering constraint when present.
- Finished mode supplies a quote-oriented handoff and acceptance requirements where known. It does not imply that a manufacturer has accepted the job or that an order was placed.
- Build modes change substantive instructions rather than only the folder name.
- A failed export explains the blocker and permits recovery without changing the project.
- Credentials, internal authentication state, unrelated local files, and other projects are excluded.

## Accessibility and responsive gates

- Every visible interactive control has an accessible name and a visible keyboard focus indicator.
- The station selector provides correct selected semantics and arrow-key movement. Optional `1`–`4` shortcuts do not fire while typing in editable controls.
- A keyboard user can create/open a project, switch stations, compose/send/stop, handle approval, inspect artifacts, and export.
- Contextual dialogs expose their title, keep keyboard focus inside while open where modal, close with Escape, and restore focus to the opener. Escape never erases a prompt draft.
- Streaming updates use appropriate status announcements without flooding a screen reader with token-by-token output.
- Essential meaning is present in text or accessible semantics, not only color, spatial placement, glow, or animation.
- Reduced motion produces a coherent mostly static flame and short station transitions. It is possible to inspect all project information without watching camera travel.
- Inspect at 1440×900, 1100×720, and a narrow window. There is no inaccessible submit button, clipped approval, horizontal page overflow, or unavoidable overlap between tray and cockpit.
- Text and controls remain legible against the brightest scene state. Small annotation text is supplementary; essential information can also be read in a flat surface.
- Opening long conversation and artifact content supports scrolling without moving the stage unintentionally.
- A WebGL failure has a useful message and retains access to project data and core controls where feasible.

## Priority rubric and evidence

**P0 — release blocker:** lost or overwritten project data; secrets disclosed; fabricated completion; unsafe implicit approval; an essential journey cannot complete or recover.

**P1 — fix before first usable release:** no clear entry point; missing example disclosure; prompt or export fails; disconnected runtime dead end; incoherent station continuity; inaccessible essential controls; stuck cancellation or approval.

**P2 — improve before final visual sign-off:** unreadable labels, excessive cockpit weight, confusing empty states, weak navigation feedback, avoidable motion discomfort, poor discovery of useful controls.

**P3 — polish:** spacing, copy, easing, and visual consistency with no meaningful obstruction.

For each observed finding, record reproduction steps, actual/expected behavior, severity, screenshot or log evidence where useful, and verification after a fix. Reviews must distinguish demonstrated failures from source-level concerns and untested hypotheses.

The final review should include actual interaction through all four stations; screenshots of the flame, example, electronics, software, contextual tray, and narrower window; one true runtime change when the connection permits; and a real exported package. If live generation cannot be tested, report that specific gap rather than describing the product as fully verified.
