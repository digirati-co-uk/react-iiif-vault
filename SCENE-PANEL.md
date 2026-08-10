# ScenePanel

`ScenePanel` is the React 19 client viewer for IIIF Presentation 4 Scenes. It is isolated behind `react-iiif-vault/scene-panel`, so the root and CanvasPanel entry points do not load Three.js.

```sh
pnpm add react-iiif-vault @iiif/parser @iiif/helpers react@19.2.0 react-dom@19.2.0 three@0.185.1 @react-three/fiber@9.6.1 @react-three/drei@10.7.7
```

```tsx
'use client';

import { ScenePanel } from 'react-iiif-vault/scene-panel';
import 'react-iiif-vault/scene-panel.css';

export function Viewer() {
  return <ScenePanel manifest="https://example.org/iiif/manifest.json" style={{ height: 640 }} />;
}
```

When a Manifest contains multiple Scenes, pass `scene` or `startScene`; ScenePanel intentionally has no previous/next Scene navigation. `scene` may be an identifier, an embedded Scene, or a normalized Scene.

ScenePanel frames an unconfigured Scene before its first visible frame, with a 1.4× padding multiplier. Smooth camera/action transitions, a short post-load depth cue, and a translucent square grid stage are enabled by default. They are independently configurable:

```tsx
<ScenePanel
  scene={scene}
  transitions={{ duration: 0.8 }}
  stage={{ backgroundColor: "#101722", floorColor: "#182231", floorOpacity: 0.55, gridColor: "#53657a", size: 50 }}
  cameraCue
  cameraPadding={1.5}
  cameraZoom={{ duration: 0.1, sensitivity: 1, zoomToCursor: true }}
/>

<ScenePanel scene={scene} transitions={false} stage={false} cameraCue={false} />
```

Orbit and hemisphere-orbit cameras use Atlas-style smooth wheel and trackpad zoom. Double-click zooms inward by one smooth step towards the clicked point. Wheel deltas are normalized across devices, repeated input retargets the current animation without jumping, and the point beneath the cursor stays anchored. `cameraZoom.duration` is the duration in seconds for one normalized wheel step. `cameraZoom.easing` accepts a `(progress) => number` callback and defaults to Atlas's `easeOutExpo` curve. Touch pinch and middle-button dolly remain direct.

Set `orbitTarget` to either a world-space point or the ID of a registered model/resource or its painting Annotation. IDs are resolved to the centre of their rendered bounds once they are ready; an Annotation ID is useful when the same model is painted more than once:

```tsx
<ScenePanel scene={scene} orbitTarget={[0, 1.5, 0]} />
<ScenePanel scene={scene} orbitTarget="https://example.org/models/helmet" />
```

Changes use the normal Scene camera transition duration; pass `transitions={false}` for an immediate jump. This is intentionally a camera prop rather than a built-in picking mode. Applications can combine `onResourceStatusChange` with `onSelectAnnotation` to offer an object picker or click-to-orbit interaction; the Scene demo shows both while leaving click-to-orbit disabled by default.

For selectable glTF scenes, `hoverHighlightModels` adds a hover tint without changing the model assets. `true` uses the default gold tint, or pass a CSS colour whose alpha controls the tint strength:

```tsx
<ScenePanel hoverHighlightModels="rgba(255, 0, 0, 0.3)" />
```

The default loading layer follows Three's loading manager. It displays a spinner and, when totals are available, resource counts and a progress bar. It blocks while models required for the first useful frame load, while later Canvas texture refinements remain visible and cross-fade into place. `loadingFallback` replaces its contents.

For server-rendered applications, `ssrFallback` provides stable pre-hydration content before the client-side loading state begins.

## Composition and annotations

```tsx
import { ScenePanel, useSceneControls } from 'react-iiif-vault/scene-panel';

function Toolbar() {
  const { frameAll, resetView } = useSceneControls();
  return (
    <div className="toolbar">
      <button onClick={() => frameAll()}>Fit</button>
      <button onClick={resetView}>Reset view</button>
    </div>
  );
}

function CustomViewer({ scene }) {
  return (
    <ScenePanel.Provider scene={scene}>
      <div className="viewer-layout">
        <ScenePanel.Viewer />
        <Toolbar />
      </div>
    </ScenePanel.Provider>
  );
}
```

`ScenePanel.Provider` owns the Vault4 Scene runtime. `ScenePanel.Viewer` renders only the viewport, so toolbars, sidebars, and other contextual UI can be positioned by the application. `ScenePanel.Canvas` remains the lower-level React Three Fiber canvas.

Children of `ScenePanel` and `ScenePanel.Viewer` are mounted inside the Fiber canvas. `overlay` is mounted as accessible HTML above the canvas and is useful for floating controls. Point markers remain a stable CSS-pixel size at every model scale. Built-in point, WKT, and SVG annotations render above model geometry so an authored marker cannot be hidden inside a surface. Sanitized textual bodies open in styled DOM popovers; an intentionally empty body receives a clear fallback message. Viewer-wide defaults can be replaced with `annotationMarker` and `annotationPopover`, while `annotationMarkerSize` controls the default diameter in pixels. Per-annotation props take precedence. A render-prop replaces only the marker:

```tsx
<Annotation3D annotation={annotation}>
  {({ point, selected, size, activate }) => (
    <mesh position={point} onClick={activate}>
      <sphereGeometry args={[selected ? 0.08 : 0.05]} />
      <meshStandardMaterial color={selected ? 'gold' : 'crimson'} />
    </mesh>
  )}
</Annotation3D>
```

## Canvas resources

A Canvas painted into a Scene is interpreted with `createPaintingAnnotationsHelper`, including document-order layers, default Choice selection, target regions, body crops, CSS-derived opacity/background/transforms, Canvas background colour, images, video, sanitized text, and SVG content. Images with an Image API service request a resolution based on the plane's projected screen size and retain the previous texture while a sharper or smaller request loads.

The Canvas local frame follows Presentation 4: its top-left is the painting target, width extends along `+X`, height along `-Y`, and the forward face points toward `+Z`.

## Light diagnostics

`debug={{ lights: true }}` (or `debug`) adds coloured origin markers, type labels, and direction arrows without changing the lights. This is intended for authoring and fixture diagnosis, not production chrome.

## Controls and extensions

ScenePanel does not impose viewer chrome. Use `useSceneControls()` or a `ScenePanelHandle` ref for playback, seeking, reset, framing, camera/annotation selection, annotation visibility, and host-directed activation. `SceneTimeline`, `SceneCameraSelect`, `SceneAnnotationList`, and `SceneAudioControl` are optional primitives for application-owned layouts.

```tsx
function FloatingControls() {
  const { annotationsVisible, resetView, toggleAnnotations } = useSceneControls();
  return (
    <div className="floating-controls">
      <button onClick={resetView}>Reset view</button>
      <button aria-pressed={annotationsVisible} onClick={toggleAnnotations}>
        Annotations
      </button>
    </div>
  );
}

<ScenePanel scene={scene} overlay={<FloatingControls />} />;
```

Browsers require a user gesture before audio can start. Include `SceneAudioControl` or call the control API from a user action to unlock audio; it then synchronizes to Scene time.

GLB and glTF are built in, including Draco, Meshopt, and KTX2 decoding. Progressive `.splat` Gaussian splats are also built in; because no registered splat media type exists, the bundled generated example uses `application/octet-stream` and dispatches by its `.splat` URL. Application renderers are checked first:

```tsx
const renderer = {
  id: 'obj',
  supports: ({ resource }) => resource.type === 'Model' && resource.format === 'model/obj',
  Component: ObjModelRenderer,
};

<ScenePanel scene={scene} renderers={[renderer]} />;
```

A custom renderer must call its supplied `register()` callback and declare supported actions so activation transactions can be preflighted atomically.

Three/Web Audio client defaults are retained for light range/decay/penumbra and positional-audio attenuation because Presentation 4 does not define them. Scene units map directly to Three units; `spatialScale` and `temporalScale` remain metadata. WebXR and React Native are outside this beta milestone.
