// @ts-ignore
import ModelViewer from 'react-model-viewer';
import { CanvasPortal } from '../../context/PortalContext';

export function Model({ model }: { model: any }) {
  return (
    <CanvasPortal overlay>
      <style>
        {`
            .model-container {
              position: absolute;
              top: 0;
              bottom: 0;
              left: 0;
              right: 0;
              background: #000;
              z-index: 13;
              display: flex;
              justify-content: center;
              pointer-events: visible;
            }
          `}
      </style>
      <div className="model-container">
        {/*@ts-ignore*/}
        <model-viewer
          interaction-prompt="none"
          style={{ width: '100%', height: '100%' }}
          camera-controls=""
          ar-status="not-presenting"
          src={model.id}
        />
      </div>
    </CanvasPortal>
  );
}
