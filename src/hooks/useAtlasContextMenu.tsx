import { useCallback } from 'react';
import { create } from 'zustand';
import { RenderHighlightAnnotation } from '../canvas-panel/render/HighlightAnnotation';

export type RenderContextProps = {
  canvasId?: string;
  position: { x: number; y: number };
  close: () => void;
};

export const useContextMenuStore = create<{
  isMenuOpen: boolean;
  menuPosition: { x: number; y: number };
  open(position: { x: number; y: number }): void;
  toggle(position: { x: number; y: number }): void;
  setMenuPosition(position: { x: number; y: number }): void;
  setIsMenuOpen(isMenuOpen: boolean | ((prev: boolean) => boolean)): void;
  close(): void;
}>()((set) => ({
  isMenuOpen: false,
  menuPosition: { x: 0, y: 0 },
  setMenuPosition(menuPosition: { x: number; y: number }) {
    set({ menuPosition });
  },
  toggle(menuPosition?: { x: number; y: number }) {
    set((state) => ({ isMenuOpen: !state.isMenuOpen, menuPosition }));
  },
  open(menuPosition: { x: number; y: number }) {
    set({ isMenuOpen: true, menuPosition });
  },
  setIsMenuOpen(isMenuOpen) {
    if (typeof isMenuOpen === 'function') {
      set((state) => ({ isMenuOpen: isMenuOpen(state.isMenuOpen) }));
    } else {
      set({ isMenuOpen });
    }
  },
  close() {
    set({ isMenuOpen: false });
  },
}));

export function useAtlasContextMenu(
  id: string,
  canvasId?: string,
  renderContextMenu?: (props: RenderContextProps) => React.ReactNode,
) {
  const { isMenuOpen, setIsMenuOpen, close, open, menuPosition, setMenuPosition, toggle } = useContextMenuStore();

  const onContextMenu = useCallback(
    (e: any) => {
      if (renderContextMenu) {
        e.preventDefault();
        e.stopPropagation();
        toggle(e.atlas);
      }
    },
    [toggle, renderContextMenu],
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

  return [menu, props, { open, close, toggle, isMenuOpen, setIsMenuOpen, menuPosition, setMenuPosition }] as const;
}
