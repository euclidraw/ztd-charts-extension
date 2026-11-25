import test from 'node:test';
import assert from 'node:assert/strict';
import { CHART_TYPES, renderChartSvg, resolveChartSpec } from '../dist/plugin.js';

const native = new Set(['donut', 'heatmap', 'dumbbell', 'segmented', 'skyline', 'tileMap', 'choropleth', 'symbolMap', 'cohort', 'horizon']);
test('frame only existing card and plot legends across the catalog', () => {
  for (const chartType of CHART_TYPES) for (const variant of ['card','bare']) {
    const props = {chartType, variant, stylePreset:'periods'};
    const {svg} = renderChartSvg(props);
    assert.equal(svg.includes('data-chart-legend="true"'), resolveChartSpec(props).legendItems.length > 0, chartType);
    assert.equal(svg.includes('data-chart-legend-frame="true"'), native.has(chartType), chartType);
  }
  for (const chartType of ['heatmap','tileMap','choropleth','symbolMap','cohort','horizon','donut','segmented']) {
    const options = chartType === 'segmented' ? {list:false} : {legend:chartType === 'donut' ? 'none' : false};
    assert.ok(!renderChartSvg({chartType, variant:'bare', options}).svg.includes('data-chart-legend-frame'),chartType);
  }
});
