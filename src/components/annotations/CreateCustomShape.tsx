import { Atlas, type BoxStyle, HTMLPortal, useAtlas } from '@atlas-viewer/atlas';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AtlasStoreEvents } from '../../canvas-panel/context/atlas-store';
import { AtlasStoreReactContext, useAtlasStore } from '../../canvas-panel/context/atlas-store-provider';
import { useEvent } from '../../hooks/useEvent';
import { useRequestAnnotation } from '../../hooks/useRequestAnnotation';
import type { useSvgEditor } from '../../hooks/useSvgEditor';

export const svgThemes = [
  {
    name: 'Default',
    outer: { borderWidth: 4, borderColor: 'rgba(255, 255, 255, .4)' },
    inner: { borderWidth: 2, borderColor: '#000' },
  },
  {
    name: 'High contrast',
    outer: { borderWidth: 3, borderColor: '#fff' },
    inner: { borderWidth: 1, borderColor: '#000' },
  },
  {
    name: 'Lightsaber',
    outer: { borderWidth: '4', borderColor: 'rgba(56,68,255,0.64)' },
    inner: { borderWidth: '2', borderColor: '#fff' },
  },
  {
    name: 'Bright',
    outer: { borderWidth: '6', borderColor: '#25d527' },
    inner: { borderWidth: '3', borderColor: '#a916ff' },
  },
  {
    name: 'pink',
    outer: { borderWidth: '4', borderColor: '#ff00ff' },
    inner: { borderWidth: '2', borderColor: '#ffffff' },
  },
  {
    name: 'fine (dark)',
    outer: { borderWidth: '1', borderColor: '#000000' },
    inner: {},
  },
  {
    name: 'fine (light)',
    outer: { borderWidth: '1', borderColor: '#FFF' },
    inner: {},
  },
];

type HelperType = ReturnType<typeof useSvgEditor>['helper'];
type StateType = ReturnType<typeof useSvgEditor>['state'];

export type SvgTheme = { name?: string; outer: BoxStyle; inner: BoxStyle };

export interface CreateCustomShapeProps {
  image: { width: number; height: number };
  shape?: any;
  updateShape: any;
  theme?: { name?: string; outer: BoxStyle; inner: BoxStyle };
  controlsHtmlId?: string;
  renderControls?: (helper: HelperType, state: StateType, showShapes: boolean) => any;
}

export function CreateCustomShape(props: CreateCustomShapeProps) {
  const { id, data, requestAnnotation, cancelRequest, isPending } = useRequestAnnotation({
    onSuccess: (resp) => {
      props.updateShape(resp.polygon);
    },
  });

  useEffect(() => {
    requestAnnotation({
      type: 'polygon',
      open: props.shape?.open,
      points: props.shape?.points,
    });

    return () => {
      cancelRequest();
    };
  }, []);

  return null;
}
