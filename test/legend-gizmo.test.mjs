import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { mountLegendDrag } from '../src/legend-drag.js';

test('selection HUD handle drags its legend and disappears on deselection', () => {
  const {window:w} = new JSDOM('<main><div data-chart-type="bar" data-entity-id="a"><section data-role="ztd-chart-mount"><section class="ztd-card"><header><ul aria-label="범례"><li>GDP</li></ul></header></section></section></div><aside></aside></main>');
  const doc = w.document, surface = doc.querySelector('main'), hud = doc.querySelector('aside'), host = surface.firstChild, legend = doc.querySelector('ul');
  const rect = (x,y,width,height)=>({left:x,top:y,right:x+width,bottom:y+height,width,height});
  hud.getBoundingClientRect=host.getBoundingClientRect=()=>rect(0,0,480,340);
  legend.getBoundingClientRect=()=>rect(10,10,60,20);
  for (const [n,width,height] of [[host,480,340],[legend,60,20]]) Object.defineProperties(n,{offsetWidth:{value:width},offsetHeight:{value:height}});
  let selected=['a'], paint, next, committed;
  w.requestAnimationFrame=cb=>{ next=cb; return 1; }; w.cancelAnimationFrame=()=>{};
  const active={surface:{element:surface,hud},selection:{getSelection:()=>selected},host:{getZoom:()=>1}};
  const off=mountLegendDrag({services:{get:name=>name==='canvas.frames'?{subscribe:cb=>{paint=cb;}}:{get:()=>active}},world:{getCanonical:()=>({})}},(id,p)=>{committed=[id,p];});
  next(); const handle=hud.querySelector('[data-ztd-legend-gizmo]'); assert.ok(handle); assert.equal(host.contains(handle),false);
  const band=hud.querySelector('[data-ztd-legend-rubber-band]');
  assert.equal(band.style.borderStyle,'dashed'); assert.equal(band.style.pointerEvents,'none');
  assert.equal(band.style.width,'64px'); assert.equal(band.style.height,'24px');
  assert.equal(band.style.transform,'translate(8px,8px) rotate(0rad)');
  const fire=(type,x,y)=>{ const e=new w.MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y}); Object.defineProperty(e,'pointerId',{value:1}); handle.querySelector('path').dispatchEvent(e); };
  fire('pointerdown',70,10); fire('pointermove',90,25);
  legend.getBoundingClientRect=()=>rect(30,25,60,20); next();
  assert.equal(band.style.transform,'translate(28px,23px) rotate(0rad)');
  fire('pointerup',90,25);
  assert.deepEqual(committed,['a',{card:{x:20,y:15}}]);
  selected=[]; paint(); next(); assert.equal(hud.childElementCount,0); off();
});
