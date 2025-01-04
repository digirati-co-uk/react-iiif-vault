import { ReactNode } from 'react';
import { useStrategy } from '../../context/StrategyContext';
import { useVirtualAnnotationPageContext } from '../../hooks/useVirtualAnnotationPageContext';
import { RenderAnnotationPage } from '../render/AnnotationPage';

export interface AnnotationStrategyProps {
  children?: ReactNode;
}

export function RenderAnnotationStrategy({ children }: AnnotationStrategyProps) {
  const { strategy } = useStrategy();
  const [virtualPage] = useVirtualAnnotationPageContext();

  if (strategy.type !== 'images') return null;

  return (
    <>
      {virtualPage ? <RenderAnnotationPage page={virtualPage} /> : null}

      {strategy.annotations && strategy.annotations.pages
        ? strategy.annotations.pages.map((page) => {
            return <RenderAnnotationPage key={page.id} page={page} />;
          })
        : null}

      {children}
    </>
  );
}
