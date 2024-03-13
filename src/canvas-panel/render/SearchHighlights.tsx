import { parseSelector } from '@iiif/helpers/annotation-targets';
import { useSearch } from '../../context/SearchContext';
import { useCanvas } from '../../hooks/useCanvas';

// @todo styling.
export function SearchHighlights() {
  const canvas = useCanvas();
  const search = useSearch();

  if (!search.hasSearch) {
    return null;
  }

  const filtered = !canvas
    ? []
    : search.resources
        .filter((resource) => {
          const canvasId = resource.on.split('#')[0];
          return canvasId === canvas.id;
        })
        .map((anno) => {
          const target = parseSelector(anno.on);

          return {
            annotation: anno,
            target,
          };
        });

  return (
    <>
      {filtered.map((item) => {
        if (!item.target.selector?.spatial) {
          return null;
        }
        return (
          <box
            onClick={() => search.highlightResult(item.annotation['@id'])}
            target={item.target.selector?.spatial as any}
            key={item.annotation['@id']}
            style={{
              background:
                search.highlight && search.highlight['@id'] === item.annotation['@id']
                  ? 'rgba(19, 224, 0, 0.5)'
                  : 'rgba(255, 0, 0, 0.5)',
            }}
          />
        );
      })}
    </>
  );
}
