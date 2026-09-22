import type { ImageOptions } from '../scene/types';
import { useRenderControls } from '../../context/ControlsContext';
import { useStrategy } from '../../context/StrategyContext';
import { RenderComplexTimeline } from '../render/ComplexTimeline';

export function RenderComplexTimelineStrategy({ imageOptions }: { imageOptions?: ImageOptions } = {}) {
  const { strategy } = useStrategy();
  const { renderComplexTimelineControls } = useRenderControls();

  if (strategy.type !== 'complex-timeline') return null;

  return (
    <RenderComplexTimeline strategy={strategy} imageOptions={imageOptions}>
      {renderComplexTimelineControls ? renderComplexTimelineControls(strategy) : null}
    </RenderComplexTimeline>
  );
}
