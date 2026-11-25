import { legendGizmos } from './legend-gizmo.js';
import { CHART_ASPECT_ID } from './manifest.js';

export function legendOffset(options, kind) {
  const p = options?.legendOffsets?.[kind];
  return { x: Number.isFinite(p?.x) ? p.x : 0, y: Number.isFinite(p?.y) ? p.y : 0 };
}

const selector = '[data-legend-kind], [data-chart-legend], [data-role="ztd-chart-mount"] .ztd-card > header ul[aria-label]';
const clamp = (n, low, high) => Math.min(Math.max(n, Math.min(0, low)), Math.max(0, high));

// Capture before the host selection tool. Only claim gestures starting on a legend.
export function mountLegendDrag(context, commit) {
  const provider = context.services?.get?.('canvas.active-tool-surface');
  const gizmos = legendGizmos(selector);
  let surface, doc, drag, frame;
  const paint = () => gizmos.paint(provider?.get?.(), context.world);
  function schedule() {
    const win = doc?.defaultView;
    if (win?.requestAnimationFrame && frame == null) frame = win.requestAnimationFrame(() => { frame = null; paint(); });
  }
  function stop(save) {
    if (!drag) return;
    const d = drag; drag = null;
    d.el.style.translate = d.oldTranslate;
    schedule();
    if (d.captured && surface.hasPointerCapture?.(d.pointer)) surface.releasePointerCapture(d.pointer);
    if (save && d.moved && !context.world.isEntityReadOnly?.(d.id)) {
      const props = context.world.getCanonical(d.id, CHART_ASPECT_ID);
      if (props) commit(d.id, { ...props.options?.legendOffsets, [d.kind]: { x: d.base.x + d.dx, y: d.base.y + d.dy } });
    }
  }
  function down(e) {
    if (drag || e.button !== 0 || e.isPrimary === false || !surface.contains(e.target)) return;
    const el = gizmos.target(e.target.closest?.('[data-ztd-legend-gizmo]')) ?? e.target.closest?.(selector);
    const host = el?.closest('[data-chart-type][data-entity-id]') ?? el?.closest('.ecanvas-island-content');
    const id = host?.dataset.entityId;
    const props = id && context.world.getCanonical(id, CHART_ASPECT_ID);
    if (!props || context.world.isEntityReadOnly?.(id)) return;
    const kind = el.dataset.legendKind === 'plot' ? 'plot' : 'card';
    const base = legendOffset(props.options, kind);
    const rotation = context.world.getCanonical(id, 'core.transform')?.rotation ?? 0;
    const zoom = provider.get()?.host?.getZoom?.() || 1;
    const svg = el.ownerSVGElement;
    const matrix = svg?.getScreenCTM?.()?.inverse();
    const local = matrix ? (x,y) => ({ x: matrix.a*x + matrix.c*y, y: matrix.b*x + matrix.d*y }) :
      (x,y) => ({ x:(Math.cos(rotation)*x + Math.sin(rotation)*y)/zoom, y:(-Math.sin(rotation)*x + Math.cos(rotation)*y)/zoom });
    const container = kind === 'plot' ? svg : host;
    const r = el.getBoundingClientRect(), bounds = container.getBoundingClientRect();
    // Centres survive rotation. Clamp using world-space sizes rather than the
    // axis-aligned screen rectangle (which gets wider for a rotated chart).
    const size = el.getBBox?.() ?? {width:el.offsetWidth,height:el.offsetHeight};
    const area = container.viewBox?.baseVal ?? {width:container.offsetWidth,height:container.offsetHeight};
    const center = local((r.left+r.right-bounds.left-bounds.right)/2, (r.top+r.bottom-bounds.top-bounds.bottom)/2);
    const halfX = Math.max(0,(area.width-size.width)/2), halfY = Math.max(0,(area.height-size.height)/2);
    const limits = [{x:-halfX-center.x,y:-halfY-center.y},{x:halfX-center.x,y:halfY-center.y}];
    drag = { id, el, kind, base, pointer:e.pointerId, x:e.clientX, y:e.clientY, local, limits,
      proof: !el.closest('[data-role="ztd-chart-mount"]'), oldTranslate:el.style.translate, dx:0, dy:0 };
    e.stopPropagation();
  }
  function move(e) {
    if (!drag || drag.pointer !== e.pointerId) return;
    const d = drag;
    if (!d.el.isConnected) { stop(false); return; }
    const x = e.clientX-d.x, y = e.clientY-d.y;
    if (!d.moved && Math.hypot(x,y) < 3) return;
    if (!d.moved && surface.setPointerCapture && surface.isConnected) {
      try { surface.setPointerCapture(e.pointerId); d.captured = true; } catch { /* A cancelled pointer can already be inactive. */ }
    }
    d.moved = true;
    const delta = d.local(x,y), [lo,hi] = d.limits;
    d.dx = Math.round(clamp(delta.x,lo.x,hi.x)); d.dy = Math.round(clamp(delta.y,lo.y,hi.y));
    d.el.style.translate = `${(d.proof ? 0 : d.base.x)+d.dx}px ${(d.proof ? 0 : d.base.y)+d.dy}px`;
    schedule();
    e.preventDefault(); e.stopPropagation();
  }
  function up(e) { if (drag?.pointer === e.pointerId) { const moved = drag.moved; stop(true); if (moved) { e.preventDefault(); e.stopPropagation(); } } }
  function cancel(e) { if (drag?.pointer === e.pointerId) stop(false); }
  function key(e) { if (drag && e.key === 'Escape') { stop(false); e.stopPropagation(); } }
  const listeners = { pointerdown:down, pointermove:move, pointerup:up, pointercancel:cancel, lostpointercapture:cancel, keydown:key };
  function detach() { stop(false); doc?.defaultView?.cancelAnimationFrame?.(frame); frame = null; gizmos.clear(); for (const [k,f] of Object.entries(listeners)) doc?.removeEventListener(k,f,true); doc = surface = null; }
  function attach() {
    const next = provider?.get?.()?.surface?.element;
    if (next === surface) { schedule(); return; }
    detach(); surface = next; doc = next?.ownerDocument;
    if (!doc?.addEventListener) { doc = null; return; }
    for (const [k,f] of Object.entries(listeners)) doc.addEventListener(k,f,true);
    schedule();
  }
  attach(); const off = provider?.subscribe?.(attach);
  const offFrame = context.services?.get?.('canvas.frames')?.subscribe?.(schedule);
  return () => { offFrame?.(); off?.(); detach(); };
}
