import type { ReactNode } from 'react';
import { useSimpleViewer } from './SimpleViewerContext';
import type { CanvasRoute, ContainerRoute, SceneRoute, TimelineRoute } from './SimpleViewerContext.types';

export type ContainerRouterProps = {
  renderCanvas?: (route: CanvasRoute) => ReactNode;
  renderScene?: (route: SceneRoute) => ReactNode;
  renderTimeline?: (route: TimelineRoute) => ReactNode;
  fallback?: ReactNode | ((route: ContainerRoute) => ReactNode);
};

export function ContainerRouter({ renderCanvas, renderScene, renderTimeline, fallback = null }: ContainerRouterProps) {
  const { currentRoute } = useSimpleViewer();
  if (!currentRoute) return null;

  if (currentRoute.type === 'Canvas' && renderCanvas) return renderCanvas(currentRoute);
  if (currentRoute.type === 'Scene' && renderScene) return renderScene(currentRoute);
  if (currentRoute.type === 'Timeline' && renderTimeline) return renderTimeline(currentRoute);
  return typeof fallback === 'function' ? fallback(currentRoute) : fallback;
}
