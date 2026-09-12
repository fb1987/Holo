# Artifact selection and domain revisions

The stage opens `Project.primaryAssemblyId`, validated against the current design deliverable set. It never selects the last mesh in the artifact array. Individual printable parts remain independently inspectable and do not replace the assembly when opened manually.

`Artifact.role` describes presentation and file purpose: `assembly`, `part`, `source`, `render`, `document`, or `other`. An assembly preview must be a design-domain GLB or STL. Prefer one complete GLB with materials, with separate STL files for printable parts. Roles do not certify physical fit, compatibility, or fabrication readiness.

`Project.domainState` records each domain's current deliverable IDs and the global revision at which that set was published. An artifact's own `revision` continues to identify its immutable stored bytes. A later software commit does not make the current mechanical design or electronics historical.

New agent output follows this contract:

- A nonempty artifact result is the domain's **complete current deliverable set**. Re-list unchanged supporting files and the assembly when they remain applicable. Registration snapshots those files at the new revision. New or changed files found by the domain scan also join the set.
- Empty results preserve earlier deliverables only when the canonical domain specification is unchanged. Explanation-only turns do not advance domain deliverable state. Changed goals, decisions, or BOM data without replacement artifacts invalidate the earlier planning or electronics files for that domain, just as changed geometry invalidates an old model.
- A changed design scene without current assembly output clears the generated assembly selection. An empty design set is authoritative and must not fall back to older geometry on reload. Historical models remain available for explicit inspection.
- `inputRevisions` records the domain revision context available at generation start. It is neither a declaration that every input is a required dependency nor a compatibility approval. Exported `changedInputs` identifies subsequent changes for review without automatically rejecting or approving the deliverables.

Legacy projects have no complete-set metadata or input snapshots. Migration selects the newest artifact batch independently for each domain. Within current design files, a complete GLB takes precedence over STL; filenames identifying brackets, inserts, fasteners, and other individual parts are excluded from assembly inference. A valid explicit role and primary pointer take precedence over inference. Migration does not change geometry or original artifact bytes, invent dependency records, or change project recency. Examples with completed user-generated work lose their example label; untouched examples retain it.

Build package manifest version 2 includes the primary assembly, domain current sets, recorded input context, and a `current` or `historical` status for each file. For compatibility, `currentRevision` remains present but now means membership in the domain's current set; its meaning is stated explicitly in the manifest. All historical bytes retain their original paths. `DELIVERABLES.md` indexes the current handoff files so recipients do not have to infer them from filenames or global revision numbers. Engineering compatibility remains `not-assessed`.

Regression coverage includes an actual asymmetric two-body GLB, assembly-plus-part export ordering, separate domain revisions, persistent legacy migration, explicit roles, stale pointer recovery, unknown input history, geometry-only correction invalidation, and preservation through explanation-only turns. Fixtures contain no private project data.
