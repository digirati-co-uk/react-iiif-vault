import { useViewerPreset } from '../context/ViewerPresetContext';
import { useAnnotationPageManager } from '../hooks/useAnnotationPageManager';
import { useCanvas } from '../hooks/useCanvas';

export function ViewerControls() {
  const canvas = useCanvas();
  const preset = useViewerPreset();
  const pm = useAnnotationPageManager(canvas?.id);
  const enabled = pm.enabledPageIds.length !== 0;

  const toggleAnnotations = () => {
    if (enabled) {
      pm.availablePageIds.map((id) => pm.setPageDisabled(id));
    } else {
      pm.availablePageIds.map((id) => pm.setPageEnabled(id, { deselectOthers: false }));
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', position: 'absolute', top: 20, right: 20, zIndex: 12 }}>
      <button onClick={() => preset?.runtime.world.zoomOut()}>Zoom Out</button>
      <button onClick={() => preset?.runtime.world.zoomIn()}>Zoom in</button>
      <button onClick={() => preset?.runtime.world.goHome()}>Home</button>
      {pm.availablePageIds.length ? (
        <button onClick={toggleAnnotations}>{!enabled ? 'Enable annotations' : 'Disable annotations'}</button>
      ) : null}
    </div>
  );
}
