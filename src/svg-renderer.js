import React from 'react';
import { legendOffset } from './legend-drag.js';
import { createPrintMarks } from './print-marks.js';
import { printTheme } from './print-style.js';
import { Chart, ThemeProvider, mixHex, textWidth } from 'ztd-charts';
import { DEFAULT_CHART_HEIGHT, DEFAULT_CHART_WIDTH, resolveChartSpec, resolveColorForZtdKey } from './model.js';

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
  return String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '\uFFFD').replace(/[&<>"']/g, ch => (
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
export function renderStaticElement(rootElement, idPrefix = 'ztd', colorContext = null) {
  const internals = getReactInternals();
  let idCounter = 0;
  let parent = null;

  function renderComponent(Component, props, contextMap, activeColor, inheritedKey) {
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
      return walk(rendered, contextMap, activeColor, inheritedKey);
    } finally {
      if (usesModernField) internals.H = previous;
      else if (internals) internals.current = previous;
    }
  }

  function walk(node, contextMap, activeColor = null, inheritedKey = '') {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return escapeXml(node);
    if (Array.isArray(node)) {
      let out = '';
      for (const child of node) out += walk(child, contextMap, activeColor, '');
      return out;
    }
    if (typeof node === 'object' && node.$$typeof) {
      const { type, props, key } = node;
      const ownKey = key !== null && key !== undefined ? String(key) : inheritedKey;
      if (type === React.Fragment) {
        return walk(props?.children, contextMap, activeColor, ownKey);
      }
      if (typeof type === 'object' && type !== null) {
        if ('value' in (props ?? {}) && ('_context' in type || '_currentValue' in type || 'Provider' in type)) {
          const ctx = type._context ?? type;
          const nextMap = new Map(contextMap);
          nextMap.set(ctx, props.value);
          return walk(props.children, nextMap, activeColor, ownKey);
        }
        if (typeof type.render === 'function') {
          return renderComponent(p => type.render(p, null), props, contextMap, activeColor, ownKey);
        }
        if (typeof type.type === 'function') {
          return renderComponent(type.type, props, contextMap, activeColor, ownKey);
        }
      }
      if (typeof type === 'function') {
        return renderComponent(type, props ?? {}, contextMap, activeColor, ownKey);
      }
      if (typeof type === 'string') {
        const { children, dangerouslySetInnerHTML, style, ...rest } = props ?? {};
        const isMark = typeof rest.className === 'string' && rest.className.includes('ztd-mark');
        const matchedColor = colorContext
          ? resolveColorForZtdKey(
              colorContext.chartType,
              ownKey,
              rest['data-k'],
              isMark,
              colorContext.itemColors,
              colorContext.dataTargets,
              colorContext.rows,
              colorContext.encoding,
            )
          : null;
        const effectiveColor = matchedColor || activeColor;

        if (effectiveColor && ['path', 'rect', 'circle', 'line', 'polygon'].includes(type)) {
          const isBulletBgOrTarget =
            colorContext?.chartType === 'bullet'
            && (type === 'line' || (type === 'path' && ownKey && /^\d+$/.test(ownKey)));
          const isBoxWhisker = colorContext?.chartType === 'box' && type === 'line';
          if (!isBulletBgOrTarget && !isBoxWhisker && rest.fill !== 'transparent') {
            if (
              typeof rest.fill === 'string'
              && rest.fill !== 'none'
              && rest.fill !== 'transparent'
              && !rest.fill.includes('--ztd-panel')
            ) {
              rest.fill = effectiveColor;
            }
            if (
              typeof rest.stroke === 'string'
              && rest.stroke !== 'none'
              && !rest.stroke.includes('--ztd-panel')
              && !rest.stroke.includes('--ztd-line')
              && !rest.stroke.includes('--ztd-dim')
              && !rest.stroke.includes('--ztd-neutral-soft')
            ) {
              rest.stroke = effectiveColor;
            }
          }
        }

        if (rest['data-legend-kind'] === 'plot' && colorContext?.legendOffset) {
          const {x,y} = colorContext.legendOffset;
          if (x || y) rest.transform = 'translate('+x+','+y+')' + (rest.transform ? ' '+rest.transform : '');
        }
        const tag = colorContext?.print?.decorate(type, rest, ownKey, parent) ?? type;
        let attrString = '';
        if (ownKey) {
          attrString += ` data-ztd-key="${escapeXml(ownKey)}"`;
        }
        for (const [propKey, val] of Object.entries(rest)) {
          if (
            val === null
            || val === undefined
            || val === false
            || typeof val === 'function'
            || propKey === 'ref'
            || propKey === 'key'
          ) {
            continue;
          }
          const attrName = toAttributeName(propKey);
          const attrVal = val === true ? '' : String(val);
          attrString += ` ${attrName}="${escapeXml(attrVal)}"`;
        }
        if (style && typeof style === 'object') {
          const css = serializeStyleObject(style);
          if (css) attrString += ` style="${escapeXml(css)}"`;
        }
        const previousParent = parent;
        if (colorContext?.print) parent = { key: ownKey, markKey: isMark ? ownKey : previousParent?.markKey, mark: isMark, hidden: rest['aria-hidden'] === 'true', circles: 0 };
        const inner = dangerouslySetInnerHTML?.__html !== undefined
          ? String(dangerouslySetInnerHTML.__html)
          : walk(children, contextMap, effectiveColor, '');
        parent = previousParent;
        return `<${tag}${attrString}>${inner}</${tag}>`;
      }
    }
    return '';
  }

  return walk(rootElement, new Map(), null, '');
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

function unescapeXml(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function applySvgTextOverrides(svgContent, textOverrides) {
  if (!svgContent) return '';
  let idx = 0;
  return svgContent.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi, (_full, attrs, inner) => {
    const slotKey = `svg:${idx++}`;
    const plainBase = unescapeXml(inner.replace(/<[^>]+>/g, '')).trim();
    const override = textOverrides?.[slotKey] ?? (plainBase ? textOverrides?.[`text:${plainBase}`] : undefined);
    const nextInner = override !== undefined ? escapeXml(String(override)) : inner;
    const label = unescapeXml(nextInner.replace(/<[^>]+>/g, ''));
    const hatched = attrs.includes(' data-on-hatch="true"');
    attrs = attrs.replace(' data-on-hatch="true"', '');
    if (!hatched || !label.trim()) return `<text data-chart-text-slot="${slotKey}"${attrs}>${nextInner}</text>`;
    // Headless export: measure the final (possibly edited) label in chart units.
    const fields = Object.fromEntries([...attrs.matchAll(/ ([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    const size = parseFloat(fields['font-size']) || 11;
    const offset = value => (parseFloat(value) || 0) * (value?.endsWith('em') ? size : 1);
    const w = textWidth(label, size, Number(fields['font-weight']) || 400);
    const x = offset(fields.x) + offset(fields.dx) - (fields['text-anchor'] === 'middle' ? w/2 : fields['text-anchor'] === 'end' ? w : 0);
    const y = offset(fields.y) + offset(fields.dy) - size * 0.85;
    const inherited = ['transform', 'opacity'].filter(k => fields[k] !== undefined).map(k => ' ' + k + '="' + fields[k] + '"').join('');
    const plate = `<rect data-label-paper="" x="${x-1.5}" y="${y-0.75}" width="${w+3}" height="${size*1.15+1.5}"${inherited} fill="#ffffff" stroke="none" pointer-events="none" aria-hidden="true"/>`;
    const clean = attrs.replace(/ (?:fill|stroke)="[^"]*"/g, '');
    return plate + `<text data-chart-text-slot="${slotKey}"${clean} fill="#171717" stroke="none">${nextInner}</text>`;
  });
}

function layoutLegend(items, width) {
  const pad = 7, gap = 10, innerWidth = width - 2 * pad;
  let x = 0, row = 0, used = 0;
  const cells = [];
  items.forEach((item, idx) => {
    const label = String(item.label ?? '');
    if (!label) return;
    const labelWidth = Math.ceil(textWidth(label, 11, 500));
    const w = Math.min(innerWidth, 14 + labelWidth);
    if (x && x + w > innerWidth) { x = 0; row++; }
    cells.push({ idx, label, x: pad + x, y: 4 + row * 17, labelWidth: w - 14, overflow: 14 + labelWidth > innerWidth });
    used = Math.max(used, x + w);
    x += w + gap;
  });
  return { cells, width: used + 2 * pad, height: cells.length ? 22 + row * 17 : 0 };
}

function renderLegendSvg(layout, legendItems, resolvedTheme, print, originalLabels, printColors) {
  if (!layout.height) return '';
  const tokenColorMap = {
    accent: resolvedTheme.accent,
    neutral: resolvedTheme.neutral,
    neutralStrong: resolvedTheme.neutralStrong,
    neutralSoft: resolvedTheme.neutralSoft,
    ink: resolvedTheme.ink,
  };
  const border = print ? resolvedTheme.ink : resolvedTheme.dim;
  const parts = [`<rect x="0.5" y="0.5" width="${layout.width-1}" height="${layout.height-1}" fill="${escapeXml(resolvedTheme.panel)}" stroke="${escapeXml(border)}"/>`];
  for (const { idx, label, x, y, overflow, labelWidth } of layout.cells) {
    const item = legendItems[idx];
    const color = print ? printColors[idx] : item.color;
    const mix = /^mix:([\d.]+)$/.exec(color);
    const rawColor = mix ? mixHex(resolvedTheme.neutralStrong, resolvedTheme.neutral, Number(mix[1]))
      : (Object.hasOwn(resolvedTheme, color) ? resolvedTheme[color] : tokenColorMap[color] || color || resolvedTheme.accent);
    const key = originalLabels?.[idx] ?? label;
    const swatchColor = print?.legendFill?.(key) ?? inlineZtdCssVariables(String(rawColor), resolvedTheme);
    const swatch = print && item.shape === 'line' && print.climate
      ? `<circle cx="4.5" cy="6.5" r="3" fill="${escapeXml(resolvedTheme.ink)}"/>`
      : print && item.shape === 'line'
        ? `<line x1="0" x2="12" y1="6.5" y2="6.5" stroke="${escapeXml(swatchColor)}" stroke-width="${print.stroke}" stroke-dasharray="${print.seriesDash(key)}"/>`
        : print && item.shape === 'circle'
          ? `<circle cx="4.5" cy="6.5" r="4" fill="${escapeXml(swatchColor)}" stroke="${escapeXml(resolvedTheme.ink)}"/>`
          : `<rect x="0" y="2" width="9" height="9" rx="${print ? 0 : 2.5}" fill="${escapeXml(swatchColor)}"${print ? ` stroke="${escapeXml(resolvedTheme.ink)}"` : ''}/>`;
    parts.push(
      `<g transform="translate(${x},${y})">` + swatch +
      `<text data-chart-text-slot="legend:${idx}"${overflow ? ` textLength="${labelWidth}" lengthAdjust="spacingAndGlyphs"` : ''} x="14" y="10" font-size="11" font-weight="500" fill="${escapeXml(resolvedTheme.muted)}">${escapeXml(label)}</text>` +
      `</g>`,
    );
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
    printStyle,
    localeTag,
    variant,
    title,
    subtitle,
    takeaway,
    textOverrides,
    legendItems,
    cornerRadius,
  } = resolved;
  const resolvedTheme = printStyle ? printTheme(printStyle, resolved.resolvedTheme) : resolved.resolvedTheme;
  const cardFill = printStyle ? printStyle.paper : resolved.backgroundColor === 'transparent' ? 'none' : (resolved.backgroundColor || resolvedTheme.panel);
  const cardStroke = printStyle ? 'none' : resolved.backgroundColor === 'transparent' ? 'none' : resolvedTheme.line;

  const padX = variant === 'card' ? 20 : 12;
  const padTop = variant === 'card' ? 18 : 12;
  const padBottom = variant === 'card' ? 16 : 12;

  const hasSubtitle = variant === 'card' && Boolean(subtitle);
  const hasLegend = variant === 'card' && legendItems.length > 0;
  const hasTakeaway = variant === 'card' && Boolean(takeaway);
  const legend = layoutLegend(hasLegend ? legendItems : [], width - 2 * padX);

  const headerHeight = variant === 'card'
    ? 24 + (hasSubtitle ? 18 : 0) + legend.height + 8
    : 0;
  const footerHeight = hasTakeaway ? 28 : 0;

  const plotX = padX;
  const plotY = padTop + headerHeight;
  const plotWidth = Math.max(140, width - padX * 2);
  const plotHeight = Math.max(96, height - plotY - padBottom - footerHeight);

  const safeId = sanitizeIdFragment(entityId);
  const print = printStyle ? createPrintMarks(printStyle, resolved, `ztd-hatch-${Array.from(String(entityId), c => c.codePointAt(0).toString(16)).join('-')}`) : null;
  let plotSpec = bareSpec;
  if (print) {
    // Explicit screen colors (notably the candlestick inspector slots) must not
    // override the paper palette. Do not change numeric scales, domains or widths.
    const { upColor, downColor, itemColors, theme, ...options } = bareSpec.options;
    if (resolved.chartType === 'area') options.curve = 'linear';
    if (resolved.chartType === 'bar') options.showLabels = false;
    plotSpec = { ...bareSpec, options };
  }
  const tree = React.createElement(
    ThemeProvider,
    { theme: resolvedTheme, cssVars: !print },
    React.createElement(Chart, {
      spec: plotSpec,
      width: plotWidth,
      height: plotHeight,
      animate: false,
      locale: localeTag,
    }),
  );

  const rawHtml = renderStaticElement(tree, `ztd-${safeId}`, {
    chartType: resolved.chartType,
    print,
    legendOffset: legendOffset(props.options,'plot'),
    itemColors: print ? {} : resolved.itemColors,
    dataTargets: resolved.dataTargets,
    rows: bareSpec.data,
    encoding: bareSpec.encoding,
  });
  const svgMatch = rawHtml.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
  const viewBoxMatch = svgMatch?.[1]?.match(/viewBox="([^"]+)"/i);
  const viewBox = viewBoxMatch?.[1] ?? `0 0 ${plotWidth} ${plotHeight}`;
  const innerPlotSvg = svgMatch?.[2]
    ? applySvgTextOverrides(inlineZtdCssVariables(svgMatch[2], resolvedTheme), textOverrides)
    : '';

  const clipId = `ztd-card-clip-${safeId}`;
  const transformAttr = rotationDeg !== 0
    ? `translate(${x},${y}) rotate(${rotationDeg},${width / 2},${height / 2})`
    : `translate(${x},${y})`;

  let headerSvg = '';
  let cardLegendSvg = '';
  if (variant === 'card') {
    let cursorY = padTop + 15;
    const titlePos = print ? `x="${width/2}" text-anchor="middle"` : `x="${padX}"`;
    headerSvg += `<text data-chart-field="title" ${titlePos} y="${cursorY}" font-size="15" font-weight="700" fill="${escapeXml(resolvedTheme.ink)}">${escapeXml(title)}</text>`;
    if (hasSubtitle) {
      cursorY += 18;
      headerSvg += `<text data-chart-field="subtitle" x="${padX}" y="${cursorY}" font-size="11.5" font-weight="400" fill="${escapeXml(resolvedTheme.muted)}">${escapeXml(subtitle)}</text>`;
    }
    if (hasLegend) {
      cursorY += 10;
      const delta = legendOffset(props.options,'card');
      cardLegendSvg = `<g data-chart-legend="true" transform="translate(${padX+delta.x},${cursorY+delta.y})">${renderLegendSvg(legend, legendItems, resolvedTheme, print, resolved.legendKeys, resolved.legendPrintColors)}</g>`;
    }
  }

  let footerSvg = '';
  if (hasTakeaway) {
    const lineY = height - padBottom - 20;
    const textY = height - padBottom - 4;
    footerSvg =
      `<line x1="${padX}" y1="${lineY}" x2="${width - padX}" y2="${lineY}" stroke="${escapeXml(resolvedTheme.line)}" stroke-width="1"/>` +
      `<text data-chart-field="takeaway" x="${padX}" y="${textY}" font-size="11.5" font-weight="600" fill="${escapeXml(resolvedTheme.accentText)}">${escapeXml(takeaway)}</text>`;
  }

  const fontFamily = escapeXml(resolvedTheme.fontFamily || 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif');
  const radius = print ? 0 : cornerRadius;
  const svg =
    `<g transform="${transformAttr}" data-chart-type="${escapeXml(resolved.chartType)}" font-family="${fontFamily}">` +
    `<defs>${print?.pattern ?? ''}<clipPath id="${clipId}"><rect width="${width}" height="${height}" rx="${radius}"/></clipPath></defs>` +
    `<g clip-path="url(#${clipId})">` +
    `<rect data-chart-card="background" width="${width}" height="${height}" rx="${radius}" fill="${escapeXml(cardFill)}" stroke="${escapeXml(cardStroke)}" stroke-width="1"/>` +
    headerSvg +
    `<svg x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" viewBox="${escapeXml(viewBox)}" preserveAspectRatio="xMidYMid meet">` +
    (print?.frame(plotHeight) ?? '') + innerPlotSvg +
    `</svg>` +
    footerSvg + cardLegendSvg +
    `</g>` +
    `</g>`;

  return { svg };
}
