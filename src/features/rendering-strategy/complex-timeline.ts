import { type ChoiceDescription, type ComplexChoice, expandTarget, type Paintables } from '@iiif/helpers';
import type { CanvasNormalized } from '@iiif/presentation-3-normalized';
import type { ImageServiceLoaderType } from '../../hooks/useLoadImageService';
import type { CompatVault } from '../../utility/compat-vault';
import { getAudioStrategy } from './audio-strategy';
import { getImageStrategy } from './image-strategy';
import type { SingleAudio, SingleVideo, SingleYouTubeVideo } from './resource-types';
import type { ComplexTimelineStrategy } from './strategies';
import { getTextualContentStrategy } from './textual-content-strategy';
import { getVideoStrategy } from './video-strategy';

export function getComplexTimelineStrategy(
  canvas: CanvasNormalized,
  paintables: Paintables,
  loadImageService: ImageServiceLoaderType,
  vault: CompatVault
) {
  const timeline: ComplexTimelineStrategy = {
    type: 'complex-timeline',
    items: [],
    keyframes: [],
    highlights: [],
    duration: canvas.duration || 0,
  };
  const complexChoice: ComplexChoice = {
    type: 'complex-choice',
    items: [],
  };

  const canvasAnnotationPages = vault.get(canvas.annotations);

  function mergeChoice(strategy: { choice?: ChoiceDescription }) {
    if (strategy.choice) {
      if (strategy.choice.type === 'complex-choice') {
        complexChoice.items.push(...strategy.choice.items);
      } else {
        complexChoice.items.push(strategy.choice);
      }
    }
  }

  for (const paintable of paintables.items) {
    if (paintable.type === 'image') {
      const imageStrategy = getImageStrategy(
        canvas,
        { choice: null, allChoices: null, types: ['image'], items: [paintable] },
        loadImageService
      );
      if (imageStrategy.type === 'images') {
        mergeChoice(imageStrategy);
        timeline.items.push(imageStrategy.image);

        const enter = {
          id: imageStrategy.image.annotationId,
          type: 'enter' as const,
          resourceType: 'image' as const,
          time: imageStrategy.image.target?.temporal?.startTime || 0,
        };
        timeline.keyframes.push(enter);
        const exit = {
          id: imageStrategy.image.annotationId,
          type: 'exit' as const,
          resourceType: 'image' as const,
          time: imageStrategy.image.target?.temporal?.endTime || canvas.duration || 0,
        };
        timeline.keyframes.push(exit);
      }
    }
    if (paintable.type === 'textualbody') {
      const textStrategy = getTextualContentStrategy(canvas, {
        choice: null,
        allChoices: null,
        types: ['textualbody'],
        items: [paintable],
      });

      if (textStrategy.type === 'textual-content') {
        mergeChoice(textStrategy);
        const text = textStrategy.items[0];
        timeline.items.push(text);
        const target = text.target as any;

        const enter = {
          id: text.annotationId,
          type: 'enter' as const,
          resourceType: 'text' as const,
          time: target.temporal?.startTime || 0,
        };
        timeline.keyframes.push(enter);

        const exit = {
          id: text.annotationId,
          type: 'exit' as const,
          resourceType: 'text' as const,
          time: target.temporal?.endTime || canvas.duration || 0,
        };
        timeline.keyframes.push(exit);
      }
    }
    if (paintable.type === 'video') {
      const videoStrategy = getVideoStrategy(
        canvas,
        {
          choice: null,
          allChoices: null,
          types: ['video'],
          items: [paintable],
        },
        vault
      );
      if (videoStrategy.type === 'media') {
        mergeChoice(videoStrategy);
        const media = videoStrategy.media as SingleVideo | SingleYouTubeVideo;
        timeline.items.push(media);
        const enter = {
          id: media.annotationId,
          type: 'enter' as const,
          resourceType: 'video' as const,
          time: media.target?.temporal?.startTime || 0,
        };
        timeline.keyframes.push(enter);
        const exit = {
          id: media.annotationId,
          type: 'exit' as const,
          resourceType: 'video' as const,
          time: media.target?.temporal?.endTime || canvas.duration || 0,
        };
        timeline.keyframes.push(exit);
      }
    }

    if (paintable.type === 'audio' || paintable.type === 'sound') {
      const audioStrategy = getAudioStrategy(canvas, {
        choice: null,
        allChoices: null,
        types: ['audio'],
        items: [paintable],
      });
      if (audioStrategy.type === 'media') {
        mergeChoice(audioStrategy);
        const media = audioStrategy.media as SingleAudio;
        timeline.items.push(media);
        const enter = {
          id: media.annotationId,
          type: 'enter' as const,
          resourceType: 'audio' as const,
          time: media.target?.temporal?.startTime || 0,
        };
        timeline.keyframes.push(enter);
        const exit = {
          id: media.annotationId,
          type: 'exit' as const,
          resourceType: 'audio' as const,
          time: media.target?.temporal?.endTime || canvas.duration || 0,
        };
        timeline.keyframes.push(exit);
      }
    }
  }

  for (const annotationPage of canvasAnnotationPages) {
    for (const annotationRef of annotationPage.items) {
      const annotation = vault.get(annotationRef);

      const target = expandTarget(annotation.target as any, { typeMap: (vault as any).getState?.().iiif.mapping });
      if (target.selector?.temporal) {
        const enter = {
          id: annotation.id,
          type: 'enter' as const,
          resourceType: 'highlight' as const,
          time: target.selector.temporal.startTime || 0,
        };
        timeline.keyframes.push(enter);
        const exit = {
          id: annotation.id,
          type: 'exit' as const,
          resourceType: 'highlight' as const,
          time: target.selector.temporal.endTime || canvas.duration || 0,
        };
        timeline.keyframes.push(exit);
      }

      timeline.highlights.push({
        annotation,
        target,
      });
    }
  }

  timeline.keyframes.sort((a, b) => a.time - b.time);

  // We need them in order to do this step.
  let primeMediaStack: Array<any> = [];
  const newKeyFrames: Array<any> = [];
  for (const keyframe of timeline.keyframes) {
    // Skip images.
    if (
      keyframe.resourceType === 'image' ||
      keyframe.resourceType === 'text' ||
      keyframe.resourceType === 'highlight'
    ) {
      newKeyFrames.push(keyframe);
      continue;
    }

    if (keyframe.type === 'enter') {
      if (primeMediaStack.length === 0) {
        keyframe.isPrime = true;
      }
      primeMediaStack.push(keyframe);
      newKeyFrames.push(keyframe);
      continue;
    }

    if (keyframe.type === 'exit') {
      newKeyFrames.push(keyframe);
      primeMediaStack = primeMediaStack.filter((k) => k.id !== keyframe.id);
      if (primeMediaStack.length !== 0) {
        const nextPrime = primeMediaStack[0];
        const change = {
          id: nextPrime.id,
          type: 'change' as const,
          isPrime: true,
          resourceType: nextPrime.resourceType,
          time: keyframe.time,
        };
        newKeyFrames.push(change);
      }
    }
  }

  timeline.keyframes = newKeyFrames;

  if (complexChoice.items.length) {
    timeline.choice = complexChoice;
  }

  return timeline;
}
