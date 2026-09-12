# Holo 0.1.1

Generated projects now open on their full assembly instead of whichever mesh was exported last. Existing project metadata is migrated locally without regenerating geometry or changing artifact bytes. Custom scene parts take precedence over an inherited example renderer.

The default cockpit is one compact bottom row. The current perspective control opens navigation, model/part selection, activity, files, history, export, and settings. An optional expanded cockpit retains quick controls. Centered headings, generic geometry labels, and the permanent status/help row are removed.

Files now separates current deliverables from history. A later software revision does not mark the latest design and electronics as historical. Build packages include a primary assembly pointer, current sets for each perspective, a DELIVERABLES.md index, and manifest version 2 with hashes and current/history labels. Historical files remain at their original paths. Current means latest recorded output, not engineering approval.

Routine viewing is read-only; uncommitted workspace files cannot become accepted artifacts by opening the file list. Changes to canonical domain data without a replacement deliverable set clear outdated current files while retaining their history. Explanation-only turns preserve current outputs.

Type checking, the complete automated test suite, a production build, and independent browser UX/creative review were performed. Review covered desktop and 680×620 windows, full assembly framing, part selection and return, compact/expanded layouts, current/history views, and nested keyboard focus. An existing project export was checked byte-for-byte against its original artifacts. No paid agent turn was needed for these checks.

This release does not change model routing, specialist scheduling, approval policy, or introduce the planned activity swimlanes. Those belong to the next pass. Generated CAD, electronics, and software still require their appropriate engineering checks.

Source packaging commands now refuse to start with less than 2 GiB of free working space. This protects against large partial Electron bundles on a full disk.

Apple silicon macOS developer preview. Ad-hoc signed; not notarized.
