import React from 'react';
import { Chart, ThemeProvider, textWidth } from 'ztd-charts';
import { DEFAULT_CHART_HEIGHT, DEFAULT_CHART_WIDTH, resolveChartSpec } from './model.js';

const SVG_CAMEL_ATTRS = new Set([
  'viewBox',
  'preserveAspectRatio',
  'gradientUnits',
  'gradientTransform',
  'patternUnits',
  'patternTransform',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'filterUnits',
  'primitiveUnits',
  'spreadMethod',
  'markerWidth',
  'markerHeight',
  'markerUnits',
  'refX',
  'refY',
  'stdDeviation',
  'baseFrequency',
  'numOctaves',
  'stitchTiles',
  'tableValues',
  'attributeName',
  'attributeType',
  'repeatCount',
  'repeatDur',
  'calcMode',
  'keyTimes',
  'keySplines',
  'PathLength',
  'pathLength',
  'startOffset',
  'textLength',
  'lengthAdjust',
]);

const UNITLESS_CSS_PROPS = new Set([
  'opacity',
  'fillOpacity',
  'strokeOpacity',
  'zIndex',
  'fontWeight',
  'lineHeight',
  'flex',
  'flexGrow',
  'flexShrink',
  'order',
  'zoom',
  'scale',
]);

export function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    ch === '&'
      ? '&amp;'
      : ch === '<'
        ? '&lt;'
        : ch === '>'
          ? '&gt;'
          : ch === '"'
            ? '&quot;'
            : '&apos;'
  ));
}

function sanitizeIdFragment(value) {
  const cleaned = String(value ?? 'chart').replace(/[^A-Za-z0-9_-]/g, '_');
  return cleaned || 'chart';
}

function toAttributeName(propName) {
  if (propName === 'className') return 'class';
  if (propName === 'htmlFor') return 'for';
  if (SVG_CAMEL_ATTRS.has(propName)) return propName;
  return propName.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function serializeStyleObject(styleObj) {
  if (!styleObj || typeof styleObj !== 'object') return '';
  const parts = [];
  for (const [key, rawVal] of Object.entries(styleObj)) {
    if (rawVal === null || rawVal === undefined || rawVal === false || rawVal === '') continue;
    const cssKey = key.startsWith('--') ? key : key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const cssVal = typeof rawVal === 'number' && !UNITLESS_CSS_PROPS.has(key) && !key.startsWith('--')
      ? `${rawVal}px`
      : String(rawVal);
    parts.push(`${cssKey}:${cssVal}`);
  }
  return parts.join(';');
}

function getReactInternals() {
  return (
    React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
    ?? React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher
  );
}

/**
 * Synchronous, zero-CJS static React element serializer tailored for `ztd-charts`.
 * Avoids `react-dom/server` so the ESM bundle never emits CommonJS `require("react")`.
 */
export function renderStaticElement(rootElement, idPrefix = 'ztd') {
  const internals = getReactInternals();
  let idCounter = 0;

  function renderComponent(Component, props, contextMap) {
    const dispatcher = {
      useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
      useReducer: (_reducer, initArg, init) => [typeof init === 'function' ? init(initArg) : initArg, () => {}],
      useEffect: () => {},
      useLayoutEffect: () => {},
      useInsertionEffect: () => {},
      useRef: initialValue => ({ current: initialValue }),
      useMemo: factory => factory(),
      useCallback: callback => callback,
      useContext: ctx => (contextMap.has(ctx) ? contextMap.get(ctx) : ctx._currentValue),
      useId: () => `${idPrefix}-${++idCounter}`,
      useTransition: () => [false, fn => fn()],
      useDeferredValue: value => value,
      useSyncExternalStore: (_sub, getSnapshot, getServerSnapshot) =>
        (getServerSnapshot ? getServerSnapshot() : getSnapshot()),
      useImperativeHandle: () => {},
      useDebugValue: () => {},
    };

    const usesModernField = internals && 'H' in internals;
    const previous = usesModernField ? internals.H : internals?.current;
    if (usesModernField) internals.H = dispatcher;
    else if (internals) internals.current = dispatcher;

    try {
      const rendered = Component(props);
      return walk(rendered, contextMap);
    } finally {
      if (usesModernField) internals.H = previous;
      else if (internals) internals.current = previous;
    }
  }

  function walk(node, contextMap) {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return escapeXml(node);
    if (Array.isArray(node)) {
      let out = '';
      for (const child of node) out += walk(child, contextMap);
      return out;
    }
    if (typeof node === 'object' && node.$$typeof) {
      const { type, props } = node;
      if (type === React.Fragment) {
        return walk(props?.children, contextMap);
      }
      if (typeof type === 'object' && type !== null) {
        if ('value' in (props ?? {}) && ('_context' in type || '_currentValue' in type || 'Provider' in type)) {
          const ctx = type._context ?? type;
          const nextMap = new Map(contextMap);
          nextMap.set(ctx, props.value);
          return walk(props.children, nextMap);
        }
        if (typeof type.render === 'function') {
          return renderComponent(p => type.render(p, null), props, contextMap);
        }
        if (typeof type.type === 'function') {
          return renderComponent(type.type, props, contextMap);
        }
      }
      if (typeof type === 'function') {
        return renderComponent(type, props ?? {}, contextMap);
      }
      if (typeof type === 'string') {
        const { children, dangerouslySetInnerHTML, style, ...rest } = props ?? {};
        let attrString = '';
        for (const [key, val] of Object.entries(rest)) {
          if (
            val === null
            || val === undefined
            || val === false
            || typeof val === 'function'
            || key === 'ref'
            || key === 'key'
          ) {
            continue;
          }
          const attrName = toAttributeName(key);
          const attrVal = val === true ? '' : String(val);
          attrString += ` ${attrName}="${escapeXml(attrVal)}"`;
        }
        if (style && typeof style === 'object') {
          const css = serializeStyleObject(style);
          if (css) attrString += ` style="${escapeXml(css)}"`;
        }
        const inner = dangerouslySetInnerHTML?.__html !== undefined
          ? String(dangerouslySetInnerHTML.__html)
          : walk(children, contextMap);
        return `<${type}${attrString}>${inner}</${type}>`;
      }
    }
    return '';
  }

  return walk(rootElement, new Map());
}

/**
 * Resolves `var(--ztd-..., fallback)` expressions into concrete color/token values
 * so standalone exported SVGs render identically in external vector tools.
 */
function inlineZtdCssVariables(svgMarkup, resolvedTheme) {
  const tokenMap = {
    '--ztd-bg': resolvedTheme.bg,
    '--ztd-panel': resolvedTheme.panel,
    '--ztd-ink': resolvedTheme.ink,
    '--ztd-muted': resolvedTheme.muted,
    '--ztd-dim': resolvedTheme.dim,
    '--ztd-accent': resolvedTheme.accent,
    '--ztd-accent-text': resolvedTheme.accentText,
    '--ztd-on-accent': resolvedTheme.onAccent,
    '--ztd-on-ink': resolvedTheme.onInk,
    '--ztd-line': resolvedTheme.line,
    '--ztd-line2': resolvedTheme.line2,
    '--ztd-neutral': resolvedTheme.neutral,
    '--ztd-neutral-strong': resolvedTheme.neutralStrong,
    '--ztd-on-neutral-strong': resolvedTheme.onNeutralStrong,
    '--ztd-neutral-soft': resolvedTheme.neutralSoft,
    '--ztd-lift': resolvedTheme.lift,
    '--ztd-tint': resolvedTheme.tint,
    '--ztd-font': resolvedTheme.fontFamily,
    '--ztd-mono': resolvedTheme.monoFamily,
  };

  return svgMarkup.replace(/var\((--ztd-[a-z0-9-]+)(?:,\s*([^)]+))?\)/gi, (_match, varName, fallback) => {
    const resolved = tokenMap[varName];
    if (resolved !== undefined && resolved !== null) return String(resolved);
    return fallback ? String(fallback).trim() : '#64748b';
  });
}

function renderLegendSvg(legendItems, maxWidth, yOffset, resolvedTheme) {
  if (!Array.isArray(legendItems) || legendItems.length === 0) return '';
  let cursorX = 0;
  const parts = [];
  for (const item of legendItems.slice(0, 6)) {
    const label = String(item?.label ?? '');
    if (!label) continue;
    const itemWidth = Math.ceil(textWidth(label, 11) + 22);
    if (cursorX > 0 && cursorX + itemWidth > maxWidth) break;
    const rawColor = item?.color || resolvedTheme.accent;
    const swatchColor = inlineZtdCssVariables(String(rawColor), resolvedTheme);
    parts.push(
      `<g transform="translate(${cursorX},${yOffset})">` +
      `<rect x="0" y="2" width="9" height="9" rx="2.5" fill="${escapeXml(swatchColor)}"/>` +
      `<text x="14" y="10" font-size="11" font-weight="500" fill="${escapeXml(resolvedTheme.muted)}">${escapeXml(label)}</text>` +
      `</g>`,
    );
    cursorX += itemWidth;
  }
  return parts.join('');
}

/**
 * Compiles a `diagram.ztd-charts.chart` entity into a pure vector `<g>` SVG node.
 */
export function renderChartSvg(props, derived, entityId = 'chart') {
  const geom = derived ?? {
    x: 0,
    y: 0,
    width: DEFAULT_CHART_WIDTH,
    height: DEFAULT_CHART_HEIGHT,
    rotation: 0,
  };
  const width = Math.max(120, Math.round(Number.isFinite(geom.width) ? geom.width : DEFAULT_CHART_WIDTH));
  const height = Math.max(100, Math.round(Number.isFinite(geom.height) ? geom.height : DEFAULT_CHART_HEIGHT));
  const x = Number.isFinite(geom.x) ? geom.x : 0;
  const y = Number.isFinite(geom.y) ? geom.y : 0;
  const rotationDeg = Number.isFinite(geom.rotation) ? (geom.rotation * 180) / Math.PI : 0;

  const resolved = resolveChartSpec(props);
  const {
    bareSpec,
    resolvedTheme,
    localeTag,
    variant,
    title,
    subtitle,
    takeaway,
    legendItems,
  } = resolved;

  const padX = variant === 'card' ? 20 : 12;
  const padTop = variant === 'card' ? 18 : 12;
  const padBottom = variant === 'card' ? 16 : 12;

  const hasSubtitle = variant === 'card' && Boolean(subtitle);
  const hasLegend = variant === 'card' && legendItems.length > 0;
  const hasTakeaway = variant === 'card' && Boolean(takeaway);

  const headerHeight = variant === 'card'
    ? 24 + (hasSubtitle ? 18 : 0) + (hasLegend ? 20 : 0) + 8
    : 0;
  const footerHeight = hasTakeaway ? 28 : 0;

  const plotX = padX;
  const plotY = padTop + headerHeight;
  const plotWidth = Math.max(140, width - padX * 2);
  const plotHeight = Math.max(96, height - plotY - padBottom - footerHeight);

  const safeId = sanitizeIdFragment(entityId);
  const tree = React.createElement(
    ThemeProvider,
    { theme: resolvedTheme },
    React.createElement(Chart, {
      spec: bareSpec,
      width: plotWidth,
      height: plotHeight,
      animate: false,
      locale: localeTag,
    }),
  );

  const rawHtml = renderStaticElement(tree, `ztd-${safeId}`);
  const svgMatch = rawHtml.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
  const viewBoxMatch = svgMatch?.[1]?.match(/viewBox="([^"]+)"/i);
  const viewBox = viewBoxMatch?.[1] ?? `0 0 ${plotWidth} ${plotHeight}`;
  const innerPlotSvg = svgMatch?.[2]
    ? inlineZtdCssVariables(svgMatch[2], resolvedTheme)
    : '';

  const clipId = `ztd-card-clip-${safeId}`;
  const transformAttr = rotationDeg !== 0
    ? `translate(${x},${y}) rotate(${rotationDeg},${width / 2},${height / 2})`
    : `translate(${x},${y})`;

  let headerSvg = '';
  if (variant === 'card') {
    let cursorY = padTop + 15;
    headerSvg += `<text x="${padX}" y="${cursorY}" font-size="15" font-weight="700" fill="${escapeXml(resolvedTheme.ink)}">${escapeXml(title)}</text>`;
    if (hasSubtitle) {
      cursorY += 18;
      headerSvg += `<text x="${padX}" y="${cursorY}" font-size="11.5" font-weight="400" fill="${escapeXml(resolvedTheme.muted)}">${escapeXml(subtitle)}</text>`;
    }
    if (hasLegend) {
      cursorY += 10;
      headerSvg += `<g transform="translate(${padX},0)">${renderLegendSvg(legendItems, plotWidth, cursorY, resolvedTheme)}</g>`;
    }
  }

  let footerSvg = '';
  if (hasTakeaway) {
    const lineY = height - padBottom - 20;
    const textY = height - padBottom - 4;
    footerSvg =
      `<line x1="${padX}" y1="${lineY}" x2="${width - padX}" y2="${lineY}" stroke="${escapeXml(resolvedTheme.line)}" stroke-width="1"/>` +
      `<text x="${padX}" y="${textY}" font-size="11.5" font-weight="600" fill="${escapeXml(resolvedTheme.accentText)}">${escapeXml(takeaway)}</text>`;
  }

  const fontFamily = escapeXml(resolvedTheme.fontFamily || 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif');
  const svg =
    `<g transform="${transformAttr}" data-chart-type="${escapeXml(resolved.chartType)}" font-family="${fontFamily}">` +
    `<defs><clipPath id="${clipId}"><rect width="${width}" height="${height}" rx="14"/></clipPath></defs>` +
    `<g clip-path="url(#${clipId})">` +
    `<rect width="${width}" height="${height}" rx="14" fill="${escapeXml(resolvedTheme.panel)}" stroke="${escapeXml(resolvedTheme.line)}" stroke-width="1"/>` +
    headerSvg +
    `<svg x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" viewBox="${escapeXml(viewBox)}" preserveAspectRatio="xMidYMid meet">` +
    innerPlotSvg +
    `</svg>` +
    footerSvg +
    `</g>` +
    `</g>`;

  return { svg };
}
