# Chess game Manifest generator

`generate-game.mjs` converts a JSON glTF chess scene plus a legal PGN/SAN game into a IIIF Presentation 4 Manifest. It extracts one same-origin glTF asset per board/piece type while leaving the large buffer and textures pinned upstream. Each physical piece is painted once; selecting a move applies one atomic activation List that updates only the transforms and visibility needed for that position.

Generate the included Opera Game fixture from the repository root:

```sh
node apps/scene-prototype/public/hotlink-3d/chess/generate-game.mjs \
  apps/scene-prototype/public/hotlink-3d/chess/a-beautiful-game.json \
  apps/scene-prototype/public/hotlink-3d/chess/opera-game.pgn \
  apps/scene-prototype/public/hotlink-3d/chess/opera-game/manifest.json
```

The output must live below a `public` directory so the script can derive same-origin Model URLs. The scene descriptor names the board and twelve colour/piece nodes and maps chess squares into its 3D coordinate system. PGN parsing and move legality are delegated to `chess.js`.

Check the generated Scene and activation graph with:

```sh
node apps/scene-prototype/public/hotlink-3d/chess/check-game.mjs \
  apps/scene-prototype/public/hotlink-3d/chess/opera-game/manifest.json \
  apps/scene-prototype/public/hotlink-3d/chess/opera-game.pgn
```

Passing the PGN also checks that every SAN label and authored comment is present in the generated IIIF annotations.
