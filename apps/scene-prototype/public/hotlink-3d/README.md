# Hot-linked Presentation 4 model fixtures

This isolated fixture set contains one IIIF Presentation 4 Manifest per remote model. Open `/hotlink-3d/index.json` for the experiment-friendly catalogue, `/hotlink-3d/collection.json` for a IIIF Collection, or any file under `/hotlink-3d/manifests/` directly.

The glTF assets come from the Khronos glTF Sample Assets repository pinned to commit `2bac6f8c57bf471df0d2a1e8a8ec023c7801dddf`. The OBJ, STL, PLY, FBX, USDZ, and HDR examples come from Three.js release `r184`. Pinning makes the fixture bytes stable; these public hosts are intended for development tests rather than production asset delivery.

`generate-splat.mjs` deterministically produces the compact `assets/iiif-mark.splat` fixture from authored geometry. The generated data is dedicated to the public domain under CC0. Drei's official example uses `cakewalk/splat-data/nike.splat`, which informed the renderer integration, but that repository does not declare rights for the Nike data and is therefore not shipped here.

`catalog.json` records the expected feature coverage and upstream payload size. Entries marked `unsupported-format` intentionally exercise diagnostics or custom renderers. Rights are included on manifests when the upstream asset declares CC0 or CC BY 4.0; consult each upstream model's legal metadata before redistributing its bytes.

Regenerate the derived manifests, index, and Collection after editing the catalogue:

```sh
node apps/scene-prototype/public/hotlink-3d/generate-splat.mjs
node apps/scene-prototype/public/hotlink-3d/generate.mjs
```

Run the normal structural audit, or explicitly opt into live reachability, byte-size, and browser-CORS checks for all pinned payloads:

```sh
pnpm --dir apps/scene-prototype fixtures:audit
pnpm --dir apps/scene-prototype fixtures:audit:network
```
