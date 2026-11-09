import { CHART_ASPECT_ID, EXTENSION_ID } from './manifest.js';
import { resolveChartSpec } from './model.js';

const CARD_FIELDS = Object.freeze(['title', 'subtitle', 'takeaway', 'cardNumber', 'cardLevel']);

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
 * Matches a clicked text string from inside the chart SVG or legend to data cells in `rows`.
 */
export function matchTextToChartData(rawText, rows, localeTag = 'ko-KR') {
  if (typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  if (!trimmed || !Array.isArray(rows) || rows.length === 0) return null;

  // 1. Check exact string cell matches (categories, series names, stages, nodes)
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

  // 2. Check numeric cell matches (bar/line/pie values, KPI numbers, signed waterfall deltas)
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

  if (target.kind === 'data') {
    const rows = resolved.spec.data ?? [];
    const row = rows[target.rowIndex];
    if (!row || typeof row !== 'object') return target.initialValue ?? '';
    const val = row[target.colKey];
    return val !== undefined && val !== null ? String(val) : '';
  }

  if (target.kind === 'override') {
    if (target.baseText && textOverrides[`text:${target.baseText}`] !== undefined) {
      return String(textOverrides[`text:${target.baseText}`]);
    }
    return String(target.initialValue ?? target.baseText ?? '');
  }

  return '';
}

function buildPatchForTarget(props, target, rawValue) {
  if (!props || !target) return null;
  const resolved = resolveChartSpec(props);
  const prevOptions = isPlainRecord(props.options) ? { ...props.options } : {};
  const prevOverrides = isPlainRecord(prevOptions.textOverrides) ? { ...prevOptions.textOverrides } : {};

  if (target.kind === 'field') {
    const field = target.field;
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

  if (target.kind === 'data') {
    const sourceRows = resolved.spec.data ?? [];
    const nextRows = sourceRows.map(row => ({ ...row }));
    const nextOptions = { ...prevOptions };
    const nextOverrides = { ...prevOverrides };

    if (target.cellKind === 'number') {
      const num = parseDisplayedNumber(rawValue);
      if (num !== null && sourceRows.length > 0) {
        let changed = false;
        for (const m of target.matches) {
          if (nextRows[m.rowIndex] && nextRows[m.rowIndex][m.colKey] !== num) {
            nextRows[m.rowIndex][m.colKey] = num;
            changed = true;
          }
        }
        if (target.slotKey && nextOverrides[target.slotKey] !== undefined) {
          delete nextOverrides[target.slotKey];
          changed = true;
        }
        if (!changed) return null;
        return {
          data: nextRows,
          encoding: { ...(resolved.spec.encoding ?? {}) },
          options: { ...nextOptions, textOverrides: nextOverrides },
        };
      }
      // Non-numeric text entered into a numeric label: store as a display text override
      const slotKey = target.slotKey || `text:${target.baseText || target.initialValue}`;
      if (nextOverrides[slotKey] === rawValue) return null;
      nextOverrides[slotKey] = rawValue;
      return {
        options: { ...nextOptions, textOverrides: nextOverrides },
      };
    }

    // String data cell
    if (rawValue.trim().length > 0 && sourceRows.length > 0) {
      let changed = false;
      const oldCellVal = String(sourceRows[target.rowIndex]?.[target.colKey] ?? '');
      for (const m of target.matches) {
        if (nextRows[m.rowIndex] && nextRows[m.rowIndex][m.colKey] !== rawValue) {
          nextRows[m.rowIndex][m.colKey] = rawValue;
          changed = true;
        }
      }
      if (oldCellVal && nextOptions.highlight === oldCellVal) {
        nextOptions.highlight = rawValue;
        changed = true;
      }
      if (target.slotKey && nextOverrides[target.slotKey] !== undefined) {
        delete nextOverrides[target.slotKey];
        changed = true;
      }
      if (oldCellVal && nextOverrides[`text:${oldCellVal}`] !== undefined) {
        delete nextOverrides[`text:${oldCellVal}`];
        changed = true;
      }
      if (!changed) return null;
      return {
        data: nextRows,
        encoding: { ...(resolved.spec.encoding ?? {}) },
        options: { ...nextOptions, textOverrides: nextOverrides },
      };
    }

    // Empty string while typing: hold in textOverrides so chart validation never breaks
    const slotKey = target.slotKey || `text:${target.baseText || target.initialValue}`;
    if (nextOverrides[slotKey] === rawValue) return null;
    nextOverrides[slotKey] = rawValue;
    return {
      options: { ...nextOptions, textOverrides: nextOverrides },
    };
  }

  if (target.kind === 'override') {
    const slotKey = target.slotKey || `text:${target.baseText || target.initialValue}`;
    const nextOptions = { ...prevOptions };
    const nextOverrides = { ...prevOverrides };

    for (const optKey of ['centerLabel', 'label', 'xLabel', 'yLabel', 'note']) {
      if (
        typeof resolved.spec?.options?.[optKey] === 'string'
        && resolved.spec.options[optKey].trim() === (target.baseText ?? '').trim()
      ) {
        nextOptions[optKey] = rawValue;
      }
    }

    if (nextOverrides[slotKey] === rawValue) return null;
    nextOverrides[slotKey] = rawValue;
    return {
      options: { ...nextOptions, textOverrides: nextOverrides },
    };
  }

  return null;
}

function findIslandElement(surfaceEl, entityId) {
  if (!surfaceEl || typeof surfaceEl.querySelector !== 'function') return null;
  return surfaceEl.querySelector(`[data-entity-id="${entityId}"]`);
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
  if (target.slotKey?.startsWith('svg:') && typeof islandEl.querySelectorAll === 'function') {
    const idx = Number(target.slotKey.slice(4));
    const svgTexts = islandEl.querySelectorAll('svg text');
    if (Number.isInteger(idx) && svgTexts[idx]) return svgTexts[idx];
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

function inferSlotKeyForElement(islandEl, el) {
  if (!el) return null;
  if (el.dataset?.chartTextSlot) return el.dataset.chartTextSlot;
  if (el.dataset?.chartField) return `field:${el.dataset.chartField}`;
  if (el.tagName?.toLowerCase?.() === 'text' && islandEl && typeof islandEl.querySelectorAll === 'function') {
    const list = Array.from(islandEl.querySelectorAll('svg text'));
    const idx = list.indexOf(el);
    if (idx >= 0) return `svg:${idx}`;
  }
  return null;
}

function buildTargetFromElement(islandEl, el, resolved) {
  if (!el || isScreenReaderOrHidden(el)) return null;
  const rows = resolved.spec.data ?? [];

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

  const svgTextEl = el.closest?.('svg text') ?? (el.tagName?.toLowerCase?.() === 'text' ? el : null);
  if (svgTextEl && !isScreenReaderOrHidden(svgTextEl)) {
    const displayedText = (svgTextEl.textContent ?? '').trim();
    const baseText = (svgTextEl.dataset?.baseText ?? displayedText).trim();
    const slotKey = inferSlotKeyForElement(islandEl, svgTextEl) || `text:${baseText || displayedText}`;
    const matched = matchTextToChartData(baseText, rows, resolved.localeTag)
      ?? matchTextToChartData(displayedText, rows, resolved.localeTag);

    if (matched) {
      return {
        target: {
          ...matched,
          slotKey,
          baseText: baseText || displayedText,
          initialValue: matched.cellKind === 'number' ? matched.initialValue : (displayedText || matched.initialValue),
        },
        anchorEl: svgTextEl,
      };
    }

    return {
      target: {
        kind: 'override',
        slotKey,
        baseText: baseText || displayedText,
        initialValue: displayedText || baseText,
      },
      anchorEl: svgTextEl,
    };
  }

  const slotEl = el.closest?.('[data-chart-text-slot]') ?? (el.dataset?.chartTextSlot ? el : null);
  if (slotEl && !isScreenReaderOrHidden(slotEl)) {
    const slotKey = slotEl.getAttribute?.('data-chart-text-slot') ?? slotEl.dataset?.chartTextSlot;
    if (slotKey?.startsWith('field:')) {
      const field = slotKey.slice(6);
      if (CARD_FIELDS.includes(field)) {
        return {
          target: { kind: 'field', field, slotKey },
          anchorEl: slotEl,
        };
      }
    }
    const displayedText = (slotEl.textContent ?? '').trim();
    const baseText = (slotEl.dataset?.baseText ?? displayedText).trim();
    const matched = matchTextToChartData(baseText, rows, resolved.localeTag)
      ?? matchTextToChartData(displayedText, rows, resolved.localeTag);
    if (matched) {
      return {
        target: {
          ...matched,
          slotKey,
          baseText: baseText || displayedText,
          initialValue: displayedText || matched.initialValue,
        },
        anchorEl: slotEl,
      };
    }
    return {
      target: {
        kind: 'override',
        slotKey,
        baseText: baseText || displayedText,
        initialValue: displayedText || baseText,
      },
      anchorEl: slotEl,
    };
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
      const matched = matchTextToChartData(spanText, rows, resolved.localeTag);
      const slotKey = inferSlotKeyForElement(islandEl, spanEl) || `text:${spanText}`;
      if (matched) {
        return {
          target: {
            ...matched,
            slotKey,
            baseText: spanText,
            initialValue: spanText,
          },
          anchorEl: spanEl,
        };
      }
      return {
        target: {
          kind: 'override',
          slotKey,
          baseText: spanText,
          initialValue: spanText,
        },
        anchorEl: spanEl,
      };
    }
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

function resolveHitTargetInIsland(islandEl, clientX, clientY, eventTarget, props, bounds, worldPoint) {
  const resolved = resolveChartSpec(props);
  const doc = islandEl?.ownerDocument;

  const candidates = [];
  if (eventTarget && islandEl?.contains?.(eventTarget)) {
    candidates.push(eventTarget);
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

  for (const el of candidates) {
    const hit = buildTargetFromElement(islandEl, el, resolved);
    if (hit) return hit;
  }

  // Always scan editable text bounding rects when pointer capture or SVG layering prevented direct hit
  if (islandEl && typeof islandEl.querySelectorAll === 'function' && Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const selector = '[data-chart-text-slot], [data-chart-field], svg text, .ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3, .ztd-card > header span, .ztd-card > footer span';
    const nodes = islandEl.querySelectorAll(selector);
    let bestNode = null;
    let bestScore = Infinity;
    for (const node of nodes) {
      if (isScreenReaderOrHidden(node)) continue;
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      const pad = 6;
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
      const hit = buildTargetFromElement(islandEl, bestNode, resolved);
      if (hit) return hit;
    }
  }

  // Fallback by local Y coordinate within the card bounds
  if (bounds && worldPoint && resolved.variant === 'card') {
    const localY = worldPoint.y - bounds.y;
    if (localY >= 42 && localY < 68) {
      return {
        target: { kind: 'field', field: 'subtitle', slotKey: 'field:subtitle' },
        anchorEl: findFieldElementInIsland(islandEl, 'subtitle'),
      };
    }
    if (localY > bounds.height - 48) {
      return {
        target: { kind: 'field', field: 'takeaway', slotKey: 'field:takeaway' },
        anchorEl: findFieldElementInIsland(islandEl, 'takeaway'),
      };
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

/**
 * Mounts a seamless, zero-chrome inline text editor onto the active Alid canvas HUD
 * so every text in a chart can be edited directly in place via double-click or `Enter`.
 */
export function mountInlineEditor(context) {
  const provider = context?.services?.get?.('canvas.active-tool-surface');
  const frames = context?.services?.get?.('canvas.frames');
  const textHistory = context?.services?.get?.('canvas.text-history');

  let closeCurrent = () => {};
  let openCurrent = () => false;
  let detachCurrent = () => {};

  function mount() {
    closeCurrent();
    detachCurrent();

    const s = provider?.get?.();
    if (!s?.surface?.hud || !s?.surface?.element || typeof document === 'undefined') {
      return;
    }

    let session = null;
    let composing = false;
    let until = 0;
    let offWorld = () => {};

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
    function restoreHiddenElements(islandEl) {
      if (islandEl) {
        delete islandEl.__ztdActiveEditSlot;
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
      const resolved = resolveChartSpec(props);

      const hudRect = s.surface.hud.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0, height: 0 };
      const zoom = Math.max(0.1, s.host?.getZoom?.() ?? 1);
      const islandEl = findIslandElement(s.surface.element, session.id);

      if (islandEl && session.target.slotKey) {
        islandEl.__ztdActiveEditSlot = session.target.slotKey;
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
      const b = context.world.getComputed?.(session.id) ?? context.world.getCanonical?.(session.id, 'core.bounds');
      const t = context.world.getCanonical?.(session.id, 'core.transform') ?? { x: 0, y: 0 };
      const wx = Number.isFinite(b?.x) ? b.x : (Number.isFinite(t.x) ? t.x : 0);
      const wy = Number.isFinite(b?.y) ? b.y : (Number.isFinite(t.y) ? t.y : 0);
      const ww = Number.isFinite(b?.width) ? b.width : 480;
      const wh = Number.isFinite(b?.height) ? b.height : 340;

      const topLeft = { x: 0, y: 0 };
      const bottomRight = { x: 0, y: 0 };
      s.host.worldToScreen(wx, wy, topLeft);
      s.host.worldToScreen(wx + ww, wy + wh, bottomRight);
      const boxLeft = topLeft.x - hudRect.left;
      const boxTop = topLeft.y - hudRect.top;
      const boxWidth = Math.max(160, bottomRight.x - topLeft.x);
      const boxHeight = Math.max(120, bottomRight.y - topLeft.y);

      const field = session.target.field ?? 'title';
      const yOffset = field === 'title'
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
      until = 0;
      offWorld();
      offWorld = () => {};
      const islandEl = findIslandElement(s.surface.element, ending.id);
      restoreHiddenElements(islandEl);
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
      if (!entityId || !context.world.isAlive?.(entityId)) return false;
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

      if (islandEl && target.slotKey) {
        islandEl.__ztdActiveEditSlot = target.slotKey;
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

      input.value = initial;
      container.style.display = 'block';
      positionEditor();
      input.focus?.();
      input.select?.();

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
          islandEl.querySelectorAll('[data-chart-field], [data-chart-text-slot], svg text'),
        ).filter(el => !isScreenReaderOrHidden(el));

        const uniqueSlots = [];
        const seen = new Set();
        for (const el of nodes) {
          const hit = buildTargetFromElement(islandEl, el, resolved);
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

    const locked = e => Boolean(composing || e?.isComposing || e?.keyCode === 229 || Date.now() < until);

    const onCompositionStart = () => {
      composing = true;
    };

    const onCompositionEnd = () => {
      composing = false;
      until = Date.now() + 16;
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
      finish(true);
    };

    const onDoubleClick = e => {
      if (e.defaultPrevented || composing) return;

      const worldPoint = { x: 0, y: 0 };
      if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY) && s.host?.screenToWorld) {
        s.host.screenToWorld(e.clientX, e.clientY, worldPoint);
      }

      let hitId = null;
      let hitBounds = null;
      const targetEl = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('[data-entity-id]')
        : null;
      const domEntityId = targetEl?.getAttribute?.('data-entity-id') ?? targetEl?.dataset?.entityId;
      if (domEntityId && context.world.getCanonical?.(domEntityId, CHART_ASPECT_ID)) {
        hitId = domEntityId;
        hitBounds = context.world.getComputed?.(domEntityId);
      }

      if (!hitId) {
        const selected = s.selection?.getSelection?.() ?? [];
        const ids = [
          ...selected,
          ...(context.world.listEntityIds?.() ?? []),
        ];
        const visited = new Set();
        for (const id of ids) {
          if (visited.has(id)) continue;
          visited.add(id);
          if (!context.world.getCanonical?.(id, CHART_ASPECT_ID)) continue;
          const b = context.world.getComputed?.(id);
          if (
            b
            && worldPoint.x >= b.x
            && worldPoint.x <= b.x + b.width
            && worldPoint.y >= b.y
            && worldPoint.y <= b.y + b.height
          ) {
            hitId = id;
            hitBounds = b;
            break;
          }
        }
      }

      if (!hitId) return;
      const props = context.world.getCanonical?.(hitId, CHART_ASPECT_ID);
      if (!props) return;

      const islandEl = findIslandElement(s.surface.element, hitId);
      const hit = resolveHitTargetInIsland(
        islandEl,
        e.clientX,
        e.clientY,
        e.target,
        props,
        hitBounds,
        worldPoint,
      );

      e.preventDefault?.();
      e.stopPropagation?.();
      startEditing(hitId, hit.target, hit.anchorEl);
    };

    const offFrame = frames?.subscribe?.(() => {
      if (session) positionEditor();
    }) ?? (() => {});

    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('blur', onBlur);
    s.surface.element.addEventListener('dblclick', onDoubleClick);

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
      const islandEl = session ? findIslandElement(s.surface.element, session.id) : null;
      restoreHiddenElements(islandEl);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionend', onCompositionEnd);
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('blur', onBlur);
      s.surface.element.removeEventListener('dblclick', onDoubleClick);
      container.remove();
    };
  }

  mount();
  const offSurface = provider?.subscribe?.(() => mount()) ?? (() => {});

  return {
    open(entityId, field = 'title') {
      return openCurrent(entityId, field);
    },
    close() {
      closeCurrent();
    },
    dispose() {
      offSurface();
      closeCurrent();
      detachCurrent();
    },
  };
}
