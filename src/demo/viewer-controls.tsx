import { useViewerPreset } from '../context/ViewerPresetContext';

export function ViewerControls() {
  const preset = useViewerPreset();

  return (
    <div style={{ display: 'flex', alignItems: 'center', position: 'absolute', top: 20, right: 20, zIndex: 12 }}>
      <button onClick={() => preset?.runtime.world.zoomOut()}>Zoom Out</button>
      <button onClick={() => preset?.runtime.world.zoomIn()}>Zoom in</button>
      <button onClick={() => preset?.runtime.world.goHome()}>Home</button>
    </div>
  );
}
