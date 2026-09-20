type AnnotatedResource = { annotations: readonly { id: string }[] };

export function flattenAnnotationPageIds({
  canvas,
  manifest,
  all,
  canvases,
}: {
  manifest?: AnnotatedResource;
  canvas?: AnnotatedResource;
  canvases?: readonly AnnotatedResource[];
  all?: boolean;
}) {
  const foundIds: string[] = [];

  if (manifest) {
    for (const page of manifest.annotations) {
      if (foundIds.indexOf(page.id) === -1) {
        foundIds.push(page.id);
      }
    }
  }

  if (all) {
    if (canvases && canvases.length) {
      for (const canvas_ of canvases) {
        for (const page of canvas_.annotations) {
          if (foundIds.indexOf(page.id) === -1) {
            foundIds.push(page.id);
          }
        }
      }
    }
  } else if (canvas) {
    for (const page of canvas.annotations) {
      if (foundIds.indexOf(page.id) === -1) {
        foundIds.push(page.id);
      }
    }
  }

  // Remove enabled page IDs for now.
  // for (const enabledPage of enabledPageIds) {
  //   if (foundIds.indexOf(enabledPage) === -1) {
  //     foundIds.push(enabledPage);
  //   }
  // }

  return foundIds;
}
