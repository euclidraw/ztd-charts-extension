import test from 'node:test';
import assert from 'node:assert/strict';
import plugin, {
  CHART_ASPECT_ID,
  CHART_TYPES,
  EXTENSION_ID,
  deriveChartGeometry,
  matchTextToChartData,
  mergeDraft,
  mountInlineEditor,
  parseDataInput,
  renderChartDom,
  renderChartSvg,
  resolveChartSpec,
  suggestChartsForRows,
  ztdChartAspect,
} from '../dist/plugin.js';

function createMockWorld() {
  const entities = new Map();
  return {
    listEntityIds() {
      return [...entities.keys()];
    },
    isAlive(id) {
      return entities.has(id);
    },
    getCanonical(id, aspect) {
      return entities.get(id)?.[aspect];
    },
    exportCanonicalSnapshot() {
      return Object.fromEntries(entities.entries());
    },
    applyCanonicalTransaction(_caller, ops) {
      for (const op of ops) {
        if (op.patch === null) {
          entities.delete(op.id);
        } else {
          const entry = entities.get(op.id) ?? {};
          entry[op.aspect] = { ...(entry[op.aspect] ?? {}), ...op.patch };
          entities.set(op.id, entry);
        }
      }
    },
  };
}

test('all 36 ztd-charts types compile to deterministic, pure vector SVG without foreignObject or NaN', () => {
  assert.equal(CHART_TYPES.length, 36);
  const geom = { x: 40, y: 60, width: 480, height: 340, rotation: 0 };

  for (const chartType of CHART_TYPES) {
    const props = {
      ...ztdChartAspect.defaults,
      chartType,
      theme: 'light',
      locale: 'ko',
      variant: 'card',
    };
    const first = renderChartSvg(props, geom, `entity-${chartType}`);
    const second = renderChartSvg(props, geom, `entity-${chartType}`);

    assert.equal(first.svg, second.svg, `SVG output for ${chartType} must be deterministic`);
    assert.ok(first.svg.startsWith('<g transform="translate(40,60)"'), `${chartType} outer transform`);
    assert.ok(first.svg.includes(`data-chart-type="${chartType}"`), `${chartType} data attribute`);
    assert.ok(!first.svg.includes('foreignObject'), `${chartType} must not use foreignObject`);
    assert.ok(!first.svg.includes('NaN'), `${chartType} must not contain NaN`);
    assert.ok(!first.svg.includes('var(--ztd-'), `${chartType} must inline --ztd-* CSS variables`);
  }
});

test('custom CSV/JSON data adapts across compatible chart types and falls back safely on specialized types', () => {
  const csv = 'quarter,revenue\n1분기,120\n2분기,180\n3분기,240';
  const parsed = parseDataInput(csv, 'ko');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.rows.length, 3);

  // Compatible switch: bar -> pie -> line
  for (const chartType of ['bar', 'pie', 'donut', 'line', 'area', 'funnel']) {
    const resolved = resolveChartSpec({
      chartType,
      data: parsed.rows,
      locale: 'ko',
    });
    assert.equal(resolved.usingSampleData, false, `${chartType} should use custom rows`);
    const { svg } = renderChartSvg({ chartType, data: parsed.rows }, undefined, `custom-${chartType}`);
    assert.ok(!svg.includes('NaN'));
  }

  // Specialized type (candlestick requires open/high/low/close) falls back cleanly to sample data
  const fallback = resolveChartSpec({
    chartType: 'candlestick',
    data: parsed.rows,
    locale: 'ko',
  });
  assert.equal(fallback.usingSampleData, true);
  const { svg } = renderChartSvg({ chartType: 'candlestick', data: parsed.rows }, undefined, 'fallback-candle');
  assert.ok(!svg.includes('NaN'));
});

test('plugin commands create, switch type, update data, apply suggestions, and toggle styles', () => {
  const world = createMockWorld();
  let selected = [];
  const registeredCommands = new Map();

  const runtime = plugin.activate({
    world,
    commands: {
      register(spec) {
        registeredCommands.set(spec.id, spec);
        return () => registeredCommands.delete(spec.id);
      },
    },
    services: {
      get(name) {
        if (name === 'canvas.active-tool-surface') {
          return {
            get: () => ({
              selection: {
                getSelection: () => selected,
                select(id) {
                  selected = [id];
                },
              },
              host: { history: { begin() {}, commit() {}, abort() {} } },
            }),
          };
        }
        return undefined;
      },
    },
  });

  assert.equal(registeredCommands.size, 9);
  assert.deepEqual(registeredCommands.get(`${EXTENSION_ID}:edit-chart`).keys, ['Enter']);
  assert.equal(registeredCommands.get(`${EXTENSION_ID}:edit-chart`).shortcutSelectionAspect, CHART_ASPECT_ID);
  const chartId = runtime.api.insertChart({ chartType: 'bar', title: '매출 현황' });
  assert.ok(chartId);
  assert.deepEqual(selected, [chartId]);
  assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).chartType, 'bar');
  assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).title, '매출 현황');

  // Switch chart type
  runtime.api.setChartType({ chartType: 'line' });
  assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).chartType, 'line');

  // Update with custom CSV data
  runtime.api.updateData({ data: 'segment,users\n모바일,720\n데스크톱,280' });
  assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).data.length, 2);

  // Apply top suggestion
  runtime.api.applyTopSuggestion();
  const afterSuggest = world.getCanonical(chartId, CHART_ASPECT_ID);
  assert.ok(CHART_TYPES.includes(afterSuggest.chartType));

  // Toggle theme, variant, locale
  runtime.api.run('toggle-theme');
  assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).theme, 'dark');
  runtime.api.run('toggle-variant');
  assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).variant, 'bare');
  runtime.api.run('toggle-locale');
  assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).locale, 'en');

  // Reset sample data
  runtime.api.resetSampleData();
  assert.deepEqual(world.getCanonical(chartId, CHART_ASPECT_ID).data, []);

  // Verify deriveChartGeometry & headless renderChartDom fallback
  const derived = deriveChartGeometry(world.getCanonical(chartId, CHART_ASPECT_ID), chartId, world);
  assert.equal(derived.width, 480);
  assert.equal(derived.height, 340);

  const mockHost = { dataset: {}, style: {}, innerHTML: '' };
  const cleanup = renderChartDom(mockHost, world.getCanonical(chartId, CHART_ASPECT_ID), derived, chartId);
  assert.ok(mockHost.innerHTML.includes('<svg'));
  cleanup();
  assert.equal(mockHost.innerHTML, '');

  // Verify suggestChartsForRows
  const rec = suggestChartsForRows([{ item: 'A', value: 40 }, { item: 'B', value: 60 }], 'ko');
  assert.ok(rec.suggestions.length > 0);

  runtime.dispose();
  assert.equal(registeredCommands.size, 0);
});

test('insertChart honors the Alid host canvas.creation service contract (named caller symbol, top-level dimensions, no placement aspects)', () => {
  const world = createMockWorld();
  let lastRequest = null;
  const runtime = plugin.activate({
    world,
    commands: { register: () => () => {} },
    services: {
      get(name) {
        if (name === 'canvas.creation') {
          return {
            create(request) {
              if (!request || typeof request.caller !== 'string' || !request.caller.includes(':') || request.caller.trim() !== request.caller) {
                throw new Error('Entity creation requires a named caller symbol.');
              }
              if (!Number.isFinite(request.width) || request.width <= 0 || (request.height !== undefined && (!Number.isFinite(request.height) || request.height <= 0))) {
                throw new Error('Entity dimensions must be finite positive numbers.');
              }
              for (const aspect of Object.keys(request.aspects ?? {})) {
                if (aspect === 'core.transform' || aspect === 'core.bounds') {
                  throw new Error(`Entity placement aspect is owned by the canvas: ${aspect}`);
                }
              }
              lastRequest = request;
              return 'ent_object_test';
            },
          };
        }
        return undefined;
      },
    },
  });

  const createdId = runtime.api.run('insert-chart', { chartType: 'pie' });
  assert.equal(createdId, 'ent_object_test');
  assert.equal(lastRequest.caller, `${EXTENSION_ID}:insert-chart`);
  assert.equal(lastRequest.width, 480);
  assert.equal(lastRequest.height, 340);
  assert.equal('x' in lastRequest, false, 'omits x so host centers in visible area');
  assert.equal('y' in lastRequest, false, 'omits y so host centers in visible area');
  assert.deepEqual(Object.keys(lastRequest.aspects), [CHART_ASPECT_ID]);
  assert.equal(lastRequest.aspects[CHART_ASPECT_ID].chartType, 'pie');

  runtime.dispose();
});

test('inline editor supports double-click and Enter editing for title, subtitle, takeaway, and SVG data cells with Korean IME protection', () => {
  // 1. Verify mergeDraft and matchTextToChartData helpers
  assert.equal(mergeDraft('분기별 매출', '분기별 영업 매출', '2026 분기별 매출'), '2026 분기별 영업 매출');

  const rows = [
    { region: '서울', revenue: 1200 },
    { region: '부산', revenue: 850 },
  ];
  const labelMatch = matchTextToChartData('서울', rows, 'ko-KR');
  assert.equal(labelMatch.kind, 'data');
  assert.equal(labelMatch.cellKind, 'string');
  assert.equal(labelMatch.colKey, 'region');

  const numMatch = matchTextToChartData('1,200', rows, 'ko-KR');
  assert.equal(numMatch.kind, 'data');
  assert.equal(numMatch.cellKind, 'number');
  assert.equal(numMatch.colKey, 'revenue');

  // 2. Verify DOM double-click and IME lifecycle via synthetic DOM
  function makeSyntheticElement(tag, doc) {
    const listeners = new Map();
    const children = [];
    const attrs = new Map();
    const el = {
      tagName: tag.toUpperCase(),
      ownerDocument: doc,
      dataset: {},
      style: {},
      value: '',
      textContent: '',
      parentElement: null,
      children,
      append(...nodes) {
        for (const n of nodes) {
          n.parentElement = el;
          children.push(n);
        }
      },
      remove() {
        if (!el.parentElement) return;
        const idx = el.parentElement.children.indexOf(el);
        if (idx >= 0) el.parentElement.children.splice(idx, 1);
      },
      setAttribute(k, v) {
        attrs.set(k, String(v));
      },
      getAttribute(k) {
        if (k === 'data-entity-id' && el.dataset.entityId) return el.dataset.entityId;
        if (k === 'data-chart-field' && el.dataset.chartField) return el.dataset.chartField;
        return attrs.get(k) ?? null;
      },
      addEventListener(type, fn) {
        const list = listeners.get(type) ?? [];
        list.push(fn);
        listeners.set(type, list);
      },
      removeEventListener(type, fn) {
        const list = listeners.get(type) ?? [];
        listeners.set(type, list.filter(item => item !== fn));
      },
      dispatch(type, eventInit = {}) {
        let defaultPrevented = false;
        const ev = {
          type,
          target: el,
          ...eventInit,
          get defaultPrevented() {
            return defaultPrevented;
          },
          preventDefault() {
            defaultPrevented = true;
          },
          stopPropagation() {},
        };
        for (const fn of listeners.get(type) ?? []) fn(ev);
        return ev;
      },
      focus() {
        doc.activeElement = el;
      },
      select() {},
      contains(target) {
        let cur = target;
        while (cur) {
          if (cur === el) return true;
          cur = cur.parentElement;
        }
        return false;
      },
      closest(selector) {
        let cur = el;
        while (cur) {
          if (selector.includes('[data-chart-field]') && cur.dataset?.chartField) return cur;
          if (selector.includes('svg text') && cur.tagName === 'TEXT') return cur;
          if (selector.includes('[data-entity-id]') && cur.dataset?.entityId) return cur;
          cur = cur.parentElement;
        }
        return null;
      },
      getBoundingClientRect() {
        return el._rect ?? { left: 20, top: 20, right: 220, bottom: 50, width: 200, height: 30 };
      },
      querySelector(selector) {
        if (selector.startsWith('[data-entity-id="')) {
          const id = selector.slice('[data-entity-id="'.length, -2);
          return children.find(c => c.dataset.entityId === id) ?? null;
        }
        if (selector.startsWith('[data-chart-field="')) {
          const field = selector.slice('[data-chart-field="'.length, -2);
          return children.find(c => c.dataset.chartField === field) ?? null;
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === 'svg text') {
          return children.filter(c => c.tagName === 'TEXT');
        }
        return [];
      },
    };
    return el;
  }

  const prevDoc = globalThis.document;
  const syntheticDoc = {
    activeElement: null,
    createElement(tag) {
      return makeSyntheticElement(tag, syntheticDoc);
    },
  };
  globalThis.document = syntheticDoc;

  try {
    const world = createMockWorld();
    const chartId = 'chart-1';
    world.applyCanonicalTransaction('test:init', [
      { id: chartId, aspect: 'core.transform', patch: { x: 100, y: 100, rotation: 0 } },
      { id: chartId, aspect: 'core.bounds', patch: { width: 480, height: 340 } },
      {
        id: chartId,
        aspect: CHART_ASPECT_ID,
        patch: {
          ...ztdChartAspect.defaults,
          chartType: 'bar',
          title: '초기 제목',
          subtitle: '단위: 건',
          takeaway: '초기 요약',
          data: [
            { region: '서울', revenue: 1200 },
            { region: '부산', revenue: 850 },
          ],
        },
      },
    ]);
    world.getComputed = id => (id === chartId ? { x: 100, y: 100, width: 480, height: 340, rotation: 0 } : undefined);

    const surfaceEl = makeSyntheticElement('div', syntheticDoc);
    const hudEl = makeSyntheticElement('div', syntheticDoc);
    const islandEl = makeSyntheticElement('div', syntheticDoc);
    islandEl.dataset.entityId = chartId;
    const titleEl = makeSyntheticElement('h2', syntheticDoc);
    titleEl.dataset.chartField = 'title';
    titleEl.textContent = '초기 제목';
    const svgTextEl = makeSyntheticElement('text', syntheticDoc);
    svgTextEl.textContent = '서울';
    const axisTickEl = makeSyntheticElement('text', syntheticDoc);
    axisTickEl.textContent = '50';
    islandEl.append(titleEl, svgTextEl, axisTickEl);
    surfaceEl.append(islandEl);

    let historyChanges = 0;
    let historySeals = 0;
    const editor = mountInlineEditor({
      world,
      services: {
        get(name) {
          if (name === 'canvas.active-tool-surface') {
            return {
              get: () => ({
                surface: { element: surfaceEl, hud: hudEl },
                selection: { getSelection: () => [chartId] },
                host: {
                  getZoom: () => 1,
                  screenToWorld(cx, cy, out) {
                    out.x = cx;
                    out.y = cy;
                  },
                  worldToScreen(wx, wy, out) {
                    out.x = wx;
                    out.y = wy;
                  },
                  requestRender() {},
                },
              }),
            };
          }
          if (name === 'canvas.frames') {
            return { subscribe: () => () => {} };
          }
          if (name === 'canvas.text-history') {
            return {
              change() {
                historyChanges++;
              },
              seal() {
                historySeals++;
              },
            };
          }
          return undefined;
        },
      },
    });

    // Double-click title -> zero-chrome transparent input -> edit with Korean IME composition
    surfaceEl.dispatch('dblclick', { target: titleEl, clientX: 120, clientY: 120 });
    const container = hudEl.children[0];
    assert.equal(container.children.length, 1, 'no separate floating badge element');
    const input = container.children[0];
    assert.equal(container.style.display, 'block');
    assert.equal(input.style.background, 'transparent');
    assert.equal(input.style.border, 'none');
    assert.equal(input.style.outline, 'none');
    assert.equal(titleEl.style.opacity, '0', 'underlying text is hidden while editing in place');
    assert.equal(input.value, '초기 제목');

    input.dispatch('compositionstart');
    input.value = '지역별 매출 분석';
    // Enter during composition (keyCode 229) must not close the editor
    input.dispatch('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
    assert.equal(container.style.display, 'block');
    input.dispatch('compositionend');
    assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).title, '지역별 매출 분석');
    assert.equal(historyChanges, 1);

    // Double-click SVG text ("서울") -> updates data row cell in place
    surfaceEl.dispatch('dblclick', { target: svgTextEl, clientX: 180, clientY: 220 });
    assert.equal(titleEl.style.opacity, '', 'previous target opacity restored');
    assert.equal(svgTextEl.style.opacity, '0');
    assert.equal(input.value, '서울');
    input.value = ' 수도권 ';
    input.dispatch('input');
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(container.style.display, 'none');
    assert.equal(svgTextEl.style.opacity, '');
    assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).data[0].region, ' 수도권 ');
    assert.ok(historySeals >= 1);

    // Double-click arbitrary non-data SVG text (axis tick "50") -> updates textOverrides and SVG output
    surfaceEl.dispatch('dblclick', { target: axisTickEl, clientX: 110, clientY: 200 });
    assert.equal(input.value, '50');
    input.value = '50억';
    input.dispatch('input');
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).options.textOverrides['svg:1'], '50억');
    const { svg } = renderChartSvg(world.getCanonical(chartId, CHART_ASPECT_ID), { x: 0, y: 0, width: 480, height: 340, rotation: 0 }, chartId);
    assert.ok(svg.includes('50억'));

    editor.dispose();
  } finally {
    globalThis.document = prevDoc;
  }
});


