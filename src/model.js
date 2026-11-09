import { autoLegend, normalizeData, parseCSV, resolveThemeInput, toCSV } from 'ztd-charts';
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
  data: [],
  encoding: {},
  options: {},
});

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

export function resolveChartTheme(theme = 'light', accentColor = '#3182f6') {
  const baseName = theme === 'dark' ? 'dark' : 'light';
  const baseTheme = resolveThemeInput(baseName);
  if (typeof accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(accentColor)) {
    return resolveThemeInput({ accent: accentColor, accentText: accentColor }, baseTheme);
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
 * Resolves canonical aspect props into a validated `ztd-charts` ChartSpec and metadata.
 */
export function resolveChartSpec(rawProps = {}) {
  const chartType = normalizeChartType(rawProps.chartType);
  const lang = normalizeLang(rawProps.locale);
  const localeTag = normalizeLocaleTag(rawProps.locale);
  const themeName = rawProps.theme === 'dark' ? 'dark' : 'light';
  const variant = rawProps.variant === 'bare' ? 'bare' : 'card';
  const legendMode = ['auto', 'true', 'false'].includes(rawProps.legendMode) ? rawProps.legendMode : 'auto';
  const accentColor = typeof rawProps.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(rawProps.accentColor)
    ? rawProps.accentColor
    : CHART_DEFAULTS.accentColor;

  const def = getLocalizedChartDef(chartType, lang);
  const example = def.example;

  const customRows = cloneJsonRows(rawProps.data);
  const customEncoding = isPlainRecord(rawProps.encoding) ? { ...rawProps.encoding } : {};
  const customOptions = isPlainRecord(rawProps.options) ? { ...rawProps.options } : {};
  const textOverrides = isPlainRecord(customOptions.textOverrides) ? { ...customOptions.textOverrides } : {};

  let effectiveRows = example.data;
  let effectiveEncoding = { ...(example.encoding ?? {}) };
  let effectiveOptions = { ...(example.options ?? {}), ...customOptions, locale: localeTag };
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
  const takeaway = textOverrides['field:takeaway'] !== undefined
    ? String(textOverrides['field:takeaway'])
    : typeof rawProps.takeaway === 'string' && rawProps.takeaway.length > 0
      ? rawProps.takeaway
      : (usingSampleData ? (example.card?.takeaway ?? '') : '');
  const cardNumber = textOverrides['field:cardNumber'] !== undefined
    ? String(textOverrides['field:cardNumber'])
    : customOptions.cardNumber !== undefined
      ? String(customOptions.cardNumber)
      : (example.card?.number !== undefined ? String(example.card.number) : '');
  const cardLevel = textOverrides['field:cardLevel'] !== undefined
    ? String(textOverrides['field:cardLevel'])
    : customOptions.cardLevel !== undefined
      ? String(customOptions.cardLevel)
      : (example.card?.level !== undefined ? String(example.card.level) : '');

  const cardLegend = legendMode === 'false' ? false : 'auto';
  const card = variant === 'card'
    ? {
        ...(example.card ?? {}),
        number: cardNumber || undefined,
        title,
        subtitle: subtitle || undefined,
        takeaway: takeaway || undefined,
        level: cardLevel ? (example.card?.level ?? '기본') : undefined,
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

  let legendItems = [];
  if (variant === 'card' && legendMode !== 'false') {
    try {
      const computed = autoLegend(spec, effectiveRows, localeTag);
      if (Array.isArray(computed)) {
        legendItems = computed.map((item, idx) => {
          const baseLabel = String(item?.label ?? '');
          const override = textOverrides[`legend:${idx}`] ?? textOverrides[`text:${baseLabel}`];
          return override !== undefined ? { ...item, label: String(override) } : item;
        });
      }
    } catch {
      legendItems = [];
    }
  }

  return {
    chartType,
    lang,
    localeTag,
    themeName,
    accentColor,
    resolvedTheme: resolveChartTheme(themeName, accentColor),
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
    takeaway: ex.card?.takeaway ?? '',
    data: [],
    encoding: {},
    options: {},
  };
}
