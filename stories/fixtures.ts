export function readingManifest(
  origin: string,
  kind: 'images' | 'text' | 'audio' = 'images',
  direction = 'left-to-right'
) {
  const id = `https://vault.example/${kind}/${direction}`;
  const canvases = Array.from({ length: kind === 'images' ? 4 : 1 }, (_, i) => {
    const canvas = `${id}/canvas/${i + 1}`;
    const body =
      kind === 'text'
        ? {
            type: 'TextualBody',
            value:
              '<h2>Field notes, page one</h2><p>Annotations connect observations to a precise place on the page.</p><p>This local IIIF fixture demonstrates textual painting content.</p>',
            format: 'text/html',
            language: 'en',
          }
        : kind === 'audio'
          ? { id: `${origin}/fixtures/tone.wav`, type: 'Sound', format: 'audio/wav', duration: 6 }
          : {
              id: `${origin}/fixtures/page.svg?page=${i}`,
              type: 'Image',
              format: 'image/svg+xml',
              width: 600,
              height: 400,
            };
    return {
      id: canvas,
      type: 'Canvas',
      width: 600,
      height: 400,
      ...(kind === 'audio' ? { duration: 6 } : {}),
      label: { en: [`Page ${i + 1}`] },
      thumbnail: [
        {
          id: `${origin}/fixtures/page.svg?page=${i}`,
          type: 'Image',
          format: 'image/svg+xml',
          width: 600,
          height: 400,
        },
      ],
      items: [
        {
          id: `${canvas}/paintings`,
          type: 'AnnotationPage',
          items: [{ id: `${canvas}/painting`, type: 'Annotation', motivation: 'painting', body, target: canvas }],
        },
      ],
      annotations:
        kind === 'images'
          ? [
              {
                id: `${canvas}/notes`,
                type: 'AnnotationPage',
                label: { en: ['Research notes'] },
                items: [
                  {
                    id: `${canvas}/note`,
                    type: 'Annotation',
                    motivation: 'commenting',
                    body: {
                      type: 'TextualBody',
                      value: 'A botanical sketch in the field notes.',
                      format: 'text/plain',
                    },
                    target: `${canvas}#xywh=340,60,180,170`,
                  },
                ],
              },
            ]
          : [],
    };
  });
  return {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id,
    type: 'Manifest',
    label: { en: ['Field notebook'], fr: ['Carnet de terrain'] },
    summary: { en: ['A small local collection for exploring IIIF.'] },
    viewingDirection: direction,
    behavior: ['paged'],
    metadata: [
      { label: { en: ['Creator'] }, value: { en: ['Example research team'] } },
      { label: { en: ['Date'] }, value: { en: ['2026'] } },
      { label: { en: ['Collection'] }, value: { en: ['Learning fixtures'], fr: ['Exemples'] } },
    ],
    items: canvases,
  };
}
