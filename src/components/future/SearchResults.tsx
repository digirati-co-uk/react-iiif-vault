import { parseSelector } from '@iiif/helpers/annotation-targets';
import { useSearch } from '../../context/SearchContext';
import { useSimpleViewer } from '../../viewers/SimpleViewerContext';

export function SearchResults() {
  const { resources, highlight, highlightResult, hasSearch } = useSearch();
  const { setCurrentCanvasId } = useSimpleViewer();

  if (!hasSearch) {
    return null;
  }

  return (
    <div>
      {resources.map((resource) => {
        const parsed = parseSelector(resource.on);
        const canvasId = resource.on.split('#')[0];
        return (
          <div key={resource['@id']} style={{ background: highlight === resource ? '#ddd' : '' }}>
            {resource?.resource.chars}
            <button
              onClick={() => {
                highlightResult(resource['@id']);
                setCurrentCanvasId(canvasId);
              }}
            >
              Go to canvas
            </button>
          </div>
        );
      })}
    </div>
  );
}
