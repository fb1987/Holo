# Desktop validation — 11 September 2026

The Apple silicon production app was built with Electron, copied into the user's Applications directory, and launched through macOS. Its application signature passed `codesign --verify --deep --strict`. The app is ad-hoc signed, without Apple notarization.

Observed in the installed app:

- The native window opens the full-screen flame and bottom cockpit. Creating the reference wheel produces a persistent project with real example artifacts.
- Codex connects to the existing ChatGPT subscription; model discovery is live. Blender and Python are detected in the local workshop. KiCad is correctly reported as not detected on this Mac.
- An unsent draft and reduced-motion setting survive a complete quit/relaunch. The workshop changed from one randomly assigned port to another; the selected project, exact draft, and motion preference were restored from durable workshop preferences. The test draft was cleared afterward, and full motion restored.
- The actual revision-3 Blender GLB from the live engine validation loads automatically in the spotlight. Its complete geometry fits above the bottom cockpit. Imported meshes have a generated-model label and do not incorrectly expose reference-only PCB/explosion controls or assume conceptual envelope dimensions.
- The project selector contains the wheel reference and the genuine Blender validation project. Review-only fixture projects were archived outside the application data.

A first native tool-discovery attempt reported Blender unavailable; a full restart detected it. The runtime now retries an import probe once within a bounded startup budget and can recheck missing tools during an explicit Connect/Refresh action. This is separate from the documented per-command approval requirement when executing Blender inside a restricted agent workspace.

The final package includes production dependencies and the local Node workshop. It does not bundle authentication state, user projects, the validation artifacts, or the user's Blender environment. Those remain on the local Mac.
