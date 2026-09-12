# Holo 0.1.2 release validation

- TypeScript check, all **33 automated tests**, and the production build passed.
- Independent UX and code reviews completed; reported fixes were rechecked. See current-controls-review.md and generation-latency-review.md.
- Browser interaction review covered desktop and 680×620, keyboard focus, persistent Activity, restrained scroll following, multiline drafts, model-depth normalization, and successful provisional-to-canonical scene replacement using an isolated fake runtime.
- Two isolated live Luna/low calls returned valid sketch/concept geometry in 10.047s and 24.084s. No end-to-end final-CAD speed claim is made.
- The Apple silicon bundle and installed application both passed `codesign --verify --deep --strict`. Installed version is 0.1.2. The app is ad-hoc signed, not notarized.
- The installed bundle's workshop was started through Electron's Node mode with an isolated temporary data directory. Its loopback runtime, project-list, and static application endpoints returned successfully; the project list was empty, as expected. It did not connect or generate against production data.
- Installation occurred only after verifying all production projects were idle. Project metadata and preferences were backed up; all **69 existing artifact hashes** were verified unchanged afterward.
- The Mac locked after browser review, so a post-install native visual check/relaunch awaits unlock. The prior application bundle is retained locally for rollback until that check.

ZIP: Holo-0.1.2-arm64-mac.zip — 135,523,761 bytes.

SHA-256: `d2e62c913dbb9fdc5c3e06be9f40ac8939c8b878594cfde13719b7a368468cfa`.
