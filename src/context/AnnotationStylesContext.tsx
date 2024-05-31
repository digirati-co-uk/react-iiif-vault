import { BoxStyle } from '@atlas-viewer/atlas';
import { createContext, useContext, useMemo } from 'react';

export interface AnnotationStyles {
  id: number;
  name: string;
  creator?: { id: number; name: string };
  createdAt: Date;
  theme: {
    default: AnnotationThemeDefinition;
    hidden: AnnotationThemeDefinition;
    highlighted: AnnotationThemeDefinition;
  } & Record<string, AnnotationThemeDefinition>;
}

export type AnnotationThemeDefinition = BoxStyle & {
  hidden?: boolean;
  interactive?: boolean;
  hotspot?: boolean;
  hotspotSize?: 'lg' | 'md' | 'sm';
};

export function getDefaultAnnotationStyles(): AnnotationStyles['theme'] {
  return {
    default: {
      backgroundColor: 'rgba(0,0,0,0)',
      borderWidth: '2px',
      borderColor: 'rgba(252,0,98, .5)',
    },
    highlighted: {
      backgroundColor: 'rgba(75, 103, 225, 0.4)',
      borderWidth: '1px',
      borderColor: 'rgba(75,103,225,0.99)',
    },
    hidden: {
      borderWidth: '0px',
      borderColor: 'rgba(0,0,0,0)',
      backgroundColor: 'rgba(0,0,0,0)',
      hidden: true,
    },
  };
}
const AnnotationStyleContext = createContext<AnnotationStyles['theme']>(getDefaultAnnotationStyles());

AnnotationStyleContext.displayName = 'AnnotationStyle';

export function useAnnotationStyles() {
  return useContext(AnnotationStyleContext);
}

export function AnnotationStyleProvider({
  theme,
  children,
}: {
  theme?: AnnotationStyles['theme'];
  children: React.ReactNode;
}) {
  const styles = useMemo(() => {
    return theme || getDefaultAnnotationStyles();
  }, [theme]);

  return <AnnotationStyleContext.Provider value={styles}>{children}</AnnotationStyleContext.Provider>;
}
