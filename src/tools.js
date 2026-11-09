import { CHART_ASPECT_ID, EXTENSION_ID } from './manifest.js';
import {
  CHART_DEFAULTS,
  CHART_FAMILIES,
  CHART_TYPES,
  CHART_TYPE_SET,
  DEFAULT_CHART_HEIGHT,
  DEFAULT_CHART_WIDTH,
  MIN_CHART_HEIGHT,
  MIN_CHART_WIDTH,
  getChartCatalog,
  isValidHexColor,
  normalizeChartType,
  normalizeLang,
  parseDataInput,
  resolveBackgroundColor,
  resolveChartSpec,
  resolveCornerRadius,
  sanitizeItemColors,
  suggestChartsForRows,
} from './model.js';

const ALLOWED_THEMES = ['light', 'dark'];
const ALLOWED_LOCALES = ['ko', 'en'];
const ALLOWED_VARIANTS = ['card', 'bare'];
const ALLOWED_LEGENDS = ['auto', 'true', 'false'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizePatch(rawPatch, existingProps = CHART_DEFAULTS) {
  if (!isPlainObject(rawPatch)) {
    throw new Error('INVALID_INPUT: patch must be a JSON object');
  }
  const clean = {};

  if (rawPatch.chartType !== undefined) {
    if (typeof rawPatch.chartType !== 'string' || !CHART_TYPE_SET.has(rawPatch.chartType)) {
      throw new Error(`INVALID_INPUT: unsupported chartType "${String(rawPatch.chartType)}"`);
    }
    clean.chartType = rawPatch.chartType;
  }
  for (const textField of ['title', 'subtitle', 'takeaway']) {
    if (rawPatch[textField] !== undefined) {
      if (typeof rawPatch[textField] !== 'string' || rawPatch[textField].length > 500) {
        throw new Error(`INVALID_INPUT: ${textField} must be a string <= 500 chars`);
      }
      clean[textField] = rawPatch[textField];
    }
  }
  if (rawPatch.theme !== undefined) {
    if (!ALLOWED_THEMES.includes(rawPatch.theme)) {
      throw new Error('INVALID_INPUT: theme must be "light" or "dark"');
    }
    clean.theme = rawPatch.theme;
  }
  if (rawPatch.locale !== undefined) {
    if (!ALLOWED_LOCALES.includes(rawPatch.locale)) {
      throw new Error('INVALID_INPUT: locale must be "ko" or "en"');
    }
    clean.locale = rawPatch.locale;
  }
  if (rawPatch.variant !== undefined) {
    if (!ALLOWED_VARIANTS.includes(rawPatch.variant)) {
      throw new Error('INVALID_INPUT: variant must be "card" or "bare"');
    }
    clean.variant = rawPatch.variant;
  }
  if (rawPatch.legendMode !== undefined) {
    if (!ALLOWED_LEGENDS.includes(rawPatch.legendMode)) {
      throw new Error('INVALID_INPUT: legendMode must be "auto", "true", or "false"');
    }
    clean.legendMode = rawPatch.legendMode;
  }
  if (rawPatch.accentColor !== undefined) {
    if (!isValidHexColor(rawPatch.accentColor)) {
      throw new Error('INVALID_INPUT: accentColor must be a #rrggbb hex string');
    }
    clean.accentColor = rawPatch.accentColor.trim();
  }
  if (rawPatch.backgroundColor !== undefined) {
    if (rawPatch.backgroundColor === '') {
      clean.backgroundColor = '';
    } else {
      const background = resolveBackgroundColor(rawPatch.backgroundColor);
      if (!background) {
        throw new Error('INVALID_INPUT: backgroundColor must be "", "transparent", or a #rrggbb hex string');
      }
      clean.backgroundColor = background;
    }
  }
  if (rawPatch.cornerRadius !== undefined) {
    const radius = Number(rawPatch.cornerRadius);
    if (!Number.isFinite(radius) || radius < 0 || radius > 64) {
      throw new Error('INVALID_INPUT: cornerRadius must be a number from 0 to 64');
    }
    clean.cornerRadius = resolveCornerRadius(radius);
  }
  if (rawPatch.data !== undefined) {
    if (typeof rawPatch.data === 'string') {
      const parsed = parseDataInput(rawPatch.data, clean.locale ?? existingProps.locale ?? 'ko');
      if (!parsed.ok) throw new Error(`INVALID_INPUT: ${parsed.error}`);
      clean.data = parsed.rows;
    } else if (Array.isArray(rawPatch.data)) {
      if (rawPatch.data.length > 1000) throw new Error('INVALID_INPUT: data rows exceed 1000 limit');
      const parsed = parseDataInput(rawPatch.data, clean.locale ?? existingProps.locale ?? 'ko');
      clean.data = parsed.rows;
    } else {
      throw new Error('INVALID_INPUT: data must be an array of row objects or CSV/JSON string');
    }
  }
  if (rawPatch.encoding !== undefined) {
    if (!isPlainObject(rawPatch.encoding)) {
      throw new Error('INVALID_INPUT: encoding must be an object');
    }
    clean.encoding = { ...rawPatch.encoding };
  }
  if (rawPatch.options !== undefined) {
    if (!isPlainObject(rawPatch.options)) {
      throw new Error('INVALID_INPUT: options must be an object');
    }
    clean.options = { ...(existingProps.options ?? {}), ...rawPatch.options };
    if (clean.options.itemColors !== undefined) {
      clean.options.itemColors = sanitizeItemColors(clean.options.itemColors);
    }
  }
  if (rawPatch.highlight !== undefined) {
    clean.options = { ...(clean.options ?? existingProps.options ?? {}), highlight: rawPatch.highlight };
  }
  if (rawPatch.neutralColor !== undefined) {
    if (rawPatch.neutralColor !== '' && !isValidHexColor(rawPatch.neutralColor)) {
      throw new Error('INVALID_INPUT: neutralColor must be "" or a #rrggbb hex string');
    }
    const nextOpts = { ...(clean.options ?? existingProps.options ?? {}) };
    if (rawPatch.neutralColor === '') delete nextOpts.neutralColor;
    else nextOpts.neutralColor = rawPatch.neutralColor.trim();
    clean.options = nextOpts;
  }
  if (rawPatch.itemColors !== undefined) {
    if (!isPlainObject(rawPatch.itemColors)) {
      throw new Error('INVALID_INPUT: itemColors must be an object mapping data labels/keys to #rrggbb hex colors');
    }
    clean.options = {
      ...(clean.options ?? existingProps.options ?? {}),
      itemColors: sanitizeItemColors(rawPatch.itemColors),
    };
  }

  return clean;
}

/**
 * Plans a batch of chart operations into `CanonicalPatchOp[]` without mutating the world.
 */
export function planZtdChartChanges(world, actions) {
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > 50) {
    throw new Error('INVALID_INPUT: actions must be a non-empty array of at most 50 items');
  }

  const snapshot = world.exportCanonicalSnapshot?.() ?? {};
  const aliases = new Map();
  const ops = [];

  for (const action of actions) {
    if (!isPlainObject(action)) throw new Error('INVALID_INPUT: each action must be an object');
    if (action.action === 'create') {
      if (action.id !== undefined) {
        if (typeof action.id !== 'string' || !action.id.trim() || aliases.has(action.id) || Object.hasOwn(snapshot, action.id)) {
          throw new Error('INVALID_INPUT: duplicate or invalid create alias');
        }
      }
      const generatedId = `ztd-chart-${crypto.randomUUID()}`;
      aliases.set(action.id ?? generatedId, generatedId);
    }
  }

  let createSeq = 0;
  const createdIds = [...aliases.values()];
  const resolveId = rawId => aliases.get(rawId) ?? rawId;

  for (const action of actions) {
    const kind = action.action;
    if (!['create', 'update', 'move', 'delete'].includes(kind)) {
      throw new Error(`INVALID_INPUT: unsupported action "${String(kind)}"`);
    }

    const id = kind === 'create' ? createdIds[createSeq++] : resolveId(action.id);
    if (typeof id !== 'string' || !id) {
      throw new Error('INVALID_INPUT: missing target entity id');
    }

    if (kind !== 'create') {
      const alive = world.isAlive ? world.isAlive(id) : Boolean(snapshot[id]);
      const hasChart = Boolean(world.getCanonical?.(id, CHART_ASPECT_ID) ?? snapshot[id]?.[CHART_ASPECT_ID]);
      if (!alive || !hasChart) {
        throw new Error(`INVALID_INPUT: chart entity "${id}" does not exist`);
      }
    }

    if (kind === 'delete') {
      ops.push({ id, aspect: CHART_ASPECT_ID, patch: null });
      continue;
    }

    if (kind === 'move') {
      if (action.x !== undefined || action.y !== undefined) {
        const currentTransform = world.getCanonical?.(id, 'core.transform') ?? { x: 0, y: 0, rotation: 0 };
        const x = action.x !== undefined ? action.x : currentTransform.x;
        const y = action.y !== undefined ? action.y : currentTransform.y;
        if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e7 || Math.abs(y) > 1e7) {
          throw new Error('INVALID_INPUT: invalid x/y coordinates');
        }
        ops.push({ id, aspect: 'core.transform', patch: { x, y } });
      }
      if (action.width !== undefined || action.height !== undefined) {
        const currentBounds = world.getCanonical?.(id, 'core.bounds') ?? {
          width: DEFAULT_CHART_WIDTH,
          height: DEFAULT_CHART_HEIGHT,
        };
        const width = action.width !== undefined ? action.width : currentBounds.width;
        const height = action.height !== undefined ? action.height : currentBounds.height;
        if (
          !Number.isFinite(width)
          || !Number.isFinite(height)
          || width < MIN_CHART_WIDTH
          || height < MIN_CHART_HEIGHT
          || width > 4000
          || height > 4000
        ) {
          throw new Error('INVALID_INPUT: invalid width/height bounds');
        }
        ops.push({ id, aspect: 'core.bounds', patch: { width: Math.round(width), height: Math.round(height) } });
      }
      continue;
    }

    const existing = kind === 'update'
      ? (world.getCanonical?.(id, CHART_ASPECT_ID) ?? CHART_DEFAULTS)
      : CHART_DEFAULTS;
    const sanitized = sanitizePatch(action.patch ?? {}, existing);
    const merged = { ...(kind === 'create' ? CHART_DEFAULTS : existing), ...sanitized };

    // Auto-populate encoding from suggestCharts if custom data is provided without explicit encoding
    if (
      Array.isArray(merged.data)
      && merged.data.length > 0
      && (!merged.encoding || Object.keys(merged.encoding).length === 0)
    ) {
      const suggested = suggestChartsForRows(merged.data, merged.locale).suggestions;
      const match = suggested.find(s => s.type === merged.chartType) ?? suggested[0];
      if (match?.spec?.encoding) {
        merged.encoding = { ...match.spec.encoding };
      }
    }

    if (kind === 'create') {
      const x = action.x ?? 80;
      const y = action.y ?? 80;
      const width = action.width ?? DEFAULT_CHART_WIDTH;
      const height = action.height ?? DEFAULT_CHART_HEIGHT;
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e7 || Math.abs(y) > 1e7) {
        throw new Error('INVALID_INPUT: invalid create x/y coordinates');
      }
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < MIN_CHART_WIDTH || height < MIN_CHART_HEIGHT) {
        throw new Error('INVALID_INPUT: invalid create width/height bounds');
      }
      ops.push({ id, aspect: 'core.transform', patch: { x, y, rotation: 0 } });
      ops.push({ id, aspect: 'core.bounds', patch: { width: Math.round(width), height: Math.round(height) } });
      ops.push({ id, aspect: CHART_ASPECT_ID, patch: merged });
    } else {
      ops.push({ id, aspect: CHART_ASPECT_ID, patch: sanitized });
    }
  }

  if (ops.length > 150) {
    throw new Error('INVALID_INPUT: operation budget exceeded');
  }
  return ops;
}

/**
 * Registers `euclidraw.ztd-charts` read & proposal tools with the host `workspace.tools` service.
 */
export function registerZtdChartTools(context) {
  const tools = context?.services?.get?.('workspace.tools');
  if (!tools) return () => {};

  const { world } = context;
  const disposers = [];

  const registerTool = (name, description, properties, required, execute) => {
    disposers.push(
      tools.register({
        id: `${EXTENSION_ID}:${name}`,
        description,
        inputSchema: {
          type: 'object',
          properties,
          required,
        },
        execute: async (input, meta) => {
          meta?.signal?.throwIfAborted?.();
          return execute(input ?? {});
        },
      }),
    );
  };

  try {
    if (typeof tools.registerDescriptor === 'function') {
      disposers.push(
        tools.registerDescriptor({
          aspect: CHART_ASPECT_ID,
          description:
            'ZTD 36종 통계·비즈니스 차트 도형. 생성·수정·이동·삭제는 반드시 plan-changes 도구를 통해 사용자 승인 제안(prepareChange)으로만 수행하세요.',
          fields: {
            chartType: `Allowed (${CHART_TYPES.length} types): ${CHART_TYPES.join(', ')}`,
            title: 'string: 차트 카드 제목 (비워 두면 차트 유형별 기본 제목 사용)',
            subtitle: 'string: 차트 부제목 또는 단위 설명',
            takeaway: 'string: 핵심 인사이트 한 줄 요약',
            theme: `Allowed: ${ALLOWED_THEMES.join(', ')}`,
            locale: `Allowed: ${ALLOWED_LOCALES.join(', ')}`,
            variant: `Allowed: ${ALLOWED_VARIANTS.join(', ')}`,
            legendMode: `Allowed: ${ALLOWED_LEGENDS.join(', ')}`,
            accentColor: 'string (#rrggbb): 강조 계열 색상',
            backgroundColor: 'string (#rrggbb, "transparent", or ""): 차트 카드 배경 색상. transparent면 카드 배경만 투명',
            cornerRadius: 'number (0–64): 차트 카드 모서리 둥글기. 0이면 직각',
            data: 'array of row objects (비워 두면 해당 차트 유형의 내장 샘플 데이터 사용)',
            encoding: 'object: 데이터 컬럼 매핑 (예: { x, y, series } 또는 { label, value })',
            options:
              'object: 차트별 세부 옵션 (highlight: "auto"|"max"|"min"|"first"|"last"|"none"|string|string[], neutralColor: "#rrggbb", itemColors: { [label]: "#rrggbb" } 등)',
          },
        }),
      );
    }

    registerTool(
      'catalog',
      'ZTD 차트 36종 카탈로그 및 용도·권장 인코딩 조회 (읽기 전용).',
      {
        family: { type: 'string' },
        query: { type: 'string' },
        locale: { type: 'string' },
      },
      [],
      ({ family = 'all', query = '', locale = 'ko' }) => {
        const lang = normalizeLang(locale);
        const q = String(query ?? '').trim().toLowerCase();
        const items = getChartCatalog(lang).filter(item => {
          if (family && family !== 'all' && item.family !== family) return false;
          if (!q) return true;
          return (
            item.type.toLowerCase().includes(q)
            || item.name.toLowerCase().includes(q)
            || item.summary.toLowerCase().includes(q)
          );
        });
        return {
          total: items.length,
          families: CHART_FAMILIES,
          charts: items.map(item => ({
            type: item.type,
            family: item.family,
            name: item.name,
            summary: item.summary,
            whenToUse: item.whenToUse,
            encodings: item.encodings,
          })),
        };
      },
    );

    registerTool(
      'suggest',
      'CSV 또는 JSON 배열 데이터를 분석해 가장 적합한 ZTD 차트 종류와 자동 컬럼 인코딩을 추천합니다 (읽기 전용).',
      {
        data: { type: 'string' },
        locale: { type: 'string' },
      },
      ['data'],
      ({ data, locale = 'ko' }) => {
        const parsed = parseDataInput(data, locale);
        if (!parsed.ok) {
          throw new Error(`INVALID_INPUT: ${parsed.error}`);
        }
        const { profile, suggestions } = suggestChartsForRows(parsed.rows, locale);
        return {
          rowCount: parsed.rows.length,
          profile,
          suggestions: suggestions.map(item => ({
            type: item.type,
            name: item.name,
            score: item.score,
            reason: item.reason,
            encoding: item.spec?.encoding ?? {},
          })),
        };
      },
    );

    registerTool(
      'search',
      '현재 캔버스에 배치된 ZTD 차트 엔티티 목록과 설정·데이터 요약 조회 (읽기 전용).',
      {
        query: { type: 'string' },
      },
      [],
      ({ query = '' }) => {
        const q = String(query ?? '').trim().toLowerCase();
        const entities = [];
        for (const id of world.listEntityIds?.() ?? []) {
          if (world.isAlive && !world.isAlive(id)) continue;
          const props = world.getCanonical?.(id, CHART_ASPECT_ID);
          if (!props) continue;
          const resolved = resolveChartSpec(props);
          const haystack = `${id} ${resolved.chartType} ${resolved.title} ${resolved.subtitle} ${resolved.takeaway}`.toLowerCase();
          if (q && !haystack.includes(q)) continue;
          entities.push({
            id,
            chartType: resolved.chartType,
            title: resolved.title,
            subtitle: resolved.subtitle,
            takeaway: resolved.takeaway,
            theme: resolved.themeName,
            locale: resolved.lang,
            variant: resolved.variant,
            usingSampleData: resolved.usingSampleData,
            rowCount: resolved.spec.data?.length ?? 0,
            encoding: resolved.spec.encoding,
            transform: world.getCanonical?.(id, 'core.transform'),
            bounds: world.getCanonical?.(id, 'core.bounds'),
          });
        }
        return { total: entities.length, entities };
      },
    );

    registerTool(
      'plan-changes',
      'ZTD 차트 생성·수정·이동·크기 변경·삭제 승인 제안 생성. actions는 JSON 배열 문자열입니다: [{"action":"create","id":"c1","x":80,"y":80,"width":480,"height":340,"patch":{"chartType":"bar","title":"분기별 매출","data":[{"quarter":"1분기","revenue":120}]}},{"action":"update","id":"existing-id","patch":{"chartType":"line","theme":"dark"}},{"action":"move","id":"existing-id","x":200,"y":160,"width":520,"height":360},{"action":"delete","id":"existing-id"}]. 직접 적용하지 않고 사용자 승인 제안을 반환합니다.',
      {
        actions: { type: 'string' },
      },
      ['actions'],
      ({ actions }) => {
        if (typeof tools.prepareChange !== 'function') {
          throw new Error('Host update required: workspace.tools.prepareChange is unavailable');
        }
        let parsedActions;
        try {
          parsedActions = JSON.parse(actions);
        } catch (error) {
          throw new Error(`INVALID_INPUT: actions must be valid JSON (${error instanceof Error ? error.message : String(error)})`);
        }
        const ops = planZtdChartChanges(world, parsedActions);
        return tools.prepareChange(ops);
      },
    );
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

  return () => {
    for (const dispose of disposers.splice(0).reverse()) {
      try {
        dispose();
      } catch {
        // Ignore cleanup failure
      }
    }
  };
}
