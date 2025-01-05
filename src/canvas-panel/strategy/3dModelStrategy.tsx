import { useStrategy } from '../../context/StrategyContext';
import { Model } from '../render/Model';

export function Render3DModelStrategy() {
  const { strategy } = useStrategy();
  if (strategy.type !== '3d-model') {
    return null;
  }

  return <Model model={strategy.model} />;
}
