import test from 'node:test';
import assert from 'node:assert/strict';
import plugin, {
  CHART_ASPECT_ID,
  CHART_TYPES,
  EXTENSION_ID,
  deriveChartGeometry,
  extractChartDataTargets,
  matchTextToChartData,
  mergeDraft,
  mountInlineEditor,
  parseDataInput,
  planZtdChartChanges,
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

  assert.equal(registeredCommands.size, 10);
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
          if (selector.includes('[data-chart-option-field]') && cur.dataset?.chartOptionField) return cur;
          if (selector.includes('svg text') && cur.tagName === 'TEXT') return cur;
          if (selector.includes('[data-entity-id]') && cur.dataset?.entityId) return cur;
          cur = cur.parentElement;
        }
        return null;
      },
      getBoundingClientRect() {
        return el._rect ?? { left: 110, top: 110, right: 320, bottom: 140, width: 210, height: 30 };
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
        if (selector.startsWith('[data-chart-option-field="')) {
          const optKey = selector.slice('[data-chart-option-field="'.length, -2);
          return children.find(c => c.dataset.chartOptionField === optKey) ?? null;
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === 'svg text') {
          return children.filter(c => c.tagName === 'TEXT');
        }
        if (selector.includes('[data-chart-field]')) {
          return children.filter(c => c.dataset?.chartField || c.dataset?.chartOptionField);
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
          options: { centerLabel: '총합' },
          data: [
            { region: '서울', revenue: 1200 },
            { region: '부산', revenue: 850 },
          ],
        },
      },
    ]);
    // Match real @alid/kernel CanvasWorld.getComputed(id, aspect) two-argument signature
    world.getComputed = (id, aspect) => (
      id === chartId && aspect === `computed.${CHART_ASPECT_ID}`
        ? { x: 100, y: 100, width: 480, height: 340, rotation: 0 }
        : undefined
    );

    const surfaceEl = makeSyntheticElement('div', syntheticDoc);
    const hudEl = makeSyntheticElement('div', syntheticDoc);
    const islandEl = makeSyntheticElement('div', syntheticDoc);
    islandEl.dataset.entityId = chartId;
    islandEl._rect = { left: 100, top: 100, right: 580, bottom: 440, width: 480, height: 340 };
    const titleEl = makeSyntheticElement('h2', syntheticDoc);
    titleEl.dataset.chartField = 'title';
    titleEl.textContent = '초기 제목';
    titleEl._rect = { left: 120, top: 112, right: 360, bottom: 140, width: 240, height: 28 };
    const subtitleEl = makeSyntheticElement('span', syntheticDoc);
    subtitleEl.dataset.chartField = 'subtitle';
    subtitleEl.textContent = '단위: 건';
    subtitleEl._rect = { left: 120, top: 144, right: 260, bottom: 164, width: 140, height: 20 };
    const centerLabelEl = makeSyntheticElement('text', syntheticDoc);
    centerLabelEl.dataset.chartOptionField = 'centerLabel';
    centerLabelEl.textContent = '총합';
    const svgTextEl = makeSyntheticElement('text', syntheticDoc);
    svgTextEl.textContent = '서울';
    const axisTickEl = makeSyntheticElement('text', syntheticDoc);
    axisTickEl.textContent = '50';
    islandEl.append(titleEl, subtitleEl, centerLabelEl, svgTextEl, axisTickEl);
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

    // 1. Retargeted double-click (target = surfaceEl due to select-suite pointer capture)
    // opens zero-chrome transparent input on non-data title field
    surfaceEl.dispatch('pointerdown', { target: titleEl, clientX: 130, clientY: 122, pointerId: 1, button: 0 });
    surfaceEl.dispatch('pointerup', { target: surfaceEl, clientX: 130, clientY: 122, pointerId: 1, button: 0 });
    surfaceEl.dispatch('dblclick', { target: surfaceEl, clientX: 130, clientY: 122, button: 0 });

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
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(container.style.display, 'none');
    assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).title, '지역별 매출 분석');
    assert.equal(historyChanges, 1);
    assert.ok(historySeals >= 1);

    // 2. Double-clicking SVG data text ("서울") or numeric axis tick ("50") must NOT enter edit mode or mutate data
    surfaceEl.dispatch('dblclick', { target: svgTextEl, clientX: 250, clientY: 260, button: 0 });
    assert.equal(container.style.display, 'none', 'data category text must not enter edit mode');
    assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).data[0].region, '서울');

    surfaceEl.dispatch('dblclick', { target: axisTickEl, clientX: 250, clientY: 280, button: 0 });
    assert.equal(container.style.display, 'none', 'numeric axis tick must not enter edit mode');
    assert.deepEqual(world.getCanonical(chartId, CHART_ASPECT_ID).data, [
      { region: '서울', revenue: 1200 },
      { region: '부산', revenue: 850 },
    ]);

    // 3. Double-clicking explicit non-data option label (centerLabel) edits options.centerLabel without touching data
    surfaceEl.dispatch('dblclick', { target: centerLabelEl, clientX: 240, clientY: 240, button: 0 });
    assert.equal(container.style.display, 'block');
    assert.equal(input.value, '총합');
    input.value = '전체 합계';
    input.dispatch('input');
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(container.style.display, 'none');
    assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).options.centerLabel, '전체 합계');

    editor.dispose();
  } finally {
    globalThis.document = prevDoc;
  }
});

test('card chrome keeps only the title and subtitle unless the user sets the rest', () => {
  const resolved = resolveChartSpec({ chartType: 'bar', locale: 'ko' });
  assert.equal(resolved.cardNumber, '');
  assert.equal(resolved.cardLevel, '');
  assert.equal(resolved.takeaway, '');
  assert.equal(resolved.spec.card.number, undefined);
  assert.equal(resolved.spec.card.level, undefined);
  assert.equal(resolved.spec.card.takeaway, undefined);
  assert.ok(resolved.spec.card.title);
  assert.ok(resolved.spec.card.subtitle);

  const { svg } = renderChartSvg({ chartType: 'bar', locale: 'ko' }, undefined, 'card-chrome');
  assert.equal(svg.includes('data-chart-field="takeaway"'), false);

  const kept = resolveChartSpec({
    chartType: 'bar',
    locale: 'ko',
    takeaway: '직접 적은 요약',
    options: { cardNumber: '03', cardLevel: '심화' },
  });
  assert.equal(kept.takeaway, '직접 적은 요약');
  assert.equal(kept.cardNumber, '03');
  assert.equal(kept.cardLevel, '심화');
});

test('custom backgroundColor, highlight selection, neutralColor, and per-component itemColors work across SVG, DOM, commands, and Copilot tools', () => {
  const rows = [
    { channel: '검색', conversion: 42 },
    { channel: '소셜', conversion: 68 },
    { channel: '이메일', conversion: 29 },
  ];

  // 1. Background color with automatic luminance-aware contrast
  const darkBgSpec = resolveChartSpec({
    chartType: 'bar',
    theme: 'light',
    backgroundColor: '#0f172a',
    accentColor: '#10b981',
    data: rows,
    options: {
      neutralColor: '#475569',
      highlight: '검색',
      itemColors: {
        이메일: '#f59e0b',
      },
    },
  });
  assert.equal(darkBgSpec.backgroundColor, '#0f172a');
  assert.equal(darkBgSpec.resolvedTheme.panel, '#0f172a');
  assert.equal(darkBgSpec.resolvedTheme.ink, '#F1F3F5', 'dark backgroundColor switches foreground text to light ink');
  assert.equal(darkBgSpec.resolvedTheme.neutral, '#475569', 'custom neutralColor overrides theme neutral token');
  assert.equal(darkBgSpec.highlight, '검색');
  assert.deepEqual(darkBgSpec.dataTargets.items.map(i => i.key), ['검색', '소셜', '이메일']);

  const { svg: barSvg } = renderChartSvg({
    chartType: 'bar',
    backgroundColor: '#0f172a',
    accentColor: '#10b981',
    data: rows,
    options: {
      neutralColor: '#475569',
      highlight: '검색',
      itemColors: {
        이메일: '#f59e0b',
      },
    },
  });
  assert.ok(barSvg.includes('fill="#0f172a"'), 'card background rect uses custom backgroundColor');
  assert.ok(barSvg.includes('fill="#10b981"'), 'highlighted bar ("검색") uses accentColor');
  assert.ok(barSvg.includes('fill="#475569"'), 'non-highlighted bar ("소셜") uses custom neutralColor');
  assert.ok(barSvg.includes('fill="#f59e0b"'), 'per-item custom color ("이메일") overrides bar fill');

  // 2. Pie / Donut / Line / Candlestick per-component colors
  const { svg: pieSvg } = renderChartSvg({
    chartType: 'pie',
    data: rows,
    options: {
      itemColors: {
        검색: '#ef4444',
        소셜: '#3b82f6',
        이메일: '#8b5cf6',
      },
    },
  });
  assert.ok(pieSvg.includes('fill="#ef4444"'));
  assert.ok(pieSvg.includes('fill="#3b82f6"'));
  assert.ok(pieSvg.includes('fill="#8b5cf6"'));

  const multiSeriesRows = [
    { month: '1월', series: 'A팀', score: 80 },
    { month: '2월', series: 'A팀', score: 90 },
    { month: '1월', series: 'B팀', score: 70 },
    { month: '2월', series: 'B팀', score: 85 },
  ];
  const { svg: lineSvg } = renderChartSvg({
    chartType: 'line',
    data: multiSeriesRows,
    encoding: { x: 'month', y: 'score', series: 'series' },
    options: {
      itemColors: {
        A팀: '#ec4899',
        B팀: '#06b6d4',
      },
    },
  });
  assert.ok(lineSvg.includes('stroke="#ec4899"'));
  assert.ok(lineSvg.includes('stroke="#06b6d4"'));

  const { svg: candleSvg } = renderChartSvg({
    chartType: 'candlestick',
    options: {
      itemColors: {
        up: '#22c55e',
        down: '#ef4444',
      },
    },
  });
  assert.ok(candleSvg.includes('#22c55e'));
  assert.ok(candleSvg.includes('#ef4444'));

  // 3. update-style command and planZtdChartChanges validation
  const world = createMockWorld();
  let selected = [];
  const runtime = plugin.activate({
    world,
    commands: { register: () => () => {} },
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

  const chartId = runtime.api.insertChart({
    chartType: 'bar',
    backgroundColor: '#fffbeb',
    highlight: ['검색', '소셜'],
    itemColors: { 검색: '#ef4444' },
  });
  assert.equal(world.getCanonical(chartId, CHART_ASPECT_ID).backgroundColor, '#fffbeb');
  assert.deepEqual(world.getCanonical(chartId, CHART_ASPECT_ID).options.highlight, ['검색', '소셜']);
  assert.deepEqual(world.getCanonical(chartId, CHART_ASPECT_ID).options.itemColors, { 검색: '#ef4444' });

  runtime.api.run('update-style', {
    entityId: chartId,
    backgroundColor: '#18181b',
    accentColor: '#8b5cf6',
    neutralColor: '#64748b',
    highlight: 'min',
    itemColors: { 소셜: '#10b981', 검색: '' },
  });
  const updated = world.getCanonical(chartId, CHART_ASPECT_ID);
  assert.equal(updated.backgroundColor, '#18181b');
  assert.equal(updated.accentColor, '#8b5cf6');
  assert.equal(updated.options.neutralColor, '#64748b');
  assert.equal(updated.options.highlight, 'min');
  assert.deepEqual(updated.options.itemColors, { 소셜: '#10b981' });

  const plannedOps = planZtdChartChanges(world, [
    {
      action: 'update',
      id: chartId,
      patch: {
        backgroundColor: '#f0fdf4',
        highlight: 'max',
        neutralColor: '#94a3b8',
        itemColors: { 이메일: '#06b6d4' },
      },
    },
  ]);
  const chartPatch = plannedOps.find(op => op.aspect === CHART_ASPECT_ID)?.patch;
  assert.equal(chartPatch.backgroundColor, '#f0fdf4');
  assert.equal(chartPatch.options.highlight, 'max');
  assert.equal(chartPatch.options.neutralColor, '#94a3b8');
  assert.deepEqual(chartPatch.options.itemColors, { 이메일: '#06b6d4' });

  const targets = extractChartDataTargets('candlestick', [], {});
  assert.equal(targets.kind, 'updown');
  assert.equal(targets.items.length, 2);

  runtime.dispose();
});



