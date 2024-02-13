import { useCanvas } from '@atlas-viewer/atlas';
import { CanvasPanel } from '../canvas-panel';
import { useAnnotationPageManager } from '../hooks/useAnnotationPageManager';
import { useVault } from '../hooks/useVault';
import { forwardRef, useImperativeHandle } from 'react';

export const CanvasAnnotations = forwardRef<ReturnType<typeof useAnnotationPageManager>, { canvasId?: string }>(
  function CanvasAnnotations({ canvasId }, ref) {
    const canvas = useCanvas();
    const pm = useAnnotationPageManager(canvasId || canvas?.id);
    const vault = useVault();

    useImperativeHandle(ref, () => pm, [canvasId, canvas]);

    if (!canvas || pm.enabledPageIds.length === 0) {
      return null;
    }

    return (
      <>
        {pm.enabledPageIds.map((id) => (
          <CanvasPanel.RenderAnnotationPage key={id} page={vault.get(id)} />
        ))}
      </>
    );
  }
);
