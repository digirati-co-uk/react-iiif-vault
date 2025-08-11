import { useCallback, useState } from 'react';
import { RenderHighlightAnnotation } from '../canvas-panel/render/HighlightAnnotation';

export type RenderContextProps = {
  canvasId?: string;
  position: { x: number; y: number };
  close: () => void;
};

export function useAtlasContextMenu(
  id: string,
  canvasId?: string,
  renderContextMenu?: (props: RenderContextProps) => React.ReactNode,
) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const onContextMenu = useCallback(
    (e: any) => {
      if (renderContextMenu) {
        setMenuPosition(e.atlas);
        e.preventDefault();
        e.stopPropagation();
        setIsMenuOpen((o) => !o);
      }
    },
    [renderContextMenu],
  );

  const menu = (
    <>
      {renderContextMenu && isMenuOpen && (
        <RenderHighlightAnnotation
          dismissable
          placement="bottom-start"
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          annotation={{ id }}
          target={{ x: menuPosition.x, y: menuPosition.y, height: 1, width: 1 }}
        >
          {isMenuOpen && renderContextMenu({ canvasId, position: menuPosition, close: () => setIsMenuOpen(false) })}
        </RenderHighlightAnnotation>
      )}
    </>
  );

  const props = { onContextMenu };

  return [menu, props, { isMenuOpen, setIsMenuOpen, menuPosition, setMenuPosition }] as const;
}
