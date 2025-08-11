import { HTMLPortal } from '@atlas-viewer/atlas';
import {
  autoUpdate,
  type ElementProps,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { createPortal } from 'react-dom';
import { ContextBridge, useContextBridge, useCustomContextBridge } from '../../context/ContextBridge';

export function RenderHighlightAnnotation({
  annotation,
  target,
  children,
  dismissable,
  isOpen,
  onOpenChange,
}: {
  annotation: { id: string };
  target: { x: number; y: number; width: number; height: number };
  children: React.ReactNode;
  dismissable?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const bridge = useContextBridge();
  const custom = useCustomContextBridge();
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange,
    nodeId: annotation.id,
    placement: 'bottom',
    // strategy: "fixed",
    middleware: [offset(10), shift(), flip({ mainAxis: true })],
    whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions(
    [dismissable ? dismiss : null].filter((e) => e !== null) as ElementProps[],
  );

  return (
    <HTMLPortal relative target={target} interactive={false}>
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
        }}
      />
      {createPortal(
        <ContextBridge bridge={bridge} custom={custom}>
          <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
            {children}
          </div>
        </ContextBridge>,
        document.getElementById('atlas-floating-ui') as HTMLElement,
      )}
    </HTMLPortal>
  );
}
