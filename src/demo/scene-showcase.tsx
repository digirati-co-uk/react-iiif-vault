import { getValue } from '@iiif/helpers';
import { useEffect, useRef, useState } from 'react';
import { useVault } from '../presentation-4';
import {
  SceneAudioControl,
  SceneCameraSelect,
  ScenePanel,
  useSceneAnnotations,
  useSceneControls,
  type ManifestInput,
  type SceneCameraControlMode,
  type SceneOrbitTarget,
  type SceneResourceStatus,
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

function sceneObjectLabel(id: string) {
  const parts = id.split('/').filter(Boolean);
  const leaf = parts.at(-1) === 'body' ? parts.at(-2) : parts.at(-1);
  const piece = leaf?.match(/^([bw])-([prnbqk])-(\d+)-/);
  if (piece) {
    const color = piece[1] === 'b' ? 'Black' : 'White';
    const names: Record<string, string> = {
      p: 'pawn',
      r: 'rook',
      n: 'knight',
      b: 'bishop',
      q: 'queen',
      k: 'king',
    };
    return `${color} ${names[piece[2]]} ${piece[3]}`;
  }
  return (leaf || id).replaceAll('-', ' ');
}

export default function SceneShowcase({ page }: { page: 'scenes' | 'chess' }) {
  return page === 'scenes' ? <ScenesPage /> : <ChessPage />;
}

function ScenesPage() {
  const defaultManifest = '/fixtures/prototype/01-camera-look-at-model.json';
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [manifest, setManifest] = useState(defaultManifest);
  const [draft, setDraft] = useState(defaultManifest);
  const [debugLights, setDebugLights] = useState(false);
  const [cameraMode, setCameraMode] = useState<SceneCameraControlMode>('manifest');
  const [invertLook, setInvertLook] = useState(false);
  const [clickToOrbit, setClickToOrbit] = useState(false);
  const [orbitTarget, setOrbitTarget] = useState<SceneOrbitTarget>();
  const [resourceStatuses, setResourceStatuses] = useState<SceneResourceStatus[]>([]);
  const modelResources = resourceStatuses.filter((resource) => resource.resourceType.toLowerCase() === 'model');
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
    setOrbitTarget(undefined);
    setResourceStatuses([]);
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
        <label>
          <span>Orbit around</span>
          <select
            value={typeof orbitTarget === 'string' ? orbitTarget : orbitTarget ? '__scene_origin__' : ''}
            disabled={cameraMode === 'fly'}
            onChange={(event) =>
              setOrbitTarget(
                event.currentTarget.value === '__scene_origin__'
                  ? ([0, 0, 0] as const)
                  : event.currentTarget.value
              )
            }
          >
            <option value="" disabled>
              Authored camera target
            </option>
            <option value="__scene_origin__">Scene origin (0, 0, 0)</option>
            {modelResources.map((resource) => (
              <option key={resource.path} value={resource.annotationId}>
                {sceneObjectLabel(resource.annotationId)}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="viewer-shell scene-showcase">
        <ScenePanel
          key={manifest}
          manifest={manifest}
          overlay={
            <FloatingSceneControls
              clickToOrbit={clickToOrbit}
              clickToOrbitDisabled={cameraMode === 'fly'}
              onToggleClickToOrbit={() => setClickToOrbit((value) => !value)}
              onResetOrbit={() => {
                setClickToOrbit(false);
                setOrbitTarget(undefined);
              }}
            />
          }
          debug={{ lights: debugLights }}
          cameraControls={{ mode: cameraMode, movementSpeed: 2, invertLook }}
          orbitTarget={orbitTarget}
          hoverHighlightModels={clickToOrbit ? 'rgba(92, 200, 255, 0.45)' : false}
          onResourceStatusChange={setResourceStatuses}
          onSelectAnnotation={
            clickToOrbit
              ? (annotation) => {
                  const resource = modelResources.find((entry) => entry.annotationId === annotation?.id);
                  if (resource) {
                    setOrbitTarget(resource.annotationId);
                    setClickToOrbit(false);
                  }
                }
              : undefined
          }
          style={{ height: 'min(68vh, 720px)' }}
        />
      </div>
      <p className="viewer-hint">
        {cameraMode === 'fly'
          ? 'WASD to fly · drag the pointer to look · R/F move up/down'
          : clickToOrbit
            ? 'Click a model to make it the orbit origin · drag to orbit · scroll or double-click to zoom'
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
        <ScenePanel.Provider key={revision} manifest={manifest} stage={false} transitions={{ duration: 0.35 }}>
          <div className="viewer-shell chess-scene chess-player">
            <ScenePanel.Viewer overlay={<FloatingSceneControls compact />} />
            <ChessControls />
          </div>
        </ScenePanel.Provider>
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
        {annotations.map((annotation, index) => {
          const bodyRef = Array.isArray(annotation.body) ? annotation.body[0] : annotation.body;
          const body = bodyRef ? vault.get(bodyRef, { parent: annotation, skipSelfReturn: false }) : null;
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

function FloatingSceneControls({
  compact = false,
  clickToOrbit = false,
  clickToOrbitDisabled = false,
  onToggleClickToOrbit,
  onResetOrbit,
}: {
  compact?: boolean;
  clickToOrbit?: boolean;
  clickToOrbitDisabled?: boolean;
  onToggleClickToOrbit?(): void;
  onResetOrbit?(): void;
}) {
  const { annotationsVisible, duration, frameAll, pause, play, playing, resetView, toggleAnnotations } =
    useSceneControls();
  return (
    <div
      className={`scene-floating-controls${compact ? ' scene-floating-controls-compact' : ''}`}
      role="toolbar"
      aria-label="3D view controls"
    >
      {duration ? (
        <IconButton label={playing ? 'Pause scene' : 'Play scene'} onClick={playing ? pause : play}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
      ) : null}
      <IconButton label="Frame all resources" onClick={() => frameAll()}>
        <FrameIcon />
      </IconButton>
      <IconButton
        label="Reset view"
        onClick={() => {
          resetView();
          onResetOrbit?.();
        }}
      >
        <ResetIcon />
      </IconButton>
      {onToggleClickToOrbit ? (
        <IconButton
          label={clickToOrbit ? 'Cancel click to orbit' : 'Click a model to orbit around it'}
          pressed={clickToOrbit}
          disabled={clickToOrbitDisabled}
          onClick={onToggleClickToOrbit}
        >
          <OrbitTargetIcon />
        </IconButton>
      ) : null}
      <IconButton
        label={annotationsVisible ? 'Hide annotations' : 'Show annotations'}
        pressed={annotationsVisible}
        onClick={toggleAnnotations}
      >
        <AnnotationIcon />
      </IconButton>
      {!compact ? <SceneCameraSelect /> : null}
      {!compact ? <SceneAudioControl /> : null}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  pressed,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick(): void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function PlayIcon() {
  return (
    <Icon>
      <path d="m9 7 7 5-7 5Z" />
    </Icon>
  );
}

function PauseIcon() {
  return (
    <Icon>
      <path d="M9 8v8M15 8v8" />
    </Icon>
  );
}

function FrameIcon() {
  return (
    <Icon>
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />
    </Icon>
  );
}

function ResetIcon() {
  return (
    <Icon>
      <path d="M5 8V4m0 0h4M5 4l3 3a7 7 0 1 1-2 7" />
    </Icon>
  );
}

function OrbitTargetIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </Icon>
  );
}

function AnnotationIcon() {
  return (
    <Icon>
      <path d="M5 5h14v10H9l-4 4Z" />
      <path d="M9 9h6M9 12h4" />
    </Icon>
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
