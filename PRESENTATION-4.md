# React Three Fiber ScenePanel for React IIIF Vault

## Summary

Add a new `react-iiif-vault/scene-panel` toolkit that renders IIIF Presentation 4 Scenes through React Three Fiber. It will offer:

- A one-component `<ScenePanel>` viewer with accessible controls.
- Lower-level `<SceneProvider>` and `<SceneCanvas>` composition.
- Automatic rendering of Scene painting annotations.
- Manually composable `<Annotation3D>` and `<AnnotationPage3D>` components.
- A Scene clock controlling visibility, audio, animations, and temporal activations.
- Atomic activating-annotation transactions.
- Cameras, all five light types, all three audio emitters, nested Scenes, Canvases, and Timelines.
- glTF/GLB and progressive `.splat` Gaussian splat support, with a renderer registry for other model formats.
- Strong Presentation 4 types flowing from parser → helpers → Vault → React.
- A single complete release gate, implemented through vertical commits but not released partially.

The implementation will target the IIIF Presentation 4 draft at [`IIIF/api@28a8882`](https://github.com/IIIF/api/tree/28a88829699ebbbe7722b4692cf3b7b67969bc6c). This matters because the current local parser is missing newer draft details such as `ImageBasedLight`, `environmentMap`, and some normalized annotation properties. Scene behavior will follow the [Presentation 4 data model](https://iiif.io/api/presentation/4.0/model/), including ordered transforms, camera/light direction defaults, nested containers, and atomic activation transactions.

The design reuses the existing Vault, `resolveAnnotationValues`, painting helpers, selector expansion, React contexts, and Zustand dependency. It does not introduce a second Scene data model or a parallel state-management library.

## Package and compatibility decisions

- The toolkit lives in the React IIIF Vault repository.
- Primary import: `react-iiif-vault/scene-panel`.
- ScenePanel remains isolated from the root and `canvas-panel` bundles so existing CanvasPanel applications do not download Three.js.
- The Scene subpath targets React 19.
- Prototype versions are pinned to:
  - React/React DOM `19.2.0`
  - Three.js `0.185.1`
  - `@react-three/fiber` `9.6.1`
  - `@react-three/drei` `10.7.7`
- Three.js, Fiber, and Drei are optional peer dependencies of React IIIF Vault and exact dev dependencies for its build and tests.
- The release remains a beta while Presentation 4 is a draft, for example `react-iiif-vault@3.0.0-beta.1`.
- No WebXR or React Native support is included in this milestone. Neither is required by the Presentation 4 Scene model; the renderer registry and Fiber canvas props leave room for them later.
- Built-in model support is glTF 2.0/GLB, including Draco, KTX2, and Meshopt assets, plus progressive `.splat` Gaussian splats. Other formats use the renderer registry.
- A Manifest containing multiple Scenes requires the host to select the Scene. ScenePanel will not provide previous/next Scene navigation.

## Data flow

```text
Presentation 4 JSON
        │
        ▼
@iiif/parser types + normalization
        │
        ▼
Vault4 normalized entities
        │
        ▼
@iiif/helpers Scene/target/activation helpers
        │
        ▼
SceneProvider + Scene runtime store
        ├── React Three Fiber scene graph
        ├── clock/audio/animation synchronization
        ├── atomic activation reducer
        └── accessible HTML controls and annotation UI
```

## 1. Align `@iiif/parser` with the pinned Scene model

Update the parser before writing renderer compatibility code.

### Scene component types

Extend `scene-components.d.ts` and normalized types with:

- `ImageBasedLight`
  - `environmentMap: ImageResource | Reference<"Image">`
  - optional `intensity: Quantity`
- `OrthographicCamera.viewHeight`
- Typed common Camera properties:
  - `near`
  - `far`
  - `lookAt`
  - `interactionMode`
- Typed Light properties:
  - `color`
  - `intensity`
  - `angle`
  - `lookAt`
  - `environmentMap`
- Typed Audio Emitter properties:
  - `source`
  - `volume`
  - `angle`
  - `lookAt`
- Add `ImageBasedLight` to `Light`, `SceneComponent`, helper inference, metadata inventories, traversal tables, normalization mapping, and serialization.

### Normalized resource fidelity

Ensure normalization retains and traverses:

- Audio Emitter `source`, including Audio, SpecificResource, and Timeline sources.
- `environmentMap` as a normalized Image reference.
- `lookAt` as a PointSelector, WktSelector, Annotation reference, or SpecificResource.
- Annotation `exclude`, `timeMode`, `scope`, and `position`.
- SpecificResource `position`, `selector`, `transform`, `action`, and `scope`.
- Selector `refinedBy` chains.
- Scene `duration`, `spatialScale`, `temporalScale`, `backgroundColor`, `interactionMode`, `placeholderContainer`, and `accompanyingContainer`.

Serialization must round-trip these values without flattening ordered transforms or selector refinement chains.

### Parser tests

Import the complete official 3D example set from the pinned IIIF commit and test:

- Basic and configured Scenes.
- Multiple transformed models.
- Image-based lighting.
- Ambient, point, and spot audio.
- Scene-in-Scene.
- Canvas-in-Scene.
- Comment annotations with cameras.
- Scope shorthand.
- Light-switch activations.
- Named model animation activation.

Add compile-time tests for every Scene component and normalize/serialize/normalize parity tests for the official examples.

## 2. Expand `@iiif/helpers` into the renderer-neutral Scene interpretation layer

The React package should receive a renderable description, not reinterpret raw IIIF independently.

### Scene paintables

Expand `KNOWN_SCENE_PAINTABLE_TYPES` to cover:

- `model`
- `scene`
- `canvas`
- `perspective-camera`
- `orthographic-camera`
- `ambient-light`
- `directional-light`
- `image-based-light`
- `point-light`
- `spot-light`
- `ambient-audio`
- `point-audio`
- `spot-audio`
- `unknown`

Extend `ScenePaintable` with:

```ts
type ScenePaintable = {
  type: ScenePaintableType;
  rawType: string;
  annotationId: string;
  annotation: AnnotationNormalized;
  resource: SceneRenderableResource;
  target: SceneTarget;
  bodySelector: SelectorChain | null;
  bodyTransform: readonly Transform[];
  bodyAction: readonly string[];
  behavior: readonly string[];
  exclude: readonly ExcludeType[];
  timeMode: 'trim' | 'scale' | 'loop' | string;
  aggregatePath: readonly AnnotationAggregateStep[];
};
```

Reuse `resolveAnnotationValues` for Choice, Composite, List, and Independents. Preserve document order and choose the default/first Choice item unless an enabled choice is supplied.

### Scene targets and selectors

Add a renderer-neutral `parseSceneTarget()` result:

```ts
type SceneTarget = {
  source: { id: string; type: string };
  point: [number, number, number] | null;
  geometry: GeoJSONGeometry | null;
  temporal: { start: number; end?: number; instant?: number } | null;
  selectors: readonly SelectorChain[];
  transform: readonly Transform[];
};
```

It must support:

- Whole-Scene targets, defaulting to the origin.
- `PointSelector` with `x`, `y`, `z`, and `instant`.
- `FragmentSelector` temporal fragments.
- Scene fragments such as `#3,0,-2&t=30,60`.
- `refinedBy`, including PointSelector refined by a temporal fragment.
- Selector arrays as alternatives in preference order, rather than cumulative constraints.
- Full WKT geometry needed by the current draft, including Z coordinates and multi-geometries.
- `AnimationSelector` for activation targets.
- Targets that reference painting annotations or their rendered resources.
- `position` on TextualBody and SpecificResource.

Use a maintained WKT parser such as `@terraformer/wkt` instead of expanding the current partial handwritten Point/Polygon parser.

### Transform utility

Add a pure matrix helper shared by tests and React:

```ts
createSceneTransformMatrix(
  transforms: readonly Transform[],
  targetPoint?: readonly [number, number, number]
): MatrixTuple;
```

Rules:

- Apply transforms in document order.
- Rotate values are degrees.
- A RotateTransform applies X, then Y, then Z.
- Positive rotations follow the right-handed convention.
- Missing scale axes default to `1`; missing rotate/translate axes default to `0`.
- Body transforms happen in local space before the resource is painted at its target point.
- Return plain numeric matrix data; helpers must not depend on Three.js.

### Activation helpers

Expand `createActivationsHelper` with:

- `getActivationsForTarget(container, targetId)`.
- Resolution of Scene and relevant Manifest annotation pages.
- `scope` expansion into `show`, `enable`, and `select`.
- Preservation of ordered List members and ordered actions.
- Selector-aware sources, especially named `AnimationSelector` targets.
- A parsed transaction format suitable for preflight validation.

Do not execute activations in helpers; execution belongs to the viewer runtime.

## 3. Update React IIIF Vault’s Presentation 4 foundation

Before ScenePanel, make the core React contexts accept `Vault4`.

### Vault and resource contexts

- Change `VaultProvider` and `useExistingVault` types to accept `Vault | Vault4`.
- Add `version={3 | 4}` to `VaultProvider`; `version={4}` creates a `Vault4`.
- Preserve the existing Presentation 3 default outside ScenePanel.
- Extend `ResourceContext` with `scene` and `timeline`.
- Add `SceneContext`/`SceneProvider` and `useScene()`.
- Update generic annotation/page hooks so a Presentation 4 normalized body is not assumed to be an array.
- Keep current CanvasPanel behavior and public P3 types compatible.

`ScenePanel` always uses `Vault4`. It reuses an existing parent Vault4, accepts an explicit `vault`, or creates its own Vault4.

### Context across the Fiber root

`SceneCanvas` will capture the Vault, Scene runtime store, renderer registry, locale, and annotation settings outside `<Canvas>`, then re-provide those same instances inside the Fiber root. This follows the existing ContextBridge pattern and avoids relying on implicit propagation across renderers. Fiber hooks remain inside `<Canvas>`, as required by React Three Fiber’s [hook model](https://r3f.docs.pmnd.rs/api/hooks).

## 4. Public ScenePanel API

### Entry components

```ts
type SceneInput = string | { id: string; type: 'Scene' } | Scene | SceneNormalized;

type ManifestInput = string | Manifest | ManifestNormalized;

interface ScenePanelProps {
  manifest?: ManifestInput;
  scene?: SceneInput;
  startScene?: string;
  vault?: Vault4;

  children?: React.ReactNode; // Mounted inside the R3F SceneCanvas.
  overlay?: React.ReactNode; // Mounted as HTML above the canvas.
  controls?: boolean | React.ReactNode; // true by default.
  annotations?: 'auto' | 'none'; // "auto" by default.

  renderers?: readonly SceneResourceRenderer[];
  clock?: SceneClock;
  canvasProps?: Omit<FiberCanvasProps, 'children'>;

  className?: string;
  style?: React.CSSProperties;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;

  onReady?: (scene: SceneNormalized) => void;
  onDiagnostic?: (diagnostic: SceneDiagnostic) => void;
}

interface ScenePanelHandle {
  play(): void;
  pause(): void;
  seek(time: number): void;
  setPlaybackRate(rate: number): void;
  reset(): void;
  resetView(): void;
  selectCamera(id: string): void;
  selectAnnotation(id: string | null): void;
  activate(target: string | { id: string; type: string }): ActivationResult;
  getSnapshot(): SceneRuntimeSnapshot;
}
```

Scene selection precedence:

1. `scene`
2. `startScene`
3. Manifest `start`, if it resolves to a Scene
4. The only Scene in the Manifest
5. Otherwise emit `scene-selection-required` and render the error fallback

There is no automatic navigation between Manifest Scenes.

### Lower-level toolkit

Export:

- `SceneProvider`
- `SceneCanvas`
- `SceneContents`
- `Annotation3D`
- `AnnotationPage3D`
- `SceneControls`
- `SceneTimeline`
- `SceneCameraSelect`
- `SceneAnnotationList`
- `SceneAudioControl`
- `useScene`
- `useSceneControls`
- `useSceneAnnotations`
- `useExternalAnnotationPage`
- `createSceneClock`

Also attach the main primitives to the compound component:

```ts
ScenePanel.Canvas;
ScenePanel.Annotation;
ScenePanel.AnnotationPage;
ScenePanel.Controls;
ScenePanel.Timeline;
```

### Annotation API

```ts
interface Annotation3DProps {
  annotation: string | AnnotationReference | Annotation | AnnotationNormalized;
  marker?: React.ComponentType<AnnotationMarkerProps> | false;
  popover?: React.ComponentType<AnnotationPopoverProps> | false;
  children?: (context: Annotation3DRenderContext) => React.ReactNode;
  onSelect?: (annotation: AnnotationNormalized) => void;
}
```

Default behavior:

- Point targets render a selectable marker.
- WKT Points, lines, polygons, and multi-geometries render appropriate points, outlines, or translucent surfaces.
- Annotation targets that reference a painting annotation use the rendered object’s origin or bounding-box center.
- TextualBody content appears in a sanitized, accessible HTML popover.
- `position` controls popover placement independently from the target marker.
- Selecting a marker or annotation-list entry fires `scope` and matching activating annotations.
- A render-prop child replaces the default 3D marker but retains registration, activation, timing, and the default popover unless explicitly disabled.
- Mounted external annotations register with the same runtime as built-in annotations.

## 5. Scene runtime, clock, and activation semantics

Use one vanilla Zustand store per ScenePanel. Keep Three.js objects in a private controller registry rather than serializing them into Zustand.

### Runtime state

Track:

- Current Scene and duration.
- Current time, playback state, and rate.
- Active camera.
- Selected annotation.
- Audio lock/mute/volume state.
- Loading and per-resource errors.
- Initial and current hidden/disabled/selected/playing state.
- Resource instances keyed by painting path.
- An ID index mapping IIIF resource and annotation IDs to all rendered instances.
- Queued activation transactions.

### Clock

`createSceneClock()` exposes:

```ts
interface SceneClock {
  getSnapshot(): SceneClockSnapshot;
  subscribe(listener: () => void): () => void;
  play(): void;
  pause(): void;
  seek(time: number): void;
  setPlaybackRate(rate: number): void;
}
```

The default clock advances in `useFrame`. A supplied clock owns its advancement, allowing synchronization with an external player.

Rules:

- Clamp time to `[0, duration]`.
- Stop at duration unless the host seeks/replays.
- Temporal visibility uses `[start, end)`.
- An instant activation fires when playback or a seek crosses the instant.
- Interval activations fire on entry and rearm after leaving the interval.
- `temporalScale` is exposed as real-world metadata; Scene time remains seconds.
- Static Scenes use Fiber’s demand rendering. Playing Scenes, active controls, video, or animations request continuous frames.

### Time modes

For an annotation interval beginning at `start`:

- `trim`: local media time is `sceneTime - start`, clamped to the media duration.
- `scale`: map the target interval proportionally onto the complete media duration.
- `loop`: use modulo media duration until the target interval ends.
- Unknown extension values emit a diagnostic and fall back to `trim`.

### Activation engine

Known actions:

- `show`
- `hide`
- `enable`
- `disable`
- `start`
- `stop`
- `reset`
- `select`

Execution rules:

1. Discover all enabled activations matching the interacted resource.
2. Queue them in document/trigger order.
3. Resolve every source, selector, and action.
4. Preflight the complete transaction.
5. Abort without state changes if any action cannot be performed.
6. Apply all state changes through one store update.
7. Let renderers reconcile side effects from the committed desired state.
8. Finish the current transaction even if it disables itself.
9. Process newly triggered activations only after the current transaction completes.

`start`, `stop`, and `reset` address a named glTF animation when an `AnimationSelector` is present; otherwise they address the resource’s time-based controller.

Pointer interaction with models and markers triggers matching activations automatically. Temporal extents trigger from the clock. Arbitrary spatial-volume triggers remain host-directed through `activate(target)`, because the IIIF processing model deliberately leaves the interaction method to the client.

## 6. Three.js rendering behavior

### Coordinate system and transforms

- Map IIIF X/Y/Z directly to Three.js X/Y/Z.
- Do not flip handedness.
- Camera default direction is `-Z`.
- Directional lights, spotlights, and spot audio default to `-Y`.
- Compose ordered transforms into a matrix rather than collapsing them into unordered JSX `position`, `rotation`, and `scale` props.
- Apply `lookAt` after local transforms. It overrides X/Y rotation while preserving Z roll.
- Resolve lookAt references to points, WKT geometry centers, painting-annotation bounds, or positions inside a nested Canvas.

### Models

- Load GLB/glTF using Drei/Three GLTFLoader.
- Enable Draco, KTX2, and Meshopt.
- Clone the scene graph per painted instance while sharing cached immutable assets.
- Preserve skinning and animations.
- Respect annotation `exclude` for embedded audio, animations, cameras, and lights before mounting.
- Report unsupported formats through `onDiagnostic` and render an optional fallback.
- Dispose instance-owned objects without disposing shared loader caches.

### Cameras and interaction modes

Render Perspective and Orthographic cameras.

- First visible camera in document order is active.
- If no visible camera exists, generate a perspective camera and frame the loaded Scene bounds.
- Switching to a hidden camera is impossible until an activation shows it.
- A disabled camera remains selectable programmatically but uses locked controls.
- Map interaction modes:
  - `locked`: no camera mutation
  - `orbit`: orbit controls
  - `hemisphere-orbit`: orbit with hemisphere polar limits
  - `free`: first-person translation and direction controls
  - `free-direction`: first-person direction controls with fixed position
- When multiple modes are supplied, choose the first supported value.

### Lights

Render:

- AmbientLight
- DirectionalLight
- ImageBasedLight
- PointLight
- SpotLight

Rules:

- Default color is `#FFFFFF`.
- Quantity intensity maps linearly to renderer intensity.
- Spot angle is the specified half-angle converted from degrees to radians.
- Use Three’s client-dependent defaults for range, decay, and penumbra, and document them.
- If no visible light exists, add a neutral ambient-plus-directional default rig.
- Load HDR/EXR/LDR equirectangular environment maps through PMREM for ImageBasedLight.
- The first visible parent Scene IBL takes precedence over nested IBLs.
- A nested Scene may contribute its IBL only when its parent has none.

### Audio emitters

Render:

- AmbientAudio using non-positional Three audio.
- PointAudio using positional audio.
- SpotAudio using positional audio with a directional cone.

Rules:

- Attach one AudioListener to the active camera and reparent it on camera changes.
- Load Audio or resolve Timeline painting audio.
- Apply volume and timeMode.
- Map the IIIF spot half-angle to a full Web Audio cone angle of `2 × angle`.
- Use documented Three/Web Audio defaults for attenuation because IIIF does not define distance, decay, or outer gain.
- Add an accessible “Enable audio” control because browsers block autoplay.
- If the clock has already advanced when audio is unlocked, start at the corresponding local time.
- Pause, seek, camera switching, hidden state, and activation actions remain synchronized.

### Nested containers

#### Scene in Scene

- Render recursively under the parent painting transform.
- Ignore nested `backgroundColor`.
- Import nested cameras and lights.
- Apply parent IBL precedence.
- Use the first nested visible camera only when the parent contributes none.
- Detect ancestor Scene cycles and emit a diagnostic instead of recursing.
- Give each painted instance a unique path key while indexing its canonical IIIF IDs for activations.

#### Canvas in Scene

- Place the Canvas top-left at the target point.
- Extend width along `+X` and height along `-Y`.
- Face the forward side toward `+Z`.
- Preserve Canvas coordinate dimensions as Scene units.
- Render the existing Canvas painting strategies as layered plane content:
  - Images and Image API resources as textures.
  - Video as VideoTexture.
  - Text as sanitized HTML/texture content.
  - Choices using the existing choice state.
  - Timed bodies synchronized with the Scene clock.
- Use material depth/polygon offset to preserve Canvas painting order.
- Show the reverse of the forward face on the back unless `backgroundColor` supplies the back color.
- Apply Scene painting transforms after constructing the Canvas local coordinate frame.

#### Timeline in Scene

- Resolve a Timeline only as an Audio Emitter source.
- Mix its painting audio annotations according to Timeline targeting and timeMode.
- Synchronize Timeline local time to its enclosing emitter’s Scene interval.

### Placeholder and accompanying containers

- Render `placeholderContainer` until Scene resources are ready and, for timed Scenes, until the user starts playback.
- Render `accompanyingContainer` in a default adjacent HTML panel.
- Use existing CanvasPanel rendering for Canvas placeholders/accompaniments.
- Use SceneCanvas recursively for Scene placeholders/accompaniments.
- Use media controls for Timeline placeholders/accompaniments.
- Expose components/slots so applications can replace or suppress these presentations.

## 7. Default viewer chrome

`controls={true}` renders:

- Scene label.
- Loading progress and nonfatal resource diagnostics.
- Play/pause and seek controls when the Scene has a duration.
- Current Scene time and temporal-scale-derived real-world time.
- Camera selector when multiple cameras exist.
- Reset-view button.
- Audio enable, mute, and volume controls when audio exists.
- Annotation visibility toggle.
- Ordered annotation list.
- Selected annotation popover.

UI requirements:

- Keyboard-operable native buttons, selects, and range inputs.
- Visible focus states.
- ARIA labels and live loading/error announcements.
- No global CSS reset.
- A small exported stylesheet using `riv-scene-*` classes and CSS custom properties.
- Plain text by default; markup is rendered only after applying the IIIF HTML allowlist.
- Controls and popovers remain DOM elements rather than being drawn into WebGL.

## 8. Renderer extension API

```ts
interface SceneResourceRenderer {
  id: string;
  supports(context: SceneResourceRendererContext): boolean;
  Component: React.ComponentType<SceneResourceRendererProps>;
}
```

Application renderers are evaluated before built-ins. A custom renderer receives:

- Hydrated resource.
- Painting annotation.
- Parsed target.
- Ordered transform matrix.
- Current visibility/disabled/selected/playing state.
- Scene clock snapshot.
- Registration callback for actions and bounds.
- Standard pointer activation props.
- Diagnostic reporter.

A custom renderer must register which actions it supports. This allows activation preflight to preserve transaction atomicity.

## 9. Prototype workspace and build

Create one pnpm workspace containing:

```text
apps/scene-prototype
packages/parser
packages/iiif-helpers
packages/react-iiif-vault
```

Use `workspace:*` for all three local IIIF packages. Add pnpm overrides to guarantee a single React, React DOM, Three.js, and Fiber instance.

React IIIF Vault packaging changes:

- Add `src/scene-panel/index.ts` as a dedicated build entry.
- Add exports for:
  - `./scene-panel`
  - `./scene-panel.css`
- Externalize React, React DOM, Three.js, Fiber, and Drei.
- Produce declarations and the same ESM/CJS coverage as the existing package.
- Verify that importing `react-iiif-vault` or `react-iiif-vault/canvas-panel` does not include or require Three.js.
- Verify Node import does not touch `window`, WebGL, or AudioContext at module evaluation time.
- Document ScenePanel as a client component for React Server Components and provide an SSR fallback prop.

## 10. Test and acceptance plan

### Pure unit tests

- Ordered transform matrices, including repeated transforms and reflections.
- X/Y/Z Euler order and degrees-to-radians conversion.
- Point, WKT, fragment, alternative, and refined selectors.
- Scene fragment `#x,y,z&t=start,end`.
- Temporal visibility and all time modes.
- LookAt precedence and target resolution.
- Default camera/light selection.
- Nested Scene IBL/camera precedence.
- Canvas-in-Scene coordinate conversion.
- Activation preflight, rollback, queuing, self-disable, scope expansion, and reset.
- Resource ID to instance-path indexing.

### Component tests

Use `@react-three/test-renderer` with mocked loaders/audio to verify:

- Basic Model creates a scene object, default camera, and default lights.
- Configured Scene uses supplied camera, light, point, and background.
- All camera/light/audio component types create the expected Three objects.
- Hidden/disabled behavior changes rendering and interaction.
- Annotation3D registers, renders, selects, and opens its popover.
- Externally mounted annotations share the parent runtime.
- Custom resource renderers override built-ins.
- Scene changes fully reset runtime and dispose instance resources.

### Browser integration tests

Add Playwright Chromium tests using real WebGL for the official examples:

- Basic astronaut Scene.
- Configured camera and spotlight.
- Ordered transformed chess pieces and IBL.
- Three spatial audio emitters across a 60-second Scene.
- Nested Scene rendered twice.
- Canvas chessboard orientation and back face.
- Comment marker selecting a hidden camera through activation.
- Scope shorthand camera selection.
- Light switch toggling hidden/disabled states atomically.
- Named glTF animation start, stop, and reset.
- Keyboard operation of the entire default toolbar.
- Audio unlock and seek resynchronization.
- WebGL unavailable, failed model, failed audio, unsupported model format, and malformed selector fallbacks.

Use deterministic screenshots for representative static Scenes and structural assertions for animation/audio tests.

### Release gates

All of the following must pass before the beta release:

- Parser typecheck, normalization, serialization, and fixture corpus.
- Helpers typecheck and Scene/activation tests.
- React IIIF Vault typecheck, unit tests, component tests, Playwright tests, build, and package lint.
- Packed ESM/CJS import tests for every public subpath.
- No Three.js code in non-Scene entry bundles.
- No unhandled resource-loading or AudioContext promise rejections.
- No partial state changes from a failed activation transaction.
- Official use cases 7–9 represented in the parity matrix with passing automated evidence.

## Assumptions and explicit defaults

- Specification baseline: `IIIF/api@28a88829699ebbbe7722b4692cf3b7b67969bc6c`.
- React ScenePanel requires React 19, even if non-Scene React IIIF Vault entry points retain React 18 compatibility.
- Multiple Manifest Scenes are host-selected; ScenePanel does not navigate them.
- WebGL2 and Web Audio are the browser baseline.
- WebXR and native/Expo rendering are out of scope.
- glTF/GLB and progressive `.splat` Gaussian splats are the built-in model formats.
- Scene units map directly to Three units; `spatialScale` is exposed rather than silently rescaling geometry.
- Missing camera and light definitions receive documented client defaults.
- Missing audio attenuation values use documented Three.js defaults.
- Pointer, annotation-list, scope, and temporal interactions trigger automatically; arbitrary spatial-volume detection is host-driven.
- Unsupported extension actions abort their entire transaction unless a custom handler is registered.
- Supplementary annotations are rendered automatically unless `annotations="none"`.

# Mock README

## ScenePanel

`ScenePanel` renders IIIF Presentation 4 Scenes using React Three Fiber. It includes cameras, lighting, spatial audio, time, annotations, activation actions, nested containers, and accessible viewer controls.

```sh
pnpm add react-iiif-vault @iiif/parser @iiif/helpers \
  react react-dom three @react-three/fiber @react-three/drei
```

```tsx
import { ScenePanel } from 'react-iiif-vault/scene-panel';
import 'react-iiif-vault/scene-panel.css';

export function Viewer() {
  return <ScenePanel manifest="https://example.org/iiif/manifest.json" style={{ height: 640 }} />;
}
```

If the Manifest has multiple Scenes, select one explicitly:

```tsx
export function Viewer({ sceneId }: { sceneId: string }) {
  return <ScenePanel manifest="https://example.org/iiif/manifest.json" scene={sceneId} style={{ height: '100vh' }} />;
}
```

`scene` may also be an embedded Scene or normalized Scene:

```tsx
<ScenePanel scene={scene} />
```

## External annotations

Children of `ScenePanel` are mounted inside its `SceneCanvas`, so external annotation pages can be rendered with the same Scene runtime:

```tsx
import { Annotation3D, ScenePanel, useExternalAnnotationPage } from 'react-iiif-vault/scene-panel';

function ExternalAnnotations({ id }: { id: string }) {
  const page = useExternalAnnotationPage(id);

  return (
    <>
      {page?.items.map((annotation) => (
        <Annotation3D key={annotation.id} annotation={annotation} />
      ))}
    </>
  );
}

export function Viewer() {
  return (
    <ScenePanel scene="https://example.org/iiif/scene/1" style={{ height: 640 }}>
      <ExternalAnnotations id="https://example.org/annotations/page/1" />
    </ScenePanel>
  );
}
```

Point and WKT targets receive a default marker. Selecting one opens a textual popover and triggers matching activating annotations or `scope`.

## Custom annotation markers

```tsx
<Annotation3D annotation={annotation} popover={MyPopover}>
  {({ point, selected, activate }) => (
    <mesh position={point} onClick={activate}>
      <sphereGeometry args={[selected ? 0.08 : 0.05]} />
      <meshStandardMaterial color={selected ? 'gold' : 'crimson'} />
    </mesh>
  )}
</Annotation3D>
```

The render prop changes only the 3D visualization. Timing, selection, activation registration, and the popover continue to work.

## Controlling time and activations

```tsx
import { ScenePanel, useSceneControls } from 'react-iiif-vault/scene-panel';

function TourButtons() {
  const { currentTime, play, pause, seek, activate, reset } = useSceneControls();

  return (
    <div>
      <button onClick={play}>Play</button>
      <button onClick={pause}>Pause</button>
      <button onClick={() => seek(currentTime + 10)}>+10 seconds</button>
      <button onClick={() => activate('https://example.org/annotations/show-detail')}>Show detail</button>
      <button onClick={reset}>Reset scene</button>
    </div>
  );
}

<ScenePanel scene={scene} overlay={<TourButtons />} />;
```

The same controls are available through a ref:

```tsx
const scenePanel = useRef<ScenePanelHandle>(null);

<ScenePanel ref={scenePanel} scene={scene} />;

scenePanel.current?.selectCamera(cameraId);
scenePanel.current?.seek(30);
scenePanel.current?.activate(annotationId);
```

## Composing the lower-level toolkit

```tsx
import { Annotation3D, SceneCanvas, SceneControls, SceneProvider } from 'react-iiif-vault/scene-panel';

function CustomViewer({ scene, annotations }) {
  return (
    <SceneProvider scene={scene}>
      <div className="my-viewer">
        <SceneCanvas>
          {annotations.map((annotation) => (
            <Annotation3D key={annotation.id} annotation={annotation} />
          ))}
        </SceneCanvas>

        <SceneControls />
      </div>
    </SceneProvider>
  );
}
```

`SceneCanvas` automatically renders the Scene’s painting annotations. Its children add extra R3F content and annotations.

## Custom model formats

GLB, glTF, and progressive `.splat` Gaussian splats are built in. Add other formats through a resource renderer:

```tsx
const objRenderer: SceneResourceRenderer = {
  id: 'obj-model',
  supports: ({ resource }) => resource.type === 'Model' && resource.format === 'model/obj',
  Component: ObjModelRenderer,
};

<ScenePanel scene={scene} renderers={[objRenderer]} />;
```

Application renderers are checked before built-in renderers. A renderer can also implement an extension Scene component type or activation action.

## Replacing the default controls

```tsx
<ScenePanel scene={scene} controls={<MySceneToolbar />} />
```

Disable all supplied chrome while retaining camera interaction:

```tsx
<ScenePanel scene={scene} controls={false} />
```

Disable automatic supplementary annotations:

```tsx
<ScenePanel scene={scene} annotations="none">
  {selectedAnnotations.map((annotation) => (
    <Annotation3D key={annotation.id} annotation={annotation} />
  ))}
</ScenePanel>
```

## Audio

Browsers require a user gesture before audio can start. The default controls display an “Enable audio” button when a Scene has Audio Emitters. If the Scene clock is already running, audio synchronizes to the current Scene time when enabled.

## Server-rendered applications

ScenePanel is a client component. It is safe to import during server rendering, but WebGL begins only after mounting:

```tsx
'use client';

export function SceneViewer() {
  return (
    <ScenePanel
      scene={scene}
      loadingFallback={<p>Loading 3D scene…</p>}
      errorFallback={<p>This scene could not be displayed.</p>}
    />
  );
}
```
