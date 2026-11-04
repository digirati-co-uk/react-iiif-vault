const ALLOWED_ELEMENTS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'ul',
]);
const ALLOWED_ATTRIBUTES = new Set(['class', 'dir', 'href', 'lang', 'title']);
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ALLOWED_SVG_ELEMENTS = new Set(
  [
    'circle',
    'clippath',
    'defs',
    'desc',
    'ellipse',
    'feblend',
    'fecolormatrix',
    'fecomponenttransfer',
    'fecomposite',
    'feconvolvematrix',
    'fediffuselighting',
    'fedisplacementmap',
    'fedistantlight',
    'fedropshadow',
    'feflood',
    'fefunca',
    'fefuncb',
    'fefuncg',
    'fefuncr',
    'fegaussianblur',
    'feimage',
    'femerge',
    'femergenode',
    'femorphology',
    'feoffset',
    'fepointlight',
    'fespecularlighting',
    'fespotlight',
    'fetile',
    'feturbulence',
    'filter',
    'g',
    'image',
    'line',
    'lineargradient',
    'marker',
    'mask',
    'metadata',
    'path',
    'pattern',
    'polygon',
    'polyline',
    'radialgradient',
    'rect',
    'stop',
    'style',
    'svg',
    'switch',
    'symbol',
    'text',
    'textpath',
    'title',
    'tspan',
    'use',
    'view',
  ].map((name) => name.toLowerCase())
);

function hasExternalCssResource(value: string) {
  const normalized = value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\\(?:([\da-f]{1,6})[\t\n\f\r ]?|\r\n|[\n\f\r]|(.))/gi, (_match, hex, escaped) => {
      if (!hex) return escaped || '';
      const codePoint = Number.parseInt(hex, 16);
      return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '\uFFFD';
    });
  const withoutLocalFragments = normalized.replace(/url\s*\(\s*(?:"#[^"]+"|'#[^']+'|#[^)\s]+)\s*\)/gi, '');
  return /@import\b|url\s*\(/i.test(withoutLocalFragments);
}

export function sanitizeIiifHtml(html: string) {
  if (typeof DOMParser === 'undefined') return '';
  const inert = html
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed)\b[^>]*\/?\s*>/gi, '');
  const document = new DOMParser().parseFromString(inert, 'text/html');
  for (const element of document.body.querySelectorAll('*')) {
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_ELEMENTS.has(tag)) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!ALLOWED_ATTRIBUTES.has(attribute.name.toLowerCase())) element.removeAttribute(attribute.name);
    }
    const href = element.getAttribute('href');
    if (href && !/^(https?:|mailto:|\/|#)/i.test(href)) element.removeAttribute('href');
    if (tag === 'a') element.setAttribute('rel', 'noopener noreferrer');
  }
  return document.body.innerHTML;
}

export function sanitizeSvgSelector(value: string) {
  if (typeof DOMParser === 'undefined') return '';
  const parser = new DOMParser();
  // Happy DOM does not preserve SVG style text, and a pre-pass also ensures a
  // network-bearing stylesheet never reaches an image decoder if DOM parsing
  // differs between browser engines.
  const withoutExternalStyles = value.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (style, css) =>
    hasExternalCssResource(css) ? '' : style
  );
  const document = parser.parseFromString(withoutExternalStyles, 'image/svg+xml');
  if (document.querySelector('parsererror')) return '';
  const root =
    document.documentElement?.localName === 'svg'
      ? document.documentElement
      : parser.parseFromString(withoutExternalStyles, 'text/html').querySelector('svg');
  if (!root || root.namespaceURI !== SVG_NAMESPACE) return '';
  for (const element of root.querySelectorAll('script, foreignObject')) element.remove();
  const sanitizeElement = (element: Element) => {
    const namespace = element.getAttribute('xmlns');
    if (
      element.prefix ||
      (namespace && namespace !== SVG_NAMESPACE) ||
      !ALLOWED_SVG_ELEMENTS.has(element.localName.toLowerCase())
    ) {
      element.remove();
      return;
    }
    if (element.localName === 'style' && hasExternalCssResource(element.textContent || element.innerHTML)) {
      element.remove();
      return;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
      if (
        (attribute.name === 'href' || attribute.name === 'xlink:href') &&
        !/^(#|data:image\/(?:avif|gif|jpeg|png|webp);base64,)/i.test(attribute.value)
      )
        element.removeAttribute(attribute.name);
      if (hasExternalCssResource(attribute.value)) element.removeAttribute(attribute.name);
    }
  };
  sanitizeElement(root);
  for (const element of root.querySelectorAll('*')) sanitizeElement(element);
  return root.outerHTML;
}

function finitePositive(value: unknown) {
  const input = String(value ?? '').trim();
  const parsed =
    typeof value === 'number'
      ? value
      : /^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:px)?$/i.test(input)
        ? Number.parseFloat(input)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Keep the complete authored SVG while using its viewport as the Scene-plane size. */
export function prepareSvgAnnotationSelector(selector: any, raw: any = selector) {
  let svg = sanitizeSvgSelector(String(raw?.value || raw?.svg || selector?.svg || selector?.value || ''));
  if (!svg) return null;
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = parsed.documentElement?.localName === 'svg' ? parsed.documentElement : parsed.querySelector('svg');
  if (!root) return null;
  const viewBox = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const viewBoxWidth = viewBox?.length === 4 ? finitePositive(viewBox[2]) : null;
  const viewBoxHeight = viewBox?.length === 4 ? finitePositive(viewBox[3]) : null;
  const width =
    viewBoxWidth || finitePositive(root.getAttribute('width')) || finitePositive(selector?.spatial?.width) || 1;
  const height =
    viewBoxHeight || finitePositive(root.getAttribute('height')) || finitePositive(selector?.spatial?.height) || 1;
  const background = selector?.boxStyle?.backgroundColor || selector?.boxStyle?.background;
  if (
    typeof background === 'string' &&
    /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%+\-/]+\)|[a-z]+)$/i.test(background.trim())
  ) {
    const rect = parsed.createElementNS(SVG_NAMESPACE, 'rect');
    rect.setAttribute('x', String(viewBoxWidth ? Number(viewBox?.[0]) || 0 : 0));
    rect.setAttribute('y', String(viewBoxHeight ? Number(viewBox?.[1]) || 0 : 0));
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', background);
    root.insertBefore(rect, root.firstChild);
    svg = root.outerHTML;
  }
  return {
    ...selector,
    svg,
    spatial: {
      ...selector?.spatial,
      x: viewBoxWidth ? Number(viewBox?.[0]) || 0 : Number(selector?.spatial?.x) || 0,
      y: viewBoxHeight ? Number(viewBox?.[1]) || 0 : Number(selector?.spatial?.y) || 0,
      width,
      height,
    },
  };
}
