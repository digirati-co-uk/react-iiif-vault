import type { Annotation } from '@iiif/parser/presentation-3/types';
import type { AnnotationNormalized, AnnotationPageNormalized } from '@iiif/parser/presentation-3-normalized/types';
import React, { createContext, useContext, useMemo } from 'react';
import { useVirtualAnnotationPage, VaultActivatedAnnotation } from './useVirtualAnnotationPage';

const VirtualAnnotationPageContext = createContext<{
  fullPage: AnnotationPageNormalized | null;
  addAnnotation: (
    id: string | Annotation | VaultActivatedAnnotation | AnnotationNormalized,
    atIndex?: number | undefined
  ) => void;
  removeAnnotation: (id: string | Annotation | VaultActivatedAnnotation | AnnotationNormalized) => void;
} | null>(null);

export function useVirtualAnnotationPageContext() {
  const ctx = useContext(VirtualAnnotationPageContext);

  return [
    ctx!.fullPage,
    {
      addAnnotation: ctx!.addAnnotation,
      removeAnnotation: ctx!.removeAnnotation,
    },
  ] as [
    AnnotationPageNormalized | null,
    {
      addAnnotation: (
        id: string | Annotation | VaultActivatedAnnotation | AnnotationNormalized,
        atIndex?: number | undefined
      ) => void;
      removeAnnotation: (id: string | Annotation | VaultActivatedAnnotation | AnnotationNormalized) => void;
    },
  ];
}

export function VirtualAnnotationProvider({ children }: { children: any }) {
  const [fullPage, { addAnnotation, removeAnnotation }] = useVirtualAnnotationPage();

  return (
    <VirtualAnnotationPageContext.Provider
      value={useMemo(() => ({ fullPage, addAnnotation, removeAnnotation }), [fullPage])}
    >
      {children}
    </VirtualAnnotationPageContext.Provider>
  );
}
