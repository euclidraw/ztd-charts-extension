// Mount an inert SVG tree rather than an SVG image: text participates in document
// font loading, while the viewport can scale the vector in world coordinates.
const NS = 'http://www.w3.org/2000/svg';
const tags = new Set('svg g defs clipPath mask pattern linearGradient radialGradient stop use path line rect circle ellipse polyline polygon text tspan title desc'.split(' '));
const attrs = new Set(('id class viewBox preserveAspectRatio transform d points x y x1 x2 y1 y2 cx cy r rx ry dx dy width height ' +
  'fill stroke color opacity fill-opacity stroke-opacity fill-rule clip-rule stroke-width stroke-dasharray stroke-dashoffset ' +
  'stroke-linecap stroke-linejoin stroke-miterlimit clip-path mask pathLength shape-rendering paint-order vector-effect ' +
  'text-anchor dominant-baseline alignment-baseline font-family font-size font-weight font-style letter-spacing textLength lengthAdjust ' +
  'gradientUnits gradientTransform offset stop-color stop-opacity patternUnits patternContentUnits patternTransform clipPathUnits ' +
  'href aria-hidden data-label-paper data-legend-kind data-chart-card data-chart-legend data-chart-legend-frame data-chart-field data-chart-type data-chart-text-slot data-ztd-key data-k data-l').split(' '));
const iriAttrs = new Set(['fill', 'stroke', 'clip-path', 'mask']);

export function createPrintProof(doc, markup, width, height, title, locale) {
  const parsed = new doc.defaultView.DOMParser().parseFromString(`<svg xmlns="${NS}">${markup}</svg>`, 'image/svg+xml');
  if (parsed.documentElement.namespaceURI !== NS || parsed.querySelector('parsererror')) throw new Error('차트 SVG를 읽을 수 없습니다.');
  for (const el of parsed.documentElement.querySelectorAll('*')) {
    if (!tags.has(el.localName) || el.namespaceURI !== NS) { el.remove(); continue; }
    for (const { name, value } of [...el.attributes]) {
      const localId = /^#[\w.-]+$/;
      if (!attrs.has(name) || (name === 'href' && !localId.test(value)) ||
          (iriAttrs.has(name) && !/^(?:none|transparent|currentColor|#[\da-f]{3,8}|url\(#[\w.-]+\)|rgba?\([\d.,%\s]+\))$/i.test(value))) el.removeAttribute(name);
    }
  }
  const root = doc.importNode(parsed.documentElement, true);
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', `${title} · 인쇄 보기`);
  root.setAttribute('lang', locale);
  root.style.display = 'block';
  return root;
}
