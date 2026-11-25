import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ZtdChartStudioView } from '../src/panel.js';
import { CHART_TYPES } from '../src/model.js';

function renderStudio(chartType) {
  const context = {
    getSelectedIds: () => chartType ? ['selected'] : [],
    world: { getCanonical: () => ({ chartType, options: { show: 'count' } }) },
  };
  return renderToStaticMarkup(React.createElement(ZtdChartStudioView, { context }));
}

test('studio distinguishes insert and switch and shows the selected chart’s fields and options', () => {
  const empty = renderStudio(null);
  assert.ok(empty.includes('선택하면 새 차트를 추가합니다'));
  assert.ok(!empty.includes('데이터 열 안내'));
  for (const type of CHART_TYPES) {
    const html = renderStudio(type);
    assert.ok(html.includes('선택하면 현재 차트 유형을 변경합니다'), type);
    assert.ok(html.includes('데이터 열 안내'), type);
    if (type === 'cohort') {
      assert.ok(html.includes('연결된 열: month'));
      assert.match(html, /<option value="count" selected="">/);
    }
  }
});
