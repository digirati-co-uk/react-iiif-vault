import { HTMLPortal } from '@atlas-viewer/atlas';
import {
  autoUpdate,
  detectOverflow,
  type ElementProps,
  flip,
  type Middleware,
  offset,
  type Placement,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { createPortal } from 'react-dom';
import { ContextBridge, useContextBridge, useCustomContextBridge } from '../../context/ContextBridge';
import { useViewerIdentifier } from '../../context/ViewerIdentifierContext';

const HIGHLIGHT_ANNOTATION_OFFSET = 10;
const MIN_REGION_SIZE_FOR_INSIDE_FALLBACK = 1;

type Side = 'top' | 'right' | 'bottom' | 'left';
type Alignment = 'start' | 'end' | undefined;

function getPlacementParts(placement: Placement): [Side, Alignment] {
  const [side, alignment] = placement.split('-');

  return [side as Side, alignment as Alignment];
}

function clamp(value: number, min: number, max: number) {
  if (min > max) {
    return value;
  }

  return Math.min(Math.max(value, min), max);
}

function hasOverflow(overflow: { top: number; right: number; bottom: number; left: number }) {
  return overflow.top > 0 || overflow.right > 0 || overflow.bottom > 0 || overflow.left > 0;
}

function insideHighlightFallback(target: { width: number; height: number }): Middleware {
  return {
    name: 'insideHighlightFallback',
    options: target,
    async fn(state) {
      if (target.width <= MIN_REGION_SIZE_FOR_INSIDE_FALLBACK || target.height <= MIN_REGION_SIZE_FOR_INSIDE_FALLBACK) {
        return {};
      }

      const overflow = await detectOverflow(state, { altBoundary: true });

      if (!hasOverflow(overflow)) {
        return {};
      }

      const { reference, floating } = state.rects;
      const [side, alignment] = getPlacementParts(state.initialPlacement);
      const inset = Math.min(HIGHLIGHT_ANNOTATION_OFFSET, reference.width / 2, reference.height / 2);
      const centerX = reference.x + (reference.width - floating.width) / 2;
      const centerY = reference.y + (reference.height - floating.height) / 2;
      let x = state.x;
      let y = state.y;

      if (side === 'top' || side === 'bottom') {
        y = side === 'top' ? reference.y + inset : reference.y + reference.height - floating.height - inset;

        if (alignment === 'start') {
          x = reference.x + inset;
        } else if (alignment === 'end') {
          x = reference.x + reference.width - floating.width - inset;
        } else {
          x = centerX;
        }

        x = clamp(x, reference.x + inset, reference.x + reference.width - floating.width - inset);
      } else {
        x = side === 'left' ? reference.x + inset : reference.x + reference.width - floating.width - inset;

        if (alignment === 'start') {
          y = reference.y + inset;
        } else if (alignment === 'end') {
          y = reference.y + reference.height - floating.height - inset;
        } else {
          y = centerY;
        }

        y = clamp(y, reference.y + inset, reference.y + reference.height - floating.height - inset);
      }

      return { x, y };
    },
  };
}

export function RenderHighlightAnnotation({
  annotation,
  target,
  children,
  dismissable,
  isOpen,
  onOpenChange,
  placement,
}: {
  annotation: { id: string };
  target: { x: number; y: number; width: number; height: number };
  children: React.ReactNode;
  placement?: Placement;
  dismissable?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const identifier = useViewerIdentifier();
  const bridge = useContextBridge();
  const custom = useCustomContextBridge();
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange,
    nodeId: annotation.id,
    placement: placement || 'bottom',
    // strategy: "fixed",
    middleware: [
      offset(HIGHLIGHT_ANNOTATION_OFFSET),
      flip({ mainAxis: true, fallbackStrategy: 'bestFit', altBoundary: true }),
      shift({ altBoundary: true }),
      insideHighlightFallback(target),
    ],
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
        document.getElementById(`atlas-floating-ui-${identifier}`) as HTMLElement,
      )}
    </HTMLPortal>
  );
}
