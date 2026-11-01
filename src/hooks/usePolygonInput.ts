import { useEffect, useRef, type RefObject } from 'react';
import type { Point, createHelper } from 'polygon-editor';

export interface PolygonInputEvent {
  pointerId?: number;
  pointerType?: string;
  button?: number;
  buttons?: number;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}
export interface PolygonInputOptions<E extends PolygonInputEvent> {
  helper: ReturnType<typeof createHelper>;
  /** Convert an event to world coordinates. Return null when the surface is not measurable (unmounted, hidden). */
  toWorld: (event: E) => Point | null;
  element?: RefObject<SVGSVGElement | null>;
  enabled?: boolean;
  capturePointer?: boolean;
}

/** Shared gesture lifecycle for SVG pointer events and viewer world-coordinate adapters. */
export function usePolygonInput<E extends PolygonInputEvent>({
  helper,
  toWorld,
  element,
  enabled = true,
  capturePointer = true,
}: PolygonInputOptions<E>) {
  const contacts = useRef(new Set<number>());
  const blocked = useRef(false);
  const pressed = useRef(false);
  const active = useRef<number | null>(null);
  const flush = () => helper.clock.flush();
  function reset(reason: string) {
    helper.cancelGesture(reason);
    helper.modifiers.reset();
    pressed.current = false;
    active.current = null;
    flush();
  }
  function modifiers(event: E) {
    for (const [key, held] of [
      ['Shift', event.shiftKey],
      ['Alt', event.altKey],
      ['Meta', event.metaKey || event.ctrlKey],
    ] as const) {
      held ? helper.modifiers.set(key) : helper.modifiers.unset(key);
    }
    if (event.pointerType)
      helper.setPointerType(event.pointerType === 'touch' ? 'touch' : event.pointerType === 'pen' ? 'pen' : 'mouse');
  }
  useEffect(() => {
    const blur = () => {
      contacts.current.clear();
      blocked.current = false;
      reset('blur');
    };
    const up = (event: KeyboardEvent) => {
      helper.key.up(event.key);
      flush();
    };
    const down = (event: KeyboardEvent) => {
      if (
        !element?.current?.contains(document.activeElement) ||
        /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName) ||
        (event.target as HTMLElement)?.isContentEditable
      )
        return;
      if (helper.key.down(event.key)) event.preventDefault();
      flush();
    };
    window.addEventListener('blur', blur);
    window.addEventListener('keyup', up);
    window.addEventListener('keydown', down);
    return () => {
      window.removeEventListener('blur', blur);
      window.removeEventListener('keyup', up);
      window.removeEventListener('keydown', down);
      reset('unmount');
      contacts.current.clear();
    };
  }, [helper, element]);
  useEffect(() => {
    if (!enabled) reset('disabled');
  }, [enabled, helper]);
  return {
    pointerDown(event: E) {
      if (!enabled || (event.button !== undefined && event.button !== 0)) return;
      const id = event.pointerId ?? 1;
      contacts.current.add(id);
      if (contacts.current.size > 1) {
        blocked.current = true;
        reset('multiple-pointers');
        return;
      }
      if (blocked.current) return;
      element?.current?.focus({ preventScroll: true });
      const point = toWorld(event);
      if (!point) {
        contacts.current.delete(id);
        return;
      }
      if (capturePointer && event.pointerId !== undefined) {
        try {
          element?.current?.setPointerCapture?.(id);
        } catch {
          // Synthetic or already-released pointers cannot be captured; the gesture still works.
        }
      }
      modifiers(event);
      active.current = id;
      pressed.current = true;
      helper.pointerDown(point);
      flush();
    },
    pointerMove(event: E) {
      if (!enabled || blocked.current || (active.current !== null && active.current !== (event.pointerId ?? 1))) return;
      if (event.buttons && !(event.buttons & 1)) return;
      const point = toWorld(event);
      if (!point) return;
      modifiers(event);
      helper.pointer([point]);
      flush();
    },
    pointerUp(event: E) {
      if (event.button !== undefined && event.button !== 0) return;
      const id = event.pointerId ?? 1;
      contacts.current.delete(id);
      if (blocked.current) {
        if (!contacts.current.size) {
          blocked.current = false;
          helper.pointerUp();
        }
      } else if (enabled && active.current === id) {
        modifiers(event);
        pressed.current = false;
        active.current = null;
        const point = toWorld(event);
        point ? helper.pointerUp(point) : helper.pointerUp();
      }
      if (event.pointerId !== undefined && element?.current?.hasPointerCapture?.(id))
        element.current.releasePointerCapture(id);
      flush();
    },
    pointerCancel(event: E) {
      contacts.current.delete(event.pointerId ?? 1);
      blocked.current = contacts.current.size > 0;
      reset('pointercancel');
    },
    lostPointerCapture() {
      if (pressed.current) reset('lostpointercapture');
    },
    pointerLeave() {
      if (!pressed.current) {
        helper.blur();
        flush();
      }
    },
    doubleClick(event: E) {
      const point = enabled && !blocked.current ? toWorld(event) : null;
      if (point) {
        helper.doubleClick(point);
        flush();
      }
    },
    releaseOutside() {
      if (pressed.current) reset('release-outside');
    },
    cancel: reset,
  };
}
