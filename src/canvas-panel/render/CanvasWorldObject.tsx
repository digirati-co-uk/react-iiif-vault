import { type ReactNode, useCallback, useEffect } from 'react';
import { type RenderContextProps, useAtlasContextMenu } from '../../hooks/useAtlasContextMenu';
import { useCanvasContainer } from '../../hooks/useCanvasContainer';
import { useAtlasStore } from '../context/atlas-store-provider';
import { CanvasWorldObject as SceneWorldObject, type CanvasWorldObjectProps } from '../scene/CanvasWorldObject';

export function CanvasWorldObject({ renderContextMenu, children, ...props }: CanvasWorldObjectProps & {
  renderContextMenu?: (options: RenderContextProps) => ReactNode;
}) {
  const canvas = useCanvasContainer();
  const store = useAtlasStore();
  const [contextMenu, events] = useAtlasContextMenu(`context-menu/${canvas?.id}`, canvas?.id, renderContextMenu);
  const onPositionChange = useCallback<NonNullable<CanvasWorldObjectProps['onPositionChange']>>((id, position) => {
    if (position) store.getState().setCanvasRelativePosition(id, position);
    else store.getState().clearCanvasRelativePosition(id);
  }, [store]);
  useEffect(() => { if (canvas) store.getState().reset(); }, [store, canvas]);
  return <SceneWorldObject {...props} events={events} onPositionChange={onPositionChange}>{contextMenu}{children}</SceneWorldObject>;
}
