import React from 'react';
import { createRoot } from 'react-dom/client';
import { Chart, ThemeProvider, baseCss, themeToCss } from 'ztd-charts';
import { DEFAULT_CHART_HEIGHT, DEFAULT_CHART_WIDTH, resolveChartSpec, resolveColorForZtdKey } from './model.js';
import { renderChartSvg } from './svg-renderer.js';

const mountedRoots = new WeakMap();
const injectedDocs = new WeakSet();

const NON_DATA_OPTION_KEYS = Object.freeze(['centerLabel', 'label', 'xLabel', 'yLabel', 'note']);

function ensureDocumentBaseCss(doc) {
  if (!doc || typeof doc.createElement !== 'function' || injectedDocs.has(doc)) return;
  try {
    if (!doc.getElementById?.('ztd-charts-extension-css')) {
      const style = doc.createElement('style');
      style.id = 'ztd-charts-extension-css';
      style.textContent = [
        baseCss,
        '[data-role="ztd-chart-mount"] .ztd-card { height: 100%; box-sizing: border-box; margin: 0; }',
        '[data-role="ztd-chart-mount"] [data-chart-field], [data-role="ztd-chart-mount"] [data-chart-option-field] { pointer-events: auto !important; cursor: text !important; }',
        'input[data-ztd-chart-editor="true"], input[data-ztd-chart-editor="true"]:focus, input[data-ztd-chart-editor="true"]:focus-visible { background: transparent !important; border: none !important; outline: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }',
      ].join('\n');
      (doc.head ?? doc.documentElement)?.appendChild?.(style);
    }
    injectedDocs.add(doc);
  } catch {
    // Ignore read-only or synthetic documents
  }
}

function getElementZtdKey(el) {
  if (!el || typeof el.getAttribute !== 'function') return '';
  const existing = el.getAttribute('data-ztd-key');
  if (existing) return existing;
  const keys = Object.keys(el);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.startsWith('__reactFiber$')) {
      const fiber = el[k];
      const ownKey = fiber?.key ?? (
        fiber?.return && typeof fiber.return.type !== 'string' ? fiber.return.key : null
      );
      if (ownKey !== null && ownKey !== undefined && ownKey !== '') {
        const keyStr = String(ownKey);
        el.setAttribute('data-ztd-key', keyStr);
        return keyStr;
      }
      break;
    }
  }
  return '';
}

function applyDomCustomColors(root, resolved) {
  if (!root || !resolved || typeof root.querySelector !== 'function') return;
  const svgEl = root.querySelector('svg.ztd-svg') ?? root.querySelector('svg');
  if (!svgEl) return;

  const itemColors = resolved.itemColors ?? {};
  const hasCustom = Object.keys(itemColors).length > 0;

  function walkSvgNode(el, inheritedColor) {
    if (!el || el.nodeType !== 1) return;
    const tag = (el.tagName || '').toLowerCase();
    const ztdKey = getElementZtdKey(el);
    const dataK = el.getAttribute?.('data-k');
    const cls = el.getAttribute?.('class') || '';
    const isMark = cls.includes('ztd-mark');

    const ownColor = hasCustom
      ? resolveColorForZtdKey(
          resolved.chartType,
          ztdKey,
          dataK,
          isMark,
          itemColors,
          resolved.dataTargets,
          resolved.spec?.data,
          resolved.spec?.encoding,
        )
      : null;
    const effectiveColor = ownColor || inheritedColor;

    if (['path', 'rect', 'circle', 'line', 'polygon'].includes(tag)) {
      const isBulletBgOrTarget =
        resolved.chartType === 'bullet'
        && (tag === 'line' || (tag === 'path' && ztdKey && /^\d+$/.test(ztdKey)));
      const isBoxWhisker = resolved.chartType === 'box' && tag === 'line';
      const currentFill = el.getAttribute('fill');
      const currentStroke = el.getAttribute('stroke');

      if (effectiveColor && !isBulletBgOrTarget && !isBoxWhisker && currentFill !== 'transparent') {
        if (
          typeof currentFill === 'string'
          && currentFill !== 'none'
          && currentFill !== 'transparent'
          && !currentFill.includes('--ztd-panel')
        ) {
          if (!el.hasAttribute('data-orig-fill')) {
            el.setAttribute('data-orig-fill', currentFill);
          }
          if (currentFill !== effectiveColor) {
            el.setAttribute('fill', effectiveColor);
          }
        }
        if (
          typeof currentStroke === 'string'
          && currentStroke !== 'none'
          && !currentStroke.includes('--ztd-panel')
          && !currentStroke.includes('--ztd-line')
          && !currentStroke.includes('--ztd-dim')
          && !currentStroke.includes('--ztd-neutral-soft')
        ) {
          if (!el.hasAttribute('data-orig-stroke')) {
            el.setAttribute('data-orig-stroke', currentStroke);
          }
          if (currentStroke !== effectiveColor) {
            el.setAttribute('stroke', effectiveColor);
          }
        }
      } else {
        if (el.hasAttribute('data-orig-fill')) {
          el.setAttribute('fill', el.getAttribute('data-orig-fill'));
          el.removeAttribute('data-orig-fill');
        }
        if (el.hasAttribute('data-orig-stroke')) {
          el.setAttribute('stroke', el.getAttribute('data-orig-stroke'));
          el.removeAttribute('data-orig-stroke');
        }
      }
    }

    const children = el.children;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        walkSvgNode(children[i], effectiveColor);
      }
    }
  }

  walkSvgNode(svgEl, null);
}

function ChartIslandContent({ activeSpec, resolved, variant, plotWidth, plotHeight, localeTag, textOverrides, cardNumber, cardLevel, hostEl }) {
  const wrapRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const root = wrapRef.current;
    if (!root || typeof root.querySelector !== 'function') return;

    applyDomCustomColors(root, resolved);

    const headerRows = root.querySelectorAll?.('.ztd-card > header > div') ?? [];
    const firstHeaderRow = headerRows[0];
    const titleEl = root.querySelector('.ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3');
    if (titleEl) {
      titleEl.dataset.chartField = 'title';
      titleEl.dataset.chartTextSlot = 'field:title';
    }
    if (firstHeaderRow) {
      const firstSpan = firstHeaderRow.querySelector?.('span:first-child');
      if (firstSpan && firstSpan !== titleEl) {
        firstSpan.dataset.chartField = 'cardNumber';
        firstSpan.dataset.chartTextSlot = 'field:cardNumber';
        if (cardNumber !== undefined) {
          firstSpan.textContent = String(cardNumber);
        }
      }
    }

    const secondHeaderRow = headerRows[1];
    const subtitleEl = secondHeaderRow?.querySelector?.('span:first-child');
    if (subtitleEl && !subtitleEl.closest?.('ul')) {
      subtitleEl.dataset.chartField = 'subtitle';
      subtitleEl.dataset.chartTextSlot = 'field:subtitle';
    }

    const takeawayEl = root.querySelector('.ztd-card > footer > span:first-child');
    if (takeawayEl) {
      takeawayEl.dataset.chartField = 'takeaway';
      takeawayEl.dataset.chartTextSlot = 'field:takeaway';
    }

    const footerRightSpans = root.querySelectorAll?.('.ztd-card > footer > span:nth-child(2) > span') ?? [];
    const levelEl = footerRightSpans.length > 0 ? footerRightSpans[footerRightSpans.length - 1] : null;
    if (levelEl) {
      levelEl.dataset.chartField = 'cardLevel';
      levelEl.dataset.chartTextSlot = 'field:cardLevel';
      if (cardLevel !== undefined && cardLevel !== '') {
        levelEl.textContent = String(cardLevel);
      }
    }

    // Tag only explicit non-data option labels (e.g. centerLabel, gauge label, axis titles);
    // never tag data categories, series names, numeric values, or axis ticks.
    const optionValues = new Map();
    for (const optKey of NON_DATA_OPTION_KEYS) {
      const val = activeSpec?.options?.[optKey];
      if (typeof val === 'string' && val.trim().length > 0) {
        optionValues.set(val.trim(), optKey);
      }
    }

    const svgTexts = root.querySelectorAll?.('svg text') ?? [];
    for (let i = 0; i < svgTexts.length; i++) {
      const textEl = svgTexts[i];
      const txt = (textEl.textContent ?? '').trim();
      const matchedOpt = optionValues.get(txt);
      if (matchedOpt) {
        const slotKey = `option:${matchedOpt}`;
        textEl.dataset.chartOptionField = matchedOpt;
        textEl.dataset.chartTextSlot = slotKey;
        if (textEl.style) {
          textEl.style.pointerEvents = 'auto';
          textEl.style.cursor = 'text';
        }
      } else {
        delete textEl.dataset?.chartOptionField;
        delete textEl.dataset?.chartTextSlot;
        if (textEl.style) {
          textEl.style.cursor = '';
        }
      }
    }

    const outerIsland = hostEl?.closest?.('.ecanvas-island') ?? hostEl?.closest?.('[data-entity-id]') ?? hostEl;
    const activeSlot = hostEl?.__ztdActiveEditSlot ?? outerIsland?.__ztdActiveEditSlot ?? null;
    const allSlots = root.querySelectorAll?.('[data-chart-text-slot], [data-chart-field], [data-chart-option-field]') ?? [];
    for (const el of allSlots) {
      const matchesActive = Boolean(
        activeSlot
        && (
          el.dataset?.chartTextSlot === activeSlot
          || `field:${el.dataset?.chartField}` === activeSlot
          || `option:${el.dataset?.chartOptionField}` === activeSlot
          || el.dataset?.chartField === activeSlot
        ),
      );
      if (matchesActive) {
        if (el.style) el.style.opacity = '0';
        if (el.dataset) el.dataset.hiddenByEditor = 'true';
      } else if (el.dataset?.hiddenByEditor === 'true') {
        if (el.style) el.style.opacity = '';
        delete el.dataset.hiddenByEditor;
      }
    }

    if (
      resolved?.itemColors
      && Object.keys(resolved.itemColors).length > 0
      && typeof MutationObserver === 'function'
    ) {
      let applying = false;
      const observer = new MutationObserver(() => {
        if (applying) return;
        applying = true;
        try {
          applyDomCustomColors(root, resolved);
        } finally {
          applying = false;
        }
      });
      const svgEl = root.querySelector('svg');
      if (svgEl) {
        observer.observe(svgEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['fill', 'stroke'] });
        return () => observer.disconnect();
      }
    }
  });

  return React.createElement(
    'div',
    {
      ref: wrapRef,
      style: {
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: variant === 'card' ? '0px' : '12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      },
    },
    React.createElement(Chart, {
      spec: activeSpec,
      width: plotWidth,
      height: plotHeight,
      locale: localeTag,
    }),
  );
}

/**
 * Interactive DOM island renderer for `diagram.ztd-charts.chart`.
 * Uses React 19 `createRoot` with generation-guarded microtask cleanup so
 * `CanvasViewport.reconcileEntity` updates preserve hover/interaction state
 * while `clearIslandContent` unmounts cleanly.
 */
export function renderChartDom(hostEl, props, derived, entityId = 'chart') {
  if (!hostEl) return () => {};

  const geom = derived ?? {
    x: 0,
    y: 0,
    width: DEFAULT_CHART_WIDTH,
    height: DEFAULT_CHART_HEIGHT,
    rotation: 0,
  };
  const width = Math.max(120, Math.round(Number.isFinite(geom.width) ? geom.width : DEFAULT_CHART_WIDTH));
  const height = Math.max(100, Math.round(Number.isFinite(geom.height) ? geom.height : DEFAULT_CHART_HEIGHT));
  const resolved = resolveChartSpec(props);
  const {
    spec,
    bareSpec,
    resolvedTheme,
    localeTag,
    variant,
    chartType,
    themeName,
    title,
    cardNumber,
    cardLevel,
    textOverrides,
    legendItems,
  } = resolved;

  if (hostEl.dataset) {
    hostEl.dataset.chartType = chartType;
    hostEl.dataset.chartTheme = themeName;
    hostEl.dataset.chartVariant = variant;
    hostEl.dataset.chartTitle = title;
    hostEl.dataset.chartBackground = resolved.backgroundColor || '';
  }

  const themeVars = themeToCss(resolvedTheme);
  if (hostEl.style) {
    hostEl.style.cssText =
      `${themeVars};width:100%;height:${height}px;box-sizing:border-box;position:relative;overflow:hidden;` +
      `border-radius:14px;background:${resolvedTheme.panel};border:1px solid ${resolvedTheme.line};` +
      `color:${resolvedTheme.ink};font-family:${resolvedTheme.fontFamily};user-select:none;`;
  }

  const doc = hostEl.ownerDocument;
  if (!doc || typeof doc.createElement !== 'function') {
    const { svg } = renderChartSvg(props, { ...geom, x: 0, y: 0, rotation: 0 }, entityId);
    hostEl.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
    return () => {
      hostEl.innerHTML = '';
    };
  }

  ensureDocumentBaseCss(doc);

  let entry = mountedRoots.get(hostEl);
  if (!entry || !hostEl.contains?.(entry.mountNode)) {
    const mountNode = doc.createElement('div');
    mountNode.dataset.role = 'ztd-chart-mount';
    mountNode.style.cssText = 'width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:stretch;';
    hostEl.replaceChildren(mountNode);
    const root = createRoot(mountNode);
    entry = { root, mountNode, gen: 0 };
    mountedRoots.set(hostEl, entry);
  }

  const hasSubtitle = variant === 'card' && Boolean(resolved.subtitle);
  const hasLegend = variant === 'card' && legendItems.length > 0;
  const hasTakeaway = variant === 'card' && Boolean(resolved.takeaway);
  const chromeHeight = variant === 'card'
    ? 68 + (hasSubtitle ? 20 : 0) + (hasLegend ? 24 : 0) + (hasTakeaway ? 34 : 0)
    : 24;
  const plotHeight = Math.max(96, height - chromeHeight);
  const plotWidth = Math.max(140, width - (variant === 'card' ? 40 : 24));

  const activeSpec = variant === 'card' ? spec : bareSpec;
  const element = React.createElement(
    ThemeProvider,
    { theme: resolvedTheme },
    React.createElement(ChartIslandContent, {
      activeSpec,
      resolved,
      variant,
      plotWidth,
      plotHeight,
      localeTag,
      textOverrides,
      cardNumber,
      cardLevel,
      hostEl,
    }),
  );

  const renderGen = ++entry.gen;
  entry.root.render(element);

  return () => {
    const current = entry;
    queueMicrotask(() => {
      if (!current) return;
      if (current.gen === renderGen || !hostEl.contains?.(current.mountNode)) {
        try {
          current.root.unmount();
        } catch {
          // Ignore unmount errors on detached hosts
        }
        if (mountedRoots.get(hostEl) === current) {
          mountedRoots.delete(hostEl);
        }
      }
    });
  };
}
