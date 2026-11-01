/** Curated with the Theseus IIIF skill. Institution manifests are loaded unchanged. */
export interface LiveExample {
  label: string;
  credit: string;
  manifest: string;
  canvas?: string;
  rights?: string;
}
export const iiifExamples = {
  forster: {
    label: 'Codex Forster I',
    credit: 'Victoria and Albert Museum, National Art Library',
    manifest: 'https://iiif.vam.ac.uk/collections/MSL:1876:Forster:141:I/manifest.json',
    canvas: 'https://iiif.vam.ac.uk/MSL:1876:Forster:141:I/canvas/c2',
    rights: 'https://www.vam.ac.uk/articles/terms-of-use',
  },
  sudan: {
    label: 'Map of Sudan showing railways (1908), SAD.299/2/58',
    credit: 'Durham University Library',
    manifest: 'https://iiif.durham.ac.uk/manifests/trifle/32150/t1/m9/c6/t1m9c67wm912/manifest',
    rights: 'http://creativecommons.org/licenses/by-nc-nd/4.0/legalcode',
  },
  prism: {
    label: 'Dubbel Bauernfeind-prisma',
    credit: 'TU Delft Library, Academic Heritage',
    manifest: 'https://heritage.tudelft.nl/iiif/manifests/009d29e8-e196-451f-8422-265b6ff27fb1/manifest.json',
  },
} satisfies Record<string, LiveExample>;
