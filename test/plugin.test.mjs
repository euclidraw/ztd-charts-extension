import test from 'node:test';
import assert from 'node:assert/strict';
import plugin, {
  CHART_ASPECT_ID,
  CHART_TYPES,
  EXTENSION_ID,
  deriveChartGeometry,
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

  assert.equal(registeredCommands.size, 8);
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

