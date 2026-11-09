import React from 'react';
import { createRoot } from 'react-dom/client';
import { Chart, ThemeProvider, baseCss, themeToCss } from 'ztd-charts';
import { DEFAULT_CHART_HEIGHT, DEFAULT_CHART_WIDTH, resolveChartSpec } from './model.js';
import { renderChartSvg } from './svg-renderer.js';

const mountedRoots = new WeakMap();
const injectedDocs = new WeakSet();

function ensureDocumentBaseCss(doc) {
  if (!doc || typeof doc.createElement !== 'function' || injectedDocs.has(doc)) return;
  try {
    if (!doc.getElementById?.('ztd-charts-extension-css')) {
      const style = doc.createElement('style');
      style.id = 'ztd-charts-extension-css';
      style.textContent = [
        baseCss,
        '[data-role="ztd-chart-mount"] .ztd-card { height: 100%; box-sizing: border-box; margin: 0; }',
        '[data-role="ztd-chart-mount"] [data-chart-field], [data-role="ztd-chart-mount"] [data-chart-text-slot], [data-role="ztd-chart-mount"] svg text, [data-role="ztd-chart-mount"] svg tspan { pointer-events: auto !important; cursor: text !important; }',
        'input[data-ztd-chart-editor="true"], input[data-ztd-chart-editor="true"]:focus, input[data-ztd-chart-editor="true"]:focus-visible { background: transparent !important; border: none !important; outline: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }',
      ].join('\n');
      (doc.head ?? doc.documentElement)?.appendChild?.(style);
    }
    injectedDocs.add(doc);
  } catch {
    // Ignore read-only or synthetic documents
  }
}

function applySlotOverride(el, slotKey, textOverrides) {
  if (!el) return;
  const currentText = el.textContent ?? '';
  if (
    el.dataset.baseText === undefined
    || (el.dataset.appliedOverride !== undefined && currentText !== el.dataset.appliedOverride)
  ) {
    el.dataset.baseText = currentText;
  }
  const baseText = (el.dataset.baseText ?? '').trim();
  const override = textOverrides?.[slotKey] ?? (baseText ? textOverrides?.[`text:${baseText}`] : undefined);
  if (override !== undefined) {
    const nextStr = String(override);
    el.dataset.appliedOverride = nextStr;
    if (el.textContent !== nextStr) {
      el.textContent = nextStr;
    }
  } else if (el.dataset.appliedOverride !== undefined) {
    el.textContent = el.dataset.baseText ?? '';
    delete el.dataset.appliedOverride;
  }
}

function ChartIslandContent({ activeSpec, variant, plotWidth, plotHeight, localeTag, textOverrides, cardLevel, hostEl }) {
  const wrapRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const root = wrapRef.current;
    if (!root || typeof root.querySelector !== 'function') return;

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
      }
    }

    const secondHeaderRow = headerRows[1];
    const subtitleEl = secondHeaderRow?.querySelector?.('span:first-child');
    if (subtitleEl && !subtitleEl.closest?.('ul')) {
      subtitleEl.dataset.chartField = 'subtitle';
      subtitleEl.dataset.chartTextSlot = 'field:subtitle';
    }

    const legendItems = root.querySelectorAll?.('.ztd-card > header ul > li') ?? [];
    for (let i = 0; i < legendItems.length; i++) {
      const spans = legendItems[i].querySelectorAll?.('span') ?? [];
      const labelSpan = spans.length > 0 ? spans[spans.length - 1] : null;
      if (labelSpan && labelSpan.getAttribute?.('aria-hidden') !== 'true') {
        const slotKey = `legend:${i}`;
        labelSpan.dataset.chartTextSlot = slotKey;
        applySlotOverride(labelSpan, slotKey, textOverrides);
      }
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

    const svgTexts = root.querySelectorAll?.('svg text') ?? [];
    for (let i = 0; i < svgTexts.length; i++) {
      const textEl = svgTexts[i];
      const slotKey = `svg:${i}`;
      textEl.dataset.chartTextSlot = slotKey;
      if (textEl.style) {
        textEl.style.pointerEvents = 'auto';
        textEl.style.cursor = 'text';
      }
      applySlotOverride(textEl, slotKey, textOverrides);
    }

    const islandEl = hostEl?.closest?.('[data-entity-id]') ?? hostEl;
    const activeSlot = islandEl?.__ztdActiveEditSlot ?? hostEl?.__ztdActiveEditSlot ?? null;
    const allSlots = root.querySelectorAll?.('[data-chart-text-slot], [data-chart-field]') ?? [];
    for (const el of allSlots) {
      const matchesActive = Boolean(
        activeSlot
        && (el.dataset?.chartTextSlot === activeSlot || `field:${el.dataset?.chartField}` === activeSlot || el.dataset?.chartField === activeSlot),
      );
      if (matchesActive) {
        if (el.style) el.style.opacity = '0';
        if (el.dataset) el.dataset.hiddenByEditor = 'true';
      } else if (el.dataset?.hiddenByEditor === 'true') {
        if (el.style) el.style.opacity = '';
        delete el.dataset.hiddenByEditor;
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
    cardLevel,
    textOverrides,
    legendItems,
  } = resolved;

  if (hostEl.dataset) {
    hostEl.dataset.chartType = chartType;
    hostEl.dataset.chartTheme = themeName;
    hostEl.dataset.chartVariant = variant;
    hostEl.dataset.chartTitle = title;
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
      variant,
      plotWidth,
      plotHeight,
      localeTag,
      textOverrides,
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
