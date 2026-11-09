import { autoLegend, luminance, mixHex, normalizeData, parseColor, parseCSV, resolveThemeInput, toCSV } from 'ztd-charts';
import {
  CHARTS,
  chartsIn,
  getChartDef,
  localizeDef,
  profileData,
  suggestCharts,
  validateSpec,
} from 'ztd-charts/spec';

export const DEFAULT_CHART_WIDTH = 480;
export const DEFAULT_CHART_HEIGHT = 340;
export const MIN_CHART_WIDTH = 240;
export const MIN_CHART_HEIGHT = 180;

export const CHART_FAMILIES = Object.freeze([
  { id: 'all', labelKo: '전체', labelEn: 'All' },
  { id: 'comparison', labelKo: '비교', labelEn: 'Comparison' },
  { id: 'trend', labelKo: '추세', labelEn: 'Trend' },
  { id: 'proportion', labelKo: '비율', labelEn: 'Proportion' },
  { id: 'relationship', labelKo: '관계', labelEn: 'Relationship' },
  { id: 'distribution', labelKo: '분포', labelEn: 'Distribution' },
  { id: 'flow', labelKo: '흐름', labelEn: 'Flow' },
  { id: 'hierarchy', labelKo: '계층', labelEn: 'Hierarchy' },
  { id: 'kpi', labelKo: 'KPI', labelEn: 'KPI' },
]);

export const CHART_TYPES = Object.freeze(CHARTS.map(def => def.type));
export const CHART_TYPE_SET = new Set(CHART_TYPES);

/** Quick-switch chart types exposed directly in the selection-bar segmented control. */
export const QUICK_CHART_OPTIONS = Object.freeze([
  { label: '막대', value: 'bar' },
  { label: '라인', value: 'line' },
  { label: '영역', value: 'area' },
  { label: '파이', value: 'pie' },
  { label: '도넛', value: 'donut' },
  { label: '산점도', value: 'scatter' },
  { label: '레이더', value: 'radar' },
  { label: '생키', value: 'sankey' },
]);

export const CHART_DEFAULTS = Object.freeze({
  chartType: 'bar',
  title: '',
  subtitle: '',
  takeaway: '',
  theme: 'light',
  locale: 'ko',
  variant: 'card',
  legendMode: 'auto',
  accentColor: '#3182f6',
  backgroundColor: '',
  cornerRadius: 0,
  data: [],
  encoding: {},
  options: {},
});

export const HIGHLIGHT_PRESETS = Object.freeze([
  { id: 'auto', value: 'auto', labelKo: '자동', labelEn: 'Auto' },
  { id: 'max', value: 'max', labelKo: '최댓값', labelEn: 'Max' },
  { id: 'min', value: 'min', labelKo: '최솟값', labelEn: 'Min' },
  { id: 'first', value: 'first', labelKo: '첫 항목', labelEn: 'First' },
  { id: 'last', value: 'last', labelKo: '끝 항목', labelEn: 'Last' },
  { id: 'none', value: 'none', labelKo: '없음', labelEn: 'None' },
]);

export function isValidHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
}

/** Stored card background: a hex color, `transparent`, or '' for the theme panel. */
export function resolveBackgroundColor(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === 'transparent') return 'transparent';
  return isValidHexColor(trimmed) ? trimmed : '';
}

/** Card corner radius in pixels. Square by default; capped so a card cannot become a circle. */
export function resolveCornerRadius(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(64, Math.round(n));
}

const CATALOG_CACHE = {
  ko: Object.freeze(
    chartsIn('ko').map(def => {
      const canonical = getChartDef(def.type);
      return Object.freeze({
        type: def.type,
        family: canonical?.family || canonical?.group || 'comparison',
        name: def.name,
        summary: def.summary || def.whenToUse?.[0] || '',
        whenToUse: Object.freeze([...(def.whenToUse ?? [])]),
        avoidWhen: Object.freeze([...(def.avoidWhen ?? [])]),
        encodings: Object.freeze({ ...(def.example?.encoding ?? {}) }),
        example: def.example,
      });
    }),
  ),
  en: Object.freeze(
    chartsIn('en').map(def => {
      const canonical = getChartDef(def.type);
      return Object.freeze({
        type: def.type,
        family: canonical?.family || canonical?.group || 'comparison',
        name: def.name,
        summary: def.summary || def.whenToUse?.[0] || '',
        whenToUse: Object.freeze([...(def.whenToUse ?? [])]),
        avoidWhen: Object.freeze([...(def.avoidWhen ?? [])]),
        encodings: Object.freeze({ ...(def.example?.encoding ?? {}) }),
        example: def.example,
      });
    }),
  ),
};

export function normalizeLang(locale) {
  if (typeof locale === 'string' && locale.toLowerCase().startsWith('en')) return 'en';
  return 'ko';
}

export function normalizeLocaleTag(locale) {
  return normalizeLang(locale) === 'en' ? 'en-US' : 'ko-KR';
}

export function normalizeChartType(type) {
  if (typeof type === 'string' && CHART_TYPE_SET.has(type)) return type;
  return 'bar';
}

export function getChartCatalog(locale = 'ko') {
  return CATALOG_CACHE[normalizeLang(locale)];
}

export function getLocalizedChartDef(chartType, locale = 'ko') {
  const safeType = normalizeChartType(chartType);
  const lang = normalizeLang(locale);
  const base = getChartDef(safeType) ?? getChartDef('bar');
  return localizeDef(base, lang);
}

export function resolveChartTheme(
  theme = 'light',
  accentColor = '#3182f6',
  backgroundColor = '',
  neutralColor = '',
) {
  const validBg = isValidHexColor(backgroundColor) ? backgroundColor.trim() : '';
  const validAccent = isValidHexColor(accentColor) ? accentColor.trim() : '';
  const validNeutral = isValidHexColor(neutralColor) ? neutralColor.trim() : '';

  const parsedBg = validBg ? parseColor(validBg) : null;
  const baseName = parsedBg
    ? (luminance(parsedBg) < 0.28 ? 'dark' : 'light')
    : (theme === 'dark' ? 'dark' : 'light');
  const baseTheme = resolveThemeInput(baseName);

  const customTokens = {};
  if (validAccent) {
    customTokens.accent = validAccent;
    customTokens.accentText = validAccent;
  }
  if (validBg) {
    customTokens.bg = validBg;
    customTokens.panel = validBg;
    customTokens.line = mixHex(validBg, baseTheme.ink, baseName === 'dark' ? 0.14 : 0.11);
    customTokens.line2 = mixHex(validBg, baseTheme.ink, baseName === 'dark' ? 0.09 : 0.06);
    customTokens.lift = mixHex(validBg, baseTheme.ink, baseName === 'dark' ? 0.06 : 0.04);
    customTokens.neutralSoft = mixHex(validBg, baseTheme.ink, baseName === 'dark' ? 0.1 : 0.08);
  }
  if (validNeutral) {
    const panelRef = validBg || baseTheme.panel;
    customTokens.neutral = validNeutral;
    customTokens.neutralStrong = mixHex(validNeutral, baseTheme.ink, 0.28);
    customTokens.neutralSoft = mixHex(validNeutral, panelRef, 0.72);
  }

  if (Object.keys(customTokens).length > 0) {
    return resolveThemeInput({ ...baseTheme, ...customTokens });
  }
  return baseTheme;
}

function isPlainRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJsonRows(rows) {
  if (!Array.isArray(rows)) return [];
  const cleaned = [];
  for (const item of rows) {
    if (!isPlainRecord(item)) continue;
    const row = {};
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
        row[k] = v;
      }
    }
    if (Object.keys(row).length > 0) cleaned.push(row);
  }
  return cleaned;
}

/**
 * Attempts to adapt encoding keys when a user switches `chartType` on custom tabular data.
 */
function adaptEncodingForType(chartType, rows, currentEncoding, lang) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  // 1. Check if `suggestCharts` already produced a spec for this exact chart type
  try {
    const suggested = suggestCharts(rows, { lang })?.suggestions?.find(item => item.type === chartType);
    if (suggested?.spec?.encoding) {
      return { ...suggested.spec.encoding };
    }
  } catch {
    // Fall through to heuristic mapping
  }

  // 2. Heuristic column mapping using profileData
  const profile = profileData(rows);
  const columns = profile?.columns ?? [];
  if (columns.length === 0) return null;

  const catCols = columns.filter(c => c.kind === 'category' || c.kind === 'date');
  const numCols = columns.filter(c => c.kind === 'number');
  const firstDim = currentEncoding?.x || currentEncoding?.label || currentEncoding?.stage || currentEncoding?.category || catCols[0]?.name || columns[0]?.name;
  const secondDim = currentEncoding?.series || currentEncoding?.group || catCols[1]?.name;
  const firstNum = currentEncoding?.y || currentEncoding?.value || numCols[0]?.name || columns[1]?.name || columns[0]?.name;
  const secondNum = numCols[1]?.name || firstNum;
  const thirdNum = numCols[2]?.name || secondNum;

  const exampleEncoding = getLocalizedChartDef(chartType, lang)?.example?.encoding ?? {};
  const neededKeys = Object.keys(exampleEncoding);
  const adapted = {};

  for (const key of neededKeys) {
    if (currentEncoding && typeof currentEncoding[key] === 'string' && columns.some(c => c.name === currentEncoding[key])) {
      adapted[key] = currentEncoding[key];
      continue;
    }
    if (['x', 'label', 'stage', 'category', 'item', 'region', 'feature', 'goal', 'kpi', 'method', 'day', 'date', 'week', 'month', 'quarter', 'brand', 'api', 'model'].includes(key)) {
      if (firstDim) adapted[key] = firstDim;
    } else if (['y', 'value', 'amount', 'sales', 'count', 'users', 'customers', 'share', 'spend', 'orders', 'score', 'mau', 'visits', 'hours', 'revenue', 'rate', 'actual', 'usage', 'minutes', 'commits', 'ms'].includes(key)) {
      if (firstNum) adapted[key] = firstNum;
    } else if (['series', 'group', 'channel', 'product', 'team', 'plan'].includes(key)) {
      if (secondDim) adapted[key] = secondDim;
    } else if (key === 'source' || key === 'from') {
      if (firstDim) adapted[key] = firstDim;
    } else if (key === 'target' || key === 'to') {
      if (secondDim || firstNum) adapted[key] = secondDim || firstNum;
    } else if (key === 'before' || key === 'low' || key === 'open') {
      if (firstNum) adapted[key] = firstNum;
    } else if (key === 'after' || key === 'high' || key === 'close') {
      if (secondNum) adapted[key] = secondNum;
    } else if (key === 'size' || key === 'r') {
      if (thirdNum) adapted[key] = thirdNum;
    } else if (key === 'dimensions' || key === 'metrics' || key === 'columns') {
      adapted[key] = numCols.map(c => c.name);
    }
  }

  return Object.keys(adapted).length > 0 ? adapted : null;
}

/**
 * Resolves highlighted indices in the same way as `ztd-charts`'s internal `resolveHighlight`.
 */
export function resolveHighlightIndices(highlight, labels = [], values = [], fallback = 'max') {
  const out = new Set();
  const n = labels.length;
  const pick = mode => {
    if (!n || mode === 'none') return;
    if (mode === 'first') out.add(0);
    else if (mode === 'last') out.add(n - 1);
    else if (mode === 'max' || mode === 'min') {
      let best = -1;
      let bv = mode === 'max' ? -Infinity : Infinity;
      values.forEach((v, i) => {
        const num = Number(v);
        if (!Number.isFinite(num)) return;
        if (mode === 'max' ? num > bv : num < bv) {
          bv = num;
          best = i;
        }
      });
      if (best >= 0) out.add(best);
    }
  };
  if (highlight === undefined || highlight === null || highlight === '' || highlight === 'auto') {
    pick(fallback);
    return out;
  }
  const list = Array.isArray(highlight) ? highlight : [highlight];
  for (const item of list) {
    if (typeof item === 'number') {
      if (item >= 0 && item < n) out.add(item);
    } else if (item === 'max' || item === 'min' || item === 'first' || item === 'last' || item === 'none') {
      pick(item);
    } else if (typeof item === 'string') {
      labels.forEach((l, i) => {
        if (String(l) === item) out.add(i);
      });
    }
  }
  return out;
}

export function sanitizeItemColors(rawItemColors) {
  if (!isPlainRecord(rawItemColors)) return {};
  const out = {};
  for (const [k, v] of Object.entries(rawItemColors)) {
    const key = String(k ?? '').trim();
    if (!key || !isValidHexColor(v)) continue;
    out[key] = v.trim();
  }
  return out;
}

function uniqueStrings(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const str = String(item ?? '').trim();
    if (!str || seen.has(str)) continue;
    seen.add(str);
    out.push(str);
  }
  return out;
}

function defaultCategoricalSwatches(resolvedTheme, count, hiSet) {
  const out = new Array(count);
  const rest = [];
  for (let i = 0; i < count; i++) {
    if (hiSet.has(i)) out[i] = resolvedTheme.accent;
    else rest.push(i);
  }
  const k = rest.length;
  rest.forEach((idx, j) => {
    if (k === 1) out[idx] = resolvedTheme.neutral;
    else if (j === 0) out[idx] = resolvedTheme.ink;
    else if (j === k - 1) out[idx] = resolvedTheme.neutral;
    else if (k === 3) out[idx] = resolvedTheme.neutralStrong;
    else {
      const t = (j - 1) / Math.max(1, k - 2);
      out[idx] = t <= 1e-3 ? resolvedTheme.neutralStrong : mixHex(resolvedTheme.neutralStrong, resolvedTheme.neutral, 1 - t);
    }
  });
  return out;
}

function attachTargetMetadata(items, kind = 'category') {
  const normalized = items.map(it => ({
    ...it,
    id: it.id ?? it.key,
    key: it.key ?? it.id,
  }));
  Object.defineProperty(normalized, 'items', {
    value: normalized,
    enumerable: false,
  });
  Object.defineProperty(normalized, 'kind', {
    value: kind,
    enumerable: false,
  });
  return normalized;
}

/**
 * Extracts selectable data components (series, categories, slices, nodes, or up/down)
 * for highlight selection and per-component color customization.
 */
export function extractChartDataTargets(
  chartType,
  rows = [],
  encoding = {},
  options = {},
  resolvedTheme = resolveChartTheme('light'),
  localeTag = 'ko-KR',
) {
  const safeType = normalizeChartType(chartType);
  const safeRows = Array.isArray(rows) ? rows : [];
  const enc = isPlainRecord(encoding) ? encoding : {};
  const opt = isPlainRecord(options) ? options : {};
  const itemColors = sanitizeItemColors(opt.itemColors);
  const lang = normalizeLang(localeTag);

  if (safeType === 'candlestick') {
    const upCustom = isValidHexColor(opt.upColor) ? opt.upColor.trim() : itemColors.up;
    const downCustom = isValidHexColor(opt.downColor) ? opt.downColor.trim() : itemColors.down;
    return attachTargetMetadata([
      {
        id: 'up',
        key: 'up',
        label: lang === 'en' ? 'Up (Bullish)' : '상승(양봉)',
        kind: 'candle',
        defaultColor: resolvedTheme.accent,
        customColor: upCustom || '',
        effectiveColor: upCustom || resolvedTheme.accent,
        highlighted: true,
      },
      {
        id: 'down',
        key: 'down',
        label: lang === 'en' ? 'Down (Bearish)' : '하락(음봉)',
        kind: 'candle',
        defaultColor: resolvedTheme.neutralStrong,
        customColor: downCustom || '',
        effectiveColor: downCustom || resolvedTheme.neutralStrong,
        highlighted: false,
      },
    ], 'updown');
  }

  // Check if chart is multi-series
  const seriesCol = typeof enc.series === 'string' ? enc.series : null;
  const wideSeries = Array.isArray(enc.y) ? enc.y.map(String) : [];
  const frontFields = Array.isArray(enc.front) ? enc.front.map(String) : (typeof enc.front === 'string' ? [enc.front] : []);
  const backFields = Array.isArray(enc.back) ? enc.back.map(String) : (typeof enc.back === 'string' ? [enc.back] : []);

  if (safeType === 'skyline' && (backFields.length > 0 || frontFields.length > 0)) {
    const names = uniqueStrings([...backFields, ...frontFields]);
    const hiSet = resolveHighlightIndices(opt.highlight, names, names.map(() => 0), 'first');
    const defaults = defaultCategoricalSwatches(resolvedTheme, names.length, hiSet);
    return attachTargetMetadata(names.map((name, i) => ({
      id: name,
      label: name,
      kind: 'series',
      defaultColor: defaults[i] || resolvedTheme.neutral,
      customColor: itemColors[name] || '',
      effectiveColor: itemColors[name] || defaults[i] || resolvedTheme.neutral,
      highlighted: hiSet.has(i),
    })), 'series');
  }

  let seriesList = [];
  if (wideSeries.length >= 2) {
    seriesList = wideSeries;
  } else if (seriesCol && safeRows.length > 0) {
    seriesList = uniqueStrings(safeRows.map(r => r?.[seriesCol]));
  }

  const isMultiSeriesChart =
    ['line', 'area', 'stream', 'radar', 'bump', 'marimekko'].includes(safeType)
    || (['bar', 'scatter', 'bubble', 'histogram'].includes(safeType) && seriesList.length >= 2);

  if (isMultiSeriesChart && seriesList.length >= 1) {
    const valCol = typeof enc.y === 'string' ? enc.y : (typeof enc.value === 'string' ? enc.value : 'value');
    const totals = seriesList.map(sName => {
      if (wideSeries.includes(sName)) {
        return safeRows.reduce((acc, r) => acc + (Number(r?.[sName]) || 0), 0);
      }
      return safeRows
        .filter(r => String(r?.[seriesCol] ?? '') === sName)
        .reduce((acc, r) => acc + (Number(r?.[valCol]) || 0), 0);
    });
    const fallbackRule = ['stream', 'bump'].includes(safeType) ? 'max' : 'first';
    const hiSet = resolveHighlightIndices(opt.highlight, seriesList, totals, fallbackRule);
    const defaults = ['line', 'radar', 'bump'].includes(safeType)
      ? seriesList.map((_, i) => (hiSet.has(i) ? resolvedTheme.accent : resolvedTheme.neutralStrong))
      : defaultCategoricalSwatches(resolvedTheme, seriesList.length, hiSet);

    return attachTargetMetadata(seriesList.map((name, i) => ({
      id: name,
      label: name,
      kind: 'series',
      defaultColor: defaults[i] || resolvedTheme.neutral,
      customColor: itemColors[name] || '',
      effectiveColor: itemColors[name] || defaults[i] || resolvedTheme.neutral,
      highlighted: hiSet.has(i),
    })), 'series');
  }

  // Group-based distribution charts (`ridgeline`, `box`, `beeswarm` with group)
  const groupCol = typeof enc.group === 'string' ? enc.group : null;
  if (['ridgeline', 'box', 'beeswarm'].includes(safeType) && groupCol) {
    const groups = uniqueStrings(safeRows.map(r => r?.[groupCol]));
    const valCol = typeof enc.value === 'string' ? enc.value : (typeof enc.y === 'string' ? enc.y : 'value');
    const groupVals = groups.map(g => {
      const nums = safeRows
        .filter(r => String(r?.[groupCol] ?? '') === g)
        .map(r => Number(r?.[valCol]))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      return nums.length ? nums[Math.floor(nums.length / 2)] : 0;
    });
    const hiSet = resolveHighlightIndices(opt.highlight, groups, groupVals, 'max');
    return attachTargetMetadata(groups.map((name, i) => {
      const defColor = hiSet.has(i) ? resolvedTheme.accent : resolvedTheme.neutralStrong;
      return {
        id: name,
        label: name,
        kind: 'group',
        defaultColor: defColor,
        customColor: itemColors[name] || '',
        effectiveColor: itemColors[name] || defColor,
        highlighted: hiSet.has(i),
      };
    }), 'group');
  }

  // Flow charts (`sankey`, `chord`) -> unique nodes
  if (safeType === 'sankey' || safeType === 'chord') {
    const srcCol = typeof enc.source === 'string' ? enc.source : (typeof enc.from === 'string' ? enc.from : 'source');
    const tgtCol = typeof enc.target === 'string' ? enc.target : (typeof enc.to === 'string' ? enc.to : 'target');
    const valCol = typeof enc.value === 'string' ? enc.value : 'value';
    const nodes = uniqueStrings(safeRows.flatMap(r => [r?.[srcCol], r?.[tgtCol]]));
    const totals = nodes.map(n => safeRows.reduce((acc, r) => (
      String(r?.[srcCol] ?? '') === n || String(r?.[tgtCol] ?? '') === n
        ? acc + (Number(r?.[valCol]) || 0)
        : acc
    ), 0));
    const hiSet = resolveHighlightIndices(opt.highlight, nodes, totals, 'max');
    return attachTargetMetadata(nodes.map((name, i) => {
      const defColor = hiSet.has(i) ? resolvedTheme.accent : resolvedTheme.ink;
      return {
        id: name,
        label: name,
        kind: 'node',
        defaultColor: defColor,
        customColor: itemColors[name] || '',
        effectiveColor: itemColors[name] || defColor,
        highlighted: hiSet.has(i),
      };
    }), 'node');
  }

  // Hierarchy charts (`treemap`, `sunburst`)
  if (safeType === 'treemap' || safeType === 'sunburst') {
    const labelCol = typeof enc.label === 'string' ? enc.label : 'label';
    const parentCol = typeof enc.group === 'string' ? enc.group : (typeof enc.parent === 'string' ? enc.parent : null);
    const valCol = typeof enc.value === 'string' ? enc.value : 'value';
    const items = [];
    const vals = [];
    for (const r of safeRows) {
      const lbl = String(r?.[labelCol] ?? '').trim();
      if (!lbl) continue;
      const par = parentCol ? String(r?.[parentCol] ?? '').trim() : '';
      items.push({ id: lbl, label: par ? `${par} · ${lbl}` : lbl, group: par });
      vals.push(Number(r?.[valCol]) || 0);
    }
    const labels = items.map(it => it.id);
    const hiSet = resolveHighlightIndices(opt.highlight, labels, vals, 'max');
    return attachTargetMetadata(items.map((it, i) => {
      const custom = itemColors[it.id] || (it.group ? itemColors[it.group] : '') || '';
      const defColor = hiSet.has(i) ? resolvedTheme.accent : resolvedTheme.neutral;
      return {
        id: it.id,
        label: it.label,
        kind: 'item',
        defaultColor: defColor,
        customColor: custom,
        effectiveColor: custom || defColor,
        highlighted: hiSet.has(i),
      };
    }), 'hierarchy');
  }

  // Standard category / item charts (`bar` single-series, `pie`, `donut`, `waffle`, `funnel`, `pareto`, `waterfall`, `radialBar`, `bullet`, `slope`, `dumbbell`, `lollipop`, `segmented`, `parallel`, `bubble`, `scatter`, etc.)
  const labelKey =
    enc.label
    || enc.x
    || enc.stage
    || enc.category
    || enc.item
    || (safeRows[0] ? Object.keys(safeRows[0]).find(k => typeof safeRows[0][k] === 'string') : 'label')
    || 'label';
  const valueKey =
    (typeof enc.y === 'string' ? enc.y : (Array.isArray(enc.y) ? enc.y[0] : null))
    || enc.value
    || enc.end
    || enc.after
    || enc.size
    || (safeRows[0] ? Object.keys(safeRows[0]).find(k => typeof safeRows[0][k] === 'number') : 'value')
    || 'value';

  const labels = [];
  const values = [];
  for (let i = 0; i < safeRows.length; i++) {
    const row = safeRows[i];
    const lbl = String(row?.[labelKey] ?? `${i + 1}`).trim();
    if (!lbl) continue;
    labels.push(lbl);
    values.push(Number(row?.[valueKey]) || 0);
  }

  const uniqueLabels = uniqueStrings(labels);
  const displayLabels = uniqueLabels.slice(0, 24);
  const displayValues = displayLabels.map(lbl => {
    const idx = labels.indexOf(lbl);
    return idx >= 0 ? values[idx] : 0;
  });

  const fallbackRule =
    safeType === 'waffle' || safeType === 'parallel'
      ? 'first'
      : safeType === 'bullet'
        ? 'min'
        : 'max';
  const hiSet = resolveHighlightIndices(opt.highlight, displayLabels, displayValues, fallbackRule);
  const categoricalCharts = new Set(['pie', 'donut', 'waffle', 'segmented']);
  const defaults = categoricalCharts.has(safeType)
    ? defaultCategoricalSwatches(resolvedTheme, displayLabels.length, hiSet)
    : displayLabels.map((_, i) => (hiSet.has(i) ? resolvedTheme.accent : resolvedTheme.neutral));

  return attachTargetMetadata(displayLabels.map((lbl, i) => ({
    id: lbl,
    label: lbl,
    kind: 'item',
    defaultColor: defaults[i] || resolvedTheme.neutral,
    customColor: itemColors[lbl] || '',
    effectiveColor: itemColors[lbl] || defaults[i] || resolvedTheme.neutral,
    highlighted: hiSet.has(i),
  })), 'category');
}

/**
 * Resolves a custom `#rrggbb` color for an SVG element given its `data-ztd-key` or `data-k`.
 */
export function resolveColorForZtdKey(
  chartType,
  ztdKey,
  dataK,
  isMark,
  itemColors = {},
  dataTargets = [],
  rows = [],
  encoding = {},
) {
  if (!isPlainRecord(itemColors) || Object.keys(itemColors).length === 0) return null;
  const targetList = Array.isArray(dataTargets) ? dataTargets : (dataTargets?.items ?? []);

  // Waffle cell `data-k` index
  if (dataK !== undefined && dataK !== null && dataK !== '') {
    const kIdx = Number(dataK);
    if (Number.isFinite(kIdx) && kIdx >= 0 && targetList[kIdx]) {
      const c = itemColors[targetList[kIdx].id ?? targetList[kIdx].key];
      if (isValidHexColor(c)) return c;
    }
  }

  const key = String(ztdKey ?? '').trim();
  if (!key) return null;

  if (isValidHexColor(itemColors[key])) {
    return itemColors[key];
  }

  // `bar` and `marimekko`: `${cat}|${series}`
  if (key.includes('|')) {
    const [cat, series] = key.split('|');
    if (series && isValidHexColor(itemColors[series])) return itemColors[series];
    if (cat && isValidHexColor(itemColors[cat])) return itemColors[cat];
    return null;
  }

  // `bubble` and `scatter`: `b${rowIndex}:${label}`
  const bubbleMatch = key.match(/^b(\d+):(.*)$/);
  if (bubbleMatch) {
    const rowIdx = Number(bubbleMatch[1]);
    const lbl = bubbleMatch[2];
    if (lbl && isValidHexColor(itemColors[lbl])) return itemColors[lbl];
    const seriesCol = typeof encoding?.series === 'string' ? encoding.series : null;
    if (seriesCol && rows[rowIdx]) {
      const sVal = String(rows[rowIdx][seriesCol] ?? '');
      if (sVal && isValidHexColor(itemColors[sVal])) return itemColors[sVal];
    }
    return null;
  }

  // `treemap` (`t:group/label`) and `sunburst` (`a:parent/label`)
  if (key.startsWith('t:') || key.startsWith('a:')) {
    const body = key.slice(2);
    if (isValidHexColor(itemColors[body])) return itemColors[body];
    if (body.includes('/')) {
      const [parent, leaf] = body.split('/');
      if (leaf && isValidHexColor(itemColors[leaf])) return itemColors[leaf];
      if (parent && isValidHexColor(itemColors[parent])) return itemColors[parent];
    }
    return null;
  }

  // `sankey` node (`n:name`) or link (`l:source>target`)
  if (key.startsWith('n:')) {
    const nodeName = key.slice(2);
    return isValidHexColor(itemColors[nodeName]) ? itemColors[nodeName] : null;
  }
  if (key.startsWith('l:') && key.includes('>')) {
    const linkBody = key.slice(2);
    if (isValidHexColor(itemColors[linkBody])) return itemColors[linkBody];
    const [src, tgt] = linkBody.split('>');
    if (src && isValidHexColor(itemColors[src])) return itemColors[src];
    if (tgt && isValidHexColor(itemColors[tgt])) return itemColors[tgt];
    return null;
  }

  // `parallel` (`p:rowIndex`)
  if (key.startsWith('p:')) {
    const idx = Number(key.slice(2));
    if (Number.isFinite(idx) && targetList[idx]) {
      const c = itemColors[targetList[idx].id ?? targetList[idx].key];
      if (isValidHexColor(c)) return c;
    }
    return null;
  }

  // Standard prefixes `s:`, `r:`, `b:`, `w:`, `d:`, `l:`
  const prefixMatch = key.match(/^[srbwdl]:(.*)$/);
  if (prefixMatch) {
    const name = prefixMatch[1];
    if (name && isValidHexColor(itemColors[name])) return itemColors[name];
    return null;
  }

  // `segmented` inline legend `l0`, `l1`, ...
  if (chartType === 'segmented' && /^l(\d+)$/.test(key)) {
    const idx = Number(key.slice(1));
    if (Number.isFinite(idx) && targetList[idx]) {
      const c = itemColors[targetList[idx].id ?? targetList[idx].key];
      if (isValidHexColor(c)) return c;
    }
    return null;
  }

  // `beeswarm` (`b0`, `b1`, ...)
  if (chartType === 'beeswarm' && /^b(\d+)$/.test(key)) {
    const rowIdx = Number(key.slice(1));
    const groupCol = typeof encoding?.group === 'string' ? encoding.group : 'group';
    const labelCol = typeof encoding?.label === 'string' ? encoding.label : 'label';
    const row = rows[rowIdx];
    if (row) {
      const gVal = String(row[groupCol] ?? '');
      const lVal = String(row[labelCol] ?? '');
      if (gVal && isValidHexColor(itemColors[gVal])) return itemColors[gVal];
      if (lVal && isValidHexColor(itemColors[lVal])) return itemColors[lVal];
    }
    return null;
  }

  // Numeric keys (`funnel` marks, `donut` inline legend, `chord` groups, `skyline` legend)
  if (/^\d+$/.test(key)) {
    const idx = Number(key);
    if (
      (chartType === 'funnel' && isMark)
      || (chartType === 'donut' && !isMark)
      || (chartType === 'chord' && !isMark)
      || (chartType === 'skyline' && !isMark)
    ) {
      const target = targetList[idx];
      const targetKey = target?.id ?? target?.key;
      if (targetKey && isValidHexColor(itemColors[targetKey])) {
        return itemColors[targetKey];
      }
    }
  }

  return null;
}

/**
 * Resolves canonical aspect props into a validated `ztd-charts` ChartSpec and metadata.
 */
export function resolveChartSpec(rawProps = {}) {
  const chartType = normalizeChartType(rawProps.chartType);
  const lang = normalizeLang(rawProps.locale);
  const localeTag = normalizeLocaleTag(rawProps.locale);
  const themeName = rawProps.theme === 'dark' ? 'dark' : 'light';
  const variant = rawProps.variant === 'bare' ? 'bare' : 'card';
  const legendMode = ['auto', 'true', 'false'].includes(rawProps.legendMode) ? rawProps.legendMode : 'auto';
  const accentColor = isValidHexColor(rawProps.accentColor)
    ? rawProps.accentColor.trim()
    : CHART_DEFAULTS.accentColor;

  const def = getLocalizedChartDef(chartType, lang);
  const example = def.example;

  const customRows = cloneJsonRows(rawProps.data);
  const customEncoding = isPlainRecord(rawProps.encoding) ? { ...rawProps.encoding } : {};
  const customOptions = isPlainRecord(rawProps.options) ? { ...rawProps.options } : {};
  const textOverrides = isPlainRecord(customOptions.textOverrides) ? { ...customOptions.textOverrides } : {};
  const itemColors = sanitizeItemColors(customOptions.itemColors);

  const backgroundColor = resolveBackgroundColor(rawProps.backgroundColor)
    || resolveBackgroundColor(customOptions.backgroundColor);
  // Theme tokens stay opaque. `transparent` only clears the card shell; inner marks
  // still stroke and halo with the theme panel color.
  const themeBackground = backgroundColor === 'transparent' ? '' : backgroundColor;
  const neutralColor = isValidHexColor(customOptions.neutralColor)
    ? customOptions.neutralColor.trim()
    : '';

  const cornerRadius = resolveCornerRadius(rawProps.cornerRadius);
  const resolvedTheme = {
    ...resolveChartTheme(themeName, accentColor, themeBackground, neutralColor),
    radius: cornerRadius,
  };

  let effectiveRows = example.data;
  let effectiveEncoding = { ...(example.encoding ?? {}) };
  let effectiveOptions = { ...(example.options ?? {}), ...customOptions, locale: localeTag };
  if (customOptions.highlight === 'auto') {
    delete effectiveOptions.highlight;
  }
  if (chartType === 'candlestick') {
    if (isValidHexColor(itemColors.up) && !isValidHexColor(effectiveOptions.upColor)) {
      effectiveOptions.upColor = itemColors.up;
    }
    if (isValidHexColor(itemColors.down) && !isValidHexColor(effectiveOptions.downColor)) {
      effectiveOptions.downColor = itemColors.down;
    }
  }
  let usingSampleData = true;

  if (customRows.length > 0) {
    const candidateDirect = {
      type: chartType,
      data: customRows,
      encoding: Object.keys(customEncoding).length > 0 ? customEncoding : effectiveEncoding,
      options: effectiveOptions,
    };
    const checkDirect = validateSpec(candidateDirect, { lang });
    if (checkDirect.valid) {
      effectiveRows = customRows;
      effectiveEncoding = candidateDirect.encoding;
      usingSampleData = false;
    } else {
      const adaptedEncoding = adaptEncodingForType(chartType, customRows, customEncoding, lang);
      if (adaptedEncoding) {
        const candidateAdapted = {
          type: chartType,
          data: customRows,
          encoding: adaptedEncoding,
          options: effectiveOptions,
        };
        if (validateSpec(candidateAdapted, { lang }).valid) {
          effectiveRows = customRows;
          effectiveEncoding = adaptedEncoding;
          usingSampleData = false;
        }
      }
    }
  }

  const dataTargets = extractChartDataTargets(
    chartType,
    effectiveRows,
    effectiveEncoding,
    effectiveOptions,
    resolvedTheme,
    localeTag,
  );

  // If gauge or sparkline has a single target with a custom color, reflect it in resolvedTheme
  const singleTargetCustomColor =
    (chartType === 'gauge' || chartType === 'sparkline') && dataTargets[0]?.customColor
      ? dataTargets[0].customColor
      : '';
  const finalTheme = singleTargetCustomColor
    ? { ...resolveChartTheme(themeName, singleTargetCustomColor, themeBackground, neutralColor), radius: cornerRadius }
    : resolvedTheme;

  const title = textOverrides['field:title'] !== undefined
    ? String(textOverrides['field:title'])
    : typeof rawProps.title === 'string' && rawProps.title.length > 0
      ? rawProps.title
      : (example.card?.title ?? def.name ?? chartType);
  const subtitle = textOverrides['field:subtitle'] !== undefined
    ? String(textOverrides['field:subtitle'])
    : typeof rawProps.subtitle === 'string' && rawProps.subtitle.length > 0
      ? rawProps.subtitle
      : (example.card?.subtitle ?? '');
  // Card chrome is title and subtitle only. Sample cards ship a catalog number,
  // difficulty level, and takeaway; none of those are shown unless the user set them.
  const takeaway = textOverrides['field:takeaway'] !== undefined
    ? String(textOverrides['field:takeaway'])
    : typeof rawProps.takeaway === 'string'
      ? rawProps.takeaway
      : '';
  const cardNumber = textOverrides['field:cardNumber'] !== undefined
    ? String(textOverrides['field:cardNumber'])
    : customOptions.cardNumber !== undefined
      ? String(customOptions.cardNumber)
      : '';
  const cardLevel = textOverrides['field:cardLevel'] !== undefined
    ? String(textOverrides['field:cardLevel'])
    : customOptions.cardLevel !== undefined
      ? String(customOptions.cardLevel)
      : '';

  const baseSpecForLegend = {
    type: chartType,
    data: effectiveRows,
    encoding: effectiveEncoding,
    options: effectiveOptions,
  };

  let legendItems = [];
  if (variant === 'card' && legendMode !== 'false') {
    try {
      const computed = autoLegend(baseSpecForLegend, effectiveRows, localeTag);
      if (Array.isArray(computed)) {
        legendItems = computed.map((item, idx) => {
          const baseLabel = String(item?.label ?? '');
          const override = textOverrides[`legend:${idx}`] ?? textOverrides[`text:${baseLabel}`];
          const customColor =
            itemColors[baseLabel]
            || (chartType === 'candlestick' && idx === 0 ? itemColors.up : '')
            || (chartType === 'candlestick' && idx === 1 ? itemColors.down : '');
          return {
            ...item,
            ...(override !== undefined ? { label: String(override) } : {}),
            ...(isValidHexColor(customColor) ? { color: customColor } : {}),
          };
        });
      }
    } catch {
      legendItems = [];
    }
  }

  const hasLegendOverrides = legendItems.some((item, idx) => (
    textOverrides[`legend:${idx}`] !== undefined
    || textOverrides[`text:${item?.label}`] !== undefined
    || isValidHexColor(item?.color)
  ));
  const cardLegend = legendMode === 'false'
    ? false
    : (hasLegendOverrides && legendItems.length > 0 ? legendItems : 'auto');

  const card = variant === 'card'
    ? {
        title,
        subtitle: subtitle || undefined,
        ...(cardNumber ? { number: cardNumber } : {}),
        ...(takeaway ? { takeaway } : {}),
        ...(cardLevel ? { level: cardLevel } : {}),
        legend: cardLegend,
        replay: false,
      }
    : undefined;

  const spec = {
    type: chartType,
    data: effectiveRows,
    encoding: effectiveEncoding,
    options: effectiveOptions,
    ...(card ? { card } : {}),
  };

  return {
    chartType,
    lang,
    localeTag,
    themeName,
    accentColor,
    backgroundColor,
    cornerRadius,
    neutralColor,
    highlight: customOptions.highlight ?? 'auto',
    itemColors,
    dataTargets,
    resolvedTheme: finalTheme,
    variant,
    legendMode,
    title,
    subtitle,
    takeaway,
    cardNumber,
    cardLevel,
    textOverrides,
    usingSampleData,
    spec,
    bareSpec: {
      type: chartType,
      data: effectiveRows,
      encoding: effectiveEncoding,
      options: effectiveOptions,
    },
    legendItems,
    def,
  };
}

export function deriveChartGeometry(props, id, view) {
  const transform = view?.getCanonical?.(id, 'core.transform') ?? { x: 0, y: 0, rotation: 0 };
  const bounds = view?.getCanonical?.(id, 'core.bounds') ?? { width: DEFAULT_CHART_WIDTH, height: DEFAULT_CHART_HEIGHT };

  const x = Number.isFinite(transform.x) ? transform.x : 0;
  const y = Number.isFinite(transform.y) ? transform.y : 0;
  const rotation = Number.isFinite(transform.rotation) ? transform.rotation : 0;
  const width = Number.isFinite(bounds.width) && bounds.width > 0
    ? Math.max(MIN_CHART_WIDTH, Math.round(bounds.width))
    : DEFAULT_CHART_WIDTH;
  const height = Number.isFinite(bounds.height) && bounds.height > 0
    ? Math.max(MIN_CHART_HEIGHT, Math.round(bounds.height))
    : DEFAULT_CHART_HEIGHT;

  return {
    x,
    y,
    width,
    height,
    rotation,
  };
}

/**
 * Parses either CSV text or JSON array/spec text into `{ rows, encoding, options, chartType }`.
 */
export function parseDataInput(input, fallbackLocale = 'ko') {
  if (Array.isArray(input)) {
    const rows = normalizeData(input);
    return { ok: rows.length > 0, rows, format: 'array' };
  }
  if (isPlainRecord(input)) {
    if (Array.isArray(input.data)) {
      const rows = normalizeData(input.data);
      return {
        ok: rows.length > 0,
        rows,
        format: 'spec',
        chartType: input.type ? normalizeChartType(input.type) : undefined,
        encoding: isPlainRecord(input.encoding) ? input.encoding : undefined,
        options: isPlainRecord(input.options) ? input.options : undefined,
        title: input.card?.title ?? input.title,
        subtitle: input.card?.subtitle ?? input.subtitle,
        takeaway: input.card?.takeaway ?? input.takeaway,
      };
    }
  }
  if (typeof input !== 'string' || !input.trim()) {
    return { ok: false, rows: [], error: '데이터 입력이 비어 있습니다.' };
  }
  const trimmed = input.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parseDataInput(parsed, fallbackLocale);
    } catch (error) {
      return {
        ok: false,
        rows: [],
        error: `JSON 파싱 오류: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  try {
    const rows = parseCSV(trimmed);
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, rows: [], error: 'CSV에서 유효한 데이터 행을 찾지 못했습니다.' };
    }
    return { ok: true, rows, format: 'csv' };
  } catch (error) {
    return {
      ok: false,
      rows: [],
      error: `CSV 파싱 오류: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function formatRowsAsCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  try {
    return toCSV(rows);
  } catch {
    return '';
  }
}

export function suggestChartsForRows(rows, locale = 'ko') {
  const lang = normalizeLang(locale);
  if (!Array.isArray(rows) || rows.length === 0) {
    return { profile: { rows: 0, columns: [] }, suggestions: [] };
  }
  try {
    const result = suggestCharts(rows, { lang });
    const catalogByType = new Map(getChartCatalog(lang).map(item => [item.type, item]));
    const suggestions = (result.suggestions ?? []).map(item => ({
      type: item.type,
      name: catalogByType.get(item.type)?.name ?? item.name ?? item.type,
      score: item.score,
      reason: item.reason,
      spec: item.spec,
    }));
    return {
      profile: result.profile ?? profileData(rows),
      suggestions,
    };
  } catch {
    return { profile: profileData(rows), suggestions: [] };
  }
}

export function createSamplePropsForType(chartType = 'bar', locale = 'ko', theme = 'light') {
  const safeType = normalizeChartType(chartType);
  const lang = normalizeLang(locale);
  const def = getLocalizedChartDef(safeType, lang);
  const ex = def.example ?? {};
  return {
    ...CHART_DEFAULTS,
    chartType: safeType,
    locale: lang,
    theme: theme === 'dark' ? 'dark' : 'light',
    title: ex.card?.title ?? def.name ?? safeType,
    subtitle: ex.card?.subtitle ?? '',
    takeaway: '',
    data: [],
    encoding: {},
    options: {},
  };
}
