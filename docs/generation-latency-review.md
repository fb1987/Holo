# Generation latency review — 0.1.2

The reviewed medium recycling-bin run took **453.3 seconds (7m 33s)**. It used **gpt-6-astra / low for every turn**, not different models by role. Release 0.1.1 explicitly deferred model routing and specialist scheduling; its artifact/UI changes could not accelerate this run.

| Stage                | Elapsed | Evidence                                    |
| -------------------- | ------: | ------------------------------------------- |
| Initial planning     |  49.5 s | Request → committed planning response       |
| Design               | 366.4 s | Planning commit → committed design response |
| Planning arbitration |  37.4 s | Design commit → final planning response     |

The design agent attempted to create its Blender generator with two long shell heredocs. Both failed with `can't create temp file for here document: operation not permitted`. It then emitted the generator a third time using `apply_patch`, which succeeded. The two additional emissions account for approximately **125 seconds** between the failed writes and the successful patch. This was repetitive code generation, not rendering.

Blender also exited with signal 139 during a sandboxed import, then ran after the app's normal approval flow. A boolean-union problem led to a second model/render attempt and a handoff documenting unresolved mesh limitations. About 36 seconds elapsed within the design tool calls (including waits/approval handling); the remaining time was between calls or producing responses. These timestamps cannot distinguish provider queuing from model inference, and are not a CPU profiler.

Planning's final review reconciled provisional capacity and footprint estimates, without asking design to rerun. For this object only design was affected; parallelizing electronics/software would not have helped. Existing domain conversation IDs are reused on subsequent requests. A new project correctly starts new domain contexts.

## Changes in this pass

- Empty model selection now means an automatic team: Astra/high for planning and arbitration; Luna at the user's selected depth for execution. Fresh defaults remain high; saved low preferences remain low for execution. Sol is an availability fallback if Luna is absent, then the runtime default. Explicit model selection applies that model/depth to the whole team. Available models/efforts come from the signed-in Codex runtime.
- Specialist prompts prefer `apply_patch`, reuse existing generators, avoid workspace rediscovery when canonical state is already supplied, and send only current artifact metadata. They reserve recommendations for actual decisions requiring another domain's authority.
- Two small, optional Luna/low previews run off the canonical critical path for empty projects. The first sketches the unapproved request concurrently with planning. The second refines the approved brief concurrently with design. Existing models remain visible during edits.
- Preview threads are ephemeral, read-only, cannot request broader permissions, and are unsubscribed after completion. They use a compact bounded primitive schema, do not generate files, never become revisions or exports, and are capped at 45/60 seconds. A refinement cancels unfinished rough work; real design completion, cancellation, failure, or supersession discards pending previews. Unsupported or malformed previews simply leave the last usable view.
- Changes now retain start/end timestamps and per-turn model, depth, completion state, tool-call count and formatting retries. Activity exposes the latest run's details. No private reasoning trace is persisted in this telemetry.

## Live preview measurements

Two isolated Codex calls on this Mac, using Luna/low and the recycling-bin concept:

| Pass                                   | Observed latency | Returned geometry |
| -------------------------------------- | ---------------: | ----------------- |
| Initial sketch                         |         10.047 s | 8 primitives      |
| Concept from a supplied approved brief |         24.084 s | 16 primitives     |

These are **single-call observations**, not p50/p95 guarantees or an end-to-end replay. The second pass starts after planning, so its 24 seconds are additional to planning latency, while real design work runs concurrently. Neither result demonstrates that final CAD generation is faster. The prototype deliberately uses two bounded visual passes rather than launching redundant expensive jobs at fixed clock times. The user can inspect the final run's actual timings before deciding whether to expand this into staged generation.

## Remaining work

Dependency-aware specialist scheduling, automatic quality-based escalation to Sol, deterministic CAD libraries/runners, reusable design patterns, and a layered workflow that feeds validated intermediate artifacts forward remain phase-two work. This pass does not change the normal design sandbox or auto-approve broader access. Blender's native sandbox import failure is still a limitation when using that Python installation. Preview geometry is a provisional visual hypothesis, not a manufacturable object.

A useful next benchmark compares several representative tasks with the same final deliverable/quality requirements. Measure time to first visual, time to useful assembly, total completion, retries, tool failures, tokens, and geometric checks. Compare automatic Luna execution against explicit Astra before adding more parallel workers.

The implementation follows the principles in [OpenAI's latency guide](https://developers.openai.com/api/docs/guides/latency-optimization) and uses the runtime model catalog, per-turn effort and transient thread lifecycle described in [Codex App Server](https://learn.chatgpt.com/docs/app-server). The installed runtime's generated JSON schema was also checked for read-only and ephemeral thread options.
