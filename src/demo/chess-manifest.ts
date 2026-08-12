import { Chess, type Move, type PieceSymbol } from 'chess.js';

const language = (value: string) => ({ en: [value] });
const pieceNames: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};
const coordinates = {
  a1: [0.21875, 0, -0.21875],
  file: [-0.0625, 0, 0],
  rank: [0, 0, 0.0625],
};

type Piece = { id: string; color: 'w' | 'b'; type: PieceSymbol };
type PositionedPiece = Piece & { square: string };

function initialPieces(fen: string) {
  const counters = new Map<string, number>();
  const pieces = new Map<string, Piece>();
  for (const piece of new Chess(fen).board().flat()) {
    if (!piece) continue;
    const key = `${piece.color}-${piece.type}`;
    const number = (counters.get(key) || 0) + 1;
    counters.set(key, number);
    pieces.set(piece.square, { id: `${key}-${number}`, color: piece.color, type: piece.type });
  }
  return pieces;
}

function assertPosition(pieces: Map<string, Piece>, fen: string, ply: number) {
  const expected = new Chess(fen)
    .board()
    .flat()
    .flatMap((piece) => (piece ? [`${piece.square}:${piece.color}${piece.type}`] : []))
    .sort();
  const actual = [...pieces].map(([square, { color, type }]) => `${square}:${color}${type}`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Position tracking failed after ply ${ply}`);
}

function gamePositions(moves: Move[]) {
  const pieces = initialPieces(moves[0].before);
  const snapshot = (): PositionedPiece[] => [...pieces].map(([square, piece]) => ({ square, ...piece }));
  const positions = [snapshot()];

  for (const [index, move] of moves.entries()) {
    const piece = pieces.get(move.from);
    if (!piece) throw new Error(`No piece found on ${move.from} for ${move.san}`);
    pieces.delete(move.from);

    if (move.captured) {
      const rank = Number(move.to[1]) + (move.flags.includes('e') ? (move.color === 'w' ? -1 : 1) : 0);
      if (!pieces.delete(`${move.to[0]}${rank}`)) throw new Error(`Captured piece missing for ${move.san}`);
    }

    piece.type = move.promotion || piece.type;
    pieces.set(move.to, piece);

    if (move.flags.includes('k') || move.flags.includes('q')) {
      const rank = move.color === 'w' ? '1' : '8';
      const rookFrom = `${move.flags.includes('k') ? 'h' : 'a'}${rank}`;
      const rookTo = `${move.flags.includes('k') ? 'f' : 'd'}${rank}`;
      const rook = pieces.get(rookFrom);
      if (!rook) throw new Error(`Castling rook missing on ${rookFrom}`);
      pieces.delete(rookFrom);
      pieces.set(rookTo, rook);
    }

    assertPosition(pieces, move.after, index + 1);
    positions.push(snapshot());
  }
  return positions;
}

function squarePoint(square: string) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return coordinates.a1.map((value, axis) => value + coordinates.file[axis] * file + coordinates.rank[axis] * rank);
}

const translation = ([x, y, z]: number[]) => [{ type: 'TranslateTransform', x, y, z }];
const variantKey = ({ id, type }: Piece) => `${id}-${type}`;

function moveLabel(move: Move) {
  const number = Number(move.before.split(' ')[5]);
  return `${number}${move.color === 'w' ? '.' : '…'} ${move.san}`;
}

function mainlineOnly(pgn: string) {
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

function cleanComment(comment: string | undefined) {
  if (!comment) return '';
  const cleaned = comment
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned === '#' ? '' : cleaned;
}

export function createChessManifest(pgn: string, origin = typeof window === 'undefined' ? '' : window.location.origin) {
  const chess = new Chess();
  chess.loadPgn(mainlineOnly(pgn.trim()));
  const moves = chess.history({ verbose: true });
  if (!moves.length) throw new Error('PGN contains no moves');

  const headers = chess.getHeaders();
  const moveComments = new Map(chess.getComments().map(({ fen, comment }) => [fen, cleanComment(comment)]));
  const positions = gamePositions(moves);
  const variants = new Map<string, PositionedPiece & { base: number[] }>();
  for (const position of positions) {
    for (const piece of position) {
      const key = variantKey(piece);
      if (!variants.has(key)) variants.set(key, { ...piece, base: squarePoint(piece.square) });
    }
  }

  const allVariants = [...variants.values()];
  const initial = new Set(positions[0].map(variantKey));
  const base = 'https://example.org/iiif/presentation-4/chess/virtual';
  const scene = `${base}/scene`;
  const boardPainting = `${base}/board-painting`;
  const assets = `${origin.replace(/\/$/, '')}/hotlink-3d/chess/opera-game/assets`;
  const white = headers.White || 'White';
  const black = headers.Black || 'Black';

  const paintings = allVariants.map((piece) => {
    const id = `${base}/piece/${variantKey(piece)}`;
    const name = `${piece.color === 'w' ? 'white' : 'black'}-${pieceNames[piece.type]}`;
    return {
      id,
      type: 'Annotation',
      motivation: ['painting'],
      body: {
        id: `${id}/body`,
        type: 'SpecificResource',
        source: {
          id: `${assets}/${name}.gltf`,
          type: 'Model',
          format: 'model/gltf+json',
          label: language(name.replace('-', ' ')),
        },
        transform: translation(piece.base),
      },
      target: { id: scene, type: 'Scene' },
      ...(!initial.has(variantKey(piece)) ? { behavior: ['hidden'] } : {}),
    };
  });

  const labels = ['Initial position', ...moves.map(moveLabel)];
  const comments = labels.map((label, index) => {
    const move = moves[index - 1];
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
              moveComments.get(move.after),
            ]
              .filter(Boolean)
              .join('\n')
          : ['The standard initial chess position.', moveComments.get(moves[0].before)].filter(Boolean).join('\n'),
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
        items: allVariants.map((variant) => {
          const piece = position.get(variantKey(variant));
          return {
            id: `${id}/piece/${variantKey(variant)}`,
            type: 'SpecificResource',
            source: { id: `${base}/piece/${variantKey(variant)}`, type: 'Annotation' },
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

  return {
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: `${base}/manifest`,
    type: 'Manifest',
    label: language(`${headers.Event || 'Chess game'} · ${white} vs ${black}`),
    summary: language(`Select any move to show that exact position from ${white}–${black}.`),
    metadata: Object.entries(headers).map(([label, value]) => ({ label: language(label), value: language(value) })),
    rights: 'https://creativecommons.org/licenses/by/4.0/',
    requiredStatement: {
      label: language('Attribution'),
      value: language('A Beautiful Game: © 2020 Academy Software Foundation and © 2022 Ed Mackey, CC BY 4.0.'),
    },
    homepage: [
      {
        id: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ABeautifulGame',
        type: 'Text',
        format: 'text/html',
        label: language('Source chess model'),
      },
    ],
    items: [
      {
        id: scene,
        type: 'Scene',
        label: language('Playable chess game'),
        backgroundColor: '#000000',
        items: [
          {
            id: `${scene}/paintings`,
            type: 'AnnotationPage',
            items: [
              {
                id: boardPainting,
                type: 'Annotation',
                motivation: ['painting'],
                body: {
                  id: `${assets}/board.gltf`,
                  type: 'Model',
                  format: 'model/gltf+json',
                  label: language('Chessboard'),
                },
                target: { id: scene, type: 'Scene' },
              },
              {
                id: `${base}/camera-painting`,
                type: 'Annotation',
                motivation: ['painting'],
                body: {
                  id: `${base}/camera`,
                  type: 'PerspectiveCamera',
                  label: language('White-side board view'),
                  fieldOfView: 45,
                  near: 0.01,
                  far: 100,
                  interactionMode: ['orbit'],
                  lookAt: { id: boardPainting, type: 'Annotation' },
                },
                target: {
                  type: 'SpecificResource',
                  source: { id: scene, type: 'Scene' },
                  selector: [{ type: 'PointSelector', x: 0, y: 0.68, z: -0.73 }],
                },
              },
              ...paintings,
              {
                id: `${base}/environment-painting`,
                type: 'Annotation',
                motivation: ['painting'],
                body: {
                  id: `${base}/environment`,
                  type: 'ImageBasedLight',
                  intensity: 1,
                  environmentMap: {
                    id: 'https://raw.githubusercontent.com/mrdoob/three.js/r184/examples/textures/equirectangular/venice_sunset_1k.hdr',
                    type: 'Image',
                    format: 'image/vnd.radiance',
                  },
                },
                target: { id: scene, type: 'Scene' },
              },
            ],
          },
        ],
        annotations: [
          {
            id: `${scene}/game-steps`,
            type: 'AnnotationPage',
            items: comments.flatMap((comment, index) => [comment, activations[index]]),
          },
        ],
      },
    ],
  };
}
