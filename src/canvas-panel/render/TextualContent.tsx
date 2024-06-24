import { HTMLPortal } from '@atlas-viewer/atlas';
import { TextualContentStrategy } from '../../features/rendering-strategy/textual-content-strategy';
import { LocaleString } from '../../utility/i18n-utils';

export function RenderTextualContent({
  strategy,
  onClickPaintingAnnotation,
}: {
  strategy: TextualContentStrategy;
  onClickPaintingAnnotation?: any;
}) {
  return (
    <>
      {strategy.items.map((item, n) => {
        return (
          <>
            <HTMLPortal
              key={n}
              // @ts-ignore
              onClick={
                onClickPaintingAnnotation
                  ? (e: any) => {
                      e.stopPropagation();
                      onClickPaintingAnnotation(item.annotationId, item as any, e);
                    }
                  : undefined
              }
              target={(item.target as any)?.spatial || undefined}
            >
              <div data-textual-content={true}>
                <LocaleString enableDangerouslySetInnerHTML>{item.text}</LocaleString>
              </div>
            </HTMLPortal>
          </>
        );
      })}
    </>
  );
}
