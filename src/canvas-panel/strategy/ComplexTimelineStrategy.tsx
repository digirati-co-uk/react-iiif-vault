import { useRenderControls } from '../../context/ControlsContext';
import { useStrategy } from '../../context/StrategyContext';
import { RenderComplexTimeline } from '../render/ComplexTimeline';

export function RenderComplexTimelineStrategy() {
  const { strategy } = useStrategy();
  const { renderComplexTimelineControls } = useRenderControls();

  if (strategy.type !== 'complex-timeline') return null;

  return (
    <RenderComplexTimeline strategy={strategy}>
      {renderComplexTimelineControls ? renderComplexTimelineControls(strategy) : null}
    </RenderComplexTimeline>
  );
}
