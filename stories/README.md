# Exploring the library

Run `pnpm storybook` and open http://127.0.0.1:6012. This is separate from the polygons playground (6006)
and Vault's existing Vite demo (3004). `pnpm build-storybook` produces a static site.

All stories, reusable example components, fixtures, CSS, and browser checks live in this folder.
Storybook's small configuration lives in `.storybook/`.

- **Start here / Guide** introduces the available tasks.
- **Read a manifest / Viewer** covers pages, facing pages, right-to-left reading, rotation, metadata,
  annotation layers, Atlas drawing, textual painting content, and audio controls.
- **Annotations / Edit a region** uses Atlas for polygons, lines, vertex editing, boxes, line boxes,
  stamps, freehand, curves, external snapping, grid snapping, and automatic touch input.
- **Annotations / Live IIIF collections** uses institutional manifests and image services.
- **Configuration / SVG appearance** uses Atlas for themes, optional visual feedback, and unbounded editing.
- **Checks / Annotation commands** holds automated interaction sub-stories and the standalone SVG adapter example.

User-facing stories explain what to try and do not autoplay edits. Use Controls to change props. Keep future
regression scenarios under Checks and link them to their user-facing example; there is no requirement to
backfill every existing feature with a scripted interaction.

## Editing in Atlas

`AtlasEditorExample.tsx` uses Canvas Panel and the public annotation request/control APIs. Choose Hand for
pan/pinch navigation, then an editing tool to draw. Finish shape ends drawing; Save annotation completes the
request. Existing tools use the pointer's type automatically, including larger hit areas for touch. A second
contact cancels an unfinished edit. `EditorExample.tsx` demonstrates the standalone SVG input adapter.

The notebook SVG and quiet generated audio tone are local fixtures. They keep regression tests independent
of network access. No demo mounts the monolithic application entrypoint.

## Real-world IIIF sources

The Theseus IIIF skill's curated catalog supplied these examples. `iiif-examples.ts` holds their original URLs;
we load the institutional manifests unchanged and do not mirror their media. Drawn regions are illustrative
and stay local; saving does not write to an institution. Links and credits are shown in each live story.

| Story      | Institution and object                                                                                                                             | IIIF coverage                                                             | Reuse information                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Manuscript | [V&A, Codex Forster I](https://iiif.vam.ac.uk/collections/MSL:1876:Forster:141:I/manifest.json), starting at 001r                                  | Presentation 2 / Image 2; Canvas coordinates differ from image dimensions | [V&A terms](https://www.vam.ac.uk/articles/terms-of-use)                      |
| Map        | [Durham University Library, Map of Sudan showing railways (1908)](https://iiif.durham.ac.uk/manifests/trifle/32150/t1/m9/c6/t1m9c67wm912/manifest) | Presentation 2 / Image 2; large tiled map and open line annotation        | [CC BY-NC-ND 4.0](http://creativecommons.org/licenses/by-nc-nd/4.0/legalcode) |
| Object     | [TU Delft, Dubbel Bauernfeind-prisma](https://heritage.tudelft.nl/iiif/manifests/009d29e8-e196-451f-8422-265b6ff27fb1/manifest.json)               | Presentation 3 / Image 3; Dutch language maps and cubic regions           | Manifest does not declare a rights statement; consult TU Delft before reuse   |

Live examples require internet access and can change independently of this repository. A successful manifest
fetch alone does not establish image availability. The optional live browser checks also require successful
image tile responses and an active Atlas editor. Verification was performed on 1 November 2026.

## Checks

```sh
pnpm typecheck:stories
pnpm exec playwright install chromium
pnpm test:stories
# Optional external-service integration checks:
CHECK_LIVE_IIIF=1 pnpm test:stories --grep 'live IIIF'
```

The default suite loads every local story and exercises saving, history, curve previews, Atlas pointer input,
focus loss, touch drawing and vertex dragging, and cancellation by a second contact. Chromium touch emulation
is useful regression coverage; physical mobile browser testing remains necessary. The suite starts the dev
server when needed and reuses an existing one locally. CI also builds the static Storybook. Unit regressions
for geometry and request lifecycle remain in `__tests__/polygon-selectors.test.ts` and `__tests__/polygon-requests.test.ts`.
