import React, { ReactNode } from 'react';
import { ContextBridge, useContextBridge } from '../context/ContextBridge';
import { AtlasAuto } from '@atlas-viewer/atlas';
import { VirtualAnnotationProvider } from '../hooks/useVirtualAnnotationPageContext';
import { AtlasProps } from '@atlas-viewer/atlas/dist/types/modules/react-reconciler/Atlas';

export function Viewer({
  children,
  ...props
}: AtlasProps & {
  height?: number | string;
  width?: number | string;
  resizeHash?: number;
  containerProps?: any;
  aspectRatio?: number;
} & { children: ReactNode }) {
  const bridge = useContextBridge();

  return (
    <AtlasAuto {...props}>
      <ContextBridge bridge={bridge}>
        <VirtualAnnotationProvider>{children}</VirtualAnnotationProvider>
      </ContextBridge>
    </AtlasAuto>
  );
}
