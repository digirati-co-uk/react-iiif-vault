import { getValue } from '@iiif/helpers';
import { useEffect, useRef, useState } from 'react';
import { useVault } from '../hooks/useVault';
import {
  SceneAudioControl,
  SceneCameraSelect,
  ScenePanel,
  useSceneAnnotations,
  useSceneControls,
  type ManifestInput,
  type ScenePanelHandle,
  type SceneCameraControlMode,
  type SceneTransformMode,
  type SceneTransformValue,
} from '../scene-panel';
import '../scene-panel/scene-panel.css';
import { createChessManifest } from './chess-manifest';

const OPERA_GAME = `[Event "The Opera Game"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5
6. Bc4 Nf6 7. Qb3 Qe7 { Black protects f7, but the queen blocks the dark-squared bishop. }
8. Nc3 c6 9. Bg5 b5 { The pawn attacks the bishop while weakening the queenside. }
10. Nxb5 { Morphy sacrifices the knight to open lines against the uncastled king. } cxb5
11. Bxb5+ Nbd7 12. O-O-O { White completes development with check threats already gathering. } Rd8
13. Rxd7 { The rook sacrifice removes a key defender and draws Black's rook away. } Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ { The queen sacrifice forces the knight onto b8. } Nxb8
17. Rd8# { The remaining rook delivers checkmate on the back rank. } 1-0`;

type Fixture = { group: string; label: string; path: string; expected?: string };

export default function SceneShowcase({ page }: { page: 'scenes' | 'chess' }) {
  return page === 'scenes' ? <ScenesPage /> : <ChessPage />;
}

function ScenesPage() {
  const defaultManifest = '/fixtures/prototype/01-camera-look-at-model.json';
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [manifest, setManifest] = useState(defaultManifest);
  const [draft, setDraft] = useState(defaultManifest);
  const [debugLights, setDebugLights] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<SceneTransformMode>('translate');
  const [lastTransform, setLastTransform] = useState<SceneTransformValue | null>(null);
  const [cameraMode, setCameraMode] = useState<SceneCameraControlMode>('manifest');
  const [invertLook, setInvertLook] = useState(false);
  const panel = useRef<ScenePanelHandle>(null);

  useEffect(() => {
    fetch('/fixtures/index.json')
      .then((response) => response.json())
      .then(setFixtures)
      .catch(() => setFixtures([]));
  }, []);

  const load = (url: string) => {
    if (!url) return;
    setDraft(url);
    setManifest(url);
  };

  return (
    <main className="page">
      <PageHeading
        title="Presentation 4 scenes"
        description="Models, authored cameras, lights, spatial sound, annotations, nested scenes and Canvas surfaces."
      />
      <section className="toolbar" aria-label="Scene fixture controls">
        <label>
          <span>Example</span>
          <select
            value={fixtures.some(({ path }) => path === manifest) ? manifest : ''}
            onChange={(event) => load(event.currentTarget.value)}
          >
            <option value="">Custom manifest</option>
            {[...new Set(fixtures.map(({ group }) => group))].map((group) => (
              <optgroup key={group} label={group}>
                {fixtures
                  .filter((fixture) => fixture.group === group)
                  .map((fixture) => (
                    <option key={fixture.path} value={fixture.path}>
                      {fixture.label}
                      {fixture.expected === 'unsupported-format' ? ' (unsupported)' : ''}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        {cameraMode === 'fly' ? (
          <button
            type="button"
            className="secondary"
            aria-pressed={invertLook}
            onClick={() => setInvertLook((value) => !value)}
          >
            {invertLook ? 'Inverted look' : 'Normal look'}
          </button>
        ) : null}
        <form
          className="url-form"
          onSubmit={(event) => {
            event.preventDefault();
            load(draft);
          }}
        >
          <label>
            <span>Manifest URL</span>
            <input value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />
          </label>
          <button type="submit">Load</button>
        </form>
        <button
          type="button"
          className="secondary"
          aria-pressed={debugLights}
          onClick={() => setDebugLights((value) => !value)}
        >
          {debugLights ? 'Hide light guides' : 'Show light guides'}
        </button>
        <button
          type="button"
          className="secondary"
          aria-pressed={editing}
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? 'Stop editing' : 'Edit scene'}
        </button>
        {editing ? (
          <label>
            <span>Transform</span>
            <select
              value={transformMode}
              onChange={(event) => setTransformMode(event.currentTarget.value as SceneTransformMode)}
            >
              <option value="translate">Translate</option>
              <option value="rotate">Rotate</option>
              <option value="scale">Scale</option>
            </select>
          </label>
        ) : null}
        {editing && selectedAnnotation ? (
          <button
            type="button"
            className="secondary"
            onClick={() => panel.current?.frameAnnotation(selectedAnnotation)}
          >
            Frame selection
          </button>
        ) : null}
        <button type="button" className="secondary" onClick={() => panel.current?.resetView()}>
          Reset view
        </button>
        <label>
          <span>Camera controls</span>
          <select
            value={cameraMode}
            onChange={(event) => setCameraMode(event.currentTarget.value as SceneCameraControlMode)}
          >
            <option value="manifest">Manifest</option>
            <option value="orbit">Orbit</option>
            <option value="fly">Fly through</option>
          </select>
        </label>
      </section>
      <div className="viewer-shell scene-showcase">
        <ScenePanel
          key={manifest}
          ref={panel}
          controls
          manifest={manifest}
          debug={{ lights: debugLights }}
          cameraControls={{ mode: cameraMode, movementSpeed: 2, invertLook }}
          editing={
            editing
              ? {
                  enabled: true,
                  mode: transformMode,
                  selectedAnnotation,
                  showSelectionOutline: true,
                  showLightHelpers: true,
                  showCameraHelpers: true,
                  onSelectAnnotation: (annotation) => setSelectedAnnotation(annotation?.id || null),
                  onTransformCommit: setLastTransform,
                }
              : undefined
          }
          style={{ height: 'min(68vh, 720px)' }}
        />
      </div>
      <p className="viewer-hint">
        {editing
          ? `Select a built-in GLB model and drag its ${transformMode} handles${lastTransform ? ` · last edit: ${lastTransform.annotationId}` : ''}`
          : cameraMode === 'fly'
            ? 'WASD to fly · drag the pointer to look · R/F move up/down'
            : 'Drag to orbit · scroll or double-click to zoom · select annotation markers for details'}
      </p>
    </main>
  );
}

function ChessPage() {
  const [pgn, setPgn] = useState(OPERA_GAME);
  const [manifest, setManifest] = useState<ManifestInput>(() => createChessManifest(OPERA_GAME) as ManifestInput);
  const [revision, setRevision] = useState(0);
  const [source, setSource] = useState('Built-in Opera Game PGN');
  const [error, setError] = useState('');

  const generate = () => {
    try {
      setManifest(createChessManifest(pgn) as ManifestInput);
      setRevision((value) => value + 1);
      setSource('Virtual manifest generated in this browser');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not parse that game');
    }
  };

  const restore = () => {
    setPgn(OPERA_GAME);
    setManifest(createChessManifest(OPERA_GAME) as ManifestInput);
    setRevision((value) => value + 1);
    setSource('Built-in Opera Game PGN');
    setError('');
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/ld+json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chess-manifest.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="page chess-page">
      <PageHeading
        title="Chess manifest lab"
        description="Paste a PGN game and turn every legal move into an annotation-driven 3D Scene position."
      />
      <div className="chess-layout">
        <section className="pgn-editor" aria-labelledby="pgn-heading">
          <div>
            <h2 id="pgn-heading">Portable Game Notation</h2>
            <p>
              The included Opera Game contains commentary on its key tactical moves and can be replaced with any PGN.
            </p>
          </div>
          <textarea
            value={pgn}
            onChange={(event) => setPgn(event.currentTarget.value)}
            spellCheck={false}
            aria-label="Chess PGN"
          />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="button-row">
            <button type="button" onClick={generate}>
              Generate manifest
            </button>
            <button type="button" className="secondary" onClick={restore}>
              Restore Opera Game
            </button>
            <button type="button" className="secondary" onClick={download}>
              Download manifest
            </button>
          </div>
          <dl className="generator-notes">
            <div>
              <dt>Source</dt>
              <dd>{source}</dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd>Presentation 4 Manifest</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>Activation List per move</dd>
            </div>
          </dl>
        </section>
        <div className="viewer-shell chess-scene">
          <ScenePanel
            key={revision}
            manifest={manifest}
            controls={<ChessControls />}
            stage={false}
            transitions={{ duration: 0.35 }}
            style={{ height: 'min(72vh, 760px)' }}
          />
        </div>
      </div>
    </main>
  );
}

function ChessControls() {
  const annotations = useSceneAnnotations();
  const { selectedAnnotation, selectAnnotation, resetView } = useSceneControls();
  const vault = useVault();
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    list.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedAnnotation]);

  return (
    <aside className="chess-controls" aria-label="Game positions">
      <div className="chess-controls-heading">
        <div>
          <strong>Game positions</strong>
          <span>{annotations.length} positions</span>
        </div>
        <button type="button" className="secondary compact" onClick={resetView}>
          Reset view
        </button>
      </div>
      <SceneCameraSelect />
      <SceneAudioControl />
      <ol ref={list}>
        {annotations.map((annotation: any, index: number) => {
          const bodyRef = Array.isArray(annotation.body) ? annotation.body[0] : annotation.body;
          const body = bodyRef ? vault.get<any>(bodyRef, { parent: annotation, skipSelfReturn: false }) : null;
          const [moveDescription, ...comment] = typeof body?.value === 'string' ? body.value.split('\n') : [];
          return (
            <li key={annotation.id}>
              <button
                type="button"
                aria-current={selectedAnnotation === annotation.id ? 'step' : undefined}
                onClick={() => selectAnnotation(annotation.id)}
              >
                <span className="chess-move-index">{index}</span>
                <span className="chess-move-copy">
                  <strong>{annotation.label ? getValue(annotation.label) : `Position ${index}`}</strong>
                  {moveDescription ? <small>{moveDescription}</small> : null}
                  {comment.length ? <p>{comment.join(' ')}</p> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="page-heading">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
