# Available capabilities

Checkpoint: `empty-board` or `posted-board`, both beside the noticeboard.
Experiments: `patrol`, `approve`, `execute`, `feedback`, `picnic`.
Learner actions: `start`, `post`, `run`, `approve`, `append`, `empty-apples`, `continue`.
Tools: `read_notice`, `walk_to`, `inspect_pantry`, `take_one`, `deliver_item`.
Only tool IDs selected by a stage become provider schemas and dispatchable handlers.

Source excerpts: `patrol`, `evaluate`, `read-schema`, `execute`, `feedback`.
Use `{{source:feedback}}` in Markdown to embed the marked executable region.
`// +` on a line marks a teaching addition. The build fails for missing excerpts.

Presentation: explicit slide navigation shares one experiment controller.
Scrolling never changes steps. All slides are also present in the static HTML. Optional
narration is a local audio URL plus transcript on TeachingStep. No audio is required.
Replay consumes snapshots and timed events; it cannot run experiments.

Article folders live in `articles/<article-id>/`. Each owns its brief, `steps.ts`,
Markdown and `article.ts` manifest. Register the manifest in
`article-sets/registry.ts`; do not copy the shared world or runtime.

Step `context` selects one of these views from `context.ts`: `unobserved-notice`,
`tool-availability`, `held-observation`, `feedback`, `pantry-observation`.
`actionLabels` may override the shared labels in `capabilities.ts`. Step IDs are
stable identities; display order may change. Briefs are never model context.
