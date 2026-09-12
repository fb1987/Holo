# Holo 0.1.2

Project identity moves to the top left, clear of the macOS window controls. The bottom prompt stays compact, with a quick perspective chooser and a separate options button. Expanded cockpit mode and visible zoom/reset buttons are removed; direct model navigation remains available.

Activity is an optional right-side panel that stays open while typing, sending requests, and changing perspectives. It follows new updates only when the reader is at the bottom, offers a jump back to latest, and exposes actual model/depth/timing details for new runs. Files, history, project intent, exports and settings remain available from options.

Automatic model selection now routes planning to Astra/high and execution to Luna at the selected depth. Explicit model overrides still apply to all perspectives; missing models fall back to available runtime choices. The first pass did not previously include this routing.

New empty projects can show a provisional Luna sketch during planning and a refined concept during design, before the real model takes over. These transient read-only previews are kept out of saved designs and build packages. Two isolated live calls produced a first sketch in 10.0 seconds and a refined concept in 24.1 seconds after its input brief. Timing varies; final CAD speed has not been established by those measurements.

See generation-latency-review.md for the 7m33 recycling-bin diagnosis, bounded preview architecture and remaining phase-two work. Apple silicon macOS developer preview; ad-hoc signed, not notarized.
