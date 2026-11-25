import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountLegendDrag } from '../src/legend-drag.js';
import { CHART_ASPECT_ID, renderChartSvg } from '../dist/plugin.js';

test('legend drag previews at camera scale, commits once and cancels without a write', () => {
  const { window } = new JSDOM('<main><div data-chart-type="bar" data-entity-id="a"><div data-role="ztd-chart-mount"><section class="ztd-card"><header><ul aria-label="범례"><li>매출</li></ul></header></section></div></div></main>');
  const doc = window.document, surface = doc.querySelector('main'), host = surface.firstChild, legend = doc.querySelector('ul');
  for (const [node,w,h] of [[host,480,340],[legend,60,20]]) {
    Object.defineProperties(node, {offsetWidth:{value:w},offsetHeight:{value:h}});
    node.getBoundingClientRect = () => ({left:0,top:0,right:w*2,bottom:h*2});
  }
  const commits = [], props = {options:{legendOffsets:{plot:{x:3,y:4}}}};
  const context = { services:{get:()=>({get:()=>({surface:{element:surface},host:{getZoom:()=>2}})})}, world:{getCanonical:(_,a)=>a === CHART_ASPECT_ID ? props : {rotation:0}} };
  const detach = mountLegendDrag(context,(id,offsets)=>commits.push([id,offsets]));
  function fire(type,x,y){ const e=new window.MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y}); Object.defineProperty(e,'pointerId',{value:2}); legend.firstChild.dispatchEvent(e); }
  fire('pointerdown',0,0); fire('pointermove',40,24);
  assert.equal(legend.style.translate,'20px 12px'); assert.equal(commits.length,0);
  fire('pointerup',40,24); assert.deepEqual(commits,[['a',{plot:{x:3,y:4},card:{x:20,y:12}}]]);
  fire('pointerdown',0,0); fire('pointermove',40,24); doc.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})); fire('pointerup',40,24);
  detach(); assert.equal(commits.length,1);
});

test('export translates the entire native legend, not marks, and card placement is independent', () => {
  const options = {legendOffsets:{card:{x:10,y:14},plot:{x:-9,y:22}}};
  for(const chartType of ['donut','dumbbell','heatmap','skyline','choropleth','symbolMap','segmented','horizon','tileMap','cohort']) {
    const {svg} = renderChartSvg({chartType,options,stylePreset:'periods'});
    const doc = new JSDOM(`<svg>${svg}</svg>`).window.document;
    const g = doc.querySelector('[data-legend-kind="plot"]');
    assert.equal(g?.getAttribute('transform'),'translate(-9,22)',chartType);
    assert.ok(g.querySelector('[data-chart-legend-frame]') && g.querySelector('text'),chartType);
    assert.equal(g.querySelector('.ztd-mark'),null,chartType);
  }
  const base = renderChartSvg({chartType:'bar'}).svg.match(/data-chart-legend="true" transform="translate\((\d+),(\d+)\)/);
  assert.ok(renderChartSvg({chartType:'bar',options}).svg.includes(`data-chart-legend="true" transform="translate(${+base[1]+10},${+base[2]+14})`));
});
