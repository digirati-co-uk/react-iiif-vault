import { useCallback, useState } from 'react';
import { RenderHighlightAnnotation } from '../canvas-panel/render/HighlightAnnotation';

export function useAtlasContextMenu(
  id: string,
  canvasId?: string,
  renderContextMenu?: (props: { canvasId?: string; position: { x: number; y: number } }) => React.ReactNode,
) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const onContextMenu = useCallback((e: any) => {
    setMenuPosition(e.atlas);
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen((o) => !o);
  }, []);

  const menu = (
    <>
      {renderContextMenu && isMenuOpen && (
        <RenderHighlightAnnotation
          dismissable
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          annotation={{ id }}
          target={{ x: menuPosition.x, y: menuPosition.y, height: 1, width: 1 }}
        >
          {renderContextMenu({ canvasId, position: menuPosition })}
        </RenderHighlightAnnotation>
      )}
    </>
  );

  const props = { onContextMenu };

  return [menu, props, { isMenuOpen, setIsMenuOpen, menuPosition, setMenuPosition }] as const;
}
