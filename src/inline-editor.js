import { CHART_ASPECT_ID, EXTENSION_ID } from './manifest.js';
import { deriveChartGeometry, resolveChartSpec } from './model.js';

export const CARD_FIELDS = Object.freeze(['title', 'subtitle', 'takeaway', 'cardNumber', 'cardLevel']);
export const NON_DATA_OPTION_KEYS = Object.freeze(['centerLabel', 'label', 'xLabel', 'yLabel', 'note']);

/**
 * Merges a local draft with concurrent remote updates so changes outside
 * the locally edited span survive remote updates during IME composition.
 */
export function mergeDraft(base, local, remote) {
  if (remote === base || local === remote) return local;
  if (local === base) return remote;
  let a = 0;
  let z = 0;
  while (a < base.length && a < local.length && base[a] === local[a]) a++;
  while (
    z < base.length - a
    && z < local.length - a
    && base[base.length - 1 - z] === local[local.length - 1 - z]
  ) {
    z++;
  }
  let r = 0;
  let t = 0;
  while (r < base.length && r < remote.length && base[r] === remote[r]) r++;
  while (
    t < base.length - r
    && t < remote.length - r
    && base[base.length - 1 - t] === remote[remote.length - 1 - t]
  ) {
    t++;
  }
  const end = base.length - z;
  const remoteEnd = base.length - t;
  const insert = local.slice(a, local.length - z);
  const delta = remote.length - base.length;
  if (remoteEnd <= a) {
    return remote.slice(0, a + delta) + insert + remote.slice(end + delta);
  }
  if (r >= end) {
    return remote.slice(0, a) + insert + remote.slice(end);
  }
  return (
    remote.slice(0, Math.min(a, r))
    + remote.slice(r, remote.length - t)
    + insert
    + remote.slice(Math.max(remoteEnd, end) + delta)
  );
}

/**
 * Parses a displayed numeric label (e.g. "1,240", "42.5%", "+18", "−380", "₩3,200") into a finite number.
 */
export function parseDisplayedNumber(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text
    .trim()
    .replace(/−/g, '-')
    .replace(/[,%\s₩$€¥£원건명개점]/g, '')
    .replace(/^[+]/, '');
  if (!cleaned || !/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Detects whether a text string corresponds to a data cell (category, series, or numeric value)
 * in `rows`. Used to guard against editing data cells via inline canvas text editing.
 */
export function matchTextToChartData(rawText, rows, localeTag = 'ko-KR') {
  if (typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  if (!trimmed || !Array.isArray(rows) || rows.length === 0) return null;

  const stringMatches = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || typeof row !== 'object') continue;
    for (const [colKey, val] of Object.entries(row)) {
      if (typeof val === 'string' && val.trim() === trimmed) {
        stringMatches.push({ rowIndex, colKey });
      }
    }
  }
  if (stringMatches.length > 0) {
    const first = stringMatches[0];
    return {
      kind: 'data',
      cellKind: 'string',
      colKey: first.colKey,
      rowIndex: first.rowIndex,
      matches: stringMatches,
      initialValue: String(rows[first.rowIndex][first.colKey] ?? trimmed),
    };
  }

  const parsedNum = parseDisplayedNumber(trimmed);
  if (parsedNum !== null) {
    const numMatches = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || typeof row !== 'object') continue;
      for (const [colKey, val] of Object.entries(row)) {
        if (typeof val !== 'number' || !Number.isFinite(val)) continue;
        const formatted = val.toLocaleString(localeTag);
        if (
          val === parsedNum
          || Math.abs(val - parsedNum) < 1e-6
          || Number(val.toFixed(1)) === parsedNum
          || formatted === trimmed
        ) {
          numMatches.push({ rowIndex, colKey });
        }
      }
    }
    if (numMatches.length > 0) {
      const first = numMatches[0];
      return {
        kind: 'data',
        cellKind: 'number',
        colKey: first.colKey,
        rowIndex: first.rowIndex,
        matches: [first],
        initialValue: String(rows[first.rowIndex][first.colKey]),
      };
    }
  }

  return null;
}

function isPlainRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolves the world-space bounding box of a chart entity across both the real
 * `@alid/kernel` `CanvasWorld` (`getComputed(id, aspect)`) and lightweight test mocks.
 */
export function getChartWorldBounds(world, entityId, props) {
  if (!world || !entityId) return null;
  const computed =
    world.getComputed?.(entityId, `computed.${CHART_ASPECT_ID}`)
    ?? world.getComputed?.(entityId, 'computed.effectiveBounds')
    ?? world.getComputed?.(entityId, 'computed.layoutBounds')
    ?? world.getComputed?.(entityId);
  if (computed && Number.isFinite(computed.width) && Number.isFinite(computed.height)) {
    return computed;
  }
  const fallbackProps = props ?? world.getCanonical?.(entityId, CHART_ASPECT_ID);
  return deriveChartGeometry(fallbackProps, entityId, world);
}

function readTargetValue(props, target) {
  if (!props || !target) return '';
  const resolved = resolveChartSpec(props);
  const textOverrides = resolved.textOverrides ?? {};

  if (target.slotKey && textOverrides[target.slotKey] !== undefined) {
    return String(textOverrides[target.slotKey]);
  }

  if (target.kind === 'field') {
    const field = target.field;
    if (field === 'cardNumber') {
      return String(resolved.cardNumber ?? '');
    }
    if (field === 'cardLevel') {
      return String(resolved.cardLevel ?? '');
    }
    const raw = props[field];
    if (typeof raw === 'string' && raw.length > 0) return raw;
    return String(resolved[field] ?? '');
  }

  if (target.kind === 'option') {
    const optKey = target.optionKey;
    const rawOpt = props.options?.[optKey] ?? resolved.spec?.options?.[optKey];
    if (typeof rawOpt === 'string') return rawOpt;
    return String(target.initialValue ?? '');
  }

  return '';
}

/**
 * Builds a canonical patch for non-data targets only.
 * Never mutates `props.data`.
 */
function buildPatchForTarget(props, target, rawValue) {
  if (!props || !target) return null;
  const prevOptions = isPlainRecord(props.options) ? { ...props.options } : {};
  const prevOverrides = isPlainRecord(prevOptions.textOverrides) ? { ...prevOptions.textOverrides } : {};

  if (target.kind === 'field') {
    const field = target.field;
    if (!CARD_FIELDS.includes(field)) return null;
    const currentVal = readTargetValue(props, target);
    if (rawValue === currentVal && (field === 'cardNumber' || field === 'cardLevel' || props[field] === rawValue)) {
      return null;
    }

    if (field === 'cardNumber') {
      return {
        options: {
          ...prevOptions,
          cardNumber: rawValue,
          textOverrides: { ...prevOverrides, 'field:cardNumber': rawValue },
        },
      };
    }

    if (field === 'cardLevel') {
      return {
        options: {
          ...prevOptions,
          cardLevel: rawValue,
          textOverrides: { ...prevOverrides, 'field:cardLevel': rawValue },
        },
      };
    }

    const nextOverrides = { ...prevOverrides };
    if (rawValue === '') {
      nextOverrides[`field:${field}`] = '';
    } else {
      delete nextOverrides[`field:${field}`];
    }
    return {
      [field]: rawValue,
      options: {
        ...prevOptions,
        textOverrides: nextOverrides,
      },
    };
  }

  if (target.kind === 'option') {
    const optKey = target.optionKey;
    if (!NON_DATA_OPTION_KEYS.includes(optKey)) return null;
    const slotKey = target.slotKey || `option:${optKey}`;
    const currentVal = readTargetValue(props, target);
    if (rawValue === currentVal && prevOptions[optKey] === rawValue) {
      return null;
    }
    return {
      options: {
        ...prevOptions,
        [optKey]: rawValue,
        textOverrides: {
          ...prevOverrides,
          [slotKey]: rawValue,
        },
      },
    };
  }

  return null;
}

function findIslandElement(surfaceEl, entityId) {
  if (!surfaceEl || typeof surfaceEl.querySelector !== 'function') return null;
  return surfaceEl.querySelector(`[data-entity-id="${entityId}"]`);
}

function setActiveSlotOnIsland(surfaceEl, entityId, slotKey) {
  const islandEl = findIslandElement(surfaceEl, entityId);
  if (islandEl) {
    if (slotKey) islandEl.__ztdActiveEditSlot = slotKey;
    else delete islandEl.__ztdActiveEditSlot;
  }
  if (surfaceEl && typeof surfaceEl.querySelectorAll === 'function') {
    const allMatching = surfaceEl.querySelectorAll(`[data-entity-id="${entityId}"]`);
    for (const node of allMatching) {
      if (slotKey) node.__ztdActiveEditSlot = slotKey;
      else delete node.__ztdActiveEditSlot;
    }
  }
}

function findFieldElementInIsland(islandEl, field) {
  if (!islandEl || typeof islandEl.querySelector !== 'function') return null;
  const tagged = islandEl.querySelector(`[data-chart-field="${field}"]`);
  if (tagged) return tagged;
  if (field === 'title') {
    return islandEl.querySelector('.ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3');
  }
  if (field === 'subtitle') {
    const rows = islandEl.querySelectorAll?.('.ztd-card > header > div');
    return rows?.[1]?.querySelector?.('span:first-child') ?? null;
  }
  if (field === 'takeaway') {
    return islandEl.querySelector('.ztd-card > footer > span:first-child');
  }
  return null;
}

function findSlotElementInIsland(islandEl, target) {
  if (!islandEl || !target) return null;
  if (target.slotKey && typeof islandEl.querySelector === 'function') {
    const bySlot = islandEl.querySelector(`[data-chart-text-slot="${target.slotKey}"]`);
    if (bySlot) return bySlot;
  }
  if (target.kind === 'field' && target.field) {
    return findFieldElementInIsland(islandEl, target.field);
  }
  if (target.kind === 'option' && target.optionKey && typeof islandEl.querySelector === 'function') {
    return islandEl.querySelector(`[data-chart-option-field="${target.optionKey}"]`);
  }
  return null;
}

function isScreenReaderOrHidden(el) {
  let cur = el;
  while (cur) {
    if (cur.classList?.contains?.('ztd-sr')) return true;
    if (cur.getAttribute?.('aria-hidden') === 'true') return true;
    const tag = cur.tagName?.toLowerCase?.();
    if (tag === 'title' || tag === 'desc' || tag === 'defs') return true;
    cur = cur.parentElement;
  }
  return false;
}

function matchNonDataOptionKey(el, resolved) {
  if (!el) return null;
  const explicit = el.getAttribute?.('data-chart-option-field') ?? el.dataset?.chartOptionField;
  if (explicit && NON_DATA_OPTION_KEYS.includes(explicit)) {
    return explicit;
  }
  const text = (el.textContent ?? '').trim();
  if (!text) return null;
  // Never treat data cell values or numbers as non-data options
  const rows = resolved?.spec?.data ?? [];
  if (matchTextToChartData(text, rows, resolved?.localeTag) || parseDisplayedNumber(text) !== null) {
    return null;
  }
  for (const optKey of NON_DATA_OPTION_KEYS) {
    const optVal = resolved?.spec?.options?.[optKey];
    if (typeof optVal === 'string' && optVal.trim().length > 0 && optVal.trim() === text) {
      return optKey;
    }
  }
  return null;
}

/**
 * Returns true if `el` belongs to the chart's data area (SVG marks, data labels,
 * numeric values, axis ticks, or series legend items) and is NOT a non-data option label.
 */
function isDataAreaElement(el, resolved) {
  if (!el) return false;
  let cur = el;
  while (cur) {
    if (cur.dataset?.chartField && CARD_FIELDS.includes(cur.dataset.chartField)) {
      return false;
    }
    const optKey = matchNonDataOptionKey(cur, resolved);
    if (optKey) {
      return false;
    }
    const tag = cur.tagName?.toLowerCase?.();
    if (
      tag === 'svg'
      || tag === 'text'
      || tag === 'tspan'
      || tag === 'rect'
      || tag === 'path'
      || tag === 'circle'
      || tag === 'line'
      || tag === 'polygon'
      || tag === 'polyline'
      || tag === 'g'
      || tag === 'ul'
      || tag === 'li'
    ) {
      return true;
    }
    cur = cur.parentElement;
  }
  return false;
}

/**
 * Builds an editable target strictly for non-data elements (`title`, `subtitle`,
 * `takeaway`, `cardNumber`, `cardLevel`, and explicit non-data option labels).
 * Returns `null` for any data element.
 */
function buildNonDataTargetFromElement(islandEl, el, resolved) {
  if (!el || isScreenReaderOrHidden(el)) return null;

  const fieldEl = el.closest?.('[data-chart-field]') ?? (el.dataset?.chartField ? el : null);
  if (fieldEl) {
    const field = fieldEl.getAttribute?.('data-chart-field') ?? fieldEl.dataset?.chartField;
    if (CARD_FIELDS.includes(field)) {
      return {
        target: {
          kind: 'field',
          field,
          slotKey: `field:${field}`,
        },
        anchorEl: fieldEl,
      };
    }
  }

  const optEl = el.closest?.('[data-chart-option-field]') ?? (el.dataset?.chartOptionField ? el : null);
  if (optEl) {
    const optKey = optEl.getAttribute?.('data-chart-option-field') ?? optEl.dataset?.chartOptionField;
    if (NON_DATA_OPTION_KEYS.includes(optKey)) {
      return {
        target: {
          kind: 'option',
          optionKey: optKey,
          slotKey: `option:${optKey}`,
          initialValue: (optEl.textContent ?? '').trim(),
        },
        anchorEl: optEl,
      };
    }
  }

  const svgTextEl = el.closest?.('svg text') ?? (el.tagName?.toLowerCase?.() === 'text' ? el : null);
  if (svgTextEl) {
    const optKey = matchNonDataOptionKey(svgTextEl, resolved);
    if (optKey) {
      return {
        target: {
          kind: 'option',
          optionKey: optKey,
          slotKey: `option:${optKey}`,
          initialValue: (svgTextEl.textContent ?? '').trim(),
        },
        anchorEl: svgTextEl,
      };
    }
    // Data label, numeric value, or axis tick inside SVG -> not editable
    return null;
  }

  // Any other SVG mark or series legend item -> data area, not editable
  if (isDataAreaElement(el, resolved)) {
    return null;
  }

  const headerTitle = el.closest?.('.ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3');
  if (headerTitle) {
    return {
      target: { kind: 'field', field: 'title', slotKey: 'field:title' },
      anchorEl: headerTitle,
    };
  }

  const spanEl = el.closest?.('span');
  if (spanEl && islandEl?.contains?.(spanEl) && !isScreenReaderOrHidden(spanEl)) {
    const spanText = (spanEl.textContent ?? '').trim();
    if (spanText) {
      if (spanText === resolved.subtitle) {
        return {
          target: { kind: 'field', field: 'subtitle', slotKey: 'field:subtitle' },
          anchorEl: spanEl,
        };
      }
      if (spanText === resolved.takeaway) {
        return {
          target: { kind: 'field', field: 'takeaway', slotKey: 'field:takeaway' },
          anchorEl: spanEl,
        };
      }
      if (spanText === String(resolved.cardNumber ?? '')) {
        return {
          target: { kind: 'field', field: 'cardNumber', slotKey: 'field:cardNumber' },
          anchorEl: spanEl,
        };
      }
      if (spanText === String(resolved.cardLevel ?? '')) {
        return {
          target: { kind: 'field', field: 'cardLevel', slotKey: 'field:cardLevel' },
          anchorEl: spanEl,
        };
      }
    }
  }

  const headerEl = el.closest?.('.ztd-card > header');
  if (headerEl) {
    const titleEl = findFieldElementInIsland(islandEl, 'title') ?? headerEl;
    return {
      target: { kind: 'field', field: 'title', slotKey: 'field:title' },
      anchorEl: titleEl,
    };
  }

  const footerEl = el.closest?.('.ztd-card > footer');
  if (footerEl) {
    const takeawayEl = findFieldElementInIsland(islandEl, 'takeaway') ?? footerEl;
    return {
      target: { kind: 'field', field: 'takeaway', slotKey: 'field:takeaway' },
      anchorEl: takeawayEl,
    };
  }

  return null;
}

function resolveHitTargetInIsland(islandEl, clientX, clientY, eventTARGETS, props, bounds, worldPoint) {
  const resolved = resolveChartSpec(props);
  const doc = islandEl?.ownerDocument;

  const candidates = [];
  for (const t of eventTARGETS) {
    if (t && islandEl?.contains?.(t) && !candidates.includes(t)) {
      candidates.push(t);
    }
  }
  if (doc && typeof doc.elementsFromPoint === 'function' && Number.isFinite(clientX) && Number.isFinite(clientY)) {
    for (const el of doc.elementsFromPoint(clientX, clientY)) {
      if (islandEl?.contains?.(el) && !candidates.includes(el)) {
        candidates.push(el);
      }
    }
  } else if (doc && typeof doc.elementFromPoint === 'function' && Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const el = doc.elementFromPoint(clientX, clientY);
    if (el && islandEl?.contains?.(el) && !candidates.includes(el)) {
      candidates.push(el);
    }
  }

  // 1. Check direct DOM candidates first. If a candidate is a data element, reject immediately.
  for (const el of candidates) {
    if (el === islandEl) continue;
    const hit = buildNonDataTargetFromElement(islandEl, el, resolved);
    if (hit) return hit;
    if (isDataAreaElement(el, resolved)) {
      return null;
    }
  }

  // 2. Scan non-data text bounding rects when pointer capture retargeted `event.target` to the surface
  if (islandEl && typeof islandEl.querySelectorAll === 'function' && Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const nonDataNodes = islandEl.querySelectorAll(
      '[data-chart-field], [data-chart-option-field], .ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3',
    );
    let bestNode = null;
    let bestScore = Infinity;
    for (const node of nonDataNodes) {
      if (isScreenReaderOrHidden(node)) continue;
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      const pad = 8;
      if (
        clientX >= rect.left - pad
        && clientX <= rect.right + pad
        && clientY >= rect.top - pad
        && clientY <= rect.bottom + pad
      ) {
        const cx = (rect.left + rect.right) / 2;
        const cy = (rect.top + rect.bottom) / 2;
        const dist = Math.hypot(clientX - cx, clientY - cy);
        const area = rect.width * rect.height;
        const score = dist + area * 0.001;
        if (score < bestScore) {
          bestScore = score;
          bestNode = node;
        }
      }
    }
    if (bestNode) {
      const hit = buildNonDataTargetFromElement(islandEl, bestNode, resolved);
      if (hit) return hit;
    }

    // If the click was inside the SVG plot box (and didn't hit a non-data option label above)
    // or inside the data series legend `<ul>`, do not enter edit mode on the data area.
    const dataContainers = islandEl.querySelectorAll('svg, .ztd-card > header ul');
    for (const dataBox of dataContainers) {
      const rect = dataBox.getBoundingClientRect?.();
      if (
        rect
        && rect.width > 0
        && rect.height > 0
        && clientX >= rect.left
        && clientX <= rect.right
        && clientY >= rect.top
        && clientY <= rect.bottom
      ) {
        return null;
      }
    }

    const headerEl = islandEl.querySelector?.('.ztd-card > header');
    const headerRect = headerEl?.getBoundingClientRect?.();
    if (
      headerRect
      && headerRect.width > 0
      && headerRect.height > 0
      && clientX >= headerRect.left - 4
      && clientX <= headerRect.right + 4
      && clientY >= headerRect.top - 4
      && clientY <= headerRect.bottom + 4
    ) {
      return {
        target: { kind: 'field', field: 'title', slotKey: 'field:title' },
        anchorEl: findFieldElementInIsland(islandEl, 'title') ?? headerEl,
      };
    }

    const footerEl = islandEl.querySelector?.('.ztd-card > footer');
    const footerRect = footerEl?.getBoundingClientRect?.();
    if (
      footerRect
      && footerRect.width > 0
      && footerRect.height > 0
      && clientX >= footerRect.left - 4
      && clientX <= footerRect.right + 4
      && clientY >= footerRect.top - 4
      && clientY <= footerRect.bottom + 4
    ) {
      return {
        target: { kind: 'field', field: 'takeaway', slotKey: 'field:takeaway' },
        anchorEl: findFieldElementInIsland(islandEl, 'takeaway') ?? footerEl,
      };
    }
  }

  // 3. Fallback by local Y coordinate within the card non-data header/footer zones
  if (bounds && worldPoint && resolved.variant === 'card') {
    const localY = worldPoint.y - bounds.y;
    const hasSubtitle = Boolean(resolved.subtitle);
    const hasLegend = (resolved.legendItems?.length ?? 0) > 0;
    const headerBottom = 56 + (hasSubtitle ? 22 : 0) + (hasLegend ? 20 : 0);
    const footerTop = bounds.height - 52;

    if (localY >= 40 && localY <= headerBottom && hasSubtitle) {
      return {
        target: { kind: 'field', field: 'subtitle', slotKey: 'field:subtitle' },
        anchorEl: findFieldElementInIsland(islandEl, 'subtitle'),
      };
    }
    if (localY >= footerTop) {
      return {
        target: { kind: 'field', field: 'takeaway', slotKey: 'field:takeaway' },
        anchorEl: findFieldElementInIsland(islandEl, 'takeaway'),
      };
    }
    if (localY <= headerBottom) {
      return {
        target: { kind: 'field', field: 'title', slotKey: 'field:title' },
        anchorEl: findFieldElementInIsland(islandEl, 'title'),
      };
    }
    // Clicked inside the central data plot region -> only open if there is no SVG mounted in the island
    if (islandEl?.querySelector?.('svg')) {
      return null;
    }
  }

  return {
    target: { kind: 'field', field: 'title', slotKey: 'field:title' },
    anchorEl: findFieldElementInIsland(islandEl, 'title'),
  };
}

function captureAnchorMetrics(islandEl, anchorEl, target, resolved, zoom) {
  const doc = islandEl?.ownerDocument ?? anchorEl?.ownerDocument;
  const win = doc?.defaultView ?? globalThis;
  const cs = anchorEl && typeof win.getComputedStyle === 'function' ? win.getComputedStyle(anchorEl) : null;
  const isSvgText = anchorEl?.tagName?.toLowerCase?.() === 'text';

  let textAlign = 'left';
  if (isSvgText) {
    const anchorAttr = anchorEl.getAttribute?.('text-anchor') || cs?.textAnchor || 'start';
    if (anchorAttr === 'middle') textAlign = 'center';
    else if (anchorAttr === 'end') textAlign = 'right';
  } else if (cs?.textAlign && ['left', 'center', 'right'].includes(cs.textAlign)) {
    textAlign = cs.textAlign;
  }

  let baseFontSize = parseFloat(anchorEl?.getAttribute?.('font-size') ?? '') || parseFloat(cs?.fontSize ?? '');
  if (!Number.isFinite(baseFontSize) || baseFontSize <= 0) {
    if (target.kind === 'field') {
      baseFontSize = target.field === 'title' ? 22 : target.field === 'takeaway' || target.field === 'cardNumber' ? 17 : 12.5;
    } else {
      baseFontSize = 11.5;
    }
  }

  const fontWeight = anchorEl?.getAttribute?.('font-weight')
    || cs?.fontWeight
    || (target.kind === 'field' && (target.field === 'title' || target.field === 'takeaway') ? '800' : '500');

  const fontFamily = cs?.fontFamily
    || resolved.resolvedTheme.fontFamily
    || 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

  const letterSpacing = cs?.letterSpacing || 'normal';

  let color = resolved.resolvedTheme.ink;
  if (isSvgText) {
    const fillAttr = anchorEl.getAttribute?.('fill');
    const csFill = cs?.fill;
    if (csFill && csFill !== 'none' && !csFill.startsWith('url(')) {
      color = csFill;
    } else if (fillAttr && fillAttr !== 'none' && !fillAttr.startsWith('url(')) {
      color = fillAttr;
    }
  } else if (cs?.color) {
    color = cs.color;
  }

  let svgScaleRatio = 1;
  if (isSvgText) {
    const svgEl = anchorEl.closest?.('svg');
    const svgRect = svgEl?.getBoundingClientRect?.();
    const vbAttr = svgEl?.getAttribute?.('viewBox');
    const vbParts = vbAttr ? vbAttr.trim().split(/[\s,]+/).map(Number) : null;
    if (svgRect && svgRect.width > 0 && vbParts && vbParts.length === 4 && vbParts[2] > 0) {
      svgScaleRatio = (svgRect.width / zoom) / vbParts[2];
    }
  }

  const islandRect = islandEl?.getBoundingClientRect?.();
  const elRect = anchorEl?.getBoundingClientRect?.();
  let relBox = null;
  if (elRect && elRect.width > 0 && elRect.height > 0) {
    const baseLeft = islandRect && islandRect.width > 0 ? islandRect.left : 0;
    const baseTop = islandRect && islandRect.height > 0 ? islandRect.top : 0;
    relBox = {
      hasIslandOrigin: Boolean(islandRect && islandRect.width > 0),
      left: (elRect.left - baseLeft) / zoom,
      top: (elRect.top - baseTop) / zoom,
      width: elRect.width / zoom,
      height: elRect.height / zoom,
    };
  }

  return {
    isSvgText,
    textAlign,
    baseFontSize,
    fontWeight,
    fontFamily,
    letterSpacing,
    color,
    svgScaleRatio,
    relBox,
  };
}

function estimateTextPixelWidth(text, fontSizePx) {
  const str = String(text ?? '');
  let units = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    units += code > 255 ? 0.95 : 0.62;
  }
  return Math.ceil(Math.max(1.5, units + 0.8) * fontSizePx);
}

function resolveToolSurface(provider) {
  const active = provider?.get?.();
  if (active?.surface?.hud && active?.surface?.element) {
    return active;
  }
  return null;
}

/**
 * Mounts a seamless, zero-chrome inline text editor onto the active Alid canvas HUD
 * so non-data text areas of a chart (`title`, `subtitle`, `takeaway`, `cardNumber`,
 * `cardLevel`, and explicit non-data option labels) can be edited in place via
 * double-click or `Enter`.
 */
export function mountInlineEditor(context) {
  const provider = context?.services?.get?.('canvas.active-tool-surface');
  const frames = context?.services?.get?.('canvas.frames');
  const textHistory = context?.services?.get?.('canvas.text-history');

  let closeCurrent = () => {};
  let openCurrent = () => false;
  let detachCurrent = () => {};
  let mountedSurfaceEl = null;

  function mount() {
    const s = resolveToolSurface(provider);
    if (!s?.surface?.hud || !s?.surface?.element || typeof document === 'undefined') {
      closeCurrent();
      detachCurrent();
      mountedSurfaceEl = null;
      return;
    }
    if (mountedSurfaceEl === s.surface.element) {
      return;
    }

    closeCurrent();
    detachCurrent();
    mountedSurfaceEl = s.surface.element;

    let session = null;
    let composing = false;
    let offWorld = () => {};
    let lastOpenedAt = 0;
    let downState = null;
    let lastTap = null;

    const doc = s.surface.hud.ownerDocument ?? document;
    const container = doc.createElement('div');
    container.dataset.canvasUi = 'true';
    container.dataset.ztdChartEditorContainer = 'true';
    Object.assign(container.style, {
      position: 'absolute',
      display: 'none',
      pointerEvents: 'auto',
      zIndex: '25',
      boxSizing: 'border-box',
      background: 'transparent',
      border: 'none',
      padding: '0',
      margin: '0',
    });

    const input = doc.createElement('input');
    input.type = 'text';
    input.dataset.canvasEditor = 'true';
    input.dataset.ztdChartEditor = 'true';
    input.dataset.escapeOwner = 'true';
    input.spellcheck = false;
    input.setAttribute('aria-label', '차트 텍스트 편집');
    Object.assign(input.style, {
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      margin: '0',
      padding: '0',
      border: 'none',
      borderRadius: '0',
      outline: 'none',
      background: 'transparent',
      boxShadow: 'none',
      fontVariantNumeric: 'tabular-nums',
    });

    container.append(input);
    s.surface.hud.append(container);

    let hiddenElements = [];
    function restoreHiddenElements(entityId) {
      if (entityId) {
        setActiveSlotOnIsland(s.surface.element, entityId, null);
      }
      for (const el of hiddenElements) {
        if (el && el.style) el.style.opacity = '';
        if (el && el.dataset) delete el.dataset.hiddenByEditor;
      }
      hiddenElements = [];
    }

    function hideTargetElement(el) {
      if (!el || !el.style) return;
      el.style.opacity = '0';
      if (el.dataset) el.dataset.hiddenByEditor = 'true';
      if (!hiddenElements.includes(el)) {
        hiddenElements.push(el);
      }
    }

    function positionEditor() {
      if (!session) return;
      const props = context.world.getCanonical?.(session.id, CHART_ASPECT_ID);
      if (!props) return;

      const hudRect = s.surface.hud.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0, height: 0 };
      const zoom = Math.max(0.1, s.host?.getZoom?.() ?? 1);
      const islandEl = findIslandElement(s.surface.element, session.id);

      if (session.target.slotKey) {
        setActiveSlotOnIsland(s.surface.element, session.id, session.target.slotKey);
      }

      const liveTargetEl = findSlotElementInIsland(islandEl, session.target) ?? session.anchorEl;
      if (liveTargetEl) {
        hideTargetElement(liveTargetEl);
      }

      const metrics = session.metrics;
      const scale = zoom * (metrics.svgScaleRatio || 1);
      const fontSizePx = Math.max(10, Math.round(metrics.baseFontSize * scale * 10) / 10);

      Object.assign(input.style, {
        fontFamily: metrics.fontFamily,
        fontSize: `${fontSizePx}px`,
        fontWeight: String(metrics.fontWeight),
        letterSpacing: metrics.letterSpacing,
        color: metrics.color,
        caretColor: metrics.color,
        textAlign: metrics.textAlign,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
      });

      const islandRect = islandEl?.getBoundingClientRect?.();
      const relBox = metrics.relBox;

      if (relBox) {
        const originLeft = relBox.hasIslandOrigin && islandRect ? islandRect.left : 0;
        const originTop = relBox.hasIslandOrigin && islandRect ? islandRect.top : 0;
        const screenLeft = originLeft + relBox.left * zoom - hudRect.left;
        const screenTop = originTop + relBox.top * zoom - hudRect.top;
        const baseWidth = relBox.width * zoom;
        const baseHeight = Math.max(fontSizePx * 1.25, relBox.height * zoom);
        const textPxWidth = estimateTextPixelWidth(input.value, fontSizePx);
        const boxWidth = Math.max(baseWidth + 16, textPxWidth + 20, 36);
        const boxHeight = Math.max(18, Math.ceil(baseHeight + 4));

        let left = screenLeft;
        if (metrics.textAlign === 'center') {
          const centerX = screenLeft + baseWidth / 2;
          left = centerX - boxWidth / 2;
        } else if (metrics.textAlign === 'right') {
          const rightX = screenLeft + baseWidth;
          left = rightX - boxWidth;
        }

        container.style.left = `${Math.round(left * 10) / 10}px`;
        container.style.top = `${Math.round((screenTop - (boxHeight - relBox.height * zoom) / 2) * 10) / 10}px`;
        container.style.width = `${Math.ceil(boxWidth)}px`;
        container.style.height = `${boxHeight}px`;
        container.style.transform = 'none';
        input.style.lineHeight = `${boxHeight}px`;
        return;
      }

      // Fallback world-coordinate placement when editing an empty field via Enter
      const b = getChartWorldBounds(context.world, session.id, props);
      const wx = Number.isFinite(b?.x) ? b.x : 0;
      const wy = Number.isFinite(b?.y) ? b.y : 0;
      const ww = Number.isFinite(b?.width) ? b.width : 480;
      const wh = Number.isFinite(b?.height) ? b.height : 340;

      const topLeft = { x: 0, y: 0 };
      const bottomRight = { x: 0, y: 0 };
      s.host?.worldToScreen?.(wx, wy, topLeft);
      s.host?.worldToScreen?.(wx + ww, wy + wh, bottomRight);
      const boxLeft = topLeft.x - hudRect.left;
      const boxTop = topLeft.y - hudRect.top;
      const boxWidth = Math.max(160, bottomRight.x - topLeft.x);
      const boxHeight = Math.max(120, bottomRight.y - topLeft.y);

      const field = session.target.field ?? 'title';
      const yOffset = field === 'title' || field === 'cardNumber'
        ? 18 * zoom
        : field === 'subtitle'
          ? 46 * zoom
          : boxHeight - 36 * zoom;
      const h = Math.max(22, Math.ceil(fontSizePx * 1.35));

      container.style.left = `${boxLeft + 20 * zoom}px`;
      container.style.top = `${boxTop + yOffset}px`;
      container.style.width = `${Math.max(120, boxWidth - 40 * zoom)}px`;
      container.style.height = `${h}px`;
      container.style.transform = 'none';
      input.style.lineHeight = `${h}px`;
    }

    function applyDraftValue(rawValue) {
      if (!session || !context.world.isAlive?.(session.id)) return;
      const props = context.world.getCanonical?.(session.id, CHART_ASPECT_ID);
      if (!props) return;

      const patch = buildPatchForTarget(props, session.target, rawValue);
      if (!patch) {
        session.base = rawValue;
        return;
      }

      session.writing = true;
      try {
        textHistory?.change?.();
        context.world.applyCanonicalTransaction(`${EXTENSION_ID}:inline-edit`, [
          {
            id: session.id,
            aspect: CHART_ASPECT_ID,
            patch,
          },
        ]);
        session.base = rawValue;
        s.host?.requestRender?.();
      } finally {
        session.writing = false;
      }
    }

    function finish(commit) {
      if (!session) return;
      const ending = session;
      session = null;
      composing = false;
      offWorld();
      offWorld = () => {};
      restoreHiddenElements(ending.id);
      container.style.display = 'none';

      if (commit && context.world.isAlive?.(ending.id)) {
        const props = context.world.getCanonical?.(ending.id, CHART_ASPECT_ID);
        if (props) {
          const patch = buildPatchForTarget(props, ending.target, input.value);
          if (patch) {
            textHistory?.change?.();
            context.world.applyCanonicalTransaction(`${EXTENSION_ID}:inline-edit`, [
              {
                id: ending.id,
                aspect: CHART_ASPECT_ID,
                patch,
              },
            ]);
          }
        }
      }
      textHistory?.seal?.();
      if (doc.activeElement === input) {
        input.blur?.();
      }
      s.host?.requestRender?.();
    }

    function startEditing(entityId, target, explicitAnchorEl = null) {
      if (!entityId || !target || !context.world.isAlive?.(entityId)) return false;
      if (context.world.isEntityReadOnly?.(entityId)) return false;
      const props = context.world.getCanonical?.(entityId, CHART_ASPECT_ID);
      if (!props) return false;

      if (session) {
        finish(true);
      }

      const resolved = resolveChartSpec(props);
      const zoom = Math.max(0.1, s.host?.getZoom?.() ?? 1);
      const islandEl = findIslandElement(s.surface.element, entityId);
      const anchorEl = explicitAnchorEl ?? findSlotElementInIsland(islandEl, target);
      const metrics = captureAnchorMetrics(islandEl, anchorEl, target, resolved, zoom);
      const initial = readTargetValue(props, target);

      if (target.slotKey) {
        setActiveSlotOnIsland(s.surface.element, entityId, target.slotKey);
      }
      if (anchorEl) {
        hideTargetElement(anchorEl);
      }

      session = {
        id: entityId,
        target,
        anchorEl,
        metrics,
        base: initial,
        writing: false,
      };
      lastOpenedAt = Date.now();

      input.value = initial;
      container.style.display = 'block';
      positionEditor();
      input.focus?.();
      input.select?.();
      queueMicrotask(() => {
        if (session && session.id === entityId && doc.activeElement !== input) {
          input.focus?.();
          input.select?.();
        }
      });

      offWorld = context.world.subscribe?.(() => {
        if (!session || session.writing) return;
        if (!context.world.isAlive?.(session.id)) {
          finish(false);
          return;
        }
        const latestProps = context.world.getCanonical?.(session.id, CHART_ASPECT_ID);
        if (!latestProps) {
          finish(false);
          return;
        }
        const remote = readTargetValue(latestProps, session.target);
        if (remote !== session.base) {
          const next = mergeDraft(session.base, input.value, remote);
          session.base = remote;
          if (!composing && input.value !== next) {
            input.value = next;
          }
        }
        positionEditor();
      }) ?? (() => {});

      return true;
    }

    function cycleEditableTarget(step) {
      if (!session) return;
      const entityId = session.id;
      const props = context.world.getCanonical?.(entityId, CHART_ASPECT_ID);
      if (!props) return;
      const resolved = resolveChartSpec(props);
      const islandEl = findIslandElement(s.surface.element, entityId);

      if (islandEl && typeof islandEl.querySelectorAll === 'function') {
        const nodes = Array.from(
          islandEl.querySelectorAll('[data-chart-field], [data-chart-option-field]'),
        ).filter(el => !isScreenReaderOrHidden(el));

        const uniqueSlots = [];
        const seen = new Set();
        for (const el of nodes) {
          const hit = buildNonDataTargetFromElement(islandEl, el, resolved);
          if (!hit || !hit.target.slotKey || seen.has(hit.target.slotKey)) continue;
          seen.add(hit.target.slotKey);
          uniqueSlots.push(hit);
        }

        if (uniqueSlots.length > 1) {
          const currentIdx = uniqueSlots.findIndex(item => item.target.slotKey === session.target.slotKey);
          const nextIdx = ((currentIdx >= 0 ? currentIdx : 0) + step + uniqueSlots.length) % uniqueSlots.length;
          const nextHit = uniqueSlots[nextIdx];
          startEditing(entityId, nextHit.target, nextHit.anchorEl);
          return;
        }
      }

      const basicFields = ['title', 'subtitle', 'takeaway'];
      const currentField = session.target.field ?? 'title';
      const idx = Math.max(0, basicFields.indexOf(currentField));
      const nextField = basicFields[(idx + step + basicFields.length) % basicFields.length];
      startEditing(entityId, { kind: 'field', field: nextField, slotKey: `field:${nextField}` });
    }

    function resolveChartEntityAtPoint(clientX, clientY, candidateTargets) {
      const worldPoint = { x: 0, y: 0 };
      if (Number.isFinite(clientX) && Number.isFinite(clientY) && s.host?.screenToWorld) {
        s.host.screenToWorld(clientX, clientY, worldPoint);
      }

      // 1. Check candidate targets (event.target, captured pointerdown target)
      for (const candidate of candidateTargets) {
        if (!candidate || typeof candidate.closest !== 'function') continue;
        const island = candidate.closest('[data-entity-id]');
        const id = island?.getAttribute?.('data-entity-id') ?? island?.dataset?.entityId;
        if (id && context.world.getCanonical?.(id, CHART_ASPECT_ID)) {
          return {
            hitId: id,
            hitBounds: getChartWorldBounds(context.world, id),
            worldPoint,
          };
        }
      }

      // 2. Check elementsFromPoint / elementFromPoint at (clientX, clientY)
      if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        const pointEls = typeof doc.elementsFromPoint === 'function'
          ? doc.elementsFromPoint(clientX, clientY)
          : typeof doc.elementFromPoint === 'function'
            ? [doc.elementFromPoint(clientX, clientY)].filter(Boolean)
            : [];
        for (const el of pointEls) {
          if (!el || typeof el.closest !== 'function') continue;
          const island = el.closest('[data-entity-id]');
          const id = island?.getAttribute?.('data-entity-id') ?? island?.dataset?.entityId;
          if (id && context.world.getCanonical?.(id, CHART_ASPECT_ID)) {
            return {
              hitId: id,
              hitBounds: getChartWorldBounds(context.world, id),
              worldPoint,
            };
          }
        }
      }

      // 3. Check world-space bounds across selected and live chart entities
      const selected = s.selection?.getSelection?.() ?? [];
      const ids = [
        ...selected,
        ...(context.world.listEntityIds?.() ?? []),
      ];
      const visited = new Set();
      for (const id of ids) {
        if (!id || visited.has(id)) continue;
        visited.add(id);
        const props = context.world.getCanonical?.(id, CHART_ASPECT_ID);
        if (!props) continue;
        const b = getChartWorldBounds(context.world, id, props);
        if (
          b
          && worldPoint.x >= b.x
          && worldPoint.x <= b.x + b.width
          && worldPoint.y >= b.y
          && worldPoint.y <= b.y + b.height
        ) {
          return { hitId: id, hitBounds: b, worldPoint };
        }
      }

      // 4. Check mounted DOM island bounding rects as final fallback
      if (Number.isFinite(clientX) && Number.isFinite(clientY) && typeof s.surface.element.querySelectorAll === 'function') {
        const islands = s.surface.element.querySelectorAll('[data-entity-id]');
        for (const node of islands) {
          const id = node.getAttribute?.('data-entity-id') ?? node.dataset?.entityId;
          if (!id || !context.world.getCanonical?.(id, CHART_ASPECT_ID)) continue;
          const rect = node.getBoundingClientRect?.();
          if (
            rect
            && rect.width > 0
            && rect.height > 0
            && clientX >= rect.left
            && clientX <= rect.right
            && clientY >= rect.top
            && clientY <= rect.bottom
          ) {
            return {
              hitId: id,
              hitBounds: getChartWorldBounds(context.world, id),
              worldPoint,
            };
          }
        }
      }

      return { hitId: null, hitBounds: null, worldPoint };
    }

    function tryOpenAtPoint(clientX, clientY, candidateTargets, sourceEvent) {
      if (composing) return false;
      for (const t of candidateTargets) {
        if (t && container.contains?.(t)) return false;
      }

      const { hitId, hitBounds, worldPoint } = resolveChartEntityAtPoint(clientX, clientY, candidateTargets);
      if (!hitId) return false;
      const props = context.world.getCanonical?.(hitId, CHART_ASPECT_ID);
      if (!props) return false;

      const islandEl = findIslandElement(s.surface.element, hitId);
      const hit = resolveHitTargetInIsland(
        islandEl,
        clientX,
        clientY,
        candidateTargets,
        props,
        hitBounds,
        worldPoint,
      );
      if (!hit || !hit.target) return false;

      sourceEvent?.preventDefault?.();
      sourceEvent?.stopPropagation?.();
      return startEditing(hitId, hit.target, hit.anchorEl);
    }

    const locked = e => Boolean(composing || e?.isComposing || e?.keyCode === 229);

    const onCompositionStart = () => {
      composing = true;
    };

    const onCompositionEnd = () => {
      composing = false;
      if (session) {
        applyDraftValue(input.value);
        positionEditor();
      }
    };

    const onInput = e => {
      if (!session) return;
      positionEditor();
      if (composing || e?.isComposing) return;
      applyDraftValue(input.value);
      positionEditor();
    };

    const onKeyDown = e => {
      if (!session) return;
      if (locked(e)) {
        e.stopPropagation?.();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault?.();
        e.stopPropagation?.();
        cycleEditableTarget(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault?.();
        e.stopPropagation?.();
        finish(e.key === 'Enter');
      }
    };

    const onBlur = () => {
      if (composing) return;
      if (Date.now() - lastOpenedAt < 80) return;
      finish(true);
    };

    const onPointerDown = e => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target && container.contains?.(e.target)) return;
      if (session && !composing) {
        finish(true);
      }
      downState = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        target: e.target,
        time: Date.now(),
      };
    };

    const onPointerUp = e => {
      if (!downState || (e.pointerId !== undefined && downState.pointerId !== e.pointerId)) return;
      const currentDown = downState;
      downState = null;
      if (e.button !== undefined && e.button !== 0) return;

      const moved = Number.isFinite(e.clientX) && Number.isFinite(currentDown.x)
        ? Math.hypot(e.clientX - currentDown.x, e.clientY - currentDown.y)
        : 0;
      if (moved > 6) {
        lastTap = null;
        return;
      }

      const now = Date.now();
      const prevTap = lastTap;
      if (
        prevTap
        && now - prevTap.time <= 380
        && (!Number.isFinite(e.clientX) || Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) <= 8)
      ) {
        lastTap = null;
        const cx = e.clientX;
        const cy = e.clientY;
        const targets = [currentDown.target, prevTap.target, e.target].filter(Boolean);
        // Run after select-suite finishes releasing pointer capture on pointerup
        queueMicrotask(() => {
          if (Date.now() - lastOpenedAt < 200) return;
          tryOpenAtPoint(cx, cy, targets, null);
        });
        return;
      }

      lastTap = {
        time: now,
        x: e.clientX,
        y: e.clientY,
        target: currentDown.target ?? e.target,
      };
    };

    const onDoubleClick = e => {
      if (e.defaultPrevented || composing) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (session && Date.now() - lastOpenedAt < 250) {
        e.preventDefault?.();
        e.stopPropagation?.();
        input.focus?.();
        return;
      }
      const now = Date.now();
      const recentTapTarget =
        lastTap
        && now - lastTap.time <= 400
        && (!Number.isFinite(e.clientX) || Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) <= 8)
          ? lastTap.target
          : null;
      const recentDownTarget =
        downState
        && now - downState.time <= 400
        && (!Number.isFinite(e.clientX) || Math.hypot(e.clientX - downState.x, e.clientY - downState.y) <= 8)
          ? downState.target
          : null;
      lastTap = null;
      downState = null;
      const targets = [e.target, recentDownTarget, recentTapTarget].filter(Boolean);
      tryOpenAtPoint(e.clientX, e.clientY, targets, e);
    };

    const offFrame = frames?.subscribe?.(() => {
      mount();
      if (session) positionEditor();
    }) ?? (() => {});

    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('blur', onBlur);
    s.surface.element.addEventListener('pointerdown', onPointerDown, true);
    s.surface.element.addEventListener('pointerup', onPointerUp, true);
    s.surface.element.addEventListener('dblclick', onDoubleClick, true);

    closeCurrent = () => finish(true);
    openCurrent = (entityId, field = 'title') => {
      const targetId = entityId ?? (s.selection?.getSelection?.() ?? []).find(
        id => Boolean(context.world.getCanonical?.(id, CHART_ASPECT_ID)),
      );
      if (!targetId) return false;
      const safeField = CARD_FIELDS.includes(field) ? field : 'title';
      return startEditing(targetId, { kind: 'field', field: safeField, slotKey: `field:${safeField}` });
    };
    detachCurrent = () => {
      offFrame();
      offWorld();
      if (session) {
        restoreHiddenElements(session.id);
      }
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionend', onCompositionEnd);
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('blur', onBlur);
      s.surface.element.removeEventListener('pointerdown', onPointerDown, true);
      s.surface.element.removeEventListener('pointerup', onPointerUp, true);
      s.surface.element.removeEventListener('dblclick', onDoubleClick, true);
      container.remove();
    };
  }

  mount();
  const offSurface = provider?.subscribe?.(() => mount()) ?? (() => {});

  return {
    open(entityId, field = 'title') {
      mount();
      return openCurrent(entityId, field);
    },
    close() {
      closeCurrent();
    },
    dispose() {
      offSurface();
      closeCurrent();
      detachCurrent();
      mountedSurfaceEl = null;
    },
  };
}
