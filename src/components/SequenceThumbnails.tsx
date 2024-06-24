import { useLayoutEffect, useRef } from 'react';
import { useSimpleViewer } from '../viewers/SimpleViewerContext';
import { useCanvasSequence } from '../viewers/SimpleViewerContext.hooks';
import { SingleCanvasThumbnail } from './SingleCanvasThumbnail';

interface SequenceThumbnailsProps {
  flat?: boolean;
  size?: { width: number; height?: number };
  classes?: {
    container?: string;
    row?: string;
    item?: string;

    // SingleCanvasThumbnail
    figure?: string;
    imageWrapper?: string;
    img?: string;
    label?: string;

    selected?: {
      row?: string;
      item?: string;
      figure?: string;
      img?: string;
      label?: string;
      imageWrapper?: string;
    };
  };

  figure?: boolean;
  showLabel?: boolean;
  // Slots
  fallback?: React.ReactNode;
}

export function SequenceThumbnails({ flat, size, classes = {}, showLabel, figure, fallback }: SequenceThumbnailsProps) {
  const container = useRef<HTMLDivElement>(null);
  const { items, sequence, currentSequenceIndex, setSequenceIndex } = useSimpleViewer();
  const selected = {
    row: classes.selected?.row || classes.row,
    item: classes.selected?.item || classes.item,
    figure: classes.selected?.figure || classes.figure,
    img: classes.selected?.img || classes.img,
    label: classes.selected?.label || classes.label,
    imageWrapper: classes.selected?.imageWrapper || classes.imageWrapper,
  };

  useLayoutEffect(() => {
    if (!container.current) {
      return;
    }

    const selected = container.current.querySelector(`[data-selected=true]`);
    if (selected) {
      selected.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentSequenceIndex]);

  const components = [];
  for (const row of sequence) {
    const rowComponents = [];
    const isSelected = sequence[currentSequenceIndex] === row;
    for (const canvasIdx of row) {
      const canvas = items[canvasIdx];
      rowComponents.push(
        <div key={canvasIdx} className={isSelected ? selected.item : classes.item}>
          <SingleCanvasThumbnail
            classes={isSelected ? selected : classes}
            canvasId={canvas.id}
            size={size}
            showLabel={showLabel}
            figure={figure}
            placeholder={<div style={{ height: 128, width: 128 }} />}
            fallback={fallback}
          />
        </div>
      );
    }
    if (flat) {
      components.push(rowComponents);
      continue;
    }
    components.push(
      <div
        key={row.join('-')}
        onClick={(e) => {
          setSequenceIndex(sequence.indexOf(row));
        }}
        data-selected={isSelected}
        className={isSelected ? selected.row : classes.row}
      >
        {rowComponents}
      </div>
    );
  }

  return (
    <div ref={container} className={classes.container}>
      {components}
    </div>
  );
}
