import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Chess } from 'chess.js';

const [sceneArg, pgnArg, outputArg] = process.argv.slice(2);
if (!sceneArg || !pgnArg || !outputArg) {
  console.error('Usage: node generate-game.mjs <scene.json> <game.pgn> <public/.../manifest.json>');
  process.exit(1);
}

const cwd = process.cwd();
const scenePath = resolve(cwd, sceneArg);
const pgnPath = resolve(cwd, pgnArg);
const outputPath = resolve(cwd, outputArg);
const outputDirectory = dirname(outputPath);
const assetsDirectory = join(outputDirectory, 'assets');
const scene = JSON.parse(readFileSync(scenePath, 'utf8'));
const pgn = readFileSync(pgnPath, 'utf8');
const context = 'http://iiif.io/api/presentation/4/context.json';
const language = (value) => ({ en: [value] });
const pieceNames = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

function publicAssetBase(path) {
  const parts = resolve(path).split(sep);
  const publicIndex = parts.lastIndexOf('public');
  if (publicIndex < 0) throw new Error('Output must be inside a public directory so Model URLs can be inferred');
  return `/${[...parts.slice(publicIndex + 1, -1), 'assets'].join('/')}`;
}

async function sourceGltf(url) {
  if (/^https?:/i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load chess scene: ${response.status} ${url}`);
    return { gltf: await response.json(), base: url };
  }
  const path = isAbsolute(url) ? url : resolve(dirname(scenePath), url);
  return { gltf: JSON.parse(readFileSync(path, 'utf8')), base: pathToFileURL(path).href };
}

function absolutize(uri, base) {
  if (!uri || /^(?:data:|https?:)/i.test(uri)) return uri;
  const absolute = new URL(uri, base);
  if (absolute.protocol === 'file:') throw new Error(`Local glTF dependency needs a public URL: ${uri}`);
  return absolute.href;
}

function extractAsset(source, nodeName, name) {
  const gltf = structuredClone(source.gltf);
  const nodeIndex = gltf.nodes.findIndex((node) => node.name === nodeName);
  if (nodeIndex < 0) throw new Error(`Chess scene node not found: ${nodeName}`);
  const node = gltf.nodes[nodeIndex];
  if (node.matrix) throw new Error(`Node ${nodeName} uses a matrix; configure a decomposed source node instead`);
  if (name !== 'board') node.translation = [0, node.translation?.[1] || 0, 0];
  gltf.buffers?.forEach((buffer) => {
    buffer.uri = absolutize(buffer.uri, source.base);
  });
  gltf.images?.forEach((image) => {
    image.uri = absolutize(image.uri, source.base);
  });
  gltf.scene = 0;
  gltf.scenes = [{ name, nodes: [nodeIndex] }];
  return gltf;
}

function mainlineOnly(pgn) {
  let output = '';
  let variationDepth = 0;
  let inBraceComment = false;
  let inLineComment = false;
  let inHeader = false;
  let inHeaderQuote = false;

  for (const character of pgn) {
    if (inLineComment) {
      if (character === '\n') inLineComment = false;
      if (variationDepth === 0) output += character;
      continue;
    }
    if (inBraceComment) {
      if (character === '}') inBraceComment = false;
      if (variationDepth === 0) output += character;
      continue;
    }
    if (inHeader) {
      output += character;
      if (character === '"') inHeaderQuote = !inHeaderQuote;
      if (character === ']' && !inHeaderQuote) inHeader = false;
      continue;
    }
    if (character === '[' && variationDepth === 0) {
      inHeader = true;
      output += character;
    } else if (character === '{') {
      inBraceComment = true;
      if (variationDepth === 0) output += character;
    } else if (character === ';') {
      inLineComment = true;
      if (variationDepth === 0) output += character;
    } else if (character === '(') {
      variationDepth += 1;
    } else if (character === ')' && variationDepth > 0) {
      variationDepth -= 1;
      if (variationDepth === 0) output += ' ';
    } else if (variationDepth === 0) {
      output += character;
    }
  }

  if (variationDepth) throw new Error('PGN contains an unclosed variation');
  return output;
}

function cleanComment(comment) {
  if (!comment) return '';
  const cleaned = comment
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned === '#' ? '' : cleaned;
}

function parseGame(text) {
  const chess = new Chess();
  chess.loadPgn(mainlineOnly(text), { strict: true });
  const moves = chess.history({ verbose: true });
  if (!moves.length) throw new Error('PGN contains no moves');
  const comments = new Map(chess.getComments().map(({ fen, comment }) => [fen, cleanComment(comment)]));
  return { headers: chess.getHeaders(), moves, comments };
}

function initialPieces(fen) {
  const counters = new Map();
  const pieces = new Map();
  for (const piece of new Chess(fen).board().flat().filter(Boolean)) {
    const key = `${piece.color}-${piece.type}`;
    const number = (counters.get(key) || 0) + 1;
    counters.set(key, number);
    pieces.set(piece.square, { id: `${key}-${number}`, color: piece.color, type: piece.type });
  }
  return pieces;
}

function assertPosition(pieces, fen, ply) {
  const expected = new Chess(fen)
    .board()
    .flat()
    .filter(Boolean)
    .map(({ square, color, type }) => `${square}:${color}${type}`)
    .sort();
  const actual = [...pieces].map(([square, { color, type }]) => `${square}:${color}${type}`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Position tracking failed after ply ${ply}`);
}

function gamePositions(moves) {
  const pieces = initialPieces(moves[0].before);
  const positions = [[...pieces].map(([square, piece]) => ({ square, ...piece }))];
  moves.forEach((move, index) => {
    const piece = pieces.get(move.from);
    if (!piece || piece.color !== move.color || piece.type !== move.piece)
      throw new Error(`No matching piece for ${move.san} from ${move.from}`);
    pieces.delete(move.from);
    if (move.captured) {
      const captureRank = Number(move.to[1]) + (move.flags.includes('e') ? (move.color === 'w' ? -1 : 1) : 0);
      const captureSquare = `${move.to[0]}${captureRank}`;
      if (!pieces.delete(captureSquare)) throw new Error(`Captured piece missing on ${captureSquare} for ${move.san}`);
    }
    piece.type = move.promotion || piece.type;
    pieces.set(move.to, piece);
    if (move.flags.includes('k') || move.flags.includes('q')) {
      const rank = move.color === 'w' ? '1' : '8';
      const rookFrom = `${move.flags.includes('k') ? 'h' : 'a'}${rank}`;
      const rookTo = `${move.flags.includes('k') ? 'f' : 'd'}${rank}`;
      const rook = pieces.get(rookFrom);
      if (!rook?.type || rook.type !== 'r') throw new Error(`Castling rook missing on ${rookFrom}`);
      pieces.delete(rookFrom);
      pieces.set(rookTo, rook);
    }
    assertPosition(pieces, move.after, index + 1);
    positions.push([...pieces].map(([square, value]) => ({ square, ...value })));
  });
  return positions;
}

function squarePoint(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return scene.coordinates.a1.map(
    (value, axis) => value + scene.coordinates.file[axis] * file + scene.coordinates.rank[axis] * rank
  );
}

function pointTarget(source, point) {
  return {
    type: 'SpecificResource',
    source: { id: source, type: 'Scene' },
    selector: [{ type: 'PointSelector', x: point[0], y: point[1], z: point[2] }],
  };
}

function model(assetBase, color, type) {
  const name = `${color === 'w' ? 'white' : 'black'}-${pieceNames[type]}`;
  return {
    id: `${assetBase}/${name}.gltf`,
    type: 'Model',
    format: 'model/gltf+json',
    label: language(name.replace('-', ' ')),
  };
}

const translation = ([x, y, z]) => [{ type: 'TranslateTransform', x, y, z }];
const variantKey = ({ id, type }) => `${id}-${type}`;

function pieceVariants(positions) {
  const variants = new Map();
  for (const pieces of positions) {
    for (const piece of pieces) {
      const key = variantKey(piece);
      if (!variants.has(key)) variants.set(key, { key, ...piece, base: squarePoint(piece.square) });
    }
  }
  return [...variants.values()];
}

function moveLabel(move) {
  const number = Number(move.before.split(' ')[5]);
  return `${number}${move.color === 'w' ? '.' : '…'} ${move.san}`;
}

function gameManifest(game, positions, assetBase) {
  const slug = basename(outputDirectory);
  const base = `${scene.idBase}/${slug}`;
  const outerScene = `${base}/scene`;
  const boardPainting = `${base}/board-painting`;
  const labels = ['Initial position', ...game.moves.map(moveLabel)];
  const variants = pieceVariants(positions);
  const initial = new Set(positions[0].map(variantKey));
  const piecePaintings = variants.map((piece) => {
    const id = `${base}/piece/${piece.key}`;
    return {
      id,
      type: 'Annotation',
      motivation: ['painting'],
      body: {
        id: `${id}/body`,
        type: 'SpecificResource',
        source: model(assetBase, piece.color, piece.type),
        transform: translation(piece.base),
      },
      target: { id: outerScene, type: 'Scene' },
      ...(!initial.has(piece.key) ? { behavior: ['hidden'] } : {}),
    };
  });
  const comments = labels.map((label, index) => {
    const move = game.moves[index - 1];
    return {
      id: `${base}/step/${index}`,
      type: 'Annotation',
      motivation: ['commenting'],
      label: language(label),
      body: {
        type: 'TextualBody',
        value: move
          ? [
              `${move.color === 'w' ? 'White' : 'Black'}: ${move.san} (${move.from} → ${move.to})${move.captured ? `, capturing ${pieceNames[move.captured]}` : ''}.`,
              game.comments.get(move.after),
            ]
              .filter(Boolean)
              .join('\n')
          : 'The standard initial chess position.',
        format: 'text/plain',
      },
      // Intentionally target-less: move annotations drive the external list
      // and activation state, so ScenePanel must not invent a 3D marker.
    };
  });
  const activations = comments.map((comment, index) => {
    const position = new Map(positions[index].map((piece) => [variantKey(piece), piece]));
    const id = `${base}/activation/${index}`;
    return {
      id,
      type: 'Annotation',
      motivation: ['activating'],
      target: { id: comment.id, type: 'Annotation' },
      body: {
        id: `${id}/body`,
        type: 'List',
        items: variants.map((variant) => {
          const piece = position.get(variant.key);
          return {
            id: `${id}/piece/${variant.key}`,
            type: 'SpecificResource',
            source: { id: `${base}/piece/${variant.key}`, type: 'Annotation' },
            action: [piece ? 'show' : 'hide'],
            ...(piece
              ? {
                  transform: translation(squarePoint(piece.square).map((value, axis) => value - variant.base[axis])),
                }
              : {}),
          };
        }),
      },
    };
  });
  const white = game.headers.White || 'White';
  const black = game.headers.Black || 'Black';
  return {
    '@context': context,
    id: `${base}/manifest`,
    type: 'Manifest',
    label: language(`${game.headers.Event || 'Chess game'} · ${white} vs ${black}`),
    summary: language(`Select any move annotation to show that exact position from the game ${white}–${black}.`),
    metadata: Object.entries(game.headers).map(([key, value]) => ({ label: language(key), value: language(value) })),
    rights: scene.rights,
    requiredStatement: { label: language('Attribution'), value: language(scene.attribution) },
    homepage: [
      { id: scene.homepage || scene.source, type: 'Text', format: 'text/html', label: language('Source chess model') },
    ],
    items: [
      {
        id: outerScene,
        type: 'Scene',
        label: language('Playable chess game'),
        backgroundColor: '#000000',
        items: [
          {
            id: `${outerScene}/paintings`,
            type: 'AnnotationPage',
            items: [
              {
                id: boardPainting,
                type: 'Annotation',
                motivation: ['painting'],
                body: {
                  id: `${assetBase}/board.gltf`,
                  type: 'Model',
                  format: 'model/gltf+json',
                  label: language('Chessboard'),
                },
                target: { id: outerScene, type: 'Scene' },
              },
              {
                id: `${base}/camera-painting`,
                type: 'Annotation',
                motivation: ['painting'],
                body: {
                  id: `${base}/camera`,
                  type: 'PerspectiveCamera',
                  label: language('White-side board view'),
                  fieldOfView: scene.camera.fieldOfView,
                  near: 0.01,
                  far: 100,
                  interactionMode: ['orbit'],
                  lookAt: { id: boardPainting, type: 'Annotation' },
                },
                target: pointTarget(outerScene, scene.camera.position),
              },
              ...piecePaintings,
              {
                id: `${base}/environment-painting`,
                type: 'Annotation',
                motivation: ['painting'],
                body: {
                  id: `${base}/environment`,
                  type: 'ImageBasedLight',
                  intensity: 1,
                  environmentMap: { id: scene.environmentMap, type: 'Image', format: 'image/vnd.radiance' },
                },
                target: { id: outerScene, type: 'Scene' },
              },
            ],
          },
        ],
        annotations: [
          {
            id: `${outerScene}/game-steps`,
            type: 'AnnotationPage',
            items: comments.flatMap((comment, index) => [comment, activations[index]]),
          },
        ],
      },
    ],
  };
}

const source = await sourceGltf(scene.source);
const game = parseGame(pgn);
const positions = gamePositions(game.moves);
const assetBase = publicAssetBase(outputPath);
mkdirSync(assetsDirectory, { recursive: true });

for (const [name, node] of Object.entries({ board: scene.nodes.board, ...scene.nodes.pieces })) {
  writeFileSync(
    join(assetsDirectory, `${name}.gltf`),
    `${JSON.stringify(extractAsset(source, node, name), null, 2)}\n`
  );
}

const manifest = gameManifest(game, positions, assetBase);
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Generated ${outputPath}: ${game.moves.length} plies, ${positions.length} positions, ${Object.keys(scene.nodes.pieces).length + 1} derived model assets.`
);
