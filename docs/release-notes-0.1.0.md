# Holo 0.1.0

The first usable macOS invention studio: one idea in the spotlight, four perspectives around it, and a real Codex workshop behind the bottom prompt.

- Explore Plan, Design, Electronics, and Software with smooth camera transitions, a procedural flame, component selection, reference assembly views, and generated GLB/STL previews.
- Give the planner an intention. Persistent specialist conversations work in their own domains, and cross-domain proposals return to planning for arbitration.
- Inspect real files, decisions, and revision history. Export a ZIP for DIY, mixed assembly, or supplier review with a BOM, briefs, artifacts, and file hashes.
- Keep projects, drafts, preferences, and artifacts locally. Model work starts only after a request, using your Codex account or API billing.

The Apple silicon download is a developer preview, ad-hoc signed and not Apple-notarized. Unzip and move Holo.app to Applications. Node.js is bundled; a signed-in Codex installation is needed for agents. Blender and other engineering tools are separate installations.

The reference PCB views are conceptual. Generated engineering needs review; supplier-confirmed pricing, automated purchasing, manufacturing-ready routing, and physical validation are future work. Depending on the installed Blender environment, local modeling may ask for an explicit tool approval.

Validation: TypeScript and production build pass; 18 automated tests cover the engine, Codex protocol, exports, cancellation, isolation, and restart persistence. A live Codex planner/design run executed Blender and produced committed BLEND/GLB/source artifacts. ZIP bytes and manifest hashes were independently checked. Creative and UX reviews, their fixes, and live-validation details are in docs/.
