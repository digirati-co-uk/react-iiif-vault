import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createActivationsHelper } from '@iiif/helpers/activations';
import { createSceneHelper } from '@iiif/helpers/scenes';
import { Vault4 } from '@iiif/helpers/vault-4';
import { validateAuthoredPresentation4 } from '@iiif/parser/presentation-4/validator';
import { Chess } from 'chess.js';

const [manifestArg, pgnArg] = process.argv.slice(2);
if (!manifestArg) {
  console.error('Usage: node check-game.mjs <manifest.json> [source.pgn]');
  process.exit(1);
}

const json = JSON.parse(readFileSync(resolve(manifestArg), 'utf8'));
const authoredComments = json.items[0].annotations[0].items.filter(({ motivation }) =>
  motivation?.includes('commenting')
);
const targetlessCommentIds = new Set(authoredComments.filter(({ target }) => target === undefined).map(({ id }) => id));
const validation = validateAuthoredPresentation4(json);
// This fixture deliberately exercises the framework's target-less annotation
// extension. Keep every other authored Presentation 4 validation error fatal.
const validationErrors = validation.issues.filter(
  (issue) =>
    issue.severity === 'error' &&
    !(issue.code === 'annotation-target-required' && targetlessCommentIds.has(issue.resourceId))
);
if (validationErrors.length) {
  throw new Error(validationErrors.map(({ message }) => message).join('\n'));
}
const vault = new Vault4();
const manifest = vault.loadManifestSync(json.id, json);
const scene = vault.get(manifest.items, { parent: manifest })[0];
const sceneHelper = createSceneHelper(vault);
const activationHelper = createActivationsHelper(vault);
const paintables = sceneHelper.getPaintables(scene).items;
const pieces = paintables.filter(({ type, annotationId }) => type === 'model' && annotationId.includes('/piece/'));
const cameras = paintables.filter(({ type }) => type.endsWith('camera'));
const comments = sceneHelper.getAllAnnotations(scene).filter(({ motivation }) => motivation.includes('commenting'));

if (!pieces.length || paintables.some(({ type }) => type === 'scene'))
  throw new Error('Expected persistent Model pieces and no nested position Scenes');
if (cameras.length !== 1) throw new Error('Expected one authored chess camera');
if (!comments.length) throw new Error('Expected move annotations');
if (authoredComments.some(({ target }) => target !== undefined))
  throw new Error('Move annotations should remain target-less so the viewer does not draw spatial markers');

const states = [];

for (const [index, comment] of comments.entries()) {
  const transactions = activationHelper.getActivationsForTarget(manifest, comment.id);
  const steps = transactions[0]?.steps || [];
  if (transactions.length !== 1 || steps.length !== pieces.length)
    throw new Error(`Invalid activation transaction for position ${index}`);
  const state = new Map();
  for (const step of steps) {
    const action = step.actions[0];
    if (
      step.actions.length !== 1 ||
      !step.source ||
      !['show', 'hide'].includes(action) ||
      (action === 'show' && !step.transform.length)
    ) {
      throw new Error(`Invalid piece activation for position ${index}`);
    }
    state.set(step.source.id, `${action}:${JSON.stringify(step.transform)}`);
  }
  if (state.size !== pieces.length) throw new Error(`Position ${index} does not address every persistent piece`);
  states.push(state);
}

const changed = (from, to) => [...to].filter(([id, value]) => from.get(id) !== value).length;
const regressionCounts = new Map([
  ['1. e4', 1],
  ['4. dxe5', 2],
  ['12. O-O-O', 2],
  ['17. Rd8#', 1],
]);
for (const [index, comment] of comments.entries()) {
  const label = Object.values(comment.label || {}).flat()[0];
  const expected = regressionCounts.get(label);
  if (expected !== undefined && changed(states[index - 1], states[index]) !== expected) {
    throw new Error(`${label} should change ${expected} piece${expected === 1 ? '' : 's'}`);
  }
}

if (pgnArg) {
  const chess = new Chess();
  chess.loadPgn(readFileSync(resolve(pgnArg), 'utf8'), { strict: true });
  const moves = chess.history({ verbose: true });
  if (authoredComments.length !== moves.length + 1) throw new Error('PGN and generated move annotations have drifted');
  const sourceComments = new Map(
    chess.getComments().map(({ fen, comment }) => [
      fen,
      comment
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/^#\s*/, '')
        .replace(/\s+/g, ' ')
        .trim(),
    ])
  );
  for (const [index, move] of moves.entries()) {
    const number = Number(move.before.split(' ')[5]);
    const label = `${number}${move.color === 'w' ? '.' : '…'} ${move.san}`;
    if (authoredComments[index + 1].label?.en?.[0] !== label)
      throw new Error(`PGN move ${label} is stale in the Manifest`);
    const sourceComment = sourceComments.get(move.after);
    if (sourceComment && !authoredComments[index + 1].body?.value?.includes(sourceComment))
      throw new Error(`PGN commentary for ${label} is missing from the Manifest`);
  }
}

console.log(
  `✓ ${pieces.length} persistent pieces; one authored camera; ${comments.length} target-less positions; one activation transaction per step`
);
