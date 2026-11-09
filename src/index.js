import metadata from '../extension.json' with { type: 'json' };
import { renderChartDom } from './dom-renderer.js';
import { matchTextToChartData, mergeDraft, mountInlineEditor } from './inline-editor.js';
import {
  CHART_ASPECT_ID,
  COMMAND_NAMES,
  EXTENSION_ID,
  STUDIO_PANEL_ID,
  createPackageManifest,
  settingsSchema,
} from './manifest.js';
import {
  CHART_DEFAULTS,
  CHART_FAMILIES,
  CHART_TYPES,
  DEFAULT_CHART_HEIGHT,
  DEFAULT_CHART_WIDTH,
  HIGHLIGHT_PRESETS,
  QUICK_CHART_OPTIONS,
  createSamplePropsForType,
  deriveChartGeometry,
  extractChartDataTargets,
  formatRowsAsCsv,
  getChartCatalog,
  isValidHexColor,
  normalizeChartType,
  normalizeLang,
  parseDataInput,
  resolveChartSpec,
  resolveColorForZtdKey,
  sanitizeItemColors,
  suggestChartsForRows,
} from './model.js';
import {
  COLOR_INSPECTOR_PANEL_ID,
  createColorInspectorPanelSpec,
  createStudioPanelSpec,
} from './panel.js';
import { renderChartSvg } from './svg-renderer.js';
import { planZtdChartChanges, registerZtdChartTools } from './tools.js';

const CHART_ICON = Object.freeze({
  paths: Object.freeze([
    'M3 3v14h14',
    'M7 14V9',
    'M11 14V6',
    'M15 14v-4',
  ]),
});

const COMMAND_LABELS = Object.freeze({
  'insert-chart': 'ZTD 차트 추가',
  'edit-chart': '차트 텍스트 인라인 편집',
  'set-chart-type': '차트 종류 변경',
  'update-data': '차트 데이터 업데이트',
  'update-style': '차트 색상·배경·강조 데이터 변경',
  'reset-sample-data': '샘플 데이터 복원',
  'apply-top-suggestion': '데이터 맞춤 추천 차트 적용',
  'toggle-theme': '차트 라이트/다크 테마 전환',
  'toggle-variant': '카드/단독 표시 전환',
  'toggle-locale': '한국어/영어 로케일 전환',
});

export const ztdChartAspect = Object.freeze({
  id: CHART_ASPECT_ID,
  label: 'ZTD 차트',
  summary: '36종의 zero-dependency 통계·비즈니스 데이터 시각화 차트 도형',
  layout: true,
  dependsOnCanonical: ['core.transform', 'core.bounds', CHART_ASPECT_ID],
  dependsOnComputed: [],
  defaults: CHART_DEFAULTS,
  textSearchFields: ['title', 'subtitle', 'takeaway'],
  derive: deriveChartGeometry,
  renderDom: renderChartDom,
  renderSvg: renderChartSvg,
  ui: {
    controls: [
      {
        id: 'ztd-charts.insert.shelf',
        kind: 'action',
        label: 'ZTD 차트 추가',
        icon: CHART_ICON,
        commandSymbol: `${EXTENSION_ID}:insert-chart`,
        placement: 'tool-shelf',
        requiresSelection: false,
      },
      {
        id: 'ztd-charts.type.selection',
        kind: 'segmented',
        field: 'chartType',
        label: '차트 종류',
        placement: 'selection-bar',
        options: QUICK_CHART_OPTIONS,
      },
      {
        id: 'ztd-charts.theme.selection',
        kind: 'segmented',
        field: 'theme',
        label: '테마',
        placement: 'selection-bar',
        options: [
          { label: '라이트', value: 'light' },
          { label: '다크', value: 'dark' },
        ],
      },
      {
        id: 'ztd-charts.suggest.selection',
        kind: 'action',
        label: '추천 차트 적용',
        icon: CHART_ICON,
        commandSymbol: `${EXTENSION_ID}:apply-top-suggestion`,
        placement: 'selection-bar',
        requiresSelection: true,
      },
      {
        id: 'ztd-charts.type.inspector',
        kind: 'segmented',
        field: 'chartType',
        label: '빠른 차트 전환',
        section: '차트 유형',
        placement: 'inspector',
        options: QUICK_CHART_OPTIONS,
      },
      {
        id: 'ztd-charts.title.inspector',
        kind: 'text',
        field: 'title',
        label: '제목',
        section: '차트 텍스트',
        placement: 'inspector',
      },
      {
        id: 'ztd-charts.subtitle.inspector',
        kind: 'text',
        field: 'subtitle',
        label: '부제목·단위',
        section: '차트 텍스트',
        placement: 'inspector',
      },
      {
        id: 'ztd-charts.takeaway.inspector',
        kind: 'text',
        field: 'takeaway',
        label: '핵심 요약 (Takeaway)',
        section: '차트 텍스트',
        placement: 'inspector',
      },
      {
        id: 'ztd-charts.theme.inspector',
        kind: 'segmented',
        field: 'theme',
        label: '테마',
        section: '스타일 및 표시',
        placement: 'inspector',
        options: [
          { label: '라이트', value: 'light' },
          { label: '다크', value: 'dark' },
        ],
      },
      {
        id: 'ztd-charts.variant.inspector',
        kind: 'segmented',
        field: 'variant',
        label: '표시 형태',
        section: '스타일 및 표시',
        placement: 'inspector',
        options: [
          { label: '카드형', value: 'card' },
          { label: '차트만', value: 'bare' },
        ],
      },
      {
        id: 'ztd-charts.locale.inspector',
        kind: 'segmented',
        field: 'locale',
        label: '언어',
        section: '스타일 및 표시',
        placement: 'inspector',
        options: [
          { label: '한국어', value: 'ko' },
          { label: 'English', value: 'en' },
        ],
      },
      {
        id: 'ztd-charts.legend.inspector',
        kind: 'segmented',
        field: 'legendMode',
        label: '범례 표시',
        section: '스타일 및 표시',
        placement: 'inspector',
        options: [
          { label: '자동', value: 'auto' },
          { label: '숨김', value: 'false' },
        ],
      },
      {
        id: 'ztd-charts.accent.inspector',
        kind: 'color',
        field: 'accentColor',
        label: '강조 색상',
        section: '스타일 및 표시',
        placement: 'inspector',
      },
      {
        id: 'ztd-charts.radius.inspector',
        kind: 'number',
        field: 'cornerRadius',
        label: '모서리 둥글기',
        section: '스타일 및 표시',
        placement: 'inspector',
        min: 0,
        max: 64,
        step: 1,
      },
      {
        id: 'ztd-charts.background.inspector',
        kind: 'color',
        field: 'backgroundColor',
        label: '배경 색상',
        section: '스타일 및 표시',
        placement: 'inspector',
      },
      {
        id: 'ztd-charts.suggest.inspector',
        kind: 'action',
        label: '데이터 맞춤 추천 차트 적용',
        icon: CHART_ICON,
        commandSymbol: `${EXTENSION_ID}:apply-top-suggestion`,
        section: '데이터 도구',
        placement: 'inspector',
        requiresSelection: true,
      },
      {
        id: 'ztd-charts.reset.inspector',
        kind: 'action',
        label: '내장 샘플 데이터로 복원',
        commandSymbol: `${EXTENSION_ID}:reset-sample-data`,
        section: '데이터 도구',
        placement: 'inspector',
        requiresSelection: true,
      },
    ],
    panels: [createColorInspectorPanelSpec(), createStudioPanelSpec()],
  },
});

function getActiveSurface(context) {
  return context?.services?.get?.('canvas.active-tool-surface')?.get?.() ?? null;
}

function getSelectedChartIds(context, explicitEntityId) {
  if (typeof explicitEntityId === 'string' && explicitEntityId) {
    return context.world.getCanonical?.(explicitEntityId, CHART_ASPECT_ID) ? [explicitEntityId] : [];
  }
  const surface = getActiveSurface(context);
  const selected = surface?.selection?.getSelection?.() ?? [];
  return selected.filter(id => Boolean(context.world.getCanonical?.(id, CHART_ASPECT_ID)));
}

function withHistoryGroup(context, fn) {
  const history = getActiveSurface(context)?.host?.history;
  history?.begin?.();
  try {
    const result = fn();
    history?.commit?.();
    return result;
  } catch (error) {
    history?.abort?.();
    throw error;
  }
}

function readPreference(context, key, fallback) {
  try {
    const prefService = context?.services?.get?.('extensions.preferences');
    const val = prefService?.get?.(key);
    return val !== undefined ? val : fallback;
  } catch {
    return fallback;
  }
}

function countExistingCharts(world) {
  let count = 0;
  for (const id of world?.listEntityIds?.() ?? []) {
    if (world.isAlive && !world.isAlive(id)) continue;
    if (world.getCanonical?.(id, CHART_ASPECT_ID)) count++;
  }
  return count;
}

const plugin = {
  ...createPackageManifest(metadata),
  summary: metadata.summary,
  aspects: [ztdChartAspect],
  ui: {
    panels: [createStudioPanelSpec()],
  },
  activate(context) {
    const disposers = [];
    const editor = mountInlineEditor(context);
    disposers.push(() => editor.dispose());

    const editChart = (rawArgs = {}) => {
      const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};
      const targetIds = getSelectedChartIds(context, args.entityId);
      if (targetIds.length === 0) return null;
      const field = typeof args.field === 'string' && args.field ? args.field : 'title';
      editor.open(targetIds[0], field);
      return targetIds[0];
    };

    const insertChart = (rawArgs = {}) => {
      const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};
      const chartType = normalizeChartType(args.chartType ?? 'bar');
      const locale = normalizeLang(args.locale ?? readPreference(context, 'defaultLocale', 'ko'));
      const theme = (args.theme ?? readPreference(context, 'defaultTheme', 'light')) === 'dark' ? 'dark' : 'light';
      const variant = (args.variant ?? readPreference(context, 'defaultVariant', 'card')) === 'bare' ? 'bare' : 'card';

      const existingCount = countExistingCharts(context.world);
      const hasExplicitX = Number.isFinite(args.x);
      const hasExplicitY = Number.isFinite(args.y);
      const x = hasExplicitX ? args.x : 80 + (existingCount % 4) * 36;
      const y = hasExplicitY ? args.y : 80 + (existingCount % 4) * 36;
      const width = Number.isFinite(args.width) && args.width > 0 ? Math.round(args.width) : DEFAULT_CHART_WIDTH;
      const height = Number.isFinite(args.height) && args.height > 0 ? Math.round(args.height) : DEFAULT_CHART_HEIGHT;

      const sampleProps = createSamplePropsForType(chartType, locale, theme);
      const initialOptions = {
        ...(sampleProps.options ?? {}),
        ...(args.options && typeof args.options === 'object' ? args.options : {}),
        ...(args.highlight !== undefined ? { highlight: args.highlight } : {}),
        ...(isValidHexColor(args.neutralColor) ? { neutralColor: args.neutralColor.trim() } : {}),
        ...(args.itemColors && typeof args.itemColors === 'object' ? { itemColors: sanitizeItemColors(args.itemColors) } : {}),
      };
      const chartProps = {
        ...sampleProps,
        variant,
        ...(typeof args.title === 'string' ? { title: args.title } : {}),
        ...(typeof args.subtitle === 'string' ? { subtitle: args.subtitle } : {}),
        ...(typeof args.takeaway === 'string' ? { takeaway: args.takeaway } : {}),
        ...(isValidHexColor(args.accentColor) ? { accentColor: args.accentColor.trim() } : {}),
        ...(isValidHexColor(args.backgroundColor) ? { backgroundColor: args.backgroundColor.trim() } : {}),
        ...(Array.isArray(args.data) ? { data: args.data } : {}),
        ...(args.encoding && typeof args.encoding === 'object' ? { encoding: args.encoding } : {}),
        ...(Object.keys(initialOptions).length > 0 ? { options: initialOptions } : {}),
      };

      const creation = context?.services?.get?.('canvas.creation');
      if (creation && typeof creation.create === 'function') {
        return creation.create({
          caller: `${EXTENSION_ID}:insert-chart`,
          ...(hasExplicitX ? { x } : {}),
          ...(hasExplicitY ? { y } : {}),
          width,
          height,
          aspects: {
            [CHART_ASPECT_ID]: chartProps,
          },
        });
      }

      const id = typeof args.id === 'string' && args.id ? args.id : `ztd-chart-${crypto.randomUUID()}`;
      withHistoryGroup(context, () => {
        context.world.applyCanonicalTransaction(`${EXTENSION_ID}:insert-chart`, [
          { id, aspect: 'core.transform', patch: { x, y, rotation: 0 } },
          { id, aspect: 'core.bounds', patch: { width, height } },
          { id, aspect: CHART_ASPECT_ID, patch: chartProps },
        ]);
      });
      getActiveSurface(context)?.selection?.select?.(id);
      return id;
    };

    const setChartType = (rawArgs = {}) => {
      const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};
      const targetIds = getSelectedChartIds(context, args.entityId);
      if (targetIds.length === 0) return null;
      const nextType = normalizeChartType(args.chartType);
      const ops = [];
      for (const id of targetIds) {
        const current = context.world.getCanonical(id, CHART_ASPECT_ID);
        if (!current) continue;
        const patch = {
          chartType: nextType,
          ...(args.encoding && typeof args.encoding === 'object' ? { encoding: args.encoding } : {}),
        };
        if (!Array.isArray(current.data) || current.data.length === 0) {
          const sample = createSamplePropsForType(nextType, current.locale, current.theme);
          patch.title = sample.title;
          patch.subtitle = sample.subtitle;
          patch.takeaway = '';
        }
        ops.push({ id, aspect: CHART_ASPECT_ID, patch });
      }
      if (ops.length > 0) {
        withHistoryGroup(context, () => {
          context.world.applyCanonicalTransaction(`${EXTENSION_ID}:set-chart-type`, ops);
        });
      }
      return targetIds;
    };

    const updateData = (rawArgs = {}) => {
      const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};
      const targetIds = getSelectedChartIds(context, args.entityId);
      if (targetIds.length === 0) return null;
      const parsed = parseDataInput(args.rows ?? args.data ?? '');
      if (!parsed.ok) return null;

      const ops = [];
      for (const id of targetIds) {
        const current = context.world.getCanonical(id, CHART_ASPECT_ID);
        if (!current) continue;
        const nextChartType = args.chartType ? normalizeChartType(args.chartType) : current.chartType;
        const suggested = suggestChartsForRows(parsed.rows, current.locale).suggestions;
        const matchingSuggestion = suggested.find(s => s.type === nextChartType) ?? suggested[0];
        const nextEncoding = args.encoding
          ?? parsed.encoding
          ?? matchingSuggestion?.spec?.encoding
          ?? current.encoding
          ?? {};
        ops.push({
          id,
          aspect: CHART_ASPECT_ID,
          patch: {
            chartType: nextChartType,
            data: parsed.rows,
            encoding: nextEncoding,
            ...(args.options || parsed.options ? { options: { ...(current.options ?? {}), ...(parsed.options ?? {}), ...(args.options ?? {}) } } : {}),
          },
        });
      }
      if (ops.length > 0) {
        withHistoryGroup(context, () => {
          context.world.applyCanonicalTransaction(`${EXTENSION_ID}:update-data`, ops);
        });
      }
      return targetIds;
    };

    const updateStyle = (rawArgs = {}) => {
      const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};
      const targetIds = getSelectedChartIds(context, args.entityId);
      if (targetIds.length === 0) return null;

      const ops = [];
      for (const id of targetIds) {
        const current = context.world.getCanonical(id, CHART_ASPECT_ID);
        if (!current) continue;
        const nextOptions = { ...(current.options ?? {}) };
        let optionsChanged = false;

        if (args.options && typeof args.options === 'object' && !Array.isArray(args.options)) {
          for (const [k, v] of Object.entries(args.options)) {
            if (v === undefined || v === null) {
              delete nextOptions[k];
            } else {
              nextOptions[k] = v;
            }
          }
          optionsChanged = true;
        }
        if ('highlight' in args) {
          if (args.highlight === undefined || args.highlight === null || args.highlight === 'auto') {
            delete nextOptions.highlight;
          } else {
            nextOptions.highlight = args.highlight;
          }
          optionsChanged = true;
        }
        if ('neutralColor' in args) {
          if (!args.neutralColor) {
            delete nextOptions.neutralColor;
          } else if (isValidHexColor(args.neutralColor)) {
            nextOptions.neutralColor = args.neutralColor.trim();
          }
          optionsChanged = true;
        }
        if ('itemColors' in args) {
          if (!args.itemColors || (typeof args.itemColors === 'object' && Object.keys(args.itemColors).length === 0 && args.replaceItemColors)) {
            delete nextOptions.itemColors;
          } else if (typeof args.itemColors === 'object' && !Array.isArray(args.itemColors)) {
            const mergedColors = args.replaceItemColors
              ? {}
              : { ...(nextOptions.itemColors ?? {}) };
            for (const [k, v] of Object.entries(args.itemColors)) {
              const keyStr = String(k ?? '').trim();
              if (!keyStr) continue;
              if (!v) {
                delete mergedColors[keyStr];
              } else if (isValidHexColor(v)) {
                mergedColors[keyStr] = v.trim();
              }
            }
            if (Object.keys(mergedColors).length > 0) {
              nextOptions.itemColors = mergedColors;
            } else {
              delete nextOptions.itemColors;
            }
          }
          optionsChanged = true;
        }

        const patch = {};
        if (typeof args.theme === 'string' && (args.theme === 'light' || args.theme === 'dark')) {
          patch.theme = args.theme;
        }
        if ('accentColor' in args && isValidHexColor(args.accentColor)) {
          patch.accentColor = args.accentColor.trim();
        }
        if ('backgroundColor' in args) {
          patch.backgroundColor = isValidHexColor(args.backgroundColor)
            ? args.backgroundColor.trim()
            : '';
        }
        if (optionsChanged) {
          patch.options = nextOptions;
        }
        if (Object.keys(patch).length > 0) {
          ops.push({ id, aspect: CHART_ASPECT_ID, patch });
        }
      }

      if (ops.length > 0) {
        withHistoryGroup(context, () => {
          context.world.applyCanonicalTransaction(`${EXTENSION_ID}:update-style`, ops);
        });
      }
      return targetIds;
    };

    const resetSampleData = (rawArgs = {}) => {
      const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};
      const targetIds = getSelectedChartIds(context, args.entityId);
      if (targetIds.length === 0) return null;
      const ops = [];
      for (const id of targetIds) {
        const current = context.world.getCanonical(id, CHART_ASPECT_ID);
        if (!current) continue;
        const sample = createSamplePropsForType(current.chartType, current.locale, current.theme);
        ops.push({
          id,
          aspect: CHART_ASPECT_ID,
          patch: {
            title: sample.title,
            subtitle: sample.subtitle,
            takeaway: '',
            data: [],
            encoding: {},
            options: {},
          },
        });
      }
      if (ops.length > 0) {
        withHistoryGroup(context, () => {
          context.world.applyCanonicalTransaction(`${EXTENSION_ID}:reset-sample-data`, ops);
        });
      }
      return targetIds;
    };

    const applyTopSuggestion = (rawArgs = {}) => {
      const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};
      const targetIds = getSelectedChartIds(context, args.entityId);
      if (targetIds.length === 0) return null;
      const ops = [];
      for (const id of targetIds) {
        const current = context.world.getCanonical(id, CHART_ASPECT_ID);
        if (!current) continue;
        const resolved = resolveChartSpec(current);
        const suggestions = suggestChartsForRows(resolved.spec.data, resolved.lang).suggestions;
        const nextChoice = suggestions.find(s => s.type !== resolved.chartType) ?? suggestions[0];
        if (!nextChoice) continue;
        ops.push({
          id,
          aspect: CHART_ASPECT_ID,
          patch: {
            chartType: nextChoice.type,
            data: resolved.spec.data,
            encoding: nextChoice.spec?.encoding ?? {},
          },
        });
      }
      if (ops.length > 0) {
        withHistoryGroup(context, () => {
          context.world.applyCanonicalTransaction(`${EXTENSION_ID}:apply-top-suggestion`, ops);
        });
      }
      return targetIds;
    };

    const toggleField = (field, values, rawArgs = {}) => {
      const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};
      const targetIds = getSelectedChartIds(context, args.entityId);
      if (targetIds.length === 0) return null;
      const ops = [];
      for (const id of targetIds) {
        const current = context.world.getCanonical(id, CHART_ASPECT_ID);
        if (!current) continue;
        const idx = values.indexOf(current[field]);
        const nextVal = values[(idx + 1) % values.length];
        ops.push({ id, aspect: CHART_ASPECT_ID, patch: { [field]: nextVal } });
      }
      if (ops.length > 0) {
        withHistoryGroup(context, () => {
          context.world.applyCanonicalTransaction(`${EXTENSION_ID}:toggle-${field}`, ops);
        });
      }
      return targetIds;
    };

    const runCommand = (name, rawArgs = {}) => {
      const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};
      switch (name) {
        case 'insert-chart':
          return insertChart(args);
        case 'edit-chart':
          return editChart(args);
        case 'set-chart-type':
          return setChartType(args);
        case 'update-data':
          return updateData(args);
        case 'update-style':
          return updateStyle(args);
        case 'reset-sample-data':
          return resetSampleData(args);
        case 'apply-top-suggestion':
          return applyTopSuggestion(args);
        case 'toggle-theme':
          return toggleField('theme', ['light', 'dark'], args);
        case 'toggle-variant':
          return toggleField('variant', ['card', 'bare'], args);
        case 'toggle-locale':
          return toggleField('locale', ['ko', 'en'], args);
        default:
          if (CHART_TYPES.includes(name)) {
            return insertChart({ ...args, chartType: name });
          }
          return null;
      }
    };

    try {
      disposers.push(registerZtdChartTools(context));
      for (const name of COMMAND_NAMES) {
        const off = context.commands?.register?.({
          id: `${EXTENSION_ID}:${name}`,
          title: COMMAND_LABELS[name] ?? name,
          summary: COMMAND_LABELS[name] ?? name,
          shortcutScope: 'canvas',
          ...(name === 'edit-chart'
            ? {
                shortcutSelectionAspect: CHART_ASPECT_ID,
                keys: ['Enter'],
              }
            : {}),
          run: args => runCommand(name, args),
        });
        if (typeof off === 'function') disposers.push(off);
      }
    } catch (error) {
      for (const dispose of disposers.reverse()) {
        try {
          dispose();
        } catch {
          // Ignore cleanup failure
        }
      }
      throw error;
    }

    return {
      api: Object.freeze({
        run: runCommand,
        insertChart,
        editChart,
        setChartType,
        updateData,
        updateStyle,
        resetSampleData,
        applyTopSuggestion,
        editor,
      }),
      dispose() {
        for (const dispose of disposers.splice(0).reverse()) {
          try {
            dispose();
          } catch {
            // Ignore cleanup failure
          }
        }
      },
    };
  },
};

export default plugin;
export {
  CHART_ASPECT_ID,
  CHART_DEFAULTS,
  CHART_FAMILIES,
  CHART_TYPES,
  COLOR_INSPECTOR_PANEL_ID,
  COMMAND_NAMES,
  EXTENSION_ID,
  HIGHLIGHT_PRESETS,
  STUDIO_PANEL_ID,
  createPackageManifest,
  createSamplePropsForType,
  deriveChartGeometry,
  extractChartDataTargets,
  formatRowsAsCsv,
  getChartCatalog,
  matchTextToChartData,
  mergeDraft,
  mountInlineEditor,
  parseDataInput,
  planZtdChartChanges,
  registerZtdChartTools,
  renderChartDom,
  renderChartSvg,
  resolveChartSpec,
  resolveColorForZtdKey,
  sanitizeItemColors,
  settingsSchema,
  suggestChartsForRows,
};
