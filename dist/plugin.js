import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var extension_default = {
	id: "diagram.ztd-charts",
	title: "ZTD 차트",
	version: "0.1.6",
	summary: "36종의 zero-dependency 통계·비즈니스 차트를 캔버스 도형, 정적 SVG, 데이터 스튜디오 패널 및 코파일럿 도구로 제공하는 확장",
	engine: "^0.1.1",
	dependencies: {},
	optionalDependencies: {},
	conflicts: [],
	provides: {
		"services": [],
		"hsmSlots": []
	}
};
// node_modules/.pnpm/ztd-charts@0.5.0_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/ztd-charts/dist/chunk-OMCP27KK.js
function langOf(locale) {
	return locale !== void 0 && /^ko([-_]|$)/i.test(locale) ? "ko" : "en";
}
function plural(n, one, many = `${one}s`) {
	return `${n} ${n === 1 ? one : many}`;
}
var en = {
	/** aria-roledescription */
	chart: "chart",
	/** 스크린리더 표 제목 */
	table: (label) => `${label} data`,
	/** 표가 잘렸을 때 마지막 줄 */
	more: (n) => `and ${n} more`,
	/** 툴팁의 값 이름 */
	value: "Value",
	/** 데이터가 없을 때 스크린리더 설명 */
	empty: "No data."
};
var ko = {
	chart: "차트",
	table: (label) => `${label} 데이터`,
	more: (n) => `외 ${n}개`,
	value: "값",
	empty: "데이터가 없어요."
};
var withUnit = (fmt, unit = "") => (v) => Number.isFinite(v) ? `${fmt(v)}${unit}` : fmt(v);
var DEFAULT_LOCALE = "en-US";
var nfCache = /* @__PURE__ */ new Map();
function nf(locale, o) {
	const opts = o.maximumFractionDigits !== void 0 || o.style === "currency" ? o : {
		...o,
		maximumFractionDigits: Math.max(1, o.minimumFractionDigits ?? 0)
	};
	const key = locale + JSON.stringify(opts);
	let f = nfCache.get(key);
	if (!f) {
		f = new Intl.NumberFormat(locale, opts);
		nfCache.set(key, f);
	}
	return f;
}
function dropNegativeZero(s) {
	return /^[-\u2212]/.test(s) && !/[1-9]/.test(s) ? s.slice(1) : s;
}
function formatNumber(v, opts = {}) {
	if (!Number.isFinite(v)) return "-";
	const { locale = DEFAULT_LOCALE, ...rest } = opts;
	return dropNegativeZero(nf(locale, rest).format(v));
}
function formatPercent(v, opts = {}) {
	if (!Number.isFinite(v)) return "-";
	const a = Math.abs(v);
	return `${formatNumber(v, {
		maximumFractionDigits: a > 0 && a < 1 ? 1 : 0,
		...opts
	})}%`;
}
function formatCompact(v, opts = {}) {
	if (!Number.isFinite(v)) return "-";
	const { locale = DEFAULT_LOCALE, ...rest } = opts;
	if (langOf(locale) === "ko") {
		const a = Math.abs(v);
		const units = [
			[0xe8d4a51000, "조"],
			[1e8, "억"],
			[1e4, "만"],
			[1, ""]
		];
		let k = units.findIndex(([u]) => a >= u);
		if (k < 0) k = units.length - 1;
		for (;;) {
			const [u, name] = units[k];
			const q = a / u;
			const fd = Math.max(rest.minimumFractionDigits ?? 0, rest.maximumFractionDigits ?? (u === 1 || q < 100 ? 1 : 0));
			const rounded = Math.round(q * 10 ** fd) / 10 ** fd;
			if (k > 0 && rounded >= units[k - 1][0] / u) {
				k--;
				continue;
			}
			return (v < 0 && rounded !== 0 ? "-" : "") + formatNumber(rounded, {
				locale,
				...rest,
				maximumFractionDigits: fd
			}) + name;
		}
	}
	return dropNegativeZero(nf(locale, {
		notation: "compact",
		...rest
	}).format(v));
}
var currencyOptions = (locale, currency = langOf(locale) === "ko" ? "KRW" : "USD") => ({
	style: "currency",
	currency,
	maximumFractionDigits: currency === "KRW" ? 0 : 2
});
function makeFormatter(spec, locale = DEFAULT_LOCALE, fallback) {
	if (typeof spec === "function") return spec;
	const fixed = (opts, suffix = "", prefix = "") => {
		const f = nf(locale, opts);
		return (v) => Number.isFinite(v) ? `${prefix}${dropNegativeZero(f.format(v))}${suffix}` : "-";
	};
	if (spec && typeof spec === "object") {
		const { suffix = "", prefix = "", ...o } = spec;
		return fixed(o, suffix, prefix);
	}
	switch (spec ?? fallback) {
		case "integer": return fixed({ maximumFractionDigits: 0 });
		case "decimal": return fixed({
			minimumFractionDigits: 1,
			maximumFractionDigits: 2
		});
		case "percent": return (v) => formatPercent(v, { locale });
		case "ratio": return (v) => formatPercent(v * 100, { locale });
		case "compact": return (v) => formatCompact(v, { locale });
		case "currency": return fixed(currencyOptions(locale));
		default: return fixed({ maximumFractionDigits: 1 });
	}
}
function makeTickFormatter(spec, locale = DEFAULT_LOCALE, maxAbs = 0) {
	if (spec !== void 0) return makeFormatter(spec, locale);
	if (maxAbs >= 1e5) return (v) => formatCompact(v, { locale });
	return (v) => formatNumber(v, { locale });
}
function ymd(y, m, d = 1) {
	const t = new Date(+y, +m - 1, +d);
	return t.getMonth() === +m - 1 && t.getDate() === +d ? t : null;
}
var isYear = (v) => Number.isInteger(v) && v >= 1e3 && v <= 9999;
function toDate(v) {
	if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
	if (typeof v === "number") {
		if (!Number.isFinite(v)) return null;
		if (Number.isInteger(v)) {
			if (isYear(v)) return new Date(v, 0, 1);
			if (v >= 19000101 && v <= 21001231) return toDate(`${v}`);
		}
		return new Date(v);
	}
	if (typeof v === "string" && v.trim()) {
		const s = v.trim();
		const m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(s) ?? /^(\d{4})[./](\d{1,2})[./](\d{1,2})\.?$/.exec(s) ?? /^(19\d\d|20\d\d|2100)(\d\d)(\d\d)$/.exec(s);
		if (m) return ymd(m[1], m[2], m[3]);
		if (/^\d{4}$/.test(s)) return new Date(Number(s), 0, 1);
		if (!/\d{4}/.test(s)) return null;
		const d = new Date(s);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	return null;
}
var dfCache = /* @__PURE__ */ new Map();
function formatDate(v, opts = {
	month: "short",
	day: "numeric"
}) {
	const d = toDate(v);
	if (!d) return "-";
	const { locale = DEFAULT_LOCALE, ...rest } = opts;
	const key = locale + JSON.stringify(rest);
	let f = dfCache.get(key);
	if (!f) {
		f = new Intl.DateTimeFormat(locale, rest);
		dfCache.set(key, f);
	}
	return f.format(d);
}
function hasField(o, k) {
	return Object.hasOwn(o, k) || k in o && !(k in {});
}
function field(d, k) {
	if (d === null || d === void 0) return void 0;
	if (typeof d !== "object") return void 0;
	const o = d;
	if (hasField(o, k)) return o[k];
	if (k.includes(".")) {
		let cur = o;
		for (const p of k.split(".")) {
			if (cur === null || typeof cur !== "object" || !hasField(cur, p)) return void 0;
			cur = cur[p];
		}
		return cur;
	}
}
function toNumber(v) {
	if (typeof v === "number") return v;
	if (typeof v === "bigint") return Number(v);
	if (typeof v === "string") {
		const s = v.trim();
		const neg = /^\(.*\)$/.test(s);
		const body = s.replace(/[()\s%₩$€£¥원명건개회]/g, "").replace(/^\+/, "");
		if (!body || body.includes(",") && !/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(body)) return NaN;
		const n = Number(body.replace(/,/g, ""));
		return Number.isFinite(n) ? neg ? -n : n : NaN;
	}
	if (v instanceof Date) return v.getTime();
	if (typeof v === "boolean") return v ? 1 : 0;
	return NaN;
}
function getter(a, def) {
	if (typeof a === "function") return a;
	const k = a ?? def;
	return (d) => field(d, k);
}
function numGetter(a, def) {
	const g = getter(a, def);
	return (d, i) => toNumber(g(d, i));
}
function strGetter(a, def) {
	const g = getter(a, def);
	return (d, i) => {
		const v = g(d, i);
		if (v === void 0 || v === null) return "";
		if (v instanceof Date) return (/* @__PURE__ */ new Date(v.getTime() - v.getTimezoneOffset() * 6e4)).toISOString().slice(0, 10);
		return String(v);
	};
}
function uniq(xs) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const x of xs) if (!seen.has(x)) {
		seen.add(x);
		out.push(x);
	}
	return out;
}
function detectDelimiter(src) {
	const firstLine = [];
	let q = false;
	for (let i = 0; i < src.length && i < 4e3; i++) {
		const c = src[i];
		if (c === "\"") q = !q;
		else if (!q && (c === "\n" || c === "\r")) break;
		firstLine.push(q ? "" : c);
	}
	const line = firstLine.join("");
	const count = (d) => line.split(d).length - 1;
	const cands = [
		",",
		"	",
		";",
		"|"
	];
	let best = ",";
	let bc = 0;
	for (const d of cands) {
		const c = count(d);
		if (c > bc) {
			bc = c;
			best = d;
		}
	}
	return best;
}
var NUMERIC = /^[-+(]?[₩$€£¥]?\s?\d[\d,]*(\.\d+)?([eE][-+]?\d+)?\)?\s?(%|원|명|건|개|회)?$/;
function coerceCell(s) {
	const t = s.trim();
	if (t === "") return null;
	if (/^-?0\d/.test(t)) return t;
	if (NUMERIC.test(t) || /^[-+]?\.\d+$/.test(t)) {
		const n = toNumber(t);
		if (Number.isFinite(n)) return n;
	}
	return t;
}
function parseCSV(text, options = {}) {
	const { typed = true, header = true } = options;
	const src = text.replace(/^\uFEFF/, "");
	if (!src.trim()) return [];
	const delim = options.delimiter ?? detectDelimiter(src);
	const rows = [];
	let row = [];
	let cell = "";
	let q = false;
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (q) {
			if (c === "\"") {
				if (src[i + 1] === "\"") {
					cell += "\"";
					i++;
				} else q = false;
			} else cell += c;
		} else if (c === "\"" && !cell.trim()) {
			q = true;
			cell = "";
		} else if (c === delim) {
			row.push(cell);
			cell = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && src[i + 1] === "\n") i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else cell += c;
	}
	if (cell !== "" || row.length) {
		row.push(cell);
		rows.push(row);
	}
	const clean = rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
	if (!clean.length) return [];
	const conv = (s) => typed ? coerceCell(s) : s;
	if (!header) return clean.map((r) => Object.fromEntries(r.map((v, i) => [String(i), conv(v)])));
	const keys = [];
	const used = /* @__PURE__ */ new Set();
	clean[0].forEach((k, i) => {
		const base = k.trim() || `col${i + 1}`;
		let name = base;
		for (let n = 2; used.has(name); n++) name = `${base}_${n}`;
		used.add(name);
		keys.push(name);
	});
	return clean.slice(1).map((r) => Object.fromEntries(keys.map((k, i) => [k, conv(r[i] ?? "")])));
}
function toCSV(rows, columns) {
	const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
	const esc = (v) => {
		if (v === null || v === void 0) return "";
		const s = v instanceof Date ? v.toISOString() : String(v);
		return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s;
	};
	return [cols.map(esc).join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
function fromRows(rows, columns, options = {}) {
	if (!rows.length) return [];
	const { typed = true } = options;
	const head = (columns ?? rows[0]).map((k, i) => String(k ?? "").trim() || `col${i + 1}`);
	return (columns ? rows : rows.slice(1)).map((r) => Object.fromEntries(head.map((k, i) => [k, typed && typeof r[i] === "string" ? coerceCell(r[i]) : r[i] ?? null])));
}
function fromObjects(obj, options = {}) {
	const { labelKey = "label", valueKey = "value" } = options;
	const vals = Object.values(obj);
	if (vals.length && vals.every((v) => Array.isArray(v))) {
		const cols = Object.keys(obj);
		const n = Math.max(...vals.map((v) => v.length));
		return Array.from({ length: n }, (_, i) => Object.fromEntries(cols.map((c) => [c, obj[c][i] ?? null])));
	}
	return Object.entries(obj).map(([k, v]) => ({
		[labelKey]: k,
		[valueKey]: v
	}));
}
function pluck(obj, path) {
	let cur = obj;
	for (const p of path.split(".").filter(Boolean)) {
		if (cur === null || typeof cur !== "object") return void 0;
		cur = cur[p];
	}
	return cur;
}
function normalizeData(input) {
	if (input === null || input === void 0) return [];
	if (typeof input === "string") {
		const s = input.trim();
		if (!s) return [];
		if (s.startsWith("[") || s.startsWith("{")) try {
			return normalizeData(JSON.parse(s));
		} catch {}
		return parseCSV(s);
	}
	if (Array.isArray(input)) {
		if (!input.length) return [];
		if (Array.isArray(input[0])) return fromRows(input);
		if (typeof input[0] === "number") return input.map((v, i) => ({
			label: String(i + 1),
			value: v
		}));
		return input.filter((r) => r && typeof r === "object");
	}
	if (typeof input === "object") {
		const o = input;
		if (Array.isArray(o.data)) return normalizeData(o.data);
		if (Array.isArray(o.rows) && Array.isArray(o.columns)) return fromRows(o.rows, o.columns.map((c) => typeof c === "object" && c && "name" in c ? String(c.name) : String(c)));
		if (Array.isArray(o.rows) && Array.isArray(o.fields)) return normalizeData(o.rows);
		if (Array.isArray(o.rows)) return normalizeData(o.rows);
		if (Array.isArray(o.values)) return fromRows(o.values);
		if (Array.isArray(o.items)) return normalizeData(o.items);
		if (Array.isArray(o.results)) return normalizeData(o.results);
		return fromObjects(o);
	}
	return [];
}
function dataSignature(data) {
	if (!Array.isArray(data)) try {
		return JSON.stringify(data ?? null) ?? "";
	} catch {
		return String(data);
	}
	const n = data.length;
	const safe = (v) => {
		try {
			return JSON.stringify(v);
		} catch {
			return String(v);
		}
	};
	if (n <= 300) return safe(data);
	const step = Math.ceil(n / 60);
	const sample = [];
	for (let i = 0; i < n; i += step) sample.push(data[i]);
	sample.push(data[n - 1]);
	return `${n}:${safe(sample)}`;
}
function lttb(pts, threshold) {
	const n = pts.length;
	if (threshold >= n || threshold < 3) return pts.slice();
	const out = [pts[0]];
	const every = (n - 2) / (threshold - 2);
	let a = 0;
	for (let i = 0; i < threshold - 2; i++) {
		const s = Math.floor((i + 1) * every) + 1;
		const e = Math.min(Math.floor((i + 2) * every) + 1, n);
		let ax = 0;
		let ay = 0;
		for (let j = s; j < e; j++) {
			ax += pts[j].x;
			ay += pts[j].y;
		}
		const len = Math.max(1, e - s);
		ax /= len;
		ay /= len;
		const rs = Math.floor(i * every) + 1;
		const re = Math.floor((i + 1) * every) + 1;
		let best = rs;
		let max = -1;
		for (let j = rs; j < re; j++) {
			const area = Math.abs((pts[a].x - ax) * (pts[j].y - pts[a].y) - (pts[a].x - pts[j].x) * (ay - pts[a].y));
			if (area > max) {
				max = area;
				best = j;
			}
		}
		out.push(pts[best]);
		a = best;
	}
	out.push(pts[n - 1]);
	return out;
}
var TAU = Math.PI * 2;
function clamp(v, a, b) {
	return v < a ? a : v > b ? b : v;
}
function sum(xs) {
	let s = 0;
	for (const x of xs) if (Number.isFinite(x)) s += x;
	return s;
}
function r2(n) {
	return Math.round(n * 100) / 100;
}
function polar(cx, cy, r, a) {
	return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}
function arcPath(cx, cy, r0, r1, a0, a1) {
	const da = a1 - a0;
	if (!(Math.abs(da) > 1e-4) || r1 <= 0) return "";
	if (Math.abs(da) >= TAU - 1e-4) {
		const ring = (r, sweep) => {
			const [x02, y02] = polar(cx, cy, r, a0);
			const [x12, y12] = polar(cx, cy, r, a0 + Math.PI);
			return `M${r2(x02)},${r2(y02)}A${r2(r)},${r2(r)} 0 1 ${sweep} ${r2(x12)},${r2(y12)}A${r2(r)},${r2(r)} 0 1 ${sweep} ${r2(x02)},${r2(y02)}Z`;
		};
		return r0 > 0 ? `${ring(r1, 1)}${ring(r0, 0)}` : ring(r1, 1);
	}
	const s = da > 0 ? 1 : 0;
	const large = Math.abs(da) > Math.PI ? 1 : 0;
	const [x0, y0] = polar(cx, cy, r1, a0);
	const [x1, y1] = polar(cx, cy, r1, a1);
	if (r0 <= 0) return `M${r2(cx)},${r2(cy)}L${r2(x0)},${r2(y0)}A${r2(r1)},${r2(r1)} 0 ${large} ${s} ${r2(x1)},${r2(y1)}Z`;
	const [x2, y2] = polar(cx, cy, r0, a1);
	const [x3, y3] = polar(cx, cy, r0, a0);
	return `M${r2(x0)},${r2(y0)}A${r2(r1)},${r2(r1)} 0 ${large} ${s} ${r2(x1)},${r2(y1)}L${r2(x2)},${r2(y2)}A${r2(r0)},${r2(r0)} 0 ${large} ${1 - s} ${r2(x3)},${r2(y3)}Z`;
}
function arcLine(cx, cy, r, a0, a1) {
	const da = a1 - a0;
	if (!(Math.abs(da) > 1e-4)) return "";
	const e = Math.abs(da) >= TAU - 1e-4 ? a0 + (da > 0 ? TAU - 1e-4 : -(TAU - 1e-4)) : a1;
	const [x0, y0] = polar(cx, cy, r, a0);
	const [x1, y1] = polar(cx, cy, r, e);
	const large = Math.abs(e - a0) > Math.PI ? 1 : 0;
	return `M${r2(x0)},${r2(y0)}A${r2(r)},${r2(r)} 0 ${large} ${da > 0 ? 1 : 0} ${r2(x1)},${r2(y1)}`;
}
function roundRectPath(x, y, w, h, c) {
	if (w < 0) {
		x += w;
		w = -w;
	}
	if (h < 0) {
		y += h;
		h = -h;
	}
	if (w <= .01 || h <= .01) return "";
	const k = typeof c === "number" ? {
		tl: c,
		tr: c,
		br: c,
		bl: c
	} : c;
	const m = Math.min(w, h) / 2;
	const tl = clamp(k.tl ?? 0, 0, m);
	const tr = clamp(k.tr ?? 0, 0, m);
	const br = clamp(k.br ?? 0, 0, m);
	const bl = clamp(k.bl ?? 0, 0, m);
	return `M${r2(x + tl)},${r2(y)}H${r2(x + w - tr)}` + (tr ? `A${r2(tr)},${r2(tr)} 0 0 1 ${r2(x + w)},${r2(y + tr)}` : "") + `V${r2(y + h - br)}` + (br ? `A${r2(br)},${r2(br)} 0 0 1 ${r2(x + w - br)},${r2(y + h)}` : "") + `H${r2(x + bl)}` + (bl ? `A${r2(bl)},${r2(bl)} 0 0 1 ${r2(x)},${r2(y + h - bl)}` : "") + `V${r2(y + tl)}` + (tl ? `A${r2(tl)},${r2(tl)} 0 0 1 ${r2(x + tl)},${r2(y)}` : "") + "Z";
}
function monotonePath(pts, move = true) {
	const n = pts.length;
	if (!n) return "";
	const head = (p) => `${move ? "M" : "L"}${r2(p[0])},${r2(p[1])}`;
	if (n < 3) return head(pts[0]) + pts.slice(1).map((p) => `L${r2(p[0])},${r2(p[1])}`).join("");
	const dx = [];
	const m = [];
	for (let i = 0; i < n - 1; i++) {
		const d2 = pts[i + 1][0] - pts[i][0];
		dx.push(d2);
		m.push(d2 === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / d2);
	}
	const t = [m[0]];
	for (let i = 1; i < n - 1; i++) if (m[i - 1] * m[i] <= 0) t.push(0);
	else {
		const w1 = 2 * dx[i] + dx[i - 1];
		const w2 = dx[i] + 2 * dx[i - 1];
		t.push((w1 + w2) / (w1 / m[i - 1] + w2 / m[i]));
	}
	t.push(m[n - 2]);
	let d = head(pts[0]);
	for (let i = 0; i < n - 1; i++) {
		const h = dx[i] / 3;
		d += `C${r2(pts[i][0] + h)},${r2(pts[i][1] + t[i] * h)} ${r2(pts[i + 1][0] - h)},${r2(pts[i + 1][1] - t[i + 1] * h)} ${r2(pts[i + 1][0])},${r2(pts[i + 1][1])}`;
	}
	return d;
}
function linePath(pts, curve = "smooth") {
	if (!pts.length) return "";
	if (curve === "smooth") return monotonePath(pts);
	if (curve === "step") {
		let d = `M${r2(pts[0][0])},${r2(pts[0][1])}`;
		for (let i = 1; i < pts.length; i++) {
			const mx = (pts[i - 1][0] + pts[i][0]) / 2;
			d += `H${r2(mx)}V${r2(pts[i][1])}H${r2(pts[i][0])}`;
		}
		return d;
	}
	return polyline(pts);
}
function polyline(pts) {
	if (!pts.length) return "";
	let d = `M${r2(pts[0][0])},${r2(pts[0][1])}`;
	for (let i = 1; i < pts.length; i++) d += `L${r2(pts[i][0])},${r2(pts[i][1])}`;
	return d;
}
function areaPath(top, bottom, curve = "smooth") {
	if (!top.length) return "";
	const rev = [...bottom].reverse();
	const up = linePath(top, curve);
	let down;
	if (curve === "smooth") down = monotonePath(rev.map((p) => [p[0], p[1]]), false);
	else if (curve === "step") down = linePath(rev, "step").replace(/^M/, "L");
	else down = rev.map((p) => `L${r2(p[0])},${r2(p[1])}`).join("");
	return `${up}${down}Z`;
}
function evenIndex(px, x0, x1, n) {
	return Math.max(0, Math.min(n - 1, Math.round((px - x0) / (x1 - x0 || 1) * (n - 1))));
}
function nearestIndex(sorted, v) {
	let lo = 0;
	let hi = sorted.length - 1;
	if (hi < 0) return -1;
	while (hi - lo > 1) {
		const mid = lo + hi >> 1;
		if (sorted[mid] < v) lo = mid;
		else hi = mid;
	}
	return Math.abs(sorted[lo] - v) <= Math.abs(sorted[hi] - v) ? lo : hi;
}
function quantileSorted(sorted, q) {
	if (!sorted.length) return NaN;
	const p = (sorted.length - 1) * q;
	const b = Math.floor(p);
	const r = p - b;
	return sorted[b + 1] !== void 0 ? sorted[b] + r * (sorted[b + 1] - sorted[b]) : sorted[b];
}
function argMax(xs) {
	let best = -1;
	let bv = -Infinity;
	xs.forEach((v, i) => {
		if (v > bv) {
			bv = v;
			best = i;
		}
	});
	return best;
}
function argMin(xs) {
	let best = -1;
	let bv = Infinity;
	xs.forEach((v, i) => {
		if (v < bv) {
			bv = v;
			best = i;
		}
	});
	return best;
}
function linearFit(pts) {
	const n = pts.length;
	const mx = pts.reduce((s, q) => s + q.x, 0) / n;
	const my = pts.reduce((s, q) => s + q.y, 0) / n;
	let sxy = 0;
	let sxx = 0;
	let syy = 0;
	for (const q of pts) {
		sxy += (q.x - mx) * (q.y - my);
		sxx += (q.x - mx) ** 2;
		syy += (q.y - my) ** 2;
	}
	const slope = sxx ? sxy / sxx : 0;
	return {
		slope,
		r2: sxx && syy ? sxy * sxy / (sxx * syy) : 0,
		at: (x) => my + slope * (x - mx)
	};
}
var sortedNumbers = (values) => new Float64Array(values.map(toNumber).filter(Number.isFinite)).sort();
var at = (sorted, p) => p >= 0 && p <= 100 ? quantileSorted(sorted, p / 100) : NaN;
function percentile(values, p) {
	return at(sortedNumbers(values), p);
}
function markPercentile(id) {
	const m = /^p(\d+(?:\.\d+)?)$/.exec(id);
	const v = m ? Number(m[1]) : NaN;
	return v >= 0 && v <= 100 ? v : NaN;
}
var LEVELS = [
	{
		id: "basic",
		en: "Basic",
		ko: "기본"
	},
	{
		id: "intermediate",
		en: "Intermediate",
		ko: "중급"
	},
	{
		id: "advanced",
		en: "Advanced",
		ko: "심화"
	}
];
var LEVEL_TONE = {
	basic: {
		bg: "line2",
		fg: "ink"
	},
	intermediate: {
		bg: "tint",
		fg: "accentText"
	},
	advanced: {
		bg: "ink",
		fg: "onInk"
	}
};
function find(list, value) {
	const v = value.trim().toLowerCase();
	return list.find((l) => l.id === v || l.en.toLowerCase() === v || l.ko === value.trim());
}
function findLevel(value) {
	return find(LEVELS, value);
}
function levelBadge(level, lang) {
	const lv = findLevel(level);
	return {
		text: lv ? lv[lang] : level,
		...LEVEL_TONE[lv?.id ?? "basic"]
	};
}
function boxStats(values, whiskers) {
	const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
	const n = s.length;
	if (!n) return {
		min: NaN,
		q1: NaN,
		median: NaN,
		q3: NaN,
		max: NaN,
		lo: NaN,
		hi: NaN,
		mean: NaN,
		outliers: [],
		n: 0
	};
	const q1 = quantileSorted(s, .25);
	const median = quantileSorted(s, .5);
	const q3 = quantileSorted(s, .75);
	const iqr = q3 - q1;
	const loF = whiskers ? quantileSorted(s, whiskers[0] / 100) : q1 - 1.5 * iqr;
	const hiF = whiskers ? quantileSorted(s, whiskers[1] / 100) : q3 + 1.5 * iqr;
	let lo = s[0];
	let hi = s[n - 1];
	for (const v of s) if (v >= loF) {
		lo = v;
		break;
	}
	for (let i = n - 1; i >= 0; i--) if (s[i] <= hiF) {
		hi = s[i];
		break;
	}
	let total = 0;
	for (const v of s) total += v;
	return {
		min: s[0],
		q1,
		median,
		q3,
		max: s[n - 1],
		lo: whiskers ? loF : lo,
		hi: whiskers ? hiF : hi,
		mean: total / n,
		outliers: s.filter((v) => v < loF || v > hiF),
		n
	};
}
function kde(values, xs, bandwidth) {
	const v = values.filter((x) => Number.isFinite(x));
	const n = v.length;
	if (!n) return xs.map(() => 0);
	const mean = v.reduce((a, b) => a + b, 0) / n;
	const range = xs.length > 1 ? Math.abs(xs[xs.length - 1] - xs[0]) : 0;
	const fallback = range > 0 ? range / 40 : Math.abs(mean) * .05 || 1;
	const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || fallback;
	const s = [...v].sort((a, b) => a - b);
	const iqr = quantileSorted(s, .75) - quantileSorted(s, .25);
	const spread = Math.min(sd, iqr > 0 ? iqr / 1.34 : sd) || sd;
	const bw = bandwidth ?? Math.max(1e-9, .9 * spread * Math.pow(n, -.2));
	const k = 1 / (Math.sqrt(2 * Math.PI) * bw * n);
	if (n > 2e3) {
		const bins = 512;
		const lo = s[0];
		const step = (s[n - 1] - lo) / bins || 1;
		const counts = new Array(513).fill(0);
		for (const x of v) counts[Math.min(bins, Math.floor((x - lo) / step))]++;
		return xs.map((x) => {
			let acc = 0;
			for (let b = 0; b <= bins; b++) {
				if (!counts[b]) continue;
				const u = (x - (lo + b * step)) / bw;
				if (u > 6 || u < -6) continue;
				acc += counts[b] * Math.exp(-.5 * u * u);
			}
			return acc * k;
		});
	}
	return xs.map((x) => {
		let acc = 0;
		for (const t of v) {
			const u = (x - t) / bw;
			if (u > 6 || u < -6) continue;
			acc += Math.exp(-.5 * u * u);
		}
		return acc * k;
	});
}
function beeswarm(xs, radius, opts = {}) {
	const d = 2 * (radius + (opts.padding ?? .6));
	const d2 = d * d;
	const n = xs.length;
	const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => xs[a] - xs[b]);
	const px = new Float64Array(n);
	const py = new Float64Array(n);
	const ys = new Array(n).fill(0);
	const limit = opts.maxSpread ?? Infinity;
	let starts = /* @__PURE__ */ new Float64Array(64);
	let ends = /* @__PURE__ */ new Float64Array(64);
	let head = 0;
	let count = 0;
	let overflow = 0;
	for (const i of order) {
		const x = xs[i];
		while (head < count && px[head] < x - d) head++;
		if (count - head > starts.length) {
			starts = new Float64Array(2 * (count - head));
			ends = new Float64Array(starts.length);
		}
		let w = 0;
		for (let j = head; j < count; j++) {
			const dx = x - px[j];
			const h2 = d2 - 1e-6 - dx * dx;
			if (h2 <= 0) continue;
			const h = Math.sqrt(h2);
			starts[w] = py[j] - h;
			ends[w] = py[j] + h;
			w++;
		}
		let y = 0;
		if (w > 0) {
			const S = starts.subarray(0, w).sort();
			const E = ends.subarray(0, w).sort();
			let si = 0;
			let depth = 0;
			let open = 0;
			for (let ei = 0; ei < w;) if (si < w && S[si] < E[ei]) {
				if (depth === 0) {
					open = S[si];
					if (open >= 0) break;
				}
				depth++;
				si++;
			} else {
				depth--;
				if (depth === 0 && E[ei] > 0) {
					const near = -open < E[ei] - 1e-6 ? open : E[ei];
					const far = near === open ? E[ei] : open;
					y = Math.abs(near) <= limit ? near : Math.abs(far) <= limit ? far : NaN;
					break;
				}
				ei++;
			}
		}
		if (Number.isNaN(y)) {
			ys[i] = (overflow++ * .6180339887498949 % 1 * 2 - 1) * limit;
			continue;
		}
		ys[i] = y;
		px[count] = x;
		py[count] = y;
		count++;
	}
	return ys;
}
function isPreBinned(first, value, count) {
	if (count !== void 0) return true;
	if (value !== void 0 || !first) return false;
	return [
		"x0",
		"x1",
		"count"
	].every((k) => hasField(first, k)) && !hasField(first, "value");
}
var MAX_AUTO_BINS = 50;
var MAX_BINS = 200;
var NICE = [
	1,
	2,
	2.5,
	5,
	10
];
var LOG_STEPS = [
	[1],
	[1, 3],
	[
		1,
		2,
		5
	],
	[
		1,
		1.6,
		2.5,
		4,
		6.3
	],
	[
		1,
		1.25,
		1.6,
		2,
		2.5,
		3.15,
		4,
		5,
		6.3,
		8
	]
];
var tidy = (v) => Number(v.toPrecision(12));
function niceWidth(w, up = false) {
	const p = 10 ** Math.floor(Math.log10(w));
	const list = NICE.map((m) => tidy(m * p));
	if (up) return list.find((c) => c >= w * (1 - 1e-9)) ?? tidy(10 * p);
	return list.reduce((best, c) => Math.abs(Math.log(c / w)) < Math.abs(Math.log(best / w)) ? c : best);
}
function linearEdges(lo, hi, w) {
	const start = Math.floor(lo / w + 1e-9) * w;
	const n = Math.max(1, Math.ceil((hi - start) / w - 1e-9));
	const out = Array.from({ length: n + 1 }, (_, i) => tidy(start + i * w));
	if (out[0] > lo) out.unshift(tidy(out[0] - w));
	if (out[out.length - 1] < hi) out.push(tidy(out[out.length - 1] + w));
	return out;
}
function decadeGrid(lo, hi, steps, pad = 0) {
	const out = [];
	for (let d = Math.floor(Math.log10(lo)) - pad; d <= Math.ceil(Math.log10(hi)) + pad; d++) for (const m of steps) out.push(tidy(m * 10 ** d));
	return out;
}
function logEdges(lo, hi, steps) {
	const all = decadeGrid(lo, hi, steps, 1);
	let a = all.length - 1;
	while (a > 0 && all[a] > lo * (1 + 1e-9)) a--;
	let b = a + 1;
	while (b < all.length - 1 && all[b] < hi * (1 - 1e-9)) b++;
	return all.slice(a, b + 1);
}
function autoWidth(sorted) {
	const n = sorted.length;
	const iqr = quantileSorted(sorted, .75) - quantileSorted(sorted, .25);
	if (n >= 30 && iqr > 0) return 2 * iqr / Math.cbrt(n);
	return (sorted[n - 1] - sorted[0]) / (Math.ceil(Math.log2(n)) + 1);
}
function cleanEdges(edges, log) {
	const out = [...new Set(edges.filter((e) => Number.isFinite(e) && (!log || e > 0)))].sort((a, b) => a - b);
	return out.length >= 2 ? out : null;
}
function binEdges(values, opts = {}) {
	const log = opts.log === true;
	const given = opts.edges ? cleanEdges(opts.edges, log) : null;
	if (given) return given;
	const raw = Float64Array.from(values.filter((x) => Number.isFinite(x) && (!log || x > 0))).sort();
	if (!raw.length) return [];
	const lo = raw[0];
	const hi = raw[raw.length - 1];
	const width = opts.binWidth !== void 0 && opts.binWidth > 0 && !log ? opts.binWidth : void 0;
	if (lo === hi) {
		if (log) return [tidy(lo / 2), tidy(lo * 2)];
		const w2 = width ?? 1;
		return [lo - w2 / 2, lo + w2 / 2];
	}
	const count = opts.bins !== void 0 && opts.bins >= 1 ? Math.round(opts.bins) : void 0;
	const cap = width !== void 0 || count !== void 0 ? MAX_BINS : MAX_AUTO_BINS;
	if (log) {
		const target = count !== void 0 ? Math.log10(hi / lo) / count : autoWidth(raw.map(Math.log10));
		const miss = (st) => Math.abs(Math.log(1 / st.length / target));
		let k = LOG_STEPS.reduce((best, st, i) => miss(st) < miss(LOG_STEPS[best]) ? i : best, 0);
		let out2 = logEdges(lo, hi, LOG_STEPS[k]);
		while (out2.length - 1 > cap && k > 0) out2 = logEdges(lo, hi, LOG_STEPS[--k]);
		return out2;
	}
	let w = width ?? niceWidth(count !== void 0 ? (hi - lo) / count : autoWidth(raw));
	if ((hi - lo) / w > cap) w = niceWidth((hi - lo) / cap, true);
	let out = linearEdges(lo, hi, w);
	while (out.length - 1 > cap) out = linearEdges(lo, hi, w = niceWidth(w * 1.01, true));
	return out;
}
function binIndex(edges, v) {
	const n = edges.length - 1;
	if (n < 1 || !(v >= edges[0] && v <= edges[n])) return -1;
	let a = 0;
	let b = n;
	while (b - a > 1) {
		const m = a + b >> 1;
		if (edges[m] <= v) a = m;
		else b = m;
	}
	return a;
}
function binCounts(values, edges) {
	const counts = new Array(Math.max(0, edges.length - 1)).fill(0);
	let outside = 0;
	for (const v of values) {
		if (!Number.isFinite(v)) continue;
		const k = binIndex(edges, v);
		if (k < 0) outside++;
		else counts[k]++;
	}
	return {
		counts,
		outside
	};
}
function dotUnit(maxCount, capacity) {
	const cap = Math.max(1, Math.floor(capacity));
	if (!(maxCount > cap)) return 1;
	if (!Number.isFinite(maxCount)) return Infinity;
	for (let p = 10 ** Math.max(0, Math.floor(Math.log10(maxCount / cap)) - 1);; p *= 10) for (const m of [
		1,
		2,
		5
	]) if (Math.ceil(maxCount / (m * p)) <= cap) return m * p;
}
function ranks(values, desc = true) {
	const idx = values.map((v, i) => ({
		v,
		i
	})).sort((a, b) => desc ? b.v - a.v : a.v - b.v);
	const out = new Array(values.length);
	let rank = 0;
	let prev = null;
	idx.forEach((d, k) => {
		if (prev === null || d.v !== prev) rank = k + 1;
		out[d.i] = rank;
		prev = d.v;
	});
	return out;
}
var ch = /* @__NO_SIDE_EFFECTS__ */ (name, type, required, description, extra = {}) => ({
	name,
	type,
	required,
	description,
	...extra
});
var LABEL = /* @__PURE__ */ ch("label", "string", true, "Item name field");
var VALUE = /* @__PURE__ */ ch("value", "number", true, "Value field");
var CH_pie = [LABEL, VALUE];
var CH_donut = [LABEL, VALUE];
var CH_funnel = [/* @__PURE__ */ ch("label", "string", true, "Stage name"), /* @__PURE__ */ ch("value", "number", true, "Users at the stage")];
var CH_waffle = [LABEL, VALUE];
var CH_treemap = [
	/* @__PURE__ */ ch("label", "string", true, "Leaf (lowest level) name"),
	VALUE,
	/* @__PURE__ */ ch("group", "string", false, "Parent group field")
];
var CH_sunburst = [
	/* @__PURE__ */ ch("label", "string", true, "Leaf name"),
	VALUE,
	/* @__PURE__ */ ch("group", "string", false, "Parent group field")
];
var CH_waterfall = [
	LABEL,
	/* @__PURE__ */ ch("value", "number", true, "Change (total rows may omit it)"),
	/* @__PURE__ */ ch("type", "string", false, "\"total\" makes a total bar")
];
var CH_pareto = [LABEL, VALUE];
var CH_marimekko = [
	/* @__PURE__ */ ch("x", "string", true, "Column field"),
	/* @__PURE__ */ ch("series", "string", true, "Stacked series field"),
	VALUE
];
var CH_heatmap = [
	/* @__PURE__ */ ch("x", "string", true, "Column field"),
	/* @__PURE__ */ ch("y", "string", true, "Row field"),
	VALUE
];
var CH_radar = [
	/* @__PURE__ */ ch("axis", "string", true, "Metric (axis) field"),
	/* @__PURE__ */ ch("value", "number", true, "Value field", { multi: true }),
	/* @__PURE__ */ ch("series", "string", false, "Series field")
];
var CH_bubble = [
	/* @__PURE__ */ ch("x", "number", true, "x value"),
	/* @__PURE__ */ ch("y", "number", true, "y value"),
	/* @__PURE__ */ ch("size", "number", false, "Circle size"),
	/* @__PURE__ */ ch("label", "string", false, "Name")
];
var UPPER = /* @__PURE__ */ ch("upper", "number", false, "Upper bound of the range band. Same shape as lower", { multi: true });
var CHANNELS = {
	pie: CH_pie,
	donut: CH_donut,
	funnel: CH_funnel,
	waffle: CH_waffle,
	treemap: CH_treemap,
	sunburst: CH_sunburst,
	waterfall: CH_waterfall,
	pareto: CH_pareto,
	marimekko: CH_marimekko,
	heatmap: CH_heatmap,
	radar: CH_radar,
	bubble: CH_bubble,
	line: [
		/* @__PURE__ */ ch("x", "any", true, "x field (date, number or category)"),
		/* @__PURE__ */ ch("y", "number", true, "y field. An array for wide tables", { multi: true }),
		/* @__PURE__ */ ch("series", "string", false, "Series field (long tables)"),
		/* @__PURE__ */ ch("lower", "number", false, "Lower bound of the range band. In wide tables an array in the order of y", { multi: true }),
		UPPER
	],
	area: [
		/* @__PURE__ */ ch("x", "any", true, "x field"),
		/* @__PURE__ */ ch("y", "number", true, "y field. An array for wide tables", { multi: true }),
		/* @__PURE__ */ ch("series", "string", false, "Series field"),
		/* @__PURE__ */ ch("lower", "number", false, "Lower bound of the range band, with stack \"none\" only. In wide tables an array in the order of y", { multi: true }),
		UPPER
	],
	stream: [
		/* @__PURE__ */ ch("x", "any", true, "x field"),
		/* @__PURE__ */ ch("y", "number", true, "y field", { multi: true }),
		/* @__PURE__ */ ch("series", "string", false, "Series field")
	],
	bar: [
		/* @__PURE__ */ ch("x", "string", true, "Category field"),
		/* @__PURE__ */ ch("y", "number", true, "Value field. An array for wide tables", { multi: true }),
		/* @__PURE__ */ ch("series", "string", false, "Series field")
	],
	radialBar: [LABEL, VALUE],
	gauge: [/* @__PURE__ */ ch("value", "number", true, "Value field", { prop: "valueKey" }), /* @__PURE__ */ ch("target", "number", false, "Target field", { prop: "targetKey" })],
	bullet: [
		LABEL,
		/* @__PURE__ */ ch("value", "number", true, "Actual value field"),
		/* @__PURE__ */ ch("target", "number", false, "Target field")
	],
	sparkline: [/* @__PURE__ */ ch("x", "any", false, "x field"), /* @__PURE__ */ ch("y", "number", true, "y field")],
	slope: [
		LABEL,
		/* @__PURE__ */ ch("x", "string", false, "Period field (long tables)"),
		/* @__PURE__ */ ch("value", "number", false, "Value field (long tables)")
	],
	dumbbell: [
		LABEL,
		/* @__PURE__ */ ch("start", "number", true, "Before value"),
		/* @__PURE__ */ ch("end", "number", true, "After value")
	],
	lollipop: [LABEL, VALUE],
	beeswarm: [
		/* @__PURE__ */ ch("value", "number", true, "Value field"),
		/* @__PURE__ */ ch("group", "string", false, "Group (row) field"),
		/* @__PURE__ */ ch("label", "string", false, "Dot name")
	],
	ridgeline: [/* @__PURE__ */ ch("group", "string", true, "Group field"), /* @__PURE__ */ ch("value", "number", true, "Value field")],
	sankey: [
		/* @__PURE__ */ ch("source", "string", true, "Source node"),
		/* @__PURE__ */ ch("target", "string", true, "Target node"),
		VALUE
	],
	chord: [
		/* @__PURE__ */ ch("source", "string", true, "Sending group"),
		/* @__PURE__ */ ch("target", "string", true, "Receiving group"),
		VALUE
	],
	calendar: [/* @__PURE__ */ ch("date", "date", true, "Date field"), VALUE],
	bump: [
		/* @__PURE__ */ ch("x", "any", true, "Period field"),
		/* @__PURE__ */ ch("series", "string", true, "Item field"),
		/* @__PURE__ */ ch("rank", "number", false, "Rank field (1 is first)"),
		/* @__PURE__ */ ch("value", "number", false, "Value field (instead of rank, largest is first)")
	],
	box: [/* @__PURE__ */ ch("group", "string", true, "Group field"), /* @__PURE__ */ ch("value", "number", true, "Value field")],
	parallel: [/* @__PURE__ */ ch("label", "string", false, "Row name field")],
	candlestick: [
		/* @__PURE__ */ ch("x", "date", true, "Date (period) field"),
		/* @__PURE__ */ ch("open", "number", true, "Open price field"),
		/* @__PURE__ */ ch("high", "number", true, "High price field"),
		/* @__PURE__ */ ch("low", "number", true, "Low price field"),
		/* @__PURE__ */ ch("close", "number", true, "Close price field"),
		/* @__PURE__ */ ch("volume", "number", false, "Volume field")
	],
	segmented: [LABEL, VALUE],
	skyline: [
		/* @__PURE__ */ ch("x", "any", true, "Period field (date or category)"),
		/* @__PURE__ */ ch("y", "number", true, "Back row fields stacked into each block. An array for wide tables", { multi: true }),
		/* @__PURE__ */ ch("series", "string", false, "Series field (long tables, back row only)"),
		/* @__PURE__ */ ch("front", "number", false, "Front row fields: a smaller outcome in the same unit as y (wide tables only)", { multi: true })
	],
	histogram: [
		/* @__PURE__ */ ch("value", "number", false, "Sample value field (raw rows)"),
		/* @__PURE__ */ ch("group", "string", false, "Group field. Up to 2 groups overlap"),
		/* @__PURE__ */ ch("x0", "number", false, "Bin start (pre-binned rows)"),
		/* @__PURE__ */ ch("x1", "number", false, "Bin end (pre-binned rows)"),
		/* @__PURE__ */ ch("count", "number", false, "Samples in the bin (pre-binned rows)")
	],
	scatter: [
		/* @__PURE__ */ ch("x", "number", true, "x value"),
		/* @__PURE__ */ ch("y", "number", true, "y value"),
		/* @__PURE__ */ ch("series", "string", false, "Series field (one color per series)"),
		/* @__PURE__ */ ch("label", "string", false, "Name")
	]
};
var META = {
	pie: {
		component: "PieChart",
		name: "Pie chart",
		nameKo: "파이 차트"
	},
	donut: {
		component: "DonutChart",
		name: "Donut chart",
		nameKo: "도넛 차트"
	},
	funnel: {
		component: "FunnelChart",
		name: "Funnel chart",
		nameKo: "퍼널 차트"
	},
	waffle: {
		component: "WaffleChart",
		name: "Waffle chart",
		nameKo: "와플 차트"
	},
	treemap: {
		component: "Treemap",
		name: "Treemap",
		nameKo: "트리맵"
	},
	sunburst: {
		component: "SunburstChart",
		name: "Sunburst",
		nameKo: "선버스트"
	},
	waterfall: {
		component: "WaterfallChart",
		name: "Waterfall chart",
		nameKo: "폭포 차트"
	},
	pareto: {
		component: "ParetoChart",
		name: "Pareto chart",
		nameKo: "파레토 차트"
	},
	marimekko: {
		component: "MarimekkoChart",
		name: "Marimekko chart",
		nameKo: "마리메코 차트"
	},
	heatmap: {
		component: "Heatmap",
		name: "Heatmap",
		nameKo: "히트맵"
	},
	radar: {
		component: "RadarChart",
		name: "Radar chart",
		nameKo: "레이더 차트"
	},
	bubble: {
		component: "BubbleChart",
		name: "Bubble chart",
		nameKo: "버블 차트"
	},
	line: {
		component: "LineChart",
		name: "Line chart",
		nameKo: "라인 차트"
	},
	area: {
		component: "AreaChart",
		name: "Area chart",
		nameKo: "영역 차트"
	},
	stream: {
		component: "StreamGraph",
		name: "Streamgraph",
		nameKo: "스트림그래프"
	},
	bar: {
		component: "BarChart",
		name: "Bar chart",
		nameKo: "막대 차트"
	},
	radialBar: {
		component: "RadialBarChart",
		name: "Radial bar chart",
		nameKo: "방사형 막대"
	},
	gauge: {
		component: "GaugeChart",
		name: "Gauge",
		nameKo: "게이지"
	},
	bullet: {
		component: "BulletChart",
		name: "Bullet chart",
		nameKo: "불릿 차트"
	},
	sparkline: {
		component: "Sparkline",
		name: "Sparkline",
		nameKo: "스파크라인"
	},
	slope: {
		component: "SlopeChart",
		name: "Slope chart",
		nameKo: "슬로프 차트"
	},
	dumbbell: {
		component: "DumbbellChart",
		name: "Dumbbell chart",
		nameKo: "덤벨 차트"
	},
	lollipop: {
		component: "LollipopChart",
		name: "Lollipop chart",
		nameKo: "롤리팝 차트"
	},
	beeswarm: {
		component: "BeeswarmChart",
		name: "Beeswarm",
		nameKo: "비스웜"
	},
	ridgeline: {
		component: "RidgelineChart",
		name: "Ridgeline",
		nameKo: "릿지라인"
	},
	sankey: {
		component: "SankeyChart",
		name: "Sankey diagram",
		nameKo: "생키 다이어그램"
	},
	chord: {
		component: "ChordChart",
		name: "Chord diagram",
		nameKo: "코드 다이어그램"
	},
	calendar: {
		component: "CalendarHeatmap",
		name: "Calendar heatmap",
		nameKo: "캘린더 히트맵"
	},
	bump: {
		component: "BumpChart",
		name: "Bump chart",
		nameKo: "범프 차트"
	},
	box: {
		component: "BoxPlot",
		name: "Box / violin plot",
		nameKo: "박스 플롯"
	},
	parallel: {
		component: "ParallelCoordinates",
		name: "Parallel coordinates",
		nameKo: "평행 좌표"
	},
	candlestick: {
		component: "CandlestickChart",
		name: "Candlestick chart",
		nameKo: "캔들스틱"
	},
	segmented: {
		component: "SegmentedBar",
		name: "Segmented bar",
		nameKo: "비율 막대"
	},
	skyline: {
		component: "SkylineChart",
		name: "Skyline",
		nameKo: "스카이라인"
	},
	histogram: {
		component: "HistogramChart",
		name: "Histogram",
		nameKo: "히스토그램"
	},
	scatter: {
		component: "ScatterChart",
		name: "Scatter plot",
		nameKo: "산점도"
	}
};
function nameIn(meta, lang) {
	return lang === "ko" ? meta.nameKo : meta.name;
}
function specLocale(spec, override) {
	const l = override ?? spec.options?.locale;
	return typeof l === "string" && l ? l.replace(/_/g, "-") : void 0;
}
var TYPE_ALIASES = {
	doughnut: "donut",
	column: "bar",
	stackedBar: "bar",
	groupedBar: "bar",
	stacked: "area",
	streamgraph: "stream",
	radial: "radialBar",
	radialbar: "radialBar",
	progress: "gauge",
	progressRing: "gauge",
	kpi: "gauge",
	violin: "box",
	boxplot: "box",
	calendarHeatmap: "calendar",
	"parallel-coordinates": "parallel",
	parallelCoordinates: "parallel",
	mekko: "marimekko",
	spider: "radar",
	ohlc: "candlestick",
	candle: "candlestick",
	stock: "candlestick",
	segment: "segmented",
	segmentedBar: "segmented",
	proportionBar: "segmented",
	stackedBar100: "segmented",
	hist: "histogram"
};
function resolveMeta(type) {
	const t = CHANNELS[type] ? type : TYPE_ALIASES[type] ?? Object.keys(META).find((k) => k.toLowerCase() === type.toLowerCase() || META[k].component.toLowerCase() === type.toLowerCase());
	if (!t || !META[t]) return void 0;
	return {
		type: t,
		component: META[t].component,
		name: META[t].name,
		nameKo: META[t].nameKo,
		encoding: CHANNELS[t]
	};
}
function relabel(rows, ko2) {
	return rows.map((r) => {
		const out = {};
		for (const [k, v] of Object.entries(r)) out[k] = typeof v === "string" && typeof ko2[v] === "string" ? ko2[v] : v;
		return out;
	});
}
function rekey(rows, ko2) {
	return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [ko2[k] ?? k, v])));
}
var pieSample = [
	{
		device: "Mobile",
		sales: 72
	},
	{
		device: "Desktop",
		sales: 23
	},
	{
		device: "Tablet",
		sales: 5
	}
];
var pieSampleKo = /* @__PURE__ */ relabel(pieSample, {
	Mobile: "모바일",
	Desktop: "PC",
	Tablet: "태블릿"
});
var donutSample = [
	{
		type: "Purchase",
		count: 719
	},
	{
		type: "Sign-up",
		count: 260
	},
	{
		type: "Inquiry",
		count: 161
	},
	{
		type: "Call",
		count: 100
	}
];
var donutSampleKo = /* @__PURE__ */ relabel(donutSample, {
	Purchase: "구매",
	"Sign-up": "회원가입",
	Inquiry: "문의",
	Call: "전화"
});
var funnelSample = [
	{
		stage: "Visit",
		users: 1e4
	},
	{
		stage: "Product view",
		users: 6200
	},
	{
		stage: "Cart",
		users: 1900
	},
	{
		stage: "Purchase",
		users: 760
	}
];
var funnelSampleKo = /* @__PURE__ */ relabel(funnelSample, {
	Visit: "방문",
	"Product view": "상품 조회",
	Cart: "장바구니",
	Purchase: "구매"
});
var waffleSample = [{
	segment: "New",
	customers: 38
}, {
	segment: "Returning",
	customers: 62
}];
var waffleSampleKo = /* @__PURE__ */ relabel(waffleSample, {
	New: "신규",
	Returning: "재구매"
});
var treemapSample = [
	{
		category: "Running shoes",
		product: "Cushion Run",
		share: 22
	},
	{
		category: "Running shoes",
		product: "Race X",
		share: 14
	},
	{
		category: "Running shoes",
		product: "Daily Run",
		share: 10
	},
	{
		category: "Outdoor",
		product: "Trail",
		share: 14
	},
	{
		category: "Outdoor",
		product: "Hiking boots",
		share: 10
	},
	{
		category: "Apparel",
		product: "Jacket",
		share: 11
	},
	{
		category: "Apparel",
		product: "T-shirt",
		share: 7
	},
	{
		category: "Gear",
		product: "Socks",
		share: 7
	},
	{
		category: "Gear",
		product: "Insoles",
		share: 5
	}
];
var treemapSampleKo = /* @__PURE__ */ relabel(treemapSample, {
	"Running shoes": "러닝화",
	Outdoor: "아웃도어",
	Apparel: "의류",
	Gear: "용품",
	"Cushion Run": "쿠셔닝 런",
	"Race X": "레이스 엑스",
	"Daily Run": "데일리 런",
	Trail: "트레일",
	"Hiking boots": "등산화",
	Jacket: "재킷",
	"T-shirt": "티셔츠",
	Socks: "양말",
	Insoles: "깔창"
});
var sunburstSample = [
	{
		channel: "Search",
		campaign: "Brand",
		spend: 18
	},
	{
		channel: "Search",
		campaign: "Generic",
		spend: 30
	},
	{
		channel: "PMax",
		campaign: "All products",
		spend: 25
	},
	{
		channel: "PMax",
		campaign: "Bestsellers",
		spend: 12
	},
	{
		channel: "YouTube",
		campaign: "Remarketing",
		spend: 9
	},
	{
		channel: "YouTube",
		campaign: "New users",
		spend: 6
	}
];
var sunburstSampleKo = /* @__PURE__ */ relabel(sunburstSample, {
	Search: "검색",
	YouTube: "유튜브",
	Brand: "브랜드",
	Generic: "일반",
	"All products": "전체 상품",
	Bestsellers: "베스트",
	Remarketing: "리마케팅",
	"New users": "신규"
});
var waterfallSample = [
	{
		item: "Sep",
		amount: 3200,
		kind: "total"
	},
	{
		item: "New",
		amount: 1100
	},
	{
		item: "Repeat",
		amount: 450
	},
	{
		item: "Discounts",
		amount: -380
	},
	{
		item: "Refunds",
		amount: -270
	},
	{
		item: "Oct",
		kind: "total"
	}
];
var waterfallSampleKo = /* @__PURE__ */ relabel(waterfallSample, {
	Sep: "9월",
	New: "신규",
	Repeat: "재구매",
	Discounts: "할인",
	Refunds: "환불",
	Oct: "10월"
});
var paretoSample = [
	{
		keyword: "running shoes",
		spend: 54
	},
	{
		keyword: "marathon shoes",
		spend: 25
	},
	{
		keyword: "best sneakers",
		spend: 7
	},
	{
		keyword: "cushioned shoes",
		spend: 4
	},
	{
		keyword: "trail shoes",
		spend: 3
	},
	{
		keyword: "light shoes",
		spend: 2.5
	},
	{
		keyword: "running socks",
		spend: 2
	},
	{
		keyword: "insoles",
		spend: 1.2
	},
	{
		keyword: "running belt",
		spend: .8
	},
	{
		keyword: "wristband",
		spend: .5
	}
];
var paretoSampleKo = /* @__PURE__ */ relabel(paretoSample, {
	"running shoes": "러닝화",
	"marathon shoes": "마라톤화",
	"best sneakers": "운동화 추천",
	"cushioned shoes": "쿠션화",
	"trail shoes": "트레일화",
	"light shoes": "경량화",
	"running socks": "러닝 양말",
	insoles: "깔창",
	"running belt": "러닝 벨트",
	wristband: "아대"
});
var marimekkoSample = [
	{
		channel: "Search",
		device: "Mobile",
		sales: 26.1
	},
	{
		channel: "Search",
		device: "Desktop",
		sales: 16.2
	},
	{
		channel: "Search",
		device: "Tablet",
		sales: 2.7
	},
	{
		channel: "PMax",
		device: "Mobile",
		sales: 25.9
	},
	{
		channel: "PMax",
		device: "Desktop",
		sales: 7.7
	},
	{
		channel: "PMax",
		device: "Tablet",
		sales: 1.4
	},
	{
		channel: "Social",
		device: "Mobile",
		sales: 17.6
	},
	{
		channel: "Social",
		device: "Desktop",
		sales: 1.8
	},
	{
		channel: "Social",
		device: "Tablet",
		sales: .6
	}
];
var marimekkoSampleKo = /* @__PURE__ */ relabel(marimekkoSample, {
	Search: "검색",
	Social: "SNS",
	Mobile: "모바일",
	Desktop: "PC",
	Tablet: "태블릿"
});
function heatmapRows(days, hours) {
	return days.flatMap((day, di) => hours.map((hour, hi) => {
		const base = [
			2,
			1,
			3,
			14,
			22,
			18,
			26,
			31
		][hi];
		const weekend = di >= 5 ? hi >= 4 ? 1.35 : .8 : 1;
		const fri = di === 4 && hi >= 6 ? 1.3 : 1;
		return {
			day,
			hour,
			orders: Math.round(base * weekend * fri * (.9 + (di * 7 + hi * 3) % 5 * .06))
		};
	}));
}
var heatmapSample = /* @__PURE__ */ heatmapRows([
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
	"Sun"
], [
	"12am",
	"3am",
	"6am",
	"9am",
	"12pm",
	"3pm",
	"6pm",
	"9pm"
]);
var heatmapSampleKo = /* @__PURE__ */ heatmapRows([
	"월",
	"화",
	"수",
	"목",
	"금",
	"토",
	"일"
], [
	"0시",
	"3시",
	"6시",
	"9시",
	"12시",
	"15시",
	"18시",
	"21시"
]);
var radarSample = [
	{
		metric: "Speed",
		product: "Our app",
		score: 86
	},
	{
		metric: "Stability",
		product: "Our app",
		score: 78
	},
	{
		metric: "Design",
		product: "Our app",
		score: 92
	},
	{
		metric: "Price",
		product: "Our app",
		score: 64
	},
	{
		metric: "Support",
		product: "Our app",
		score: 70
	},
	{
		metric: "Features",
		product: "Our app",
		score: 81
	},
	{
		metric: "Speed",
		product: "Industry average",
		score: 72
	},
	{
		metric: "Stability",
		product: "Industry average",
		score: 74
	},
	{
		metric: "Design",
		product: "Industry average",
		score: 68
	},
	{
		metric: "Price",
		product: "Industry average",
		score: 71
	},
	{
		metric: "Support",
		product: "Industry average",
		score: 66
	},
	{
		metric: "Features",
		product: "Industry average",
		score: 75
	}
];
var radarSampleKo = /* @__PURE__ */ relabel(radarSample, {
	Speed: "속도",
	Stability: "안정성",
	Design: "디자인",
	Price: "가격",
	Support: "지원",
	Features: "기능",
	"Our app": "우리 앱",
	"Industry average": "업계 평균"
});
var bubbleSample = [
	{
		campaign: "Brand search",
		cpc: 420,
		roas: 680,
		spend: 1800
	},
	{
		campaign: "Generic search",
		cpc: 780,
		roas: 310,
		spend: 4200
	},
	{
		campaign: "PMax all",
		cpc: 560,
		roas: 520,
		spend: 3600
	},
	{
		campaign: "PMax best",
		cpc: 610,
		roas: 430,
		spend: 1500
	},
	{
		campaign: "YouTube new",
		cpc: 340,
		roas: 180,
		spend: 2100
	},
	{
		campaign: "Remarketing",
		cpc: 290,
		roas: 610,
		spend: 900
	},
	{
		campaign: "Insta feed",
		cpc: 470,
		roas: 260,
		spend: 2600
	},
	{
		campaign: "Insta reels",
		cpc: 390,
		roas: 340,
		spend: 1700
	},
	{
		campaign: "Kakao biz",
		cpc: 520,
		roas: 240,
		spend: 1200
	},
	{
		campaign: "Naver shopping",
		cpc: 690,
		roas: 470,
		spend: 2900
	}
];
var bubbleSampleKo = /* @__PURE__ */ relabel(bubbleSample, {
	"Brand search": "브랜드 검색",
	"Generic search": "일반 검색",
	"PMax all": "PMax 전체",
	"PMax best": "PMax 베스트",
	"YouTube new": "유튜브 신규",
	Remarketing: "리마케팅",
	"Insta feed": "인스타 피드",
	"Insta reels": "인스타 릴스",
	"Kakao biz": "카카오 비즈",
	"Naver shopping": "네이버 쇼핑"
});
var MONTHS_EN = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec"
];
var MONTHS_KO = [
	"1월",
	"2월",
	"3월",
	"4월",
	"5월",
	"6월",
	"7월",
	"8월",
	"9월",
	"10월",
	"11월",
	"12월"
];
function lineRows(apps) {
	return MONTHS_EN.flatMap((_m, i) => [
		{
			month: `2025-${String(i + 1).padStart(2, "0")}`,
			app: apps[0],
			mau: Math.round((42 + i * 3.1 + Math.sin(i * .9) * 2.2) * 10) / 10,
			p5: Math.round((39.4 + i * 2.9) * 10) / 10,
			p95: Math.round((44.6 + i * 3.3) * 10) / 10
		},
		{
			month: `2025-${String(i + 1).padStart(2, "0")}`,
			app: apps[1],
			mau: Math.round((55 + i * .9 + Math.cos(i * .7) * 1.8) * 10) / 10
		},
		{
			month: `2025-${String(i + 1).padStart(2, "0")}`,
			app: apps[2],
			mau: Math.round((38 - i * .6 + Math.sin(i * 1.3) * 1.5) * 10) / 10
		}
	]);
}
var lineSample = /* @__PURE__ */ lineRows([
	"Our app",
	"Rival A",
	"Rival B"
]);
var lineSampleKo = /* @__PURE__ */ lineRows([
	"우리 앱",
	"경쟁 A",
	"경쟁 B"
]);
function areaRows(months, channels) {
	return months.flatMap((m, i) => [
		{
			month: m,
			channel: channels[0],
			visits: Math.round(120 + i * 6 + Math.sin(i) * 8)
		},
		{
			month: m,
			channel: channels[1],
			visits: Math.round(60 + i * 9 + Math.cos(i * .8) * 10)
		},
		{
			month: m,
			channel: channels[2],
			visits: Math.round(80 + Math.sin(i * .6) * 6)
		},
		{
			month: m,
			channel: channels[3],
			visits: Math.round(30 + i * 2)
		}
	]);
}
var areaSample = /* @__PURE__ */ areaRows(MONTHS_EN, [
	"Search",
	"Social",
	"Direct",
	"Referral"
]);
var areaSampleKo = /* @__PURE__ */ areaRows(MONTHS_KO, [
	"검색",
	"SNS",
	"직접",
	"추천"
]);
function streamRows(week, genres) {
	return Array.from({ length: 20 }, (_, w) => genres.map((g, gi) => {
		const peak = [
			4,
			9,
			14,
			6,
			17,
			11
		][gi];
		const v = 6 + [
			38,
			30,
			14,
			20,
			26,
			22
		][gi] * Math.exp(-((w - peak) ** 2) / (2 * (3 + gi) ** 2)) + w * (gi + 3) % 4;
		return {
			week: week(w + 1),
			genre: g,
			hours: Math.round(v * 10) / 10
		};
	})).flat();
}
var streamSample = /* @__PURE__ */ streamRows((n) => `W${n}`, [
	"Drama",
	"Variety",
	"Docs",
	"Anime",
	"Sports",
	"Movies"
]);
var streamSampleKo = /* @__PURE__ */ streamRows((n) => `${n}주`, [
	"드라마",
	"예능",
	"다큐",
	"애니",
	"스포츠",
	"영화"
]);
var barSample = [
	{
		quarter: "Q1",
		team: "Domestic",
		revenue: 42
	},
	{
		quarter: "Q1",
		team: "Overseas",
		revenue: 18
	},
	{
		quarter: "Q2",
		team: "Domestic",
		revenue: 48
	},
	{
		quarter: "Q2",
		team: "Overseas",
		revenue: 24
	},
	{
		quarter: "Q3",
		team: "Domestic",
		revenue: 51
	},
	{
		quarter: "Q3",
		team: "Overseas",
		revenue: 33
	},
	{
		quarter: "Q4",
		team: "Domestic",
		revenue: 55
	},
	{
		quarter: "Q4",
		team: "Overseas",
		revenue: 41
	}
];
var barSampleKo = /* @__PURE__ */ relabel(barSample, {
	Q1: "1분기",
	Q2: "2분기",
	Q3: "3분기",
	Q4: "4분기",
	Domestic: "국내",
	Overseas: "해외"
});
var radialBarSample = [
	{
		goal: "Revenue",
		rate: 82
	},
	{
		goal: "Sign-ups",
		rate: 64
	},
	{
		goal: "Repeat buys",
		rate: 91
	},
	{
		goal: "NPS",
		rate: 47
	}
];
var radialBarSampleKo = /* @__PURE__ */ relabel(radialBarSample, {
	Revenue: "매출",
	"Sign-ups": "신규 가입",
	"Repeat buys": "재구매"
});
var gaugeSample = [{
	label: "Goal reached",
	value: 73,
	target: 85
}];
var gaugeSampleKo = /* @__PURE__ */ relabel(gaugeSample, { "Goal reached": "목표 달성률" });
var bulletSample = [
	{
		kpi: "Revenue (100M)",
		actual: 27.4,
		target: 30,
		poor: 18,
		ok: 25,
		good: 34
	},
	{
		kpi: "Operating profit (100M)",
		actual: 4.1,
		target: 3.6,
		poor: 2,
		ok: 3,
		good: 5
	},
	{
		kpi: "New customers (k)",
		actual: 12.8,
		target: 15,
		poor: 8,
		ok: 12,
		good: 18
	},
	{
		kpi: "Satisfaction (pts)",
		actual: 4.3,
		target: 4.5,
		poor: 3.5,
		ok: 4,
		good: 5
	}
];
var bulletSampleKo = /* @__PURE__ */ relabel(bulletSample, {
	"Revenue (100M)": "매출(억)",
	"Operating profit (100M)": "영업이익(억)",
	"New customers (k)": "신규 고객(천)",
	"Satisfaction (pts)": "만족도(점)"
});
var sparklineSample = /* @__PURE__ */ Array.from({ length: 30 }, (_, i) => ({
	day: `2025-06-${String(i + 1).padStart(2, "0")}`,
	revenue: Math.round(1200 + i * 18 + Math.sin(i * .8) * 120 + (i % 7 === 5 ? 160 : 0))
}));
var slopeSample = [
	{
		brand: "Our brand",
		period: "2024",
		share: 18
	},
	{
		brand: "Our brand",
		period: "2025",
		share: 27
	},
	{
		brand: "Brand A",
		period: "2024",
		share: 31
	},
	{
		brand: "Brand A",
		period: "2025",
		share: 28
	},
	{
		brand: "Brand B",
		period: "2024",
		share: 24
	},
	{
		brand: "Brand B",
		period: "2025",
		share: 21
	},
	{
		brand: "Brand C",
		period: "2024",
		share: 15
	},
	{
		brand: "Brand C",
		period: "2025",
		share: 14
	},
	{
		brand: "Brand D",
		period: "2024",
		share: 12
	},
	{
		brand: "Brand D",
		period: "2025",
		share: 10
	}
];
var slopeSampleKo = /* @__PURE__ */ relabel(slopeSample, {
	"Our brand": "우리 브랜드",
	"Brand A": "A사",
	"Brand B": "B사",
	"Brand C": "C사",
	"Brand D": "D사"
});
var dumbbellSample = [
	{
		region: "Seoul",
		before: 3.2,
		after: 4.6
	},
	{
		region: "Gyeonggi",
		before: 2.8,
		after: 3.9
	},
	{
		region: "Busan",
		before: 2.1,
		after: 2.6
	},
	{
		region: "Daegu",
		before: 1.9,
		after: 2.2
	},
	{
		region: "Incheon",
		before: 2.3,
		after: 3.1
	},
	{
		region: "Gwangju",
		before: 1.6,
		after: 1.8
	},
	{
		region: "Daejeon",
		before: 1.7,
		after: 2.4
	}
];
var dumbbellSampleKo = /* @__PURE__ */ relabel(dumbbellSample, {
	Seoul: "서울",
	Gyeonggi: "경기",
	Busan: "부산",
	Daegu: "대구",
	Incheon: "인천",
	Gwangju: "광주",
	Daejeon: "대전"
});
var lollipopSample = [
	{
		feature: "Search",
		usage: 82
	},
	{
		feature: "Cart",
		usage: 74
	},
	{
		feature: "Wishlist",
		usage: 61
	},
	{
		feature: "Reviews",
		usage: 48
	},
	{
		feature: "Coupons",
		usage: 39
	},
	{
		feature: "Gifting",
		usage: 22
	},
	{
		feature: "Live",
		usage: 14
	}
];
var lollipopSampleKo = /* @__PURE__ */ relabel(lollipopSample, {
	Search: "검색",
	Cart: "장바구니",
	Wishlist: "찜하기",
	Reviews: "리뷰",
	Coupons: "쿠폰함",
	Gifting: "선물하기",
	Live: "라이브"
});
function seeded(seed) {
	let s = seed >>> 0;
	return () => {
		s = s * 1664525 + 1013904223 >>> 0;
		return s / 4294967296;
	};
}
function gauss(rnd) {
	const u = Math.max(1e-9, rnd());
	const v = rnd();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function beeswarmRows(names) {
	const rnd = seeded(7);
	return [
		{
			plan: names[0],
			mu: 9,
			sd: 4,
			n: 70
		},
		{
			plan: names[1],
			mu: 17,
			sd: 5,
			n: 55
		},
		{
			plan: names[2],
			mu: 26,
			sd: 6,
			n: 40
		}
	].flatMap((pl) => Array.from({ length: pl.n }, (_, i) => ({
		id: `${pl.plan}-${i + 1}`,
		plan: pl.plan,
		minutes: Math.max(1, Math.round((pl.mu + gauss(rnd) * pl.sd) * 10) / 10)
	})));
}
var beeswarmSample = /* @__PURE__ */ beeswarmRows([
	"Free",
	"Basic",
	"Pro"
]);
var beeswarmSampleKo = /* @__PURE__ */ beeswarmRows([
	"무료",
	"베이직",
	"프로"
]);
function ridgelineRows(names) {
	const rnd = seeded(11);
	return [
		{
			region: names[0],
			mu: 18,
			sd: 5
		},
		{
			region: names[1],
			mu: 22,
			sd: 6
		},
		{
			region: names[2],
			mu: 34,
			sd: 9
		},
		{
			region: names[3],
			mu: 28,
			sd: 7
		},
		{
			region: names[4],
			mu: 31,
			sd: 8
		},
		{
			region: names[5],
			mu: 29,
			sd: 7
		},
		{
			region: names[6],
			mu: 46,
			sd: 11
		}
	].flatMap((r) => Array.from({ length: 120 }, () => ({
		region: r.region,
		hours: Math.max(2, Math.round((r.mu + gauss(rnd) * r.sd) * 10) / 10)
	})));
}
var ridgelineSample = /* @__PURE__ */ ridgelineRows([
	"Seoul",
	"Gyeonggi",
	"Gangwon",
	"Chungcheong",
	"Jeolla",
	"Gyeongsang",
	"Jeju"
]);
var ridgelineSampleKo = /* @__PURE__ */ ridgelineRows([
	"서울",
	"경기",
	"강원",
	"충청",
	"전라",
	"경상",
	"제주"
]);
var sankeySample = [
	{
		source: "Search",
		target: "Product page",
		value: 4200
	},
	{
		source: "Social",
		target: "Product page",
		value: 2600
	},
	{
		source: "Social",
		target: "Promo page",
		value: 1400
	},
	{
		source: "Direct",
		target: "Product page",
		value: 1800
	},
	{
		source: "Direct",
		target: "Promo page",
		value: 600
	},
	{
		source: "Product page",
		target: "Cart",
		value: 3900
	},
	{
		source: "Product page",
		target: "Drop-off",
		value: 4700
	},
	{
		source: "Promo page",
		target: "Cart",
		value: 900
	},
	{
		source: "Promo page",
		target: "Drop-off",
		value: 1100
	},
	{
		source: "Cart",
		target: "Purchase",
		value: 2900
	},
	{
		source: "Cart",
		target: "Drop-off ",
		value: 1900
	}
];
var sankeySampleKo = /* @__PURE__ */ relabel(sankeySample, {
	Search: "검색",
	Social: "SNS",
	Direct: "직접",
	"Product page": "상품 상세",
	"Promo page": "이벤트",
	Cart: "장바구니",
	"Drop-off": "이탈",
	"Drop-off ": "이탈 ",
	Purchase: "구매"
});
var chordSample = [
	{
		from: "Design",
		to: "Engineering",
		value: 42
	},
	{
		from: "Engineering",
		to: "Design",
		value: 28
	},
	{
		from: "Product",
		to: "Design",
		value: 36
	},
	{
		from: "Product",
		to: "Engineering",
		value: 54
	},
	{
		from: "Engineering",
		to: "Product",
		value: 22
	},
	{
		from: "Marketing",
		to: "Product",
		value: 31
	},
	{
		from: "Marketing",
		to: "Design",
		value: 26
	},
	{
		from: "Design",
		to: "Marketing",
		value: 12
	},
	{
		from: "Data",
		to: "Product",
		value: 18
	},
	{
		from: "Data",
		to: "Marketing",
		value: 24
	},
	{
		from: "Engineering",
		to: "Data",
		value: 16
	},
	{
		from: "Product",
		to: "Marketing",
		value: 14
	}
];
var chordSampleKo = /* @__PURE__ */ relabel(chordSample, {
	Design: "디자인",
	Engineering: "개발",
	Product: "기획",
	Marketing: "마케팅",
	Data: "데이터"
});
var calendarSample = /* @__PURE__ */ (() => {
	const rnd = seeded(3);
	const out = [];
	const start = new Date(2025, 0, 1);
	for (let i = 0; i < 365; i++) {
		const d = new Date(start);
		d.setDate(start.getDate() + i);
		const wd = d.getDay();
		const season = 1 + .5 * Math.sin(i / 365 * Math.PI * 2 - 1);
		const base = wd === 0 || wd === 6 ? .6 : 4.2;
		const burst = rnd() < .05 ? 8 : 0;
		const v = Math.max(0, Math.round(base * season + gauss(rnd) * 1.6 + burst));
		out.push({
			date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
			commits: v
		});
	}
	return out;
})();
function bumpRows(apps, months) {
	const ranks2 = [
		[
			5,
			4,
			4,
			3,
			2,
			2,
			1
		],
		[
			1,
			1,
			2,
			2,
			3,
			3,
			3
		],
		[
			2,
			3,
			1,
			1,
			1,
			1,
			2
		],
		[
			3,
			2,
			3,
			4,
			4,
			5,
			5
		],
		[
			4,
			5,
			6,
			5,
			5,
			4,
			4
		],
		[
			6,
			6,
			5,
			6,
			6,
			6,
			6
		]
	];
	return apps.flatMap((a, ai) => months.map((m, mi) => ({
		month: m,
		app: a,
		rank: ranks2[ai][mi]
	})));
}
var bumpSample = /* @__PURE__ */ bumpRows([
	"Our app",
	"App A",
	"App B",
	"App C",
	"App D",
	"App E"
], /* @__PURE__ */ MONTHS_EN.slice(0, 7));
var bumpSampleKo = /* @__PURE__ */ bumpRows([
	"우리 앱",
	"A앱",
	"B앱",
	"C앱",
	"D앱",
	"E앱"
], /* @__PURE__ */ MONTHS_KO.slice(0, 7));
var boxSample = /* @__PURE__ */ (() => {
	const rnd = seeded(5);
	return [
		{
			api: "/login",
			mu: 120,
			sd: 30
		},
		{
			api: "/search",
			mu: 210,
			sd: 60
		},
		{
			api: "/cart",
			mu: 150,
			sd: 35
		},
		{
			api: "/pay",
			mu: 320,
			sd: 80
		},
		{
			api: "/feed",
			mu: 180,
			sd: 45
		}
	].flatMap((a) => Array.from({ length: 80 }, (_, i) => ({
		api: a.api,
		ms: Math.max(30, Math.round(a.mu + gauss(rnd) * a.sd + (i % 37 === 0 ? a.sd * 3.2 : 0)))
	})));
})();
var histogramSample = /* @__PURE__ */ (() => {
	const rnd = seeded(17);
	return Array.from({ length: 320 }, (_, i) => ({ ms: Math.round(i % 25 === 0 ? 650 + rnd() * 800 : Math.exp(Math.log(170) + gauss(rnd) * .42)) }));
})();
var parallelSample = [
	{
		model: "Air 13",
		price: 159,
		weight: 1.24,
		battery: 18,
		perf: 72,
		screen: 13.6
	},
	{
		model: "Pro 14",
		price: 299,
		weight: 1.55,
		battery: 17,
		perf: 91,
		screen: 14.2
	},
	{
		model: "Ultra 16",
		price: 389,
		weight: 2.14,
		battery: 14,
		perf: 97,
		screen: 16.2
	},
	{
		model: "Slim 15",
		price: 189,
		weight: 1.51,
		battery: 15,
		perf: 70,
		screen: 15.3
	},
	{
		model: "Gaming 17",
		price: 329,
		weight: 2.8,
		battery: 6,
		perf: 95,
		screen: 17.3
	},
	{
		model: "Basic 14",
		price: 89,
		weight: 1.45,
		battery: 10,
		perf: 48,
		screen: 14
	},
	{
		model: "2-in-1 13",
		price: 179,
		weight: 1.29,
		battery: 13,
		perf: 66,
		screen: 13.3
	},
	{
		model: "Creator 16",
		price: 349,
		weight: 1.98,
		battery: 12,
		perf: 93,
		screen: 16
	}
];
var parallelSampleKo = /* @__PURE__ */ relabel(parallelSample, {
	"Air 13": "에어 13",
	"Pro 14": "프로 14",
	"Ultra 16": "울트라 16",
	"Slim 15": "슬림 15",
	"Gaming 17": "게이밍 17",
	"Basic 14": "베이직 14",
	"2-in-1 13": "투인원 13",
	"Creator 16": "크리에이터 16"
});
var segmentedSample = [
	{
		method: "Card",
		amount: 412
	},
	{
		method: "Mobile pay",
		amount: 278
	},
	{
		method: "Bank transfer",
		amount: 134
	},
	{
		method: "Phone bill",
		amount: 45
	},
	{
		method: "Other",
		amount: 27
	}
];
var segmentedSampleKo = /* @__PURE__ */ relabel(segmentedSample, {
	Card: "카드",
	"Mobile pay": "간편결제",
	"Bank transfer": "계좌이체",
	"Phone bill": "휴대폰",
	Other: "기타"
});
var candlestickSample = /* @__PURE__ */ (() => {
	const rnd = seeded(23);
	const out = [];
	const d = new Date(2025, 8, 1);
	let close = 61200;
	while (out.length < 60) {
		const wd = d.getDay();
		if (wd !== 0 && wd !== 6) {
			const k = out.length;
			const drift = k < 18 ? -.004 : k < 34 ? .003 : .0065;
			const open = Math.round(close * (1 + gauss(rnd) * .006) / 100) * 100;
			const next = Math.round(open * (1 + drift + gauss(rnd) * .014) / 100) * 100;
			const high = Math.round(Math.max(open, next) * (1 + Math.abs(gauss(rnd)) * .007) / 100) * 100;
			const low = Math.round(Math.min(open, next) * (1 - Math.abs(gauss(rnd)) * .007) / 100) * 100;
			const volume = Math.round((900 + Math.abs(next - open) / 20 + rnd() * 600) * 1e3);
			out.push({
				date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
				open,
				high,
				low,
				close: next,
				volume
			});
			close = next;
		}
		d.setDate(d.getDate() + 1);
	}
	return out;
})();
var skylineSample = [
	{
		day: "2026-10-23",
		Input: 41e4,
		Cached: 317223,
		Output: 186999,
		Reasoning: 79534,
		Failed: 11e3,
		Retried: 1e4
	},
	{
		day: "2026-10-24",
		Input: 446030,
		Cached: 337921,
		Output: 202044,
		Reasoning: 87942,
		Failed: 15314,
		Retried: 9190
	},
	{
		day: "2026-10-25",
		Input: 440886,
		Cached: 336150,
		Output: 202507,
		Reasoning: 87489,
		Failed: 15398,
		Retried: 6051
	},
	{
		day: "2026-10-26",
		Input: 472300,
		Cached: 370227,
		Output: 221753,
		Reasoning: 92899,
		Failed: 13276,
		Retried: 4626
	},
	{
		day: "2026-10-27",
		Input: 456358,
		Cached: 366468,
		Output: 216506,
		Reasoning: 88261,
		Failed: 9041,
		Retried: 5714
	},
	{
		day: "2026-10-28",
		Input: 482495,
		Cached: 386711,
		Output: 226337,
		Reasoning: 92466,
		Failed: 8633,
		Retried: 9460
	},
	{
		day: "2026-10-29",
		Input: 519595,
		Cached: 405554,
		Output: 238274,
		Reasoning: 100345,
		Failed: 12610,
		Retried: 12608
	},
	{
		day: "2026-10-30",
		Input: 509048,
		Cached: 387050,
		Output: 230518,
		Reasoning: 99954,
		Failed: 16653,
		Retried: 11318
	},
	{
		day: "2026-10-31",
		Input: 545022,
		Cached: 413595,
		Output: 248950,
		Reasoning: 108123,
		Failed: 9e4,
		Retried: 126e3
	},
	{
		day: "2026-11-01",
		Input: 566932,
		Cached: 440538,
		Output: 264628,
		Reasoning: 111944,
		Failed: 17316,
		Retried: 5841
	},
	{
		day: "2026-11-02",
		Input: 550201,
		Cached: 439688,
		Output: 260808,
		Reasoning: 106914,
		Failed: 12001,
		Retried: 6097
	},
	{
		day: "2026-11-03",
		Input: 586400,
		Cached: 471716,
		Output: 276507,
		Reasoning: 112488,
		Failed: 10262,
		Retried: 10281
	},
	{
		day: "2026-11-04",
		Input: 587529,
		Cached: 462627,
		Output: 271133,
		Reasoning: 113044,
		Failed: 12856,
		Retried: 13840
	},
	{
		day: "2026-11-05",
		Input: 622545,
		Cached: 476047,
		Output: 282345,
		Reasoning: 121668,
		Failed: 19059,
		Retried: 14613
	}
];
var skylineSampleKo = /* @__PURE__ */ rekey(skylineSample, {
	Input: "입력",
	Cached: "캐시",
	Output: "출력",
	Reasoning: "추론",
	Failed: "실패",
	Retried: "재시도"
});
function scatterRows(names, request) {
	const rnd = seeded(29);
	const models = [
		{
			model: names[0],
			cost: [5, 14],
			base: 1400,
			perCent: 150,
			sd: 260
		},
		{
			model: names[1],
			cost: [2, 7],
			base: 650,
			perCent: 150,
			sd: 170
		},
		{
			model: names[2],
			cost: [1, 3],
			base: 280,
			perCent: 130,
			sd: 90
		}
	];
	return Array.from({ length: 54 }, (_, i) => {
		const m = models[i % 3];
		const cost = Math.round(m.cost[0] + rnd() * (m.cost[1] - m.cost[0]));
		const ms = Math.max(120, Math.round((m.base + cost * m.perCent + gauss(rnd) * m.sd) / 10) * 10);
		return {
			id: `${request} ${i + 1}`,
			model: m.model,
			cost,
			ms
		};
	});
}
var scatterSample = /* @__PURE__ */ scatterRows([
	"Large",
	"Medium",
	"Small"
], "Request");
var scatterSampleKo = /* @__PURE__ */ scatterRows([
	"대형",
	"중형",
	"소형"
], "요청");
var COMMON_OPTIONS = [
	{
		name: "height",
		type: "number",
		min: 40,
		description: "Height in px. Without it, each chart picks a default that fits its width"
	},
	{
		name: "width",
		type: "number",
		min: 40,
		description: "Fixed width in px. Without it, the chart fits its parent"
	},
	{
		name: "highlight",
		type: "highlight",
		description: "Item to highlight. An index, a name, an array, or \"max\" | \"min\" | \"first\" | \"last\" | \"none\""
	},
	{
		name: "format",
		type: "format",
		description: "Value format. \"number\" | \"integer\" | \"percent\" | \"ratio\" | \"compact\" | \"currency\" | \"decimal\" or Intl.NumberFormat options"
	},
	{
		name: "unit",
		type: "string",
		description: "Unit appended to values. For example \"%\" or \"ms\""
	},
	{
		name: "locale",
		type: "string",
		default: "en-US",
		description: "Locale for numbers, dates and the text a chart writes itself (tooltips, screen reader sentences). \"ko\" or \"ko-*\" switches to Korean. Falls back to the ThemeProvider locale"
	},
	{
		name: "animate",
		type: "boolean",
		default: true,
		description: "Entry and update animation"
	},
	{
		name: "duration",
		type: "number",
		min: 0,
		description: "Animation length (ms)"
	},
	{
		name: "easing",
		type: "enum",
		enum: [
			"spring",
			"easeOut",
			"easeInOut",
			"linear"
		],
		default: "spring",
		description: "Motion curve"
	},
	{
		name: "stagger",
		type: "number",
		min: 0,
		description: "Delay between items as they enter (ms)"
	},
	{
		name: "reducedMotion",
		type: "any",
		default: "auto",
		description: "\"auto\" follows the OS setting. true always turns motion off"
	},
	{
		name: "animateOnView",
		type: "boolean",
		default: true,
		description: "Play when the chart scrolls into view"
	},
	{
		name: "showLabels",
		type: "boolean",
		default: true,
		description: "Labels drawn on the chart (values and names)"
	},
	{
		name: "tooltip",
		type: "boolean",
		default: true,
		description: "Show tooltips"
	},
	{
		name: "syncId",
		type: "string",
		description: "Charts with the same syncId show the hovered x together (line, area, bar, candlestick). <ChartGrid sync> sets one for every chart inside it"
	},
	{
		name: "ariaLabel",
		type: "string",
		description: "Name for screen readers"
	},
	{
		name: "description",
		type: "string",
		description: "Description for screen readers. Built from the data when omitted"
	}
];
var op = /* @__NO_SIDE_EFFECTS__ */ (name, type, description, extra = {}) => ({
	name,
	type,
	description,
	...extra
});
var CURVE = /* @__PURE__ */ op("curve", "enum", "Line shape", {
	enum: [
		"smooth",
		"linear",
		"step"
	],
	default: "smooth"
});
var XTYPE = /* @__PURE__ */ op("xType", "enum", "Sets the x type yourself. Automatic when omitted", { enum: [
	"number",
	"date",
	"band"
] });
var BRUSH = /* @__PURE__ */ op("brush", "any", "Drag to select a range. true shows the change and the high and low, \"zoom\" zooms into the range (keyboard: Shift+arrows, Enter)", { default: false });
var ANNOTATION_TYPES = [
	"band",
	"line",
	"event",
	"forecast",
	"trend",
	"weekends"
];
var ANNOTATIONS = /* @__PURE__ */ op("annotations", "annotations", "Notes drawn on the chart: target band, period, reference line, event, forecast, trend line, weekend shading. [{ type, x, y, from, label }]");
var BAND_FROM = /* @__PURE__ */ op("bandFrom", "enum", "Where the range band starts. \"forecast\" starts it at the forecast annotation", {
	enum: ["start", "forecast"],
	default: "start"
});
var OUTSIDE = /* @__PURE__ */ op("outside", "boolean", "Mark points outside the range band and count them in the description", { default: false });
var CONNECT_NULLS = /* @__PURE__ */ op("connectNulls", "boolean", "Join the line across missing values (null, NaN or no row at that x). By default the line and its area break there, and a point left alone shows as a dot. Stacked areas ignore it", { default: false });
var SIGN = [
	/* @__PURE__ */ op("signColors", "boolean", "Colors the highlighted series differently above and below baseline (profit and loss)", { default: false }),
	/* @__PURE__ */ op("baseline", "number", "Value that splits signColors", { default: 0 }),
	/* @__PURE__ */ op("downColor", "string", "Color below the baseline (token name or CSS color)", { default: "neutralStrong" })
];
var ENTRIES = [
	{
		type: "pie",
		level: "basic",
		group: "proportion",
		summary: "Each item's share of the whole",
		useWhen: "2 to 4 items that add up to 100%",
		avoidWhen: "More than 4 items, or values close to each other (bars are more accurate)",
		why: "Only the highlighted slice (the largest by default) gets the accent color and the rest stay neutral, so one share carries the message.",
		options: [
			/* @__PURE__ */ op("colorMode", "enum", "A gray step per item (categorical) or color only the highlight (emphasis)", {
				enum: ["categorical", "emphasis"],
				default: "categorical"
			}),
			/* @__PURE__ */ op("sort", "boolean", "Sort largest first", { default: false }),
			/* @__PURE__ */ op("startAngle", "number", "Start angle in degrees. 0 is 12 o'clock", { default: 0 }),
			/* @__PURE__ */ op("labelMode", "enum", "What slice labels show", {
				enum: [
					"percent",
					"value",
					"label",
					"none"
				],
				default: "percent"
			})
		],
		example: {
			data: pieSample,
			encoding: {
				label: "device",
				value: "sales"
			},
			options: { highlight: "Mobile" },
			card: {
				subtitle: "Sales share by device",
				takeaway: "Only 2 to 4 items",
				legend: "auto"
			}
		}
	},
	{
		type: "donut",
		level: "basic",
		group: "proportion",
		summary: "A share chart with the total in the center",
		useWhen: "The total matters as much as the shares",
		avoidWhen: "More than 6 items",
		why: "The center number counts up as the chart enters, so the total reads first.",
		options: [
			/* @__PURE__ */ op("innerRadius", "number", "Inner radius ratio", {
				default: .62,
				min: .2,
				max: .9
			}),
			/* @__PURE__ */ op("centerValue", "any", "Number in the center: \"total\" | \"highlight\" | a number | null (none)", { default: "total" }),
			/* @__PURE__ */ op("centerLabel", "string", "Caption under the center number"),
			/* @__PURE__ */ op("legend", "enum", "Legend position", {
				enum: [
					"auto",
					"right",
					"bottom",
					"none"
				],
				default: "auto"
			}),
			/* @__PURE__ */ op("sort", "boolean", "Sort largest first", { default: false })
		],
		example: {
			data: donutSample,
			encoding: {
				label: "type",
				value: "count"
			},
			options: { centerLabel: "Conversions" },
			card: {
				subtitle: "Share by conversion type",
				takeaway: "Total in the center"
			}
		}
	},
	{
		type: "funnel",
		level: "basic",
		group: "flow",
		summary: "How much drops at each stage, with conversion rates",
		useWhen: "Ordered steps such as a sign-up or purchase flow",
		avoidWhen: "The steps have no order, or values grow from step to step",
		why: "Highlights the stage with the lowest conversion rate, so you see where users drop off.",
		options: [
			/* @__PURE__ */ op("showRates", "boolean", "Show conversion rates on the right", { default: true }),
			/* @__PURE__ */ op("rateBase", "enum", "Base for the conversion rate", {
				enum: ["previous", "first"],
				default: "previous"
			}),
			/* @__PURE__ */ op("rateLabel", "string", "Title of the rate column. \"전 단계 대비\" by default in Korean locales", { default: "vs. previous" })
		],
		example: {
			data: funnelSample,
			encoding: {
				label: "stage",
				value: "users"
			},
			card: {
				subtitle: "Users by stage",
				takeaway: "Drop-off by stage"
			}
		}
	},
	{
		type: "waffle",
		level: "intermediate",
		group: "proportion",
		summary: "Proportion on a 100-cell grid",
		useWhen: "A share reads better as a count, like '38 out of 100'",
		avoidWhen: "More than 4 items, or differences under 1% matter",
		why: "Cells fill row by row, which gives a feel for the number before you read it.",
		options: [
			/* @__PURE__ */ op("cells", "number", "Number of cells", {
				default: 100,
				min: 1
			}),
			/* @__PURE__ */ op("columns", "number", "Cells per row", {
				default: 10,
				min: 1
			}),
			/* @__PURE__ */ op("total", "number", "Value of the whole. Defaults to the sum"),
			/* @__PURE__ */ op("summary", "boolean", "Show the big number on the right", { default: true }),
			/* @__PURE__ */ op("summaryLabel", "string", "Caption under the big number"),
			/* @__PURE__ */ op("summaryNote", "string", "Second caption line")
		],
		example: {
			data: waffleSample,
			encoding: {
				label: "segment",
				value: "customers"
			},
			options: {
				summaryLabel: "New customers",
				summaryNote: "62 returning"
			},
			card: {
				subtitle: "Out of 100 customers",
				takeaway: "Percent as 100 cells",
				legend: "auto"
			}
		}
	},
	{
		type: "treemap",
		level: "intermediate",
		group: "hierarchy",
		summary: "Shares of a hierarchy shown as area",
		useWhen: "Two levels of share at once, such as products within categories",
		avoidWhen: "Exact size comparison matters",
		why: "The squarified layout keeps cells close to square, so labels fit.",
		options: [
			/* @__PURE__ */ op("path", "array", "Field list for multi-level paths", { items: "string" }),
			/* @__PURE__ */ op("labelMode", "enum", "What cell labels show", {
				enum: [
					"both",
					"name",
					"value",
					"none"
				],
				default: "both"
			}),
			/* @__PURE__ */ op("sort", "boolean", "Sort largest first", { default: true })
		],
		example: {
			data: treemapSample,
			encoding: {
				group: "category",
				label: "product",
				value: "share"
			},
			card: {
				subtitle: "Product sales share by category",
				takeaway: "Shares within a hierarchy"
			}
		}
	},
	{
		type: "sunburst",
		level: "intermediate",
		group: "hierarchy",
		summary: "A hierarchy drawn in rings",
		useWhen: "A breakdown of 2 to 3 levels, such as channel > campaign",
		avoidWhen: "4 or more levels, or more than 20 leaves",
		why: "Rings open from the inside out as the chart enters, so the hierarchy reads level by level.",
		options: [
			/* @__PURE__ */ op("path", "array", "Field list for multi-level paths", { items: "string" }),
			/* @__PURE__ */ op("sort", "boolean", "Sort largest first", { default: false }),
			/* @__PURE__ */ op("hole", "number", "Center hole ratio", {
				default: .3,
				min: 0,
				max: .8
			})
		],
		example: {
			data: sunburstSample,
			encoding: {
				group: "channel",
				label: "campaign",
				value: "spend"
			},
			options: { highlight: "All products" },
			card: {
				subtitle: "Ad spend share by channel and campaign",
				takeaway: "A hierarchy in rings"
			}
		}
	},
	{
		type: "waterfall",
		level: "intermediate",
		group: "comparison",
		summary: "Breaks the change from a start value to an end value into its drivers",
		useWhen: "Explaining why last month's revenue became this month's",
		avoidWhen: "More than 12 drivers",
		why: "Bars connect one by one from the left, showing where the value rose and fell.",
		options: [
			/* @__PURE__ */ op("startTotal", "boolean", "Treat the first row as the starting total", { default: true }),
			/* @__PURE__ */ op("endTotal", "any", "Running total bar at the end. A string sets its name"),
			/* @__PURE__ */ op("connectors", "boolean", "Lines between bars", { default: true })
		],
		example: {
			data: waterfallSample,
			encoding: {
				label: "item",
				value: "amount",
				type: "kind"
			},
			card: {
				subtitle: "Revenue from Sep to Oct (10k KRW)",
				takeaway: "What drove the change",
				legend: [{
					label: "Increase",
					color: "neutral"
				}, {
					label: "Decrease",
					color: "neutralStrong"
				}]
			}
		}
	},
	{
		type: "pareto",
		level: "intermediate",
		group: "comparison",
		summary: "Bars sorted largest first with a cumulative share line",
		useWhen: "Seeing how few items make up 80% of the total",
		avoidWhen: "The item order means something (time order, for example)",
		why: "After the bars, the cumulative line draws in and marks where it crosses the threshold (80% by default).",
		options: [
			/* @__PURE__ */ op("threshold", "number", "Reference line (%)", {
				default: 80,
				min: 1,
				max: 100
			}),
			/* @__PURE__ */ op("sort", "boolean", "Sort largest first", { default: true }),
			/* @__PURE__ */ op("rankLabels", "boolean", "Show ranks instead of names as x labels", { default: false })
		],
		example: {
			data: paretoSample,
			encoding: {
				label: "keyword",
				value: "spend"
			},
			options: { rankLabels: true },
			card: {
				subtitle: "Ad spend share by keyword (%)",
				takeaway: "Do the top 20% make 80%?",
				legend: [{
					label: "Share",
					color: "neutral"
				}, {
					label: "Cumulative",
					color: "ink",
					shape: "line"
				}]
			}
		}
	},
	{
		type: "marimekko",
		level: "advanced",
		group: "proportion",
		summary: "Two shares at once: width (column share) and height (share within the column)",
		useWhen: "Revenue size by channel and device mix in one chart",
		avoidWhen: "More than 6 columns or more than 4 series",
		why: "Columns fill from the bottom, so both shares read at once.",
		options: [],
		example: {
			data: marimekkoSample,
			encoding: {
				x: "channel",
				series: "device",
				value: "sales"
			},
			card: {
				subtitle: "Channel sales and device mix (%)",
				takeaway: "Two shares in width and height",
				legend: "auto"
			}
		}
	},
	{
		type: "heatmap",
		level: "intermediate",
		group: "relationship",
		summary: "Values where two categories meet, shown as color depth",
		useWhen: "Finding patterns such as orders by weekday × hour",
		avoidWhen: "Exact value comparison matters",
		why: "Uses shades of one accent color, so it follows the theme. With many cells it switches to canvas, so even 10k cells stay fast.",
		options: [
			/* @__PURE__ */ op("showValues", "any", "Numbers in cells. \"auto\" shows them when they fit", { default: "auto" }),
			/* @__PURE__ */ op("legend", "boolean", "Show the color legend", { default: true }),
			/* @__PURE__ */ op("legendLabels", "array", "Names at both ends of the legend", { items: "string" }),
			/* @__PURE__ */ op("canvasThreshold", "number", "Cell count that switches to canvas", { default: 2500 })
		],
		example: {
			data: heatmapSample,
			encoding: {
				x: "hour",
				y: "day",
				value: "orders"
			},
			card: {
				subtitle: "Orders by weekday × hour",
				takeaway: "Friday nights are the busiest"
			}
		},
		canvasAbove: 2500,
		scalable: true
	},
	{
		type: "radar",
		level: "intermediate",
		group: "comparison",
		summary: "Compares several metrics at once",
		useWhen: "Products or candidates scored on 5 to 8 metrics",
		avoidWhen: "More than 3 series (they overlap and get hard to read)",
		why: "Only the highlighted series is filled and the rest are outlines, which keeps overlaps readable.",
		options: [
			/* @__PURE__ */ op("max", "number", "Value of the outer ring"),
			/* @__PURE__ */ op("levels", "number", "Number of rings", {
				default: 4,
				min: 1
			}),
			/* @__PURE__ */ op("circular", "boolean", "Round grid instead of polygons", { default: false })
		],
		example: {
			data: radarSample,
			encoding: {
				axis: "metric",
				series: "product",
				value: "score"
			},
			card: {
				subtitle: "Product ratings (out of 100)",
				takeaway: "Ahead on design, behind on price",
				legend: [{
					label: "Our app",
					color: "accent"
				}, {
					label: "Industry average",
					color: "neutralStrong"
				}]
			}
		}
	},
	{
		type: "bubble",
		level: "intermediate",
		group: "relationship",
		summary: "Three values at once: x, y and size. Without size it is a scatter plot",
		useWhen: "How three metrics relate, such as CPC, ROAS and spend by campaign",
		avoidWhen: "Dots overlap and sizes get hard to compare",
		why: "With many dots it switches to canvas and finds the nearest dot through a grid index, so hover stays smooth even at 10k dots.",
		options: [
			/* @__PURE__ */ op("sizeRange", "array", "Radius range (px)", { items: "number" }),
			/* @__PURE__ */ op("xLabel", "string", "x axis title"),
			/* @__PURE__ */ op("yLabel", "string", "y axis title"),
			/* @__PURE__ */ op("zero", "boolean", "Include 0 on the axes", { default: false }),
			/* @__PURE__ */ op("maxLabels", "number", "Maximum number of dot labels", { default: 6 }),
			/* @__PURE__ */ op("canvasThreshold", "number", "Dot count that switches to canvas", { default: 1500 }),
			/* @__PURE__ */ op("xFormat", "format", "x value format")
		],
		example: {
			data: bubbleSample,
			encoding: {
				x: "cpc",
				y: "roas",
				size: "spend",
				label: "campaign"
			},
			options: {
				xLabel: "CPC (KRW)",
				yLabel: "ROAS (%)"
			},
			card: {
				subtitle: "CPC, ROAS and spend by campaign",
				takeaway: "Are the big circles efficient too?"
			}
		},
		canvasAbove: 1500,
		scalable: true
	},
	{
		type: "line",
		level: "basic",
		group: "trend",
		summary: "Change over time",
		useWhen: "A metric over time, such as monthly users, alone or against other series",
		avoidWhen: "x is a category with no order",
		why: "Only the highlighted series gets color; the rest stay gray, with name tags on the right. Even 10k points are reduced with LTTB and drawn as one path.",
		options: [
			CURVE,
			XTYPE,
			/* @__PURE__ */ op("dots", "any", "Show dots. \"auto\" | true | false", { default: "auto" }),
			/* @__PURE__ */ op("area", "boolean", "Gradient under the highlighted series", { default: false }),
			/* @__PURE__ */ op("zero", "boolean", "Include 0 on the y axis", { default: false }),
			/* @__PURE__ */ op("endLabels", "boolean", "Series name tags at the right end"),
			/* @__PURE__ */ op("colorMode", "enum", "Color only the highlight, or every series", {
				enum: ["highlight", "categorical"],
				default: "highlight"
			}),
			/* @__PURE__ */ op("yDomain", "array", "Fixed y range", { items: "number" }),
			/* @__PURE__ */ op("maxPoints", "number", "Above this many points, LTTB downsamples the line"),
			/* @__PURE__ */ op("referenceLines", "array", "Horizontal reference lines [{ y, label }]"),
			/* @__PURE__ */ op("yLabel", "string", "y axis title"),
			BRUSH,
			ANNOTATIONS,
			...SIGN,
			BAND_FROM,
			OUTSIDE,
			CONNECT_NULLS
		],
		example: {
			data: lineSample,
			encoding: {
				x: "month",
				y: "mau",
				series: "app"
			},
			options: { area: true },
			card: {
				subtitle: "Monthly active users (10k)",
				takeaway: "Only our app keeps climbing"
			}
		},
		scalable: true
	},
	{
		type: "area",
		level: "basic",
		group: "trend",
		summary: "Running totals and a changing mix (stacked, 100% stacked)",
		useWhen: "Seeing how each channel's traffic changes within the total",
		avoidWhen: "The exact value of each series matters",
		why: "Areas rise from the baseline as the chart enters, which shows the stacking at a glance.",
		options: [
			/* @__PURE__ */ op("stack", "enum", "Stacking mode", { enum: [
				"none",
				"stacked",
				"percent"
			] }),
			CURVE,
			XTYPE,
			/* @__PURE__ */ op("zero", "boolean", "Include 0 on the y axis", { default: true }),
			/* @__PURE__ */ op("endLabels", "boolean", "Series name tags at the right end"),
			/* @__PURE__ */ op("yDomain", "array", "Fixed y range", { items: "number" }),
			/* @__PURE__ */ op("maxPoints", "number", "Above this many points, LTTB downsamples the line"),
			BRUSH,
			ANNOTATIONS,
			...SIGN.map((o) => o.name === "signColors" ? {
				...o,
				description: `${o.description}. Only with stack "none"`
			} : o),
			BAND_FROM,
			OUTSIDE,
			CONNECT_NULLS
		],
		example: {
			data: areaSample,
			encoding: {
				x: "month",
				y: "visits",
				series: "channel"
			},
			options: { highlight: "Social" },
			card: {
				subtitle: "Monthly visits by channel (thousands)",
				takeaway: "Social's share grows the fastest",
				legend: "auto"
			}
		},
		scalable: true
	},
	{
		type: "stream",
		level: "advanced",
		group: "trend",
		summary: "Many series as flowing bands that show size and change",
		useWhen: "5 or more series where the rhythm of the flow matters, such as viewing by genre",
		avoidWhen: "You need to read exact values",
		why: "A wiggle baseline and inside-out ordering keep the bands calm. Names go where each band is thickest.",
		options: [
			/* @__PURE__ */ op("offset", "enum", "Baseline shape", {
				enum: ["wiggle", "silhouette"],
				default: "wiggle"
			}),
			/* @__PURE__ */ op("reorder", "boolean", "Reorder the series for a cleaner shape", { default: true }),
			CURVE,
			XTYPE
		],
		example: {
			data: streamSample,
			encoding: {
				x: "week",
				y: "hours",
				series: "genre"
			},
			options: { highlight: "Variety" },
			card: {
				subtitle: "Weekly viewing hours by genre (10k hours)",
				takeaway: "Variety ruled the summer"
			}
		}
	},
	{
		type: "bar",
		level: "basic",
		group: "comparison",
		summary: "Grouped, stacked, 100% and horizontal bars",
		useWhen: "Comparing sizes across categories precisely",
		avoidWhen: "The flow over time is the point (a line works better)",
		why: "With one series only the largest bar gets color; with several, only the highlighted series.",
		options: [
			/* @__PURE__ */ op("layout", "enum", "How series are arranged", {
				enum: [
					"grouped",
					"stacked",
					"percent"
				],
				default: "grouped"
			}),
			/* @__PURE__ */ op("orientation", "enum", "Direction", {
				enum: ["vertical", "horizontal"],
				default: "vertical"
			}),
			/* @__PURE__ */ op("sort", "boolean", "Sort by value (single series)", { default: false }),
			/* @__PURE__ */ op("annotations", "annotations", "Notes drawn on vertical bars: target band, period, reference line, event, forecast (later bars turn pale with a dashed outline), trend line. [{ type, x, y, from, label }]")
		],
		example: {
			data: barSample,
			encoding: {
				x: "quarter",
				y: "revenue",
				series: "team"
			},
			options: {
				layout: "stacked",
				highlight: "Overseas"
			},
			card: {
				subtitle: "Revenue by quarter (100M KRW)",
				takeaway: "Overseas grows its share every quarter",
				legend: "auto"
			}
		}
	},
	{
		type: "radialBar",
		level: "intermediate",
		group: "kpi",
		summary: "Ratios such as progress toward goals, drawn as rings",
		useWhen: "Showing progress on 3 to 6 goals in one view",
		avoidWhen: "Comparing values precisely (outer rings look longer)",
		why: "For a single progress ring, use the gauge with variant \"ring\".",
		options: [/* @__PURE__ */ op("max", "number", "Value of one full turn", { default: 100 }), /* @__PURE__ */ op("sweep", "number", "Arc length in degrees", {
			default: 270,
			min: 30,
			max: 360
		})],
		example: {
			data: radialBarSample,
			encoding: {
				label: "goal",
				value: "rate"
			},
			options: {
				unit: "%",
				format: "integer"
			},
			card: {
				subtitle: "Progress toward quarterly goals",
				takeaway: "Only repeat buys are near the goal"
			}
		}
	},
	{
		type: "gauge",
		level: "basic",
		group: "kpi",
		summary: "One KPI's current value against its target",
		useWhen: "Showing one value against its target, large",
		avoidWhen: "Comparing several values",
		why: "The number counts up as the arc fills. The variant option picks an arc, a half circle (semi), a progress ring (ring) or lit tick marks (ticks).",
		options: [
			/* @__PURE__ */ op("min", "number", "Minimum", { default: 0 }),
			/* @__PURE__ */ op("max", "number", "Maximum", { default: 100 }),
			/* @__PURE__ */ op("label", "string", "Caption in the center"),
			/* @__PURE__ */ op("variant", "enum", "Shape. ticks lights tick marks up to the value", {
				enum: [
					"arc",
					"semi",
					"ring",
					"ticks"
				],
				default: "arc"
			}),
			/* @__PURE__ */ op("bands", "array", "Band boundaries (arc, semi)", { items: "number" }),
			/* @__PURE__ */ op("ticks", "number", "Tick count when variant=ticks. Fits the size by default", {
				min: 2,
				max: 120
			})
		],
		example: {
			data: gaugeSample,
			encoding: {
				value: "value",
				target: "target"
			},
			options: {
				label: "Goal reached",
				unit: "%"
			},
			card: {
				subtitle: "Quarterly revenue goal (%)",
				takeaway: "12 points left to the goal"
			}
		}
	},
	{
		type: "bullet",
		level: "intermediate",
		group: "kpi",
		summary: "Actual value against a target and bands (poor, fair, good)",
		useWhen: "Several KPIs with their targets in a small space",
		avoidWhen: "There is no target or band",
		why: "A compact alternative to gauges. Highlights the KPI with the lowest actual-to-target ratio.",
		options: [/* @__PURE__ */ op("ranges", "array", "Band boundary fields (smallest first)", { items: "string" }), /* @__PURE__ */ op("independent", "boolean", "Separate axis range per row", { default: true })],
		example: {
			data: bulletSample,
			encoding: {
				label: "kpi",
				value: "actual",
				target: "target"
			},
			options: { ranges: [
				"poor",
				"ok",
				"good"
			] },
			card: {
				subtitle: "H1 KPIs (target: vertical tick)",
				takeaway: "New customers lag the most"
			}
		}
	},
	{
		type: "sparkline",
		level: "basic",
		group: "trend",
		summary: "A small trend line next to a table cell or KPI",
		useWhen: "The trend matters more than exact values",
		avoidWhen: "You need to read axis values",
		why: "A word-sized graphic: no axes, and the last value shows as text.",
		options: [
			/* @__PURE__ */ op("variant", "enum", "Shape", {
				enum: [
					"line",
					"area",
					"bar"
				],
				default: "area"
			}),
			/* @__PURE__ */ op("showValue", "boolean", "Show the last value as text", { default: true }),
			/* @__PURE__ */ op("showExtremes", "boolean", "Mark the high and low points", { default: false }),
			/* @__PURE__ */ op("mark", "enum", "Point that gets the highlight dot", {
				enum: [
					"last",
					"max",
					"min",
					"none"
				],
				default: "last"
			})
		],
		example: {
			data: sparklineSample,
			encoding: {
				x: "day",
				y: "revenue"
			},
			options: {
				height: 120,
				showExtremes: true
			},
			card: {
				subtitle: "Daily revenue in June (10k KRW)",
				takeaway: "Spikes every weekend"
			}
		},
		scalable: true
	},
	{
		type: "slope",
		level: "intermediate",
		group: "comparison",
		summary: "Change in size and rank between two points in time",
		useWhen: "Comparing just two points in time, such as last year's and this year's share",
		avoidWhen: "3 or more points in time (use a line or bump chart)",
		why: "Each slope shows at a glance whether an item went up or down. The item that rose the most is highlighted.",
		options: [
			/* @__PURE__ */ op("start", "string", "Wide table: start value field"),
			/* @__PURE__ */ op("end", "string", "Wide table: end value field"),
			/* @__PURE__ */ op("periodLabels", "array", "Titles above the two axes", { items: "string" })
		],
		example: {
			data: slopeSample,
			encoding: {
				label: "brand",
				x: "period",
				value: "share"
			},
			options: { unit: "%" },
			card: {
				subtitle: "Market share by brand (%)",
				takeaway: "Only we rose sharply"
			}
		}
	},
	{
		type: "dumbbell",
		level: "intermediate",
		group: "comparison",
		summary: "The gap between two values per item (before and after, target and actual)",
		useWhen: "The gap is the story, such as before and after an improvement by region",
		avoidWhen: "There is only one value",
		why: "Less ink than two bars, and the difference itself shows as line length.",
		options: [
			/* @__PURE__ */ op("labels", "array", "Legend names [before, after]", { items: "string" }),
			/* @__PURE__ */ op("sort", "boolean", "Sort by the after value", { default: true }),
			/* @__PURE__ */ op("zero", "boolean", "Include 0 on the axis", { default: false })
		],
		example: {
			data: dumbbellSample,
			encoding: {
				label: "region",
				start: "before",
				end: "after"
			},
			options: {
				labels: ["2024", "2025"],
				unit: "%"
			},
			card: {
				subtitle: "Purchase conversion rate by region (%)",
				takeaway: "Seoul rose the most"
			}
		}
	},
	{
		type: "lollipop",
		level: "basic",
		group: "comparison",
		summary: "A line and a dot instead of a bar. Stays light with many items",
		useWhen: "Rankings of 7 to 20 items, such as usage by feature",
		avoidWhen: "The differences between values are very small",
		why: "Sorted largest first by default, so it reads as a ranking.",
		options: [/* @__PURE__ */ op("orientation", "enum", "Direction", {
			enum: ["horizontal", "vertical"],
			default: "horizontal"
		}), /* @__PURE__ */ op("sort", "boolean", "Sort largest first", { default: true })],
		example: {
			data: lollipopSample,
			encoding: {
				label: "feature",
				value: "usage"
			},
			options: { unit: "%" },
			card: {
				subtitle: "Weekly usage by feature (%)",
				takeaway: "Search dominates"
			}
		}
	},
	{
		type: "beeswarm",
		level: "advanced",
		group: "distribution",
		summary: "A distribution with every dot laid out without overlap",
		useWhen: "Seeing each user's value, group by group",
		avoidWhen: "Thousands of dots that overlap (use violin or ridgeline)",
		why: "Shows the individual values an average hides, with each group's median marked.",
		options: [
			/* @__PURE__ */ op("radius", "number", "Dot radius"),
			/* @__PURE__ */ op("showMedian", "boolean", "Show the median of each group", { default: true }),
			/* @__PURE__ */ op("canvasThreshold", "number", "Dot count that switches to canvas", { default: 2e3 })
		],
		example: {
			data: beeswarmSample,
			encoding: {
				value: "minutes",
				group: "plan",
				label: "id"
			},
			options: { unit: " min" },
			card: {
				subtitle: "Daily usage time by plan (min)",
				takeaway: "The Pro plan also spreads the widest"
			}
		},
		canvasAbove: 2e3,
		scalable: true
	},
	{
		type: "ridgeline",
		level: "advanced",
		group: "distribution",
		summary: "Group distributions as overlapping, stacked curves",
		useWhen: "Comparing distributions across 5 to 12 groups, such as delivery time by region",
		avoidWhen: "3 or fewer groups (a box plot is simpler)",
		why: "KDE curves rise one after another from the top as the chart enters.",
		options: [
			/* @__PURE__ */ op("overlap", "number", "How much the curves overlap", {
				default: 1.5,
				min: .5,
				max: 4
			}),
			/* @__PURE__ */ op("bandwidth", "number", "KDE bandwidth"),
			/* @__PURE__ */ op("sort", "enum", "Sort order", {
				enum: ["none", "median"],
				default: "none"
			})
		],
		example: {
			data: ridgelineSample,
			encoding: {
				group: "region",
				value: "hours"
			},
			options: { unit: "h" },
			card: {
				subtitle: "Delivery time by region",
				takeaway: "Only Jeju has a long tail"
			}
		}
	},
	{
		type: "sankey",
		level: "advanced",
		group: "flow",
		summary: "How much flows between stages",
		useWhen: "User flow from traffic source to purchase or drop-off",
		avoidWhen: "The flow loops back, or there are more than 30 nodes",
		why: "A relaxation layout, written with no dependencies, moves nodes step by step to reduce overlaps. Bands flow in from left to right as they enter.",
		options: [/* @__PURE__ */ op("nodeWidth", "number", "Node width (px)", { default: 10 }), /* @__PURE__ */ op("nodePadding", "number", "Gap between nodes (px)", { default: 14 })],
		example: {
			data: sankeySample,
			encoding: {
				source: "source",
				target: "target",
				value: "value"
			},
			options: { highlight: "Purchase" },
			card: {
				subtitle: "From visit to purchase (users)",
				takeaway: "Half leave at the product page"
			}
		}
	},
	{
		type: "chord",
		level: "advanced",
		group: "flow",
		summary: "How much groups send to and receive from each other",
		useWhen: "Two-way relationships, such as requests between teams",
		avoidWhen: "More than 10 groups",
		why: "The group with the largest total is highlighted by default, so even a dense diagram reads as 'who this team works with'.",
		options: [/* @__PURE__ */ op("padAngle", "number", "Gap between groups (radians)", { default: .05 })],
		example: {
			data: chordSample,
			encoding: {
				source: "from",
				target: "to",
				value: "value"
			},
			options: { highlight: "Product" },
			card: {
				subtitle: "Requests between teams",
				takeaway: "Product is the hub"
			}
		}
	},
	{
		type: "calendar",
		level: "intermediate",
		group: "trend",
		summary: "Daily amounts on a weekly grid",
		useWhen: "The rhythm of daily activity, such as commits or orders",
		avoidWhen: "The period is shorter than a month",
		why: "One square per day, filled week by week from left to right, with one row per year for multiple years.",
		options: [
			/* @__PURE__ */ op("weekStart", "number", "First day of the week (0 Sunday, 1 Monday)", {
				default: 0,
				min: 0,
				max: 1
			}),
			/* @__PURE__ */ op("gap", "number", "Gap between cells (px)", { default: 2.5 }),
			/* @__PURE__ */ op("canvasThreshold", "number", "Day count that switches to canvas", { default: 4e3 })
		],
		example: {
			data: calendarSample,
			encoding: {
				date: "date",
				value: "commits"
			},
			card: {
				subtitle: "Daily commits in 2025",
				takeaway: "Weekends are quiet"
			}
		},
		canvasAbove: 4e3,
		scalable: true
	},
	{
		type: "bump",
		level: "intermediate",
		group: "trend",
		summary: "Rank changes over time",
		useWhen: "What matters is the rank, as in App Store rankings",
		avoidWhen: "The value gaps between ranks matter",
		why: "Keeps only the ranks, so crossings stand out. Highlights the item that climbed the most automatically.",
		options: [],
		example: {
			data: bumpSample,
			encoding: {
				x: "month",
				series: "app",
				rank: "rank"
			},
			card: {
				subtitle: "Monthly App Store rank",
				takeaway: "From 5th to 1st"
			}
		}
	},
	{
		type: "box",
		level: "advanced",
		group: "distribution",
		summary: "Distribution summary by group (quartiles, median, outliers)",
		useWhen: "Distribution and outliers together, such as response time by API",
		avoidWhen: "The audience is not used to quartiles (a beeswarm is easier)",
		why: "The variant option picks box, violin or both. Shapes spread up and down from the median as the chart enters.",
		options: [
			/* @__PURE__ */ op("variant", "enum", "Shape", {
				enum: [
					"box",
					"violin",
					"both"
				],
				default: "box"
			}),
			/* @__PURE__ */ op("outliers", "boolean", "Show outlier dots", { default: true }),
			/* @__PURE__ */ op("zero", "boolean", "Include 0 on the axis", { default: false }),
			/* @__PURE__ */ op("whiskers", "array", "Whisker ends as percentiles [low, high], such as [5, 95]. Without it, whiskers reach the farthest values within 1.5 × IQR", {
				items: "number",
				length: 2,
				min: 0,
				max: 100
			})
		],
		example: {
			data: boxSample,
			encoding: {
				group: "api",
				value: "ms"
			},
			options: {
				unit: "ms",
				variant: "box"
			},
			card: {
				subtitle: "Response time by API (ms)",
				takeaway: "The payment API is the slowest"
			}
		}
	},
	{
		type: "parallel",
		level: "advanced",
		group: "relationship",
		summary: "Several numeric metrics, each on its own axis, compared as one line per row",
		useWhen: "Comparing 4 to 8 metrics at once, such as product specs",
		avoidWhen: "The audience sees it for the first time (it needs explaining)",
		why: "One highlighted line over many gray ones turns a hard-to-read form into a story. With many rows it draws 10k lines on canvas.",
		options: [
			/* @__PURE__ */ op("dimensions", "array", "Numeric fields to use as axes", { items: "string" }),
			/* @__PURE__ */ op("dimensionLabels", "object", "Rename the axes"),
			/* @__PURE__ */ op("invert", "array", "Axes where smaller is better", { items: "string" }),
			/* @__PURE__ */ op("canvasThreshold", "number", "Row count that switches to canvas", { default: 1500 })
		],
		example: {
			data: parallelSample,
			encoding: { label: "model" },
			options: {
				dimensions: [
					"price",
					"weight",
					"battery",
					"perf",
					"screen"
				],
				dimensionLabels: {
					price: "Price (10k KRW)",
					weight: "Weight (kg)",
					battery: "Battery (h)",
					perf: "Performance",
					screen: "Screen (in)"
				},
				invert: ["price", "weight"],
				highlight: "Air 13"
			},
			card: {
				subtitle: "Laptop models compared",
				takeaway: "The Air 13 is light and cheap"
			}
		},
		canvasAbove: 1500,
		scalable: true
	},
	{
		type: "candlestick",
		level: "advanced",
		group: "trend",
		summary: "Open, high, low and close for each period in one candle",
		useWhen: "Stocks, exchange rates or coins, where the swing within each period matters",
		avoidWhen: "A trend with only one value (a line chart is cleaner)",
		why: "Rising candles take the accent color and falling ones are gray. Drag over a period to see its change, high and low.",
		options: [
			/* @__PURE__ */ op("ma", "array", "Moving average periods on the close. For example [5, 20]", { items: "number" }),
			/* @__PURE__ */ op("upColor", "string", "Rising candle color (token name or CSS color)", { default: "accent" }),
			/* @__PURE__ */ op("downColor", "string", "Falling candle color", { default: "neutralStrong" }),
			/* @__PURE__ */ op("maxCandles", "number", "Above this count, neighboring candles merge. Defaults to plot width / 4"),
			BRUSH,
			/* @__PURE__ */ op("yDomain", "array", "Fixed price axis range", { items: "number" }),
			/* @__PURE__ */ op("annotations", "annotations", "Notes drawn on the chart: target band, period, reference line, event, forecast, trend line on the close, weekend shading. [{ type, x, y, from, label }]")
		],
		example: {
			data: candlestickSample,
			encoding: {
				x: "date",
				open: "open",
				high: "high",
				low: "low",
				close: "close",
				volume: "volume"
			},
			options: {
				ma: [5, 20],
				brush: true
			},
			card: {
				subtitle: "Daily candles of a sample stock (KRW)",
				takeaway: "Higher highs since mid-October",
				legend: "auto"
			}
		},
		scalable: true
	},
	{
		type: "segmented",
		level: "basic",
		group: "proportion",
		summary: "One whole split into a bar by share, with a list",
		useWhen: "Showing the mix in one line inside a card (2 to 6 items)",
		avoidWhen: "Comparing similar values, or many items (a bar chart is more accurate)",
		why: "Takes less space than a pie, and the list below gives each value and share.",
		options: [
			/* @__PURE__ */ op("variant", "enum", "tall is 28px with share text, thin is 8px", {
				enum: ["tall", "thin"],
				default: "tall"
			}),
			/* @__PURE__ */ op("sort", "boolean", "Sort largest first", { default: true }),
			/* @__PURE__ */ op("list", "boolean", "Show a list of name, value and share below", { default: true })
		],
		example: {
			data: segmentedSample,
			encoding: {
				label: "method",
				value: "amount"
			},
			options: { highlight: "Mobile pay" },
			card: {
				subtitle: "Payment volume by method (100M KRW)",
				takeaway: "Mobile pay is one in three"
			}
		}
	},
	{
		type: "skyline",
		level: "intermediate",
		group: "trend",
		summary: "Stacked volume per period as blocks, with a smaller outcome in the same unit standing in front",
		useWhen: "7 to 40 periods of stacked volume and a smaller outcome in the same unit (failures, retries), as the lead card of a dashboard",
		avoidWhen: "Negative values, precise value comparison (bars are more accurate), or two values in different units (split the chart and link it with syncId)",
		why: "Volume per period as blocks on a level floor, so a taller block always means more. Only the highlighted series gets the accent, and a smaller outcome in the same unit (failures, rework) stands in its own front row on the same scale.",
		options: [
			/* @__PURE__ */ op("depth", "number", "Back row depth as a share of the period slot, from 0.1 to 0.32. Values outside are pulled into the range", { default: .32 }),
			/* @__PURE__ */ op("wall", "boolean", "Value grid on the back wall, with its labels on the right", { default: true }),
			/* @__PURE__ */ op("texture", "enum", "Rows that get the hatch pattern, for print and for readers who cannot tell the grays apart", {
				enum: [
					"front",
					"all",
					"none"
				],
				default: "front"
			}),
			/* @__PURE__ */ op("frontRate", "any", "Front row total as a share of the back row: \"label\" in a label and the tooltip, \"strip\" as a rate strip under the floor, false hides it", { default: "label" })
		],
		example: {
			data: skylineSample,
			encoding: {
				x: "day",
				y: [
					"Input",
					"Cached",
					"Output",
					"Reasoning"
				],
				front: ["Failed", "Retried"]
			},
			options: { format: "compact" },
			card: {
				subtitle: "Daily tokens, last 14 days",
				takeaway: "Nov 5 was the busiest day"
			}
		}
	},
	{
		type: "histogram",
		level: "intermediate",
		group: "distribution",
		summary: "Distribution of raw samples with its tail and the share past a limit",
		useWhen: "30 or more raw samples, such as request latency, where the tail and the share past a limit matter",
		avoidWhen: "Comparing categories (use bars), or fewer than 10 samples (a beeswarm fits better)",
		why: "Only the bins on the bad side of the threshold take the accent color, and the p50 and p95 lines carry their values, so the tail reads without a legend. Two groups share one set of bin edges.",
		options: [
			/* @__PURE__ */ op("variant", "enum", "Shape. dots stacks one dot per N samples, step draws an outline that overlays well", {
				enum: [
					"bars",
					"dots",
					"step"
				],
				default: "bars"
			}),
			/* @__PURE__ */ op("marks", "array", "Percentile lines with labels, such as [\"p50\", \"p95\", \"p99\"]. p50 is solid, the rest dashed. From pre-binned rows they are estimated inside the bins", {
				items: "string",
				default: ["p50", "p95"]
			}),
			/* @__PURE__ */ op("threshold", "object", "Limit line { value, label, side }. side \"above\" (default) or \"below\" is the bad side: its bins take the accent color and the description counts the samples past it"),
			/* @__PURE__ */ op("edges", "array", "Bin edges, smallest first. Samples outside them are counted and reported, not drawn. Bins come from edges, then binWidth, then bins, then the Freedman-Diaconis rule (Sturges under 30 samples)", { items: "number" }),
			/* @__PURE__ */ op("binWidth", "number", "Bin width. Edges fall on multiples of it. Not used with log"),
			/* @__PURE__ */ op("bins", "number", "About this many bins. Widths snap to a readable step", {
				min: 1,
				max: 200
			}),
			/* @__PURE__ */ op("log", "boolean", "Log bins and axis. Every value must be above 0", { default: false }),
			/* @__PURE__ */ op("kde", "boolean", "Density curve over the bins (raw rows only)", { default: false })
		],
		example: {
			data: histogramSample,
			encoding: { value: "ms" },
			options: {
				unit: "ms",
				marks: ["p50", "p95"],
				threshold: {
					value: 400,
					label: "SLO",
					side: "above"
				}
			},
			card: {
				subtitle: "API request latency (ms)",
				takeaway: "1 in 16 requests misses the SLO",
				legend: [{
					label: "Over the SLO",
					color: "accent"
				}, {
					label: "Within",
					color: "neutral"
				}]
			}
		}
	},
	{
		type: "scatter",
		level: "basic",
		group: "relationship",
		summary: "How two numbers relate, one dot per item, colored by series",
		useWhen: "How two numeric values relate, such as cost and latency per request, with up to 4 series",
		avoidWhen: "x is time (a line works better), or there are more than 50,000 dots",
		why: "Series colors are set once over every series, so hiding one never repaints the rest. Arrow keys move to the nearest dot in that direction, and jitter uses a fixed seed, so the server and the browser draw the same picture.",
		options: [
			/* @__PURE__ */ op("xLabel", "string", "x axis title"),
			/* @__PURE__ */ op("yLabel", "string", "y axis title"),
			/* @__PURE__ */ op("zero", "boolean", "Include 0 on the axes", { default: false }),
			/* @__PURE__ */ op("maxLabels", "number", "Maximum number of dot labels. With a series channel the series names are labeled instead, and this defaults to 0", { default: 6 }),
			/* @__PURE__ */ op("canvasThreshold", "number", "Dot count that switches to canvas", { default: 1500 }),
			/* @__PURE__ */ op("xFormat", "format", "x value format"),
			/* @__PURE__ */ op("hidden", "array", "Series to hide. Colors stay as if every series were shown", { items: "string" }),
			/* @__PURE__ */ op("fit", "enum", "Trend line over the visible dots (least squares). The tooltip shows its slope and R²", { enum: ["linear"] }),
			/* @__PURE__ */ op("refLines", "object", "Reference lines { x, y }. With both, they split the plot into four quadrants"),
			/* @__PURE__ */ op("quadrants", "array", "Quadrant names, drawn when refLines has both x and y. In reading order: top left, top right, bottom left, bottom right", { items: "string" }),
			/* @__PURE__ */ op("jitter", "object", "{ amount, seed }: spreads dots that share an x value sideways, by up to amount × the smallest gap between x values (default 0.4). The seed (default 1) keeps the picture the same on every render")
		],
		example: {
			data: scatterSample,
			encoding: {
				x: "cost",
				y: "ms",
				series: "model",
				label: "id"
			},
			options: {
				highlight: "Large",
				xLabel: "Cost (¢)",
				yLabel: "Latency (ms)",
				unit: "ms",
				refLines: { y: 2e3 },
				quadrants: [
					"Slow and cheap",
					"Slow and costly",
					"Fast and cheap",
					"Fast and costly"
				]
			},
			card: {
				subtitle: "Cost and latency per request by model",
				takeaway: "Only the large model goes over 2 s",
				legend: "auto"
			}
		},
		canvasAbove: 1500,
		scalable: true
	}
];
function fill({ type, level, group, summary, useWhen, avoidWhen, why, options, example, ...extra }, i) {
	const { name, component } = META[type];
	const { card, ...spec } = example;
	const { legend, ...text } = card;
	return {
		type,
		component,
		name,
		nameEn: name,
		level,
		group,
		summary,
		useWhen,
		avoidWhen,
		why,
		encoding: CHANNELS[type],
		options,
		example: {
			type,
			...spec,
			card: {
				number: String(i + 1).padStart(2, "0"),
				title: name,
				...text,
				level,
				...legend && { legend }
			}
		},
		...extra
	};
}
var CHARTS = /* @__PURE__ */ ENTRIES.map(fill);
function getChartDef(type) {
	return CHARTS.find((c) => c.type === type || c.type.toLowerCase() === type.toLowerCase() || c.component.toLowerCase() === type.toLowerCase());
}
function levenshtein(a, b) {
	const m = a.length;
	const n = b.length;
	if (!m) return n;
	if (!n) return m;
	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	for (let i = 1; i <= m; i++) {
		const cur = [i];
		for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		prev = cur;
	}
	return prev[n];
}
function closest(word, list) {
	let best = null;
	let bs = Infinity;
	let bd = Infinity;
	const w = word.toLowerCase();
	for (const c of list) {
		const lc = c.toLowerCase();
		const d = levenshtein(w, lc);
		let prefix = 0;
		while (prefix < w.length && prefix < lc.length && w[prefix] === lc[prefix]) prefix++;
		const score = d - prefix * .1;
		if (score < bs) {
			bs = score;
			bd = d;
			best = c;
		}
	}
	return best !== null && bd <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
}
function inlineRows(data) {
	if (Array.isArray(data)) return data;
	if (data && typeof data === "object") {
		const o = data;
		if (Array.isArray(o.values)) return o.values;
		if (typeof o.csv === "string") return parseCSV(o.csv);
	}
	return null;
}
var SAFE_VALUE = /^[\p{L}\p{N}_\s#%(),./+'"-]*$/u;
var CSS_FUNC = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|var|calc|min|max|clamp)$/i;
function isSafeStyleValue(v, font = false) {
	if (typeof v === "number") return Number.isFinite(v);
	if (typeof v !== "string" || !SAFE_VALUE.test(v) || !font && /['"]/.test(v)) return false;
	for (const m of v.matchAll(/([\w-]+)\s*\(/g)) if (!CSS_FUNC.test(m[1])) return false;
	return true;
}
function typeOf(v) {
	if (Array.isArray(v)) return "array";
	if (v === null) return "null";
	return typeof v;
}
function isNumberTuple(a, o) {
	return a.length === o.length && a.every((x) => Number.isFinite(x) && x >= (o.min ?? -Infinity) && x <= (o.max ?? Infinity));
}
function annotationIssue(a) {
	if (typeof a !== "object" || a === null || Array.isArray(a)) return ["must be an object such as { type: \"line\", y: 100 }", "{ type: \"line\", y: 100 } 같은 객체여야 해요"];
	const { type, x, y, from, label } = a;
	const pair = (q) => Array.isArray(q) && q.length === 2;
	const list = ANNOTATION_TYPES.map((n) => `"${n}"`).join(" | ");
	if (!ANNOTATION_TYPES.includes(type)) return [`type must be one of ${list}`, `type 값은 ${list} 중 하나여야 해요`];
	if (label !== void 0 && typeof label !== "string") return ["label must be a string", "label은 문자열이어야 해요"];
	if (type === "line" && !(typeof y === "number" && Number.isFinite(y))) return ["\"line\" needs a number y", "\"line\"에는 숫자 y가 있어야 해요"];
	if (type === "band" && !(pair(y) && y.every((n) => typeof n === "number" && Number.isFinite(n))) && !pair(x)) return ["\"band\" needs y: [low, high] or x: [from, to]", "\"band\"에는 y: [아래, 위]나 x: [시작, 끝]이 있어야 해요"];
	if (type === "event" && (x === void 0 || !label)) return ["\"event\" needs x and label", "\"event\"에는 x와 label이 있어야 해요"];
	if (type === "forecast" && from === void 0) return ["\"forecast\" needs from (the x where the forecast starts)", "\"forecast\"에는 from(예측이 시작하는 x)이 있어야 해요"];
	return null;
}
function skylineIssues(rows, enc, options, fields, report) {
	const list = (v) => (Array.isArray(v) ? v : [v]).filter((f) => typeof f === "string");
	const yFields = list(enc.y ?? (fields.includes("y") ? "y" : void 0));
	const frontFields = list(enc.front);
	if (enc.front !== void 0 && enc.y === void 0 && !fields.length) report(true, "encoding.y", "skyline_front_without_y", ["y is required: front stands in front of the back row that y stacks", "y가 필요해요. front는 y로 쌓은 뒷줄 앞에 서요"]);
	if (frontFields.length >= 4) report(false, "encoding.front", "skyline_front_many", ["The front row reads best with 3 series or fewer", "앞줄은 3개까지 읽기 쉬워요"]);
	const depth = options && typeof options === "object" ? options.depth : void 0;
	if (typeof depth === "number" && (depth < .1 || depth > .32)) report(false, "options.depth", "skyline_depth_range", ["depth is from 0.1 to 0.32, so it is pulled into that range", "depth는 0.1~0.32예요. 범위 안으로 묶어서 그려요"]);
	if (!rows || !rows.length) return;
	const xField = typeof enc.x === "string" ? enc.x : "x";
	const periods = new Set(rows.map((r) => String(r[xField] ?? ""))).size;
	const many = ["There are many periods, so neighboring periods are summed when drawn. bar or area may read better", "기간이 많아서 이웃 기간을 합쳐 그려요. bar나 area가 나을 수 있어요"];
	if (periods > 120) report(true, "data", "skyline_too_many_periods", many);
	else if (periods > 40) report(false, "data", "skyline_many_periods", many);
	const valueFields = [...yFields, ...frontFields];
	let negative = null;
	let positive = false;
	for (const r of rows) for (const f of valueFields) {
		const v = toNumber(r[f]);
		if (v < 0) negative ?? (negative = f);
		else if (v > 0) positive = true;
	}
	if (negative !== null) report(true, yFields.includes(negative) ? "encoding.y" : "encoding.front", "skyline_negative", ["Skyline stacks from 0. Use bar when there are negative values", "스카이라인은 0부터 쌓아요. 음수가 있으면 bar를 쓰세요"]);
	else if (!positive && valueFields.length) report(false, "data", "skyline_all_zero", ["Every value is 0, so there is nothing to draw", "모든 값이 0이라 그릴 값이 없어요"]);
}
var fieldList = (v) => Array.isArray(v) ? v : [v];
function checkBand(type, enc, opts, rows, t, err, warn) {
	const { lower, upper, y, series } = enc;
	if (lower === void 0 && upper === void 0) return;
	if (lower === void 0 || upper === void 0) {
		warn(`encoding.${lower === void 0 ? "lower" : "upper"}`, "band_half", t("A range band needs both encoding.lower and encoding.upper, so nothing is drawn", "범위 띠에는 encoding.lower와 encoding.upper가 모두 있어야 해서 그리지 않아요"));
		return;
	}
	const lo = fieldList(lower);
	const hi = fieldList(upper);
	const wide = Array.isArray(y);
	const yCount = wide ? y.length : 1;
	if (wide ? lo.length !== yCount || hi.length !== yCount : lo.length > 1 || hi.length > 1) warn("encoding.lower", "band_fields", wide ? t(`lower and upper need one field for each of the ${yCount} y fields. Series without one draw no band`, `lower와 upper에는 y 필드 ${yCount}개마다 필드가 하나씩 있어야 해요. 없는 계열은 띠를 그리지 않아요`) : t("lower and upper take one field each when y is one field. Only the first is used", "y가 필드 하나면 lower와 upper도 필드 하나씩이에요. 첫 필드만 써요"));
	if (type === "area") {
		const many = yCount > 1 || typeof series === "string" && (!rows || new Set(rows.map((r) => String(r?.[series]))).size > 1);
		if (opts.stack === "stacked" || opts.stack === "percent" || opts.stack === void 0 && many) err("options.stack", "band_stacked", t("A range band cannot go on stacked areas. Set options.stack to \"none\"", "쌓은 영역에는 범위 띠를 그릴 수 없어요. options.stack을 \"none\"으로 두세요"));
	}
	let crossed = 0;
	for (const r of rows ?? []) for (let s = 0; s < lo.length; s++) {
		const fa = lo[s];
		const fb = hi[s];
		if (typeof fa === "string" && typeof fb === "string" && toNumber(r?.[fa]) > toNumber(r?.[fb])) crossed++;
	}
	if (crossed) warn("encoding.lower", "band_crossed", t(`lower is above upper in ${crossed === 1 ? "1 row" : `${crossed} rows`}. They are swapped when drawn`, `${crossed}개 행에서 lower가 upper보다 커요. 바꿔서 그려요`));
	if (opts.bandFrom === "forecast" && !(Array.isArray(opts.annotations) && opts.annotations.some((a) => typeof a === "object" && a?.type === "forecast"))) warn("options.bandFrom", "band_no_forecast", t("bandFrom \"forecast\" needs a forecast annotation. Without one no band is drawn", "bandFrom \"forecast\"에는 forecast 주석이 있어야 해요. 없으면 띠를 그리지 않아요"));
}
function checkHistogram(rows, enc, o, binned, err, warn, t) {
	const log = o.log === true;
	if (log && rows?.length) {
		const k = binned ? "x0" : "value";
		const f = enc[k];
		const read = numGetter(typeof f === "string" ? f : void 0, k);
		const bad = rows.filter((r, i) => read(r, i) <= 0).length;
		if (bad) err("options.log", "log_not_positive", t(`log needs every value above 0, and ${bad} ${binned ? "bins start" : "values are"} at or below 0`, `log를 쓰려면 모든 값이 0보다 커야 해요(0 이하 ${bad}개)`));
	}
	if (Array.isArray(o.edges)) {
		const e = o.edges.filter((x) => typeof x === "number" && Number.isFinite(x));
		if (!(e.length >= 2 && e.length === o.edges.length && e.every((x, i) => i === 0 || x > e[i - 1]))) err("options.edges", "bad_edges", t("options.edges must be 2 or more numbers, smallest first", "options.edges 값은 작은 것부터 늘어놓은 숫자 2개 이상이어야 해요"));
		else if (log && e[0] <= 0) err("options.edges", "log_not_positive", t("With log, every edge must be above 0", "log면 모든 경계가 0보다 커야 해요"));
	}
	if (typeof o.binWidth === "number" && !(o.binWidth > 0)) err("options.binWidth", "out_of_range", t("options.binWidth must be above 0", "options.binWidth 값은 0보다 커야 해요"));
	else if (o.binWidth !== void 0 && log) warn("options.binWidth", "ignored_option", t("binWidth is not used with log: true. Use bins or edges", "log: true면 binWidth를 쓰지 않아요. bins나 edges를 써 주세요"));
	const th = o.threshold;
	if (th && typeof th === "object" && !Array.isArray(th)) {
		const { value, side, label } = th;
		if (!(typeof value === "number" && Number.isFinite(value)) || side !== void 0 && side !== "above" && side !== "below" || label !== void 0 && typeof label !== "string") err("options.threshold", "bad_threshold", t("options.threshold must be { value: number, label?: string, side?: \"above\" | \"below\" }", "options.threshold 값은 { value: 숫자, label?: 문자열, side?: \"above\" | \"below\" } 꼴이어야 해요"));
	}
	if (Array.isArray(o.marks)) {
		const bad = o.marks.filter((m) => !(typeof m === "string" && Number.isFinite(markPercentile(m))));
		if (bad.length) err("options.marks", "bad_marks", t(`options.marks takes percentiles from "p0" to "p100", such as "p95" (got ${bad.map(String).join(", ")})`, `options.marks 값은 "p95"처럼 "p0"~"p100" 사이 분위여야 해요(지금 ${bad.map(String).join(", ")})`));
	}
	if (rows?.length && typeof enc.group === "string") {
		const g = enc.group;
		const groups = new Set(rows.map((r) => r && typeof r === "object" ? String(r[g] ?? "") : ""));
		const k = 2;
		if (groups.size > k) warn("encoding.group", "too_many_groups", t(`A histogram overlays up to ${k} groups, and the data has ${groups.size}, so only the first ${k} are drawn. Use ridgeline for more`, `히스토그램은 그룹을 ${k}개까지 겹쳐요. 데이터에 ${groups.size}개가 있어서 앞의 ${k}개만 그려요. 더 많으면 ridgeline을 써 주세요`));
	}
}
function validateSpec(input, opts = {}) {
	const errors = [];
	const warnings = [];
	const err = (path, code, message) => errors.push({
		path,
		code,
		message
	});
	const warn = (path, code, message) => warnings.push({
		path,
		code,
		message
	});
	const lang = opts.lang ?? "en";
	const t = (en2, ko2) => lang === "ko" ? ko2 : en2;
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		err("", "not_object", t("The spec must be an object shaped like { type, data, encoding }", "스펙은 { type, data, encoding } 모양의 객체여야 해요"));
		return {
			valid: false,
			errors,
			warnings
		};
	}
	const spec = input;
	for (const k of Object.keys(spec)) if (![
		"$schema",
		"type",
		"data",
		"encoding",
		"options",
		"card",
		"theme"
	].includes(k)) warn(k, "unknown_key", t(`Unknown key "${k}" is ignored`, `"${k}" 키는 알 수 없어서 무시해요`));
	const types = CHARTS.map((c) => c.type).join(", ");
	if (typeof spec.type !== "string" || !spec.type) {
		err("type", "missing_type", t(`type is required. Possible values: ${types}`, `type이 필요해요. 가능한 값: ${types}`));
		return {
			valid: false,
			errors,
			warnings
		};
	}
	let def = getChartDef(spec.type);
	if (!def && TYPE_ALIASES[spec.type]) {
		def = getChartDef(TYPE_ALIASES[spec.type]);
		warn("type", "alias", t(`"${spec.type}" is drawn as "${def?.type}"`, `"${spec.type}" 타입은 "${def?.type}" 차트로 그려요`));
	}
	if (def?.type === "scatter" && spec.encoding && typeof spec.encoding === "object" && spec.encoding.size !== void 0) {
		def = getChartDef("bubble");
		warn("type", "alias", t("\"scatter\" with a size channel is drawn as \"bubble\"", "size 채널이 있는 \"scatter\"는 \"bubble\" 차트로 그려요"));
	}
	if (!def) {
		const near = closest(spec.type, [...CHARTS.map((c) => c.type), ...Object.keys(TYPE_ALIASES)]);
		const guess = near ? TYPE_ALIASES[near] ?? near : null;
		err("type", "unknown_type", t(`Unknown chart "${spec.type}".${guess ? ` Did you mean "${guess}"?` : ""} Possible values: ${types}`, `"${spec.type}" 차트는 없어요.${guess ? ` "${guess}"인가요?` : ""} 가능한 값: ${types}`));
		return {
			valid: false,
			errors,
			warnings
		};
	}
	const chartName = lang === "ko" ? META[def.type]?.nameKo ?? def.name : def.name;
	const shaped = (list, path) => {
		const bad = list.findIndex((r) => !r || typeof r !== "object" || Array.isArray(r));
		if (bad >= 0) err(`${path}[${bad}]`, "bad_row", t("Each row of data must be an object. Convert 2D arrays with fromRows() or use { csv }", "data의 각 행은 객체여야 해요. 2차원 배열은 fromRows()로 바꾸거나 { csv }를 써 주세요"));
		return list;
	};
	let rows = opts.rows ?? null;
	if (spec.data === void 0) err("data", "missing_data", t("data is required: an array of objects, { values }, { csv } or { url }", "data가 필요해요: 객체 배열, { values }, { csv }, { url } 중 하나"));
	else if (!rows) {
		const d = spec.data;
		if (Array.isArray(d)) rows = shaped(d, "data");
		else if (d && typeof d === "object") {
			const o = d;
			if ("url" in o) {
				if (typeof o.url !== "string" || !/^(https?:|\/|\.\/|data:)/.test(o.url)) err("data.url", "bad_url", t("data.url must be an http(s) address or a path", "data.url은 http(s) 주소나 경로여야 해요"));
				if (o.format !== void 0 && ![
					"json",
					"csv",
					"auto"
				].includes(String(o.format))) err("data.format", "bad_format", t("data.format must be \"json\" | \"csv\" | \"auto\"", "data.format은 \"json\" | \"csv\" | \"auto\" 중 하나여야 해요"));
			} else if ("csv" in o) {
				if (typeof o.csv !== "string") err("data.csv", "bad_csv", t("data.csv must be a string", "data.csv는 문자열이어야 해요"));
				else rows = parseCSV(o.csv);
			} else if ("values" in o) {
				if (!Array.isArray(o.values)) err("data.values", "bad_values", t("data.values must be an array", "data.values는 배열이어야 해요"));
				else rows = shaped(o.values, "data.values");
			} else err("data", "bad_data", t("data must be an array of objects, { values }, { csv } or { url }", "data는 객체 배열, { values }, { csv }, { url } 중 하나여야 해요"));
		} else err("data", "bad_data", t(`data has the wrong shape (${typeOf(d)})`, `data 형식이 맞지 않아요(${typeOf(d)})`));
	}
	if (rows && rows.length === 0) warn("data", "empty", t("data is empty. The chart draws its empty state", "data가 비어 있어요. 빈 상태로 그려요"));
	const enc = spec.encoding ?? {};
	if (spec.encoding !== void 0 && (typeof spec.encoding !== "object" || Array.isArray(spec.encoding))) err("encoding", "bad_encoding", t("encoding must be an object of { channel: field name }", "encoding은 { 채널: 필드 이름 } 객체여야 해요"));
	const fields = rows && rows.length ? Array.from(new Set(rows.slice(0, 200).flatMap((r) => r && typeof r === "object" ? Object.keys(r) : []))) : [];
	const names = def.encoding.map((c) => c.name);
	for (const k of Object.keys(enc)) if (!names.includes(k)) {
		const near = closest(k, names);
		warn(`encoding.${k}`, "unknown_channel", t(`${chartName} has no channel "${k}".${near ? ` Did you mean "${near}"?` : ""} Available channels: ${names.join(", ")}`, `${chartName}에는 "${k}" 채널이 없어요.${near ? ` "${near}"인가요?` : ""} 가능한 채널: ${names.join(", ")}`));
	}
	const binned = def.type === "histogram" && isPreBinned(rows?.find((r) => r && typeof r === "object"), enc.value, enc.count);
	const needed = def.type !== "histogram" ? null : binned ? [
		"x0",
		"x1",
		"count"
	] : ["value"];
	for (const c of def.encoding) {
		const v = enc[c.name];
		if (v === void 0) {
			if (c.required || needed?.includes(c.name)) {
				if (fields.includes(c.name)) continue;
				if (!fields.length) warn(`encoding.${c.name}`, "missing_channel_default", t(`encoding.${c.name} is missing, so the "${c.name}" field is used`, `encoding.${c.name} 값이 없어서 "${c.name}" 필드를 써요`));
				else err(`encoding.${c.name}`, "missing_channel", t(`encoding.${c.name} (${c.description}) is required. Data fields: ${fields.join(", ")}`, `encoding.${c.name} 값이 필요해요. 데이터 필드: ${fields.join(", ")}`));
			}
			continue;
		}
		const list = Array.isArray(v) ? v : [v];
		if (Array.isArray(v) && !c.multi) err(`encoding.${c.name}`, "not_multi", t(`encoding.${c.name} takes a single field`, `encoding.${c.name}에는 필드 하나만 넣어요`));
		for (const f of list) {
			if (typeof f !== "string" || !f) {
				err(`encoding.${c.name}`, "bad_field", t(`encoding.${c.name} must be a field name (string)`, `encoding.${c.name} 값은 필드 이름(문자열)이어야 해요`));
				continue;
			}
			if (!rows || !rows.length) continue;
			const present = rows.slice(0, 200).filter((r) => r && typeof r === "object" && hasField(r, f));
			if (!present.length) {
				const near = closest(f, fields);
				err(`encoding.${c.name}`, "field_not_found", t(`Field "${f}" is not in the data.${near ? ` Did you mean "${near}"?` : ""} Available fields: ${fields.join(", ")}`, `"${f}" 필드가 데이터에 없어요.${near ? ` "${near}"인가요?` : ""} 있는 필드: ${fields.join(", ")}`));
				continue;
			}
			const vals = present.map((r) => r[f]).filter((x) => x !== null && x !== void 0 && x !== "");
			if (c.type === "number" && vals.length) {
				const ok = vals.filter((x) => Number.isFinite(toNumber(x))).length / vals.length;
				if (ok < .8) err(`encoding.${c.name}`, "not_numeric", t(`Field "${f}" must be numeric (${Math.round(ok * 100)}% of values read as numbers)`, `"${f}" 필드는 숫자여야 해요(숫자로 읽히는 값 ${Math.round(ok * 100)}%)`));
			}
			if (c.type === "date" && vals.length) {
				if (vals.filter((x) => toDate(x)).length / vals.length < .8) err(`encoding.${c.name}`, "not_date", t(`Field "${f}" must be a date (for example "2025-03-15")`, `"${f}" 필드는 날짜여야 해요(예: "2025-03-15")`));
			}
		}
	}
	const options = spec.options;
	if (options !== void 0 && (typeof options !== "object" || options === null || Array.isArray(options))) err("options", "bad_options", t("options must be an object", "options는 객체여야 해요"));
	else if (options) {
		const defs = [...def.options, ...COMMON_OPTIONS];
		const optNames = defs.map((o) => o.name);
		for (const [k, v] of Object.entries(options)) {
			const o = defs.find((d) => d.name === k);
			if (!o) {
				const near = closest(k, optNames);
				warn(`options.${k}`, "unknown_option", t(`${chartName} has no option "${k}"${near ? `. Did you mean "${near}"?` : ""}`, `${chartName}에는 "${k}" 옵션이 없어요${near ? `. "${near}"인가요?` : ""}`));
				continue;
			}
			const vt = typeOf(v);
			const bad = (en2, ko2) => err(`options.${k}`, "bad_option_type", t(`options.${k} must be ${en2} (got ${vt})`, `options.${k} 값은 ${ko2} 해요(지금 ${vt})`));
			if (o.type === "number") {
				if (vt !== "number" || !Number.isFinite(v)) bad("a number", "숫자여야");
				else {
					if (o.min !== void 0 && v < o.min) err(`options.${k}`, "out_of_range", t(`options.${k} must be at least ${o.min}`, `options.${k} 값은 ${o.min} 이상이어야 해요`));
					if (o.max !== void 0 && v > o.max) err(`options.${k}`, "out_of_range", t(`options.${k} must be at most ${o.max}`, `options.${k} 값은 ${o.max} 이하여야 해요`));
				}
			} else if (o.type === "string" && vt !== "string") bad("a string", "문자열이어야");
			else if (o.type === "string" && /Color$/.test(k) && !isSafeStyleValue(v)) err(`options.${k}`, "bad_option_color", t(`options.${k} must be a theme token ("accent") or a CSS color`, `options.${k} 값은 테마 토큰("accent")이나 CSS 색이어야 해요`));
			else if (o.type === "boolean" && vt !== "boolean") bad("true or false", "true나 false여야");
			else if (o.type === "array" && vt !== "array") bad("an array", "배열이어야");
			else if (o.type === "array" && o.length !== void 0 && !isNumberTuple(v, o)) err(`options.${k}`, "bad_option_items", t(`options.${k} must be ${o.length} numbers from ${o.min} to ${o.max}`, `options.${k} 값은 ${o.min}~${o.max} 사이 숫자 ${o.length}개여야 해요`));
			else if (o.type === "object" && vt !== "object") bad("an object", "객체여야");
			else if (o.type === "annotations" && vt !== "array") bad("an array", "배열이어야");
			else if (o.type === "annotations") v.forEach((a, i) => {
				const issue = annotationIssue(a);
				if (issue) err(`options.${k}[${i}]`, "bad_annotation", t(...issue));
			});
			else if (o.type === "enum" && !(o.enum ?? []).includes(String(v))) {
				const choices = (o.enum ?? []).map((e) => `"${e}"`).join(" | ");
				err(`options.${k}`, "bad_enum", t(`options.${k} must be one of ${choices}`, `options.${k} 값은 ${choices} 중 하나여야 해요`));
			} else if (o.type === "format" && !(vt === "object" || [
				"number",
				"integer",
				"percent",
				"ratio",
				"compact",
				"currency",
				"decimal"
			].includes(String(v)))) err(`options.${k}`, "bad_format", t("format must be \"number\" | \"integer\" | \"percent\" | \"ratio\" | \"compact\" | \"currency\" | \"decimal\" or an Intl options object", "format 값은 \"number\" | \"integer\" | \"percent\" | \"ratio\" | \"compact\" | \"currency\" | \"decimal\" 중 하나이거나 Intl 옵션 객체여야 해요"));
			else if (o.type === "format" && vt === "object") {
				const { prefix: _p, suffix: _s, ...nfo } = v;
				try {
					new Intl.NumberFormat("en-US", nfo);
				} catch (e) {
					err(`options.${k}`, "bad_format", t(`options.${k} is not valid Intl.NumberFormat options: ${e.message}`, `options.${k} 값을 Intl.NumberFormat 옵션으로 쓸 수 없어요: ${e.message}`));
				}
			} else if (o.type === "highlight" && !(vt === "number" || vt === "string" || vt === "array" && v.every((x) => typeof x === "number" || typeof x === "string"))) bad("an index, a name or an array of them", "인덱스나 이름, 또는 그 배열이어야");
		}
		if (def.type === "bar" && options.orientation === "horizontal" && Array.isArray(options.annotations) && options.annotations.length) warn("options.annotations", "annotations_ignored", t("Annotations are drawn on vertical bars only", "주석은 세로 막대에서만 그려요"));
		if (typeof options.locale === "string") try {
			Intl.getCanonicalLocales(options.locale.replace(/_/g, "-"));
		} catch {
			err("options.locale", "bad_locale", t(`options.locale "${options.locale}" is not a locale. Use a tag such as "en-US" or "ko-KR"`, `options.locale "${options.locale}" 값은 로캘이 아니에요. "en-US", "ko-KR" 같은 값을 써 주세요`));
		}
		if (rows && rows.length && typeof options.highlight === "string" && ![
			"max",
			"min",
			"first",
			"last",
			"none"
		].includes(options.highlight)) {
			const h = options.highlight;
			if (!rows.slice(0, 2e3).some((r) => r && typeof r === "object" && Object.values(r).some((x) => String(x) === h))) warn("options.highlight", "highlight_not_found", t(`Could not find "${h}" to highlight among the data values`, `강조할 "${h}" 값을 데이터에서 찾지 못했어요`));
		}
	}
	if (def.type === "skyline") skylineIssues(rows, enc, options, fields, (isError, path, code, [en2, ko2]) => (isError ? err : warn)(path, code, t(en2, ko2)));
	if (def.type === "line" || def.type === "area") {
		const opts2 = options && typeof options === "object" && !Array.isArray(options) ? options : {};
		checkBand(def.type, enc, opts2, rows, t, err, warn);
	}
	if (def.type === "histogram") checkHistogram(rows, enc, options && typeof options === "object" && !Array.isArray(options) ? options : {}, binned, err, warn, t);
	if (spec.card !== void 0) {
		if (!spec.card || typeof spec.card !== "object" || Array.isArray(spec.card)) err("card", "bad_card", t("card must be an object", "card는 객체여야 해요"));
		else {
			const allowed = [
				"number",
				"title",
				"subtitle",
				"takeaway",
				"level",
				"legend",
				"sample",
				"replay"
			];
			for (const [k, v] of Object.entries(spec.card)) if (!allowed.includes(k)) warn(`card.${k}`, "unknown_card_key", t(`card has no key "${k}"`, `card에는 "${k}" 키가 없어요`));
			else if ([
				"number",
				"title",
				"subtitle",
				"takeaway",
				"level"
			].includes(k) && typeof v !== "string") err(`card.${k}`, "bad_card_value", t(`card.${k} must be a string`, `card.${k} 값은 문자열이어야 해요`));
			else if (k === "legend" && v !== "auto" && !Array.isArray(v)) err("card.legend", "bad_legend", t("card.legend must be \"auto\" or an array of [{ label, color }]", "card.legend는 \"auto\" 또는 [{ label, color }] 배열이어야 해요"));
			else if (k === "legend" && Array.isArray(v)) v.forEach((it, i) => {
				const c = it && typeof it === "object" ? it.color : void 0;
				if (c !== void 0 && (typeof c !== "string" || !isSafeStyleValue(c))) err(`card.legend[${i}].color`, "bad_legend_color", t("A legend color must be a theme token (\"accent\") or a CSS color", "범례 색은 테마 토큰(\"accent\")이나 CSS 색이어야 해요"));
			});
		}
	}
	if (spec.theme && typeof spec.theme === "object" && !Array.isArray(spec.theme)) {
		for (const [k, v] of Object.entries(spec.theme)) if (k === "name" ? typeof v !== "string" : !isSafeStyleValue(v, /family/i.test(k))) err(`theme.${k}`, "bad_theme_value", t(`theme.${k} must be a CSS color, length or font list such as "#0B8FD8", "oklch(…)", "var(--x)" or 18`, `theme.${k} 값은 "#0B8FD8", "oklch(…)", "var(--x)", 18 같은 CSS 색, 길이, 글꼴 목록이어야 해요`));
	} else if (spec.theme !== void 0 && spec.theme !== "dark" && spec.theme !== "light") err("theme", "bad_theme", t("theme must be \"dark\" | \"light\" or a token object", "theme은 \"dark\" | \"light\" 또는 토큰 객체여야 해요"));
	return {
		valid: errors.length === 0,
		errors,
		warnings
	};
}
// node_modules/.pnpm/ztd-charts@0.5.0_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/ztd-charts/dist/index.js
var COLOR_TOKENS = [
	"bg",
	"panel",
	"ink",
	"muted",
	"dim",
	"accent",
	"accentText",
	"onAccent",
	"onInk",
	"line",
	"line2",
	"neutral",
	"neutralStrong",
	"onNeutralStrong",
	"neutralSoft",
	"lift",
	"tint"
];
var DEFAULT_FONT = "\"Pretendard Variable\", Pretendard, \"Apple SD Gothic Neo\", \"Noto Sans KR\", \"Malgun Gothic\", system-ui, -apple-system, sans-serif";
var DEFAULT_MONO = "\"Roboto Mono\", \"Share Tech Mono\", ui-monospace, SFMono-Regular, Menlo, monospace";
var darkTheme = {
	name: "dark",
	bg: "#14171B",
	panel: "#14171B",
	ink: "#F1F3F5",
	muted: "#A3ABB5",
	dim: "#5B636D",
	accent: "#D6FD70",
	accentText: "#D6FD70",
	onAccent: "#14171B",
	onInk: "#14171B",
	line: "#2A2F36",
	line2: "#22272D",
	neutral: "#3A414A",
	neutralStrong: "#5F6772",
	onNeutralStrong: "#F1F3F5",
	neutralSoft: "#262B31",
	lift: "#1D2126",
	tint: "rgba(214, 253, 112, 0.14)",
	fontFamily: DEFAULT_FONT,
	monoFamily: DEFAULT_MONO,
	radius: 18,
	radiusCode: 14,
	radiusMark: 4
};
var themes = {
	dark: darkTheme,
	light: {
		name: "light",
		bg: "#FFFFFF",
		panel: "#FFFFFF",
		ink: "#14171B",
		muted: "#5D6570",
		dim: "#B3B9C2",
		accent: "#0B8FD8",
		accentText: "#006DA8",
		onAccent: "#14171B",
		onInk: "#FFFFFF",
		line: "#E6E9ED",
		line2: "#F0F2F5",
		neutral: "#D5DAE0",
		neutralStrong: "#9AA3AE",
		onNeutralStrong: "#14171B",
		neutralSoft: "#EEF1F4",
		lift: "#F4F6F8",
		tint: "rgba(11, 143, 216, 0.12)",
		fontFamily: DEFAULT_FONT,
		monoFamily: DEFAULT_MONO,
		radius: 18,
		radiusCode: 14,
		radiusMark: 4
	}
};
function cssVarName(key) {
	return `--ztd-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}
function themeToCssVars(theme) {
	const out = {};
	for (const k of COLOR_TOKENS) {
		const v = theme[k];
		if (typeof v === "string") out[cssVarName(k)] = v;
	}
	if (theme.fontFamily) out["--ztd-font"] = theme.fontFamily;
	if (theme.monoFamily) out["--ztd-mono"] = theme.monoFamily;
	if (theme.radius !== void 0) out["--ztd-radius"] = `${theme.radius}px`;
	if (theme.radiusCode !== void 0) out["--ztd-radius-code"] = `${theme.radiusCode}px`;
	if (theme.radiusMark !== void 0) out["--ztd-radius-mark"] = `${theme.radiusMark}px`;
	return out;
}
function themeToCss(theme, selector = ":root") {
	const vars = themeToCssVars(theme);
	return `${selector} {
${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}
}`.replace(/</g, "\\3c ");
}
function mergeTheme(base, over) {
	if (!over) return base;
	const out = { ...base };
	for (const k of Object.keys(over)) {
		const v = over[k];
		if (v !== void 0) out[k] = v;
	}
	return out;
}
var NAMED = {
	white: "#ffffff",
	black: "#000000",
	transparent: "#00000000"
};
function parseColor(input) {
	if (!input) return null;
	let s = input.trim();
	const v = /^var\(\s*--[\w-]+\s*,\s*(.+)\)$/i.exec(s);
	if (v) s = v[1].trim();
	if (NAMED[s.toLowerCase()]) s = NAMED[s.toLowerCase()];
	if (s.startsWith("#")) {
		let h = s.slice(1);
		if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
		if (h.length !== 6 && h.length !== 8 || /[^\da-f]/i.test(h)) return null;
		const n = parseInt(h, 16);
		if (h.length === 6) return [
			n >> 16 & 255,
			n >> 8 & 255,
			n & 255,
			1
		];
		return [
			parseInt(h.slice(0, 2), 16),
			parseInt(h.slice(2, 4), 16),
			parseInt(h.slice(4, 6), 16),
			parseInt(h.slice(6, 8), 16) / 255
		];
	}
	const m = /^rgba?\(([^)]+)\)$/i.exec(s);
	if (m) {
		const parts = m[1].split(/[\s,/]+/).filter(Boolean);
		if (parts.length < 3) return null;
		const ch = parts.slice(0, 3).map((p) => p.endsWith("%") ? parseFloat(p) / 100 * 255 : parseFloat(p));
		const a = parts[3] !== void 0 ? parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]) : 1;
		if (ch.some((c) => Number.isNaN(c))) return null;
		return [
			ch[0],
			ch[1],
			ch[2],
			Number.isNaN(a) ? 1 : a
		];
	}
	return null;
}
function toHex(c) {
	const h = (x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0");
	return `#${h(c[0])}${h(c[1])}${h(c[2])}${c[3] < 1 ? h(c[3] * 255) : ""}`.toUpperCase();
}
function composite(top, under) {
	const a = top[3];
	return [
		top[0] * a + under[0] * (1 - a),
		top[1] * a + under[1] * (1 - a),
		top[2] * a + under[2] * (1 - a),
		1
	];
}
function channel(c) {
	const s = c / 255;
	return s <= .04045 ? s / 12.92 : Math.pow((s + .055) / 1.055, 2.4);
}
function luminance(c) {
	return .2126 * channel(c[0]) + .7152 * channel(c[1]) + .0722 * channel(c[2]);
}
function contrastRatio(a, b, backdrop) {
	const pa = typeof a === "string" ? parseColor(a) : a;
	let pb = typeof b === "string" ? parseColor(b) : b;
	if (!pa || !pb) return 0;
	const bd = backdrop ? typeof backdrop === "string" ? parseColor(backdrop) : backdrop : null;
	if (pb[3] < 1 && bd) pb = composite(pb, bd);
	const l1 = luminance(pa[3] < 1 ? composite(pa, pb) : pa);
	const l2 = luminance(pb);
	return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
}
function toLinear(c) {
	return [
		channel(c[0]),
		channel(c[1]),
		channel(c[2])
	];
}
function fromLinear(x) {
	const v = x <= .0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - .055;
	return Math.max(0, Math.min(255, v * 255));
}
function rgbToOklab(c) {
	const [r, g, b] = toLinear(c);
	const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
	const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
	const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
	return [
		.2104542553 * l + .793617785 * m - .0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + .4505937099 * s,
		.0259040371 * l + .7827717662 * m - .808675766 * s
	];
}
function oklabToRgb([L, A, B], alpha) {
	const l = (L + .3963377774 * A + .2158037573 * B) ** 3;
	const m = (L - .1055613458 * A - .0638541728 * B) ** 3;
	const s = (L - .0894841775 * A - 1.291485548 * B) ** 3;
	return [
		fromLinear(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s),
		fromLinear(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * s),
		fromLinear(-.0041960863 * l - .7034186147 * m + 1.707614701 * s),
		alpha
	];
}
function mixHex(a, b, t) {
	const pa = parseColor(a);
	const pb = parseColor(b);
	if (!pa || !pb) return a;
	const la = rgbToOklab(pa);
	const lb = rgbToOklab(pb);
	const k = Math.max(0, Math.min(1, t));
	return toHex(oklabToRgb([
		la[0] * k + lb[0] * (1 - k),
		la[1] * k + lb[1] * (1 - k),
		la[2] * k + lb[2] * (1 - k)
	], pa[3] * k + pb[3] * (1 - k)));
}
function pickText(background, candidates, backdrop) {
	let best = candidates[0];
	let bestC = -1;
	for (const c of candidates) {
		const r = contrastRatio(c, background, backdrop);
		if (r > bestC) {
			bestC = r;
			best = c;
		}
	}
	return best;
}
var ThemeContext = createContext({
	theme: darkTheme,
	cssVars: true
});
function resolveThemeInput(input, base = darkTheme) {
	if (!input) return base;
	if (typeof input === "string") return themes[input] ?? base;
	return mergeTheme(base, input);
}
function ThemeProvider(props) {
	const parent = useContext(ThemeContext);
	const start = props.base ? themes[props.base] : parent.theme;
	const theme = useMemo(() => resolveThemeInput(props.theme, start), [props.theme, start]);
	const cssVars = props.cssVars ?? parent.cssVars;
	const locale = props.locale ?? parent.locale;
	const value = useMemo(() => ({
		theme,
		cssVars,
		locale
	}), [
		theme,
		cssVars,
		locale
	]);
	const vars = useMemo(() => themeToCssVars(theme), [theme]);
	const style = props.paint ? {
		background: theme.bg,
		color: theme.ink,
		fontFamily: theme.fontFamily,
		...vars,
		...props.style
	} : {
		display: "contents",
		...vars,
		...props.style
	};
	return /* @__PURE__ */ jsx(ThemeContext.Provider, {
		value,
		children: /* @__PURE__ */ jsx("div", {
			className: props.className,
			"data-ztd-theme": theme.name,
			lang: props.locale,
			style,
			children: props.children
		})
	});
}
var TOKEN_SET = /* @__PURE__ */ new Set([
	"bg",
	"panel",
	"ink",
	"muted",
	"dim",
	"accent",
	"accentText",
	"onAccent",
	"onInk",
	"line",
	"line2",
	"neutral",
	"neutralStrong",
	"onNeutralStrong",
	"neutralSoft",
	"lift",
	"tint"
]);
function isColorToken(c) {
	return TOKEN_SET.has(c);
}
function makePainter(theme, cssVars) {
	const paint = (token) => cssVars ? `var(${cssVarName(token)}, ${theme[token]})` : theme[token];
	return {
		theme,
		cssVars,
		paint,
		color: (c, fallback = "neutral") => {
			if (!c) return paint(fallback);
			return isColorToken(c) ? paint(c) : c;
		},
		raw: (c, fallback = "neutral") => {
			if (!c) return theme[fallback];
			return isColorToken(c) ? theme[c] : c;
		},
		mix: (a, b, t) => {
			const pct = Math.round(Math.max(0, Math.min(1, t)) * 1e3) / 10;
			return cssVars ? `color-mix(in oklab, ${paint(a)} ${pct}%, ${paint(b)})` : mixHex(theme[a], theme[b], t);
		}
	};
}
function useChartTheme(override) {
	const ctx = useContext(ThemeContext);
	return useMemo(() => {
		return makePainter(mergeTheme(ctx.theme, override), ctx.cssVars);
	}, [
		ctx.theme,
		ctx.cssVars,
		override
	]);
}
function useChartLocale(override) {
	const ctx = useContext(ThemeContext);
	return override ?? ctx.locale ?? "en-US";
}
function overrideVars(override) {
	if (!override) return {};
	return themeToCssVars(override);
}
var isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
var useIsoLayoutEffect = isBrowser ? useLayoutEffect : useEffect;
function now() {
	return typeof performance !== "undefined" ? performance.now() : Date.now();
}
function thresholdsUpTo(t) {
	return [...new Set([
		0,
		.01,
		.02,
		.05,
		.1,
		.15,
		.2,
		t
	].filter((v) => v <= t))].sort((a, b) => a - b);
}
function isShown(e, threshold) {
	const rootH = e.rootBounds?.height ?? window.innerHeight;
	return e.isIntersecting && (e.intersectionRatio >= threshold || e.intersectionRect.height >= rootH * .5);
}
function useViewport(el, enabled = true) {
	const [state, setState] = useState({
		visible: !enabled,
		near: !enabled
	});
	useEffect(() => {
		if (!enabled) {
			setState({
				visible: true,
				near: true
			});
			return;
		}
		if (!el) return void 0;
		if (typeof IntersectionObserver === "undefined") {
			setState({
				visible: true,
				near: true
			});
			return;
		}
		const vis = new IntersectionObserver((entries) => {
			const on = isShown(entries[entries.length - 1], .25);
			setState((s) => s.visible === on ? s : {
				...s,
				visible: on,
				near: s.near || on
			});
		}, {
			threshold: thresholdsUpTo(.25),
			rootMargin: "0px 0px -8% 0px"
		});
		const near = new IntersectionObserver((entries) => {
			const e = entries[entries.length - 1];
			setState((s) => s.near === e.isIntersecting ? s : {
				...s,
				near: e.isIntersecting
			});
		}, {
			threshold: 0,
			rootMargin: "240px 0px 240px 0px"
		});
		vis.observe(el);
		near.observe(el);
		return () => {
			vis.disconnect();
			near.disconnect();
		};
	}, [el, enabled]);
	return state;
}
function readWidth(el) {
	const r = el.clientWidth || el.getBoundingClientRect().width;
	return r > 0 ? Math.round(r * 10) / 10 : 0;
}
function useMeasuredNode(fixed) {
	const [node, setNode] = useState(null);
	const [w, setW] = useState(fixed ?? null);
	const ref = useCallback((el) => {
		setNode(el);
		if (el && fixed === void 0) setW(readWidth(el));
	}, [fixed]);
	useIsoLayoutEffect(() => {
		if (fixed !== void 0) {
			setW(fixed);
			return;
		}
		if (!node) return void 0;
		const apply = (r) => setW((prev) => prev !== null && Math.abs(prev - r) < .5 ? prev : r);
		const read = () => apply(readWidth(node));
		if (typeof ResizeObserver === "undefined") {
			read();
			window.addEventListener("resize", read);
			return () => window.removeEventListener("resize", read);
		}
		const ro = new ResizeObserver((entries) => {
			const box = entries[entries.length - 1]?.contentRect;
			if (box) apply(box.width > 0 ? Math.round(box.width * 10) / 10 : 0);
			else read();
		});
		ro.observe(node);
		return () => ro.disconnect();
	}, [node, fixed]);
	return [
		node,
		ref,
		w
	];
}
var subscribeNothing = () => () => {};
function useHydrated() {
	return useSyncExternalStore(subscribeNothing, () => true, () => false);
}
var QUERY = "(prefers-reduced-motion: reduce)";
function useReducedMotion(pref = "auto") {
	const [os, setOs] = useState(() => isBrowser && typeof window.matchMedia === "function" ? window.matchMedia(QUERY).matches : false);
	useEffect(() => {
		if (pref !== "auto" || !isBrowser || typeof window.matchMedia !== "function") return void 0;
		const mq = window.matchMedia(QUERY);
		const on = () => setOs(mq.matches);
		on();
		mq.addEventListener?.("change", on);
		return () => mq.removeEventListener?.("change", on);
	}, [pref]);
	if (pref === true) return true;
	if (pref === false) return false;
	return os;
}
function easeOutCubic(p) {
	return 1 - Math.pow(1 - p, 3);
}
function easeInOutCubic(p) {
	return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}
function easeFn(name) {
	if (name === "easeInOut") return easeInOutCubic;
	if (name === "linear") return (p) => p;
	return easeOutCubic;
}
function easeDeriv(name, p) {
	if (name === "linear") return 1;
	if (name === "easeInOut") return p < .5 ? 12 * p * p : 3 * Math.pow(-2 * p + 2, 2);
	return 3 * Math.pow(1 - p, 2);
}
function resample(src, n) {
	if (src.length === n) return src.slice();
	if (!src.length) return new Array(n).fill(0);
	if (src.length === 1 || n === 1) return new Array(n).fill(src[0]);
	const out = new Array(n);
	for (let i = 0; i < n; i++) {
		const f = i / (n - 1) * (src.length - 1);
		const a = Math.floor(f);
		const b = Math.min(src.length - 1, a + 1);
		out[i] = src[a] + (src[b] - src[a]) * (f - a);
	}
	return out;
}
function sameVec(a, b) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		const x = a[i];
		const y = b[i];
		if (Number.isNaN(x) !== Number.isNaN(y) || Math.abs(x - y) > 1e-6) return false;
	}
	return true;
}
function fillGaps(from, vel, to) {
	for (let i = 0; i < to.length; i++) if (!Number.isFinite(from[i]) || !Number.isFinite(to[i])) {
		from[i] = to[i];
		vel[i] = 0;
	}
}
function resampleParts(src, fromParts, toParts, n) {
	if (!fromParts || !toParts || fromParts.length !== toParts.length) return resample(src, n);
	const out = [];
	let at = 0;
	for (let p = 0; p < toParts.length; p++) {
		const seg = src.slice(at, at + fromParts[p]);
		at += fromParts[p];
		for (const v of resample(seg, toParts[p])) out.push(v);
	}
	return out.length === n ? out : resample(src, n);
}
var MotionEngine = class {
	constructor() {
		this.tracks = /* @__PURE__ */ new Map();
		this.seq = 0;
		this.easing = "spring";
		this.duration = 900;
		this.omega = 8.2;
		this.animating = false;
		/** 등장 시작 시각(ms). 등장 중이 아니면 -1 */
		this.entranceStart = -1;
		this.maxDelay = 0;
	}
	configure(easing, duration) {
		this.easing = easing;
		this.duration = Math.max(1, duration);
		this.omega = 7.4 / (this.duration / 1e3);
	}
	/** 마지막으로 받은 목표들과 같은지 */
	sameTargets(marks) {
		let live = 0;
		for (const t of this.tracks.values()) if (!t.exiting) live++;
		if (live !== marks.length) return false;
		for (const m of marks) {
			const t = this.tracks.get(m.key);
			if (!t || t.exiting || !sameVec(t.to, m.to)) return false;
		}
		return true;
	}
	/** 렌더 정보만 바꿔요 (값은 그대로) */
	refreshData(marks) {
		for (const m of marks) {
			const t = this.tracks.get(m.key);
			if (t) t.data = m.data;
		}
	}
	make(m, cur, t0, delay) {
		const appear = m.from ?? m.to;
		const enter = m.enter ?? appear;
		return {
			key: m.key,
			data: m.data,
			from: cur.slice(),
			vel: new Array(m.to.length).fill(0),
			to: m.to.slice(),
			appear: appear.slice(),
			enter: enter.slice(),
			exit: (m.exit ?? enter).slice(),
			delay,
			t0,
			cur: cur.slice(),
			curVel: new Array(m.to.length).fill(0),
			done: false,
			exiting: false,
			order: this.seq++,
			progress: 0,
			parts: m.parts
		};
	}
	/** 애니메이션 없이 바로 목표로 */
	snap(marks) {
		const next = /* @__PURE__ */ new Map();
		for (const m of marks) {
			const old = this.tracks.get(m.key);
			const tr2 = this.make(m, m.to, 0, 0);
			if (old) tr2.order = old.order;
			tr2.done = true;
			tr2.progress = 1;
			next.set(m.key, tr2);
		}
		this.tracks = next;
		this.animating = false;
		this.entranceStart = -1;
	}
	/** 등장 전 상태로 세워 둬요 */
	hold(marks) {
		const next = /* @__PURE__ */ new Map();
		let maxDelay = 0;
		for (const m of marks) {
			const old = this.tracks.get(m.key);
			const tr2 = this.make(m, m.from ?? m.to, Infinity, m.delay ?? 0);
			if (old) tr2.order = old.order;
			maxDelay = Math.max(maxDelay, m.delay ?? 0);
			next.set(m.key, tr2);
		}
		this.maxDelay = maxDelay;
		this.tracks = next;
		this.animating = false;
		this.entranceStart = -1;
	}
	/** 세워 둔 상태에서 등장 시작 */
	start(now2) {
		for (const t of this.tracks.values()) {
			t.t0 = now2 + t.delay;
			t.from = t.appear.slice();
			t.vel.fill(0);
			fillGaps(t.from, t.vel, t.to);
			t.cur = t.from.slice();
			t.curVel = t.vel.slice();
			t.done = sameVec(t.from, t.to);
			if (t.done) t.progress = 1;
		}
		this.entranceStart = now2;
		this.animating = true;
	}
	/** 지금 값에서 새 목표로. 새 항목은 enter에서, 빠진 항목은 exit로 */
	update(marks, now2, stagger = 0) {
		this.step(now2);
		const seen = /* @__PURE__ */ new Set();
		let i = 0;
		for (const m of marks) {
			seen.add(m.key);
			const old = this.tracks.get(m.key);
			const delay = stagger > 0 ? Math.min(i * stagger, 240) : 0;
			if (old) {
				const len = m.to.length;
				old.from = resampleParts(old.cur, old.parts, m.parts, len);
				old.vel = resampleParts(old.curVel, old.parts, m.parts, len);
				old.parts = m.parts;
				old.to = m.to.slice();
				fillGaps(old.from, old.vel, old.to);
				old.cur = old.from.slice();
				old.curVel = old.vel.slice();
				old.appear = (m.from ?? m.to).slice();
				old.enter = (m.enter ?? old.appear).slice();
				old.exit = (m.exit ?? old.enter).slice();
				old.data = m.data;
				old.exiting = false;
				old.t0 = now2 + (old.t0 > now2 ? Math.max(0, old.t0 - now2) : delay);
				old.done = sameVec(old.from, old.to) && old.vel.every((v) => Math.abs(v) < 1e-6);
				old.progress = old.done ? 1 : 0;
			} else {
				const tr2 = this.make(m, m.enter ?? m.from ?? m.to, now2 + delay, 0);
				tr2.done = sameVec(tr2.from, tr2.to);
				this.tracks.set(m.key, tr2);
			}
			i++;
		}
		for (const t of this.tracks.values()) {
			if (seen.has(t.key) || t.exiting) continue;
			t.from = t.cur.slice();
			t.vel = t.curVel.slice();
			t.to = resample(t.exit, t.cur.length);
			t.t0 = now2;
			t.exiting = true;
			t.done = false;
			t.progress = 0;
		}
		this.animating = true;
	}
	/** now 시각의 값을 계산. 아직 움직이는 중이면 true */
	step(now2) {
		if (!this.animating) return false;
		let moving = false;
		const ease = easeFn(this.easing);
		const D = this.duration / 1e3;
		const w = this.omega;
		const removed = [];
		for (const t of this.tracks.values()) {
			if (t.done) continue;
			const dt = (now2 - t.t0) / 1e3;
			const n = t.to.length;
			if (t.from.length !== n) t.from = resample(t.from, n);
			if (t.vel.length !== n) t.vel = resample(t.vel, n);
			if (t.cur.length !== n) {
				t.cur = new Array(n).fill(0);
				t.curVel = new Array(n).fill(0);
			}
			if (!(dt > 0)) {
				for (let i = 0; i < n; i++) {
					t.cur[i] = t.from[i];
					t.curVel[i] = 0;
				}
				t.progress = 0;
				moving = true;
				continue;
			}
			let finished;
			if (this.easing === "spring") {
				const e = Math.exp(-w * dt);
				const check = w * dt >= 8 && w * dt < 20;
				let far = 0;
				for (let i = 0; i < n; i++) {
					const A = t.from[i] - t.to[i];
					const B = t.vel[i] + w * A;
					t.cur[i] = t.to[i] + (A + B * dt) * e;
					t.curVel[i] = (t.vel[i] - w * B * dt) * e;
					if (check && far < .15) far = Math.max(far, Math.abs(t.cur[i] - t.to[i]), Math.abs(t.curVel[i] / w));
				}
				finished = w * dt >= 20 || check && far < .15;
				t.progress = Math.min(1, 1 - (1 + w * dt) * e);
			} else {
				const p = Math.min(1, dt / D);
				const k = ease(p);
				const dk = easeDeriv(this.easing, p) / D;
				for (let i = 0; i < n; i++) {
					t.cur[i] = t.from[i] + (t.to[i] - t.from[i]) * k;
					t.curVel[i] = (t.to[i] - t.from[i]) * dk;
				}
				finished = p >= 1;
				t.progress = k;
			}
			if (finished) {
				for (let i = 0; i < n; i++) {
					t.cur[i] = t.to[i];
					t.curVel[i] = 0;
				}
				t.done = true;
				t.progress = 1;
				if (t.exiting) removed.push(t.key);
			} else moving = true;
		}
		for (const k of removed) this.tracks.delete(k);
		this.animating = moving;
		if (!moving) this.entranceStart = -1;
		return moving;
	}
	/** 등장 시작 후 지난 시간(ms). 등장 중이 아니면 Infinity */
	elapsed(now2) {
		return this.entranceStart < 0 ? Infinity : now2 - this.entranceStart;
	}
	/** 등장 전체 길이 추정(ms) */
	get entranceLength() {
		return this.duration + this.maxDelay;
	}
	get(key) {
		return this.tracks.get(key)?.cur;
	}
	items() {
		return [...this.tracks.values()].sort((a, b) => a.order - b.order).map((t) => ({
			key: t.key,
			v: t.cur,
			data: t.data,
			exiting: t.exiting,
			progress: t.progress
		}));
	}
	get size() {
		return this.tracks.size;
	}
};
var subscribers = /* @__PURE__ */ new Set();
var rafId = 0;
function loop(t) {
	rafId = 0;
	const list = Array.from(subscribers);
	for (const fn of list) {
		let keep;
		try {
			keep = fn(t);
		} catch {
			keep = false;
		}
		if (!keep) subscribers.delete(fn);
	}
	if (subscribers.size && typeof requestAnimationFrame !== "undefined") rafId = requestAnimationFrame(loop);
}
function subscribeTick(fn) {
	subscribers.add(fn);
	if (!rafId && typeof requestAnimationFrame !== "undefined") rafId = requestAnimationFrame(loop);
	return () => {
		subscribers.delete(fn);
	};
}
var baseCss = `
.ztd-root{position:relative;-webkit-tap-highlight-color:transparent}
.ztd-root:focus{outline:none}
.ztd-root:focus-visible{outline:2px solid var(--ztd-accent,${darkTheme.accent});outline-offset:3px;border-radius:6px}
.ztd-svg{display:block;overflow:visible;user-select:none;-webkit-user-select:none}
.ztd-mark{transition:opacity .18s ease,fill .18s ease,stroke .18s ease,stroke-width .18s ease}
.ztd-tip{animation:ztd-fade .14s ease-out;transition:left .2s cubic-bezier(.22,1,.36,1),top .2s cubic-bezier(.22,1,.36,1)}
.ztd-guide{transition:transform .2s cubic-bezier(.22,1,.36,1)}
.ztd-still .ztd-tip,.ztd-still .ztd-guide{transition:none;animation:none}
.ztd-btn{appearance:none;font:inherit;cursor:pointer;transition:background .14s,color .14s,border-color .14s}
.ztd-btn:focus{outline:none}
.ztd-btn:focus-visible{outline:2px solid var(--ztd-accent,${darkTheme.accent});outline-offset:2px}
.ztd-card{transition:border-color .16s ease}
.ztd-card:hover{border-color:var(--ztd-dim,${darkTheme.dim})}
@media (prefers-reduced-motion: reduce){.ztd-mark,.ztd-tip,.ztd-guide,.ztd-btn,.ztd-card{transition:none;animation:none}}
@keyframes ztd-pop{from{opacity:0;transform:scale(.45)}to{opacity:1;transform:none}}
@keyframes ztd-fade{from{opacity:0}to{opacity:1}}
.ztd-pop{transform-box:fill-box;transform-origin:center}
@keyframes ztd-pulse{0%,100%{opacity:.55}50%{opacity:1}}
.ztd-skeleton{animation:ztd-pulse 1.4s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.ztd-skeleton{animation:none}}
`;
function cssEntrance(enabled, waiting, kind, delay, duration) {
	if (!enabled) return void 0;
	if (waiting) return { opacity: 0 };
	return { animation: `ztd-${kind} ${Math.round(duration)}ms cubic-bezier(.22,.9,.3,1) ${Math.round(delay)}ms backwards` };
}
var injected = false;
function ensureBaseStyles() {
	if (injected || typeof document === "undefined") return;
	injected = true;
	if (document.getElementById("ztd-base")) return;
	const el = document.createElement("style");
	el.id = "ztd-base";
	el.textContent = baseCss;
	document.head.appendChild(el);
}
function isWide(code) {
	return code >= 44032 && code <= 55203 || code >= 4352 && code <= 4607 || code >= 12592 && code <= 12687 || code >= 19968 && code <= 40959;
}
function charWidth(code) {
	if (code >= 44032 && code <= 55203) return .87;
	if (code >= 4352 && code <= 4607 || code >= 12592 && code <= 12687) return .8;
	if (code >= 19968 && code <= 40959) return .94;
	if (code >= 48 && code <= 57) return .585;
	if (code === 32) return .26;
	if (code === 44 || code === 46 || code === 58 || code === 59 || code === 39) return .26;
	if (code === 37) return .84;
	if (code === 8722) return .73;
	if (code === 45) return .42;
	if (code === 43 || code === 61) return .6;
	if (code === 40 || code === 41 || code === 91 || code === 93) return .34;
	if (code === 47) return .38;
	if (code === 8361 || code === 36) return .62;
	if (code === 8230) return .82;
	if (code >= 65 && code <= 90) {
		if (code === 73) return .28;
		if (code === 77 || code === 87) return .86;
		return .66;
	}
	if (code >= 97 && code <= 122) {
		if (code === 105 || code === 108 || code === 106) return .24;
		if (code === 109 || code === 119) return .84;
		if (code === 102 || code === 116 || code === 114) return .36;
		return .55;
	}
	return .6;
}
var cache = /* @__PURE__ */ new Map();
function textWidth(s, size, weight = 400) {
	const str = String(s);
	const key = `${str}|${weight >= 600 ? 1 : 0}`;
	let em = cache.get(key);
	if (em === void 0) {
		let wide = 0;
		let rest = 0;
		for (let i = 0; i < str.length; i++) {
			const code = str.charCodeAt(i);
			if (isWide(code)) wide += charWidth(code);
			else rest += charWidth(code);
		}
		em = wide + rest * (weight >= 600 ? 1.07 : 1);
		if (cache.size > 5e3) cache.clear();
		cache.set(key, em);
	}
	return em * size;
}
function truncate(s, maxWidth, size, weight = 400) {
	s = s.trim();
	if (textWidth(s, size, weight) <= maxWidth) return s;
	const ell = "…";
	let lo = 0;
	let hi = s.length;
	while (lo < hi) {
		const mid = lo + hi + 1 >> 1;
		if (textWidth(s.slice(0, mid) + ell, size, weight) <= maxWidth) lo = mid;
		else hi = mid - 1;
	}
	if (lo > 0 && (s.charCodeAt(lo - 1) & 64512) === 55296) lo--;
	const kept = s.slice(0, lo).trimEnd();
	return kept.length < (isWide(kept.charCodeAt(0)) ? 2 : 3) ? "" : kept + ell;
}
function truncateBeside(name, beside, maxWidth, size, weight = 400) {
	return truncate(name, maxWidth - textWidth(` ${beside}`, size, weight), size, weight);
}
function wrapLines(s, maxWidth, size, maxLines = 2, weight = 400) {
	const lines = [];
	let rest = s.trim();
	while (lines.length < maxLines - 1 && textWidth(rest, size, weight) > maxWidth) {
		let i = rest.lastIndexOf(" ");
		while (i > 0 && textWidth(rest.slice(0, i), size, weight) > maxWidth) i = rest.lastIndexOf(" ", i - 1);
		if (i <= 0) break;
		lines.push(rest.slice(0, i).trimEnd());
		rest = rest.slice(i + 1).trimStart();
	}
	return [...lines, truncate(rest, maxWidth, size, weight)];
}
function overlaps(a, b, pad = 0) {
	return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}
function labelBox(text, x, y, size, anchor = "start", weight = 400) {
	const w = textWidth(text, size, weight);
	return {
		x: anchor === "start" ? x : anchor === "middle" ? x - w / 2 : x - w,
		y: y - size * .6,
		w,
		h: size * 1.2
	};
}
function dodgeVertical(ys, minGap, lo = -Infinity, hi = Infinity) {
	const idx = ys.map((y, i) => ({
		y,
		i
	})).sort((a, b) => a.y - b.y);
	const out = new Array(ys.length);
	const pos = idx.map((d) => Math.max(lo, Math.min(hi, d.y)));
	for (let iter = 0; iter < 30; iter++) {
		let moved = false;
		for (let k = 1; k < pos.length; k++) {
			const gap = pos[k] - pos[k - 1];
			if (gap < minGap) {
				const push = (minGap - gap) / 2;
				pos[k - 1] -= push;
				pos[k] += push;
				moved = true;
			}
		}
		for (let k = 0; k < pos.length; k++) pos[k] = Math.max(lo, Math.min(hi, pos[k]));
		if (!moved) break;
	}
	for (let k = 1; k < pos.length; k++) if (pos[k] - pos[k - 1] < minGap) pos[k] = pos[k - 1] + minGap;
	if (pos.length && pos[pos.length - 1] > hi) {
		const shift = pos[pos.length - 1] - hi;
		for (let k = 0; k < pos.length; k++) pos[k] -= shift;
	}
	idx.forEach((d, k) => {
		out[d.i] = pos[k];
	});
	return out;
}
async function readResponse(res, mode = "auto", url = "", locale) {
	const ct = res.headers.get("content-type") ?? "";
	const text = await res.text();
	if (mode === "text") return text;
	if (ct.includes("text/html") || /^\s*<(!doctype html|html[\s>])/i.test(text)) throw new Error(langOf(locale) === "ko" ? `데이터 대신 HTML 페이지를 받았어요. 주소를 확인해 주세요${url ? `: ${url}` : "."}` : `Got an HTML page instead of data${url ? ` (${url})` : ""}. Check the URL.`);
	if (mode === "csv") return parseCSV(text);
	if (mode === "json" || ct.includes("json")) return JSON.parse(text);
	if (ct.includes("csv") || /[./]csv(\?|#|$)|output=csv|format=csv|tqx=out:csv/i.test(url)) return parseCSV(text);
	const t = text.trim();
	if (t.startsWith("{") || t.startsWith("[")) return JSON.parse(t);
	return parseCSV(text);
}
async function fetchChartData(source, options = {}) {
	const signal = options.signal ?? new AbortController().signal;
	let raw;
	if (typeof source === "function") raw = await source(signal);
	else {
		const url = source instanceof Request ? source.url : String(source);
		const res = await fetch(source instanceof Request ? source.clone() : url, {
			...options.init,
			signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`);
		raw = await readResponse(res, options.parse, url, options.locale);
	}
	if (options.select) raw = pluck(raw, options.select);
	return options.transform ? options.transform(raw) : normalizeData(raw);
}
function useChartData(source, options = {}) {
	const { refreshMs, enabled = true, keepPrevious = true } = options;
	const [state, setState] = useState(() => ({
		data: [],
		status: source && enabled ? "loading" : "idle",
		error: null,
		updatedAt: null
	}));
	const [tick, setTick] = useState(0);
	const locale = useChartLocale(options.locale);
	const opt = useRef(options);
	opt.current = {
		...options,
		locale
	};
	const src = useRef(source);
	src.current = source;
	const key = typeof source === "function" ? "fn" : source instanceof Request ? source.url : source ? String(source) : "";
	const deps = options.deps ?? [];
	const depKey = JSON.stringify(deps.map((d) => typeof d === "object" ? JSON.stringify(d) : String(d)));
	const inFlight = useRef(false);
	useEffect(() => {
		const s = src.current;
		if (!s || !enabled) {
			setState((prev) => prev.status === "loading" ? {
				...prev,
				status: "idle"
			} : prev);
			return;
		}
		const ctrl = new AbortController();
		let alive = true;
		inFlight.current = true;
		setState((prev) => ({
			...prev,
			data: keepPrevious ? prev.data : [],
			status: "loading",
			error: null
		}));
		fetchChartData(s, {
			...opt.current,
			signal: ctrl.signal
		}).then((data) => {
			if (alive) setState({
				data,
				status: "success",
				error: null,
				updatedAt: Date.now()
			});
		}).catch((e) => {
			if (!alive || ctrl.signal.aborted) return;
			setState((prev) => ({
				...prev,
				status: "error",
				error: e instanceof Error ? e : new Error(String(e))
			}));
		}).finally(() => {
			if (alive) inFlight.current = false;
		});
		return () => {
			alive = false;
			inFlight.current = false;
			ctrl.abort();
		};
	}, [
		key,
		enabled,
		tick,
		depKey,
		keepPrevious
	]);
	useEffect(() => {
		if (!refreshMs || !enabled) return void 0;
		const id = setInterval(() => {
			if (!inFlight.current) setTick((v) => v + 1);
		}, refreshMs);
		return () => clearInterval(id);
	}, [refreshMs, enabled]);
	const reload = useCallback(() => setTick((v) => v + 1), []);
	return {
		data: state.data,
		status: state.status,
		loading: state.status === "loading",
		error: state.error,
		empty: state.status === "success" && state.data.length === 0,
		updatedAt: state.updatedAt,
		reload
	};
}
var SyncContext = createContext(void 0);
var groups = /* @__PURE__ */ new Map();
function joinSync(id, fn) {
	let set = groups.get(id);
	if (!set) groups.set(id, set = /* @__PURE__ */ new Set());
	set.add(fn);
	return () => {
		set.delete(fn);
		if (!set.size) groups.delete(id);
	};
}
function sendSync(id, at, from) {
	groups.get(id)?.forEach((fn) => fn(at, from));
}
function syncIndex(keys, labels, at) {
	const i = keys.indexOf(at.key);
	if (i >= 0 || labels.length > 1e3) return i;
	return labels.indexOf(at.label);
}
function useSync(c, syncId, keys, labels) {
	const group = useContext(SyncContext);
	const id = syncId ?? group;
	const [self] = useState(() => ({}));
	const at = useRef({
		keys,
		labels
	});
	at.current = {
		keys,
		labels
	};
	c.publish.current = id ? (i) => sendSync(id, i === null || at.current.keys[i] === void 0 ? null : {
		key: at.current.keys[i],
		label: at.current.labels[i]
	}, self) : null;
	const apply = c.applySync;
	useEffect(() => {
		if (!id) return void 0;
		return joinSync(id, (p, from) => {
			if (from === self) return;
			const i = p ? syncIndex(at.current.keys, at.current.labels, p) : -1;
			apply(i < 0 ? null : i);
		});
	}, [
		id,
		self,
		apply
	]);
}
var ReplayContext = createContext(void 0);
function useReplayKey(own) {
	const ctx = useContext(ReplayContext);
	if (own !== void 0 && ctx !== void 0) return `${own}:${ctx}`;
	return own ?? ctx;
}
var CARD_TEXT = {
	en: {
		legend: "Legend",
		replay: "Replay animation",
		replayTitle: "Replay",
		sample: "Sample data",
		loadError: "Couldn't load data",
		retry: "Try again",
		loading: "Loading",
		empty: "No data to show"
	},
	ko: {
		legend: "범례",
		replay: "애니메이션 다시 재생",
		replayTitle: "다시 재생",
		sample: "예시 데이터",
		loadError: "데이터를 불러오지 못했어요",
		retry: "다시 시도",
		loading: "불러오는 중",
		empty: "표시할 데이터가 없어요"
	}
};
var useCardText = (locale) => CARD_TEXT[langOf(useChartLocale(locale))];
function Legend(props) {
	const p = useChartTheme(props.theme);
	const text = useCardText(props.locale);
	const size = props.size ?? 11.5;
	return /* @__PURE__ */ jsx("ul", {
		"aria-label": text.legend,
		style: {
			display: "flex",
			flexWrap: "wrap",
			justifyContent: props.align === "start" ? "flex-start" : "flex-end",
			gap: "4px 12px",
			margin: 0,
			padding: 0,
			listStyle: "none"
		},
		children: props.items.map((it, i) => /* @__PURE__ */ jsxs("li", {
			style: {
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				fontSize: size,
				color: p.paint("muted"),
				lineHeight: 1.3
			},
			children: [/* @__PURE__ */ jsx(LegendSwatch, {
				p,
				item: it
			}), /* @__PURE__ */ jsx("span", { children: it.label })]
		}, i))
	});
}
function LegendSwatch({ p, item }) {
	const color = item.color ? isColorToken(item.color) ? p.paint(item.color) : item.color : p.paint("neutral");
	const shape = item.shape ?? "square";
	if (shape === "line" || shape === "dash") return /* @__PURE__ */ jsxs("svg", {
		width: 14,
		height: 8,
		"aria-hidden": "true",
		style: { flex: "none" },
		children: [/* @__PURE__ */ jsx("line", {
			x1: 1,
			x2: 13,
			y1: 4,
			y2: 4,
			stroke: color,
			strokeWidth: 2,
			strokeDasharray: shape === "dash" ? "3 2" : void 0,
			strokeLinecap: "round"
		}), shape === "line" ? /* @__PURE__ */ jsx("circle", {
			cx: 7,
			cy: 4,
			r: 2.2,
			fill: color
		}) : null]
	});
	return /* @__PURE__ */ jsx("span", {
		"aria-hidden": "true",
		style: {
			width: 9,
			height: 9,
			flex: "none",
			borderRadius: shape === "circle" ? 9 : 2.5,
			background: color,
			boxShadow: item.color === "neutral" || item.color === "neutralSoft" || !item.color ? `inset 0 0 0 1px ${p.paint("line2")}` : void 0
		}
	});
}
function Badge(props) {
	const p = useChartTheme(props.theme);
	const b = levelBadge(props.level, langOf(useChartLocale(props.locale)));
	return /* @__PURE__ */ jsx("span", {
		style: {
			background: p.paint(b.bg),
			color: p.paint(b.fg),
			borderRadius: 8,
			padding: "3px 9px",
			fontSize: 12.5,
			fontWeight: 700,
			lineHeight: "18px",
			whiteSpace: "nowrap",
			flex: "none"
		},
		children: b.text
	});
}
function ChartCard(props) {
	const p = useChartTheme(props.theme);
	const text = useCardText(props.locale);
	const [replayN, setReplayN] = useState(0);
	useIsoLayoutEffect(() => ensureBaseStyles(), []);
	const replay = () => {
		setReplayN((n) => n + 1);
		props.onReplay?.();
	};
	const legend = Array.isArray(props.legend) ? /* @__PURE__ */ jsx(Legend, {
		items: props.legend,
		theme: props.theme,
		locale: props.locale
	}) : props.legend;
	const H = props.as ?? "h3";
	const num = props.number === void 0 ? null : typeof props.number === "number" ? String(props.number).padStart(2, "0") : props.number;
	const showReplay = props.replay || props.onReplay;
	return /* @__PURE__ */ jsxs("section", {
		id: props.id,
		className: `ztd-card${props.className ? ` ${props.className}` : ""}`,
		style: {
			background: p.paint("panel"),
			color: p.paint("ink"),
			border: `1px solid ${p.paint("line")}`,
			borderRadius: `var(--ztd-radius, ${p.theme.radius}px)`,
			padding: "20px 20px 16px",
			display: "flex",
			flexDirection: "column",
			gap: 12,
			minWidth: 0,
			boxSizing: "border-box",
			fontFamily: p.cssVars ? `var(--ztd-font, ${p.theme.fontFamily})` : p.theme.fontFamily,
			wordBreak: "keep-all",
			textWrap: "balance",
			...props.style
		},
		children: [
			/* @__PURE__ */ jsxs("header", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 6,
					minWidth: 0
				},
				children: [/* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: 10,
						minWidth: 0
					},
					children: [
						num ? /* @__PURE__ */ jsx("span", {
							style: {
								fontFamily: p.cssVars ? `var(--ztd-mono, ${p.theme.monoFamily})` : p.theme.monoFamily,
								fontSize: 17,
								fontWeight: 700,
								color: p.paint("accentText"),
								letterSpacing: -.2,
								flex: "none"
							},
							children: num
						}) : null,
						/* @__PURE__ */ jsx(H, {
							style: {
								margin: 0,
								fontSize: 22,
								fontWeight: 800,
								color: p.paint("ink"),
								letterSpacing: -.5,
								lineHeight: 1.25,
								minWidth: 0,
								flex: 1,
								overflow: "hidden",
								textOverflow: "ellipsis"
							},
							children: props.title
						}),
						props.actions,
						showReplay ? /* @__PURE__ */ jsx("button", {
							type: "button",
							className: "ztd-btn",
							onClick: replay,
							"aria-label": props.replayLabel ?? text.replay,
							title: props.replayLabel ?? text.replayTitle,
							style: {
								background: "transparent",
								color: p.paint("muted"),
								border: `1px solid ${p.paint("line2")}`,
								borderRadius: 14,
								width: 28,
								height: 28,
								display: "inline-grid",
								placeItems: "center",
								padding: 0,
								flex: "none"
							},
							children: /* @__PURE__ */ jsxs("svg", {
								width: "14",
								height: "14",
								viewBox: "0 0 24 24",
								"aria-hidden": "true",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "2.2",
								strokeLinecap: "round",
								strokeLinejoin: "round",
								children: [/* @__PURE__ */ jsx("path", { d: "M3 12a9 9 0 1 0 3-6.7" }), /* @__PURE__ */ jsx("path", { d: "M3 3v6h6" })]
							})
						}) : null
					]
				}), props.subtitle !== void 0 || legend ? /* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "4px 12px",
						flexWrap: "wrap",
						minHeight: 18
					},
					children: [props.subtitle !== void 0 ? /* @__PURE__ */ jsx("span", {
						style: {
							fontSize: 12.5,
							color: p.paint("muted"),
							lineHeight: 1.4
						},
						children: props.subtitle
					}) : /* @__PURE__ */ jsx("span", {}), legend]
				}) : null]
			}),
			/* @__PURE__ */ jsx("div", {
				style: {
					flex: 1,
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					minHeight: 0,
					minWidth: 0
				},
				children: /* @__PURE__ */ jsx(ReplayContext.Provider, {
					value: replayN,
					children: props.children
				})
			}),
			props.takeaway !== void 0 || props.level || props.sample ? /* @__PURE__ */ jsxs("footer", {
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 10,
					marginTop: 2
				},
				children: [/* @__PURE__ */ jsx("span", {
					style: {
						fontSize: 17,
						fontWeight: 800,
						color: p.paint("ink"),
						letterSpacing: -.3,
						lineHeight: 1.3,
						minWidth: 0
					},
					children: props.takeaway
				}), /* @__PURE__ */ jsxs("span", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						flex: "none"
					},
					children: [props.sample ? /* @__PURE__ */ jsx("span", {
						style: {
							fontSize: 11.5,
							color: p.paint("muted"),
							whiteSpace: "nowrap"
						},
						children: typeof props.sample === "string" ? props.sample : text.sample
					}) : null, props.level ? /* @__PURE__ */ jsx(Badge, {
						level: props.level,
						theme: props.theme,
						locale: props.locale
					}) : null]
				})]
			}) : null
		]
	});
}
function ChartState(props) {
	const p = useChartTheme(props.theme);
	const text = useCardText(props.locale);
	const h = props.height ?? 220;
	useIsoLayoutEffect(() => ensureBaseStyles(), []);
	if (props.error) {
		const msg = typeof props.error === "string" ? props.error : props.error.message;
		return /* @__PURE__ */ jsx("div", {
			role: "alert",
			style: {
				height: h,
				display: "grid",
				placeItems: "center",
				textAlign: "center",
				border: `1px dashed ${p.paint("line2")}`,
				borderRadius: 10
			},
			children: /* @__PURE__ */ jsxs("div", {
				style: {
					display: "grid",
					gap: 8,
					justifyItems: "center",
					padding: 16
				},
				children: [
					/* @__PURE__ */ jsx("span", {
						style: {
							fontSize: 14,
							fontWeight: 700,
							color: p.paint("ink")
						},
						children: text.loadError
					}),
					/* @__PURE__ */ jsx("span", {
						style: {
							fontSize: 12,
							color: p.paint("muted"),
							maxWidth: 280,
							wordBreak: "break-word"
						},
						children: msg
					}),
					props.onRetry ? /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "ztd-btn",
						onClick: props.onRetry,
						style: {
							marginTop: 4,
							background: p.paint("ink"),
							color: p.paint("onInk"),
							border: "none",
							borderRadius: 14,
							padding: "5px 14px",
							fontSize: 12.5,
							fontWeight: 700
						},
						children: text.retry
					}) : null
				]
			})
		});
	}
	if (props.loading) return /* @__PURE__ */ jsx("div", {
		role: "status",
		"aria-busy": "true",
		"aria-label": text.loading,
		style: {
			height: h,
			display: "flex",
			alignItems: "flex-end",
			gap: 8,
			padding: "12px 4px"
		},
		children: [
			.55,
			.8,
			.4,
			.95,
			.65,
			.75,
			.5
		].map((k, i) => /* @__PURE__ */ jsx("span", {
			className: "ztd-skeleton",
			style: {
				flex: 1,
				height: `${k * 100}%`,
				background: p.paint("lift"),
				borderRadius: 6,
				animationDelay: `${i * 90}ms`
			}
		}, i))
	});
	if (props.empty) return /* @__PURE__ */ jsx("div", {
		style: {
			height: h,
			display: "grid",
			placeItems: "center",
			border: `1px dashed ${p.paint("line2")}`,
			borderRadius: 10
		},
		children: /* @__PURE__ */ jsx("span", {
			style: {
				fontSize: 13,
				color: p.paint("muted")
			},
			children: props.emptyText ?? text.empty
		})
	});
	return /* @__PURE__ */ jsx(Fragment, { children: props.children });
}
var MAX_TABLE_ROWS = 60;
var MAX_TIP_ROWS = 8;
function capTipRows(rows, more) {
	return rows.length > MAX_TIP_ROWS ? [...rows.slice(0, MAX_TIP_ROWS), {
		label: more(rows.length - MAX_TIP_ROWS),
		value: ""
	}] : rows;
}
var SR_ONLY = {
	position: "absolute",
	width: 1,
	height: 1,
	padding: 0,
	margin: -1,
	overflow: "hidden",
	clip: "rect(0 0 0 0)",
	whiteSpace: "nowrap",
	border: 0
};
function ChartFrame(props) {
	const { c, events } = props;
	const uid = useId().replace(/:/g, "");
	const titleId = `${uid}t`;
	const descId = `${uid}d`;
	c.events.current = events;
	useIsoLayoutEffect(() => {
		ensureBaseStyles();
	}, []);
	const count = events.length;
	const nav = !props.noNav && count > 0;
	const label = props.ariaLabel ?? props.kind;
	const tableSig = useMemo(() => nav ? `${events.length}${events.slice(0, MAX_TABLE_ROWS).map((e) => `${e.label}${e.series ?? ""}${e.formatted ?? e.value ?? ""}`).join("")}` : "", [events, nav]);
	const table = useMemo(() => /* @__PURE__ */ jsx(DataTable, {
		label,
		events,
		t: c.t
	}), [
		label,
		tableSig,
		c.t
	]);
	const svgRect = useRef(null);
	useEffect(() => {
		const drop = () => {
			svgRect.current = null;
		};
		window.addEventListener("scroll", drop, {
			capture: true,
			passive: true
		});
		window.addEventListener("resize", drop, { passive: true });
		return () => {
			window.removeEventListener("scroll", drop, { capture: true });
			window.removeEventListener("resize", drop);
		};
	}, []);
	useEffect(() => {
		svgRect.current = null;
	}, [c.width, c.height]);
	const onKey = (e) => {
		if (e.target !== e.currentTarget) return;
		if (props.onKey?.(e)) {
			e.preventDefault();
			return;
		}
		const cur = c.active;
		let next;
		switch (e.key) {
			case "ArrowRight":
			case "ArrowDown":
				next = cur === null ? 0 : (cur + 1) % count;
				break;
			case "ArrowLeft":
			case "ArrowUp":
				next = cur === null ? count - 1 : (cur - 1 + count) % count;
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = count - 1;
				break;
			case "Escape":
				if (cur === null) return;
				next = null;
				break;
			case "Enter":
			case " ":
				if (cur !== null) {
					e.preventDefault();
					c.click(cur);
				}
				return;
			default: return;
		}
		e.preventDefault();
		c.setActive(next, "keyboard");
	};
	const { via, node, setActive } = c;
	useEffect(() => {
		if (via !== "touch" || !node) return void 0;
		const off = (ev) => {
			if (!node.contains(ev.target)) setActive(null);
		};
		document.addEventListener("pointerdown", off);
		return () => document.removeEventListener("pointerdown", off);
	}, [
		via,
		node,
		setActive
	]);
	const activeEvent = c.active !== null ? events[c.active] : null;
	const tip = c.showTooltip && props.renderTip !== false && !c.pending && c.via !== "sync" ? props.tip : null;
	const scale = tip && !c.responsive && c.node && c.width ? c.node.getBoundingClientRect().width / c.width || 1 : 1;
	const custom = typeof props.renderTip === "function" && activeEvent ? props.renderTip(activeEvent) : null;
	const live = props.announce ?? (c.via === "keyboard" && activeEvent ? `${activeEvent.label}${activeEvent.series ? ` ${activeEvent.series}` : ""}: ${activeEvent.formatted ?? activeEvent.value ?? ""} (${(c.active ?? 0) + 1}/${count})` : "");
	let tipStyle;
	if (tip) {
		const px = tip.x * scale;
		const boxW = c.width * scale;
		const shiftX = `clamp(${(4 - px).toFixed(1)}px, -50%, calc(${(boxW - px - 4).toFixed(1)}px - 100%))`;
		const below = tip.y < 64;
		tipStyle = {
			position: "absolute",
			left: px,
			top: tip.y * scale,
			transform: `translate(${shiftX}, ${below ? "16px" : "calc(-100% - 14px)"})`,
			background: c.p.paint("panel"),
			color: c.p.paint("ink"),
			border: `1px solid ${c.p.paint("line")}`,
			borderRadius: 12,
			padding: "8px 11px",
			pointerEvents: "none",
			whiteSpace: "nowrap",
			fontSize: 12,
			lineHeight: "18px",
			zIndex: 5,
			boxShadow: "0 10px 28px -8px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.08)",
			fontVariantNumeric: "tabular-nums",
			minWidth: 112,
			maxWidth: Math.max(160, c.width * scale - 8)
		};
	}
	const onLeave = (e) => {
		svgRect.current = null;
		if (e.pointerType === "touch") return;
		if (c.via !== "keyboard") c.setActive(null);
	};
	const inSvg = (fn) => fn ? (e) => {
		const r = e.currentTarget.getBoundingClientRect();
		if (!r.width) return;
		fn((e.clientX - r.left) / r.width * c.width, (e.clientY - r.top) / r.height * c.height, e);
	} : void 0;
	const onMove = inSvg(props.onPointerMove);
	const onDownProp = inSvg(props.onPointerDown);
	const onDown = onMove || onDownProp ? (e) => {
		if (e.pointerType === "touch") onMove?.(e);
		onDownProp?.(e);
	} : void 0;
	const onUp = inSvg(props.onPointerUp);
	const vars = overrideVars(props.theme);
	return /* @__PURE__ */ jsxs("div", {
		ref: c.ref,
		className: `ztd-root${c.reduced ? " ztd-still" : ""}${props.className ? ` ${props.className}` : ""}`,
		role: "group",
		"aria-roledescription": c.t.chart,
		"aria-label": label,
		"aria-describedby": descId,
		tabIndex: nav ? 0 : void 0,
		onKeyDown: nav ? onKey : void 0,
		onBlur: (e) => {
			if (c.via === "keyboard" && !e.currentTarget.contains(e.relatedTarget)) c.setActive(null);
		},
		onPointerLeave: onLeave,
		style: {
			width: "100%",
			maxWidth: c.measured ? void 0 : "100%",
			fontFamily: c.p.cssVars ? `var(--ztd-font, ${c.p.theme.fontFamily})` : c.p.theme.fontFamily,
			color: c.p.paint("ink"),
			...vars,
			...props.style
		},
		children: [
			c.pending ? null : props.underlay,
			/* @__PURE__ */ jsxs("svg", {
				className: "ztd-svg",
				role: "img",
				"aria-labelledby": `${titleId} ${descId}`,
				viewBox: `0 0 ${Math.max(1, Math.round(c.width * 10) / 10)} ${Math.max(1, Math.round(c.height * 10) / 10)}`,
				width: "100%",
				preserveAspectRatio: "xMidYMid meet",
				onPointerMove: onMove,
				onPointerDown: onDown,
				onPointerUp: onUp,
				onPointerCancel: onUp,
				style: {
					fontFamily: "inherit",
					touchAction: "pan-y",
					position: props.underlay ? "relative" : void 0
				},
				children: [
					/* @__PURE__ */ jsx("title", {
						id: titleId,
						children: label
					}),
					/* @__PURE__ */ jsx("desc", {
						id: descId,
						children: count || c.description !== void 0 ? props.description : c.t.empty
					}),
					props.defs && !c.pending ? /* @__PURE__ */ jsx("defs", { children: props.defs }) : null,
					c.pending ? null : props.children
				]
			}),
			c.pending ? null : props.overlay,
			tip ? /* @__PURE__ */ jsx("div", {
				className: "ztd-tip",
				"aria-hidden": "true",
				style: tipStyle,
				children: custom ?? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
					style: {
						fontWeight: 600,
						fontSize: 11.5,
						color: c.p.paint("muted"),
						marginBottom: tip.rows.length ? 4 : 0,
						overflow: "hidden",
						textOverflow: "ellipsis"
					},
					children: tip.title
				}), tip.rows.map((r, i) => /* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: 16,
						justifyContent: "space-between"
					},
					children: [/* @__PURE__ */ jsxs("span", {
						style: {
							display: "inline-flex",
							alignItems: "center",
							gap: 7,
							color: c.p.paint(r.strong ? "ink" : "muted")
						},
						children: [r.color ? /* @__PURE__ */ jsx("span", { style: {
							width: 8,
							height: 8,
							borderRadius: 999,
							background: r.color,
							display: "inline-block",
							boxShadow: "inset 0 0 0 1px rgba(127,127,127,0.3)"
						} }) : null, r.label]
					}), /* @__PURE__ */ jsx("span", {
						style: { fontWeight: r.strong === false ? 500 : 700 },
						children: r.value
					})]
				}, i))] })
			}) : null,
			/* @__PURE__ */ jsx("span", {
				className: "ztd-sr",
				style: SR_ONLY,
				"aria-live": "polite",
				"aria-atomic": "true",
				children: live
			}),
			nav && !c.pending ? table : null
		]
	});
}
function DataTable({ label, events, t }) {
	return /* @__PURE__ */ jsx("div", {
		className: "ztd-sr",
		style: SR_ONLY,
		children: /* @__PURE__ */ jsxs("table", { children: [/* @__PURE__ */ jsx("caption", { children: t.table(label) }), /* @__PURE__ */ jsxs("tbody", { children: [events.slice(0, MAX_TABLE_ROWS).map((e, i) => /* @__PURE__ */ jsxs("tr", { children: [/* @__PURE__ */ jsx("th", {
			scope: "row",
			children: e.series ? `${e.label} · ${e.series}` : e.label
		}), /* @__PURE__ */ jsx("td", { children: e.formatted ?? e.value ?? "" })] }, i)), events.length > MAX_TABLE_ROWS ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
			colSpan: 2,
			children: t.more(events.length - MAX_TABLE_ROWS)
		}) }) : null] })] })
	});
}
function Txt(props) {
	const b = props.baseline ?? "central";
	return /* @__PURE__ */ jsx("text", {
		x: Math.round(props.x * 10) / 10,
		y: Math.round(props.y * 10) / 10,
		dy: b === "central" ? "0.35em" : b === "hanging" ? "0.75em" : void 0,
		fontSize: props.size ?? 11,
		fill: props.fill ?? "currentColor",
		textAnchor: props.anchor ?? "start",
		fontWeight: props.weight ?? 400,
		opacity: props.opacity === void 0 || props.opacity >= 1 ? void 0 : Math.max(0, props.opacity),
		className: props.className,
		letterSpacing: props.letterSpacing,
		style: {
			pointerEvents: "none",
			fontVariantNumeric: "tabular-nums"
		},
		children: props.children
	});
}
function compositeHex(top, under, opacity) {
	const a = parseColor(top);
	const b = parseColor(under);
	if (!a || !b) return top;
	return toHex(composite([
		a[0],
		a[1],
		a[2],
		opacity
	], b));
}
function swatch(p, role) {
	const t = p.theme;
	switch (role) {
		case "accent": return {
			role,
			fill: p.paint("accent"),
			text: p.paint("onAccent"),
			raw: t.accent
		};
		case "ink": return {
			role,
			fill: p.paint("ink"),
			text: p.paint("onInk"),
			raw: t.ink
		};
		case "strong": return {
			role,
			fill: p.paint("neutralStrong"),
			text: p.paint("onNeutralStrong"),
			raw: t.neutralStrong
		};
		case "soft": return {
			role,
			fill: p.paint("neutralSoft"),
			text: p.paint("ink"),
			raw: t.neutralSoft
		};
		default: return {
			role: "neutral",
			fill: p.paint("neutral"),
			text: p.paint("ink"),
			raw: t.neutral
		};
	}
}
function readableOn(p, raw) {
	const best = pickText(raw, [
		p.theme.ink,
		p.theme.onAccent,
		p.theme.onNeutralStrong
	]);
	if (contrastRatio(best, raw) >= 4.5) return best === p.theme.ink ? p.paint("ink") : best === p.theme.onAccent ? p.paint("onAccent") : p.paint("onNeutralStrong");
	return pickText(raw, ["#FFFFFF", "#000000"]);
}
var ROLE_TOKEN = {
	accent: "accent",
	ink: "ink",
	strong: "neutralStrong",
	neutral: "neutral",
	soft: "neutralSoft"
};
function canvasColor(sw, read) {
	return sw.role === "mix" ? sw.raw : read(cssVarName(ROLE_TOKEN[sw.role]), sw.raw);
}
function midSwatch(p, k) {
	const raw = mixHex(p.theme.neutralStrong, p.theme.neutral, k);
	return {
		role: "mix",
		fill: p.mix("neutralStrong", "neutral", k),
		text: readableOn(p, raw),
		raw
	};
}
function categorical(p, n, hi) {
	const out = new Array(n);
	const rest = [];
	for (let i = 0; i < n; i++) if (hi.has(i)) out[i] = swatch(p, "accent");
	else rest.push(i);
	const k = rest.length;
	rest.forEach((idx, j) => {
		if (k === 1) out[idx] = swatch(p, "neutral");
		else if (j === 0) out[idx] = swatch(p, "ink");
		else if (j === k - 1) out[idx] = swatch(p, "neutral");
		else if (k === 3) out[idx] = swatch(p, "strong");
		else {
			const t = (j - 1) / Math.max(1, k - 2);
			out[idx] = t <= .001 ? swatch(p, "strong") : midSwatch(p, 1 - t);
		}
	});
	return out;
}
function categoricalTokens(n, hi) {
	const out = new Array(n);
	const rest = [];
	for (let i = 0; i < n; i++) if (hi.has(i)) out[i] = "accent";
	else rest.push(i);
	const k = rest.length;
	rest.forEach((idx, j) => {
		if (k === 1) out[idx] = "neutral";
		else if (j === 0) out[idx] = "ink";
		else if (j === k - 1) out[idx] = "neutral";
		else out[idx] = "neutralStrong";
	});
	return out;
}
function categoricalDots(p, n, hi) {
	return categorical(p, n + 1, hi).slice(0, n);
}
function categoricalDotTokens(n, hi) {
	return categoricalTokens(n + 1, hi).slice(0, n);
}
function emphasis(p, n, hi, rest = "neutral") {
	const a = swatch(p, "accent");
	const r = swatch(p, rest);
	return Array.from({ length: n }, (_, i) => hi.has(i) ? a : r);
}
function ramp(p, n, hi) {
	const out = new Array(n);
	const rest = [];
	for (let i = 0; i < n; i++) if (hi.has(i)) out[i] = swatch(p, "accent");
	else rest.push(i);
	const k = rest.length;
	rest.forEach((idx, j) => {
		if (k === 1) out[idx] = swatch(p, "neutral");
		else if (j === 0) out[idx] = swatch(p, "strong");
		else if (j === k - 1) out[idx] = swatch(p, "neutral");
		else out[idx] = midSwatch(p, 1 - j / (k - 1));
	});
	return out;
}
function sequential(p, t, min = .1) {
	const k = Math.max(0, Math.min(1, t));
	const opacity = min + (1 - min) * k;
	const raw = compositeHex(p.theme.accent, p.theme.panel, opacity);
	return {
		fill: p.paint("accent"),
		opacity,
		text: readableOn(p, raw),
		raw
	};
}
function niceStep(span2, count) {
	if (!(span2 > 0) || !Number.isFinite(span2)) return 1;
	const raw = span2 / Math.max(1, count);
	const p = Math.pow(10, Math.floor(Math.log10(raw)));
	const m = raw / p;
	return (m >= 7.071 ? 10 : m >= 3.162 ? 5 : m >= 1.414 ? 2 : 1) * p;
}
function fitDomain(min, max, count = 4, opts = {}) {
	let lo = min;
	let hi = max;
	if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
	if (opts.zero !== false) {
		if (lo > 0) lo = 0;
		if (hi < 0) hi = 0;
	}
	if (lo === hi) return lo === 0 ? [0, 1] : lo > 0 ? [0, lo * 1.2] : [lo * 1.2, 0];
	const span2 = hi - lo;
	const pad = opts.pad ?? .07;
	let step = niceStep(span2, count);
	let d = [lo, hi];
	for (let k = 0; k < 4; k++) {
		const nHi = Math.ceil(hi / step - 1e-9) * step;
		const nLo = Math.floor(lo / step + 1e-9) * step;
		d = [lo === 0 ? 0 : lo - nLo <= step * .3 ? nLo : lo - span2 * pad, hi === 0 ? 0 : nHi - hi <= step * .3 ? nHi : hi + span2 * pad];
		const s = niceStep(d[1] - d[0], count);
		if (s === step) break;
		step = s;
	}
	return d;
}
function niceDomain(min, max, count = 4, opts = {}) {
	let lo = min;
	let hi = max;
	if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
	if (opts.zero !== false) {
		if (lo > 0) lo = 0;
		if (hi < 0) hi = 0;
	}
	if (lo === hi) return lo === 0 ? [0, 1] : lo > 0 ? [0, lo * 1.25] : [lo * 1.25, 0];
	const s = niceStep(hi - lo, count);
	return [Math.floor(lo / s + 1e-9) * s, Math.ceil(hi / s - 1e-9) * s];
}
function ticksFor(d0, d1, count = 4) {
	const lo = Math.min(d0, d1);
	const hi = Math.max(d0, d1);
	const s = niceStep(hi - lo, count);
	const out = [];
	const start = Math.ceil(lo / s - 1e-9) * s;
	for (let v = start, i = 0; v <= hi + s * 1e-9 && i < 200; v += s, i++) out.push(Number((Math.round(v / s) * s).toPrecision(12)));
	return out;
}
function scaleLinear(domain, range) {
	const [d0, d1] = domain;
	const [r0, r13] = range;
	const k = d1 === d0 ? 0 : (r13 - r0) / (d1 - d0);
	const f = ((v) => r0 + (v - d0) * k);
	f.domain = domain;
	f.range = range;
	f.invert = (px) => k === 0 ? d0 : d0 + (px - r0) / k;
	f.ticks = (count = 4) => ticksFor(d0, d1, count);
	return f;
}
function scaleSqrt(domain, range) {
	const [d0, d1] = domain;
	const [r0, r13] = range;
	const s0 = Math.sqrt(Math.max(0, d0));
	const s1 = Math.sqrt(Math.max(0, d1));
	return (v) => s1 === s0 ? r13 : r0 + (Math.sqrt(Math.max(0, v)) - s0) / (s1 - s0) * (r13 - r0);
}
function scaleBand(domain, range, padding = .2, outer = padding / 2) {
	const n = domain.length;
	const [r0, r13] = range;
	const span2 = r13 - r0;
	const step = n ? span2 / Math.max(1, n - padding + outer * 2) : span2;
	const bw = step * (1 - padding);
	const start = r0 + step * outer;
	const idx = new Map(domain.map((k, i) => [k, i]));
	const f = ((key) => start + (idx.get(key) ?? 0) * step);
	f.bandwidth = Math.max(0, bw);
	f.step = step;
	f.domain = domain;
	f.index = (k) => idx.get(k) ?? -1;
	return f;
}
function extent(xs) {
	let lo = Infinity;
	let hi = -Infinity;
	for (const x of xs) {
		if (!Number.isFinite(x)) continue;
		if (x < lo) lo = x;
		if (x > hi) hi = x;
	}
	return lo === Infinity ? [0, 1] : [lo, hi];
}
function robustMax(values) {
	const v = [];
	for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) v.push(values[i]);
	if (!v.length) return 1;
	v.sort((a, b) => a - b);
	if (v.length < 24) return v[v.length - 1];
	return v[Math.min(v.length - 1, Math.floor(v.length * .95))] || v[v.length - 1];
}
var DAY = 864e5;
function timeTicks(t0, t1, maxTicks, locale = DEFAULT_LOCALE) {
	const span2 = t1 - t0;
	if (!(span2 > 0)) return [{
		t: t0,
		label: formatDate(t0, {
			locale,
			month: "short",
			day: "numeric"
		})
	}];
	const days = span2 / DAY;
	const out = [];
	const d0 = new Date(t0);
	const sameYear = new Date(t0).getFullYear() === new Date(t1).getFullYear();
	const pushRange = (start, inc, fmt, yearOnChange = false) => {
		const d = new Date(start);
		let lastYear = -1;
		let guard = 0;
		while (d.getTime() <= t1 && guard++ < 500) {
			if (d.getTime() >= t0) {
				const y = d.getFullYear();
				const showYear = yearOnChange && !sameYear && y !== lastYear;
				out.push({
					t: d.getTime(),
					label: formatDate(d, {
						locale,
						...fmt,
						...showYear ? { year: "numeric" } : {}
					})
				});
				lastYear = y;
			}
			inc(d);
		}
	};
	if (days <= 1.5) {
		const hours = Math.max(1, Math.ceil(span2 / 36e5 / Math.max(1, maxTicks)));
		const step = [
			1,
			2,
			3,
			4,
			6,
			12
		].find((h) => h >= hours) ?? 12;
		const s = new Date(d0);
		s.setMinutes(0, 0, 0);
		pushRange(s, (d) => d.setHours(d.getHours() + step), { hour: "numeric" });
	} else if (days <= maxTicks * 1.2) pushRange(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()), (d) => d.setDate(d.getDate() + 1), {
		month: "numeric",
		day: "numeric"
	});
	else if (days <= maxTicks * 7 * 1.2) {
		const s = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
		s.setDate(s.getDate() + (8 - s.getDay()) % 7);
		pushRange(s, (d) => d.setDate(d.getDate() + 7), {
			month: "numeric",
			day: "numeric"
		});
	} else {
		const months = days / 30.44;
		const per = Math.max(1, Math.ceil(months / Math.max(1, maxTicks)));
		const step = [
			1,
			2,
			3,
			6,
			12,
			24,
			60
		].find((m) => m >= per) ?? 120;
		if (step >= 12) pushRange(new Date(d0.getFullYear() + (d0.getMonth() > 0 || d0.getDate() > 1 ? 1 : 0), 0, 1), (d) => d.setFullYear(d.getFullYear() + step / 12), { year: "numeric" });
		else {
			const s = new Date(d0.getFullYear(), d0.getMonth() + (d0.getDate() > 1 ? 1 : 0), 1);
			const m0 = s.getMonth() % step;
			if (m0) s.setMonth(s.getMonth() + (step - m0));
			pushRange(s, (d) => d.setMonth(d.getMonth() + step), { month: "short" }, true);
		}
	}
	return out;
}
function lazyArray(n, make) {
	const cache2 = new Array(n);
	const has = new Uint8Array(n);
	const index = (prop) => {
		if (typeof prop !== "string" || prop.length === 0 || prop.length > 9) return -1;
		const i = Number(prop);
		return Number.isInteger(i) && i >= 0 && i < n && String(i) === prop ? i : -1;
	};
	return new Proxy(cache2, {
		get(target, prop, recv) {
			const i = index(prop);
			if (i >= 0) {
				if (!has[i]) {
					target[i] = make(i);
					has[i] = 1;
				}
				return target[i];
			}
			return Reflect.get(target, prop, recv);
		},
		has(target, prop) {
			return index(prop) >= 0 || Reflect.has(target, prop);
		}
	});
}
var xNum = (type, v) => type === "date" ? toDate(v)?.getTime() ?? NaN : toNumber(v);
var DATE_RE = /^\d{4}-\d{1,2}(-\d{1,2})?([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
function syncKeyOf(raw) {
	if (!DATE_RE.test(raw.trim())) return raw;
	const t = toDate(raw)?.getTime();
	return t === void 0 || !Number.isFinite(t) ? raw : String(t);
}
function detectXType(raw) {
	const vals = raw.filter((v) => v !== null && v !== void 0 && v !== "");
	if (!vals.length) return "band";
	if (vals.every((v) => v instanceof Date)) return "date";
	if (vals.every((v) => typeof v === "string" && DATE_RE.test(v.trim()))) return "date";
	if (vals.every((v) => typeof v === "number" || typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()))) return "number";
	return "band";
}
function prepSeries(data, x, y, series, opts = {}) {
	const getX = getter(x, "x");
	const wide = Array.isArray(y);
	const yKeys = wide ? y : null;
	const getY = wide ? null : getter(y, "y");
	const getS = !wide && series !== void 0 ? getter(series, "series") : null;
	const rawX = data.map((d, i) => getX(d, i));
	const type = opts.xType ?? detectXType(rawX);
	const locale = opts.locale ?? "en-US";
	let keys;
	let xnum;
	let rowKey;
	if (type === "band") {
		const strs = rawX.map((v) => String(v ?? ""));
		keys = uniq(strs);
		const kIndex = new Map(keys.map((k, i) => [k, i]));
		xnum = keys.map((_, i) => i);
		rowKey = Int32Array.from(strs, (k) => kIndex.get(k) ?? -1);
	} else {
		const nums = rawX.map((v) => xNum(type, v));
		const uniqNums = Array.from(new Set(nums.filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);
		const kIndex = new Map(uniqNums.map((n, i) => [n, i]));
		xnum = uniqNums;
		keys = uniqNums.map(String);
		rowKey = Int32Array.from(nums, (n) => kIndex.get(n) ?? -1);
	}
	let dfmt = opts.dateFormat;
	if (type === "date" && !dfmt) {
		const span2 = xnum.length > 1 ? xnum[xnum.length - 1] - xnum[0] : 0;
		dfmt = rawX.length < 5e3 && rawX.every((v) => typeof v === "string" && /^\d{4}-\d{1,2}$/.test(v.trim())) || span2 > 10368e6 ? { month: "short" } : span2 < 1728e5 ? {
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit"
		} : {
			month: "numeric",
			day: "numeric"
		};
		if (span2 > 6912e7) dfmt = {
			year: "numeric",
			month: "short"
		};
	}
	let labels;
	if (type === "band") labels = keys;
	else {
		const year = xnum.every(isYear);
		const fmt = type === "date" ? new Intl.DateTimeFormat(locale, dfmt) : new Intl.NumberFormat(locale, year ? { useGrouping: false } : { maximumFractionDigits: 6 });
		labels = xnum.length > 1e3 ? lazyArray(xnum.length, (i) => fmt.format(xnum[i])) : xnum.map((n) => fmt.format(n));
	}
	const seriesNames = yKeys ? [...yKeys] : getS ? uniq(data.map((d, i) => String(getS(d, i) ?? ""))) : [""];
	const sIndex = new Map(seriesNames.map((s, i) => [s, i]));
	const values = seriesNames.map(() => new Array(keys.length).fill(NaN));
	const rows = seriesNames.map(() => new Array(keys.length).fill(null));
	const add = (s, k, v, d) => {
		const prev = values[s][k];
		values[s][k] = Number.isFinite(prev) && opts.sum !== false ? prev + (Number.isFinite(v) ? v : 0) : v;
		rows[s][k] = d;
	};
	for (let i = 0; i < data.length; i++) {
		const k = rowKey[i];
		if (k < 0) continue;
		const d = data[i];
		if (yKeys) for (let s = 0; s < yKeys.length; s++) add(s, k, toNumber(d[yKeys[s]]), d);
		else add(getS ? sIndex.get(String(getS(d, i) ?? "")) ?? 0 : 0, k, toNumber(getY(d, i)), d);
	}
	return {
		type,
		keys,
		xnum,
		labels,
		series: seriesNames,
		values,
		rows
	};
}
function bucketSeries(m, maxPoints) {
	const n = m.keys.length;
	if (n <= maxPoints || maxPoints < 2) return m;
	const size = n / maxPoints;
	const pick = [];
	const ranges = [];
	for (let b = 0; b < maxPoints; b++) {
		const a = Math.floor(b * size);
		const e = Math.min(n, Math.floor((b + 1) * size));
		if (e <= a) continue;
		ranges.push([a, e]);
		pick.push(b === 0 ? 0 : b === maxPoints - 1 ? n - 1 : Math.floor((a + e - 1) / 2));
	}
	const values = m.values.map((row) => ranges.map(([a, e]) => {
		let s = 0;
		let c = 0;
		for (let k = a; k < e; k++) if (Number.isFinite(row[k])) {
			s += row[k];
			c++;
		}
		return c ? s / c : NaN;
	}));
	return {
		type: m.type,
		keys: pick.map((k) => m.keys[k]),
		xnum: m.type === "band" ? pick.map((_, i) => i) : pick.map((k) => m.xnum[k]),
		labels: lazyArray(pick.length, (i) => m.labels[pick[i]]),
		series: m.series,
		values,
		rows: m.rows.map((r) => pick.map((k) => r[k])),
		rowValues: m.values.map((r) => pick.map((k) => r[k]))
	};
}
function useChart(props, defaults) {
	const p = useChartTheme(props.theme);
	const [node, ref, measuredW] = useMeasuredNode(props.width);
	const hydrated = useHydrated();
	const width = props.width ?? (measuredW || defaults.ssrWidth || 480);
	const h = typeof defaults.height === "function" ? defaults.height(width) : defaults.height;
	const height = props.height ?? h;
	const reduced = useReducedMotion(props.reducedMotion ?? "auto");
	const enabled = props.animate !== false && !reduced && isBrowser;
	const view = useViewport(node, props.animateOnView !== false && enabled);
	const locale = useChartLocale(props.locale);
	const lang = langOf(locale);
	const fmt = useMemo(() => makeFormatter(props.format, locale, defaults.format), [
		props.format,
		locale,
		defaults.format
	]);
	const pct = useCallback((v) => formatPercent(v, { locale }), [locale]);
	const fv = useMemo(() => withUnit(fmt, props.unit), [fmt, props.unit]);
	const sig = useMemo(() => dataSignature(props.data), [props.data]);
	const [active, setActiveState] = useState(null);
	const [via, setVia] = useState(null);
	const events = useRef([]);
	const onHover = useRef(props.onHover);
	onHover.current = props.onHover;
	const onClick = useRef(props.onClick);
	onClick.current = props.onClick;
	const viaRef = useRef(null);
	const publish = useRef(null);
	const last = useRef(null);
	const setActive = useCallback((i, how = "pointer") => {
		if (last.current !== i) {
			last.current = i;
			const e = i === null ? null : events.current[i] ?? null;
			queueMicrotask(() => onHover.current?.(e));
			publish.current?.(i);
		}
		viaRef.current = i === null ? null : how;
		setActiveState(i);
		setVia(viaRef.current);
	}, []);
	const applySync = useCallback((i) => {
		if (viaRef.current === "keyboard") return;
		viaRef.current = i === null ? null : "sync";
		setActiveState(i);
		setVia(viaRef.current);
	}, []);
	const click = useCallback((i) => {
		const e = events.current[i];
		if (e) onClick.current?.(e);
	}, []);
	const replayKey = useReplayKey(props.replayKey);
	const measured = props.width !== void 0 || (measuredW ?? 0) > 0;
	const motion = {
		enabled,
		active: view.visible && measured,
		near: view.near,
		replayKey,
		dataKey: sig,
		easing: props.easing ?? "spring",
		duration: props.duration ?? defaults.duration ?? 900,
		stagger: props.stagger ?? defaults.stagger ?? 0
	};
	const dim = useCallback((i, base = 1) => active === null || active === i ? base : base * .38, [active]);
	return {
		p,
		width,
		height,
		measured,
		responsive: props.width === void 0,
		pending: isBrowser && hydrated && props.width === void 0 && measuredW === null,
		node,
		hydrated,
		ref,
		motion,
		fv,
		fmt,
		pct,
		locale,
		lang,
		t: lang === "ko" ? ko : en,
		active,
		via,
		setActive,
		click,
		events,
		showTooltip: props.tooltip !== false,
		showLabels: props.showLabels !== false,
		dim,
		sig,
		description: props.description,
		reduced,
		publish,
		applySync
	};
}
function uniqueMarkKeys(marks) {
	const seen = /* @__PURE__ */ new Map();
	let dup = false;
	for (const m of marks) {
		const n = (seen.get(m.key) ?? 0) + 1;
		seen.set(m.key, n);
		if (n > 1) dup = true;
	}
	if (!dup) return marks;
	seen.clear();
	return marks.map((m) => {
		const n = (seen.get(m.key) ?? 0) + 1;
		seen.set(m.key, n);
		return n > 1 ? {
			...m,
			key: `${m.key}#${n}`
		} : m;
	});
}
function useMotion(input, opts) {
	const marks = useMemo(() => uniqueMarkKeys(input), [input]);
	const { enabled, active, near = true, replayKey, dataKey, easing = "spring", duration = 900, stagger = 0 } = opts;
	const engineRef = useRef(null);
	const phase = useRef("init");
	const lastMarks = useRef(null);
	const lastData = useRef(dataKey);
	const lastReplay = useRef(replayKey);
	const pendingReplay = useRef(false);
	const generation = useRef(0);
	const [, setFrame] = useState(0);
	const unsub = useRef(null);
	const alive = useRef(true);
	if (!engineRef.current) {
		engineRef.current = new MotionEngine();
		engineRef.current.configure(easing, duration);
		engineRef.current.snap(marks);
		lastMarks.current = marks;
	}
	const engine = engineRef.current;
	engine.configure(easing, duration);
	if (lastMarks.current !== marks) {
		const p = phase.current;
		const dataChanged = !Object.is(lastData.current, dataKey);
		if (!engine.sameTargets(marks)) {
			if (!enabled || p === "init") engine.snap(marks);
			else if (p === "idle") engine.hold(marks);
			else if (p === "running" || dataChanged) engine.update(marks, now(), stagger);
			else engine.snap(marks);
		} else engine.refreshData(marks);
		lastMarks.current = marks;
		lastData.current = dataKey;
	}
	const tick = useRef(() => false);
	tick.current = (t2) => {
		if (!alive.current) return false;
		const moving = engine.step(t2);
		if (!moving && phase.current === "running") phase.current = "done";
		setFrame((f) => (f + 1) % 1e9);
		if (!moving) unsub.current = null;
		return moving;
	};
	const ensureTicking = useCallback(() => {
		if (!isBrowser || unsub.current || !engine.animating) return;
		const fn = (t2) => tick.current(t2);
		unsub.current = subscribeTick(fn);
	}, [engine]);
	useIsoLayoutEffect(() => {
		const replayChanged = !Object.is(lastReplay.current, replayKey);
		lastReplay.current = replayKey;
		if (!enabled) {
			if (phase.current !== "done" || engine.animating) {
				engine.snap(lastMarks.current ?? marks);
				phase.current = "done";
				setFrame((f) => f + 1);
			}
			return;
		}
		if (phase.current === "init" || replayChanged && near) {
			engine.hold(lastMarks.current ?? marks);
			phase.current = "idle";
			pendingReplay.current = false;
			setFrame((f) => f + 1);
		} else if (replayChanged) pendingReplay.current = true;
	}, [enabled, replayKey]);
	useIsoLayoutEffect(() => {
		if (!enabled || !near || !pendingReplay.current) return;
		pendingReplay.current = false;
		engine.hold(lastMarks.current ?? marks);
		phase.current = "idle";
		setFrame((f) => f + 1);
	}, [near, enabled]);
	useEffect(() => {
		if (enabled && active && phase.current === "idle") {
			engine.start(now());
			generation.current += 1;
			phase.current = "running";
			ensureTicking();
			setFrame((f) => f + 1);
		}
	}, [
		enabled,
		active,
		replayKey,
		engine,
		ensureTicking
	]);
	useEffect(() => {
		if (engine.animating) ensureTicking();
	});
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
			unsub.current?.();
			unsub.current = null;
		};
	}, []);
	const t = now();
	const elapsed = engine.elapsed(t);
	const waiting = enabled && phase.current === "idle";
	return {
		items: engine.items(),
		get: (key) => engine.get(key),
		elapsed: waiting ? 0 : elapsed,
		fade: (delay, len = 320) => {
			if (waiting) return 0;
			if (!Number.isFinite(elapsed)) return 1;
			return Math.max(0, Math.min(1, (elapsed - delay) / len));
		},
		waiting,
		animating: engine.animating,
		generation: generation.current
	};
}
var MSG = {
	en: {
		kind: "Sparkline",
		desc: (n, lo, hi, last) => `${plural(n, "point")}, low ${lo}, high ${hi}, last ${last}`
	},
	ko: {
		kind: "스파크라인",
		desc: (n, lo, hi, last) => `${n}개 지점, 최저 ${lo}, 최고 ${hi}, 마지막 ${last}`
	}
};
function Sparkline(props) {
	const c = useChart(props, {
		height: 48,
		duration: 900
	});
	const { p, width: W, height: H } = c;
	const gid = useId().replace(/:/g, "");
	const model = useMemo(() => prepSeries(props.data, props.x, props.y, void 0, { locale: c.locale }), [
		props.data,
		props.x,
		props.y,
		c.locale
	]);
	const vals = useMemo(() => model.values[0] ?? [], [model]);
	const variant = props.variant ?? "area";
	let li = vals.length - 1;
	while (li >= 0 && !Number.isFinite(vals[li])) li--;
	const last = li < 0 ? NaN : vals[li];
	const valText = Number.isFinite(last) ? c.fv(last) : "";
	const valW = props.showValue !== false && valText ? textWidth(valText, 13, 800) + 10 : 0;
	const x0 = 2;
	const x1 = W - valW - 4;
	const [mn, mx] = extent(vals);
	const y = scaleLinear(variant === "bar" ? [Math.min(0, mn), Math.max(0, mx) || (mn < 0 ? 0 : 1)] : [mn, mx === mn ? mn + 1 : mx], [H - 4, 5]);
	const n = vals.length;
	const xs = (k) => n > 1 ? x0 + k / (n - 1) * (x1 - x0) : (x0 + x1) / 2;
	const kMark = props.mark === "none" ? -1 : props.mark === "max" ? argMax(vals) : props.mark === "min" ? argMin(vals) : li;
	const per = variant === "bar" ? Math.max(1, Math.ceil(n / Math.max(1, (x1 - x0) / 2))) : 1;
	const pts2 = useMemo(() => {
		let idx = vals.map((v, k) => Number.isFinite(v) ? k : -1).filter((k) => k >= 0);
		const limit = Math.max(40, Math.round((x1 - x0) * 1.5));
		if (idx.length > limit && variant !== "bar") idx = lttb(idx.map((k) => ({
			x: k,
			y: vals[k],
			k
		})), limit).map((q) => q.k);
		if (per > 1) {
			const out = [];
			let b = -1;
			let g = -1;
			for (const k of idx) {
				const gk = Math.floor(k / per);
				if (gk !== g) {
					if (b >= 0) out.push(b);
					g = gk;
					b = k;
				} else if (k === kMark || b !== kMark && Math.abs(vals[k]) > Math.abs(vals[b])) b = k;
			}
			if (b >= 0) out.push(b);
			idx = out;
		}
		return idx;
	}, [
		vals,
		x1,
		x0,
		variant,
		per,
		kMark
	]);
	const m = useMotion(useMemo(() => [{
		key: "__d",
		to: [1],
		from: [0],
		data: null
	}], []), c.motion);
	const t = m.get("__d")?.[0] ?? 1;
	const accent = swatch(p, "accent");
	const fv = c.fv;
	const events = useMemo(() => !vals.some(Number.isFinite) ? [] : lazyArray(model.keys.length, (k) => ({
		datum: model.rows[0][k],
		index: k,
		key: model.keys[k],
		label: model.labels[k],
		value: Number.isFinite(vals[k]) ? vals[k] : null,
		formatted: Number.isFinite(vals[k]) ? fv(vals[k]) : "-"
	})), [
		model,
		vals,
		fv
	]);
	let tip = null;
	if (c.active !== null && Number.isFinite(vals[c.active])) tip = {
		x: xs(c.active),
		y: y(vals[c.active]),
		title: model.labels[c.active],
		rows: [{ value: c.fv(vals[c.active]) }]
	};
	const line = pts2.map((k) => [xs(k), y(vals[k])]);
	const msg = MSG[c.lang];
	const desc = props.description ?? `${msg.kind}. ${msg.desc(n, c.fv(mn), c.fv(mx), valText)}.`;
	const clipW = x0 + (x1 - x0 + 8) * t;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, _py, e) => n && c.setActive(evenIndex(px, x0, x1, n), e.pointerType === "touch" ? "touch" : "pointer"),
		defs: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("clipPath", {
			id: `${gid}c`,
			children: /* @__PURE__ */ jsx("rect", {
				x: -2,
				y: -2,
				width: Math.max(0, clipW + 2),
				height: H + 4
			})
		}), /* @__PURE__ */ jsxs("linearGradient", {
			id: `${gid}g`,
			x1: "0",
			x2: "0",
			y1: "0",
			y2: "1",
			children: [/* @__PURE__ */ jsx("stop", {
				offset: "0%",
				stopColor: p.paint("accent"),
				stopOpacity: .3
			}), /* @__PURE__ */ jsx("stop", {
				offset: "100%",
				stopColor: p.paint("accent"),
				stopOpacity: 0
			})]
		})] }),
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: x0,
				y: 0,
				width: Math.max(0, x1 - x0),
				height: H,
				fill: "transparent"
			}),
			/* @__PURE__ */ jsx("g", {
				clipPath: `url(#${gid}c)`,
				children: variant === "bar" ? pts2.map((k) => {
					const bw = Math.max(1, (x1 - x0) / Math.max(1, n) * per * .7);
					const yy = y(vals[k]);
					const y0 = y(0);
					const bx = per > 1 ? xs(Math.min(n - 1, (Math.floor(k / per) + .5) * per - .5)) : xs(k);
					return /* @__PURE__ */ jsx("path", {
						d: roundRectPath(bx - bw / 2, Math.min(yy, y0), bw, Math.abs(y0 - yy), 1.5),
						fill: k === kMark ? accent.fill : p.paint("neutralStrong")
					}, k);
				}) : /* @__PURE__ */ jsxs(Fragment, { children: [variant === "area" ? /* @__PURE__ */ jsx("path", {
					d: areaPath(line, line.map(([xx]) => [xx, H - 2]), "smooth"),
					fill: `url(#${gid}g)`
				}) : null, /* @__PURE__ */ jsx("path", {
					d: linePath(line, "smooth"),
					fill: "none",
					stroke: accent.fill,
					strokeWidth: 1.8,
					strokeLinejoin: "round",
					strokeLinecap: "round"
				})] })
			}),
			props.showExtremes && n > 2 ? [argMax(vals), argMin(vals)].map((k, j) => /* @__PURE__ */ jsx("circle", {
				cx: xs(k),
				cy: y(vals[k]),
				r: 2.4,
				fill: p.paint("panel"),
				stroke: p.paint("ink"),
				strokeWidth: 1.3,
				opacity: t >= .99 ? 1 : 0
			}, j)) : null,
			kMark >= 0 && variant !== "bar" && Number.isFinite(vals[kMark]) ? /* @__PURE__ */ jsx("circle", {
				cx: xs(kMark),
				cy: y(vals[kMark]),
				r: 3.2,
				fill: accent.fill,
				stroke: p.paint("panel"),
				strokeWidth: 1.5,
				opacity: Math.max(0, (t - .85) / .15)
			}) : null,
			c.active !== null && Number.isFinite(vals[c.active]) ? /* @__PURE__ */ jsx("circle", {
				cx: xs(c.active),
				cy: y(vals[c.active]),
				r: 3.4,
				fill: p.paint("ink"),
				stroke: p.paint("panel"),
				strokeWidth: 1.5,
				pointerEvents: "none"
			}) : null,
			valW ? /* @__PURE__ */ jsx(Txt, {
				x: W - 2,
				y: H / 2,
				anchor: "end",
				size: 13,
				weight: 800,
				fill: p.paint("ink"),
				opacity: m.fade(600, 300),
				children: valText
			}) : null
		]
	});
}
var BRUSH_TEXT = {
	en: {
		zoomHint: " Press Enter to zoom in.",
		pickHint: " Press Enter to select.",
		high: "High",
		low: "Low",
		resetLabel: "Show all (reset zoom)",
		reset: "Show all",
		/** 읽어 줄 문장의 최고, 최저 부분 */
		extremes: (hi, lo) => `, high ${hi}, low ${lo}`,
		/** 고른 구간 이름. 예: "Jan to Mar" */
		range: (a, b) => `${a} to ${b}`
	},
	ko: {
		zoomHint: " Enter를 누르면 확대해요.",
		pickHint: " Enter를 누르면 이 구간을 골라요.",
		high: "최고",
		low: "최저",
		resetLabel: "전체 보기(확대 풀기)",
		reset: "전체 보기",
		extremes: (hi, lo) => `, 최고 ${hi}, 최저 ${lo}`,
		range: (a, b) => `${a}~${b}`
	}
};
var MIN_DRAG_PX = 4;
function useBrush(o) {
	const [range, setRange] = useState(null);
	const [dragging, setDragging] = useState(false);
	const start = useRef(null);
	const anchor = useRef(null);
	const clear = () => {
		start.current = null;
		anchor.current = null;
		setDragging(false);
		setRange(null);
	};
	const down = (x, y, e) => {
		if (!o.enabled || o.count < 2 || e.pointerType === "touch" || e.button !== 0 || !o.inPlot(x, y)) return false;
		start.current = {
			i: o.indexAt(x),
			x,
			moved: false
		};
		e.currentTarget.setPointerCapture?.(e.pointerId);
		return true;
	};
	const move = (x) => {
		const s = start.current;
		if (!s) return false;
		if (!s.moved && Math.abs(x - s.x) < MIN_DRAG_PX) return true;
		s.moved = true;
		const i = o.indexAt(x);
		const from = Math.min(s.i, i);
		const to = Math.max(s.i, i);
		setDragging(true);
		setRange((prev) => prev?.from === from && prev.to === to ? prev : {
			from,
			to
		});
		return true;
	};
	const up = (x, _y, e) => {
		const s = start.current;
		start.current = null;
		if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
		if (!s) return;
		setDragging(false);
		if (!s.moved || e.type === "pointercancel") {
			if (range) {
				setRange(null);
				o.onCommit(null);
			}
			return;
		}
		const i = o.indexAt(x);
		const r = {
			from: Math.min(s.i, i),
			to: Math.max(s.i, i)
		};
		const ok = r.to > r.from;
		setRange(ok && o.keep !== false ? r : null);
		o.onCommit(ok ? r : null);
	};
	const key = (e, active) => {
		if (!o.enabled) return false;
		if (e.key === "Escape" && range) {
			clear();
			o.onCommit(null);
			return true;
		}
		if (e.key === "Enter" && range && anchor.current !== null) {
			anchor.current = null;
			if (o.keep === false) setRange(null);
			o.onCommit(range);
			return true;
		}
		if (!e.shiftKey || e.key !== "ArrowLeft" && e.key !== "ArrowRight" || o.count < 2) return false;
		const step = e.key === "ArrowRight" ? 1 : -1;
		const a = anchor.current ?? active ?? (step > 0 ? 0 : o.count - 1);
		const end = range && anchor.current !== null ? range.from === a ? range.to : range.from : a;
		const next = Math.max(0, Math.min(o.count - 1, end + step));
		anchor.current = a;
		setRange(next === a ? null : {
			from: Math.min(a, next),
			to: Math.max(a, next)
		});
		return true;
	};
	return {
		range,
		dragging,
		keyboard: range !== null && anchor.current !== null,
		down,
		move,
		up,
		key
	};
}
function useZoom(sig) {
	const [z, setZ] = useState(null);
	if (z && z.sig !== sig) setZ(null);
	return {
		view: z && z.sig === sig ? z.range : null,
		zoomTo: (range) => setZ({
			sig,
			range
		}),
		reset: () => setZ(null)
	};
}
function useChartBrush(props, zoom, o) {
	const text = BRUSH_TEXT[o.lang];
	const mode = props.brush === "zoom" ? "zoom" : props.brush ? "select" : null;
	const brush = useBrush({
		enabled: mode !== null,
		count: o.count,
		indexAt: o.indexAt,
		inPlot: o.inPlot,
		keep: mode !== "zoom",
		onCommit: (r) => {
			const xr = r ? o.toXRange(r) : null;
			props.onBrush?.(xr);
			if (mode === "zoom" && xr && xr.to > xr.from) zoom.zoomTo([xr.from, xr.to]);
		}
	});
	return {
		brush,
		frame: {
			onPointerDown: mode ? brush.down : void 0,
			onPointerUp: mode ? brush.up : void 0,
			onKey: mode ? (e) => {
				if (e.key === "Escape" && zoom.view && !brush.range) {
					zoom.reset();
					return true;
				}
				return brush.key(e, o.active);
			} : void 0,
			overlay: zoom.view ? /* @__PURE__ */ jsx(ZoomReset, {
				p: o.p,
				onReset: zoom.reset,
				text
			}) : null
		},
		hint: brush.keyboard ? mode === "zoom" ? text.zoomHint : text.pickHint : "",
		text
	};
}
function changeRatio(a, b) {
	if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
	return (b - a) / Math.abs(a);
}
function signedPercent(r, locale = DEFAULT_LOCALE) {
	const v = Math.round(r * 1e3) / 10;
	return `${v > 0 ? "+" : ""}${formatNumber(v, {
		locale,
		maximumFractionDigits: 1
	})}%`;
}
function BrushBand(props) {
	const { p, top, bottom } = props;
	const a = Math.min(props.x0, props.x1);
	const b = Math.max(props.x0, props.x1);
	const mainW = textWidth(props.main, 11.5, 800);
	const chipW = mainW + (textWidth(props.sub, 10.5, 500) + 6) + 16;
	const chipX = Math.max(2, Math.min(props.width - chipW - 2, (a + b) / 2 - chipW / 2));
	const chipY = top + 4;
	return /* @__PURE__ */ jsxs("g", {
		pointerEvents: "none",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: a,
				y: top,
				width: Math.max(1, b - a),
				height: Math.max(0, bottom - top),
				fill: p.paint("accent"),
				opacity: props.dragging ? .1 : .14
			}),
			/* @__PURE__ */ jsx("line", {
				x1: a,
				x2: a,
				y1: top,
				y2: bottom,
				stroke: p.paint("accent"),
				strokeWidth: 1,
				opacity: .7
			}),
			/* @__PURE__ */ jsx("line", {
				x1: b,
				x2: b,
				y1: top,
				y2: bottom,
				stroke: p.paint("accent"),
				strokeWidth: 1,
				opacity: .7
			}),
			/* @__PURE__ */ jsx("rect", {
				x: chipX,
				y: chipY,
				width: chipW,
				height: 22,
				rx: 8,
				fill: p.paint("panel"),
				stroke: p.paint("line")
			}),
			/* @__PURE__ */ jsx(Txt, {
				x: chipX + 8,
				y: chipY + 11,
				size: 11.5,
				weight: 800,
				fill: p.paint("ink"),
				children: props.main
			}),
			/* @__PURE__ */ jsx(Txt, {
				x: chipX + 8 + mainW + 6,
				y: chipY + 11,
				size: 10.5,
				weight: 500,
				fill: p.paint("muted"),
				children: props.sub
			})
		]
	});
}
function ExtremeTags(props) {
	const { p, width, top, bottom, max, min } = props;
	const text = BRUSH_TEXT[props.lang];
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(PointTag, {
		p,
		x: max.x,
		y: max.y,
		text: `${text.high} ${max.text}`,
		below: max.y - 26 < top + 30,
		width
	}), /* @__PURE__ */ jsx(PointTag, {
		p,
		x: min.x,
		y: min.y,
		text: `${text.low} ${min.text}`,
		below: min.y + 26 < bottom,
		width
	})] });
}
function PointTag(props) {
	const { p } = props;
	const w = textWidth(props.text, 10.5, 700) + 12;
	const h = 18;
	const tx = Math.max(2, Math.min(props.width - w - 2, props.x - w / 2));
	const ty = props.below ? props.y + 8 : props.y - h - 8;
	return /* @__PURE__ */ jsxs("g", {
		pointerEvents: "none",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ jsx("circle", {
				cx: props.x,
				cy: props.y,
				r: 3.5,
				fill: p.paint("ink"),
				stroke: p.paint("panel"),
				strokeWidth: 2
			}),
			/* @__PURE__ */ jsx("rect", {
				x: tx,
				y: ty,
				width: w,
				height: h,
				rx: 9,
				fill: p.paint("ink")
			}),
			/* @__PURE__ */ jsx(Txt, {
				x: tx + w / 2,
				y: ty + h / 2,
				anchor: "middle",
				size: 10.5,
				weight: 700,
				fill: p.paint("onInk"),
				children: props.text
			})
		]
	});
}
function ZoomReset(props) {
	const { p } = props;
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		className: "ztd-btn",
		onClick: props.onReset,
		"aria-label": props.text.resetLabel,
		style: {
			position: "absolute",
			top: 0,
			right: 0,
			height: 24,
			padding: "0 10px",
			borderRadius: 12,
			border: `1px solid ${p.paint("line")}`,
			background: p.paint("panel"),
			color: p.paint("muted"),
			fontSize: 11.5,
			fontWeight: 600,
			zIndex: 4
		},
		children: props.text.reset
	});
}
function resolveHighlight(h, data, labels, values, fallback = "max") {
	const out = /* @__PURE__ */ new Set();
	const n = labels.length;
	const pick = (mode) => {
		if (!n) return;
		if (mode === "none") return;
		if (mode === "first") out.add(0);
		else if (mode === "last") out.add(n - 1);
		else if (mode === "max" || mode === "min") {
			let best = -1;
			let bv = mode === "max" ? -Infinity : Infinity;
			values.forEach((v, i) => {
				if (!Number.isFinite(v)) return;
				if (mode === "max" ? v > bv : v < bv) {
					bv = v;
					best = i;
				}
			});
			if (best >= 0) out.add(best);
		}
	};
	if (h === void 0 || h === null) {
		pick(fallback);
		return out;
	}
	if (typeof h === "function") {
		data.forEach((d, i) => {
			if (i < n && d !== null && d !== void 0 && h(d, i)) out.add(i);
		});
		return out;
	}
	const list = Array.isArray(h) ? h : [h];
	for (const item of list) if (typeof item === "number") {
		if (item >= 0 && item < n) out.add(item);
	} else if (item === "max" || item === "min" || item === "first" || item === "last" || item === "none") pick(item);
	else labels.forEach((l, i) => {
		if (l === item) out.add(i);
	});
	return out;
}
var MSG2 = {
	en: {
		pie: "Pie chart",
		donut: "Donut chart",
		share: "Share",
		desc: (n, total, top) => `${plural(n, "item")}, total ${total}. ${top}.`
	},
	ko: {
		pie: "파이 차트",
		donut: "도넛 차트",
		share: "비중",
		desc: (n, total, top) => `${n}개 항목, 합계 ${total}. ${top}.`
	}
};
function useSlices(props) {
	const { data } = props;
	return useMemo(() => {
		const gl = strGetter(props.label, "label");
		const gv = numGetter(props.value, "value");
		let rows = data.map((d, i) => ({
			d,
			i,
			label: gl(d, i),
			value: Math.max(0, gv(d, i) || 0)
		}));
		if (props.sort) rows = [...rows].sort((a, b) => b.value - a.value);
		const total = sum(rows.map((r) => r.value));
		const labels = rows.map((r) => r.label);
		const values = rows.map((r) => r.value);
		const hi = resolveHighlight(props.highlight, rows.map((r) => r.d), labels, values, "max");
		return {
			rows,
			total,
			hi
		};
	}, [
		data,
		props.label,
		props.value,
		props.sort,
		props.highlight
	]);
}
function PieBase(props) {
	const isDonut = props.inner > 0;
	const { rows, total, hi } = useSlices(props);
	const modeAt = (w) => isDonut ? props.legend === void 0 || props.legend === "auto" ? w >= 300 ? "right" : "bottom" : props.legend : "none";
	const bottomH = Math.ceil(rows.length / 2) * 20 + 8;
	const c = useChart(props, {
		height: (w) => isDonut ? Math.max(170, Math.min(240, w * .5)) + (modeAt(w) === "bottom" ? bottomH : 0) : Math.max(180, Math.min(260, w * .62)),
		duration: 1e3
	});
	const { p, width: W, height: H } = c;
	const legendMode = modeAt(W);
	const plotH = H - (legendMode === "bottom" ? bottomH : 0);
	const legendRowH = Math.min(26, (plotH - 8) / Math.max(1, rows.length));
	const legendW = legendMode === "right" ? Math.min(220, Math.max(140, W * .44)) : 0;
	const plotW = W - legendW;
	const outsidePad = isDonut ? 4 : 20;
	const R = Math.max(10, Math.min(plotW, plotH) / 2 - outsidePad);
	const r0 = R * props.inner;
	const capSize = props.centerLabel ? Math.max(9.5, Math.min(11, 11 * r0 * 1.6 / textWidth(props.centerLabel, 11))) : 11;
	const cx = legendMode === "right" ? Math.max(R + outsidePad, plotW / 2 + 6) : W / 2;
	const cy = plotH / 2;
	const start = (props.startAngle ?? 0) * Math.PI / 180;
	const slices = useMemo(() => {
		const colors = props.colorMode === "emphasis" ? emphasis(p, rows.length, new Set(rows.map((r, k) => hi.has(k) ? k : -1).filter((k) => k >= 0))) : categorical(p, rows.length, hi);
		let acc = 0;
		return rows.map((r, k) => {
			const a = total > 0 ? r.value / total * TAU : 0;
			const s = {
				i: k,
				label: r.label,
				value: r.value,
				pct: total > 0 ? r.value / total * 100 : 0,
				a0: acc,
				a1: acc + a,
				sw: colors[k],
				hi: hi.has(k),
				datum: r.d
			};
			acc += a;
			return s;
		});
	}, [
		rows,
		total,
		hi,
		p,
		props.colorMode
	]);
	const centerVal = isDonut ? centerNumber(props, slices, total) : 0;
	const m = useMotion(useMemo(() => {
		const ms = slices.map((s) => {
			const mid = (s.a0 + s.a1) / 2;
			return {
				key: `s:${s.label}`,
				to: [s.a0, s.a1],
				enter: [s.a0, s.a0],
				exit: [mid, mid],
				data: s
			};
		});
		ms.push({
			key: "__sweep",
			to: [TAU],
			from: [0],
			data: null
		});
		if (isDonut) ms.push({
			key: "__center",
			to: [centerVal],
			from: [0],
			data: null
		});
		return ms;
	}, [
		slices,
		isDonut,
		centerVal
	]), {
		...c.motion,
		stagger: 0
	});
	const sweep = m.get("__sweep")?.[0] ?? TAU;
	const D = c.motion.duration ?? 1e3;
	const items = m.items.filter((it) => it.data);
	const events = slices.map((s) => ({
		datum: s.datum,
		index: s.i,
		key: s.label,
		label: s.label,
		value: s.value,
		formatted: `${c.pct(s.pct)} · ${c.fv(s.value)}`
	}));
	const labelMode = props.labelMode ?? (isDonut ? "none" : "percent");
	const labelR = isDonut ? (r0 + R) / 2 : R * .62;
	const outside = useMemo(() => {
		if (labelMode === "none" || !c.showLabels) return /* @__PURE__ */ new Map();
		const list = [];
		slices.forEach((s) => {
			const text = sliceText(s, labelMode, c.fv, c.pct);
			const ang = s.a1 - s.a0;
			if (!(ang * labelR >= textWidth(text, 12.5, 700) + 10 && ang > .32) && s.value > 0) {
				const mid = start + (s.a0 + s.a1) / 2;
				const [x, y] = polar(cx, cy, R + 12, mid);
				list.push({
					i: s.i,
					x,
					y,
					side: Math.sin(mid) >= 0 ? 1 : -1
				});
			}
		});
		const out = /* @__PURE__ */ new Map();
		for (const side of [1, -1]) {
			const group = list.filter((l) => l.side === side);
			const ys = dodgeVertical(group.map((g) => g.y), 15, 8, plotH - 8);
			group.forEach((g, k) => {
				const nearTop = Math.abs(g.x - cx) < 14;
				out.set(g.i, {
					x: g.x,
					y: ys[k],
					anchor: nearTop ? "middle" : side > 0 ? "start" : "end"
				});
			});
		}
		return out;
	}, [
		slices,
		labelMode,
		c.showLabels,
		labelR,
		start,
		cx,
		cy,
		R,
		plotH,
		c.fv,
		c.pct
	]);
	const msg = MSG2[c.lang];
	let tip = null;
	if (c.active !== null && slices[c.active]) {
		const s = slices[c.active];
		const [tx, ty] = polar(cx, cy, R * .9, start + (s.a0 + s.a1) / 2);
		tip = {
			x: tx,
			y: ty,
			title: s.label,
			rows: [{
				label: c.t.value,
				value: c.fv(s.value),
				color: s.sw.fill
			}, {
				label: msg.share,
				value: c.pct(s.pct)
			}]
		};
	}
	const center = m.get("__center")?.[0] ?? 0;
	const top = [...slices].sort((a, b) => b.value - a.value);
	const kind = isDonut ? msg.donut : msg.pie;
	const desc = props.description ?? `${kind}. ${msg.desc(slices.length, c.fv(total), top.slice(0, 4).map((s) => `${s.label} ${c.pct(s.pct)}`).join(", "))}`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			/* @__PURE__ */ jsxs("g", { children: [items.map((it) => {
				const s = it.data;
				const a0 = start + Math.min(it.v[0], sweep);
				const a1 = start + Math.min(it.v[1], sweep);
				const isActive = c.active === s.i;
				const mid = (a0 + a1) / 2;
				const off = isActive ? 5 : 0;
				const dx = Math.sin(mid) * off;
				const dy = -Math.cos(mid) * off;
				const d = arcPath(cx, cy, r0, R, a0, a1);
				if (!d) return null;
				return /* @__PURE__ */ jsx("path", {
					className: "ztd-mark",
					d,
					fill: s.sw.fill,
					stroke: p.paint("panel"),
					strokeWidth: slices.length > 1 ? 2 : 0,
					strokeLinejoin: "round",
					opacity: it.exiting ? .6 : c.dim(s.i),
					style: {
						transform: `translate(${dx}px, ${dy}px)`,
						transition: "transform .2s ease, opacity .18s ease",
						cursor: props.onClick ? "pointer" : void 0
					},
					onPointerEnter: (e) => c.setActive(s.i, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(s.i)
				}, it.key);
			}), c.active !== null && c.via === "keyboard" && slices[c.active] ? /* @__PURE__ */ jsx("path", {
				d: arcPath(cx, cy, Math.max(0, r0 - 2), R + 3, start + slices[c.active].a0, start + slices[c.active].a1),
				fill: "none",
				stroke: p.paint("ink"),
				strokeWidth: 2,
				pointerEvents: "none"
			}) : null] }),
			labelMode !== "none" && c.showLabels ? /* @__PURE__ */ jsx("g", { children: slices.map((s) => {
				if (s.value <= 0) return null;
				const text = sliceText(s, labelMode, c.fv, c.pct);
				const mid = start + (s.a0 + s.a1) / 2;
				const o = m.fade(D * .35 + s.a0 / TAU * D * .5, 260) * c.dim(s.i);
				const out = outside.get(s.i);
				if (out) return /* @__PURE__ */ jsx(Txt, {
					x: out.x,
					y: out.y,
					anchor: out.anchor,
					size: 12,
					weight: 700,
					fill: p.paint("ink"),
					opacity: o,
					children: truncate(text, out.anchor === "start" ? W - out.x - 4 : out.anchor === "end" ? out.x - 4 : W, 12, 700)
				}, s.i);
				const [x, y] = polar(cx, cy, labelR, mid);
				return /* @__PURE__ */ jsx(Txt, {
					x,
					y,
					anchor: "middle",
					size: 13,
					weight: 700,
					fill: s.sw.text,
					opacity: o,
					children: text
				}, s.i);
			}) }) : null,
			isDonut && props.centerValue !== null ? /* @__PURE__ */ jsxs("g", {
				opacity: m.fade(0, 200),
				children: [/* @__PURE__ */ jsx(Txt, {
					x: cx,
					y: cy - (props.centerLabel ? 7 : 0),
					anchor: "middle",
					size: Math.max(15, Math.min(26, r0 * .42)),
					weight: 800,
					fill: p.paint("ink"),
					letterSpacing: -.4,
					children: c.fmt(Math.round(center))
				}), props.centerLabel ? /* @__PURE__ */ jsx(Txt, {
					x: cx,
					y: cy + Math.max(11, Math.min(17, r0 * .3)),
					anchor: "middle",
					size: capSize,
					fill: p.paint("muted"),
					children: truncate(props.centerLabel, r0 * 1.6, capSize)
				}) : null]
			}) : null,
			legendMode === "right" || legendMode === "bottom" ? /* @__PURE__ */ jsx("g", { children: slices.map((s, k) => {
				const right = legendMode === "right";
				const colW = right ? legendW - 12 : (W - 36) / 2;
				const lx = right ? plotW + 8 : 8 + k % 2 * (colW + 20);
				const ly = right ? cy - (slices.length - 1) * legendRowH / 2 + k * legendRowH : plotH + 12 + Math.floor(k / 2) * 20;
				const o = m.fade(D * .25 + k * 90, 260) * c.dim(s.i);
				const pct = c.pct(s.pct);
				const nameMax = colW - 14 - textWidth(pct, 12, 700) - 10;
				return /* @__PURE__ */ jsxs("g", {
					opacity: o,
					onPointerEnter: () => c.setActive(s.i),
					style: { cursor: "default" },
					children: [
						/* @__PURE__ */ jsx("rect", {
							x: lx,
							y: ly - 5,
							width: 10,
							height: 10,
							rx: 2.5,
							fill: s.sw.fill,
							stroke: s.sw.role === "soft" || s.sw.role === "neutral" ? p.paint("line2") : "none"
						}),
						/* @__PURE__ */ jsx(Txt, {
							x: lx + 16,
							y: ly,
							size: 12,
							weight: s.hi ? 700 : 500,
							fill: p.paint(s.hi ? "ink" : "muted"),
							children: truncate(s.label, nameMax, 12, s.hi ? 700 : 500)
						}),
						/* @__PURE__ */ jsx(Txt, {
							x: lx + colW,
							y: ly,
							anchor: "end",
							size: 12,
							weight: s.hi ? 800 : 500,
							fill: p.paint(s.hi ? "ink" : "muted"),
							children: pct
						})
					]
				}, s.i);
			}) }) : null
		]
	});
}
function centerNumber(props, slices, total) {
	const v = props.centerValue;
	if (typeof v === "number") return v;
	if (v === "highlight") return slices.find((s) => s.hi)?.value ?? total;
	return total;
}
function sliceText(s, mode, fv, pct) {
	if (mode === "value") return fv(s.value);
	if (mode === "label") return s.label;
	return pct(s.pct);
}
function PieChart(props) {
	return /* @__PURE__ */ jsx(PieBase, {
		...props,
		inner: 0
	});
}
function DonutChart(props) {
	const inner = Math.max(.2, Math.min(.9, props.innerRadius ?? .62));
	return /* @__PURE__ */ jsx(PieBase, {
		...props,
		inner
	});
}
var MSG3 = {
	en: {
		kind: "Funnel chart",
		/** 전환율 열 제목 */
		header: "vs. previous",
		vsPrev: "vs. previous step",
		vsFirst: "vs. first step",
		count: "Count",
		drop: "Drop-off",
		rate: (first, pct) => `${pct} of ${first ? "first" : "previous"} step`,
		steps: (n) => plural(n, "step"),
		paren: (pct) => ` (${pct})`
	},
	ko: {
		kind: "퍼널 차트",
		header: "전 단계 대비",
		vsPrev: "전 단계 대비",
		vsFirst: "첫 단계 대비",
		count: "인원",
		drop: "이탈",
		rate: (first, pct) => `${first ? "첫 단계" : "전 단계"} 대비 ${pct}`,
		steps: (n) => `${n}단계`,
		paren: (pct) => `(${pct})`
	}
};
function FunnelChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(180, Math.min(260, w * .56)),
		duration: 800,
		stagger: 110
	});
	const { p, width: W, height: H } = c;
	const showRates = props.showRates !== false;
	const base = props.rateBase ?? "previous";
	const { rows, rates, hi } = useMemo(() => {
		const gl = strGetter(props.label, "label");
		const gv = numGetter(props.value, "value");
		const rows2 = props.data.map((d, i) => ({
			d,
			i,
			label: gl(d, i),
			value: Math.max(0, gv(d, i) || 0)
		}));
		const rates2 = rows2.map((r, i) => i === 0 ? null : base === "first" ? rows2[0].value ? r.value / rows2[0].value * 100 : 0 : rows2[i - 1].value ? r.value / rows2[i - 1].value * 100 : 0);
		let hi2;
		if (props.highlight !== void 0) hi2 = resolveHighlight(props.highlight, rows2.map((r) => r.d), rows2.map((r) => r.label), rows2.map((r) => r.value));
		else {
			let best = -1;
			let bv = Infinity;
			rates2.forEach((r, i) => {
				if (r !== null && r < bv) {
					bv = r;
					best = i;
				}
			});
			hi2 = new Set(best >= 0 ? [best] : []);
		}
		return {
			rows: rows2,
			rates: rates2,
			hi: hi2
		};
	}, [
		props.data,
		props.label,
		props.value,
		props.highlight,
		base
	]);
	const labelW = Math.min(120, Math.max(54, ...rows.map((r) => Math.max(textWidth(r.label, 11.5, 700), textWidth(c.fv(r.value), 10.5))))) + 8;
	const msg = MSG3[c.lang];
	const rateTitle = props.rateLabel ?? msg.header;
	const rateW = showRates ? Math.max(44, textWidth(rateTitle, 10.5) * .6) : 0;
	const top = showRates ? 18 : 4;
	const plotX = labelW + 6;
	const plotW = Math.max(40, W - plotX - rateW - 10);
	const cxm = plotX + plotW / 2;
	const n = Math.max(1, rows.length);
	const band = (H - top - 4) / n;
	const barH = Math.max(8, Math.min(34, band * .52));
	const first = Math.max(0, ...rows.map((r) => r.value)) || 1;
	const maxW = plotW;
	const stages = useMemo(() => rows.map((r, i) => ({
		i,
		label: r.label,
		value: r.value,
		rate: rates[i],
		w: Math.max(10, r.value / first * maxW),
		hi: hi.has(i),
		datum: r.d
	})), [
		rows,
		rates,
		hi,
		first,
		maxW
	]);
	const stg = c.motion.stagger ?? 110;
	const m = useMotion(useMemo(() => stages.map((s, i) => ({
		key: `f:${s.label}`,
		to: [s.w, 1],
		from: [s.w * .15, 0],
		enter: [0, 0],
		delay: i * stg,
		data: s
	})), [stages, stg]), c.motion);
	const cur = new Map(m.items.filter((it) => !it.exiting).map((it) => [it.data.i, it]));
	const yMid = (i) => top + band * i + band / 2;
	const neutral = swatch(p, "neutral");
	const accent = swatch(p, "accent");
	const events = stages.map((s) => ({
		datum: s.datum,
		index: s.i,
		key: s.label,
		label: s.label,
		value: s.value,
		formatted: `${c.fv(s.value)}${s.rate !== null ? ` · ${msg.rate(base === "first", c.pct(s.rate))}` : ""}`
	}));
	let tip = null;
	if (c.active !== null && stages[c.active]) {
		const s = stages[c.active];
		tip = {
			x: cxm,
			y: yMid(s.i) - barH / 2,
			title: s.label,
			rows: [
				{
					label: msg.count,
					value: c.fv(s.value),
					color: s.hi ? accent.fill : neutral.fill
				},
				...s.rate !== null ? [{
					label: base === "first" ? msg.vsFirst : msg.vsPrev,
					value: c.pct(s.rate)
				}] : [],
				...s.i > 0 ? [{
					label: msg.drop,
					value: c.fv(stages[s.i - 1].value - s.value)
				}] : []
			]
		};
	}
	const desc = props.description ?? `${msg.kind}. ${msg.steps(stages.length)}: ${stages.map((s) => `${s.label} ${c.fv(s.value)}${s.rate !== null ? msg.paren(c.pct(s.rate)) : ""}`).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [showRates ? /* @__PURE__ */ jsx(Txt, {
			x: W - 2,
			y: 8,
			anchor: "end",
			size: 10.5,
			fill: p.paint("muted"),
			opacity: m.fade(0, 300),
			children: rateTitle
		}) : null, stages.map((s, i) => {
			const it = cur.get(i);
			if (!it) return null;
			const w = it.v[0];
			const o = it.v[1];
			const y = yMid(i);
			const next = stages[i + 1] ? cur.get(i + 1) : void 0;
			const nw = next ? next.v[0] : 0;
			const no = next ? next.v[1] : 0;
			const yb = y + barH / 2;
			const yt = y + band - barH / 2;
			const conn = next && no > .01 ? `M${r2(cxm - w / 2)},${r2(yb - 1)}C${r2(cxm - w / 2)},${r2((yb + yt) / 2)} ${r2(cxm - nw / 2)},${r2((yb + yt) / 2)} ${r2(cxm - nw / 2)},${r2(yt + 1)}L${r2(cxm + nw / 2)},${r2(yt + 1)}C${r2(cxm + nw / 2)},${r2((yb + yt) / 2)} ${r2(cxm + w / 2)},${r2((yb + yt) / 2)} ${r2(cxm + w / 2)},${r2(yb - 1)}Z` : "";
			const sw = s.hi ? accent : neutral;
			return /* @__PURE__ */ jsxs("g", {
				opacity: c.dim(i),
				className: "ztd-mark",
				onPointerEnter: (e) => c.setActive(i, e.pointerType === "touch" ? "touch" : "pointer"),
				onClick: () => c.click(i),
				style: { cursor: props.onClick ? "pointer" : void 0 },
				children: [
					/* @__PURE__ */ jsx("rect", {
						x: plotX - labelW,
						y: y - band / 2,
						width: W - plotX + labelW,
						height: band,
						fill: "transparent"
					}),
					conn ? /* @__PURE__ */ jsx("path", {
						d: conn,
						fill: p.paint("neutral"),
						opacity: .55 * Math.min(o, no)
					}) : null,
					/* @__PURE__ */ jsx("path", {
						d: roundRectPath(cxm - w / 2, y - barH / 2, w, barH, Math.min(7, barH / 3)),
						fill: sw.fill,
						opacity: o
					}),
					c.active === i && c.via === "keyboard" ? /* @__PURE__ */ jsx("path", {
						d: roundRectPath(cxm - w / 2 - 3, y - barH / 2 - 3, w + 6, barH + 6, 8),
						fill: "none",
						stroke: p.paint("ink"),
						strokeWidth: 2
					}) : null,
					/* @__PURE__ */ jsxs("g", {
						opacity: m.fade(i * (c.motion.stagger ?? 110) + 120, 260),
						children: [
							/* @__PURE__ */ jsx(Txt, {
								x: labelW,
								y: y - 6,
								anchor: "end",
								size: 11.5,
								weight: s.hi ? 800 : 600,
								fill: p.paint("ink"),
								children: truncate(s.label, labelW - 4, 11.5, 700)
							}),
							/* @__PURE__ */ jsx(Txt, {
								x: labelW,
								y: y + 8,
								anchor: "end",
								size: 10.5,
								fill: p.paint("muted"),
								children: c.fv(s.value)
							}),
							showRates && s.rate !== null ? /* @__PURE__ */ jsx(Txt, {
								x: W - 2,
								y: top + band * i,
								anchor: "end",
								size: 12,
								weight: s.hi ? 800 : 500,
								fill: p.paint(s.hi ? "ink" : "muted"),
								children: c.pct(s.rate)
							}) : null
						]
					})
				]
			}, i);
		})]
	});
}
var MSG4 = {
	en: {
		kind: "Waffle chart",
		share: "Share",
		cells: "Cells",
		count: (n) => `${n}`,
		of: (cells) => `Out of ${cells} cells:`
	},
	ko: {
		kind: "와플 차트",
		share: "비중",
		cells: "칸",
		count: (n) => `${n}칸`,
		of: (cells) => `${cells}칸 중`
	}
};
function allocateCells(values, cells, total) {
	const t = Math.max(total ?? 0, sum(values));
	if (!(t > 0)) return values.map(() => 0);
	const exact = values.map((v) => Math.max(0, v) / t * cells);
	const out = exact.map((x) => Math.floor(x));
	let left = (total === void 0 ? cells : Math.min(cells, Math.round(sum(values) / t * cells))) - sum(out);
	const order = exact.map((x, i) => ({
		r: x - Math.floor(x),
		i
	})).sort((a, b) => b.r - a.r);
	for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i]++;
	return out;
}
function WaffleChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(160, Math.min(230, w * .5)),
		duration: 520,
		stagger: 7
	});
	const { p, width: W, height: H } = c;
	const msg = MSG4[c.lang];
	const cells = Math.max(1, Math.round(props.cells ?? 100));
	const cols = Math.max(1, Math.round(props.columns ?? 10));
	const rowsN = Math.ceil(cells / cols);
	const model = useMemo(() => {
		const gl = strGetter(props.label, "label");
		const gv = numGetter(props.value, "value");
		const rows = props.data.map((d, i) => ({
			d,
			i,
			label: gl(d, i),
			value: Math.max(0, gv(d, i) || 0)
		}));
		return {
			rows,
			hi: resolveHighlight(props.highlight, rows.map((r) => r.d), rows.map((r) => r.label), rows.map((r) => r.value), "first"),
			counts: allocateCells(rows.map((r) => r.value), cells, props.total),
			total: props.total ?? sum(rows.map((r) => r.value))
		};
	}, [
		props.data,
		props.label,
		props.value,
		props.highlight,
		cells,
		props.total
	]);
	const colors = useMemo(() => categorical(p, model.rows.length, model.hi), [p, model]);
	const summary = props.summary !== false && W >= 260;
	const gap = W < 360 ? 2.5 : 3.5;
	const gridMaxW = summary ? W * .58 : W;
	const cell = Math.max(3, Math.min((gridMaxW - (cols - 1) * gap) / cols, (H - (rowsN - 1) * gap) / rowsN));
	const gridW = cols * cell + (cols - 1) * gap;
	const gy = (H - (rowsN * cell + (rowsN - 1) * gap)) / 2;
	const owner = useMemo(() => {
		const out = [];
		model.counts.forEach((n, k) => {
			for (let j = 0; j < n; j++) out.push(k);
		});
		return out;
	}, [model.counts]);
	const stagger = c.motion.stagger ?? 7;
	const hiIdx = [...model.hi][0] ?? -1;
	const hiRow = model.rows[hiIdx];
	const pct = model.total > 0 && hiRow ? hiRow.value / model.total * 100 : 0;
	const others = model.rows.filter((_, k) => !model.hi.has(k));
	const note = props.summaryNote ?? others.map((r) => `${r.label} ${c.fv(r.value)}`).join(" · ");
	const gapS = Math.max(14, (W - gridW) * .12);
	const room = W - gridW - gapS;
	const big = Math.max(24, Math.min(46, room * .32, H * .24));
	const sumW = summary && hiRow ? Math.min(room, Math.max(textWidth(c.pct(pct), big, 800), textWidth(props.summaryLabel ?? hiRow.label, 12.5, 700), note ? textWidth(note, 11) : 0)) : 0;
	const gx = summary ? Math.max(0, (W - (gridW + gapS + sumW)) / 2) : (W - gridW) / 2;
	const sx = gx + gridW + gapS;
	const sw = W - sx;
	const numMarks = useMemo(() => [{
		key: "__n",
		to: [pct],
		from: [0],
		delay: 100,
		data: null
	}], [pct]);
	const cellMs = c.motion.duration ?? 520;
	const mn = useMotion(numMarks, {
		...c.motion,
		duration: cellMs + cells * stagger * .8
	});
	const shown = mn.get("__n")?.[0] ?? pct;
	const { active, via, setActive, click } = c;
	const enabled = c.motion.enabled && c.hydrated;
	const cellNodes = useMemo(() => Array.from({ length: cells }, (_, idx) => {
		const k = owner[idx] ?? -1;
		const col = idx % cols;
		const row = Math.floor(idx / cols);
		const sw0 = k >= 0 ? colors[k] : null;
		return /* @__PURE__ */ jsx("rect", {
			className: "ztd-mark ztd-pop",
			"data-k": k,
			x: gx + col * (cell + gap),
			y: gy + row * (cell + gap),
			width: cell,
			height: cell,
			rx: Math.min(cell * .22, 4),
			fill: sw0 ? sw0.fill : p.paint("neutralSoft"),
			opacity: k >= 0 && active !== null && active !== k ? .38 : void 0,
			stroke: k >= 0 && active === k && via === "keyboard" ? p.paint("ink") : void 0,
			strokeWidth: 1.5,
			style: cssEntrance(enabled, mn.waiting, "pop", idx * stagger, cellMs)
		}, idx);
	}), [
		cells,
		owner,
		cols,
		gx,
		gy,
		cell,
		gap,
		colors,
		p,
		active,
		via,
		enabled,
		mn.waiting,
		mn.generation,
		stagger,
		cellMs
	]);
	const events = model.rows.map((r, k) => ({
		datum: r.d,
		index: k,
		key: r.label,
		label: r.label,
		value: r.value,
		formatted: `${c.fv(r.value)} · ${c.pct(model.total ? r.value / model.total * 100 : 0)}`
	}));
	let tip = null;
	if (c.active !== null && model.rows[c.active]) {
		const r = model.rows[c.active];
		const firstCell = owner.indexOf(c.active);
		tip = {
			x: gx + (firstCell >= 0 ? firstCell : 0) % cols * (cell + gap) + cell / 2,
			y: gy + Math.floor((firstCell >= 0 ? firstCell : 0) / cols) * (cell + gap),
			title: r.label,
			rows: [
				{
					label: c.t.value,
					value: c.fv(r.value),
					color: colors[c.active].fill
				},
				{
					label: msg.share,
					value: c.pct(model.total ? r.value / model.total * 100 : 0)
				},
				{
					label: msg.cells,
					value: msg.count(model.counts[c.active])
				}
			]
		};
	}
	const desc = props.description ?? `${msg.kind}. ${msg.of(cells)} ${model.rows.map((r, k) => `${r.label} ${msg.count(model.counts[k])}`).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [/* @__PURE__ */ jsx("g", {
			onPointerOver: (e) => {
				const k = Number(e.target.getAttribute("data-k"));
				if (k >= 0) setActive(k, e.pointerType === "touch" ? "touch" : "pointer");
			},
			onClick: (e) => {
				const k = Number(e.target.getAttribute("data-k"));
				if (k >= 0) click(k);
			},
			children: cellNodes
		}, mn.generation), summary && hiRow ? /* @__PURE__ */ jsxs("g", {
			opacity: mn.fade(250, 300),
			children: [
				/* @__PURE__ */ jsx(Txt, {
					x: sx,
					y: H / 2 - big * .32,
					size: big,
					weight: 800,
					fill: p.paint("ink"),
					letterSpacing: -1,
					children: c.pct(shown)
				}),
				/* @__PURE__ */ jsx(Txt, {
					x: sx,
					y: H / 2 + big * .42,
					size: 12.5,
					weight: 700,
					fill: p.paint("ink"),
					children: truncate(props.summaryLabel ?? hiRow.label, sw - 2, 12.5, 700)
				}),
				note ? /* @__PURE__ */ jsx(Txt, {
					x: sx,
					y: H / 2 + big * .42 + 17,
					size: 11,
					fill: p.paint("muted"),
					children: truncate(note, sw - 2, 11)
				}) : null
			]
		}) : null]
	});
}
function worst(s, mn, mx, side) {
	if (s <= 0 || mn <= 0) return Infinity;
	return Math.max(side * side * mx / (s * s), s * s / (side * side * mn));
}
function squarify(values, box) {
	const tot = sum(values.map((v) => Math.max(0, v)));
	const out = values.map(() => ({
		x: box.x,
		y: box.y,
		w: 0,
		h: 0
	}));
	if (tot <= 0 || box.w <= 0 || box.h <= 0) return out;
	const scale = box.w * box.h / tot;
	const order = values.map((v, i2) => ({
		v: Math.max(0, v) * scale,
		i: i2
	})).filter((d) => d.v > 0);
	let x = box.x;
	let y = box.y;
	let w = box.w;
	let h = box.h;
	let i = 0;
	while (i < order.length) {
		const side = Math.min(w, h);
		let rs = order[i].v;
		let mn = rs;
		let mx = rs;
		let j = i + 1;
		while (j < order.length) {
			const v = order[j].v;
			if (worst(rs + v, Math.min(mn, v), Math.max(mx, v), side) > worst(rs, mn, mx, side)) break;
			rs += v;
			mn = Math.min(mn, v);
			mx = Math.max(mx, v);
			j++;
		}
		if (w >= h) {
			const cw = h > 0 ? rs / h : 0;
			let yy = y;
			for (let k = i; k < j; k++) {
				const hh = cw > 0 ? order[k].v / cw : 0;
				out[order[k].i] = {
					x,
					y: yy,
					w: cw,
					h: hh
				};
				yy += hh;
			}
			x += cw;
			w -= cw;
		} else {
			const rh = w > 0 ? rs / w : 0;
			let xx = x;
			for (let k = i; k < j; k++) {
				const ww = rh > 0 ? order[k].v / rh : 0;
				out[order[k].i] = {
					x: xx,
					y,
					w: ww,
					h: rh
				};
				xx += ww;
			}
			y += rh;
			h -= rh;
		}
		i = j;
	}
	return out;
}
function buildTree(data, acc, rootLabel = "All") {
	const gl = strGetter(acc.label, "label");
	const gv = numGetter(acc.value, "value");
	const root = {
		id: "",
		label: rootLabel,
		value: 0,
		depth: 0,
		parent: null,
		children: [],
		datum: null,
		index: 0
	};
	const childKey = acc.children ?? "children";
	const hasNested = data.some((d) => d && typeof d === "object" && Array.isArray(d[childKey]));
	const add = (parent, label, datum) => {
		let n = parent.children.find((c) => c.label === label);
		if (!n) {
			n = {
				id: parent.id ? `${parent.id}/${label}` : label,
				label,
				value: 0,
				depth: parent.depth + 1,
				parent,
				children: [],
				datum,
				index: parent.children.length
			};
			parent.children.push(n);
		}
		return n;
	};
	if (hasNested) {
		const walk = (parent, items) => {
			items.forEach((it, i) => {
				const d = it;
				const node = add(parent, gl(d, i) || `#${i + 1}`, d);
				const kids = it[childKey];
				if (Array.isArray(kids) && kids.length) walk(node, kids);
				else node.value += Math.max(0, gv(d, i) || 0);
			});
		};
		walk(root, data);
	} else {
		const gg = acc.group ? strGetter(acc.group, "group") : null;
		data.forEach((d, i) => {
			let parent = root;
			if (acc.path?.length) for (const k of acc.path) {
				const v = d[k];
				if (v === void 0 || v === null || v === "") continue;
				parent = add(parent, String(v), null);
			}
			else if (gg) {
				const g = gg(d, i);
				if (g) parent = add(parent, g, null);
			}
			const leaf = add(parent, gl(d, i) || `#${i + 1}`, d);
			leaf.datum = d;
			leaf.value += Math.max(0, gv(d, i) || 0);
		});
	}
	const total = (n) => {
		if (n.children.length) n.value = sum(n.children.map(total));
		return n.value;
	};
	total(root);
	return root;
}
function leaves(n) {
	if (!n.children.length) return [n];
	return n.children.flatMap((c) => leaves(c));
}
function sortTree(n) {
	n.children.sort((a, b) => b.value - a.value);
	n.children.forEach((c, i) => {
		c.index = i;
		sortTree(c);
	});
}
function treeHeight(n) {
	return n.children.length ? 1 + Math.max(...n.children.map(treeHeight)) : 0;
}
function partitionAngles(root, a0 = 0, a1 = Math.PI * 2) {
	const out = [];
	const walk = (n, s, e) => {
		let acc = s;
		for (const c of n.children) {
			const span2 = n.value > 0 ? (e - s) * c.value / n.value : 0;
			out.push({
				node: c,
				a0: acc,
				a1: acc + span2,
				depth: c.depth
			});
			walk(c, acc, acc + span2);
			acc += span2;
		}
	};
	walk(root, a0, a1);
	return out;
}
var MSG5 = {
	en: {
		kind: "Treemap",
		ofTotal: "% of total",
		desc: (n) => `${plural(n, "item")}. Largest`
	},
	ko: {
		kind: "트리맵",
		ofTotal: "전체 대비",
		desc: (n) => `${n}개 항목. 큰 항목`
	}
};
var GAP = 3;
var HEAD = 16;
function Treemap(props) {
	const c = useChart(props, {
		height: (w) => Math.max(180, Math.min(280, w * .58)),
		duration: 700,
		stagger: 45
	});
	const { p, width: W, height: H } = c;
	const tree = useMemo(() => {
		const root = buildTree(props.data, {
			label: props.label,
			value: props.value,
			group: props.group,
			path: props.path,
			children: props.children
		});
		if (props.sort !== false) sortTree(root);
		return root;
	}, [
		props.data,
		props.label,
		props.value,
		props.group,
		props.path,
		props.children,
		props.sort
	]);
	const layout = useMemo(() => {
		const total = tree.value || 1;
		const grouped = tree.children.some((ch) => ch.children.length > 0);
		const cells = [];
		const groups2 = [];
		const lv = leaves(tree);
		const hiSet = resolveHighlight(props.highlight, lv.map((l) => l.datum), lv.map((l) => l.label), lv.map((l) => l.value), "max");
		const hiNodes = new Set([...hiSet].map((k) => lv[k]));
		const place = (node, box, depth) => {
			const kids = node.children;
			const rects = squarify(kids.map((k) => k.value), box);
			kids.forEach((k, j) => {
				const r = rects[j];
				if (k.children.length) {
					const head = grouped && r.h > HEAD + 18 && r.w > 40 ? HEAD : 0;
					groups2.push({
						node: k,
						rect: r,
						pct: k.value / total * 100
					});
					const inner = {
						x: r.x,
						y: r.y + head,
						w: r.w,
						h: r.h - head
					};
					place(k, inner, depth + 1);
				} else cells.push({
					i: lv.indexOf(k),
					node: k,
					rect: r,
					hi: hiNodes.has(k),
					pct: k.value / total * 100
				});
			});
		};
		place(tree, {
			x: 0,
			y: 0,
			w: W + GAP,
			h: H + GAP
		}, 0);
		cells.sort((a, b) => a.i - b.i);
		return {
			cells,
			groups: groups2,
			total,
			lv
		};
	}, [
		tree,
		W,
		H,
		props.highlight
	]);
	const stg = c.motion.stagger ?? 45;
	const m = useMotion(useMemo(() => layout.cells.map((cl, k) => {
		const r = cl.rect;
		const w = Math.max(0, r.w - GAP);
		const h = Math.max(0, r.h - GAP);
		return {
			key: `t:${cl.node.id}`,
			to: [
				r.x,
				r.y,
				w,
				h,
				1
			],
			from: [
				r.x + w * .04,
				r.y + h * .04,
				w * .92,
				h * .92,
				0
			],
			enter: [
				r.x + w / 2,
				r.y + h / 2,
				0,
				0,
				0
			],
			delay: k * stg,
			data: cl
		};
	}), [layout, stg]), c.motion);
	const neutral = swatch(p, "neutral");
	const accent = swatch(p, "accent");
	const mode = props.labelMode ?? "both";
	const events = layout.cells.map((cl) => ({
		datum: cl.node.datum,
		index: cl.i,
		key: cl.node.id,
		label: cl.node.label,
		series: cl.node.parent && cl.node.parent.depth > 0 ? cl.node.parent.label : void 0,
		value: cl.node.value,
		formatted: `${c.fv(cl.node.value)} · ${c.pct(cl.pct)}`
	}));
	const byIndex = new Map(layout.cells.map((cl) => [cl.i, cl]));
	const msg = MSG5[c.lang];
	let tip = null;
	if (c.active !== null) {
		const cl = byIndex.get(c.active);
		if (cl) tip = {
			x: cl.rect.x + (cl.rect.w - GAP) / 2,
			y: cl.rect.y + 4,
			title: cl.node.parent && cl.node.parent.depth > 0 ? `${cl.node.parent.label} › ${cl.node.label}` : cl.node.label,
			rows: [{
				label: c.t.value,
				value: c.fv(cl.node.value),
				color: cl.hi ? accent.fill : neutral.fill
			}, {
				label: msg.ofTotal,
				value: c.pct(cl.pct)
			}]
		};
	}
	const desc = props.description ?? `${msg.kind}. ${msg.desc(layout.cells.length)}: ${[...layout.cells].sort((a, b) => b.node.value - a.node.value).slice(0, 3).map((cl) => `${cl.node.label} ${c.pct(cl.pct)}`).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [layout.groups.map((g, k) => {
			if (!(g.rect.h > HEAD + 18 && g.rect.w > 40)) return null;
			const text = `${g.node.label} ${c.pct(g.pct)}`;
			return /* @__PURE__ */ jsx(Txt, {
				x: g.rect.x + 1,
				y: g.rect.y + HEAD / 2 - 1,
				size: 10.5,
				weight: 500,
				fill: p.paint("muted"),
				opacity: m.fade(k * stg * 2, 300),
				children: truncate(text, g.rect.w - GAP - 2, 10.5)
			}, g.node.id);
		}), m.items.map((it) => {
			const cl = it.data;
			const [x, y, w, h, o] = it.v;
			const sw = cl.hi ? accent : neutral;
			const name = cl.node.label;
			const val = c.pct(cl.pct);
			const pad = 7;
			const fs = w > 120 && h > 60 ? 12 : 11;
			const canTwo = mode === "both" && h >= fs * 2 + 16 && w >= Math.min(textWidth(name, fs, 700), 40) + 14;
			const canOne = h >= fs + 12 && w >= 30;
			const active = c.active === cl.i;
			return /* @__PURE__ */ jsxs("g", {
				opacity: it.exiting ? o * .6 : c.dim(cl.i),
				className: "ztd-mark",
				onPointerEnter: (e) => c.setActive(cl.i, e.pointerType === "touch" ? "touch" : "pointer"),
				onClick: () => c.click(cl.i),
				style: { cursor: props.onClick ? "pointer" : void 0 },
				children: [
					/* @__PURE__ */ jsx("path", {
						d: roundRectPath(x, y, w, h, Math.min(p.theme.radiusMark + 1, w / 4, h / 4)),
						fill: sw.fill,
						opacity: o
					}),
					active && c.via === "keyboard" ? /* @__PURE__ */ jsx("path", {
						d: roundRectPath(x + 1, y + 1, w - 2, h - 2, 4),
						fill: "none",
						stroke: p.paint("ink"),
						strokeWidth: 2
					}) : null,
					mode !== "none" && c.showLabels && canOne ? /* @__PURE__ */ jsxs("g", {
						opacity: o * m.fade(cl.i * stg + 200, 260),
						children: [mode === "value" ? /* @__PURE__ */ jsx(Txt, {
							x: x + pad,
							y: y + pad + fs / 2 + 1,
							size: fs,
							weight: 700,
							fill: sw.text,
							children: val
						}) : /* @__PURE__ */ jsx(Txt, {
							x: x + pad,
							y: y + pad + fs / 2 + 1,
							size: fs,
							weight: 700,
							fill: sw.text,
							children: truncate(name, w - 14, fs, 700)
						}), canTwo ? /* @__PURE__ */ jsx(Txt, {
							x: x + pad,
							y: y + pad + fs * 1.7 + 2,
							size: fs - .5,
							weight: 500,
							fill: sw.text,
							children: truncate(val, w - 14, fs - .5)
						}) : null]
					}) : null
				]
			}, it.key);
		})]
	});
}
var MSG6 = {
	en: {
		kind: "Sunburst",
		ofTotal: "% of total",
		desc: (levels) => `${plural(levels, "level")}, innermost ring:`
	},
	ko: {
		kind: "선버스트",
		ofTotal: "전체 대비",
		desc: (levels) => `${levels}단계, 안쪽부터`
	}
};
function labelRoom(r0, r13, a0, a1, h, pad) {
	const rm = (r0 + r13) / 2;
	const mid = (a0 + a1) / 2;
	const [px, py] = polar(0, 0, rm, mid);
	const half = (a1 - a0) / 2 - pad / rm;
	const fits = (w) => {
		if (Math.hypot(Math.max(Math.abs(px) - w / 2, 0), Math.max(Math.abs(py) - h / 2, 0)) < r0 + pad) return false;
		for (const x of [px - w / 2, px + w / 2]) for (const y of [py - h / 2, py + h / 2]) {
			if (Math.hypot(x, y) > r13 - pad) return false;
			const off = Math.atan2(x, -y) - mid;
			if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > half) return false;
		}
		return true;
	};
	if (half <= 0 || !fits(0)) return 0;
	let lo = 0;
	let hi = 2 * r13;
	for (let k = 0; k < 12; k++) {
		const w = (lo + hi) / 2;
		if (fits(w)) lo = w;
		else hi = w;
	}
	return lo;
}
function SunburstChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(200, Math.min(270, w * .62)),
		duration: 900
	});
	const { p, width: W, height: H } = c;
	const tree = useMemo(() => {
		const root = buildTree(props.data, {
			label: props.label,
			value: props.value,
			group: props.group,
			path: props.path,
			children: props.children
		});
		if (props.sort) sortTree(root);
		return root;
	}, [
		props.data,
		props.label,
		props.value,
		props.group,
		props.path,
		props.children,
		props.sort
	]);
	const levels = Math.max(1, treeHeight(tree));
	const arcsBase = useMemo(() => partitionAngles(tree), [tree]);
	const info = useMemo(() => {
		const lv = leaves(tree);
		const hiSet = resolveHighlight(props.highlight, lv.map((l) => l.datum), lv.map((l) => l.label), lv.map((l) => l.value), "max");
		const hiLeaves = new Set([...hiSet].map((k) => lv[k]));
		const hiAnc = /* @__PURE__ */ new Set();
		hiLeaves.forEach((l) => {
			let q = l.parent;
			while (q && q.depth > 0) {
				hiAnc.add(q);
				q = q.parent;
			}
		});
		const total = tree.value || 1;
		return arcsBase.map((a, i) => {
			const leaf = !a.node.children.length;
			const hi = hiLeaves.has(a.node);
			const sw = hi ? swatch(p, "accent") : hiAnc.has(a.node) ? swatch(p, "ink") : leaf ? swatch(p, "neutral") : swatch(p, "strong");
			return {
				...a,
				i,
				sw,
				hi,
				leaf,
				pct: a.node.value / total * 100
			};
		});
	}, [
		arcsBase,
		tree,
		props.highlight,
		p
	]);
	const outer = info.filter((a) => a.depth === levels && a.node.value > 0);
	const labelW = Math.max(40, ...outer.map((a) => textWidth(`${a.node.label} ${c.pct(a.pct)}`, 11, 600))) + 14;
	const R = Math.max(30, Math.min(H / 2 - 10, (W - 2 * labelW) / 2));
	const cx = W / 2;
	const cy = H / 2;
	const hole = R * (props.hole ?? .3);
	const ring = (R - hole) / levels;
	const radii = (d) => [hole + ring * (d - 1) + (d > 1 ? 2 : 0), hole + ring * d];
	const D = c.motion.duration ?? 900;
	const m = useMotion(useMemo(() => {
		const ms = info.map((a) => ({
			key: `a:${a.node.id}`,
			to: [a.a0, a.a1],
			enter: [a.a0, a.a0],
			exit: [(a.a0 + a.a1) / 2, (a.a0 + a.a1) / 2],
			data: a
		}));
		for (let d = 1; d <= levels; d++) ms.push({
			key: `__sweep${d}`,
			to: [TAU],
			from: [0],
			delay: (d - 1) * D * .28,
			data: null
		});
		return ms;
	}, [
		info,
		levels,
		D
	]), c.motion);
	const events = info.map((a) => ({
		datum: a.node.datum,
		index: a.i,
		key: a.node.id,
		label: a.node.label,
		series: a.node.parent && a.node.parent.depth > 0 ? a.node.parent.label : void 0,
		value: a.node.value,
		formatted: `${c.fv(a.node.value)} · ${c.pct(a.pct)}`
	}));
	const outsideLabels = useMemo(() => {
		const list = outer.map((a) => {
			const mid = (a.a0 + a.a1) / 2;
			const [x, y] = polar(cx, cy, R + 10, mid);
			return {
				a,
				x,
				y,
				side: Math.sin(mid) >= 0 ? 1 : -1,
				mid
			};
		});
		const out = /* @__PURE__ */ new Map();
		for (const side of [1, -1]) {
			const g = list.filter((l) => l.side === side);
			const ys = dodgeVertical(g.map((l) => l.y), 14, 7, H - 7);
			g.forEach((l, k) => {
				const nearV = Math.abs(Math.sin(l.mid)) < .18;
				out.set(l.a.node.id, {
					x: l.x + (nearV ? 0 : side * 2),
					y: ys[k],
					anchor: nearV ? "middle" : side > 0 ? "start" : "end"
				});
			});
		}
		return out;
	}, [
		outer,
		cx,
		cy,
		R,
		H
	]);
	const msg = MSG6[c.lang];
	let tip = null;
	if (c.active !== null && info[c.active]) {
		const a = info[c.active];
		const [, r13] = radii(a.depth);
		const [tx, ty] = polar(cx, cy, r13, (a.a0 + a.a1) / 2);
		tip = {
			x: tx,
			y: ty,
			title: a.node.parent && a.node.parent.depth > 0 ? `${a.node.parent.label} › ${a.node.label}` : a.node.label,
			rows: [{
				label: c.t.value,
				value: c.fv(a.node.value),
				color: a.sw.fill
			}, {
				label: msg.ofTotal,
				value: c.pct(a.pct)
			}]
		};
	}
	const desc = props.description ?? `${msg.kind}. ${msg.desc(levels)} ${tree.children.map((ch) => `${ch.label} ${c.pct(ch.value / (tree.value || 1) * 100)}`).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			m.items.map((it) => {
				const a = it.data;
				if (!a) return null;
				const sweep = m.get(`__sweep${a.depth}`)?.[0] ?? TAU;
				const [r0, r13] = radii(a.depth);
				const a0 = Math.min(it.v[0], sweep);
				const a1 = Math.min(it.v[1], sweep);
				const d = arcPath(cx, cy, r0, r13, a0, a1);
				if (!d) return null;
				return /* @__PURE__ */ jsx("path", {
					className: "ztd-mark",
					d,
					fill: a.sw.fill,
					stroke: p.paint("panel"),
					strokeWidth: 1.5,
					strokeLinejoin: "round",
					opacity: it.exiting ? .5 : c.dim(a.i),
					onPointerEnter: (e) => c.setActive(a.i, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(a.i),
					style: { cursor: props.onClick ? "pointer" : void 0 }
				}, it.key);
			}),
			c.active !== null && c.via === "keyboard" && info[c.active] ? /* @__PURE__ */ jsx("path", {
				d: arcPath(cx, cy, radii(info[c.active].depth)[0] - 1, radii(info[c.active].depth)[1] + 2, info[c.active].a0, info[c.active].a1),
				fill: "none",
				stroke: p.paint("ink"),
				strokeWidth: 2,
				pointerEvents: "none"
			}) : null,
			c.showLabels ? /* @__PURE__ */ jsx("g", { children: info.map((a) => {
				const [r0, r13] = radii(a.depth);
				const mid = (a.a0 + a.a1) / 2;
				const o = m.fade((a.depth - 1) * D * .28 + D * .45 + a.a0 / TAU * 200, 260) * c.dim(a.i);
				if (a.depth === levels && levels > 0 && a.leaf) {
					const pos = outsideLabels.get(a.node.id);
					if (!pos) return null;
					const text = `${a.node.label} ${c.pct(a.pct)}`;
					return /* @__PURE__ */ jsx(Txt, {
						x: pos.x,
						y: pos.y,
						anchor: pos.anchor,
						size: 11,
						weight: a.hi ? 800 : 500,
						fill: p.paint(a.hi ? "ink" : "muted"),
						opacity: o,
						children: text
					}, a.node.id);
				}
				const rm = (r0 + r13) / 2;
				const arcLen = (a.a1 - a.a0) * rm;
				const fs = 10.5;
				if (arcLen < 26 || r13 - r0 < 14) return null;
				const name = truncate(a.node.label, labelRoom(r0, r13, a.a0, a.a1, fs, 3), fs, 700);
				if (!name) return null;
				const [x, y] = polar(cx, cy, rm, mid);
				return /* @__PURE__ */ jsx(Txt, {
					x,
					y,
					anchor: "middle",
					size: fs,
					weight: 700,
					fill: a.sw.text,
					opacity: o,
					children: name
				}, a.node.id);
			}) }) : null
		]
	});
}
var AXIS_FONT = 10.5;
function tickLabels(ticks, fmt, locale) {
	const out = ticks.map(fmt);
	if (new Set(out).size === out.length) return out;
	return ticks.map((t) => formatNumber(t, {
		locale,
		maximumFractionDigits: 2
	}));
}
function yAxisWidth(ticks, fmt, locale) {
	let w = 18;
	for (const l of tickLabels(ticks, fmt, locale)) w = Math.max(w, textWidth(l, AXIS_FONT));
	return Math.ceil(w + 8);
}
function GridY(props) {
	const { p, ticks, y, x0, x1, fmt } = props;
	const right = props.side === "right";
	const labels = props.labels === false ? null : tickLabels(ticks, fmt, props.locale);
	return /* @__PURE__ */ jsx("g", {
		"aria-hidden": "true",
		opacity: props.opacity,
		children: ticks.map((t, i) => {
			const yy = Math.round(y(t)) + .5;
			const zero = t === 0 && props.zero !== false;
			return /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("line", {
				x1: x0,
				x2: x1,
				y1: yy,
				y2: yy,
				stroke: p.paint(zero ? "dim" : "line"),
				strokeWidth: 1,
				shapeRendering: "crispEdges",
				opacity: zero ? .7 : 1
			}), labels ? /* @__PURE__ */ jsx(Txt, {
				x: right ? x1 + 6 : x0 - 6,
				y: yy,
				anchor: right ? "start" : "end",
				size: AXIS_FONT,
				fill: p.paint("muted"),
				children: labels[i]
			}) : null] }, t);
		})
	});
}
function fitTickLabels(ticks, lo, hi) {
	const keep = [];
	let lastR = -Infinity;
	for (const t of ticks) {
		const w = textWidth(t.label, AXIS_FONT);
		const l = Math.max(t.x - w / 2, 0);
		if (l < lastR + 8 || t.x - w / 2 < lo || t.x + w / 2 > hi) continue;
		keep.push(t);
		lastR = l + w;
	}
	return keep;
}
function thinLabels(centers, labels, size = AXIS_FONT, gap = 8, weight = 400, keep) {
	const n = labels.length;
	if (n <= 1) return labels.map((_, i) => i);
	const widths = labels.map((l) => textWidth(l, size, weight));
	const near = (a, b) => Math.abs(centers[b] - centers[a]) < (widths[a] + widths[b]) / 2 + gap;
	const must = [];
	for (const k of keep ?? []) if (!must.some((m) => near(m, k))) must.push(k);
	const free = (i) => !must.some((m) => near(m, i));
	for (let step = 1; step <= n; step++) {
		const idx = must.slice();
		for (let i = 0; i < n; i += step) if (free(i)) idx.push(i);
		if (step > 1 && (n - 1) % step > step / 2 && free(n - 1)) idx.push(n - 1);
		idx.sort((a, b) => a - b);
		if (idx.every((b, k) => !k || !near(idx[k - 1], b))) return idx;
	}
	return [0, n - 1];
}
function AxisXBand(props) {
	const { p, labels, centers, y } = props;
	const size = props.size ?? AXIS_FONT;
	const show = thinLabels(centers, labels, size, 6, 600, props.strong);
	return /* @__PURE__ */ jsx("g", {
		"aria-hidden": "true",
		children: show.map((i) => {
			const strong = props.strong?.has(i);
			return /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx(Txt, {
				x: centers[i],
				y,
				anchor: "middle",
				size,
				weight: strong ? 700 : 500,
				fill: p.paint(strong ? "ink" : "muted"),
				children: labels[i]
			}), props.sub?.[i] ? /* @__PURE__ */ jsx(Txt, {
				x: centers[i],
				y: y + size + 3,
				anchor: "middle",
				size: size - 1,
				fill: p.paint("muted"),
				children: props.sub[i]
			}) : null] }, i);
		})
	});
}
var r1 = (v) => Math.round(v * 10) / 10;
function HoverLine(props) {
	const { p } = props;
	return /* @__PURE__ */ jsxs("g", {
		className: "ztd-guide",
		"aria-hidden": "true",
		pointerEvents: "none",
		style: { transform: `translate(${r1(props.x)}px,0px)` },
		children: [/* @__PURE__ */ jsx("line", {
			x1: 0,
			x2: 0,
			y1: props.top,
			y2: props.bottom,
			stroke: p.paint("dim"),
			strokeWidth: 1
		}), props.dots?.map((d) => /* @__PURE__ */ jsxs("g", {
			className: "ztd-guide",
			style: { transform: `translate(0px,${r1(d.y)}px)` },
			children: [/* @__PURE__ */ jsx("circle", {
				r: d.strong ? 9 : 7,
				fill: d.color,
				opacity: .2
			}), /* @__PURE__ */ jsx("circle", {
				r: d.strong ? 4.2 : 3.2,
				fill: d.color,
				stroke: p.paint("panel"),
				strokeWidth: 2
			})]
		}, d.k))]
	});
}
function AxisPill(props) {
	const { p } = props;
	const label = truncate(props.label, 160, AXIS_FONT, 700);
	const w = textWidth(label, AXIS_FONT, 700) + 14;
	const x = Math.max(w / 2 + 1, Math.min(props.width - w / 2 - 1, props.x));
	return /* @__PURE__ */ jsxs("g", {
		className: "ztd-guide",
		"aria-hidden": "true",
		pointerEvents: "none",
		style: { transform: `translate(${r1(x)}px,${r1(props.y)}px)` },
		children: [/* @__PURE__ */ jsx("rect", {
			x: -w / 2,
			y: -9,
			width: w,
			height: 18,
			rx: 9,
			fill: p.paint("ink"),
			stroke: p.paint("panel"),
			strokeWidth: 3,
			paintOrder: "stroke"
		}), /* @__PURE__ */ jsx(Txt, {
			x: 0,
			y: 0,
			anchor: "middle",
			size: AXIS_FONT,
			weight: 700,
			fill: p.paint("onInk"),
			children: label
		})]
	});
}
var MSG7 = {
	en: {
		kind: "Waterfall chart",
		total: "Total",
		up: "Increase",
		down: "Decrease",
		cum: "Cumulative"
	},
	ko: {
		kind: "폭포 차트",
		total: "합계",
		up: "증가",
		down: "감소",
		cum: "누적"
	}
};
function WaterfallChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(190, Math.min(260, w * .55)),
		duration: 650,
		stagger: 130
	});
	const { p, width: W, height: H } = c;
	const msg = MSG7[c.lang];
	const totalLabel = msg.total;
	const steps = useMemo(() => {
		const gl = strGetter(props.label, "label");
		const gv = numGetter(props.value, "value");
		const gt = props.type ? getter(props.type, "type") : getter(void 0, "type");
		const out = [];
		let run = 0;
		props.data.forEach((d, i) => {
			const raw = gv(d, i);
			const t = String(gt(d, i) ?? "").toLowerCase();
			if (t === "total" || t === "합계" || i === 0 && props.startTotal !== false && t !== "delta") {
				const v = Number.isFinite(raw) ? raw : run;
				out.push({
					i,
					label: gl(d, i),
					value: v,
					start: 0,
					end: v,
					total: true,
					hi: false,
					datum: d
				});
				run = v;
			} else {
				const v = Number.isFinite(raw) ? raw : 0;
				out.push({
					i,
					label: gl(d, i),
					value: v,
					start: run,
					end: run + v,
					total: false,
					hi: false,
					datum: d
				});
				run += v;
			}
		});
		if (props.endTotal) out.push({
			i: out.length,
			label: typeof props.endTotal === "string" ? props.endTotal : totalLabel,
			value: run,
			start: 0,
			end: run,
			total: true,
			hi: false,
			datum: null
		});
		const deltas = out.map((s) => s.total ? -Infinity : s.value);
		resolveHighlight(props.highlight, out.map((s) => s.datum), out.map((s) => s.label), deltas, "max").forEach((k) => {
			if (out[k]) out[k].hi = true;
		});
		return out;
	}, [
		props.data,
		props.label,
		props.value,
		props.type,
		props.startTotal,
		props.endTotal,
		props.highlight,
		totalLabel
	]);
	const dom = fitDomain(Math.min(0, ...steps.map((s) => Math.min(s.start, s.end))), Math.max(0, ...steps.map((s) => Math.max(s.start, s.end))), 3);
	const tickFmt = makeTickFormatter(props.format, c.locale, Math.max(Math.abs(dom[0]), Math.abs(dom[1])));
	const ticks = scaleLinear(dom, [0, 1]).ticks(3);
	const left = yAxisWidth(ticks, tickFmt, c.locale);
	const top = 20;
	const bottom = 22;
	const y = scaleLinear(dom, [H - bottom, top]);
	const x = scaleBand(steps.map((s) => `${s.i}`), [left + 4, W - 2], .34, .12);
	const bw = x.bandwidth;
	const r = Math.min(p.theme.radiusMark, bw / 4);
	const stg = c.motion.stagger ?? 130;
	const m = useMotion(useMemo(() => steps.map((s, k) => {
		const y0 = y(s.start);
		const y1 = y(s.end);
		return {
			key: `w:${s.label}`,
			to: [
				y0,
				y1,
				1
			],
			from: [
				y0,
				y0,
				0
			],
			enter: [
				y0,
				y0,
				0
			],
			delay: k * stg,
			data: s
		};
	}), [
		steps,
		dom[0],
		dom[1],
		H,
		stg
	]), c.motion);
	const total = swatch(p, "ink");
	const accent = swatch(p, "accent");
	const inc = swatch(p, "neutral");
	const dec = swatch(p, "strong");
	const signed = (v, f) => v > 0 ? `+${f(v)}` : v < 0 ? `−${f(-v)}` : f(0);
	const signFmt = (v) => signed(v, c.fmt);
	const events = steps.map((s, k) => ({
		datum: s.datum,
		index: k,
		key: s.label,
		label: s.label,
		value: s.value,
		formatted: s.total ? c.fv(s.value) : signed(s.value, c.fv)
	}));
	let tip = null;
	if (c.active !== null && steps[c.active]) {
		const s = steps[c.active];
		tip = {
			x: x(`${s.i}`) + bw / 2,
			y: Math.min(y(s.start), y(s.end)),
			title: s.label,
			rows: s.total ? [{
				label: totalLabel,
				value: c.fv(s.value),
				color: total.fill
			}] : [{
				label: s.value >= 0 ? msg.up : msg.down,
				value: signed(s.value, c.fv),
				color: s.hi ? accent.fill : s.value >= 0 ? inc.fill : dec.fill
			}, {
				label: msg.cum,
				value: c.fv(s.end)
			}]
		};
	}
	const desc = props.description ?? `${msg.kind}. ${steps.map((s) => s.total ? `${s.label} ${c.fv(s.value)}` : `${s.label} ${signFmt(s.value)}`).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			/* @__PURE__ */ jsx(GridY, {
				p,
				ticks,
				y,
				x0: left,
				x1: W,
				fmt: tickFmt,
				locale: c.locale
			}),
			m.items.map((it) => {
				const s = it.data;
				if (it.exiting) return null;
				const k = s.i;
				const [ya, yb, o] = it.v;
				const top0 = Math.min(ya, yb);
				const h = Math.abs(yb - ya);
				const sw = s.total ? total : s.hi ? accent : s.value >= 0 ? inc : dec;
				const bx = x(`${k}`);
				const next = steps[k + 1];
				const lvl = y(s.end);
				const labelY = (s.total || s.value >= 0 ? top0 : top0 + h) + (s.total || s.value >= 0 ? -9 : 10);
				const lo2 = m.fade(k * stg + 260, 240);
				return /* @__PURE__ */ jsxs("g", {
					className: "ztd-mark",
					opacity: c.dim(s.i),
					onPointerEnter: (e) => c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(k),
					children: [
						/* @__PURE__ */ jsx("rect", {
							x: Math.max(0, bx - (x.step - bw) / 2),
							y: top,
							width: Math.max(0, Math.min(W, bx - (x.step - bw) / 2 + x.step) - Math.max(0, bx - (x.step - bw) / 2)),
							height: H - bottom - top,
							fill: "transparent"
						}),
						props.connectors !== false && next ? /* @__PURE__ */ jsx("line", {
							x1: bx + bw,
							x2: x(`${k + 1}`),
							y1: Math.round(lvl) + .5,
							y2: Math.round(lvl) + .5,
							stroke: p.paint("dim"),
							strokeWidth: 1,
							strokeDasharray: "2 3",
							opacity: lo2 * .9
						}) : null,
						/* @__PURE__ */ jsx("path", {
							d: roundRectPath(bx, top0, bw, Math.max(h, o > 0 ? 1 : 0), s.value >= 0 || s.total ? {
								tl: r,
								tr: r
							} : {
								bl: r,
								br: r
							}),
							fill: sw.fill,
							opacity: Math.max(.001, o)
						}),
						c.active === k && c.via === "keyboard" ? /* @__PURE__ */ jsx("path", {
							d: roundRectPath(bx - 3, top0 - 3, bw + 6, h + 6, 5),
							fill: "none",
							stroke: p.paint("ink"),
							strokeWidth: 2
						}) : null,
						c.showLabels ? /* @__PURE__ */ jsx(Txt, {
							x: bx + bw / 2,
							y: labelY,
							anchor: "middle",
							size: 11,
							weight: s.total || s.hi ? 800 : 500,
							fill: p.paint(s.total || s.hi ? "ink" : "muted"),
							opacity: lo2,
							children: s.total ? c.fmt(s.value) : signFmt(s.value)
						}) : null
					]
				}, it.key);
			}),
			/* @__PURE__ */ jsx(AxisXBand, {
				p,
				labels: steps.map((s) => s.label),
				centers: steps.map((s) => x(`${s.i}`) + bw / 2),
				y: H - bottom + 13,
				strong: new Set(steps.map((s, k) => s.total ? k : -1).filter((k) => k >= 0))
			})
		]
	});
}
var MSG8 = {
	en: {
		kind: "Pareto chart",
		share: "Share",
		cum: "Cumulative",
		rank: (r) => `#${r}`,
		summary: (v, share, cum) => `${v} · share ${share} · cumulative ${cum}`,
		desc: (n, top, cum) => `${plural(n, "item")}, the top ${top} add up to ${cum}.`
	},
	ko: {
		kind: "파레토 차트",
		share: "비중",
		cum: "누적",
		rank: (r) => `${r}위`,
		summary: (v, share, cum) => `${v} · 비중 ${share} · 누적 ${cum}`,
		desc: (n, top, cum) => `${n}개 항목, 상위 ${top}개가 누적 ${cum}를 차지해요.`
	}
};
function ParetoChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(190, Math.min(260, w * .55)),
		duration: 650,
		stagger: 55
	});
	const { p, width: W, height: H } = c;
	const msg = MSG8[c.lang];
	const th = props.threshold ?? 80;
	const bars = useMemo(() => {
		const gl = strGetter(props.label, "label");
		const gv = numGetter(props.value, "value");
		let rows = props.data.map((d, i) => ({
			d,
			i,
			label: gl(d, i),
			value: Math.max(0, gv(d, i) || 0)
		}));
		if (props.sort !== false) rows = [...rows].sort((a, b) => b.value - a.value);
		const total = sum(rows.map((r3) => r3.value)) || 1;
		let acc = 0;
		const out = rows.map((r3, k) => {
			acc += r3.value;
			return {
				i: k,
				label: r3.label,
				value: r3.value,
				share: r3.value / total * 100,
				cum: acc / total * 100,
				hi: false,
				datum: r3.d
			};
		});
		if (props.highlight !== void 0) resolveHighlight(props.highlight, out.map((b) => b.datum), out.map((b) => b.label), out.map((b) => b.value)).forEach((k) => out[k].hi = true);
		else for (const b of out) {
			b.hi = true;
			if (b.cum >= th - .5) break;
			const next = out[b.i + 1];
			if (next && next.cum > th + .5) break;
		}
		return out;
	}, [
		props.data,
		props.label,
		props.value,
		props.sort,
		props.highlight,
		th
	]);
	const ticks = [
		0,
		50,
		100
	];
	const tickFmt = (v) => String(v);
	const left = yAxisWidth(ticks, tickFmt);
	const top = 12;
	const bottom = 22;
	const right = 30;
	const y = scaleLinear([0, 100], [H - bottom, top]);
	const labels = bars.map((b, k) => props.rankLabels ? msg.rank(k + 1) : b.label);
	const x = scaleBand(labels.map((_, k) => `${k}`), [left + 4, W - right], .28, .1);
	const bw = x.bandwidth;
	const cxs = labels.map((_, k) => x(`${k}`) + bw / 2);
	const stg = c.motion.stagger ?? 55;
	const D = c.motion.duration ?? 650;
	const lineDelay = bars.length * stg * .6 + D * .35;
	const m = useMotion(useMemo(() => {
		const ms = bars.map((b, k) => ({
			key: `b:${b.label}`,
			to: [y(b.share), y(b.cum)],
			from: [y(0), y(0)],
			enter: [y(0), y(0)],
			delay: k * stg,
			data: b
		}));
		ms.push({
			key: "__draw",
			to: [1],
			from: [0],
			delay: lineDelay,
			data: null
		});
		return ms;
	}, [
		bars,
		H,
		stg,
		lineDelay
	]), { ...c.motion });
	const draw = m.get("__draw")?.[0] ?? 1;
	const accent = swatch(p, "accent");
	const neutral = swatch(p, "neutral");
	const pts2 = [];
	m.items.forEach((it) => {
		if (it.data && !it.exiting) pts2[it.data.i] = [cxs[it.data.i] ?? 0, it.v[1]];
	});
	const lastHi = [...bars].reverse().find((b) => b.hi);
	const events = bars.map((b) => ({
		datum: b.datum,
		index: b.i,
		key: b.label,
		label: b.label,
		value: b.value,
		formatted: msg.summary(c.fv(b.value), c.pct(b.share), c.pct(b.cum))
	}));
	let tip = null;
	if (c.active !== null && bars[c.active]) {
		const b = bars[c.active];
		tip = {
			x: cxs[b.i],
			y: Math.min(y(b.share), y(b.cum)),
			title: `${props.rankLabels ? `${msg.rank(b.i + 1)} · ` : ""}${b.label}`,
			rows: [
				{
					label: c.t.value,
					value: c.fv(b.value),
					color: b.hi ? accent.fill : neutral.fill
				},
				{
					label: msg.share,
					value: c.pct(b.share)
				},
				{
					label: msg.cum,
					value: c.pct(b.cum)
				}
			]
		};
	}
	const desc = props.description ?? `${msg.kind}. ${msg.desc(bars.length, bars.filter((b) => b.hi).length, lastHi ? c.pct(lastHi.cum) : "-")}`;
	const r = Math.min(p.theme.radiusMark, bw / 4);
	const thY = y(th);
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			/* @__PURE__ */ jsx(GridY, {
				p,
				ticks,
				y,
				x0: left,
				x1: W - right,
				fmt: tickFmt
			}),
			/* @__PURE__ */ jsx("line", {
				x1: left,
				x2: W - right,
				y1: thY,
				y2: thY,
				stroke: p.paint("dim"),
				strokeDasharray: "3 3",
				strokeWidth: 1
			}),
			/* @__PURE__ */ jsx(Txt, {
				x: W - right + 4,
				y: thY,
				size: 10.5,
				fill: p.paint("muted"),
				children: `${th}%`
			}),
			m.items.map((it) => {
				const b = it.data;
				if (!b || it.exiting) return null;
				const yy = it.v[0];
				const h = y(0) - yy;
				const k = b.i;
				return /* @__PURE__ */ jsxs("g", {
					className: "ztd-mark",
					opacity: c.dim(k),
					onPointerEnter: (e) => c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(k),
					children: [
						/* @__PURE__ */ jsx("rect", {
							x: x(`${k}`) - (x.step - bw) / 2,
							y: top,
							width: x.step,
							height: H - bottom - top,
							fill: "transparent"
						}),
						/* @__PURE__ */ jsx("path", {
							d: roundRectPath(x(`${k}`), yy, bw, Math.max(0, h), {
								tl: r,
								tr: r
							}),
							fill: b.hi ? accent.fill : neutral.fill
						}),
						c.active === k && c.via === "keyboard" ? /* @__PURE__ */ jsx("path", {
							d: roundRectPath(x(`${k}`) - 3, yy - 3, bw + 6, h + 6, 5),
							fill: "none",
							stroke: p.paint("ink"),
							strokeWidth: 2
						}) : null
					]
				}, it.key);
			}),
			pts2.length > 1 ? /* @__PURE__ */ jsx("path", {
				d: linePath(pts2, "linear"),
				fill: "none",
				stroke: p.paint("ink"),
				strokeWidth: 1.6,
				strokeLinejoin: "round",
				pathLength: 1,
				strokeDasharray: draw < 1 ? "1 1" : void 0,
				strokeDashoffset: draw < 1 ? 1 - draw : void 0,
				pointerEvents: "none"
			}) : null,
			pts2.map((pt, k) => {
				const b = bars[k];
				if (!b) return null;
				const appear = Math.max(0, Math.min(1, (draw - k / Math.max(1, pts2.length - 1)) * 6 + (draw >= 1 ? 1 : 0)));
				const isMark = lastHi && b.i === lastHi.i;
				return /* @__PURE__ */ jsx("circle", {
					cx: pt[0],
					cy: pt[1],
					r: isMark ? 3.6 : 2.4,
					fill: p.paint("ink"),
					opacity: Math.min(1, appear),
					pointerEvents: "none"
				}, k);
			}),
			lastHi && c.showLabels && pts2[lastHi.i] ? /* @__PURE__ */ jsx(Txt, {
				x: pts2[lastHi.i][0] + 8,
				y: pts2[lastHi.i][1] + 12,
				size: 12,
				weight: 800,
				fill: p.paint("ink"),
				opacity: Math.max(0, (draw - .6) / .4),
				children: c.pct(lastHi.cum)
			}) : null,
			/* @__PURE__ */ jsx(AxisXBand, {
				p,
				labels,
				centers: cxs,
				y: H - bottom + 13
			})
		]
	});
}
var MSG9 = {
	en: {
		kind: "Marimekko chart",
		inCol: "Share in column",
		colShare: "Column share",
		desc: (cols, series) => `Columns: ${cols}. Series: ${series}`
	},
	ko: {
		kind: "마리메코 차트",
		inCol: "열 안 비중",
		colShare: "열 비중",
		desc: (cols, series) => `열 ${cols}. 계열 ${series}`
	}
};
function MarimekkoChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(200, Math.min(270, w * .58)),
		duration: 700,
		stagger: 120
	});
	const { p, width: W, height: H } = c;
	const msg = MSG9[c.lang];
	const model = useMemo(() => {
		const gx = strGetter(props.x, "x");
		const gs = strGetter(props.series, "series");
		const gv = numGetter(props.value, "value");
		const rows = props.data.map((d, i) => ({
			d,
			x: gx(d, i),
			s: gs(d, i),
			v: Math.max(0, gv(d, i) || 0)
		}));
		const cols = uniq(rows.map((r3) => r3.x));
		const series = uniq(rows.map((r3) => r3.s));
		const val = /* @__PURE__ */ new Map();
		rows.forEach((r3) => {
			const k = `${r3.x}\0${r3.s}`;
			const prev = val.get(k);
			val.set(k, {
				v: (prev?.v ?? 0) + r3.v,
				d: r3.d
			});
		});
		const colTot = cols.map((cx) => sum(series.map((s) => val.get(`${cx}\0${s}`)?.v ?? 0)));
		return {
			cols,
			series,
			val,
			colTot,
			total: sum(colTot) || 1,
			hi: resolveHighlight(props.highlight, series, series, series.map(() => 0), "first")
		};
	}, [
		props.data,
		props.x,
		props.series,
		props.value,
		props.highlight
	]);
	const colors = categorical(p, model.series.length, model.hi);
	const ticks = [
		0,
		50,
		100
	];
	const tf = (v) => String(v);
	const left = yAxisWidth(ticks, tf);
	const top = 6;
	const bottom = 34;
	const gap = 3;
	const plotW = W - left - 4;
	const y = scaleLinear([0, 100], [H - bottom, top]);
	const segs = useMemo(() => {
		const out = [];
		let acc = 0;
		const usable = plotW - gap * Math.max(0, model.cols.length - 1);
		model.cols.forEach((cx, ci) => {
			const w = model.colTot[ci] / model.total * usable;
			const x0 = left + 4 + acc;
			acc += w + gap;
			let ys = 0;
			model.series.forEach((s, si) => {
				const hit = model.val.get(`${cx}\0${s}`);
				const v = hit?.v ?? 0;
				const share = model.colTot[ci] ? v / model.colTot[ci] * 100 : 0;
				out.push({
					key: `${cx}|${s}`,
					col: ci,
					s: si,
					x: cx,
					series: s,
					value: v,
					share,
					colShare: model.colTot[ci] / model.total * 100,
					x0,
					x1: x0 + w,
					y0: ys,
					y1: ys + share,
					sw: colors[si],
					datum: hit?.d ?? null
				});
				ys += share;
			});
		});
		return out;
	}, [
		model,
		plotW,
		left,
		colors
	]);
	const stg = c.motion.stagger ?? 120;
	const m = useMotion(useMemo(() => segs.map((sg) => ({
		key: sg.key,
		to: [
			sg.x0,
			sg.x1,
			y(sg.y0),
			y(sg.y1)
		],
		from: [
			sg.x0,
			sg.x1,
			y(0),
			y(0)
		],
		enter: [
			sg.x0,
			sg.x1,
			y(sg.y0),
			y(sg.y0)
		],
		delay: sg.col * stg + sg.s * 40,
		data: sg
	})), [
		segs,
		H,
		stg
	]), c.motion);
	const events = segs.map((sg, k) => ({
		datum: sg.datum,
		index: k,
		key: sg.key,
		label: sg.x,
		series: sg.series,
		value: sg.value,
		formatted: `${c.pct(sg.share)} · ${c.fv(sg.value)}`
	}));
	const r = p.theme.radiusMark;
	let tip = null;
	if (c.active !== null && segs[c.active]) {
		const sg = segs[c.active];
		tip = {
			x: (sg.x0 + sg.x1) / 2,
			y: y(sg.y1),
			title: `${sg.x} · ${sg.series}`,
			rows: [
				{
					label: msg.inCol,
					value: c.pct(sg.share),
					color: sg.sw.fill
				},
				{
					label: c.t.value,
					value: c.fv(sg.value)
				},
				{
					label: msg.colShare,
					value: c.pct(sg.colShare)
				}
			]
		};
	}
	const desc = props.description ?? `${msg.kind}. ${msg.desc(model.cols.map((cx, ci) => `${cx} ${c.pct(model.colTot[ci] / model.total * 100)}`).join(", "), model.series.join(", "))}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			/* @__PURE__ */ jsx(GridY, {
				p,
				ticks,
				y,
				x0: left,
				x1: W,
				fmt: tf
			}),
			m.items.map((it) => {
				const sg = it.data;
				const [x0, x1, ya, yb] = it.v;
				const k = segs.indexOf(sg);
				const w = Math.max(0, x1 - x0);
				const h = Math.max(0, ya - yb);
				const isTop = sg.s === model.series.length - 1;
				const isBottom = sg.s === 0;
				const corners = {
					tl: isTop ? r : 0,
					tr: isTop ? r : 0,
					bl: isBottom ? r : 0,
					br: isBottom ? r : 0
				};
				const text = c.pct(sg.share);
				const fits = h >= 18 && w >= textWidth(text, 12, 700) + 10;
				return /* @__PURE__ */ jsxs("g", {
					className: "ztd-mark",
					opacity: it.exiting ? .5 : c.dim(k),
					onPointerEnter: (e) => c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(k),
					children: [
						/* @__PURE__ */ jsx("path", {
							d: roundRectPath(x0, yb, w, h, corners),
							fill: sg.sw.fill,
							stroke: p.paint("panel"),
							strokeWidth: h > 2 ? 1.5 : 0
						}),
						c.active === k && c.via === "keyboard" ? /* @__PURE__ */ jsx("path", {
							d: roundRectPath(x0 + 1, yb + 1, w - 2, h - 2, 3),
							fill: "none",
							stroke: sg.sw.text,
							strokeWidth: 2
						}) : null,
						c.showLabels && fits ? /* @__PURE__ */ jsx(Txt, {
							x: x0 + w / 2,
							y: yb + h / 2,
							anchor: "middle",
							size: 12,
							weight: 700,
							fill: sg.sw.text,
							opacity: m.fade(sg.col * stg + 380, 260),
							children: text
						}) : null
					]
				}, it.key);
			}),
			/* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: model.cols.map((cx, ci) => {
					const sg = segs.find((s) => s.col === ci);
					if (!sg) return null;
					const mid = (sg.x0 + sg.x1) / 2;
					const w = sg.x1 - sg.x0;
					return /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx(Txt, {
						x: mid,
						y: H - bottom + 12,
						anchor: "middle",
						size: 11,
						weight: 700,
						fill: p.paint("ink"),
						children: truncate(cx, w + 4, 11, 700)
					}), /* @__PURE__ */ jsx(Txt, {
						x: mid,
						y: H - bottom + 26,
						anchor: "middle",
						size: 10,
						fill: p.paint("muted"),
						children: c.pct(sg.colShare)
					})] }, cx);
				})
			})
		]
	});
}
function CanvasLayer(props) {
	const ref = useRef(null);
	const used = useRef(/* @__PURE__ */ new Map());
	const [tick, setTick] = useState(0);
	const { width, height, draw, progress, version, clipRight, manualClear } = props;
	useEffect(() => {
		const cv = ref.current;
		if (!cv) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const W = Math.max(1, Math.round(width * dpr));
		const H = Math.max(1, Math.round(height * dpr));
		if (cv.width !== W) cv.width = W;
		if (cv.height !== H) cv.height = H;
		const ctx = cv.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (!manualClear) ctx.clearRect(0, 0, width, height);
		const cs = getComputedStyle(cv);
		const cache2 = /* @__PURE__ */ new Map();
		const color = (v, fb) => {
			let c = cache2.get(v);
			if (c === void 0) {
				c = cs.getPropertyValue(v).trim();
				cache2.set(v, c);
			}
			return c || fb;
		};
		draw(ctx, progress, color);
		used.current = cache2;
	}, [
		width,
		height,
		draw,
		progress,
		version,
		manualClear,
		tick
	]);
	useEffect(() => {
		const cv = ref.current;
		if (!cv || typeof matchMedia !== "function") return void 0;
		const ac = new AbortController();
		const redraw = () => setTick((n) => n + 1);
		const check = () => {
			const cs = getComputedStyle(cv);
			for (const [v, c] of used.current) if (cs.getPropertyValue(v).trim() !== c) return redraw();
		};
		const watchDpr = () => {
			matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener?.("change", () => {
				watchDpr();
				redraw();
			}, {
				once: true,
				signal: ac.signal
			});
		};
		watchDpr();
		matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", check, { signal: ac.signal });
		const mo = new MutationObserver(check);
		for (let el = cv.parentElement; el; el = el.parentElement) mo.observe(el, { attributes: true });
		return () => {
			ac.abort();
			mo.disconnect();
		};
	}, []);
	return /* @__PURE__ */ jsx("canvas", {
		ref,
		"aria-hidden": "true",
		style: {
			position: "absolute",
			left: 0,
			top: 0,
			width: "100%",
			height: "auto",
			aspectRatio: `${width} / ${height}`,
			pointerEvents: "none",
			clipPath: clipRight ? `inset(0 ${(clipRight / Math.max(1, width) * 100).toFixed(3)}% 0 0)` : void 0
		}
	});
}
var MSG10 = {
	en: {
		kind: "Heatmap",
		legend: ["Less", "More"],
		desc: (rows, cols, mn, mx) => `${plural(rows, "row")} × ${plural(cols, "column")}, values from ${mn} to ${mx}`
	},
	ko: {
		kind: "히트맵",
		legend: ["적음", "많음"],
		desc: (rows, cols, mn, mx) => `${rows}행 × ${cols}열, 값 ${mn}에서 ${mx}까지`
	}
};
function Heatmap(props) {
	const c = useChart(props, {
		height: (w) => Math.max(180, Math.min(300, w * .48)),
		duration: 600,
		stagger: 0
	});
	const { p, width: W, height: H } = c;
	const model = useMemo(() => {
		const gx = strGetter(props.x, "x");
		const gy = strGetter(props.y, "y");
		const gv = numGetter(props.value, "value");
		const xs = uniq(props.data.map((d, i) => gx(d, i)));
		const ys = uniq(props.data.map((d, i) => gy(d, i)));
		const xi = new Map(xs.map((k, i) => [k, i]));
		const yi = new Map(ys.map((k, i) => [k, i]));
		const vals = new Float64Array(xs.length * ys.length).fill(NaN);
		const rows = new Array(xs.length * ys.length).fill(null);
		props.data.forEach((d, i) => {
			const cx = xi.get(gx(d, i));
			const cy = yi.get(gy(d, i));
			if (cx === void 0 || cy === void 0) return;
			const idx = cy * xs.length + cx;
			const v = gv(d, i);
			if (Number.isFinite(v)) vals[idx] = Number.isFinite(vals[idx]) ? vals[idx] + v : v;
			rows[idx] = d;
		});
		const [mn, mx] = extent(vals);
		return {
			xs,
			ys,
			vals,
			rows,
			mn,
			mx
		};
	}, [
		props.data,
		props.x,
		props.y,
		props.value
	]);
	const nx = model.xs.length;
	const ny = model.ys.length;
	const nCells = nx * ny;
	const useCanvas = c.hydrated && nCells > (props.canvasThreshold ?? 2500);
	const legendH = props.legend === false ? 0 : 20;
	const leftW = Math.min(W * .3, Math.max(...model.ys.map((l) => textWidth(l, AXIS_FONT, 500)), 10) + 8);
	const bottom = 20;
	const x0 = leftW + 4;
	const y0 = legendH;
	const cw = (W - x0) / Math.max(1, nx);
	const ch = (H - y0 - bottom) / Math.max(1, ny);
	const gap = Math.min(cw, ch) > 14 ? 2.5 : Math.min(cw, ch) > 5 ? 1 : 0;
	const rad = Math.min(p.theme.radiusMark, Math.min(cw, ch) / 4);
	const top95 = useMemo(() => robustMax(model.vals), [model.vals]);
	const span2 = Math.max(1e-9, top95 - model.mn) || 1;
	const hiSet = useMemo(() => {
		const labels = Array.from({ length: nCells }, (_, i) => `${model.xs[i % nx]}|${model.ys[Math.floor(i / nx)]}`);
		return resolveHighlight(props.highlight, model.rows, labels, Array.from(model.vals), "max");
	}, [
		model,
		nCells,
		nx,
		props.highlight
	]);
	const cells = useMemo(() => {
		const out = [];
		for (let i = 0; i < nCells; i++) {
			const v = model.vals[i];
			if (!Number.isFinite(v)) continue;
			out.push({
				i,
				col: i % nx,
				row: Math.floor(i / nx),
				value: v,
				t: Math.min(1, (v - model.mn) / span2),
				datum: model.rows[i]
			});
		}
		return out;
	}, [
		model,
		nCells,
		nx,
		span2
	]);
	const D = c.motion.duration ?? 600;
	const m = useMotion(useMemo(() => {
		if (useCanvas) return [{
			key: "__p",
			to: [1],
			from: [0],
			data: null
		}];
		return cells.map((cl) => ({
			key: `h${cl.i}`,
			to: [1],
			from: [0],
			delay: (cl.col / Math.max(1, nx - 1) * .6 + cl.row / Math.max(1, ny - 1) * .4) * D * .9,
			data: cl
		}));
	}, [
		cells,
		useCanvas,
		nx,
		ny,
		D
	]), c.motion);
	const showValues = props.showValues ?? "auto";
	const sample = c.fmt(model.mx);
	const valuesOn = c.showLabels && (showValues === true || showValues === "auto" && cw >= textWidth(sample, 10.5, 600) + 8 && ch >= 15);
	const fv = c.fv;
	const events = useMemo(() => lazyArray(cells.length, (k) => {
		const cl = cells[k];
		return {
			datum: cl.datum,
			index: cl.i,
			key: `${model.xs[cl.col]}|${model.ys[cl.row]}`,
			label: `${model.ys[cl.row]} · ${model.xs[cl.col]}`,
			value: cl.value,
			formatted: fv(cl.value)
		};
	}), [
		cells,
		model,
		fv
	]);
	const evIndex = useMemo(() => new Map(cells.map((cl, k) => [cl.i, k])), [cells]);
	const pick = (px, py) => {
		const col = Math.floor((px - x0) / cw);
		const row = Math.floor((py - y0) / ch);
		if (col < 0 || row < 0 || col >= nx || row >= ny) return null;
		const k = evIndex.get(row * nx + col);
		return k === void 0 ? null : k;
	};
	let tip = null;
	if (c.active !== null && cells[c.active]) {
		const cl = cells[c.active];
		tip = {
			x: x0 + cl.col * cw + cw / 2,
			y: y0 + cl.row * ch,
			title: `${model.ys[cl.row]} · ${model.xs[cl.col]}`,
			rows: [{
				label: c.t.value,
				value: c.fv(cl.value),
				color: p.paint("accent")
			}]
		};
	}
	const prog = useCanvas ? m.get("__p")?.[0] ?? 1 : 1;
	const draw = useCallback((ctx, t, color) => {
		ctx.fillStyle = color("--ztd-accent", p.theme.accent);
		for (const cl of cells) {
			const wave = cl.col / Math.max(1, nx - 1) * .6 + cl.row / Math.max(1, ny - 1) * .4;
			const o = Math.max(0, Math.min(1, (t * 1.25 - wave) * 4));
			if (o <= 0) continue;
			ctx.globalAlpha = (.08 + .92 * cl.t) * o;
			ctx.fillRect(x0 + cl.col * cw + gap / 2, y0 + cl.row * ch + gap / 2, Math.max(.5, cw - gap), Math.max(.5, ch - gap));
		}
		ctx.globalAlpha = 1;
	}, [
		cells,
		nx,
		ny,
		x0,
		y0,
		cw,
		ch,
		gap,
		p.theme.accent
	]);
	const xLabelIdx = useMemo(() => thinLabels(model.xs.map((_, i) => x0 + i * cw + cw / 2), model.xs, AXIS_FONT, 6), [
		model.xs,
		x0,
		cw
	]);
	const yLabelIdx = ch >= 11 ? model.ys.map((_, i) => i) : model.ys.map((_, i) => i).filter((i) => i % Math.ceil(12 / Math.max(1, ch)) === 0);
	const msg = MSG10[c.lang];
	const desc = props.description ?? `${msg.kind}. ${msg.desc(ny, nx, c.fv(model.mn), c.fv(model.mx))}.`;
	const ll = props.legendLabels ?? msg.legend;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, py, e) => {
			const k = pick(px, py);
			if (k !== c.active) c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer");
		},
		onKey: (e) => {
			const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
			const cl = c.active === null ? null : cells[c.active];
			if (!d || !cl) return false;
			for (let r = cl.row + d; r >= 0 && r < ny; r += d) {
				const k = evIndex.get(r * nx + cl.col);
				if (k !== void 0) {
					c.setActive(k, "keyboard");
					break;
				}
			}
			return true;
		},
		underlay: useCanvas ? /* @__PURE__ */ jsx(CanvasLayer, {
			width: W,
			height: H,
			draw,
			progress: prog,
			version: c.sig
		}) : void 0,
		children: [
			props.legend !== false ? /* @__PURE__ */ jsxs("g", {
				"aria-hidden": "true",
				children: [
					Array.from({ length: 5 }, (_, k) => {
						const s = sequential(p, k / 4, .08);
						const lx = W - 70 - textWidth(ll[1], 10) - 6 + k * 14;
						return /* @__PURE__ */ jsx("rect", {
							x: lx,
							y: 3,
							width: 12,
							height: 9,
							rx: 2,
							fill: s.fill,
							opacity: s.opacity
						}, k);
					}),
					/* @__PURE__ */ jsx(Txt, {
						x: W - 70 - textWidth(ll[1], 10) - 10,
						y: 7.5,
						anchor: "end",
						size: 10,
						fill: p.paint("muted"),
						children: ll[0]
					}),
					/* @__PURE__ */ jsx(Txt, {
						x: W,
						y: 7.5,
						anchor: "end",
						size: 10,
						fill: p.paint("muted"),
						children: ll[1]
					})
				]
			}) : null,
			!useCanvas ? m.items.map((it) => {
				const cl = it.data;
				if (!cl) return null;
				const s = sequential(p, cl.t, .08);
				const x = x0 + cl.col * cw + gap / 2;
				const y = y0 + cl.row * ch + gap / 2;
				const w = Math.max(.5, cw - gap);
				const h = Math.max(.5, ch - gap);
				const k = evIndex.get(cl.i) ?? -1;
				const isHi = hiSet.has(cl.i);
				return /* @__PURE__ */ jsxs("g", {
					opacity: it.v[0],
					children: [
						/* @__PURE__ */ jsx("path", {
							d: roundRectPath(x, y, w, h, rad),
							fill: s.fill,
							opacity: s.opacity * (c.active === null || c.active === k ? 1 : .55),
							className: "ztd-mark",
							onPointerEnter: (e) => c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer"),
							onClick: () => c.click(k)
						}),
						isHi || c.active === k ? /* @__PURE__ */ jsx("path", {
							d: roundRectPath(x - 1, y - 1, w + 2, h + 2, rad + 1),
							fill: "none",
							stroke: p.paint("ink"),
							strokeWidth: isHi && c.active !== k ? 1.5 : 2,
							pointerEvents: "none"
						}) : null,
						valuesOn ? /* @__PURE__ */ jsx(Txt, {
							x: x + w / 2,
							y: y + h / 2,
							anchor: "middle",
							size: 10.5,
							weight: isHi ? 800 : 600,
							fill: s.text,
							children: c.fmt(cl.value)
						}) : null
					]
				}, it.key);
			}) : c.active !== null && cells[c.active] ? (() => {
				const cl = cells[c.active];
				return /* @__PURE__ */ jsx("rect", {
					x: x0 + cl.col * cw,
					y: y0 + cl.row * ch,
					width: cw,
					height: ch,
					fill: "none",
					stroke: p.paint("ink"),
					strokeWidth: 1.5,
					pointerEvents: "none"
				});
			})() : null,
			/* @__PURE__ */ jsxs("g", {
				"aria-hidden": "true",
				children: [yLabelIdx.map((i) => /* @__PURE__ */ jsx(Txt, {
					x: leftW,
					y: y0 + i * ch + ch / 2,
					anchor: "end",
					size: AXIS_FONT,
					weight: 500,
					fill: p.paint("muted"),
					children: truncate(model.ys[i], leftW - 2, AXIS_FONT, 500)
				}, i)), xLabelIdx.map((i) => /* @__PURE__ */ jsx(Txt, {
					x: x0 + i * cw + cw / 2,
					y: H - bottom + 12,
					anchor: "middle",
					size: AXIS_FONT,
					fill: p.paint("muted"),
					children: model.xs[i]
				}, i))]
			})
		]
	});
}
var MSG11 = {
	en: {
		kind: "Radar chart",
		desc: (n, axes, nS) => `${plural(n, "metric")} (${axes}), ${plural(nS, "series", "series")}`
	},
	ko: {
		kind: "레이더 차트",
		desc: (n, axes, nS) => `지표 ${n}개(${axes}), 계열 ${nS}개`
	}
};
function RadarChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(220, Math.min(300, w * .66)),
		duration: 900,
		stagger: 160
	});
	const { p, width: W, height: H } = c;
	const model = useMemo(() => prepSeries(props.data, props.axis ?? "axis", props.value, props.series, {
		xType: "band",
		locale: c.locale,
		sum: true
	}), [
		props.data,
		props.axis,
		props.value,
		props.series,
		c.locale
	]);
	const axes = model.labels;
	const n = axes.length;
	const hi = useMemo(() => resolveHighlight(props.highlight, model.series, model.series, model.series.map(() => 0), "first"), [model, props.highlight]);
	const mxData = Math.max(0, ...model.values.flat().filter(Number.isFinite));
	const max = props.max ?? niceDomain(0, mxData, props.levels ?? 4)[1];
	const levels = props.levels ?? 4;
	const labW = Math.max(...axes.map((a) => textWidth(a, 11.5, 600)), 20) + 10;
	const R = Math.max(30, Math.min(W / 2 - labW, H / 2 - 22));
	const cx = W / 2;
	const cy = H / 2 + 2;
	const ang = (k) => k / Math.max(1, n) * TAU;
	const polys = useMemo(() => model.series.map((name, s) => ({
		s,
		name,
		r: model.values[s].map((v) => Number.isFinite(v) ? Math.max(0, v) / max * R : 0),
		hi: hi.has(s)
	})), [
		model,
		max,
		R,
		hi
	]);
	const stg = c.motion.stagger ?? 160;
	const order = useMemo(() => [...polys].sort((a, b) => Number(a.hi) - Number(b.hi)), [polys]);
	const m = useMotion(useMemo(() => order.map((pl, k) => ({
		key: `r:${pl.name}`,
		to: pl.r,
		from: pl.r.map(() => 0),
		enter: pl.r.map(() => 0),
		delay: k * stg,
		data: pl
	})), [order, stg]), c.motion);
	const accent = swatch(p, "accent");
	const events = axes.map((a, k) => ({
		datum: null,
		index: k,
		key: a,
		label: a,
		value: model.values[[...hi][0] ?? 0]?.[k] ?? null,
		formatted: model.series.map((s, si) => `${s || c.t.value} ${c.fv(model.values[si][k])}`).join(", ")
	}));
	let tip = null;
	if (c.active !== null && axes[c.active] !== void 0) {
		const k = c.active;
		const [tx, ty] = polar(cx, cy, Math.max(...polys.map((pl) => pl.r[k] ?? 0)), ang(k));
		tip = {
			x: tx,
			y: ty,
			title: axes[k],
			rows: polys.map((pl) => ({
				label: pl.name || c.t.value,
				value: c.fv(model.values[pl.s][k]),
				color: pl.hi ? accent.fill : p.paint("neutralStrong"),
				strong: pl.hi
			}))
		};
	}
	const ring = (rad) => {
		if (props.circular) return `M${cx - rad},${cy}a${rad},${rad} 0 1 0 ${rad * 2},0a${rad},${rad} 0 1 0 ${-rad * 2},0`;
		return axes.map((_, k) => {
			const [x, y] = polar(cx, cy, rad, ang(k));
			return `${k ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
		}).join("") + "Z";
	};
	const D = c.motion.duration ?? 900;
	const msg = MSG11[c.lang];
	const desc = props.description ?? `${msg.kind}. ${msg.desc(n, axes.join(", "), model.series.length)}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, py, e) => {
			const a = Math.atan2(px - cx, -(py - cy));
			const k = Math.round((a + TAU) % TAU / TAU * n) % n;
			const dist = Math.hypot(px - cx, py - cy);
			c.setActive(dist < R + 30 ? k : null, e.pointerType === "touch" ? "touch" : "pointer");
		},
		children: [
			/* @__PURE__ */ jsxs("g", {
				"aria-hidden": "true",
				children: [
					Array.from({ length: levels }, (_, l) => /* @__PURE__ */ jsx("path", {
						d: ring(R * (l + 1) / levels),
						fill: "none",
						stroke: p.paint("line"),
						strokeWidth: 1
					}, l)),
					axes.map((a, k) => {
						const [x, y] = polar(cx, cy, R, ang(k));
						return /* @__PURE__ */ jsx("line", {
							x1: cx,
							y1: cy,
							x2: x,
							y2: y,
							stroke: p.paint(c.active === k ? "dim" : "line"),
							strokeWidth: 1
						}, k);
					}),
					Array.from({ length: levels }, (_, l) => {
						const v = max * (l + 1) / levels;
						const [x, y] = polar(cx, cy, R * (l + 1) / levels, 0);
						return /* @__PURE__ */ jsx(Txt, {
							x: x + 4,
							y: y + 1,
							size: 9.5,
							fill: p.paint("ink"),
							children: c.fmt(v)
						}, l);
					})
				]
			}),
			m.items.map((it) => {
				const pl = it.data;
				const pts2 = it.v.map((r, k) => polar(cx, cy, r, ang(k)));
				const d = pts2.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join("") + "Z";
				const col = pl.hi ? accent.fill : p.paint("neutralStrong");
				return /* @__PURE__ */ jsxs("g", {
					opacity: it.exiting ? .4 : 1,
					pointerEvents: "none",
					children: [/* @__PURE__ */ jsx("path", {
						d,
						fill: pl.hi ? accent.fill : p.paint("neutral"),
						fillOpacity: pl.hi ? .2 : .22,
						stroke: col,
						strokeWidth: pl.hi ? 2.2 : 1.4,
						strokeLinejoin: "round"
					}), pl.hi ? pts2.map(([x, y], k) => /* @__PURE__ */ jsx("circle", {
						cx: x,
						cy: y,
						r: c.active === k ? 4.5 : 3,
						fill: col,
						stroke: p.paint("panel"),
						strokeWidth: 1.5
					}, k)) : null]
				}, it.key);
			}),
			/* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: axes.map((a, k) => {
					const t = ang(k);
					const [x, y] = polar(cx, cy, R + 12, t);
					const s = Math.sin(t);
					const anchor = s > .15 ? "start" : s < -.15 ? "end" : "middle";
					const dy = Math.cos(t) > .9 ? -4 : Math.cos(t) < -.9 ? 4 : 0;
					const strong = c.active === k;
					return /* @__PURE__ */ jsx(Txt, {
						x,
						y: y + dy,
						anchor,
						size: 11.5,
						weight: strong ? 800 : 600,
						fill: p.paint(strong ? "ink" : "muted"),
						opacity: m.fade(D * .4, 300),
						children: a
					}, k);
				})
			})
		]
	});
}
var isPair = (v) => Array.isArray(v) && v.length === 2;
function annotationYs(list) {
	const out = [];
	for (const a of list ?? []) if (a.type === "line" && typeof a.y === "number") out.push(a.y);
	else if (a.type === "band" && isPair(a.y)) out.push(Number(a.y[0]), Number(a.y[1]));
	return out.filter(Number.isFinite);
}
var forecastFrom = (list) => list?.find((a) => a.type === "forecast")?.from;
var clampX = (g, x) => Math.max(g.x0, Math.min(g.x1, x));
var inside = (g, x) => x !== null && x >= g.x0 - 1 && x <= g.x1 + 1;
function xRange(g, v) {
	const a = g.xAt(v[0]);
	const b = g.xAt(v[1]);
	return a === null || b === null ? null : [Math.min(a, b) - g.half, Math.max(a, b) + g.half];
}
function forecastX(g, from) {
	const x = from === void 0 ? null : g.xAt(from);
	return x === null || x > g.x1 ? null : Math.max(g.x0, x - (g.edge ? g.half : 0));
}
var TEXT = {
	en: {
		forecast: "Forecast",
		trend: "Trend",
		period: "period",
		weekends: "weekends shaded",
		lead: "Annotations"
	},
	ko: {
		forecast: "예측",
		trend: "추세",
		period: "기간",
		weekends: "주말 음영",
		lead: "주석"
	}
};
function AnnotationsUnder({ list, g }) {
	if (!list?.length) return null;
	const { p } = g;
	const h = Math.max(0, g.bottom - g.top);
	const nodes = [];
	list.forEach((a, i) => {
		if (a.type === "band" && isPair(a.y)) {
			const ya = g.y(Number(a.y[0]));
			const yb = g.y(Number(a.y[1]));
			if (!Number.isFinite(ya) || !Number.isFinite(yb)) return;
			const top = Math.max(g.top, Math.min(ya, yb));
			const bot = Math.min(g.bottom, Math.max(ya, yb));
			nodes.push(/* @__PURE__ */ jsxs("g", { children: [
				/* @__PURE__ */ jsx("rect", {
					x: g.x0,
					y: top,
					width: Math.max(0, g.x1 - g.x0),
					height: Math.max(0, bot - top),
					fill: p.paint("accent"),
					opacity: .1
				}),
				/* @__PURE__ */ jsx("line", {
					x1: g.x0,
					x2: g.x1,
					y1: top,
					y2: top,
					stroke: p.paint("accent"),
					strokeOpacity: .45,
					strokeDasharray: "3 3"
				}),
				/* @__PURE__ */ jsx("line", {
					x1: g.x0,
					x2: g.x1,
					y1: bot,
					y2: bot,
					stroke: p.paint("accent"),
					strokeOpacity: .45,
					strokeDasharray: "3 3"
				})
			] }, i));
		} else if (a.type === "band" && isPair(a.x) || a.type === "forecast") {
			let r;
			if (a.type === "forecast") {
				const xf = forecastX(g, a.from);
				r = xf === null ? null : [xf, g.x1];
			} else r = xRange(g, a.x);
			if (!r) return;
			const xa = clampX(g, r[0]);
			const xb = clampX(g, r[1]);
			if (xb - xa < .5) return;
			nodes.push(/* @__PURE__ */ jsx("rect", {
				x: xa,
				y: g.top,
				width: xb - xa,
				height: h,
				fill: p.paint("ink"),
				opacity: .05
			}, i));
		} else if (a.type === "weekends" && g.time && g.time.t1 - g.time.t0 <= 3456e7) {
			const pad = Math.min(432e5, (g.time.t1 - g.time.t0) / Math.max(1, g.time.n - 1) / 2);
			const d = new Date(g.time.t0);
			d.setHours(0, 0, 0, 0);
			d.setDate(d.getDate() - (d.getDay() + 1) % 7);
			for (let n = 0; d.getTime() - pad <= g.time.t1 && n < 60; n++) {
				const sat = d.getTime();
				d.setDate(d.getDate() + 2);
				const xa = Math.max(g.x0, g.time.xt(sat - pad));
				const xb = Math.min(g.x1, g.time.xt(d.getTime() - pad));
				if (xb > xa) nodes.push(/* @__PURE__ */ jsx("rect", {
					x: xa,
					y: g.top,
					width: xb - xa,
					height: h,
					fill: p.paint("ink"),
					opacity: .045
				}, `${i}w${n}`));
				d.setDate(d.getDate() + 5);
			}
		}
	});
	return /* @__PURE__ */ jsx("g", {
		"aria-hidden": "true",
		pointerEvents: "none",
		children: nodes
	});
}
var tagW = (text, strong) => textWidth(text, 10.5, strong ? 700 : 500) + 8;
function tagBox(text, x, y, anchor = "start", strong) {
	const w = tagW(text, strong);
	return {
		x: anchor === "end" ? x - w : x,
		y: y - 8,
		w,
		h: 16
	};
}
function Tag({ p, x, y, text, anchor = "start", strong }) {
	const b = tagBox(text, x, y, anchor, strong);
	return /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("rect", {
		x: b.x,
		y: b.y,
		width: b.w,
		height: b.h,
		rx: 5,
		fill: p.paint("panel"),
		opacity: .94
	}), /* @__PURE__ */ jsx(Txt, {
		x: b.x + 4,
		y,
		size: 10.5,
		weight: strong ? 700 : 500,
		fill: p.paint(strong ? "ink" : "muted"),
		children: text
	})] });
}
function AnnotationsOver({ list, g }) {
	if (!list?.length) return null;
	const { p } = g;
	const tx = TEXT[g.lang];
	const nodes = [];
	const rows = [];
	list.forEach((a, i) => {
		if (a.type === "line" && typeof a.y === "number") {
			const yy = g.y(a.y);
			if (!Number.isFinite(yy)) return;
			nodes.push(/* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("line", {
				x1: g.x0,
				x2: g.x1,
				y1: yy,
				y2: yy,
				stroke: p.paint("dim"),
				strokeDasharray: "4 3"
			}), a.label ? /* @__PURE__ */ jsx(Tag, {
				p,
				x: g.x1 - 2,
				y: yy - 10,
				text: truncate(a.label, 160, 10.5),
				anchor: "end"
			}) : null] }, i));
		} else if (a.type === "band" && a.label) {
			const top = isPair(a.y) ? Math.max(g.top, Math.min(g.y(Number(a.y[0])), g.y(Number(a.y[1])))) : g.top;
			const r = isPair(a.x) ? xRange(g, a.x) : [g.x0, g.x1];
			if (!r || !Number.isFinite(top)) return;
			nodes.push(/* @__PURE__ */ jsx(Tag, {
				p,
				x: Math.min(clampX(g, r[0]), g.x1 - 40) + 4,
				y: top + 11,
				text: truncate(a.label, 160, 10.5)
			}, i));
		} else if (a.type === "forecast") {
			const xf = forecastX(g, a.from);
			if (xf === null) return;
			nodes.push(/* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("line", {
				x1: xf,
				x2: xf,
				y1: g.top,
				y2: g.bottom,
				stroke: p.paint("dim"),
				strokeDasharray: "2 3"
			}), /* @__PURE__ */ jsx(Tag, {
				p,
				x: Math.min(xf + 4, g.x1 - 50),
				y: g.top + 9,
				text: truncate(a.label ?? tx.forecast, 120, 10.5)
			})] }, i));
		} else if (a.type === "event" && a.label) {
			const xe = g.xAt(a.x);
			if (!inside(g, xe)) return;
			const text = truncate(a.label, 140, 10.5, 700);
			const w = tagW(text, true);
			const left = Math.max(g.x0, Math.min(xe - w / 2, g.x1 - w));
			let row = rows.findIndex((end) => end < left - 4);
			if (row < 0) row = rows.length;
			rows[row] = left + w;
			const yy = g.top + 9 + row * 18;
			nodes.push(/* @__PURE__ */ jsxs("g", { children: [
				/* @__PURE__ */ jsx("line", {
					x1: xe,
					x2: xe,
					y1: yy + 8,
					y2: g.bottom,
					stroke: p.paint("ink"),
					strokeOpacity: .45,
					strokeDasharray: "2 3"
				}),
				/* @__PURE__ */ jsx("circle", {
					cx: xe,
					cy: g.bottom,
					r: 2.5,
					fill: p.paint("ink"),
					opacity: .6
				}),
				/* @__PURE__ */ jsx(Tag, {
					p,
					x: left,
					y: yy,
					text,
					strong: true
				})
			] }, i));
		} else if (a.type === "trend" && g.points) {
			const pts2 = g.points().filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
			if (pts2.length < 2) return;
			const { at } = linearFit(pts2);
			const xa = pts2[0].x;
			const xb = pts2[pts2.length - 1].x;
			nodes.push(/* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("line", {
				x1: xa,
				x2: xb,
				y1: at(xa),
				y2: at(xb),
				stroke: p.paint("muted"),
				strokeWidth: 1.5,
				strokeDasharray: "6 4",
				strokeLinecap: "round"
			}), /* @__PURE__ */ jsx(Tag, {
				p,
				x: xb - 2,
				y: at(xb) - 11,
				text: truncate(a.label ?? tx.trend, 120, 10.5),
				anchor: "end"
			})] }, i));
		}
	});
	return /* @__PURE__ */ jsx("g", {
		"aria-hidden": "true",
		pointerEvents: "none",
		children: nodes
	});
}
function describeAnnotations(list, lang, fv, xText) {
	if (!list?.length) return "";
	const tx = TEXT[lang];
	const ko2 = lang === "ko";
	const s = xText ?? ((v) => String(v ?? ""));
	const parts = list.map((a) => {
		const label = a.label ? ko2 ? `(${a.label})` : ` (${a.label})` : "";
		if (a.type === "band" && isPair(a.y)) return ko2 ? `구간 ${fv(Number(a.y[0]))}~${fv(Number(a.y[1]))}${label}` : `band ${fv(Number(a.y[0]))} to ${fv(Number(a.y[1]))}${label}`;
		if (a.type === "band" && isPair(a.x)) return ko2 ? `${a.label ?? tx.period} ${s(a.x[0])}~${s(a.x[1])}` : `${a.label ?? tx.period} from ${s(a.x[0])} to ${s(a.x[1])}`;
		if (a.type === "line" && typeof a.y === "number") return ko2 ? `기준선 ${fv(a.y)}${label}` : `reference line at ${fv(a.y)}${label}`;
		if (a.type === "event") return ko2 ? `${s(a.x)} ${a.label ?? ""}`.trim() : `${a.label ?? "event"} at ${s(a.x)}`;
		if (a.type === "forecast") return ko2 ? `${s(a.from)}부터 ${a.label ?? tx.forecast}` : `${a.label ?? tx.forecast.toLowerCase()} from ${s(a.from)}`;
		if (a.type === "trend") return ko2 ? a.label ?? "추세선" : a.label ?? "trend line";
		if (a.type === "weekends") return tx.weekends;
		return "";
	}).filter(Boolean);
	return parts.length ? ` ${tx.lead}: ${parts.join(ko2 ? ", " : "; ")}.` : "";
}
var TEXT2 = {
	en: {
		/** 계열마다 점 수. 예: " 3 series: Large 18 points, Small 9 points." */
		seriesCounts: (list) => ` ${plural(list.length, "series", "series")}: ${list.map(([s, k]) => `${s} ${plural(k, "point")}`).join(", ")}.`,
		/** 상관 방향. sign이 1이면 오름, -1이면 내림, 0이면 뚜렷하지 않음 */
		trend: (sign, x, y, r22) => sign > 0 ? ` ${y} rises as ${x} rises, R² ${r22}.` : sign < 0 ? ` ${y} falls as ${x} rises, R² ${r22}.` : ` No clear straight-line relationship between ${x} and ${y}, R² ${r22}.`,
		refs: (parts) => ` Reference ${parts.length > 1 ? "lines" : "line"} at ${parts.join(" and ")}.`,
		quadrants: (list) => ` Quadrants: ${list.map(([q, k]) => `${q} ${k}`).join("; ")}.`,
		slope: "Trend slope",
		trendTag: "Trend"
	},
	ko: {
		seriesCounts: (list) => ` 계열 ${list.length}개: ${list.map(([s, k]) => `${s} ${k}개`).join(", ")}.`,
		trend: (sign, x, y, r22) => sign > 0 ? ` ${x} 값이 클수록 ${y} 값도 커요(R² ${r22}).` : sign < 0 ? ` ${x} 값이 클수록 ${y} 값은 작아요(R² ${r22}).` : ` ${x} 값과 ${y} 값 사이에 뚜렷한 직선 관계가 없어요(R² ${r22}).`,
		refs: (parts) => ` 기준선 ${parts.join(", ")}.`,
		quadrants: (list) => ` 사분면: ${list.map(([q, k]) => `${q} ${k}개`).join(", ")}.`,
		slope: "추세 기울기",
		trendTag: "추세"
	}
};
function arrowStep(key) {
	switch (key) {
		case "ArrowRight": return [1, 0];
		case "ArrowLeft": return [-1, 0];
		case "ArrowDown": return [0, 1];
		case "ArrowUp": return [0, -1];
		default: return null;
	}
}
function nearestInDirection(pts2, from, step) {
	const o = pts2[from];
	const forward = step[0] + step[1] > 0;
	let best = null;
	let bd = Infinity;
	for (let k = 0; k < pts2.length; k++) {
		if (k === from) continue;
		const dx = pts2[k].x - o.x;
		const dy = pts2[k].y - o.y;
		if (!(dx * step[0] + dy * step[1] > 0 || dx === 0 && dy === 0 && (forward ? k > from : k < from))) continue;
		const d = dx * dx + dy * dy;
		if (d < bd || d === bd && best !== null && Math.abs(k - from) < Math.abs(best - from)) {
			bd = d;
			best = k;
		}
	}
	return best;
}
function entryPoint(pts2, step) {
	const anyHi = pts2.some((q) => q.hi);
	const k = argMin(pts2.map((q) => anyHi && !q.hi ? Infinity : q.x * step[0] + q.y * step[1]));
	return k < 0 ? null : k;
}
function seededUnit(seed, i) {
	let h = Math.imul((seed | 0) ^ 2654435769, 2246822507) ^ Math.imul(i + 1, 3266489909);
	h = Math.imul(h ^ h >>> 16, 2146121005);
	h = Math.imul(h ^ h >>> 15, 2221713035);
	return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function smallestGap(xs) {
	const s = [...new Set(xs)].sort((a, b) => a - b);
	let g = Infinity;
	for (let k = 1; k < s.length; k++) g = Math.min(g, s[k] - s[k - 1]);
	return Number.isFinite(g) ? g : 1;
}
function seriesHighlight(h, data, names, seriesOf) {
	if (typeof h !== "function") return resolveHighlight(h, names, names, names.map(() => 0), "first");
	const index = new Map(names.map((s, k) => [s, k]));
	const out = /* @__PURE__ */ new Set();
	data.forEach((d, i) => {
		const k = index.get(seriesOf(d, i));
		if (k !== void 0 && h(d, i)) out.add(k);
	});
	return out;
}
function fitSegment(fit, x0, x1, [ylo, yhi]) {
	let a = x0;
	let b = x1;
	if (fit.slope) {
		const xa = x0 + (ylo - fit.at(x0)) / fit.slope;
		const xb = x0 + (yhi - fit.at(x0)) / fit.slope;
		a = Math.max(a, Math.min(xa, xb));
		b = Math.min(b, Math.max(xa, xb));
	} else if (fit.at(x0) < ylo || fit.at(x0) > yhi) return null;
	return b > a ? [
		a,
		fit.at(a),
		b,
		fit.at(b)
	] : null;
}
function fitTagSpot(line, text, avoid, b) {
	const clampY = (v) => Math.max(b.y0 + 9, Math.min(b.y1 - 9, v));
	const tries = [
		{
			x: line.x2 + 2,
			y: clampY(line.y2 - 11),
			anchor: "end"
		},
		{
			x: line.x2 + 2,
			y: clampY(line.y2 + 11),
			anchor: "end"
		},
		{
			x: line.x1 - 2,
			y: clampY(line.y1 - 11),
			anchor: "start"
		},
		{
			x: line.x1 - 2,
			y: clampY(line.y1 + 11),
			anchor: "start"
		}
	];
	return tries.find((t) => !avoid.some((q) => overlaps(q, tagBox(text, t.x, t.y, t.anchor), 2))) ?? tries[0];
}
function quadrantTags(names, xr, yr, b) {
	const cells = [
		{
			x: b.x0 + 4,
			y: b.y0 + 10,
			w: xr - b.x0,
			h: yr - b.y0,
			anchor: "start"
		},
		{
			x: b.x1 - 4,
			y: b.y0 + 10,
			w: b.x1 - xr,
			h: yr - b.y0,
			anchor: "end"
		},
		{
			x: b.x0 + 4,
			y: yr + 10,
			w: xr - b.x0,
			h: b.y1 - yr,
			anchor: "start"
		},
		{
			x: b.x1 - 4,
			y: yr + 10,
			w: b.x1 - xr,
			h: b.y1 - yr,
			anchor: "end"
		}
	];
	const out = [];
	cells.forEach((q, k) => {
		const name = names[k];
		if (!name || q.h < 22 || q.w < 40) return;
		const text = truncate(name, q.w - 16, 10.5, 500);
		out.push({
			text,
			x: q.x,
			y: q.y,
			anchor: q.anchor,
			box: tagBox(text, q.x, q.y, q.anchor)
		});
	});
	return out;
}
var SERIES_LABEL_SIZE = 11;
var seriesLabelWeight = (hi) => hi ? 700 : 600;
function placeSeriesLabels(dots, names, hiSeries, around) {
	const sums = names.map(() => ({
		x: 0,
		y: 0,
		n: 0
	}));
	for (const d of dots) {
		const s = sums[d.si];
		if (!s) continue;
		s.x += d.x;
		s.y += d.y;
		s.n++;
	}
	if (sums.filter((s) => s.n).length > 4) return [];
	const { box, reserved, grid } = around;
	const isFree = (b) => {
		if (b.x < box.x0 + 2 || b.x + b.w > box.x1 - 2 || b.y < box.y0 || b.y + b.h > box.y1 - 2) return false;
		if (reserved.some((q) => overlaps(q, b, 2))) return false;
		for (let gx = Math.floor(b.x / grid.cell); gx <= Math.floor((b.x + b.w) / grid.cell); gx++) for (let gy = Math.floor(b.y / grid.cell); gy <= Math.floor((b.y + b.h) / grid.cell); gy++) for (const k of grid.g.get(`${gx},${gy}`) ?? []) {
			const d = dots[k];
			const nx = Math.max(b.x, Math.min(d.x, b.x + b.w));
			const ny = Math.max(b.y, Math.min(d.y, b.y + b.h));
			if (Math.hypot(d.x - nx, d.y - ny) < d.r + 1.5) return false;
		}
		return true;
	};
	const out = [];
	sums.forEach((s, si) => {
		if (!s.n) return;
		const w = textWidth(names[si], SERIES_LABEL_SIZE, seriesLabelWeight(hiSeries.has(si)));
		const h = 14;
		const cx = s.x / s.n;
		const cy = s.y / s.n;
		const near = dots.filter((d) => d.si === si).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
		for (const d of near.slice(0, 40)) {
			const gap = d.r + 4;
			const b = [
				{
					x: d.x + gap,
					y: d.y - h / 2,
					w,
					h
				},
				{
					x: d.x - gap - w,
					y: d.y - h / 2,
					w,
					h
				},
				{
					x: d.x - w / 2,
					y: d.y - gap - h,
					w,
					h
				},
				{
					x: d.x - w / 2,
					y: d.y + gap,
					w,
					h
				}
			].find((t) => isFree(t) && !out.some((l) => overlaps(l.box, t, 2)));
			if (!b) continue;
			out.push({
				si,
				y: b.y + h / 2,
				box: b
			});
			return;
		}
	});
	return out;
}
function describeScatter(text, o) {
	let s = "";
	if (o.seriesNames.length) {
		const counts = o.seriesNames.map((name) => [name, 0]);
		for (const q of o.points) if (counts[q.si]) counts[q.si][1]++;
		const shown = counts.filter(([, k]) => k > 0);
		if (shown.length) s += text.seriesCounts(shown);
	}
	if (o.fit) s += text.trend(o.fit.r2 < .1 ? 0 : Math.sign(o.fit.slope), o.xName, o.yName, o.fit.r2.toFixed(2));
	if (o.refs.length) s += text.refs(o.refs);
	const { refX, refY } = o;
	if (o.quadrants.length && refX !== void 0 && refY !== void 0) {
		const counts = [
			0,
			0,
			0,
			0
		];
		for (const q of o.points) counts[(q.y >= refY ? 0 : 2) + (q.x >= refX ? 1 : 0)]++;
		const named = o.quadrants.slice(0, 4).map((q, k) => [q, counts[k]]).filter(([q]) => q);
		if (named.length) s += text.quadrants(named);
	}
	return s;
}
function seriesCanvasGroups(dots, colors, hi) {
	const ks = colors.map(() => []);
	dots.forEach((d, k) => ks[d.si]?.push(k));
	return [...ks.keys()].sort((a, b) => Number(hi.has(a)) - Number(hi.has(b))).map((si) => ({
		ks: ks[si],
		isHi: hi.has(si),
		fill: (read) => canvasColor(colors[si], read)
	}));
}
function RefLines({ p, x, y, box }) {
	return /* @__PURE__ */ jsxs("g", {
		"aria-hidden": "true",
		pointerEvents: "none",
		children: [x !== null ? /* @__PURE__ */ jsx("line", {
			x1: x,
			x2: x,
			y1: box.y0,
			y2: box.y1,
			stroke: p.paint("dim"),
			strokeDasharray: "3 3"
		}) : null, y !== null ? /* @__PURE__ */ jsx("line", {
			x1: box.x0,
			x2: box.x1,
			y1: y,
			y2: y,
			stroke: p.paint("dim"),
			strokeDasharray: "3 3"
		}) : null]
	});
}
function Overlay(props) {
	const { p, fade, fitLine, fitTag, quads, colors, hiSeries } = props;
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		fitLine && fitTag ? /* @__PURE__ */ jsxs("g", {
			"aria-hidden": "true",
			pointerEvents: "none",
			opacity: fade,
			children: [/* @__PURE__ */ jsx("line", {
				...fitLine,
				stroke: p.paint("muted"),
				strokeWidth: 1.5,
				strokeDasharray: "6 4",
				strokeLinecap: "round"
			}), /* @__PURE__ */ jsx(Tag, {
				p,
				x: fitTag.x,
				y: fitTag.y,
				text: props.trendTag,
				anchor: fitTag.anchor
			})]
		}) : null,
		quads.length ? /* @__PURE__ */ jsx("g", {
			"aria-hidden": "true",
			pointerEvents: "none",
			children: quads.map((q) => /* @__PURE__ */ jsx(Tag, {
				p,
				x: q.x,
				y: q.y,
				text: q.text,
				anchor: q.anchor
			}, `${q.anchor}${q.y}`))
		}) : null,
		colors && hiSeries ? props.seriesLabels.map((l) => {
			const isHi = hiSeries.has(l.si);
			return /* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				pointerEvents: "none",
				opacity: fade,
				children: /* @__PURE__ */ jsx(Txt, {
					x: l.box.x,
					y: l.y,
					size: SERIES_LABEL_SIZE,
					weight: seriesLabelWeight(isHi),
					fill: p.paint(isHi ? "ink" : "muted"),
					children: props.seriesNames[l.si]
				})
			}, `s${l.si}`);
		}) : null
	] });
}
var SCATTER_KIT = {
	text: TEXT2,
	arrowStep,
	nearestInDirection,
	entryPoint,
	seededUnit,
	smallestGap,
	uniq,
	seriesHighlight,
	colors: categoricalDots,
	canvasGroups: seriesCanvasGroups,
	linearFit,
	fitSegment,
	fitTagSpot,
	quadrantTags,
	tagBox,
	placeSeriesLabels,
	describe: describeScatter,
	RefLines,
	Overlay
};
var MSG12 = {
	en: {
		bubble: "Bubble chart",
		scatter: "Scatter plot",
		size: "Size",
		sizeWord: "size",
		nth: (i) => `#${i}`,
		/** r: x 최소, x 최대, y 최소, y 최대 */
		desc: (sized, n, r) => `${sized ? "Bubble chart" : "Scatter plot"}. ${plural(n, "point")}. x from ${r[0]} to ${r[1]}, y from ${r[2]} to ${r[3]}.`
	},
	ko: {
		bubble: "버블 차트",
		scatter: "산점도",
		size: "크기",
		sizeWord: "크기",
		nth: (i) => `${i}번`,
		desc: (sized, n, r) => `${sized ? "버블 차트" : "산점도"}. 점 ${n}개. x ${r[0]}~${r[1]}, y ${r[2]}~${r[3]}.`
	}
};
var NO_BOXES = [];
var NO_SERIES_LABELS = [];
var NO_PLACED_TAGS = [];
var NO_NAMES = [];
var xTitleAt = (b) => ({
	x: b.x1 - 2,
	y: b.y1 - 8
});
function drawOrder(a, b) {
	return Number(a.hi) - Number(b.hi) || b.r - a.r;
}
function BubbleChart(props) {
	return /* @__PURE__ */ jsx(PointChart, {
		...props,
		kit: void 0
	});
}
function ScatterChart(props) {
	return /* @__PURE__ */ jsx(PointChart, {
		...props,
		kit: SCATTER_KIT
	});
}
var finiteOrUndefined = (v) => typeof v === "number" && Number.isFinite(v) ? v : void 0;
function PointChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(220, Math.min(320, w * .6)),
		duration: 800,
		stagger: 0
	});
	const { p, width: W, height: H } = c;
	const kit = props.kit;
	const so = kit ? props : {};
	const hasSize = !kit && props.size !== void 0;
	const rowSeries = useMemo(() => {
		if (so.series === void 0) return null;
		const g = strGetter(so.series, "series");
		return props.data.map((d, i) => g(d, i));
	}, [props.data, so.series]);
	const seriesNames = useMemo(() => kit && rowSeries ? kit.uniq(rowSeries) : NO_NAMES, [kit, rowSeries]);
	const hiddenKey = so.hidden?.join("") ?? "";
	const quadrantKey = so.quadrants?.join("") ?? "";
	const jitterAmount = so.jitter ? Math.max(0, so.jitter.amount ?? .4) : 0;
	const jitterSeed = so.jitter?.seed ?? 1;
	const refX = finiteOrUndefined(so.refLines?.x);
	const refY = finiteOrUndefined(so.refLines?.y);
	const fitOn = so.fit === "linear";
	const hasScatterOptions = rowSeries !== null || fitOn || refX !== void 0 || refY !== void 0 || jitterAmount > 0;
	const raw = useMemo(() => {
		const gx = numGetter(props.x, "x");
		const gy = numGetter(props.y, "y");
		const gs = hasSize ? numGetter(props.size, "size") : null;
		const gl = strGetter(props.label, "label");
		const rows = props.data.map((d, i) => {
			const vx = gx(d, i);
			return {
				d,
				i,
				x: vx,
				y: gy(d, i),
				s: gs ? Math.max(0, gs(d, i) || 0) : 1,
				label: gl(d, i),
				si: -1,
				px: vx
			};
		}).filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y));
		if (!kit || jitterAmount <= 0 && !rowSeries) return rows;
		const gap = jitterAmount > 0 ? kit.smallestGap(rows.map((r) => r.x)) : 0;
		const index = new Map(seriesNames.map((s, k) => [s, k]));
		const hidden = new Set(hiddenKey ? hiddenKey.split("") : []);
		const out = [];
		for (const r of rows) {
			if (gap) r.px = r.x + (kit.seededUnit(jitterSeed, r.i) * 2 - 1) * jitterAmount * gap;
			if (rowSeries) {
				const name = rowSeries[r.i];
				if (hidden.has(name)) continue;
				r.si = index.get(name) ?? -1;
			}
			out.push(r);
		}
		return out;
	}, [
		props.data,
		props.x,
		props.y,
		props.size,
		props.label,
		hasSize,
		kit,
		rowSeries,
		seriesNames,
		hiddenKey,
		jitterAmount,
		jitterSeed
	]);
	const n = raw.length;
	const useCanvas = c.hydrated && n > (props.canvasThreshold ?? 1500);
	const ext = useMemo(() => ({
		x: extent(raw.map((r) => r.x)),
		y: extent(raw.map((r) => r.y)),
		s: extent(raw.map((r) => r.s))
	}), [raw]);
	const plotExt = useMemo(() => {
		if (!jitterAmount && refX === void 0 && refY === void 0) return ext;
		return {
			...ext,
			x: extent(refX === void 0 ? raw.map((r) => r.px) : [...raw.map((r) => r.px), refX]),
			y: refY === void 0 ? ext.y : extent([
				ext.y[0],
				ext.y[1],
				refY
			])
		};
	}, [
		ext,
		raw,
		jitterAmount,
		refX,
		refY
	]);
	const [xmn, xmx] = ext.x;
	const [ymn, ymx] = ext.y;
	const yDom = fitDomain(plotExt.y[0], plotExt.y[1], Math.max(2, Math.round(H / 70)), {
		zero: props.zero ?? false,
		pad: .08
	});
	const xDom = fitDomain(plotExt.x[0], plotExt.x[1], Math.max(2, Math.round(W / 110)), {
		zero: props.zero ?? false,
		pad: .06
	});
	const yMaxAbs = Math.max(Math.abs(yDom[0]), Math.abs(yDom[1]));
	const xMaxAbs = Math.max(Math.abs(xDom[0]), Math.abs(xDom[1]));
	const yFmt = useMemo(() => makeTickFormatter(props.format, c.locale, yMaxAbs), [
		props.format,
		c.locale,
		yMaxAbs
	]);
	const xFmt = useMemo(() => makeTickFormatter(props.xFormat, c.locale, xMaxAbs), [
		props.xFormat,
		c.locale,
		xMaxAbs
	]);
	const yTicks = scaleLinear(yDom, [0, 1]).ticks(Math.max(2, Math.round(H / 70)));
	const left = yAxisWidth(yTicks, yFmt, c.locale);
	const top = props.yLabel ? 20 : 10;
	const bottom = 24;
	const [rMin, rMax] = props.sizeRange ?? (hasSize ? [4, Math.max(10, Math.min(28, W / 22))] : [n > 2e3 ? 1.6 : n > 300 ? 2.6 : 4, 0]);
	const pad = hasSize ? rMax * .6 : 4;
	const x = scaleLinear(xDom, [left + 6 + pad, W - 8 - pad]);
	const y = scaleLinear(yDom, [H - bottom - pad, top + pad]);
	const [smn, smx] = ext.s;
	const rs = hasSize ? scaleSqrt([Math.min(0, smn), smx || 1], [rMin, rMax]) : () => rMin;
	const box = useMemo(() => ({
		x0: left,
		x1: W,
		y0: top,
		y1: H - bottom
	}), [
		left,
		W,
		top,
		H,
		bottom
	]);
	const hiSeries = useMemo(() => kit && rowSeries ? kit.seriesHighlight(props.highlight, props.data, seriesNames, (_, i) => rowSeries[i]) : null, [
		kit,
		rowSeries,
		props.highlight,
		props.data,
		seriesNames
	]);
	const colors = useMemo(() => kit && hiSeries ? kit.colors(p, seriesNames.length, hiSeries) : null, [
		kit,
		p,
		seriesNames.length,
		hiSeries
	]);
	const hi = useMemo(() => {
		if (hiSeries) {
			const out = /* @__PURE__ */ new Set();
			raw.forEach((r, k) => {
				if (hiSeries.has(r.si)) out.add(k);
			});
			return out;
		}
		return resolveHighlight(props.highlight, raw.map((r) => r.d), raw.map((r) => r.label), raw.map((r) => hasSize ? r.s : r.y), hasSize ? "max" : "none");
	}, [
		raw,
		props.highlight,
		hasSize,
		hiSeries
	]);
	const dots = useMemo(() => raw.map((r, k) => ({
		i: k,
		x: x(r.px),
		y: y(r.y),
		r: rs(r.s),
		vx: r.x,
		vy: r.y,
		vs: r.s,
		label: r.label,
		hi: hi.has(k),
		datum: r.d,
		si: r.si
	})), [
		raw,
		hi,
		W,
		H,
		xDom[0],
		xDom[1],
		yDom[0],
		yDom[1],
		rMin,
		rMax
	]);
	const order = useMemo(() => [...dots].sort(drawOrder), [dots]);
	const D = c.motion.duration ?? 800;
	const m = useMotion(useMemo(() => {
		if (useCanvas) return [{
			key: "__p",
			to: [1],
			from: [0],
			data: null
		}];
		const xr = W || 1;
		return order.map((d) => ({
			key: `b${d.i}:${d.label}`,
			to: [
				d.x,
				d.y,
				d.r
			],
			from: [
				d.x,
				d.y,
				0
			],
			enter: [
				d.x,
				d.y,
				0
			],
			delay: d.x / xr * D * .55,
			data: d
		}));
	}, [
		order,
		useCanvas,
		W,
		D
	]), c.motion);
	const grid = useMemo(() => {
		const cell = 24;
		const g = /* @__PURE__ */ new Map();
		dots.forEach((d, k) => {
			const key = `${Math.floor(d.x / cell)},${Math.floor(d.y / cell)}`;
			const arr = g.get(key);
			if (arr) arr.push(k);
			else g.set(key, [k]);
		});
		return {
			g,
			cell
		};
	}, [dots]);
	const nearest = (px, py) => {
		const { g, cell } = grid;
		const cx0 = Math.floor(px / cell);
		const cy0 = Math.floor(py / cell);
		let best = -1;
		let bd = Infinity;
		let hit = -1;
		const reach = hasSize ? Math.ceil(rMax / cell) + 1 : 1;
		for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
			const arr = g.get(`${cx0 + dx},${cy0 + dy}`);
			if (!arr) continue;
			for (const k of arr) {
				const d = dots[k];
				const dist = Math.hypot(d.x - px, d.y - py) - d.r;
				if (dist <= 0 && (hit < 0 || drawOrder(d, dots[hit]) > 0)) hit = k;
				if (dist < bd) {
					bd = dist;
					best = k;
				}
			}
		}
		if (hit >= 0) return hit;
		return bd <= 10 ? best : null;
	};
	const msg = MSG12[c.lang];
	const st = kit?.text[c.lang];
	const fit = useMemo(() => kit && hasScatterOptions && raw.length >= 2 ? kit.linearFit(raw) : null, [
		kit,
		hasScatterOptions,
		raw
	]);
	const fitEnds = kit && fit && fitOn ? kit.fitSegment(fit, xmn, xmx, yDom) : null;
	const fitLine = fitEnds ? {
		x1: x(fitEnds[0]),
		y1: y(fitEnds[1]),
		x2: x(fitEnds[2]),
		y2: y(fitEnds[3])
	} : null;
	const quadrantNames = useMemo(() => quadrantKey ? quadrantKey.split("").map((q) => q.trim()) : NO_NAMES, [quadrantKey]);
	const refPx = refX === void 0 ? null : x(refX);
	const refPy = refY === void 0 ? null : y(refY);
	const quads = useMemo(() => kit && quadrantNames.length && refPx !== null && refPy !== null ? kit.quadrantTags(quadrantNames, refPx, refPy, box) : NO_PLACED_TAGS, [
		kit,
		quadrantNames,
		refPx,
		refPy,
		box
	]);
	const fitTag = kit && st && fitLine ? kit.fitTagSpot(fitLine, st.trendTag, quads.map((q) => q.box), box) : null;
	const fitTagX = fitTag?.x;
	const fitTagY = fitTag?.y;
	const fitTagAnchor = fitTag?.anchor;
	const trendTag = st?.trendTag;
	const reserved = useMemo(() => {
		if (!kit || !hasScatterOptions) return NO_BOXES;
		const out = quads.map((q) => q.box);
		if (props.xLabel) {
			const t = xTitleAt(box);
			out.push(labelBox(props.xLabel, t.x, t.y, 10.5, "end"));
		}
		if (trendTag && fitTagX !== void 0 && fitTagY !== void 0 && fitTagAnchor) out.push(kit.tagBox(trendTag, fitTagX, fitTagY, fitTagAnchor));
		return out;
	}, [
		kit,
		hasScatterOptions,
		quads,
		props.xLabel,
		box,
		fitTagX,
		fitTagY,
		fitTagAnchor,
		trendTag
	]);
	const seriesLabels = useMemo(() => kit && c.showLabels && hiSeries ? kit.placeSeriesLabels(dots, seriesNames, hiSeries, {
		box,
		reserved,
		grid
	}) : NO_SERIES_LABELS, [
		kit,
		c.showLabels,
		hiSeries,
		dots,
		seriesNames,
		grid,
		reserved,
		box
	]);
	const labels = useMemo(() => {
		const max = props.maxLabels ?? (rowSeries ? 0 : 6);
		if (!c.showLabels || n > 400 || max <= 0) return [];
		const cands = [...dots].sort((a, b) => Number(b.hi) - Number(a.hi) || b.r - a.r).filter((d) => d.label);
		const placed = [
			...dots.map((d) => ({
				x: d.x - d.r * .7,
				y: d.y - d.r * .7,
				w: d.r * 1.4,
				h: d.r * 1.4
			})),
			...reserved,
			...seriesLabels.map((l) => l.box)
		];
		const out = [];
		for (const d of cands) {
			if (out.length >= max) break;
			const tries = [
				{
					x: d.x + d.r + 5,
					y: d.y,
					anchor: "start"
				},
				{
					x: d.x - d.r - 5,
					y: d.y,
					anchor: "end"
				},
				{
					x: d.x,
					y: d.y - d.r - 9,
					anchor: "middle"
				},
				{
					x: d.x,
					y: d.y + d.r + 10,
					anchor: "middle"
				}
			];
			for (const t of tries) {
				const b = labelBox(d.label, t.x, t.y, 11, t.anchor, d.hi ? 800 : 500);
				if (b.x < left || b.x + b.w > W - 2 || b.y < 0 || b.y + b.h > H - bottom) continue;
				if (placed.some((q) => overlaps(q, b, 1))) continue;
				placed.push(b);
				out.push({
					d,
					...t
				});
				break;
			}
		}
		return out;
	}, [
		dots,
		c.showLabels,
		n,
		props.maxLabels,
		rowSeries,
		reserved,
		seriesLabels,
		left,
		W,
		H,
		bottom
	]);
	const accent = swatch(p, "accent");
	const fmt = c.fmt;
	const fv = c.fv;
	const events = useMemo(() => lazyArray(dots.length, (k) => {
		const d = dots[k];
		const e = {
			datum: d.datum,
			index: d.i,
			key: `${d.i}`,
			label: d.label || msg.nth(d.i + 1),
			value: hasSize ? d.vs : d.vy,
			formatted: `x ${xFmt(d.vx)}, y ${fv(d.vy)}${hasSize ? `, ${msg.sizeWord} ${fmt(d.vs)}` : ""}`
		};
		if (d.si >= 0) e.series = seriesNames[d.si];
		return e;
	}), [
		dots,
		hasSize,
		xFmt,
		fv,
		fmt,
		msg,
		seriesNames
	]);
	let tip = null;
	if (c.active !== null && dots[c.active]) {
		const d = dots[c.active];
		const rows = [
			{
				label: props.xLabel ?? "x",
				value: xFmt(d.vx)
			},
			{
				label: props.yLabel ?? "y",
				value: c.fv(d.vy)
			},
			...hasSize ? [{
				label: msg.size,
				value: c.fmt(d.vs),
				color: d.hi ? accent.fill : p.paint("neutral")
			}] : []
		];
		if (colors && d.si >= 0) rows.unshift({
			label: seriesNames[d.si],
			value: "",
			color: colors[d.si].fill,
			strong: true
		});
		if (st && fit && fitLine) rows.push({
			label: st.slope,
			value: `${fit.slope > 0 ? "+" : ""}${c.fv(fit.slope)}`,
			strong: false
		}, {
			label: "R²",
			value: fit.r2.toFixed(2),
			strong: false
		});
		tip = {
			x: d.x,
			y: d.y - d.r,
			title: d.label || msg.nth(d.i + 1),
			rows
		};
	}
	const prog = useCanvas ? m.get("__p")?.[0] ?? 1 : 1;
	const neutralRaw = p.theme.neutralStrong;
	const accentRaw = p.theme.accent;
	const canvasGroups = useMemo(() => {
		if (kit && colors && hiSeries) return kit.canvasGroups(dots, colors, hiSeries);
		const rest = [];
		const his = [];
		dots.forEach((d, k) => (d.hi ? his : rest).push(k));
		return [{
			ks: rest,
			isHi: false,
			fill: (read) => read("--ztd-neutral-strong", neutralRaw)
		}, {
			ks: his,
			isHi: true,
			fill: (read) => read("--ztd-accent", accentRaw)
		}];
	}, [
		kit,
		dots,
		colors,
		hiSeries,
		neutralRaw,
		accentRaw
	]);
	const drawCanvas = useCallback((ctx, t, color) => {
		const xr = W || 1;
		for (const g of canvasGroups) {
			ctx.globalAlpha = g.isHi ? 1 : .55;
			ctx.fillStyle = g.fill(color);
			for (const k of g.ks) {
				const d = dots[k];
				const grow = g.isHi ? Math.min(1, t * 1.2) : Math.max(0, Math.min(1, (t * 1.4 - d.x / xr * .4) * 2.5));
				if (grow <= 0) continue;
				ctx.beginPath();
				ctx.arc(d.x, d.y, d.r * grow, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;
	}, [
		canvasGroups,
		dots,
		W
	]);
	const onKey = kit ? (e) => {
		const step = kit.arrowStep(e.key);
		if (!step || !dots.length) return false;
		const cur = c.active !== null && dots[c.active] ? c.active : null;
		const next = cur === null ? kit.entryPoint(dots, step) : kit.nearestInDirection(dots, cur, step);
		if (next !== null) c.setActive(next, "keyboard");
		return true;
	} : void 0;
	const xTicks = x.ticks(Math.max(2, Math.round(W / 110)));
	const xTitle = xTitleAt(box);
	const baseDesc = msg.desc(hasSize, n, [
		xFmt(xmn),
		xFmt(xmx),
		yFmt(ymn),
		yFmt(ymx)
	]);
	const scatterDesc = useMemo(() => {
		if (!kit || !st || !hasScatterOptions) return "";
		const refs = [...refX === void 0 ? [] : [`x ${xFmt(refX)}`], ...refY === void 0 ? [] : [`y ${fv(refY)}`]];
		return kit.describe(st, {
			points: raw,
			seriesNames,
			fit,
			xName: props.xLabel ?? "x",
			yName: props.yLabel ?? "y",
			refs,
			refX,
			refY,
			quadrants: quadrantNames
		});
	}, [
		kit,
		st,
		hasScatterOptions,
		refX,
		refY,
		xFmt,
		fv,
		raw,
		seriesNames,
		fit,
		props.xLabel,
		props.yLabel,
		quadrantNames
	]);
	const desc = props.description ?? baseDesc + scatterDesc;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: hasSize ? msg.bubble : msg.scatter,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, py, e) => {
			const k = nearest(px, py);
			if (k !== c.active) c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer");
		},
		onKey,
		underlay: useCanvas ? /* @__PURE__ */ jsx(CanvasLayer, {
			width: W,
			height: H,
			draw: drawCanvas,
			progress: prog,
			version: c.sig
		}) : void 0,
		children: [
			props.yLabel ? /* @__PURE__ */ jsx(Txt, {
				x: left,
				y: 6,
				size: 10.5,
				fill: p.paint("muted"),
				children: props.yLabel
			}) : null,
			/* @__PURE__ */ jsx(GridY, {
				p,
				ticks: yTicks,
				y,
				x0: left,
				x1: W,
				fmt: yFmt,
				locale: c.locale,
				zero: false
			}),
			/* @__PURE__ */ jsxs("g", {
				"aria-hidden": "true",
				children: [xTicks.map((t) => /* @__PURE__ */ jsx(Txt, {
					x: x(t),
					y: H - bottom + 13,
					anchor: "middle",
					size: AXIS_FONT,
					fill: p.paint("muted"),
					children: xFmt(t)
				}, t)), props.xLabel ? /* @__PURE__ */ jsx(Txt, {
					x: xTitle.x,
					y: xTitle.y,
					anchor: "end",
					size: 10.5,
					fill: p.paint("muted"),
					children: props.xLabel
				}) : null]
			}),
			kit && (refPx !== null || refPy !== null) ? /* @__PURE__ */ jsx(kit.RefLines, {
				p,
				x: refPx,
				y: refPy,
				box
			}) : null,
			!useCanvas ? m.items.map((it) => {
				const d = it.data;
				if (!d) return null;
				const [cx, cy, r] = it.v;
				const isA = c.active === d.i;
				const fill = colors && d.si >= 0 ? colors[d.si].fill : d.hi ? accent.fill : p.paint(hasSize ? "neutral" : "neutralStrong");
				return /* @__PURE__ */ jsx("circle", {
					className: "ztd-mark",
					cx,
					cy,
					r: Math.max(0, r),
					fill,
					fillOpacity: d.hi ? .92 : hasSize ? .85 : .7,
					stroke: isA ? p.paint("ink") : p.paint("panel"),
					strokeWidth: isA ? 2 : hasSize ? 1.2 : .6,
					opacity: it.exiting ? .3 : c.active === null || isA ? 1 : .55,
					onPointerEnter: (e) => c.setActive(d.i, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(d.i)
				}, it.key);
			}) : c.active !== null && dots[c.active] ? /* @__PURE__ */ jsx("circle", {
				cx: dots[c.active].x,
				cy: dots[c.active].y,
				r: dots[c.active].r + 2,
				fill: "none",
				stroke: p.paint("ink"),
				strokeWidth: 1.6,
				pointerEvents: "none"
			}) : null,
			kit && st ? /* @__PURE__ */ jsx(kit.Overlay, {
				p,
				fade: m.fade(D * .6, 300),
				trendTag: st.trendTag,
				fitLine,
				fitTag,
				quads,
				seriesLabels,
				seriesNames,
				colors,
				hiSeries
			}) : null,
			labels.map((l) => /* @__PURE__ */ jsx(Txt, {
				x: l.x,
				y: l.y,
				anchor: l.anchor,
				size: 11,
				weight: l.d.hi ? 800 : 500,
				fill: p.paint(l.d.hi ? "ink" : "muted"),
				opacity: m.fade(D * .6, 300),
				children: l.d.label
			}, l.d.i))
		]
	});
}
var isFieldList = (f) => Array.isArray(f);
function boundField(f, s, wide) {
	const list = isFieldList(f) ? f : [f];
	return !wide ? list[0] : s < list.length ? list[s] : null;
}
function bandBounds(rows, lower, upper, wide, data, from) {
	const index = typeof lower === "function" || typeof upper === "function" ? new Map(data.map((d, i) => [d, i])) : null;
	return rows.map((row, s) => {
		const lo = new Array(row.length).fill(NaN);
		const hi = new Array(row.length).fill(NaN);
		const fl = boundField(lower, s, wide);
		const fh = boundField(upper, s, wide);
		if (fl === null || fh === null) return {
			lo,
			hi
		};
		const readLo = numGetter(fl, "");
		const readHi = numGetter(fh, "");
		for (let k = Math.max(0, from); k < row.length; k++) {
			const d = row[k];
			if (d === null) continue;
			const i = index?.get(d) ?? -1;
			const a = readLo(d, i);
			const b = readHi(d, i);
			if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
			lo[k] = Math.min(a, b);
			hi[k] = Math.max(a, b);
		}
		return {
			lo,
			hi
		};
	});
}
var isOutside = (v, lo, hi) => Number.isFinite(v) && Number.isFinite(lo) && (v < lo || v > hi);
function bandRuns(lo, hi) {
	const out = [];
	let a = -1;
	for (let k = 0; k <= lo.length; k++) {
		const ok = k < lo.length && Number.isFinite(lo[k]) && Number.isFinite(hi[k]);
		if (ok && a < 0) a = k;
		else if (!ok && a >= 0) {
			if (k - 1 > a) out.push([a, k - 1]);
			a = -1;
		}
	}
	return out;
}
function stepColumns(out, xs, lo, hi, y, a, b) {
	const xa = xs(a);
	const xb = xs(b);
	if (!(xb >= xa)) return;
	const c0 = Math.floor(xa);
	const n = Math.floor(xb) - c0 + 1;
	const L = new Array(n).fill(Infinity);
	const H = new Array(n).fill(-Infinity);
	let from = 0;
	for (let k = a; k < b; k++) {
		const l = Math.min(lo[k], lo[k + 1]);
		const h = Math.max(hi[k], hi[k + 1]);
		const to = Math.floor(xs(k + 1)) - c0;
		for (let c = from; c <= to; c++) {
			if (l < L[c]) L[c] = l;
			if (h > H[c]) H[c] = h;
		}
		from = to;
	}
	for (let c = 0; c < n; c++) {
		const left = Math.max(xa, c0 + c);
		const right = Math.min(xb, c0 + c + 1);
		if (right <= left && c > 0) continue;
		out.xl.push(left);
		out.xr.push(right);
		out.top.push(y(H[c]));
		out.bottom.push(y(L[c]));
	}
}
function bandShape(xs, lo, hi, y, budget) {
	const runs2 = bandRuns(lo, hi);
	if (!runs2.length) return null;
	const count = runs2.reduce((s, [a, b]) => s + b - a + 1, 0);
	const shape = {
		runs: [],
		xl: [],
		xr: [],
		top: [],
		bottom: []
	};
	const step = count > budget;
	for (const [a, b] of runs2) {
		shape.runs.push(shape.top.length);
		if (step) stepColumns(shape, xs, lo, hi, y, a, b);
		else for (let k = a; k <= b; k++) {
			shape.xl.push(xs(k));
			shape.top.push(y(hi[k]));
			shape.bottom.push(y(lo[k]));
		}
	}
	shape.runs.push(shape.top.length);
	return shape;
}
function stepPath(xl, xr, top, bottom, a, b) {
	let cur = r2(top[a]);
	let d = `M${r2(xl[a])},${cur}`;
	for (let i = a + 1; i < b; i++) {
		const t = r2(top[i]);
		if (t !== cur) d += `H${r2(xl[i])}V${cur = t}`;
	}
	cur = r2(bottom[b - 1]);
	d += `H${r2(xr[b - 1])}V${cur}`;
	for (let i = b - 2; i >= a; i--) {
		const v = r2(bottom[i]);
		if (v !== cur) d += `H${r2(xr[i])}V${cur = v}`;
	}
	return `${d}H${r2(xl[a])}Z`;
}
var points = (xs, ys, a, b) => xs.slice(a, b).map((x, i) => [x, ys[a + i]]);
function bandPath(s, top, bottom, curve) {
	let d = "";
	for (let r = 0; r + 1 < s.runs.length; r++) {
		const from = s.runs[r];
		const to = s.runs[r + 1];
		if (to - from < 1) continue;
		d += s.xr.length ? stepPath(s.xl, s.xr, top, bottom, from, to) : areaPath(points(s.xl, top, from, to), points(s.xl, bottom, from, to), curve);
	}
	return d;
}
function stack(values, offset = "zero") {
	const ns = values.length;
	const nk = ns ? values[0].length : 0;
	const y0 = values.map(() => new Array(nk).fill(0));
	const y1 = values.map(() => new Array(nk).fill(0));
	const v = (s, k) => {
		const x = values[s][k];
		return Number.isFinite(x) && x > 0 ? x : 0;
	};
	const base = new Array(nk).fill(0);
	if (offset === "wiggle" && ns > 0 && nk > 1) {
		let b = 0;
		for (let k = 1; k < nk; k++) {
			let s1 = 0;
			let s2 = 0;
			for (let s = 0; s < ns; s++) {
				const cur = v(s, k);
				const dv = cur - v(s, k - 1);
				let s3 = 0;
				for (let j = 0; j < s; j++) s3 += v(j, k) - v(j, k - 1);
				s1 += cur;
				s2 += (dv / 2 + s3) * cur;
			}
			if (s1) b -= s2 / s1;
			base[k] = b;
		}
	}
	for (let k = 0; k < nk; k++) {
		if (offset === "zero") {
			let pos = 0;
			let neg = 0;
			for (let s = 0; s < ns; s++) {
				const x = values[s][k];
				const val = Number.isFinite(x) ? x : 0;
				if (val >= 0) {
					y0[s][k] = pos;
					pos += val;
					y1[s][k] = pos;
				} else {
					y0[s][k] = neg;
					neg += val;
					y1[s][k] = neg;
				}
			}
			continue;
		}
		let tot = 0;
		for (let s = 0; s < ns; s++) tot += v(s, k);
		let acc = offset === "silhouette" ? -tot / 2 : base[k];
		for (let s = 0; s < ns; s++) {
			let val = v(s, k);
			if (offset === "expand") val = tot ? val / tot * 100 : 0;
			y0[s][k] = acc;
			acc += val;
			y1[s][k] = acc;
		}
	}
	if (offset === "wiggle" && nk) {
		let lo = Infinity;
		let hi = -Infinity;
		for (let k = 0; k < nk; k++) {
			lo = Math.min(lo, y0[0]?.[k] ?? 0);
			hi = Math.max(hi, y1[ns - 1]?.[k] ?? 0);
		}
		let mid = 0;
		for (let k = 0; k < nk; k++) mid += ((y0[0]?.[k] ?? 0) + (y1[ns - 1]?.[k] ?? 0)) / 2;
		mid /= nk;
		for (let s = 0; s < ns; s++) for (let k = 0; k < nk; k++) {
			y0[s][k] -= mid;
			y1[s][k] -= mid;
		}
	}
	return {
		y0,
		y1
	};
}
function insideOut(values) {
	const n = values.length;
	const peak = values.map((row) => {
		let best = 0;
		let bv = -Infinity;
		row.forEach((v, k) => {
			if (v > bv) {
				bv = v;
				best = k;
			}
		});
		return best;
	});
	const sums = values.map((row) => row.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0));
	const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => peak[a] - peak[b]);
	const top = [];
	const bottom = [];
	let st = 0;
	let sb = 0;
	for (const i of order) if (st < sb) {
		top.push(i);
		st += sums[i];
	} else {
		bottom.push(i);
		sb += sums[i];
	}
	return [...bottom.reverse(), ...top];
}
var MSG13 = {
	en: {
		line: "Line chart",
		area: "Area chart",
		/** 고른 구간을 읽어 줄 때 앞부분 */
		span: (range, change) => `${range}: ${change}`,
		desc: (nS, names, from, to, n) => `${plural(nS, "series", "series")} (${names}), x from ${from} to ${to}, ${plural(n, "point")}`,
		/** 경계 필드에 이름이 없을 때(함수) 툴팁에 쓰는 이름 */
		lower: "low",
		upper: "high",
		/** 설명: 칠한 범위. ranges는 "p5 to p95" 꼴 */
		band: (ranges) => ` Range ${ranges}.`,
		range: (lo, hi) => `${lo} to ${hi}`,
		/** 설명: 범위 밖 점 (outside 옵션) */
		outside: (n, where) => n ? ` ${plural(n, "point")} outside the range: ${where}.` : " No points outside the range.",
		/** 범위 밖 점 하나: x 이름표와 계열 */
		where: (label, series) => `${label} (${series})`
	},
	ko: {
		line: "라인 차트",
		area: "영역 차트",
		span: (range, change) => `${range} 구간 ${change}`,
		desc: (nS, names, from, to, n) => `계열 ${nS}개(${names}), x ${from}부터 ${to}까지 ${n}개 지점`,
		lower: "하한",
		upper: "상한",
		band: (ranges) => ` 범위 ${ranges}.`,
		range: (lo, hi) => `${lo}~${hi}`,
		outside: (n, where) => n ? ` 범위 밖 ${n}개 지점: ${where}.` : " 범위 밖 지점 없음.",
		where: (label, series) => `${label}(${series})`
	}
};
function sliceModel(m, a, b) {
	const lo = Math.max(0, Math.min(a, b));
	const hi = Math.min(m.keys.length - 1, Math.max(a, b));
	const keys = m.keys.slice(lo, hi + 1);
	return {
		type: m.type,
		keys,
		xnum: m.type === "band" ? keys.map((_, i) => i) : m.xnum.slice(lo, hi + 1),
		labels: m.labels.slice(lo, hi + 1),
		series: m.series,
		values: m.values.map((r) => r.slice(lo, hi + 1)),
		rows: m.rows.map((r) => r.slice(lo, hi + 1))
	};
}
function bandStartIndex(m, mode, from) {
	if (mode !== "forecast") return 0;
	const n = m.keys.length;
	if (from === void 0) return n;
	if (m.type === "band") {
		const i2 = m.keys.indexOf(String(from));
		return i2 < 0 ? n : i2;
	}
	const t = xNum(m.type, from);
	if (!Number.isFinite(t)) return n;
	const i = m.xnum.findIndex((v) => v >= t);
	return i < 0 ? n : i;
}
function describeBand(m, bands, names, outside, msg) {
	const named = (si, text2) => m.series.length > 1 && m.series[si] ? msg.where(text2, m.series[si]) : text2;
	const ranges = uniq(bands.flatMap((b, si) => b.lo.some(Number.isFinite) ? [named(si, msg.range(...names[si]))] : []));
	if (!ranges.length) return "";
	const text = msg.band(ranges.join(", "));
	if (!outside) return text;
	let n = 0;
	const where = [];
	bands.forEach((b, si) => {
		for (let k = 0; k < b.lo.length; k++) {
			if (!isOutside(m.values[si][k], b.lo[k], b.hi[k])) continue;
			n++;
			if (where.length < 5) where.push(named(si, m.labels[k]));
		}
	});
	return text + msg.outside(n, `${where.join(", ")}${n > where.length ? ", …" : ""}`);
}
function boundName(f, s, wide, fallback) {
	const v = boundField(f, s, wide);
	return typeof v === "string" && v ? v : fallback;
}
function xScaleFor(model, x0, x1) {
	const n = model.keys.length;
	if (model.type === "band") {
		const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
		return (k) => n > 1 ? x0 + k * step : (x0 + x1) / 2;
	}
	const [lo, hi] = extent(model.xnum);
	const s = scaleLinear([lo, hi === lo ? lo + 1 : hi], [x0, x1]);
	return Object.assign((k) => s(model.xnum[k]), { v: s });
}
function XAxis(props) {
	const { c, model, xs, x0, x1, y } = props;
	const p = c.p;
	let ticks;
	if (model.type === "date" && model.keys.length > 1) {
		const t0 = model.xnum[0];
		const t1 = model.xnum[model.xnum.length - 1];
		const maxT = Math.max(2, Math.floor((x1 - x0) / 64));
		const sx = scaleLinear([t0, t1], [x0, x1]);
		const tt = timeTicks(t0, t1, maxT, c.locale);
		if (tt.length >= 2 && model.keys.length > tt.length) ticks = tt.map((t) => ({
			x: sx(t.t),
			label: t.label
		}));
		else {
			const centers = model.keys.map((_, k) => xs(k));
			ticks = thinLabels(centers, model.labels).map((k) => ({
				x: centers[k],
				label: model.labels[k]
			}));
		}
	} else if (model.type === "number" && model.keys.length > 12) {
		const [a, b] = extent(model.xnum);
		const sx = scaleLinear([a, b], [x0, x1]);
		const xf = a >= 1e3 && b <= 9999 ? String : makeTickFormatter(void 0, c.locale, Math.max(-a, b));
		ticks = sx.ticks(Math.max(2, Math.floor((x1 - x0) / 70))).map((v) => ({
			x: sx(v),
			label: xf(v)
		}));
	} else {
		const centers = model.keys.map((_, k) => xs(k));
		ticks = thinLabels(centers, model.labels).map((k) => ({
			x: centers[k],
			label: model.labels[k]
		}));
	}
	const keep = fitTickLabels(ticks, -2, c.width + 2);
	return /* @__PURE__ */ jsx("g", {
		"aria-hidden": "true",
		children: keep.map((t, i) => /* @__PURE__ */ jsx(Txt, {
			x: t.x,
			y,
			anchor: "middle",
			size: AXIS_FONT,
			fill: p.paint("muted"),
			children: t.label
		}, i))
	});
}
function XYChart(props) {
	const isArea = props.kind === "area";
	const c = useChart(props, {
		height: (w) => Math.max(200, Math.min(300, w * .5)),
		duration: 1100,
		stagger: 120
	});
	const { p, width: W, height: H } = c;
	const msg = MSG13[c.lang];
	const gid = useId().replace(/:/g, "");
	const model0 = useMemo(() => prepSeries(props.data, props.x, props.y, props.series, {
		xType: props.xType,
		locale: c.locale
	}), [
		props.data,
		props.x,
		props.y,
		props.series,
		props.xType,
		c.locale
	]);
	const nS = model0.series.length;
	const stackMode = isArea ? props.stack ?? (nS > 1 ? "stacked" : "none") : "none";
	const zoom = useZoom(c.sig);
	const view = zoom.view;
	const viewed = useMemo(() => view ? sliceModel(model0, view[0], view[1]) : model0, [model0, view]);
	const areaBudget = Math.max(40, Math.round(props.maxPoints ?? W / 2));
	const model = useMemo(() => stackMode !== "none" ? bucketSeries(viewed, areaBudget) : viewed, [
		viewed,
		stackMode,
		areaBudget
	]);
	const rowVals = model.rowValues ?? model.values;
	const stacked = useMemo(() => stackMode === "none" ? null : stack(model.values, stackMode === "percent" ? "expand" : "zero"), [model, stackMode]);
	const fFrom = forecastFrom(props.annotations);
	const { lower, upper } = props;
	const bandStart = bandStartIndex(model, props.bandFrom, fFrom);
	const bands = useMemo(() => {
		if (lower === void 0 || upper === void 0 || stackMode !== "none") return null;
		const b = bandBounds(model.rows, lower, upper, Array.isArray(props.y), props.data, bandStart);
		return b.some((s) => s.lo.some(Number.isFinite)) ? b : null;
	}, [
		model,
		lower,
		upper,
		props.y,
		props.data,
		stackMode,
		bandStart
	]);
	const bandYs = useMemo(() => {
		const ys = [];
		bands?.forEach((b) => b.lo.forEach((v, k) => Number.isFinite(v) && ys.push(v, b.hi[k])));
		return ys.length ? extent(ys) : ys;
	}, [bands]);
	const hi = useMemo(() => {
		const totals = model.values.map((row) => row.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0));
		return resolveHighlight(props.highlight, model.series, model.series, totals, "first");
	}, [model, props.highlight]);
	const colors = useMemo(() => {
		if (isArea) return props.colorMode === "categorical" ? categorical(p, nS, hi) : ramp(p, nS, hi);
		if (props.colorMode === "categorical") return categorical(p, nS, hi);
		const rest = swatch(p, "strong");
		const acc = swatch(p, "accent");
		return model.series.map((_, s) => hi.has(s) ? acc : rest);
	}, [
		isArea,
		props.colorMode,
		p,
		nS,
		hi,
		model.series
	]);
	const allY = [];
	if (stacked) stacked.y1.forEach((r) => r.forEach((v) => allY.push(v)));
	else model.values.forEach((r) => r.forEach((v) => Number.isFinite(v) && allY.push(v)));
	allY.push(...bandYs);
	props.referenceLines?.forEach((r) => allY.push(r.y));
	allY.push(...annotationYs(props.annotations));
	const signOn = !!props.signColors && stackMode === "none";
	const baseline = props.baseline ?? 0;
	if (signOn) allY.push(baseline);
	const [mn, mx] = extent(allY);
	const dom = props.yDomain ?? (stackMode === "percent" ? [0, 100] : fitDomain(mn, mx, Math.max(2, Math.round(H / 70)), { zero: props.zero ?? isArea }));
	const tickFmt = stackMode === "percent" ? (v) => `${v}%` : makeTickFormatter(props.format, c.locale, Math.max(Math.abs(dom[0]), Math.abs(dom[1])));
	const yTicks = scaleLinear(dom, [0, 1]).ticks(Math.max(2, Math.round(H / 70)));
	const left = yAxisWidth(yTicks, tickFmt, c.locale);
	const endLabels = props.endLabels ?? nS > 1;
	const lastIdx = (s) => {
		for (let k = model.keys.length - 1; k >= 0; k--) if (Number.isFinite(model.values[s][k])) return k;
		return -1;
	};
	const endW = endLabels ? Math.min(W * .28, Math.max(...model.series.map((s) => textWidth(s, 11, 700)), 20) + 14) : 10;
	const top = props.yLabel ? 22 : 10;
	const bottom = 22;
	const x0 = left + 6;
	const x1 = W - endW;
	const y = scaleLinear(dom, [H - bottom, top]);
	const xs = xScaleFor(model, x0, x1);
	const centers = useMemo(() => model.keys.map((_, k) => xs(k)), [
		model,
		x0,
		x1
	]);
	const maxPts = props.maxPoints ?? Math.max(60, Math.round((x1 - x0) * 2));
	const curve = props.curve ?? "smooth";
	const base0 = Math.min(dom[1], Math.max(dom[0], 0));
	const down = p.color(props.downColor, "neutralStrong");
	const yb = y(baseline);
	const xv = xs.v;
	const xn = (v) => xv ? xNum(model.type, v) : model.keys.indexOf(String(v));
	const xAt = (v) => {
		const n = xn(v);
		return xv ? Number.isFinite(n) ? xv(n) : null : n < 0 ? null : xs(n);
	};
	const last = model.xnum.length - 1;
	const geom = {
		p,
		lang: c.lang,
		xAt,
		y,
		x0,
		x1,
		top,
		bottom: H - bottom,
		half: xv || last < 1 ? 0 : (xs(1) - xs(0)) / 2,
		time: model.type === "date" && xv && last > 0 ? {
			t0: model.xnum[0],
			t1: model.xnum[last],
			n: last + 1,
			xt: xv
		} : void 0,
		points: () => {
			const hs = [...hi][0] ?? 0;
			return centers.map((x, k) => ({
				x,
				y: y(stacked ? stacked.y1[hs][k] : model.values[hs][k])
			}));
		}
	};
	const xf = forecastX(geom, fFrom);
	const xText = (v) => {
		const n = xn(v);
		const k = xv ? model.xnum.indexOf(n) : n;
		return k >= 0 ? model.labels[k] : String(v ?? "");
	};
	const toneOf = (si, v) => signOn && hi.has(si) && v < baseline ? down : colors[si].fill;
	const breaks = !props.connectNulls && !stacked && model.keys.length > 1;
	const draws = useMemo(() => {
		return model.series.map((name, s) => {
			const val = (k) => stacked ? stacked.y1[s][k] : model.values[s][k];
			let parts = [];
			for (let k = 0; k < model.keys.length; k++) {
				if (!Number.isFinite(val(k))) continue;
				const last2 = parts[parts.length - 1];
				if (last2 && (!breaks || last2[last2.length - 1] === k - 1)) last2.push(k);
				else parts.push([k]);
			}
			const count = parts.reduce((t, q) => t + q.length, 0);
			if (count > maxPts) parts = parts.map((q) => lttb(q.map((k) => ({
				x: xs(k),
				y: val(k),
				k
			})), parts.length > 1 ? Math.max(3, Math.round(maxPts * q.length / count)) : maxPts).map((o) => o.k));
			const idx = parts.flat();
			let at = 0;
			const spans = parts.map((q) => [at, at += q.length]);
			const pts2 = idx.map((k) => y(val(k)));
			const base = stacked ? idx.map((k) => y(stacked.y0[s][k])) : isArea ? idx.map(() => y(base0)) : void 0;
			const draw = {
				s,
				name,
				pts: pts2,
				xs: idx.map((k) => xs(k)),
				base,
				sw: colors[s],
				hi: hi.has(s),
				idx,
				spans
			};
			const b = bands?.[s];
			const band = b ? bandShape(xs, b.lo, b.hi, y, maxPts) : null;
			if (!b || !band) return draw;
			const out = props.outside ? idx.flatMap((k, i) => isOutside(model.values[s][k], b.lo[k], b.hi[k]) ? [i] : []) : void 0;
			return {
				...draw,
				band,
				out
			};
		});
	}, [
		model,
		stacked,
		colors,
		hi,
		x0,
		x1,
		H,
		dom[0],
		dom[1],
		maxPts,
		isArea,
		bands,
		props.outside,
		breaks
	]);
	const stg = c.motion.stagger ?? 120;
	const order = useMemo(() => [...draws].sort((a, b) => Number(a.hi) - Number(b.hi)), [draws]);
	const m = useMotion(useMemo(() => order.map((d, k) => {
		const baseLine = y(base0);
		const band = d.band ? [...d.band.top, ...d.band.bottom] : [];
		const bandParts = d.band ? [d.band.top.length, d.band.bottom.length] : [];
		if (isArea) {
			const b = d.base ?? d.pts.map(() => baseLine);
			return {
				key: `s:${d.name}`,
				to: [
					1,
					...d.pts,
					...b,
					...band
				],
				from: [
					0,
					...d.pts.map(() => baseLine),
					...b.map(() => baseLine),
					...band.map(() => baseLine)
				],
				delay: k * stg * .5,
				parts: [
					1,
					d.pts.length,
					b.length,
					...bandParts
				],
				data: d
			};
		}
		return {
			key: `s:${d.name}`,
			to: [
				1,
				...d.pts,
				...band
			],
			from: [
				0,
				...d.pts,
				...band
			],
			enter: [
				0,
				...d.pts,
				...band
			],
			delay: k * stg,
			parts: [
				1,
				d.pts.length,
				...bandParts
			],
			data: d
		};
	}), [
		order,
		stg,
		isArea,
		H,
		base0
	]), c.motion);
	const fv = c.fv;
	const fmt = c.fmt;
	const bandText = useMemo(() => {
		if (!bands) return null;
		const wide = Array.isArray(props.y);
		const names = model.series.map((_, si) => [boundName(lower, si, wide, msg.lower), boundName(upper, si, wide, msg.upper)]);
		const range = (si, k) => Number.isFinite(bands[si].lo[k]) ? ` (${names[si][0]} ${fmt(bands[si].lo[k])} ~ ${names[si][1]} ${fmt(bands[si].hi[k])})` : "";
		return {
			range,
			unnamed: typeof props.y === "string" ? props.y : void 0,
			desc: describeBand(model, bands, names, props.outside === true, msg)
		};
	}, [
		bands,
		props.y,
		model,
		lower,
		upper,
		msg,
		fmt,
		props.outside
	]);
	const events = useMemo(() => {
		const hs = [...hi][0] ?? 0;
		const line = (s, si, k) => {
			const name = s || bandText?.unnamed;
			return `${name ? `${name} ` : ""}${fv(rowVals[si][k])}${bandText?.range(si, k) ?? ""}`;
		};
		return lazyArray(model.keys.length, (k) => {
			const v = rowVals[hs]?.[k];
			return {
				datum: model.rows[hs]?.[k] ?? null,
				index: k,
				key: model.keys[k],
				label: model.labels[k],
				value: Number.isFinite(v) ? v : null,
				formatted: model.series.map((s, si) => Number.isFinite(rowVals[si][k]) ? line(s, si, k) : null).filter(Boolean).join(", ")
			};
		});
	}, [
		model,
		rowVals,
		hi,
		fv,
		bandText
	]);
	const fullIndexOf = (key, fallback) => {
		const i = model0.keys.indexOf(key);
		return i < 0 ? fallback : i;
	};
	const { brush, frame: brushFrame, hint, text: brushText } = useChartBrush(props, zoom, {
		p,
		active: c.active,
		lang: c.lang,
		count: model.keys.length,
		indexAt: (px) => nearestIndex(centers, px),
		inPlot: (px, py) => px >= x0 - 4 && px <= x1 + 4 && py >= top && py <= H - bottom,
		toXRange: (r) => {
			const fk = model.keys[r.from];
			const tk = model.keys[r.to];
			return {
				from: fullIndexOf(fk, r.from),
				to: fullIndexOf(tk, r.to),
				fromKey: fk,
				toKey: tk,
				fromLabel: model.labels[r.from],
				toLabel: model.labels[r.to]
			};
		}
	});
	const activeK = c.active;
	useSync(c, props.syncId, model.keys, model.labels);
	let tip = null;
	if (activeK !== null && model.keys[activeK] !== void 0 && !brush.dragging) {
		const share = stackMode === "percent" ? stack(rowVals.map((r) => [r[activeK]]), "expand") : null;
		const rows = model.series.map((s, si) => ({
			s,
			si,
			v: rowVals[si][activeK]
		})).filter((r) => Number.isFinite(r.v)).sort((a, b) => b.v - a.v).map((r) => {
			const range = bandText?.range(r.si, activeK);
			const value = share ? `${Math.round(share.y1[r.si][0] - share.y0[r.si][0])}% · ${c.fv(r.v)}` : c.fv(r.v);
			return {
				label: r.s || bandText?.unnamed || c.t.value,
				value: range ? /* @__PURE__ */ jsxs(Fragment, { children: [value, /* @__PURE__ */ jsx("span", {
					style: {
						fontWeight: 500,
						color: p.paint("muted")
					},
					children: range
				})] }) : value,
				color: toneOf(r.si, r.v),
				strong: hi.has(r.si)
			};
		});
		const yy = Math.min(...model.series.map((_, si) => stacked ? y(stacked.y1[si][activeK]) : Number.isFinite(model.values[si][activeK]) ? y(model.values[si][activeK]) : H));
		tip = {
			x: xs(activeK),
			y: Math.max(top, yy),
			title: model.labels[activeK],
			rows: capTipRows(rows, c.t.more)
		};
	}
	const onMove = (px) => {
		if (!model.keys.length) return;
		const k = nearestIndex(centers, px);
		if (k >= 0 && k !== c.active) c.setActive(k, "pointer");
	};
	let brushLayer = null;
	let announce;
	if (brush.range && brush.range.to < model.keys.length) {
		const { from, to } = brush.range;
		const hs = [...hi][0] ?? 0;
		const vals = model.values[hs] ?? [];
		let first = NaN;
		let last2 = NaN;
		let maxK = -1;
		let minK = -1;
		for (let k = from; k <= to; k++) {
			const v = vals[k];
			if (!Number.isFinite(v)) continue;
			if (!Number.isFinite(first)) first = v;
			last2 = v;
			if (maxK < 0 || v > vals[maxK]) maxK = k;
			if (minK < 0 || v < vals[minK]) minK = k;
		}
		const ratio = changeRatio(first, last2);
		const main = ratio !== null ? signedPercent(ratio, c.locale) : Number.isFinite(last2 - first) ? `${last2 - first >= 0 ? "+" : ""}${c.fv(last2 - first)}` : "-";
		const sub = brushText.range(model.labels[from], model.labels[to]);
		const yAt = (k) => y(stacked ? stacked.y1[hs][k] : vals[k]);
		const plotBottom = H - bottom;
		brushLayer = /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(BrushBand, {
			p,
			x0: centers[from],
			x1: centers[to],
			top,
			bottom: plotBottom,
			width: W,
			main,
			sub,
			dragging: brush.dragging
		}), maxK >= 0 && minK >= 0 && maxK !== minK ? /* @__PURE__ */ jsx(ExtremeTags, {
			p,
			lang: c.lang,
			width: W,
			top,
			bottom: plotBottom,
			max: {
				x: centers[maxK],
				y: yAt(maxK),
				text: c.fv(vals[maxK])
			},
			min: {
				x: centers[minK],
				y: yAt(minK),
				text: c.fv(vals[minK])
			}
		}) : null] });
		if (!brush.dragging) announce = `${msg.span(sub, main)}${maxK >= 0 ? brushText.extremes(c.fv(vals[maxK]), c.fv(vals[minK])) : ""}.${hint}`;
	}
	const ends = endLabels ? (() => {
		const list = draws.map((d) => {
			const li = lastIdx(d.s);
			if (li < 0) return null;
			return {
				d,
				y: stacked ? y((stacked.y0[d.s][li] + stacked.y1[d.s][li]) / 2) : y(model.values[d.s][li])
			};
		}).filter((v) => v !== null);
		const ys = dodgeVertical(list.map((l) => l.y), 14, top + 4, H - bottom - 2);
		return list.map((l, i) => ({
			...l,
			ly: ys[i]
		}));
	})() : [];
	const D = c.motion.duration ?? 1100;
	const dots = props.dots ?? "auto";
	const showDots = dots === true || dots === "auto" && !isArea && model.keys.length <= 16;
	const kindName = isArea ? msg.area : msg.line;
	const desc = props.description ?? `${kindName}. ${msg.desc(nS, model.series.filter(Boolean).join(", ") || c.t.value, model.labels[0] ?? "", model.labels[model.labels.length - 1] ?? "", model.keys.length)}.${bandText?.desc ?? ""}${describeAnnotations(props.annotations, c.lang, c.fv, xText)}`;
	const pieces = [];
	const bandLayer = [];
	for (const it of m.items) {
		const d = it.data;
		const v = it.v;
		const n = d.xs.length;
		const draw = v[0];
		const ys = v.slice(1, 1 + n);
		const pts2 = d.xs.map((xx, i) => [xx, ys[i] ?? ys[ys.length - 1] ?? 0]);
		const sign = signOn && d.hi;
		const spans = d.spans;
		const lines = spans.map(([a, b]) => linePath(pts2.slice(a, b), curve));
		const signArea = sign ? spans.map(([a], r) => `${lines[r]}V${r2(yb)}H${r2(d.xs[a])}Z`).join("") : "";
		const areaD = (bottom2) => spans.map(([a, b]) => areaPath(pts2.slice(a, b), bottom2.slice(a, b), curve)).join("");
		const lone = breaks ? spans.filter(([a, b]) => b - a === 1).map(([a]) => a) : [];
		const dot = (i, opacity) => {
			const [xx, yy] = pts2[i];
			const col = sign && yy > yb ? down : d.sw.fill;
			return /* @__PURE__ */ jsx("circle", {
				cx: xx,
				cy: yy,
				r: d.hi ? 3 : 2.2,
				fill: d.hi ? col : p.paint("panel"),
				stroke: col,
				strokeWidth: d.hi ? 0 : 1.4,
				opacity
			}, i);
		};
		if (d.band) {
			const o = 1 + (isArea ? 2 * n : n);
			const nb = d.band.top.length;
			bandLayer.push(/* @__PURE__ */ jsx("path", {
				d: bandPath(d.band, v.slice(o, o + nb), v.slice(o + nb, o + 2 * nb), curve),
				fill: d.sw.fill,
				opacity: .16 * draw * (it.exiting ? .4 : 1)
			}, it.key));
		}
		const outsideDots = (opacity) => d.out?.map((i) => {
			const [xx, yy] = pts2[i];
			return /* @__PURE__ */ jsx("circle", {
				cx: xx,
				cy: yy,
				r: 3.6,
				fill: sign && yy > yb ? down : d.sw.fill,
				stroke: p.paint("panel"),
				strokeWidth: 1.5,
				opacity: opacity(i)
			}, `o${i}`);
		});
		if (isArea) {
			const bs = v.slice(1 + n, 1 + 2 * n);
			const bottomPts = d.xs.map((xx, i) => [xx, bs[i] ?? y(base0)]);
			const lp = lines.join("");
			const fills = sign ? ["up", "dn"].map((t) => /* @__PURE__ */ jsx("path", {
				d: signArea,
				fill: t === "up" ? d.sw.fill : down,
				opacity: .5,
				clipPath: `url(#${gid}${t})`
			}, t)) : /* @__PURE__ */ jsx("path", {
				d: areaD(bottomPts),
				fill: d.sw.fill,
				opacity: stackMode === "none" ? d.hi ? .5 : .28 : 1
			});
			const stroke = (dashed) => (sign ? ["up", "dn"] : [null]).map((t) => /* @__PURE__ */ jsx("path", {
				d: lp,
				fill: "none",
				stroke: t === "dn" ? down : stackMode === "none" ? d.sw.fill : p.paint("panel"),
				strokeWidth: stackMode === "none" ? d.hi ? 2.2 : 1.4 : 1.2,
				strokeLinejoin: "round",
				strokeDasharray: dashed ? "5 4" : void 0,
				opacity: Math.min(1, draw * 1.4),
				clipPath: t ? `url(#${gid}${t})` : void 0
			}, t ?? "s"));
			pieces.push(/* @__PURE__ */ jsxs("g", {
				opacity: it.exiting ? .4 : 1,
				children: [
					fills,
					xf !== null ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("g", {
						clipPath: `url(#${gid}pre)`,
						children: stroke(false)
					}), /* @__PURE__ */ jsx("g", {
						clipPath: `url(#${gid}post)`,
						children: stroke(true)
					})] }) : stroke(false),
					lone.map((i) => dot(i, Math.min(1, draw * 1.4))),
					outsideDots(() => Math.min(1, draw * 1.4))
				]
			}, it.key));
		} else {
			const width = d.hi ? 2.6 : 1.7;
			const dash = draw < .999;
			const appear = (i) => Math.max(0, Math.min(1, (draw - (n > 1 ? i / (n - 1) : 1)) * 8 + (draw >= .999 ? 1 : 0)));
			const segs = dash && spans.length > 1 ? spans.flatMap(([a, b], r) => b - a > 1 ? [[lines[r], Math.max(0, Math.min(1, (draw * (n - 1) - a) / (b - 1 - a)))]] : []) : [[lines.join(""), draw]];
			const stroke = (dashed) => (sign ? ["up", "dn"] : [null]).flatMap((t) => segs.map(([sd, sp], j) => /* @__PURE__ */ jsx("path", {
				d: sd,
				fill: "none",
				stroke: t === "dn" ? down : d.sw.fill,
				strokeWidth: width,
				strokeLinejoin: "round",
				strokeLinecap: "round",
				pathLength: dash ? 1 : void 0,
				strokeDasharray: dash ? "1 1" : dashed ? "5 4" : void 0,
				strokeDashoffset: dash ? 1 - sp : void 0,
				clipPath: t ? `url(#${gid}${t})` : void 0
			}, `${t ?? "s"}${j}`)));
			const under = props.area && d.hi ? sign ? ["up", "dn"].map((t) => /* @__PURE__ */ jsx("path", {
				d: signArea,
				fill: t === "up" ? d.sw.fill : down,
				opacity: .16 * draw,
				clipPath: `url(#${gid}${t})`
			}, t)) : /* @__PURE__ */ jsx("path", {
				d: areaD(pts2.map(([xx]) => [xx, y(base0)])),
				fill: `url(#${gid}g)`,
				opacity: draw
			}) : null;
			pieces.push(/* @__PURE__ */ jsxs("g", {
				opacity: it.exiting ? .4 : 1,
				children: [
					under,
					xf !== null ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("g", {
						clipPath: `url(#${gid}pre)`,
						children: stroke(false)
					}), /* @__PURE__ */ jsx("g", {
						clipPath: `url(#${gid}post)`,
						children: stroke(true)
					})] }) : stroke(false),
					(showDots ? pts2.map((_, i) => i) : lone).map((i) => dot(i, appear(i))),
					outsideDots(appear)
				]
			}, it.key));
		}
	}
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: kindName,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, _py, e) => {
			brush.move(px);
			if (e.pointerType === "touch") c.setActive(nearestIndex(centers, px), "touch");
			else onMove(px);
		},
		...brushFrame,
		announce,
		defs: props.area || xf !== null || signOn ? /* @__PURE__ */ jsxs(Fragment, { children: [
			props.area ? /* @__PURE__ */ jsxs("linearGradient", {
				id: `${gid}g`,
				x1: "0",
				x2: "0",
				y1: "0",
				y2: "1",
				children: [/* @__PURE__ */ jsx("stop", {
					offset: "0%",
					stopColor: p.paint("accent"),
					stopOpacity: .28
				}), /* @__PURE__ */ jsx("stop", {
					offset: "100%",
					stopColor: p.paint("accent"),
					stopOpacity: 0
				})]
			}) : null,
			xf !== null ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("clipPath", {
				id: `${gid}pre`,
				children: /* @__PURE__ */ jsx("rect", {
					x: -W,
					y: -H,
					width: W + xf,
					height: H * 3
				})
			}), /* @__PURE__ */ jsx("clipPath", {
				id: `${gid}post`,
				children: /* @__PURE__ */ jsx("rect", {
					x: xf,
					y: -H,
					width: W * 2,
					height: H * 3
				})
			})] }) : null,
			signOn ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("clipPath", {
				id: `${gid}up`,
				children: /* @__PURE__ */ jsx("rect", {
					x: -W,
					y: -H,
					width: W * 3,
					height: H + yb
				})
			}), /* @__PURE__ */ jsx("clipPath", {
				id: `${gid}dn`,
				children: /* @__PURE__ */ jsx("rect", {
					x: -W,
					y: yb,
					width: W * 3,
					height: H * 2
				})
			})] }) : null
		] }) : null,
		children: [
			props.yLabel ? /* @__PURE__ */ jsx(Txt, {
				x: left,
				y: 6,
				anchor: "start",
				size: 10.5,
				fill: p.paint("muted"),
				children: props.yLabel
			}) : null,
			/* @__PURE__ */ jsx(GridY, {
				p,
				ticks: yTicks,
				y,
				x0: left,
				x1: x1 + 4,
				fmt: tickFmt,
				locale: c.locale
			}),
			/* @__PURE__ */ jsx(AnnotationsUnder, {
				list: props.annotations,
				g: geom
			}),
			signOn ? /* @__PURE__ */ jsx("line", {
				x1: x0,
				x2: x1,
				y1: yb,
				y2: yb,
				stroke: p.paint("dim"),
				pointerEvents: "none"
			}) : null,
			props.referenceLines?.map((r, i) => /* @__PURE__ */ jsx("line", {
				x1: x0,
				x2: x1,
				y1: y(r.y),
				y2: y(r.y),
				stroke: p.paint("dim"),
				strokeDasharray: "3 3"
			}, i)),
			/* @__PURE__ */ jsx("rect", {
				x: x0,
				y: top,
				width: Math.max(0, x1 - x0),
				height: Math.max(0, H - bottom - top),
				fill: "transparent"
			}),
			bandLayer,
			pieces,
			/* @__PURE__ */ jsx(AnnotationsOver, {
				list: props.annotations,
				g: geom
			}),
			activeK !== null && model.keys[activeK] !== void 0 ? /* @__PURE__ */ jsx(HoverLine, {
				p,
				x: xs(activeK),
				top,
				bottom: H - bottom,
				dots: model.series.flatMap((_, si) => {
					const v = stacked ? stacked.y1[si][activeK] : model.values[si][activeK];
					return Number.isFinite(v) ? [{
						k: si,
						y: y(v),
						color: toneOf(si, v),
						strong: hi.has(si)
					}] : [];
				})
			}) : null,
			props.referenceLines?.map((r, i) => r.label ? /* @__PURE__ */ jsxs("g", {
				pointerEvents: "none",
				children: [/* @__PURE__ */ jsx("rect", {
					x: x1 - textWidth(r.label, 10.5) - 8,
					y: y(r.y) - 17,
					width: textWidth(r.label, 10.5) + 8,
					height: 15,
					rx: 5,
					fill: p.paint("panel"),
					opacity: .94
				}), /* @__PURE__ */ jsx(Txt, {
					x: x1 - 4,
					y: y(r.y) - 9.5,
					anchor: "end",
					size: 10.5,
					fill: p.paint("muted"),
					children: r.label
				})]
			}, `rl${i}`) : null),
			ends.map((e) => /* @__PURE__ */ jsx(Txt, {
				x: x1 + 8,
				y: e.ly,
				size: 11,
				weight: e.d.hi ? 800 : 500,
				fill: p.paint(e.d.hi ? "ink" : "muted"),
				opacity: m.fade(D * .75, 300),
				children: truncate(e.d.name, endW - 10, 11, e.d.hi ? 800 : 500)
			}, e.d.name)),
			brushLayer,
			/* @__PURE__ */ jsx(XAxis, {
				c,
				model,
				xs,
				x0,
				x1,
				y: H - bottom + 13
			}),
			activeK !== null && model.keys[activeK] !== void 0 && !brush.dragging ? /* @__PURE__ */ jsx(AxisPill, {
				p,
				x: xs(activeK),
				y: H - bottom + 13,
				label: model.labels[activeK],
				width: W
			}) : null
		]
	});
}
function LineChart(props) {
	return /* @__PURE__ */ jsx(XYChart, {
		...props,
		kind: "line"
	});
}
function AreaChart(props) {
	return /* @__PURE__ */ jsx(XYChart, {
		...props,
		kind: "area"
	});
}
var MSG14 = {
	en: {
		kind: "Streamgraph",
		desc: (nS, names, n) => `${plural(nS, "series", "series")} (${names}), ${plural(n, "point")}`
	},
	ko: {
		kind: "스트림그래프",
		desc: (nS, names, n) => `계열 ${nS}개(${names}), ${n}개 지점`
	}
};
function StreamGraph(props) {
	const c = useChart(props, {
		height: (w) => Math.max(200, Math.min(290, w * .48)),
		duration: 1100,
		stagger: 60
	});
	const { p, width: W, height: H } = c;
	const model0 = useMemo(() => prepSeries(props.data, props.x, props.y, props.series, {
		xType: props.xType,
		locale: c.locale
	}), [
		props.data,
		props.x,
		props.y,
		props.series,
		props.xType,
		c.locale
	]);
	const budget = Math.max(40, Math.round(W / 2));
	const model = useMemo(() => bucketSeries(model0, budget), [model0, budget]);
	const rowVals = model.rowValues ?? model.values;
	const nS = model.series.length;
	const order = useMemo(() => props.reorder === false ? model.series.map((_, i) => i) : insideOut(model.values), [model, props.reorder]);
	const st = useMemo(() => stack(order.map((s) => model.values[s]), props.offset ?? "wiggle"), [
		model,
		order,
		props.offset
	]);
	const hi = useMemo(() => {
		const totals = model.values.map((r) => r.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0));
		return resolveHighlight(props.highlight, model.series, model.series, totals, "max");
	}, [model, props.highlight]);
	const top = 8;
	const bottom = 22;
	const x0 = 4;
	const x1 = W - 4;
	const all = [];
	st.y0.forEach((r) => r.forEach((v) => all.push(v)));
	st.y1.forEach((r) => r.forEach((v) => all.push(v)));
	const [lo, hiV] = extent(all);
	const y = scaleLinear([lo, hiV], [H - bottom, top]);
	const xs = xScaleFor(model, x0, x1);
	const mid = y((lo + hiV) / 2);
	const centers = useMemo(() => model.keys.map((_, k) => xs(k)), [
		model,
		x0,
		x1
	]);
	const layers = useMemo(() => {
		const rest = order.filter((s) => !hi.has(s));
		const palette = /* @__PURE__ */ new Map();
		rest.forEach((s, j) => palette.set(s, rest.length === 1 ? swatch(p, "neutral") : midSwatch(p, 1 - j / Math.max(1, rest.length - 1))));
		return order.map((s, li) => {
			const topPx = st.y1[li].map((v) => y(v));
			const botPx = st.y0[li].map((v) => y(v));
			let best = -1;
			let bt = 0;
			topPx.forEach((t, k) => {
				const th = botPx[k] - t;
				const edge = k > 0 && k < topPx.length - 1;
				if (th > bt && edge) {
					bt = th;
					best = k;
				}
			});
			const name = model.series[s];
			const lw = textWidth(name, 11, 700);
			const label = best >= 0 && bt >= 15 ? {
				x: xs(best),
				y: (topPx[best] + botPx[best]) / 2,
				thick: bt
			} : null;
			const fitsX = label ? label.x - lw / 2 > 6 && label.x + lw / 2 < x1 - 2 : false;
			return {
				s,
				name,
				top: topPx,
				bot: botPx,
				sw: hi.has(s) ? swatch(p, "accent") : palette.get(s),
				hi: hi.has(s),
				label: fitsX ? label : null
			};
		});
	}, [
		order,
		st,
		hi,
		p,
		H,
		W,
		model
	]);
	const stg = c.motion.stagger ?? 60;
	const m = useMotion(useMemo(() => layers.map((L, k) => ({
		key: `l:${L.name}`,
		to: [...L.top, ...L.bot],
		from: [...L.top.map(() => mid), ...L.bot.map(() => mid)],
		delay: k * stg,
		parts: [L.top.length, L.bot.length],
		data: L
	})), [
		layers,
		mid,
		stg
	]), c.motion);
	const D = c.motion.duration ?? 1100;
	const curve = props.curve ?? "smooth";
	const fv = c.fv;
	const events = useMemo(() => lazyArray(model.keys.length, (k) => ({
		datum: null,
		index: k,
		key: model.keys[k],
		label: model.labels[k],
		value: rowVals.reduce((a, r) => a + (Number.isFinite(r[k]) ? r[k] : 0), 0),
		formatted: model.series.map((s, si) => Number.isFinite(rowVals[si][k]) ? `${s} ${fv(rowVals[si][k])}` : null).filter(Boolean).join(", ")
	})), [
		model,
		rowVals,
		fv
	]);
	let tip = null;
	if (c.active !== null && model.keys[c.active] !== void 0) {
		const k = c.active;
		const rows = layers.map((L) => ({
			L,
			v: rowVals[L.s][k]
		})).filter((r) => Number.isFinite(r.v)).sort((a, b) => b.v - a.v).map((r) => ({
			label: r.L.name,
			value: c.fv(r.v),
			color: r.L.sw.fill,
			strong: r.L.hi
		}));
		tip = {
			x: xs(k),
			y: Math.min(...layers.map((L) => L.top[k])),
			title: model.labels[k],
			rows: capTipRows(rows, c.t.more)
		};
	}
	const msg = MSG14[c.lang];
	const desc = props.description ?? `${msg.kind}. ${msg.desc(nS, model.series.join(", "), model.keys.length)}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, _py, e) => c.setActive(nearestIndex(centers, px), e.pointerType === "touch" ? "touch" : "pointer"),
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: x0,
				y: top,
				width: x1 - x0,
				height: H - bottom - top,
				fill: "transparent"
			}),
			m.items.map((it) => {
				const L = it.data;
				const n = L.top.length;
				const t = it.v.slice(0, n);
				const b = it.v.slice(n, 2 * n);
				const topPts = t.map((v, k) => [xs(k), v]);
				const botPts = b.map((v, k) => [xs(k), v]);
				return /* @__PURE__ */ jsx("path", {
					className: "ztd-mark",
					d: areaPath(topPts, botPts, curve),
					fill: L.sw.fill,
					stroke: p.paint("panel"),
					strokeWidth: 1,
					opacity: it.exiting ? .4 : 1
				}, it.key);
			}),
			c.active !== null ? /* @__PURE__ */ jsx("line", {
				x1: xs(c.active),
				x2: xs(c.active),
				y1: top,
				y2: H - bottom,
				stroke: p.paint("ink"),
				strokeOpacity: .55,
				strokeWidth: 1,
				pointerEvents: "none"
			}) : null,
			c.showLabels ? layers.map((L) => L.label ? /* @__PURE__ */ jsx(Txt, {
				x: L.label.x,
				y: L.label.y,
				anchor: "middle",
				size: 11,
				weight: 700,
				fill: L.sw.text,
				opacity: m.fade(D * .7, 300),
				children: L.name
			}, L.name) : null) : null,
			/* @__PURE__ */ jsx(XAxis, {
				c,
				model,
				xs,
				x0,
				x1,
				y: H - bottom + 13
			})
		]
	});
}
var MSG15 = {
	en: {
		kind: "Bar chart",
		desc: (cats, nS, names) => `${plural(cats, "category", "categories")}${nS > 1 ? `, ${nS} series (${names})` : ""}`
	},
	ko: {
		kind: "막대 차트",
		desc: (cats, nS, names) => `${cats}개 범주${nS > 1 ? `, 계열 ${nS}개(${names})` : ""}`
	}
};
function BarChart(props) {
	const horizontal = props.orientation === "horizontal";
	const c = useChart(props, {
		height: (w) => horizontal ? Math.max(180, Math.min(320, w * .5)) : Math.max(200, Math.min(290, w * .52)),
		duration: 750,
		stagger: 60
	});
	const { p, width: W, height: H } = c;
	const layout = props.layout ?? "grouped";
	const model0 = useMemo(() => prepSeries(props.data, props.x, props.y, props.series, {
		xType: "band",
		locale: c.locale
	}), [
		props.data,
		props.x,
		props.y,
		props.series,
		c.locale
	]);
	const model = useMemo(() => {
		if (!props.sort || model0.series.length !== 1) return model0;
		const idx = model0.keys.map((_, k) => k).sort((a, b) => (model0.values[0][b] || 0) - (model0.values[0][a] || 0));
		return {
			...model0,
			keys: idx.map((k) => model0.keys[k]),
			labels: idx.map((k) => model0.labels[k]),
			xnum: idx.map((_, i) => i),
			values: [idx.map((k) => model0.values[0][k])],
			rows: [idx.map((k) => model0.rows[0][k])]
		};
	}, [model0, props.sort]);
	const nS = model.series.length;
	const single = nS === 1;
	const hi = useMemo(() => {
		if (single) return resolveHighlight(props.highlight, model.rows[0], model.labels, model.values[0], "max");
		const totals = model.values.map((r3) => r3.reduce((a, v2) => a + (Number.isFinite(v2) ? v2 : 0), 0));
		return resolveHighlight(props.highlight, model.series, model.series, totals, "first");
	}, [
		model,
		single,
		props.highlight
	]);
	const colors = useMemo(() => single ? emphasis(p, model.keys.length, hi) : categorical(p, nS, hi), [
		single,
		p,
		model.keys.length,
		hi,
		nS
	]);
	const segs = useMemo(() => {
		const out = [];
		const st = layout === "grouped" ? null : stack(model.values, layout === "percent" ? "expand" : "zero");
		model.keys.forEach((cat, k) => {
			model.series.forEach((s, si) => {
				const v2 = model.values[si][k];
				if (!Number.isFinite(v2)) return;
				const v0 = st ? st.y0[si][k] : 0;
				const v1 = st ? st.y1[si][k] : v2;
				out.push({
					key: `${cat}|${s}`,
					k,
					s: si,
					cat: model.labels[k],
					series: s,
					value: v2,
					v0,
					v1,
					sw: single ? colors[k] : colors[si],
					hi: single ? hi.has(k) : hi.has(si)
				});
			});
		});
		return out;
	}, [
		model,
		layout,
		colors,
		single,
		hi
	]);
	const vals = segs.flatMap((s) => [s.v0, s.v1]);
	const notes = horizontal ? void 0 : props.annotations;
	if (layout !== "percent") vals.push(...annotationYs(notes));
	const [mn, mx] = extent(vals.length ? vals : [0, 1]);
	const dom = layout === "percent" ? [0, 100] : fitDomain(mn, mx, horizontal ? Math.max(2, Math.round(W / 120)) : Math.max(2, Math.round(H / 70)));
	const tickFmt = layout === "percent" ? (v2) => `${v2}%` : makeTickFormatter(props.format, c.locale, Math.max(Math.abs(dom[0]), Math.abs(dom[1])));
	const showValues = c.showLabels && (single || layout !== "grouped" || nS <= 3);
	const valueText = (sg) => layout === "percent" ? c.pct(sg.v1 - sg.v0) : c.fmt(sg.value);
	const catW = horizontal ? Math.min(W * .32, Math.max(...model.labels.map((l) => textWidth(l, 11.5, 600)), 24) + 10) : 0;
	const valPad = horizontal && showValues && layout !== "percent" ? Math.max(...segs.map((s) => textWidth(valueText(s), 11, 700)), 0) + 10 : 0;
	const ticks = scaleLinear(dom, [0, 1]).ticks(horizontal ? Math.max(2, Math.round(W / 130)) : Math.max(2, Math.round(H / 70)));
	const left = horizontal ? catW + 6 : yAxisWidth(ticks, tickFmt, c.locale);
	const top = horizontal ? 4 : showValues ? 16 : 8;
	const bottom = horizontal ? 18 : 22;
	const negPad = !horizontal && showValues && mn < 0 && (single || layout === "grouped") ? 16 : 0;
	const x0 = horizontal ? left : left + 4;
	const x1 = horizontal ? W - Math.max(8, valPad) : W - 2;
	const band = horizontal ? scaleBand(model.keys, [top, H - bottom], .3, .12) : scaleBand(model.keys, [x0, x1], nS > 1 && layout === "grouped" ? .24 : .32, .12);
	const v = horizontal ? scaleLinear(dom, [x0, x1]) : scaleLinear(dom, [H - bottom - negPad, top]);
	const inner = layout === "grouped" && nS > 1 ? scaleBand(model.series, [0, band.bandwidth], .12, 0) : null;
	const r = Math.min(p.theme.radiusMark, (inner ? inner.bandwidth : band.bandwidth) / 4);
	const fFrom = forecastFrom(notes);
	const fk = fFrom === void 0 ? -1 : band.index(String(fFrom));
	const ag = {
		p,
		lang: c.lang,
		xAt: (val) => {
			const k = band.index(String(val));
			return k < 0 ? null : band(model.keys[k]) + band.bandwidth / 2;
		},
		half: band.step / 2,
		edge: true,
		y: v,
		x0,
		x1,
		top,
		bottom: H - bottom,
		points: () => {
			if (layout === "percent") return [];
			const hs = [...hi][0] ?? 0;
			return model.keys.map((key, k) => {
				const val = single ? model.values[0][k] : layout === "grouped" ? model.values[hs][k] : model.values.reduce((s, row) => s + (Number.isFinite(row[k]) ? row[k] : 0), 0);
				return {
					x: band(key) + (inner ? inner(model.series[hs]) + inner.bandwidth / 2 : band.bandwidth / 2),
					y: v(val)
				};
			});
		}
	};
	const geom = (sg) => {
		return {
			pos: band(model.keys[sg.k]) + (inner ? inner(sg.series) : 0),
			th: inner ? inner.bandwidth : band.bandwidth,
			a: v(sg.v0),
			b: v(sg.v1)
		};
	};
	const shownValues = useMemo(() => single && !horizontal && showValues ? new Set(thinLabels(segs.map((sg) => band(model.keys[sg.k]) + band.bandwidth / 2), segs.map(valueText), band.bandwidth < 26 ? 10 : 11, 4, 500, new Set(segs.flatMap((sg, j) => sg.hi ? [j] : [])))) : null, [
		segs,
		single,
		horizontal,
		showValues,
		layout,
		W,
		H,
		c.fmt
	]);
	const stg = c.motion.stagger ?? 60;
	const m = useMotion(useMemo(() => segs.map((sg) => {
		const g = geom(sg);
		const base = v(Math.max(dom[0], Math.min(0, dom[1])));
		return {
			key: sg.key,
			to: [
				g.pos,
				g.th,
				g.a,
				g.b
			],
			from: [
				g.pos,
				g.th,
				layout === "grouped" ? base : g.a,
				layout === "grouped" ? base : g.a
			],
			enter: [
				g.pos,
				g.th,
				g.a,
				g.a
			],
			delay: sg.k * stg + sg.s * (layout === "grouped" ? 30 : 70),
			data: sg
		};
	}), [
		segs,
		W,
		H,
		dom[0],
		dom[1],
		stg,
		layout,
		horizontal
	]), c.motion);
	const events = segs.map((sg, i) => ({
		datum: model.rows[sg.s]?.[sg.k] ?? null,
		index: i,
		key: sg.key,
		label: sg.cat,
		series: sg.series || void 0,
		value: sg.value,
		formatted: `${c.fv(sg.value)}${layout === "percent" ? ` (${c.pct(sg.v1 - sg.v0)})` : ""}`
	}));
	const segIndex = new Map(segs.map((sg, i) => [sg.key, i]));
	const syncKeys = useMemo(() => ({
		keys: segs.map((sg) => syncKeyOf(model.keys[sg.k])),
		labels: segs.map((sg) => sg.cat)
	}), [segs, model]);
	useSync(c, props.syncId, syncKeys.keys, syncKeys.labels);
	const activeCat = c.active !== null ? segs[c.active]?.k ?? null : null;
	let tip = null;
	if (c.active !== null && segs[c.active]) {
		const sg = segs[c.active];
		const g = geom(sg);
		const rows = nS > 1 ? model.series.map((s, si) => ({
			label: s,
			value: Number.isFinite(model.values[si][sg.k]) ? c.fv(model.values[si][sg.k]) : "-",
			color: colors[si].fill,
			strong: si === sg.s
		})) : [{
			label: c.t.value,
			value: c.fv(sg.value),
			color: sg.sw.fill
		}];
		tip = horizontal ? {
			x: Math.max(g.a, g.b),
			y: g.pos,
			title: sg.cat,
			rows
		} : {
			x: g.pos + g.th / 2,
			y: Math.min(g.a, g.b),
			title: sg.cat,
			rows
		};
	}
	const msg = MSG15[c.lang];
	const auto = `${msg.kind}. ${msg.desc(model.keys.length, nS, model.series.join(", "))}. ${single ? model.labels.map((l, k) => `${l} ${c.fv(model.values[0][k])}`).slice(0, 8).join(", ") : ""}`;
	const desc = props.description ?? (notes?.length ? `${auto.trimEnd().replace(/\.?$/, ".")}${describeAnnotations(notes, c.lang, c.fv)}` : auto);
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			horizontal ? /* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: ticks.map((t) => /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("line", {
					x1: Math.round(v(t)) + .5,
					x2: Math.round(v(t)) + .5,
					y1: top,
					y2: H - bottom,
					stroke: p.paint(t === 0 ? "dim" : "line")
				}), /* @__PURE__ */ jsx(Txt, {
					x: v(t),
					y: H - bottom + 11,
					anchor: "middle",
					size: AXIS_FONT,
					fill: p.paint("muted"),
					children: tickFmt(t)
				})] }, t))
			}) : /* @__PURE__ */ jsx(GridY, {
				p,
				ticks,
				y: v,
				x0: left,
				x1: W,
				fmt: tickFmt,
				locale: c.locale
			}),
			/* @__PURE__ */ jsx(AnnotationsUnder, {
				list: notes,
				g: ag
			}),
			m.items.map((it) => {
				const sg = it.data;
				const [pos, th, a, b] = it.v;
				const i = segIndex.get(sg.key) ?? 0;
				const neg = sg.v1 < sg.v0 || sg.value < 0;
				const stackedTop = layout === "grouped" || sg.s === nS - 1;
				const corners = horizontal ? stackedTop ? neg ? {
					tl: r,
					bl: r
				} : {
					tr: r,
					br: r
				} : {} : stackedTop ? neg ? {
					bl: r,
					br: r
				} : {
					tl: r,
					tr: r
				} : {};
				const d = horizontal ? roundRectPath(Math.min(a, b), pos, Math.abs(b - a), th, corners) : roundRectPath(pos, Math.min(a, b), th, Math.abs(b - a), corners);
				const lo = m.fade(sg.k * stg + 320, 260);
				const projected = fk >= 0 && sg.k >= fk;
				const solo = layout === "grouped" || nS === 1;
				const outline2 = projected && solo;
				let label = null;
				if (showValues) {
					const text = valueText(sg);
					const tw = textWidth(text, 11, 700);
					const len = Math.abs(b - a);
					if (layout === "grouped" || nS === 1) label = horizontal ? /* @__PURE__ */ jsx(Txt, {
						x: Math.max(a, b) + 6,
						y: pos + th / 2,
						size: 11,
						weight: sg.hi ? 800 : 500,
						fill: p.paint(sg.hi ? "ink" : "muted"),
						opacity: lo,
						children: text
					}) : (nS === 1 ? !shownValues || shownValues.has(i) : th >= tw * .8) ? /* @__PURE__ */ jsx(Txt, {
						x: pos + th / 2,
						y: neg ? Math.max(a, b) + 8 : Math.min(a, b) - 8,
						anchor: "middle",
						size: th < 26 ? 10 : 11,
						weight: sg.hi ? 800 : 500,
						fill: p.paint(sg.hi ? "ink" : "muted"),
						opacity: lo,
						children: text
					}) : null;
					else if (len >= (horizontal ? tw + 10 : 16) && (horizontal ? th >= 14 : th >= tw + 6)) label = /* @__PURE__ */ jsx(Txt, {
						x: horizontal ? (a + b) / 2 : pos + th / 2,
						y: horizontal ? pos + th / 2 : (a + b) / 2,
						anchor: "middle",
						size: 11,
						weight: 700,
						fill: sg.sw.text,
						opacity: lo,
						children: text
					});
				}
				return /* @__PURE__ */ jsxs("g", {
					className: "ztd-mark",
					opacity: it.exiting ? .4 : activeCat === null || activeCat === sg.k ? 1 : .38,
					onPointerEnter: (e) => c.setActive(i, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(i),
					style: { cursor: props.onClick ? "pointer" : void 0 },
					children: [
						layout === "grouped" || nS === 1 ? horizontal ? /* @__PURE__ */ jsx("rect", {
							x: x0,
							y: pos,
							width: Math.max(0, x1 - x0),
							height: th,
							fill: "transparent"
						}) : /* @__PURE__ */ jsx("rect", {
							x: pos,
							y: top,
							width: th,
							height: Math.max(0, H - bottom - top),
							fill: "transparent"
						}) : null,
						/* @__PURE__ */ jsx("path", {
							d,
							fill: sg.sw.fill,
							fillOpacity: projected ? .42 : void 0,
							stroke: outline2 ? sg.sw.fill : solo ? "none" : p.paint("panel"),
							strokeWidth: outline2 ? 1.2 : 1,
							strokeDasharray: outline2 ? "3 2" : void 0
						}),
						c.active === i && c.via === "keyboard" ? /* @__PURE__ */ jsx("path", {
							d: horizontal ? roundRectPath(Math.min(a, b) - 2, pos - 2, Math.abs(b - a) + 4, th + 4, 4) : roundRectPath(pos - 2, Math.min(a, b) - 2, th + 4, Math.abs(b - a) + 4, 4),
							fill: "none",
							stroke: p.paint("ink"),
							strokeWidth: 2
						}) : null,
						label
					]
				}, it.key);
			}),
			/* @__PURE__ */ jsx(AnnotationsOver, {
				list: notes,
				g: ag
			}),
			horizontal ? /* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: model.keys.map((key, k) => {
					const strong = single && hi.has(k);
					return /* @__PURE__ */ jsx(Txt, {
						x: catW,
						y: band(key) + band.bandwidth / 2,
						anchor: "end",
						size: 11.5,
						weight: strong ? 800 : 500,
						fill: p.paint(strong ? "ink" : "muted"),
						children: truncate(model.labels[k], catW - 4, 11.5, strong ? 800 : 500)
					}, key);
				})
			}) : /* @__PURE__ */ jsx(AxisXBand, {
				p,
				labels: model.labels,
				centers: model.keys.map((key) => band(key) + band.bandwidth / 2),
				y: H - bottom + 13,
				strong: single ? hi : void 0
			}),
			!horizontal && activeCat !== null ? /* @__PURE__ */ jsx(AxisPill, {
				p,
				x: band(model.keys[activeCat]) + band.bandwidth / 2,
				y: H - bottom + 13,
				label: model.labels[activeCat],
				width: W
			}) : null
		]
	});
}
var MSG16 = {
	en: {
		radial: "Radial bar chart",
		gauge: "Gauge",
		vsTarget: "vs. target",
		current: "Current",
		target: "Target",
		targetWord: "target",
		achieved: "Achieved",
		range: "Range",
		rangeWord: "range",
		span: (a, b) => `${a} to ${b}`
	},
	ko: {
		radial: "방사형 막대",
		gauge: "게이지",
		vsTarget: "목표 대비",
		current: "현재",
		target: "목표",
		targetWord: "목표",
		achieved: "달성률",
		range: "범위",
		rangeWord: "범위",
		span: (a, b) => `${a}~${b}`
	}
};
function RadialBarChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(200, Math.min(270, w * .6)),
		duration: 1e3,
		stagger: 120,
		format: "percent"
	});
	const { p, width: W, height: H } = c;
	const msg = MSG16[c.lang];
	const max = props.max ?? 100;
	const sweepDeg = Math.max(30, Math.min(360, props.sweep ?? 270));
	const span2 = sweepDeg / 360 * TAU;
	const rings = useMemo(() => {
		const gl = strGetter(props.label, "label");
		const gv = numGetter(props.value, "value");
		const rows = props.data.map((d, i) => ({
			d,
			i,
			label: gl(d, i),
			value: gv(d, i) || 0
		}));
		const hi = resolveHighlight(props.highlight, rows.map((r) => r.d), rows.map((r) => r.label), rows.map((r) => r.value), "max");
		return rows.map((r) => ({
			i: r.i,
			label: r.label,
			value: r.value,
			frac: Math.max(0, Math.min(1, r.value / max)),
			hi: hi.has(r.i),
			datum: r.d
		}));
	}, [
		props.data,
		props.label,
		props.value,
		props.highlight,
		max
	]);
	const n = Math.max(1, rings.length);
	const R = Math.max(30, Math.min(H / 2 - 6, W / 2 - 8));
	const cx = W / 2 + (sweepDeg < 360 ? R * .18 : 0);
	const cy = H / 2;
	const inner = R * .26;
	const step = (R - inner) / n;
	const thick = Math.max(4, Math.min(18, step * .64));
	const radius = (k) => R - step * k - step / 2;
	const start = 0;
	const stg = c.motion.stagger ?? 120;
	const m = useMotion(useMemo(() => rings.map((r, k) => ({
		key: `r:${r.label}`,
		to: [r.frac],
		from: [0],
		enter: [0],
		delay: k * stg,
		data: r
	})), [rings, stg]), c.motion);
	const accent = swatch(p, "accent");
	const events = rings.map((r) => ({
		datum: r.datum,
		index: r.i,
		key: r.label,
		label: r.label,
		value: r.value,
		formatted: c.fv(r.value)
	}));
	let tip = null;
	if (c.active !== null && rings[c.active]) {
		const r = rings[c.active];
		const [tx, ty] = polar(cx, cy, radius(c.active), start + span2 * r.frac);
		tip = {
			x: tx,
			y: ty,
			title: r.label,
			rows: [{
				label: c.t.value,
				value: c.fv(r.value),
				color: r.hi ? accent.fill : p.paint("neutralStrong")
			}, {
				label: msg.vsTarget,
				value: c.pct(r.value / max * 100)
			}]
		};
	}
	const D = c.motion.duration ?? 1e3;
	const desc = props.description ?? `${msg.radial}. ${rings.map((r) => `${r.label} ${c.fv(r.value)}`).join(", ")}.`;
	const labelMax = Math.max(40, cx - 12);
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.radial,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			m.items.map((it) => {
				if (it.exiting) return null;
				const r = it.data;
				const rad = radius(r.i);
				const t = it.v[0];
				const isA = c.active === r.i;
				return /* @__PURE__ */ jsxs("g", {
					className: "ztd-mark",
					opacity: c.dim(r.i),
					onPointerEnter: (e) => c.setActive(r.i, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(r.i),
					children: [
						/* @__PURE__ */ jsx("path", {
							d: arcLine(cx, cy, rad, start, start + span2),
							fill: "none",
							stroke: p.paint("neutralSoft"),
							strokeWidth: thick,
							strokeLinecap: "round"
						}),
						t > .002 ? /* @__PURE__ */ jsx("path", {
							d: arcLine(cx, cy, rad, start, start + span2 * t),
							fill: "none",
							stroke: r.hi ? accent.fill : p.paint("neutralStrong"),
							strokeWidth: thick,
							strokeLinecap: "round"
						}) : null,
						isA && c.via === "keyboard" ? /* @__PURE__ */ jsx("path", {
							d: arcLine(cx, cy, rad, start, start + span2),
							fill: "none",
							stroke: p.paint("ink"),
							strokeWidth: 1.5,
							strokeDasharray: "2 3"
						}) : null
					]
				}, it.key);
			}),
			sweepDeg < 360 && c.showLabels ? rings.map((r, k) => {
				const rad = radius(k);
				const [lx, ly] = polar(cx, cy, rad, start);
				const fs = Math.max(9.5, Math.min(11.5, step * .62));
				const text = `${r.label} ${c.fv(r.value)}`;
				return /* @__PURE__ */ jsx(Txt, {
					x: lx - 8,
					y: ly,
					anchor: "end",
					size: fs,
					weight: r.hi ? 800 : 500,
					fill: p.paint(r.hi ? "ink" : "muted"),
					opacity: m.fade(k * stg + D * .3, 280),
					children: truncate(text, labelMax, fs, r.hi ? 800 : 500)
				}, k);
			}) : null,
			sweepDeg >= 360 && rings.length ? /* @__PURE__ */ jsx(Txt, {
				x: cx,
				y: cy,
				anchor: "middle",
				size: Math.min(22, inner * .6),
				weight: 800,
				fill: p.paint("ink"),
				opacity: m.fade(D * .4, 300),
				children: c.fv(rings.find((r) => r.hi)?.value ?? rings[0].value)
			}) : null
		]
	});
}
function TickArc(props) {
	const { cx, cy, r, len, start, span: span2, lit, on, off } = props;
	const n = Math.max(2, Math.round(props.count ?? Math.max(24, Math.min(64, (r - len / 2) * span2 / 8))));
	const lines = useMemo(() => {
		const gapPx = (r - len / 2) * span2 / (n - 1);
		const w = Math.max(1.6, Math.min(3.4, gapPx * .42));
		return Array.from({ length: n }, (_, i) => {
			const a = start + span2 * (i / (n - 1));
			const [x0, y0] = polar(cx, cy, r - len, a);
			const [x1, y1] = polar(cx, cy, r - 1, a);
			const line = (stroke) => /* @__PURE__ */ jsx("line", {
				x1: x0,
				y1: y0,
				x2: x1,
				y2: y1,
				stroke,
				strokeWidth: w,
				strokeLinecap: "round"
			}, i);
			return {
				on: line(on),
				off: line(off)
			};
		});
	}, [
		cx,
		cy,
		r,
		len,
		start,
		span2,
		n,
		on,
		off
	]);
	return /* @__PURE__ */ jsx("g", {
		"aria-hidden": "true",
		children: lines.map((l, i) => lit > .002 && i / (n - 1) <= lit + 1e-6 ? l.on : l.off)
	});
}
function GaugeChart(props) {
	const data = useMemo(() => props.data ?? [{
		value: props.value ?? 0,
		target: props.target
	}], [
		props.data,
		props.value,
		props.target
	]);
	const variant = props.variant ?? "arc";
	const c = useChart({
		...props,
		data
	}, {
		height: (w) => variant === "semi" ? Math.max(150, Math.min(210, w * .5)) : Math.max(180, Math.min(240, w * .6)),
		duration: 1100,
		format: "integer"
	});
	const { p, width: W, height: H } = c;
	const gv = numGetter(props.valueKey, "value");
	const gt = numGetter(props.targetKey, "target");
	const value = props.value ?? (data[0] ? gv(data[0], 0) : 0);
	const target = props.target ?? (data[0] ? gt(data[0], 0) : NaN);
	const min = props.min ?? 0;
	const max = props.max ?? 100;
	const frac = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
	const tfrac = Number.isFinite(target) ? Math.max(0, Math.min(1, (target - min) / (max - min || 1))) : NaN;
	const span2 = (variant === "ring" ? 360 : variant === "semi" ? 180 : 240) / 360 * TAU;
	const start = variant === "ring" ? 0 : -span2 / 2;
	const R = variant === "semi" ? Math.max(30, Math.min(H - 26, W / 2 - 10)) : Math.max(30, Math.min(H / 2 - 6, W / 2 - 10));
	const cx = W / 2;
	const cy = variant === "semi" ? H - 18 : variant === "ring" ? H / 2 : H / 2 + R * .12;
	const thick = Math.max(8, Math.min(variant === "ring" ? 16 : 20, R * .17));
	const m = useMotion(useMemo(() => [{
		key: "v",
		to: [frac, value],
		from: [0, min],
		enter: [0, min],
		data: null
	}], [
		frac,
		value,
		min
	]), c.motion);
	const cur = m.get("v") ?? [frac, value];
	const accent = swatch(p, "accent");
	const bands = props.bands?.filter((b) => b > min && b < max) ?? [];
	const msg = MSG16[c.lang];
	const name = props.label ?? c.t.value;
	const range = msg.span(c.fmt(min), c.fmt(max));
	const events = props.value === void 0 && !data.length ? [] : [{
		datum: data[0] ?? null,
		index: 0,
		key: "value",
		label: name,
		value,
		formatted: `${c.fv(value)}${Number.isFinite(target) ? ` / ${msg.targetWord} ${c.fv(target)}` : ""}`
	}];
	const tip = c.active === 0 ? {
		x: cx,
		y: cy - R,
		title: name,
		rows: [
			{
				label: msg.current,
				value: c.fv(value),
				color: accent.fill
			},
			...Number.isFinite(target) ? [{
				label: msg.target,
				value: c.fv(target)
			}, ...target ? [{
				label: msg.achieved,
				value: c.pct(value / target * 100)
			}] : []] : [],
			{
				label: msg.range,
				value: range
			}
		]
	} : null;
	const big = Math.max(18, Math.min(42, R * .42));
	const desc = props.description ?? `${msg.gauge}. ${name} ${c.fv(value)}, ${msg.rangeWord} ${range}${Number.isFinite(target) ? `, ${msg.targetWord} ${c.fv(target)}` : ""}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.gauge,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			/* @__PURE__ */ jsxs("g", {
				onPointerEnter: (e) => c.setActive(0, e.pointerType === "touch" ? "touch" : "pointer"),
				children: [variant === "ticks" ? /* @__PURE__ */ jsx(TickArc, {
					cx,
					cy,
					r: R,
					len: thick * 1.3,
					start,
					span: span2,
					count: props.ticks,
					lit: cur[0],
					on: accent.fill,
					off: p.paint("neutralSoft")
				}) : /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsx("path", {
						d: arcLine(cx, cy, R - thick / 2, start, start + span2),
						fill: "none",
						stroke: p.paint("neutralSoft"),
						strokeWidth: thick,
						strokeLinecap: variant === "ring" ? "butt" : "round"
					}),
					bands.map((b, k) => {
						const f = (b - min) / (max - min);
						const [x0, y0] = polar(cx, cy, R - thick - 3, start + span2 * f);
						const [x1, y1] = polar(cx, cy, R + 2, start + span2 * f);
						return /* @__PURE__ */ jsx("line", {
							x1: x0,
							y1: y0,
							x2: x1,
							y2: y1,
							stroke: p.paint("panel"),
							strokeWidth: 2
						}, k);
					}),
					cur[0] > .002 ? /* @__PURE__ */ jsx("path", {
						d: arcLine(cx, cy, R - thick / 2, start, start + span2 * cur[0]),
						fill: "none",
						stroke: accent.fill,
						strokeWidth: thick,
						strokeLinecap: "round"
					}) : null
				] }), Number.isFinite(tfrac) ? (() => {
					const [x0, y0] = polar(cx, cy, R - thick - 4, start + span2 * tfrac);
					const [x1, y1] = polar(cx, cy, R + 4, start + span2 * tfrac);
					return /* @__PURE__ */ jsx("line", {
						x1: x0,
						y1: y0,
						x2: x1,
						y2: y1,
						stroke: p.paint("ink"),
						strokeWidth: 2.5,
						strokeLinecap: "round",
						opacity: m.fade(500, 300)
					});
				})() : null]
			}),
			/* @__PURE__ */ jsx(Txt, {
				x: cx,
				y: variant === "semi" ? cy - big * .55 : cy - (props.label ? big * .18 : 0),
				anchor: "middle",
				size: big,
				weight: 800,
				fill: p.paint("ink"),
				letterSpacing: -1,
				children: c.fv(cur[1])
			}),
			props.label ? /* @__PURE__ */ jsx(Txt, {
				x: cx,
				y: variant === "semi" ? cy - 6 : cy + big * .5,
				anchor: "middle",
				size: 11.5,
				fill: p.paint("muted"),
				children: truncate(props.label, R * 1.5, 11.5)
			}) : null,
			variant !== "ring" ? /* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: (() => {
					const [x0, y0] = polar(cx, cy, R - thick / 2, start);
					const [x1, y1] = polar(cx, cy, R - thick / 2, start + span2);
					const off = variant === "semi" ? 12 : thick / 2 + 10;
					return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Txt, {
						x: x0,
						y: y0 + off,
						anchor: "middle",
						size: 10,
						fill: p.paint("muted"),
						children: c.fmt(min)
					}), /* @__PURE__ */ jsx(Txt, {
						x: x1,
						y: y1 + off,
						anchor: "middle",
						size: 10,
						fill: p.paint("muted"),
						children: c.fmt(max)
					})] });
				})()
			}) : null,
			Number.isFinite(target) && c.showLabels && variant !== "ring" ? (() => {
				const [x, y] = polar(cx, cy, R + 14, start + span2 * tfrac);
				const s = Math.sin(start + span2 * tfrac);
				return /* @__PURE__ */ jsx(Txt, {
					x,
					y,
					anchor: s > .2 ? "start" : s < -.2 ? "end" : "middle",
					size: 10.5,
					weight: 700,
					fill: p.paint("ink"),
					opacity: m.fade(600, 300),
					children: `${msg.target} ${c.fmt(target)}`
				});
			})() : null
		]
	});
}
var MSG17 = {
	en: {
		kind: "Bullet chart",
		actual: "Actual",
		target: "Target",
		targetWord: "target",
		achieved: "Achieved",
		withTarget: (t) => ` (target ${t})`
	},
	ko: {
		kind: "불릿 차트",
		actual: "실적",
		target: "목표",
		targetWord: "목표",
		achieved: "달성률",
		withTarget: (t) => `(목표 ${t})`
	}
};
function BulletChart(props) {
	const rowH = 40;
	const axisH = props.independent === false ? 16 : 0;
	const c = useChart(props, {
		height: () => Math.max(90, props.data.length * rowH + 8) + axisH,
		duration: 800,
		stagger: 110
	});
	const { p, width: W, height: H } = c;
	const rows = useMemo(() => {
		const gl = strGetter(props.label, "label");
		const gv = numGetter(props.value, "value");
		const gt = numGetter(props.target, "target");
		const rkeys = props.ranges ?? [];
		const base = props.data.map((d, i) => {
			const v = gv(d, i);
			const t = gt(d, i);
			const ranges = rkeys.map((k) => numGetter(k, k)(d, i)).filter(Number.isFinite);
			const max = niceDomain(0, Math.max(v || 0, t || 0, ...ranges), 4)[1];
			return {
				i,
				label: gl(d, i),
				value: v,
				target: t,
				ranges,
				max,
				hi: false,
				datum: d
			};
		});
		const ratios = base.map((r) => Number.isFinite(r.target) && r.target ? r.value / r.target : Infinity);
		const hi = resolveHighlight(props.highlight, base.map((r) => r.datum), base.map((r) => r.label), ratios, "min");
		return base.map((r) => ({
			...r,
			hi: hi.has(r.i)
		}));
	}, [
		props.data,
		props.label,
		props.value,
		props.target,
		props.ranges,
		props.highlight
	]);
	const globalMax = Math.max(...rows.map((r) => r.max), 1);
	const labelW = Math.min(W * .34, Math.max(...rows.map((r) => textWidth(r.label, 11.5, 600)), 30) + 10);
	const fx = (v) => Number.isFinite(v) ? c.fmt(v) : "-";
	const fvx = (v) => Number.isFinite(v) ? c.fv(v) : "-";
	const valW = Math.max(...rows.map((r) => textWidth(fx(r.value), 12, 800)), 20) + 12;
	const x0 = labelW + 6;
	const x1 = W - valW;
	const band = (H - 8 - axisH) / Math.max(1, rows.length);
	const barH = Math.max(6, Math.min(12, band * .26));
	const rangeH = Math.max(12, Math.min(26, band * .58));
	const stg = c.motion.stagger ?? 110;
	const m = useMotion(useMemo(() => rows.map((r, k) => {
		const sx = scaleLinear([0, props.independent === false ? globalMax : r.max], [x0, x1]);
		return {
			key: `b:${r.label}`,
			to: [
				sx(r.value || 0),
				Number.isFinite(r.target) ? sx(r.target) : x0,
				1
			],
			from: [
				x0,
				Number.isFinite(r.target) ? sx(r.target) : x0,
				0
			],
			enter: [
				x0,
				x0,
				0
			],
			delay: k * stg,
			data: r
		};
	}), [
		rows,
		x0,
		x1,
		globalMax,
		props.independent,
		stg
	]), c.motion);
	const accent = swatch(p, "accent");
	const shades = [
		p.paint("neutralSoft"),
		p.paint("neutral"),
		p.mix("neutral", "neutralStrong", .62)
	];
	const msg = MSG17[c.lang];
	const events = rows.map((r) => ({
		datum: r.datum,
		index: r.i,
		key: r.label,
		label: r.label,
		value: Number.isFinite(r.value) ? r.value : null,
		formatted: `${fvx(r.value)}${Number.isFinite(r.target) ? ` / ${msg.targetWord} ${c.fv(r.target)}${Number.isFinite(r.value) ? ` (${c.pct(r.value / (r.target || 1) * 100)})` : ""}` : ""}`
	}));
	let tip = null;
	if (c.active !== null && rows[c.active]) {
		const r = rows[c.active];
		tip = {
			x: scaleLinear([0, props.independent === false ? globalMax : r.max], [x0, x1])(r.value || 0),
			y: 4 + band * r.i + band / 2 - rangeH / 2,
			title: r.label,
			rows: [{
				label: msg.actual,
				value: fvx(r.value),
				color: r.hi ? accent.fill : p.paint("ink")
			}, ...Number.isFinite(r.target) ? [{
				label: msg.target,
				value: c.fv(r.target)
			}, {
				label: msg.achieved,
				value: c.pct(r.value / (r.target || 1) * 100)
			}] : []]
		};
	}
	const desc = props.description ?? `${msg.kind}. ${rows.map((r) => `${r.label} ${fvx(r.value)}${Number.isFinite(r.target) ? msg.withTarget(c.fv(r.target)) : ""}`).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [m.items.map((it) => {
			const r = it.data;
			if (it.exiting) return null;
			const k = r.i;
			const sx = scaleLinear([0, props.independent === false ? globalMax : r.max], [x0, x1]);
			const cy = 4 + band * k + band / 2;
			const [vx, tx, o] = it.v;
			const edges = [
				0,
				...r.ranges,
				r.max
			].filter((v, j, a) => j === 0 || v > a[j - 1]);
			const isA = c.active === r.i;
			return /* @__PURE__ */ jsxs("g", {
				className: "ztd-mark",
				opacity: c.dim(r.i),
				onPointerEnter: (e) => c.setActive(r.i, e.pointerType === "touch" ? "touch" : "pointer"),
				onClick: () => c.click(r.i),
				children: [
					/* @__PURE__ */ jsx("rect", {
						x: 0,
						y: cy - band / 2,
						width: W,
						height: band,
						fill: "transparent"
					}),
					edges.slice(0, -1).map((e0, j) => {
						const e1 = edges[j + 1];
						const shade = shades[Math.min(shades.length - 1, Math.round(j / Math.max(1, edges.length - 2) * (shades.length - 1)))];
						return /* @__PURE__ */ jsx("path", {
							d: roundRectPath(sx(e0), cy - rangeH / 2, sx(e1) - sx(e0), rangeH, {
								tl: j === 0 ? 3 : 0,
								bl: j === 0 ? 3 : 0,
								tr: j === edges.length - 2 ? 3 : 0,
								br: j === edges.length - 2 ? 3 : 0
							}),
							fill: shade,
							opacity: .35 + .65 * o
						}, j);
					}),
					/* @__PURE__ */ jsx("path", {
						d: roundRectPath(x0, cy - barH / 2, Math.max(0, vx - x0), barH, 2),
						fill: r.hi ? accent.fill : p.paint("ink")
					}),
					Number.isFinite(r.target) ? /* @__PURE__ */ jsx("line", {
						x1: tx,
						x2: tx,
						y1: cy - rangeH / 2 - 2,
						y2: cy + rangeH / 2 + 2,
						stroke: p.paint("ink"),
						strokeWidth: 2.5,
						strokeLinecap: "round",
						opacity: o
					}) : null,
					isA && c.via === "keyboard" ? /* @__PURE__ */ jsx("rect", {
						x: x0 - 3,
						y: cy - rangeH / 2 - 4,
						width: x1 - x0 + 6,
						height: rangeH + 8,
						rx: 5,
						fill: "none",
						stroke: p.paint("ink"),
						strokeWidth: 1.5
					}) : null,
					wrapLines(r.label, labelW - 4, 11.5, band >= 34 ? 2 : 1, 700).map((line, j, lines) => /* @__PURE__ */ jsx(Txt, {
						x: labelW,
						y: cy + (j - (lines.length - 1) / 2) * 13,
						anchor: "end",
						size: 11.5,
						weight: r.hi ? 800 : 600,
						fill: p.paint("ink"),
						children: line
					}, j)),
					/* @__PURE__ */ jsx(Txt, {
						x: W - 2,
						y: cy,
						anchor: "end",
						size: 12,
						weight: r.hi ? 800 : 600,
						fill: p.paint(r.hi ? "ink" : "muted"),
						opacity: m.fade(k * stg + 300, 260),
						children: fx(r.value)
					})
				]
			}, it.key);
		}), props.independent === false ? /* @__PURE__ */ jsx("g", {
			"aria-hidden": "true",
			children: scaleLinear([0, globalMax], [x0, x1]).ticks(4).map((t) => /* @__PURE__ */ jsx(Txt, {
				x: scaleLinear([0, globalMax], [x0, x1])(t),
				y: H - 9,
				anchor: "middle",
				size: AXIS_FONT,
				fill: p.paint("muted"),
				children: c.fmt(t)
			}, t))
		}) : null]
	});
}
var MSG19 = {
	en: {
		kind: "Slope chart",
		change: "Change",
		span: (a, b) => `${a} to ${b}`
	},
	ko: {
		kind: "슬로프 차트",
		change: "변화",
		span: (a, b) => `${a}~${b}`
	}
};
function SlopeChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(200, Math.min(300, w * .6)),
		duration: 900,
		stagger: 90
	});
	const { p, width: W, height: H } = c;
	const msg = MSG19[c.lang];
	const model = useMemo(() => {
		const gl = strGetter(props.label, "label");
		let items2;
		let periods;
		if (props.start && props.end) {
			const ga = numGetter(props.start, props.start);
			const gb = numGetter(props.end, props.end);
			items2 = props.data.map((d, i) => ({
				i,
				label: gl(d, i),
				a: ga(d, i),
				b: gb(d, i),
				hi: false,
				datum: d
			}));
			periods = props.periodLabels ?? [props.start, props.end];
		} else {
			const gx = strGetter(props.x, "x");
			const gv = numGetter(props.value, "value");
			const xs = uniq(props.data.map((d, i) => gx(d, i)));
			const first = xs[0];
			const last = xs[xs.length - 1];
			periods = props.periodLabels ?? [first ?? "", last ?? ""];
			const map = /* @__PURE__ */ new Map();
			props.data.forEach((d, i) => {
				const l = gl(d, i);
				const xv = gx(d, i);
				let it = map.get(l);
				if (!it) {
					it = {
						i: map.size,
						label: l,
						a: NaN,
						b: NaN,
						hi: false,
						datum: d
					};
					map.set(l, it);
				}
				if (xv === first) it.a = gv(d, i);
				if (xv === last) it.b = gv(d, i);
			});
			items2 = [...map.values()];
		}
		items2 = items2.filter((it) => Number.isFinite(it.a) && Number.isFinite(it.b));
		items2.forEach((it, k) => it.i = k);
		const hi = resolveHighlight(props.highlight, items2.map((it) => it.datum), items2.map((it) => it.label), items2.map((it) => it.b - it.a), "max");
		items2.forEach((it) => it.hi = hi.has(it.i));
		return {
			items: items2,
			periods
		};
	}, [
		props.data,
		props.label,
		props.x,
		props.value,
		props.start,
		props.end,
		props.periodLabels,
		props.highlight
	]);
	const items = model.items;
	const [mn, mx] = extent(items.flatMap((it) => [it.a, it.b]));
	const dom = fitDomain(mn, mx, 4, {
		zero: false,
		pad: .04
	});
	const lw = Math.min(W * .34, Math.max(...items.map((it) => textWidth(`${it.label} ${c.fv(it.a)}`, 11.5, 800)), 30) + 16);
	const rw = Math.min(W * .34, Math.max(...items.map((it) => textWidth(`${c.fv(it.b)} ${it.label}`, 11.5, 800)), 30) + 16);
	const xa = lw;
	const xb = W - rw;
	const top = 26;
	const bottom = 10;
	const y = scaleLinear(dom, [H - bottom, top]);
	const ysL = dodgeVertical(items.map((it) => y(it.a)), 15, top, H - bottom);
	const ysR = dodgeVertical(items.map((it) => y(it.b)), 15, top, H - bottom);
	const stg = c.motion.stagger ?? 90;
	const order = useMemo(() => [...items].sort((a, b) => Number(a.hi) - Number(b.hi)), [items]);
	const m = useMotion(useMemo(() => order.map((it, k) => ({
		key: `s:${it.label}`,
		to: [
			1,
			y(it.a),
			y(it.b)
		],
		from: [
			0,
			y(it.a),
			y(it.b)
		],
		enter: [
			0,
			y(it.a),
			y(it.b)
		],
		delay: k * stg,
		data: it
	})), [
		order,
		stg,
		H,
		dom[0],
		dom[1]
	]), c.motion);
	const accent = swatch(p, "accent");
	const events = items.map((it) => ({
		datum: it.datum,
		index: it.i,
		key: it.label,
		label: it.label,
		value: it.b,
		formatted: `${model.periods[0]} ${c.fv(it.a)} → ${model.periods[1]} ${c.fv(it.b)}`
	}));
	let tip = null;
	if (c.active !== null && items[c.active]) {
		const it = items[c.active];
		tip = {
			x: (xa + xb) / 2,
			y: (y(it.a) + y(it.b)) / 2,
			title: it.label,
			rows: [
				{
					label: model.periods[0],
					value: c.fv(it.a)
				},
				{
					label: model.periods[1],
					value: c.fv(it.b),
					color: it.hi ? accent.fill : p.paint("dim")
				},
				{
					label: msg.change,
					value: `${it.b - it.a >= 0 ? "+" : "−"}${c.fv(Math.abs(it.b - it.a))}`
				}
			]
		};
	}
	const D = c.motion.duration ?? 900;
	const desc = props.description ?? `${msg.kind}. ${msg.span(model.periods[0], model.periods[1])}: ${items.map((it) => `${it.label} ${c.fv(it.a)}→${c.fv(it.b)}`).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			/* @__PURE__ */ jsxs("g", {
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ jsx("line", {
						x1: xa,
						x2: xa,
						y1: 22,
						y2: H - bottom,
						stroke: p.paint("line")
					}),
					/* @__PURE__ */ jsx("line", {
						x1: xb,
						x2: xb,
						y1: 22,
						y2: H - bottom,
						stroke: p.paint("line")
					}),
					/* @__PURE__ */ jsx(Txt, {
						x: xa,
						y: 9,
						anchor: "middle",
						size: 11.5,
						weight: 800,
						fill: p.paint("muted"),
						children: model.periods[0]
					}),
					/* @__PURE__ */ jsx(Txt, {
						x: xb,
						y: 9,
						anchor: "middle",
						size: 11.5,
						weight: 800,
						fill: p.paint("muted"),
						children: model.periods[1]
					})
				]
			}),
			m.items.map((it) => {
				const s = it.data;
				const [draw, ya, yb] = it.v;
				const col = s.hi ? accent.fill : p.paint("dim");
				const dash = draw < .999;
				const isA = c.active === s.i;
				return /* @__PURE__ */ jsxs("g", {
					className: "ztd-mark",
					opacity: it.exiting ? .4 : c.dim(s.i),
					onPointerEnter: (e) => c.setActive(s.i, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(s.i),
					children: [
						/* @__PURE__ */ jsx("line", {
							x1: xa,
							y1: ya,
							x2: xb,
							y2: yb,
							stroke: "transparent",
							strokeWidth: 12
						}),
						/* @__PURE__ */ jsx("line", {
							x1: xa,
							y1: ya,
							x2: xb,
							y2: yb,
							stroke: isA && !s.hi ? p.paint("ink") : col,
							strokeWidth: s.hi ? 2.8 : 1.6,
							strokeLinecap: "round",
							pathLength: dash ? 1 : void 0,
							strokeDasharray: dash ? "1 1" : void 0,
							strokeDashoffset: dash ? 1 - draw : void 0
						}),
						/* @__PURE__ */ jsx("circle", {
							cx: xa,
							cy: ya,
							r: s.hi ? 4 : 3,
							fill: col
						}),
						/* @__PURE__ */ jsx("circle", {
							cx: xb,
							cy: yb,
							r: s.hi ? 4 : 3,
							fill: col,
							opacity: draw >= .98 ? 1 : 0
						})
					]
				}, it.key);
			}),
			c.showLabels ? items.map((it, k) => {
				const strong = it.hi || c.active === it.i;
				const fill = p.paint(strong ? "ink" : "muted");
				const o = m.fade(D * .5, 300) * c.dim(it.i);
				const wt = strong ? 800 : 500;
				const va = c.fv(it.a);
				const vb = c.fv(it.b);
				const name = (v, room) => truncateBeside(it.label, v, room, 11.5, wt);
				return /* @__PURE__ */ jsxs("g", {
					opacity: o,
					children: [/* @__PURE__ */ jsx(Txt, {
						x: xa - 9,
						y: ysL[k],
						anchor: "end",
						size: 11.5,
						weight: wt,
						fill,
						children: [name(va, lw - 10), va].filter(Boolean).join(" ")
					}), /* @__PURE__ */ jsx(Txt, {
						x: xb + 9,
						y: ysR[k],
						anchor: "start",
						size: 11.5,
						weight: wt,
						fill,
						children: [vb, name(vb, rw - 10)].filter(Boolean).join(" ")
					})]
				}, it.label);
			}) : null
		]
	});
}
var MSG20 = {
	en: {
		kind: "Dumbbell chart",
		/** 두 값의 기본 이름 */
		names: ["Before", "After"],
		diff: "Difference"
	},
	ko: {
		kind: "덤벨 차트",
		names: ["이전", "이후"],
		diff: "차이"
	}
};
function DumbbellChart(props) {
	const n0 = props.data.length;
	const c = useChart(props, {
		height: () => Math.max(150, Math.min(360, n0 * 30 + 44)),
		duration: 800,
		stagger: 70
	});
	const { p, width: W, height: H } = c;
	const msg = MSG20[c.lang];
	const names = props.labels ?? msg.names;
	const rows = useMemo(() => {
		const gl = strGetter(props.label, "label");
		const ga = numGetter(props.start, "start");
		const gb = numGetter(props.end, "end");
		let out = props.data.map((d, i) => ({
			i,
			label: gl(d, i),
			a: ga(d, i),
			b: gb(d, i),
			hi: false,
			datum: d
		})).filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
		if (props.sort !== false) out = [...out].sort((x2, y) => y.b - x2.b);
		out.forEach((r, k) => r.i = k);
		const hi = resolveHighlight(props.highlight, out.map((r) => r.datum), out.map((r) => r.label), out.map((r) => r.b - r.a), "max");
		return out.map((r) => ({
			...r,
			hi: hi.has(r.i)
		}));
	}, [
		props.data,
		props.label,
		props.start,
		props.end,
		props.sort,
		props.highlight
	]);
	const [mn, mx] = extent(rows.flatMap((r) => [r.a, r.b]));
	const dom = fitDomain(mn, mx, 4, {
		zero: props.zero ?? false,
		pad: .08
	});
	const labelW = Math.min(W * .3, Math.max(...rows.map((r) => textWidth(r.label, 11.5, 700)), 24) + 10);
	const top = 22;
	const bottom = 18;
	const valPad = Math.max(...rows.map((r) => textWidth(c.fmt(r.b), 11, 800)), 10) + 14;
	const x = scaleLinear(dom, [labelW + 10, W - valPad]);
	const band = (H - top - bottom) / Math.max(1, rows.length);
	const yOf = (k) => top + band * k + band / 2;
	const stg = c.motion.stagger ?? 70;
	const m = useMotion(useMemo(() => rows.map((r, k) => ({
		key: `d:${r.label}`,
		to: [
			x(r.a),
			x(r.b),
			1
		],
		from: [
			x(r.a),
			x(r.a),
			0
		],
		enter: [
			x(r.a),
			x(r.a),
			0
		],
		delay: k * stg,
		data: r
	})), [
		rows,
		W,
		dom[0],
		dom[1],
		stg
	]), c.motion);
	const accent = swatch(p, "accent");
	const events = rows.map((r) => ({
		datum: r.datum,
		index: r.i,
		key: r.label,
		label: r.label,
		value: r.b,
		formatted: `${names[0]} ${c.fv(r.a)} → ${names[1]} ${c.fv(r.b)}`
	}));
	let tip = null;
	if (c.active !== null && rows[c.active]) {
		const r = rows[c.active];
		tip = {
			x: x(Math.max(r.a, r.b)),
			y: yOf(c.active) - 6,
			title: r.label,
			rows: [
				{
					label: names[0],
					value: c.fv(r.a),
					color: p.paint("neutralStrong")
				},
				{
					label: names[1],
					value: c.fv(r.b),
					color: r.hi ? accent.fill : p.paint("ink")
				},
				{
					label: msg.diff,
					value: `${r.b - r.a >= 0 ? "+" : "−"}${c.fv(Math.abs(r.b - r.a))}`
				}
			]
		};
	}
	const ticks = x.ticks(Math.max(2, Math.round(W / 120)));
	const D = c.motion.duration ?? 800;
	const desc = props.description ?? `${msg.kind}. ${rows.map((r) => `${r.label} ${c.fv(r.a)}→${c.fv(r.b)}`).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [/* @__PURE__ */ jsxs("g", {
			"aria-hidden": "true",
			children: [
				ticks.map((t) => /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("line", {
					x1: x(t),
					x2: x(t),
					y1: 18,
					y2: H - bottom,
					stroke: p.paint("line")
				}), /* @__PURE__ */ jsx(Txt, {
					x: x(t),
					y: H - bottom + 10,
					anchor: "middle",
					size: AXIS_FONT,
					fill: p.paint("muted"),
					children: c.fmt(t)
				})] }, t)),
				/* @__PURE__ */ jsx("circle", {
					cx: labelW + 14,
					cy: 8,
					r: 4,
					fill: p.paint("neutralStrong")
				}),
				/* @__PURE__ */ jsx(Txt, {
					x: labelW + 22,
					y: 8,
					size: 10.5,
					fill: p.paint("muted"),
					children: names[0]
				}),
				/* @__PURE__ */ jsx("circle", {
					cx: labelW + 32 + textWidth(names[0], 10.5),
					cy: 8,
					r: 4.5,
					fill: p.paint("ink")
				}),
				/* @__PURE__ */ jsx(Txt, {
					x: labelW + 40 + textWidth(names[0], 10.5),
					y: 8,
					size: 10.5,
					fill: p.paint("muted"),
					children: names[1]
				})
			]
		}), m.items.map((it) => {
			const r = it.data;
			if (it.exiting) return null;
			const k = r.i;
			const [xa, xb, o] = it.v;
			const cy = yOf(k);
			const endCol = r.hi ? accent.fill : p.paint("ink");
			const right = xb >= xa;
			return /* @__PURE__ */ jsxs("g", {
				className: "ztd-mark",
				opacity: c.dim(k),
				onPointerEnter: (e) => c.setActive(r.i, e.pointerType === "touch" ? "touch" : "pointer"),
				onClick: () => c.click(r.i),
				children: [
					/* @__PURE__ */ jsx("rect", {
						x: 0,
						y: cy - band / 2,
						width: W,
						height: band,
						fill: "transparent"
					}),
					/* @__PURE__ */ jsx("line", {
						x1: xa,
						x2: xb,
						y1: cy,
						y2: cy,
						stroke: r.hi ? accent.fill : p.paint("neutral"),
						strokeOpacity: r.hi ? .55 : 1,
						strokeWidth: 4,
						strokeLinecap: "round"
					}),
					/* @__PURE__ */ jsx("circle", {
						cx: xa,
						cy,
						r: 4.5,
						fill: p.paint("neutralStrong"),
						opacity: Math.min(1, o * 2)
					}),
					/* @__PURE__ */ jsx("circle", {
						cx: xb,
						cy,
						r: 5.5,
						fill: endCol,
						stroke: c.active === r.i && c.via === "keyboard" ? p.paint("ink") : "none",
						strokeWidth: 2,
						opacity: o
					}),
					/* @__PURE__ */ jsx(Txt, {
						x: labelW,
						y: cy,
						anchor: "end",
						size: 11.5,
						weight: r.hi ? 800 : 600,
						fill: p.paint(r.hi ? "ink" : "muted"),
						children: truncate(r.label, labelW - 4, 11.5, 700)
					}),
					c.showLabels ? /* @__PURE__ */ jsx(Txt, {
						x: right ? xb + 10 : xb - 10,
						y: cy,
						anchor: right ? "start" : "end",
						size: 11,
						weight: r.hi ? 800 : 600,
						fill: p.paint(r.hi ? "ink" : "muted"),
						opacity: m.fade(k * stg + D * .4, 260),
						children: c.fmt(r.b)
					}) : null
				]
			}, it.key);
		})]
	});
}
function LollipopChart(props) {
	const vertical = props.orientation === "vertical";
	const n0 = props.data.length;
	const c = useChart(props, {
		height: (w) => vertical ? Math.max(200, Math.min(280, w * .52)) : Math.max(150, Math.min(380, n0 * 28 + 30)),
		duration: 800,
		stagger: 60
	});
	const { p, width: W, height: H } = c;
	const rows = useMemo(() => {
		const gl = strGetter(props.label, "label");
		const gv = numGetter(props.value, "value");
		let out = props.data.map((d, i) => ({
			i,
			label: gl(d, i),
			value: gv(d, i),
			hi: false,
			datum: d
		}));
		if (props.sort !== false) out = [...out].sort((a, b) => (b.value || 0) - (a.value || 0));
		out.forEach((r, k) => r.i = k);
		const hi = resolveHighlight(props.highlight, out.map((r) => r.datum), out.map((r) => r.label), out.map((r) => r.value), "max");
		return out.map((r) => ({
			...r,
			hi: hi.has(r.i)
		}));
	}, [
		props.data,
		props.label,
		props.value,
		props.sort,
		props.highlight
	]);
	const [mn, mx] = extent(rows.map((r) => r.value));
	const dom = fitDomain(mn, mx, 4);
	const tickFmt = makeTickFormatter(props.format, c.locale, Math.max(Math.abs(dom[0]), Math.abs(dom[1])));
	const accent = swatch(p, "accent");
	const stg = c.motion.stagger ?? 60;
	const labelW = vertical ? 0 : Math.min(W * .32, Math.max(...rows.map((r) => textWidth(r.label, 11.5, 700)), 24) + 10);
	const fx = (v2) => Number.isFinite(v2) ? c.fmt(v2) : "-";
	const fvx = (v2) => Number.isFinite(v2) ? c.fv(v2) : "-";
	const valPad = vertical ? 0 : Math.max(...rows.map((r) => textWidth(fx(r.value), 11, 800)), 10) + 16;
	const negPad = mn < 0 ? vertical ? 16 : Math.max(...rows.map((r) => r.value < 0 ? textWidth(fx(r.value), 11, 800) : 0)) + 16 : 0;
	const yTicks = scaleLinear(dom, [0, 1]).ticks(4);
	const left = vertical ? yAxisWidth(yTicks, tickFmt, c.locale) : labelW + 6;
	const top = vertical ? 16 : 4;
	const bottom = vertical ? 22 : 18;
	const keys = rows.map((_, k) => `${k}`);
	const band = vertical ? scaleBand(keys, [left + 4, W - 4], .4, .1) : scaleBand(keys, [top, H - bottom], .4, .1);
	const v = vertical ? scaleLinear(dom, [H - bottom - negPad, top]) : scaleLinear(dom, [left + negPad, W - valPad]);
	const base = v(Math.max(dom[0], 0));
	const m = useMotion(useMemo(() => rows.map((r, k) => ({
		key: `l:${r.label}`,
		to: [v(r.value || 0), 1],
		from: [base, 0],
		enter: [base, 0],
		delay: k * stg,
		data: r
	})), [
		rows,
		W,
		H,
		dom[0],
		dom[1],
		stg,
		vertical
	]), c.motion);
	const events = rows.map((r) => ({
		datum: r.datum,
		index: r.i,
		key: r.label,
		label: r.label,
		value: Number.isFinite(r.value) ? r.value : null,
		formatted: fvx(r.value)
	}));
	let tip = null;
	if (c.active !== null && rows[c.active]) {
		const r = rows[c.active];
		const pos = band(`${r.i}`) + band.bandwidth / 2;
		const e = v(r.value || 0);
		tip = vertical ? {
			x: pos,
			y: e - 6,
			title: r.label,
			rows: [{
				value: fvx(r.value),
				color: r.hi ? accent.fill : p.paint("ink")
			}]
		} : {
			x: e,
			y: pos - 6,
			title: r.label,
			rows: [{
				value: fvx(r.value),
				color: r.hi ? accent.fill : p.paint("ink")
			}]
		};
	}
	const D = c.motion.duration ?? 800;
	const kind = c.lang === "ko" ? "롤리팝 차트" : "Lollipop chart";
	const desc = props.description ?? `${kind}. ${rows.map((r) => `${r.label} ${fvx(r.value)}`).join(", ")}.`;
	const ticks = v.ticks(vertical ? 4 : Math.max(2, Math.round(W / 120)));
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			vertical ? /* @__PURE__ */ jsx(GridY, {
				p,
				ticks: yTicks,
				y: v,
				x0: left,
				x1: W,
				fmt: tickFmt,
				locale: c.locale
			}) : /* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: ticks.map((t) => /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("line", {
					x1: v(t),
					x2: v(t),
					y1: top,
					y2: H - bottom,
					stroke: p.paint(t === 0 ? "dim" : "line")
				}), /* @__PURE__ */ jsx(Txt, {
					x: v(t),
					y: H - bottom + 10,
					anchor: "middle",
					size: AXIS_FONT,
					fill: p.paint("muted"),
					children: tickFmt(t)
				})] }, t))
			}),
			m.items.map((it) => {
				const r = it.data;
				if (it.exiting) return null;
				const [end, o] = it.v;
				const pos = band(`${r.i}`) + band.bandwidth / 2;
				const col = r.hi ? accent.fill : p.paint("neutralStrong");
				const neg = r.value < 0;
				return /* @__PURE__ */ jsxs("g", {
					className: "ztd-mark",
					opacity: c.dim(r.i),
					onPointerEnter: (e) => c.setActive(r.i, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(r.i),
					children: [
						vertical ? /* @__PURE__ */ jsx("rect", {
							x: pos - band.step / 2,
							y: top,
							width: band.step,
							height: H - bottom - top,
							fill: "transparent"
						}) : /* @__PURE__ */ jsx("rect", {
							x: 0,
							y: pos - band.step / 2,
							width: W,
							height: band.step,
							fill: "transparent"
						}),
						vertical ? /* @__PURE__ */ jsx("line", {
							x1: pos,
							x2: pos,
							y1: base,
							y2: end,
							stroke: r.hi ? accent.fill : p.paint("neutral"),
							strokeWidth: 2.2
						}) : /* @__PURE__ */ jsx("line", {
							x1: base,
							x2: end,
							y1: pos,
							y2: pos,
							stroke: r.hi ? accent.fill : p.paint("neutral"),
							strokeWidth: 2.2
						}),
						/* @__PURE__ */ jsx("circle", {
							cx: vertical ? pos : end,
							cy: vertical ? end : pos,
							r: r.hi ? 6.5 : 5.5,
							fill: col,
							stroke: c.active === r.i && c.via === "keyboard" ? p.paint("ink") : p.paint("panel"),
							strokeWidth: 2,
							opacity: Math.min(1, o * 1.5)
						}),
						!vertical ? /* @__PURE__ */ jsx(Txt, {
							x: labelW,
							y: pos,
							anchor: "end",
							size: 11.5,
							weight: r.hi ? 800 : 600,
							fill: p.paint(r.hi ? "ink" : "muted"),
							children: truncate(r.label, labelW - 4, 11.5, 700)
						}) : null,
						c.showLabels ? vertical ? /* @__PURE__ */ jsx(Txt, {
							x: pos,
							y: neg ? end + 14 : end - 14,
							anchor: "middle",
							size: 10.5,
							weight: r.hi ? 800 : 600,
							fill: p.paint(r.hi ? "ink" : "muted"),
							opacity: m.fade(r.i * stg + D * .45, 260),
							children: fx(r.value)
						}) : /* @__PURE__ */ jsx(Txt, {
							x: neg ? end - 12 : end + 12,
							y: pos,
							anchor: neg ? "end" : "start",
							size: 11,
							weight: r.hi ? 800 : 600,
							fill: p.paint(r.hi ? "ink" : "muted"),
							opacity: m.fade(r.i * stg + D * .45, 260),
							children: fx(r.value)
						}) : null
					]
				}, it.key);
			}),
			vertical ? /* @__PURE__ */ jsx(AxisXBand, {
				p,
				labels: rows.map((r) => r.label),
				centers: rows.map((r) => band(`${r.i}`) + band.bandwidth / 2),
				y: H - bottom + 13,
				strong: new Set(rows.filter((r) => r.hi).map((r) => r.i))
			}) : null
		]
	});
}
var MSG21 = {
	en: {
		kind: "Beeswarm",
		group: "Group",
		med: "Median",
		/** 이름 없는 점 */
		nth: (i) => `#${i}`,
		median: (g, v) => `${g} median ${v}`,
		desc: (n, groups2, medians) => `${plural(n, "point")}${medians ? `, ${plural(groups2, "group")} (${medians})` : ""}`
	},
	ko: {
		kind: "비스웜",
		group: "그룹",
		med: "중앙값",
		nth: (i) => `${i}번`,
		median: (g, v) => `${g} 중앙값 ${v}`,
		desc: (n, groups2, medians) => `점 ${n}개${medians ? `, 그룹 ${groups2}개(${medians})` : ""}`
	}
};
function BeeswarmChart(props) {
	const groups0 = useMemo(() => {
		if (!props.group) return [""];
		const gg = strGetter(props.group, "group");
		const gv = numGetter(props.value, "value");
		return uniq(props.data.flatMap((d, i) => Number.isFinite(gv(d, i)) ? [gg(d, i)] : []));
	}, [
		props.data,
		props.group,
		props.value
	]);
	const c = useChart(props, {
		height: () => Math.max(160, Math.min(380, groups0.length * 78 + 30)),
		duration: 900
	});
	const { p, width: W, height: H } = c;
	const base = useMemo(() => {
		const gv = numGetter(props.value, "value");
		const gg = props.group ? strGetter(props.group, "group") : () => "";
		const gl = strGetter(props.label, "label");
		return props.data.map((d, i) => ({
			d,
			i,
			v: gv(d, i),
			g: gg(d, i),
			label: gl(d, i)
		})).filter((r3) => Number.isFinite(r3.v));
	}, [
		props.data,
		props.value,
		props.group,
		props.label
	]);
	const groups2 = groups0;
	const n = base.length;
	const useCanvas = c.hydrated && n > (props.canvasThreshold ?? 2e3);
	const byGroup = useMemo(() => {
		const at = new Map(groups2.map((g, gi) => [g, gi]));
		const out = groups2.map(() => []);
		base.forEach((b, k) => out[at.get(b.g) ?? 0].push(k));
		return out;
	}, [groups2, base]);
	const [mn, mx] = useMemo(() => extent(base.map((r3) => r3.v)), [base]);
	const dom = fitDomain(mn, mx, 4, {
		zero: false,
		pad: .04
	});
	const labelW = props.group ? Math.min(W * .26, Math.max(...groups2.map((g) => textWidth(g, 11.5, 700)), 20) + 10) : 0;
	const bottom = 20;
	const top = 6;
	const x = scaleLinear(dom, [labelW + 10, W - 10]);
	const band = (H - top - bottom) / Math.max(1, groups2.length);
	const perGroup = n / Math.max(1, groups2.length);
	const r = props.radius ?? Math.max(1.4, Math.min(5.5, Math.sqrt((W - labelW) * band * .5 / Math.max(1, perGroup)) / 2.4));
	const medians = useMemo(() => byGroup.map((ks) => quantileSorted(Float64Array.from(ks, (k) => base[k].v).sort(), .5)), [byGroup, base]);
	const hiGroup = useMemo(() => props.group ? resolveHighlight(props.highlight, groups2, groups2, medians, "max") : /* @__PURE__ */ new Set(), [
		props.group,
		props.highlight,
		groups2,
		medians
	]);
	const hiPoint = useMemo(() => !props.group ? resolveHighlight(props.highlight, base.map((b) => b.d), base.map((b) => b.label), base.map((b) => b.v), "max") : /* @__PURE__ */ new Set(), [
		props.group,
		props.highlight,
		base
	]);
	const pending = c.pending;
	const bees = useMemo(() => {
		if (pending) return [];
		const out = new Array(n);
		const strip = props.group && props.showMedian !== false ? 7 : 0;
		byGroup.forEach((ks, gi) => {
			const xs = ks.map((k) => x(base[k].v));
			const ys = beeswarm(xs, r, { maxSpread: Math.max(r, (band - strip) / 2 - r - 1) });
			ks.forEach((k, j) => {
				const b = base[k];
				out[k] = {
					i: k,
					g: gi,
					x: xs[j],
					y: top + band * gi + strip + (band - strip) / 2 + ys[j],
					value: b.v,
					label: b.label,
					hi: props.group ? hiGroup.has(gi) : hiPoint.has(k),
					datum: b.d
				};
			});
		});
		return out;
	}, [
		pending,
		base,
		byGroup,
		W,
		H,
		r,
		band,
		hiGroup,
		hiPoint,
		dom[0],
		dom[1]
	]);
	const D = c.motion.duration ?? 900;
	const m = useMotion(useMemo(() => {
		if (useCanvas) return [{
			key: "__p",
			to: [1],
			from: [0],
			data: null
		}];
		return bees.map((b) => ({
			key: `b${b.i}`,
			to: [
				b.x,
				b.y,
				r
			],
			from: [
				b.x,
				top + band * b.g + band / 2,
				0
			],
			enter: [
				b.x,
				b.y,
				0
			],
			delay: (b.x - labelW) / Math.max(1, W - labelW) * D * .6,
			data: b
		}));
	}, [
		bees,
		useCanvas,
		r,
		band,
		W,
		labelW,
		D
	]), c.motion);
	const accent = swatch(p, "accent");
	const fv = c.fv;
	const msg = MSG21[c.lang];
	const nth = msg.nth;
	const events = useMemo(() => lazyArray(bees.length, (k) => {
		const b = bees[k];
		return {
			datum: b.datum,
			index: b.i,
			key: `${b.i}`,
			label: b.label || `${groups2[b.g] ? `${groups2[b.g]} ` : ""}${nth(b.i + 1)}`,
			series: groups2[b.g] || void 0,
			value: b.value,
			formatted: fv(b.value)
		};
	}), [
		bees,
		groups2,
		fv,
		nth
	]);
	const nearest = (px, py) => {
		let best = -1;
		let bd = Infinity;
		for (let k = 0; k < bees.length; k++) {
			const b = bees[k];
			const d = (b.x - px) ** 2 + (b.y - py) ** 2;
			if (d < bd) {
				bd = d;
				best = k;
			}
		}
		return Math.sqrt(bd) <= r + 8 ? best : null;
	};
	let tip = null;
	if (c.active !== null && bees[c.active]) {
		const b = bees[c.active];
		tip = {
			x: b.x,
			y: b.y - r,
			title: b.label || nth(b.i + 1),
			rows: [...groups2[b.g] ? [{
				label: msg.group,
				value: groups2[b.g]
			}] : [], {
				label: c.t.value,
				value: c.fv(b.value),
				color: b.hi ? accent.fill : p.paint("neutralStrong")
			}]
		};
	}
	const prog = useCanvas ? m.get("__p")?.[0] ?? 1 : 1;
	const draw = useCallback((ctx, t, color) => {
		const neu = color("--ztd-neutral-strong", p.theme.neutralStrong);
		const acc = color("--ztd-accent", p.theme.accent);
		for (const b of bees) {
			const k = Math.max(0, Math.min(1, (t * 1.5 - (b.x - labelW) / Math.max(1, W - labelW) * .5) * 2));
			if (k <= 0) continue;
			ctx.fillStyle = b.hi ? acc : neu;
			ctx.globalAlpha = b.hi ? .95 : .7;
			ctx.beginPath();
			ctx.arc(b.x, b.y, r * k, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}, [
		bees,
		r,
		W,
		labelW,
		p.theme.neutralStrong,
		p.theme.accent
	]);
	const ticks = x.ticks(Math.max(2, Math.round(W / 110)));
	const desc = props.description ?? `${msg.kind}. ${msg.desc(n, groups2.length, props.group ? groups2.map((g, gi) => msg.median(g, c.fv(medians[gi]))).join(", ") : "")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, py, e) => {
			const k = nearest(px, py);
			if (k !== c.active) c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer");
		},
		underlay: useCanvas ? /* @__PURE__ */ jsx(CanvasLayer, {
			width: W,
			height: H,
			draw,
			progress: prog,
			version: c.sig
		}) : void 0,
		children: [
			/* @__PURE__ */ jsxs("g", {
				"aria-hidden": "true",
				children: [ticks.map((t) => /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("line", {
					x1: x(t),
					x2: x(t),
					y1: top,
					y2: H - bottom,
					stroke: p.paint("line")
				}), /* @__PURE__ */ jsx(Txt, {
					x: x(t),
					y: H - bottom + 11,
					anchor: "middle",
					size: AXIS_FONT,
					fill: p.paint("muted"),
					children: c.fmt(t)
				})] }, t)), props.group ? groups2.map((g, gi) => /* @__PURE__ */ jsxs("g", { children: [gi > 0 ? /* @__PURE__ */ jsx("line", {
					x1: labelW,
					x2: W,
					y1: top + band * gi,
					y2: top + band * gi,
					stroke: p.paint("line"),
					strokeDasharray: "2 3"
				}) : null, /* @__PURE__ */ jsx(Txt, {
					x: labelW,
					y: top + band * gi + band / 2,
					anchor: "end",
					size: 11.5,
					weight: hiGroup.has(gi) ? 800 : 600,
					fill: p.paint(hiGroup.has(gi) ? "ink" : "muted"),
					children: truncate(g, labelW - 4, 11.5, 700)
				})] }, g)) : null]
			}),
			!useCanvas ? m.items.map((it) => {
				const b = it.data;
				if (!b) return null;
				const [cx, cy, rr] = it.v;
				const isA = c.active === b.i;
				return /* @__PURE__ */ jsx("circle", {
					cx,
					cy,
					r: Math.max(0, rr),
					fill: b.hi ? accent.fill : p.paint("neutralStrong"),
					fillOpacity: b.hi ? .95 : .72,
					stroke: isA ? p.paint("ink") : "none",
					strokeWidth: 1.6,
					onPointerEnter: (e) => c.setActive(b.i, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(b.i)
				}, it.key);
			}) : c.active !== null && bees[c.active] ? /* @__PURE__ */ jsx("circle", {
				cx: bees[c.active].x,
				cy: bees[c.active].y,
				r: r + 2,
				fill: "none",
				stroke: p.paint("ink"),
				strokeWidth: 1.6,
				pointerEvents: "none"
			}) : null,
			props.showMedian !== false && props.group ? groups2.map((g, gi) => {
				const mx0 = x(medians[gi]);
				const y0 = top + band * gi + 2;
				const text = `${msg.med} ${c.fv(medians[gi])}`;
				const tw = textWidth(text, 10, 700) + 10;
				return /* @__PURE__ */ jsxs("g", {
					opacity: m.fade(D * .7, 300),
					pointerEvents: "none",
					children: [
						/* @__PURE__ */ jsx("line", {
							x1: mx0,
							x2: mx0,
							y1: y0 + 10,
							y2: y0 + band - 6,
							stroke: p.paint("ink"),
							strokeWidth: 1.6,
							strokeDasharray: "3 2"
						}),
						/* @__PURE__ */ jsx("rect", {
							x: mx0 - tw / 2,
							y: y0 - 3,
							width: tw,
							height: 14,
							rx: 5,
							fill: p.paint("panel"),
							opacity: .92
						}),
						/* @__PURE__ */ jsx(Txt, {
							x: mx0,
							y: y0 + 4,
							anchor: "middle",
							size: 10,
							weight: 700,
							fill: p.paint("ink"),
							children: text
						})
					]
				}, g);
			}) : null
		]
	});
}
var MSG22 = {
	en: {
		kind: "Ridgeline",
		med: "Median",
		n: "Sample size",
		count: (n) => `${n}`,
		summary: (median, n) => `median ${median} (${plural(n, "value")})`,
		median: (name, v) => `${name} median ${v}`,
		groups: (n) => plural(n, "group")
	},
	ko: {
		kind: "릿지라인",
		med: "중앙값",
		n: "표본",
		count: (n) => `${n}개`,
		summary: (median, n) => `중앙값 ${median}(${n}개)`,
		median: (name, v) => `${name} 중앙값 ${v}`,
		groups: (n) => `그룹 ${n}개`
	}
};
var SAMPLES = 72;
function RidgelineChart(props) {
	const groups0 = useMemo(() => uniq(props.data.map((d, i) => strGetter(props.group, "group")(d, i))), [props.data, props.group]);
	const c = useChart(props, {
		height: () => Math.max(180, Math.min(380, groups0.length * 36 + 60)),
		duration: 900,
		stagger: 90
	});
	const { p, width: W, height: H } = c;
	const msg = MSG22[c.lang];
	const model = useMemo(() => {
		const gg = strGetter(props.group, "group");
		const gv = numGetter(props.value, "value");
		const by = /* @__PURE__ */ new Map();
		props.data.forEach((d, i) => {
			const v = gv(d, i);
			if (!Number.isFinite(v)) return;
			const g = gg(d, i);
			const arr = by.get(g);
			if (arr) arr.push(v);
			else by.set(g, [v]);
		});
		let names = groups0.filter((g) => by.has(g));
		const [mn, mx] = extent([...by.values()].flat());
		const dom = fitDomain(mn, mx, 4, {
			zero: false,
			pad: .06
		});
		const xsv = Array.from({ length: SAMPLES }, (_, k) => dom[0] + (dom[1] - dom[0]) * k / (SAMPLES - 1));
		const medians = new Map(names.map((g) => [g, quantileSorted([...by.get(g)].sort((a, b) => a - b), .5)]));
		if (props.sort === "median") names = [...names].sort((a, b) => medians.get(a) - medians.get(b));
		const ridges = names.map((g, k) => ({
			g: k,
			name: g,
			dens: kde(by.get(g), xsv, props.bandwidth),
			median: medians.get(g),
			n: by.get(g).length,
			hi: false,
			datum: null
		}));
		const hi = resolveHighlight(props.highlight, names, names, ridges.map((r) => r.median), "max");
		ridges.forEach((r) => r.hi = hi.has(r.g));
		return {
			ridges,
			dom,
			xsv,
			peak: Math.max(...ridges.flatMap((r) => r.dens), 1e-9)
		};
	}, [
		props.data,
		props.group,
		props.value,
		props.bandwidth,
		props.sort,
		props.highlight,
		groups0
	]);
	const labelW = Math.min(W * .26, Math.max(...model.ridges.map((r) => textWidth(r.name, 11.5, 700)), 20) + 10);
	const bottom = 20;
	const top = 8;
	const nG = Math.max(1, model.ridges.length);
	const overlap = Math.max(1e-6, props.overlap ?? 1.5);
	const step = (H - top - bottom) / (nG - 1 + overlap);
	const amp = step * overlap;
	const x = scaleLinear(model.dom, [labelW + 8, W - 8]);
	const baseY = (k) => top + amp + step * k;
	const stg = c.motion.stagger ?? 90;
	const m = useMotion(useMemo(() => model.ridges.map((r, k) => ({
		key: `r:${r.name}`,
		to: r.dens.map((d) => d / model.peak * amp),
		from: r.dens.map(() => 0),
		enter: r.dens.map(() => 0),
		delay: k * stg,
		data: r
	})), [
		model,
		amp,
		stg
	]), c.motion);
	const accent = swatch(p, "accent");
	const events = model.ridges.map((r) => ({
		datum: null,
		index: r.g,
		key: r.name,
		label: r.name,
		value: r.median,
		formatted: msg.summary(c.fv(r.median), r.n)
	}));
	let tip = null;
	if (c.active !== null && model.ridges[c.active]) {
		const r = model.ridges[c.active];
		tip = {
			x: x(r.median),
			y: baseY(r.g) - amp * .6,
			title: r.name,
			rows: [{
				label: msg.med,
				value: c.fv(r.median),
				color: r.hi ? accent.fill : p.paint("neutralStrong")
			}, {
				label: msg.n,
				value: msg.count(r.n)
			}]
		};
	}
	const ticks = x.ticks(Math.max(2, Math.round(W / 110)));
	const D = c.motion.duration ?? 900;
	const desc = props.description ?? `${msg.kind}. ${msg.groups(nG)}: ${model.ridges.map((r) => msg.median(r.name, c.fv(r.median))).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, py, e) => {
			const j = nearestIndex(model.xsv, x.invert(px));
			let k = -1;
			for (let g = model.ridges.length - 1; g >= 0; g--) {
				const b = baseY(g);
				const h = (model.ridges[g].dens[j] ?? 0) / model.peak * amp;
				if (py <= b + 1 && py >= b - h - 1) {
					k = g;
					break;
				}
			}
			if (k < 0) k = Math.max(0, Math.min(nG - 1, Math.ceil((py - top - amp) / step)));
			if (k !== c.active) c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer");
		},
		children: [
			/* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: ticks.map((t) => /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("line", {
					x1: x(t),
					x2: x(t),
					y1: top,
					y2: H - bottom,
					stroke: p.paint("line")
				}), /* @__PURE__ */ jsx(Txt, {
					x: x(t),
					y: H - bottom + 11,
					anchor: "middle",
					size: AXIS_FONT,
					fill: p.paint("muted"),
					children: c.fmt(t)
				})] }, t))
			}),
			m.items.map((it) => {
				const r = it.data;
				const b = baseY(r.g);
				const pts2 = it.v.map((h, k) => `${x(model.xsv[k]).toFixed(2)},${(b - h).toFixed(2)}`);
				const d = `M${x(model.xsv[0]).toFixed(2)},${b}L${pts2.join("L")}L${x(model.xsv[SAMPLES - 1]).toFixed(2)},${b}Z`;
				const line = `M${pts2.join("L")}`;
				const isA = c.active === r.g;
				return /* @__PURE__ */ jsxs("g", {
					className: "ztd-mark",
					opacity: it.exiting ? .4 : c.dim(r.g),
					children: [
						/* @__PURE__ */ jsx("path", {
							d,
							fill: r.hi ? accent.fill : p.paint("neutral"),
							fillOpacity: r.hi ? .88 : .92
						}),
						/* @__PURE__ */ jsx("path", {
							d: line,
							fill: "none",
							stroke: r.hi ? accent.fill : isA ? p.paint("ink") : p.paint("neutralStrong"),
							strokeWidth: r.hi || isA ? 1.8 : 1.2,
							strokeLinejoin: "round"
						}),
						/* @__PURE__ */ jsx("line", {
							x1: labelW + 8,
							x2: W - 8,
							y1: b,
							y2: b,
							stroke: p.paint("line2")
						})
					]
				}, it.key);
			}),
			model.ridges.map((r) => /* @__PURE__ */ jsxs("g", {
				pointerEvents: "none",
				children: [/* @__PURE__ */ jsx(Txt, {
					x: labelW,
					y: baseY(r.g) - 6,
					anchor: "end",
					size: 11.5,
					weight: r.hi ? 800 : 600,
					fill: p.paint(r.hi ? "ink" : "muted"),
					children: truncate(r.name, labelW - 4, 11.5, 700)
				}), /* @__PURE__ */ jsx("line", {
					x1: x(r.median),
					x2: x(r.median),
					y1: baseY(r.g) - 5,
					y2: baseY(r.g),
					stroke: p.paint(r.hi ? "onAccent" : "ink"),
					strokeWidth: 1.6,
					opacity: m.fade(r.g * stg + D * .6, 260)
				})]
			}, r.name))
		]
	});
}
function sankeyLayout(nodesIn, linksIn, opt) {
	const { width, height, nodeWidth = 10, iterations = 24, align = "justify", x0 = 0, y0 = 0 } = opt;
	const byId = /* @__PURE__ */ new Map();
	const nodes = [];
	const ensure = (id, label) => {
		let n = byId.get(id);
		if (!n) {
			n = {
				id,
				label: label ?? id,
				index: nodes.length,
				depth: 0,
				layer: 0,
				value: 0,
				x0: 0,
				x1: 0,
				y0: 0,
				y1: 0,
				inLinks: [],
				outLinks: []
			};
			byId.set(id, n);
			nodes.push(n);
		} else if (label) n.label = label;
		return n;
	};
	nodesIn.forEach((n) => ensure(n.id, n.label));
	const links = [];
	linksIn.forEach((l) => {
		if (!(l.value > 0) || l.source === l.target) return;
		const s = ensure(l.source);
		const t = ensure(l.target);
		const link = {
			index: links.length,
			source: s,
			target: t,
			value: l.value,
			width: 0,
			y0: 0,
			y1: 0
		};
		links.push(link);
		s.outLinks.push(link);
		t.inLinks.push(link);
	});
	for (const n of nodes) n.value = Math.max(n.inLinks.reduce((a, l) => a + l.value, 0), n.outLinks.reduce((a, l) => a + l.value, 0));
	let frontier = nodes.filter((n) => !n.inLinks.length);
	if (!frontier.length) frontier = nodes.slice(0, 1);
	const state = /* @__PURE__ */ new Map();
	const back = /* @__PURE__ */ new Set();
	const visit = (n) => {
		state.set(n, 1);
		for (const l of n.outLinks) {
			const s = state.get(l.target);
			if (s === 1) back.add(l);
			else if (!s) visit(l.target);
		}
		state.set(n, 2);
	};
	[...frontier, ...nodes].forEach((n) => state.has(n) || visit(n));
	const depthOf = /* @__PURE__ */ new Map();
	frontier.forEach((n) => depthOf.set(n, 0));
	let changed = true;
	let guard = 0;
	while (changed && guard++ < nodes.length + 1) {
		changed = false;
		for (const l of links) {
			if (back.has(l)) continue;
			const d = (depthOf.get(l.source) ?? 0) + 1;
			if (d > (depthOf.get(l.target) ?? -1) && d <= nodes.length) {
				depthOf.set(l.target, d);
				changed = true;
			}
		}
	}
	for (const n of nodes) n.depth = depthOf.get(n) ?? 0;
	const maxDepth = Math.max(0, ...nodes.map((n) => n.depth));
	for (const n of nodes) n.layer = align === "justify" && !n.outLinks.length ? maxDepth : n.depth;
	const nLayers = maxDepth + 1;
	const kx = nLayers > 1 ? (width - nodeWidth) / (nLayers - 1) : 0;
	for (const n of nodes) {
		n.x0 = x0 + n.layer * kx;
		n.x1 = n.x0 + nodeWidth;
	}
	const columns = Array.from({ length: nLayers }, () => []);
	nodes.forEach((n) => columns[n.layer].push(n));
	const maxCount = Math.max(1, ...columns.map((c) => c.length));
	const py = Math.min(opt.nodePadding ?? 12, height / maxCount * .6);
	const ky = Math.min(...columns.filter((c) => c.length).map((c) => (height - (c.length - 1) * py) / Math.max(1e-9, c.reduce((a, n) => a + n.value, 0))));
	for (const col of columns) {
		let y = y0;
		for (const n of col) {
			n.y0 = y;
			n.y1 = y + n.value * ky;
			y = n.y1 + py;
		}
	}
	for (const l of links) l.width = l.value * ky;
	const center = (n) => (n.y0 + n.y1) / 2;
	const resolve = (col) => {
		col.sort((a, b) => a.y0 - b.y0);
		let y = y0;
		for (const n of col) {
			const dy = y - n.y0;
			if (dy > 0) {
				n.y0 += dy;
				n.y1 += dy;
			}
			y = n.y1 + py;
		}
		if (y - py - (y0 + height) > 0) {
			let yy = y0 + height;
			for (let i = col.length - 1; i >= 0; i--) {
				const n = col[i];
				const dy = n.y1 - yy;
				if (dy > 0) {
					n.y0 -= dy;
					n.y1 -= dy;
				}
				yy = n.y0 - py;
			}
		}
	};
	let alpha = 1;
	for (let it = 0; it < iterations; it++) {
		alpha *= .99;
		const a = Math.pow(.99, it);
		for (let c = columns.length - 2; c >= 0; c--) {
			for (const n of columns[c]) {
				if (!n.outLinks.length) continue;
				let w = 0;
				let s = 0;
				for (const l of n.outLinks) {
					s += center(l.target) * l.value;
					w += l.value;
				}
				const dy = (s / w - center(n)) * a;
				n.y0 += dy;
				n.y1 += dy;
			}
			resolve(columns[c]);
		}
		for (let c = 1; c < columns.length; c++) {
			for (const n of columns[c]) {
				if (!n.inLinks.length) continue;
				let w = 0;
				let s = 0;
				for (const l of n.inLinks) {
					s += center(l.source) * l.value;
					w += l.value;
				}
				const dy = (s / w - center(n)) * a;
				n.y0 += dy;
				n.y1 += dy;
			}
			resolve(columns[c]);
		}
	}
	for (const n of nodes) {
		n.outLinks.sort((a, b) => a.target.y0 - b.target.y0);
		n.inLinks.sort((a, b) => a.source.y0 - b.source.y0);
		const outTotal = n.outLinks.reduce((a, l) => a + l.width, 0);
		const inTotal = n.inLinks.reduce((a, l) => a + l.width, 0);
		let y = n.y0 + Math.max(0, (n.y1 - n.y0 - outTotal) / 2);
		for (const l of n.outLinks) {
			l.y0 = y + l.width / 2;
			y += l.width;
		}
		y = n.y0 + Math.max(0, (n.y1 - n.y0 - inTotal) / 2);
		for (const l of n.inLinks) {
			l.y1 = y + l.width / 2;
			y += l.width;
		}
	}
	return {
		nodes,
		links
	};
}
function sankeyLinkPath(l, t = 1) {
	const xs = l.source.x1;
	const xt = xs + (l.target.x0 - xs) * t;
	const yt = l.y0 + (l.y1 - l.y0) * t;
	const mx = (xs + xt) / 2;
	const h = l.width / 2;
	const r = (n) => Math.round(n * 100) / 100;
	return `M${r(xs)},${r(l.y0 - h)}C${r(mx)},${r(l.y0 - h)} ${r(mx)},${r(yt - h)} ${r(xt)},${r(yt - h)}L${r(xt)},${r(yt + h)}C${r(mx)},${r(yt + h)} ${r(mx)},${r(l.y0 + h)} ${r(xs)},${r(l.y0 + h)}Z`;
}
var MSG23 = {
	en: {
		kind: "Sankey diagram",
		total: "Total",
		in: "In",
		out: "Out",
		flow: "Flow",
		flows: (n) => plural(n, "flow"),
		/** 링크가 출발 노드에서 차지하는 비율의 이름 */
		from: (source) => `Share of ${source}`,
		desc: (nodes, links) => `${plural(nodes, "node")}, ${plural(links, "flow")}. Largest flows`
	},
	ko: {
		kind: "생키 다이어그램",
		total: "합계",
		in: "들어옴",
		out: "나감",
		flow: "흐름",
		flows: (n) => `흐름 ${n}개`,
		from: (source) => `${source} 중 비중`,
		desc: (nodes, links) => `노드 ${nodes}개, 흐름 ${links}개. 큰 흐름`
	}
};
function SankeyChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(220, Math.min(340, w * .6)),
		duration: 1e3,
		stagger: 70
	});
	const { p, width: W, height: H } = c;
	const msg = MSG23[c.lang];
	const links0 = useMemo(() => {
		const gs = strGetter(props.source, "source");
		const gt = strGetter(props.target, "target");
		const gv = numGetter(props.value, "value");
		return props.data.map((d, i) => ({
			source: gs(d, i),
			target: gt(d, i),
			value: gv(d, i) || 0,
			d
		}));
	}, [
		props.data,
		props.source,
		props.target,
		props.value
	]);
	const pre = useMemo(() => sankeyLayout([], links0, {
		width: 100,
		height: 100,
		iterations: 0
	}), [links0]);
	const firstLabels = pre.nodes.filter((n) => n.layer === 0);
	const maxLayer = Math.max(0, ...pre.nodes.map((n) => n.layer));
	const lastLabels = pre.nodes.filter((n) => n.layer === maxLayer && maxLayer > 0);
	const lw = Math.min(W * .22, Math.max(0, ...firstLabels.map((n) => Math.max(textWidth(n.label, 11.5, 700), textWidth(c.fmt(n.value), 10.5)))) + 10);
	const rw = Math.min(W * .22, Math.max(0, ...lastLabels.map((n) => Math.max(textWidth(n.label, 11.5, 700), textWidth(c.fmt(n.value), 10.5)))) + 10);
	const layout = useMemo(() => sankeyLayout([], links0, {
		width: Math.max(60, W - lw - rw),
		height: H - 8,
		x0: lw,
		y0: 4,
		nodeWidth: props.nodeWidth ?? 10,
		nodePadding: props.nodePadding ?? 14
	}), [
		links0,
		W,
		H,
		lw,
		rw,
		props.nodeWidth,
		props.nodePadding
	]);
	const hiNodes = useMemo(() => {
		const names = layout.nodes.map((n) => n.label);
		if (props.highlight !== void 0) return resolveHighlight(props.highlight, layout.nodes, names, layout.nodes.map((n) => n.value));
		const best = layout.nodes.filter((n) => n.layer === maxLayer).sort((a, b) => b.value - a.value)[0];
		return new Set(best ? [best.index] : []);
	}, [
		layout,
		props.highlight,
		maxLayer
	]);
	const linkHot = (l) => hiNodes.has(l.source.index) || hiNodes.has(l.target.index);
	const stg = c.motion.stagger ?? 70;
	const D = c.motion.duration ?? 1e3;
	const m = useMotion(useMemo(() => {
		const ms = [];
		layout.nodes.forEach((n) => {
			const mid = (n.y0 + n.y1) / 2;
			ms.push({
				key: `n:${n.id}`,
				to: [n.y0, n.y1],
				from: [mid, mid],
				enter: [mid, mid],
				delay: n.layer * stg * 2,
				data: { node: n }
			});
		});
		layout.links.forEach((l, k) => ms.push({
			key: `l:${l.source.id}>${l.target.id}`,
			to: [
				1,
				l.y0,
				l.y1,
				l.width
			],
			from: [
				0,
				l.y0,
				l.y1,
				l.width
			],
			enter: [
				0,
				l.y0,
				l.y1,
				l.width
			],
			delay: D * .25 + l.source.layer * stg * 3 + k % 6 * 25,
			data: { link: l }
		}));
		return ms;
	}, [
		layout,
		stg,
		D
	]), c.motion);
	const accent = swatch(p, "accent");
	const nodeCount = layout.nodes.length;
	const fv = c.fv;
	const events = useMemo(() => {
		const rowOf = /* @__PURE__ */ new Map();
		for (const x of links0) if (!rowOf.has(`${x.source}>${x.target}`)) rowOf.set(`${x.source}>${x.target}`, x.d);
		return [...layout.nodes.map((n) => ({
			datum: null,
			index: n.index,
			key: n.id,
			label: n.label,
			value: n.value,
			formatted: fv(n.value)
		})), ...layout.links.map((l, k) => ({
			datum: rowOf.get(`${l.source.id}>${l.target.id}`) ?? null,
			index: nodeCount + k,
			key: `${l.source.id}>${l.target.id}`,
			label: `${l.source.label} → ${l.target.label}`,
			value: l.value,
			formatted: fv(l.value)
		}))];
	}, [
		layout,
		links0,
		nodeCount,
		fv
	]);
	let tip = null;
	const act = c.active;
	if (act !== null) {
		if (act < nodeCount) {
			const n = layout.nodes[act];
			if (n) tip = {
				x: (n.x0 + n.x1) / 2,
				y: n.y0,
				title: n.label,
				rows: [
					{
						label: msg.total,
						value: c.fv(n.value),
						color: hiNodes.has(n.index) ? accent.fill : p.paint("neutralStrong")
					},
					...n.inLinks.length ? [{
						label: msg.in,
						value: msg.flows(n.inLinks.length)
					}] : [],
					...n.outLinks.length ? [{
						label: msg.out,
						value: msg.flows(n.outLinks.length)
					}] : []
				]
			};
		} else {
			const l = layout.links[act - nodeCount];
			if (l) tip = {
				x: (l.source.x1 + l.target.x0) / 2,
				y: (l.y0 + l.y1) / 2 - l.width / 2,
				title: `${l.source.label} → ${l.target.label}`,
				rows: [{
					label: msg.flow,
					value: c.fv(l.value),
					color: linkHot(l) ? accent.fill : p.paint("neutral")
				}, {
					label: msg.from(l.source.label),
					value: c.pct(l.value / (l.source.value || 1) * 100)
				}]
			};
		}
	}
	const activeNode = act !== null && act < nodeCount ? layout.nodes[act] : null;
	const activeLink = act !== null && act >= nodeCount ? layout.links[act - nodeCount] : null;
	const linkOpacity = (l) => {
		if (activeNode) return l.source === activeNode || l.target === activeNode ? .75 : .12;
		if (activeLink) return l === activeLink ? .8 : .12;
		return linkHot(l) ? .55 : .32;
	};
	const desc = props.description ?? `${msg.kind}. ${msg.desc(nodeCount, layout.links.length)}: ${[...layout.links].sort((a, b) => b.value - a.value).slice(0, 3).map((l) => `${l.source.label}→${l.target.label} ${c.fv(l.value)}`).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [/* @__PURE__ */ jsx("g", { children: m.items.map((it) => {
			const l = it.data.link;
			if (!l) return null;
			const k = layout.links.indexOf(l);
			const [t, y0, y1, w] = it.v;
			if (t <= .001) return null;
			const hot = linkHot(l);
			return /* @__PURE__ */ jsx("path", {
				className: "ztd-mark",
				d: sankeyLinkPath({
					source: l.source,
					target: l.target,
					y0,
					y1,
					width: w
				}, t),
				fill: hot ? accent.fill : p.paint("neutralStrong"),
				opacity: linkOpacity(l) * Math.min(1, t * 1.5),
				onPointerEnter: (e) => c.setActive(nodeCount + k, e.pointerType === "touch" ? "touch" : "pointer"),
				onClick: () => c.click(nodeCount + k)
			}, it.key);
		}) }), m.items.map((it) => {
			const n = it.data.node;
			if (!n) return null;
			const [y0, y1] = it.v;
			const hot = hiNodes.has(n.index);
			const isA = act === n.index;
			const first = n.layer === 0;
			const last = n.layer === maxLayer && maxLayer > 0;
			const lx = first ? n.x0 - 8 : n.x1 + 8;
			const anchor = first ? "end" : "start";
			const room = first ? lw - 10 : last ? rw - 10 : Math.max(40, (layout.nodes.find((q) => q.layer === n.layer + 1)?.x0 ?? W) - n.x1 - 16);
			const cy = (n.y0 + n.y1) / 2;
			const two = n.y1 - n.y0 >= 26;
			const overLinks = !first && !last;
			const name = truncate(n.label, room, 11.5, 700);
			const pillW = Math.max(textWidth(name, 11.5, 800), two ? textWidth(c.fmt(n.value), 10.5) : 0) + 10;
			const pillH = two ? 32 : 18;
			return /* @__PURE__ */ jsxs("g", {
				onPointerEnter: (e) => c.setActive(n.index, e.pointerType === "touch" ? "touch" : "pointer"),
				onClick: () => c.click(n.index),
				children: [/* @__PURE__ */ jsx("path", {
					d: roundRectPath(n.x0, y0, n.x1 - n.x0, Math.max(1, y1 - y0), 2),
					fill: hot ? accent.fill : p.paint("ink"),
					stroke: isA && c.via === "keyboard" ? p.paint("accent") : "none",
					strokeWidth: 2
				}), c.showLabels ? /* @__PURE__ */ jsxs("g", {
					opacity: m.fade(n.layer * stg * 2 + D * .35, 300),
					pointerEvents: "none",
					children: [
						overLinks ? /* @__PURE__ */ jsx("rect", {
							x: r2(lx - 5),
							y: r2(cy - pillH / 2),
							width: pillW,
							height: pillH,
							rx: 6,
							fill: p.paint("panel"),
							opacity: .94
						}) : null,
						/* @__PURE__ */ jsx(Txt, {
							x: lx,
							y: two ? cy - 7 : cy,
							anchor,
							size: 11.5,
							weight: hot || isA ? 800 : 600,
							fill: p.paint("ink"),
							children: name
						}),
						two ? /* @__PURE__ */ jsx(Txt, {
							x: lx,
							y: cy + 8,
							anchor,
							size: 10.5,
							fill: p.paint("muted"),
							children: c.fmt(n.value)
						}) : null
					]
				}) : null]
			}, it.key);
		})]
	});
}
function chordLayout(matrix, padAngle = .04) {
	const n = matrix.length;
	const at = (i, j) => Math.max(0, matrix[i]?.[j] || 0);
	const pair = (i, j) => at(i, j) + (i === j ? 0 : at(j, i));
	const size = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => pair(i, j)).reduce((a, b) => a + b, 0));
	const total = size.reduce((a, b) => a + b, 0);
	const pad = Math.min(padAngle, n ? TAU * .5 / n : 0);
	const k = total > 0 ? Math.max(0, TAU - pad * n) / total : 0;
	const groups2 = [];
	const sub = Array.from({ length: n }, () => []);
	let x = 0;
	for (let i = 0; i < n; i++) {
		const g0 = x;
		for (let j = 0; j < n; j++) {
			const s0 = x;
			x += pair(i, j) * k;
			sub[i][j] = {
				index: i,
				sub: j,
				a0: s0,
				a1: x,
				value: at(i, j)
			};
		}
		groups2.push({
			index: i,
			a0: g0,
			a1: x,
			value: size[i]
		});
		x += pad;
	}
	const chords = [];
	for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
		const a = sub[i][j];
		const b = sub[j][i];
		if (a.value <= 0 && b.value <= 0) continue;
		chords.push(a.value >= b.value ? {
			source: a,
			target: b
		} : {
			source: b,
			target: a
		});
	}
	return {
		groups: groups2,
		chords
	};
}
function ribbonPath(cx, cy, r, s0, s1, t0, t1) {
	const p = (a) => polar(cx, cy, r, a);
	const f = (n) => Math.round(n * 100) / 100;
	const [sx0, sy0] = p(s0);
	const [sx1, sy1] = p(s1);
	const [tx0, ty0] = p(t0);
	const [tx1, ty1] = p(t1);
	const largeS = s1 - s0 > Math.PI ? 1 : 0;
	const largeT = t1 - t0 > Math.PI ? 1 : 0;
	const same2 = s0 === t0 && s1 === t1;
	let d = `M${f(sx0)},${f(sy0)}A${f(r)},${f(r)} 0 ${largeS} 1 ${f(sx1)},${f(sy1)}`;
	if (same2) {
		d += `Q${f(cx)},${f(cy)} ${f(sx0)},${f(sy0)}Z`;
		return d;
	}
	d += `Q${f(cx)},${f(cy)} ${f(tx0)},${f(ty0)}A${f(r)},${f(r)} 0 ${largeT} 1 ${f(tx1)},${f(ty1)}Q${f(cx)},${f(cy)} ${f(sx0)},${f(sy0)}Z`;
	return d;
}
var MSG24 = {
	en: {
		kind: "Chord diagram",
		sent: "Sent",
		received: "Received",
		groups: (n) => plural(n, "group")
	},
	ko: {
		kind: "코드 다이어그램",
		sent: "보냄",
		received: "받음",
		groups: (n) => `그룹 ${n}개`
	}
};
function ChordChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(240, Math.min(340, w * .7)),
		duration: 1e3
	});
	const { p, width: W, height: H } = c;
	const model = useMemo(() => {
		const has = (k) => props.data.some((d) => d && typeof d === "object" && k in d);
		const gs = strGetter(props.source ?? (has("source") ? "source" : "from"), "source");
		const gt = strGetter(props.target ?? (has("target") ? "target" : "to"), "target");
		const gv = numGetter(props.value, "value");
		const names = uniq(props.data.flatMap((d, i) => [gs(d, i), gt(d, i)]));
		const idx = new Map(names.map((n2, i) => [n2, i]));
		const matrix = names.map(() => names.map(() => 0));
		props.data.forEach((d, i) => {
			const a = idx.get(gs(d, i));
			const b = idx.get(gt(d, i));
			if (a === void 0 || b === void 0) return;
			matrix[a][b] += Math.max(0, gv(d, i) || 0);
		});
		const lay = chordLayout(matrix, props.padAngle ?? .05);
		const totals = lay.groups.map((g) => g.value);
		return {
			names,
			matrix,
			lay,
			hi: resolveHighlight(props.highlight, names, names, totals, "max"),
			grand: totals.reduce((a, b) => a + b, 0) || 1
		};
	}, [
		props.data,
		props.source,
		props.target,
		props.value,
		props.padAngle,
		props.highlight
	]);
	const labelW = Math.max(...model.names.map((n2) => textWidth(n2, 11.5, 700)), 20) + 14;
	const R = Math.max(40, Math.min(H / 2 - 16, W / 2 - labelW));
	const cx = W / 2;
	const cy = H / 2;
	const thick = Math.max(8, Math.min(14, R * .09));
	const rr = R - thick - 3;
	const D = c.motion.duration ?? 1e3;
	const m = useMotion(useMemo(() => [{
		key: "__sweep",
		to: [TAU],
		from: [0],
		data: null
	}, {
		key: "__rib",
		to: [1],
		from: [0],
		delay: D * .45,
		data: null
	}], [D]), c.motion);
	const sweep = m.get("__sweep")?.[0] ?? TAU;
	const rib = m.get("__rib")?.[0] ?? 1;
	const accent = swatch(p, "accent");
	const msg = MSG24[c.lang];
	const n = model.names.length;
	const hot = (ch) => model.hi.has(ch.source.index) || model.hi.has(ch.target.index);
	const act = c.active;
	const actGroup = act !== null && act < n ? act : null;
	const actChord = act !== null && act >= n ? model.lay.chords[act - n] : null;
	const events = [...model.lay.groups.map((g) => ({
		datum: null,
		index: g.index,
		key: model.names[g.index],
		label: model.names[g.index],
		value: g.value,
		formatted: `${c.fv(g.value)} (${c.pct(g.value / model.grand * 100)})`
	})), ...model.lay.chords.map((ch, k) => ({
		datum: null,
		index: n + k,
		key: `${ch.source.index}-${ch.target.index}`,
		label: `${model.names[ch.source.index]} ↔ ${model.names[ch.target.index]}`,
		value: ch.source.value + (ch.source.index === ch.target.index ? 0 : ch.target.value),
		formatted: `${model.names[ch.source.index]}→${model.names[ch.target.index]} ${c.fv(ch.source.value)}, ${model.names[ch.target.index]}→${model.names[ch.source.index]} ${c.fv(ch.target.value)}`
	}))];
	let tip = null;
	if (actGroup !== null) {
		const g = model.lay.groups[actGroup];
		const [tx, ty] = polar(cx, cy, R, (g.a0 + g.a1) / 2);
		const outs = model.matrix[actGroup].reduce((a, b) => a + b, 0);
		const ins = model.matrix.reduce((a, row) => a + row[actGroup], 0);
		tip = {
			x: tx,
			y: ty,
			title: model.names[actGroup],
			rows: [{
				label: msg.sent,
				value: c.fv(outs),
				color: model.hi.has(actGroup) ? accent.fill : p.paint("neutralStrong")
			}, {
				label: msg.received,
				value: c.fv(ins)
			}]
		};
	} else if (actChord) {
		const a = (actChord.source.a0 + actChord.source.a1) / 2;
		const [tx, ty] = polar(cx, cy, rr * .6, a);
		tip = {
			x: tx,
			y: ty,
			title: `${model.names[actChord.source.index]} ↔ ${model.names[actChord.target.index]}`,
			rows: [{
				label: `${model.names[actChord.source.index]} →`,
				value: c.fv(actChord.source.value)
			}, {
				label: `${model.names[actChord.target.index]} →`,
				value: c.fv(actChord.target.value)
			}]
		};
	}
	const ribOpacity = (ch) => {
		if (actGroup !== null) return ch.source.index === actGroup || ch.target.index === actGroup ? .82 : .08;
		if (actChord) return ch === actChord ? .88 : .08;
		return hot(ch) ? .68 : .4;
	};
	const desc = props.description ?? `${msg.kind}. ${msg.groups(n)}: ${model.lay.groups.map((g) => `${model.names[g.index]} ${c.fv(g.value)}`).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [/* @__PURE__ */ jsx("g", {
			opacity: Math.min(1, rib * 1.2),
			children: model.lay.chords.map((ch, k) => /* @__PURE__ */ jsx("path", {
				className: "ztd-mark",
				d: ribbonPath(cx, cy, rr, ch.source.a0, ch.source.a1, ch.target.a0, ch.target.a1),
				fill: hot(ch) ? accent.fill : p.paint("neutralStrong"),
				opacity: ribOpacity(ch),
				stroke: p.paint("panel"),
				strokeWidth: .6,
				onPointerEnter: (e) => c.setActive(n + k, e.pointerType === "touch" ? "touch" : "pointer"),
				onClick: () => c.click(n + k)
			}, k))
		}), model.lay.groups.map((g) => {
			const a0 = Math.min(g.a0, sweep);
			const a1 = Math.min(g.a1, sweep);
			const isHi = model.hi.has(g.index);
			const d = arcPath(cx, cy, R - thick, R, a0, a1);
			const mid = (g.a0 + g.a1) / 2;
			const [lx, ly] = polar(cx, cy, R + 10, mid);
			const s = Math.sin(mid);
			return /* @__PURE__ */ jsxs("g", {
				onPointerEnter: (e) => c.setActive(g.index, e.pointerType === "touch" ? "touch" : "pointer"),
				onClick: () => c.click(g.index),
				children: [d ? /* @__PURE__ */ jsx("path", {
					className: "ztd-mark",
					d,
					fill: isHi ? accent.fill : p.paint("ink"),
					opacity: actGroup === null || actGroup === g.index ? 1 : .4,
					stroke: act === g.index && c.via === "keyboard" ? p.paint("accent") : "none",
					strokeWidth: 2
				}) : null, c.showLabels ? /* @__PURE__ */ jsx(Txt, {
					x: lx,
					y: ly + (Math.cos(mid) > .9 ? -3 : Math.cos(mid) < -.9 ? 4 : 0),
					anchor: s > .12 ? "start" : s < -.12 ? "end" : "middle",
					size: 11.5,
					weight: isHi || actGroup === g.index ? 800 : 600,
					fill: p.paint(isHi ? "ink" : "muted"),
					opacity: m.fade(D * .4, 300),
					children: model.names[g.index]
				}) : null]
			}, g.index);
		})]
	});
}
var MSG25 = {
	en: {
		kind: "Calendar heatmap",
		desc: (days, max) => `${plural(days, "day")}, max ${max}`
	},
	ko: {
		kind: "캘린더 히트맵",
		desc: (days, max) => `${days}일, 최대 ${max}`
	}
};
var DAY2 = 864e5;
var MIN_OPACITY = .18;
function isoDay(t) {
	const d = new Date(t);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function CalendarHeatmap(props) {
	const model = useMemo(() => {
		const gd = getter(props.date, "date");
		const gv = numGetter(props.value, "value");
		const byDay = /* @__PURE__ */ new Map();
		props.data.forEach((d, i) => {
			const dt = toDate(gd(d, i));
			if (!dt) return;
			const key = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
			const prev = byDay.get(key);
			const v = gv(d, i);
			const pv = prev?.v ?? NaN;
			byDay.set(key, {
				v: Number.isFinite(v) ? (Number.isFinite(pv) ? pv : 0) + v : pv,
				d
			});
		});
		const keys = [...byDay.keys()].sort((a, b) => a - b);
		return {
			byDay,
			keys,
			years: keys.length ? [...new Set(keys.map((k) => new Date(k).getFullYear()))].sort() : []
		};
	}, [
		props.data,
		props.date,
		props.value
	]);
	const nYears = Math.max(1, model.years.length);
	const multi = nYears > 1;
	const c = useChart(props, {
		height: (w) => multi ? nYears * Math.max(70, Math.min(110, w / 8)) + 18 : Math.max(120, Math.min(190, w / 4.6 + 24)),
		duration: 700
	});
	const { p, width: W, height: H } = c;
	const ws = props.weekStart ?? 0;
	const wd = useMemo(() => {
		const f = new Intl.DateTimeFormat(c.locale, { weekday: "short" });
		return Array.from({ length: 7 }, (_, d) => f.format(new Date(2024, 0, 7 + d)));
	}, [c.locale]);
	const leftW = Math.max(22, Math.ceil(Math.max(...[
		1,
		3,
		5
	].map((r) => textWidth(wd[(r + ws) % 7], 9.5)))) + 10);
	const topH = 16;
	const maxGap = props.gap ?? 2.5;
	const days = useMemo(() => {
		const out = [];
		if (!model.keys.length) return out;
		const first = new Date(model.keys[0]);
		const last = new Date(model.keys[model.keys.length - 1]);
		(multi ? model.years.map((y) => [new Date(y, 0, 1), new Date(y, 11, 31)]) : [[first, last]]).forEach(([a, b], yi) => {
			const start = new Date(a);
			start.setDate(start.getDate() - (start.getDay() - ws + 7) % 7);
			const end = b.getTime();
			for (const d = new Date(a.getFullYear(), a.getMonth(), a.getDate()); d.getTime() <= end; d.setDate(d.getDate() + 1)) {
				const tt = d.getTime();
				const week = Math.floor((tt - start.getTime() + 36e5) / (7 * DAY2));
				const hit = model.byDay.get(tt);
				out.push({
					i: out.length,
					t: tt,
					week,
					wd: (d.getDay() - ws + 7) % 7,
					year: yi,
					value: hit ? hit.v : 0,
					datum: hit?.d ?? null
				});
			}
		});
		return out;
	}, [
		model,
		multi,
		ws
	]);
	const stats = useMemo(() => {
		let weeks2 = 1;
		for (const d of days) if (d.week + 1 > weeks2) weeks2 = d.week + 1;
		const vals = days.map((d) => d.value);
		return {
			weeks: weeks2,
			ext: extent(vals),
			top95: robustMax(vals.filter((v) => v > 0))
		};
	}, [days]);
	const { weeks, top95 } = stats;
	const [mn, mx] = stats.ext;
	const useCanvas = c.hydrated && days.length > (props.canvasThreshold ?? 4e3);
	const blockH = (H - (multi ? 4 : 0)) / nYears;
	const room = Math.max(0, Math.min((W - leftW - 2) / weeks, (blockH - topH - 4) / 7));
	const gap = room - maxGap >= 2 ? maxGap : room * maxGap / (maxGap + 2);
	const cell = room - gap;
	const step = cell + gap;
	const gridW = weeks * step;
	const x0 = leftW + Math.max(0, (W - leftW - gridW) / 2);
	const span2 = Math.max(1e-9, top95 - Math.min(0, mn)) || 1;
	const level = (v) => Math.min(1, (v - Math.min(0, mn)) / span2);
	const hi = useMemo(() => resolveHighlight(props.highlight, days.map((d) => d.datum), lazyArray(days.length, (k) => isoDay(days[k].t)), days.map((d) => d.value), "max"), [days, props.highlight]);
	const D = c.motion.duration ?? 700;
	const m = useMotion(useMemo(() => [{
		key: "__clock",
		to: [1],
		from: [0],
		delay: useCanvas ? 0 : D * .9,
		data: 0
	}], [D, useCanvas]), c.motion);
	const dayFmt = useMemo(() => new Intl.DateTimeFormat(c.locale, {
		month: "long",
		day: "numeric",
		weekday: "short",
		...multi ? { year: "numeric" } : {}
	}), [c.locale, multi]);
	const fv = c.fv;
	const events = useMemo(() => lazyArray(days.length, (k) => {
		const d = days[k];
		const known = Number.isFinite(d.value);
		return {
			datum: d.datum,
			index: d.i,
			key: String(d.t),
			label: dayFmt.format(d.t),
			value: known ? d.value : null,
			formatted: known ? fv(d.value) : "-"
		};
	}), [
		days,
		dayFmt,
		fv
	]);
	const pos = (d) => ({
		x: x0 + d.week * step,
		y: d.year * blockH + topH + d.wd * step
	});
	let tip = null;
	if (c.active !== null && days[c.active]) {
		const d = days[c.active];
		const q = pos(d);
		tip = {
			x: q.x + cell / 2,
			y: q.y,
			title: events[c.active].label,
			rows: [{
				label: c.t.value,
				value: Number.isFinite(d.value) ? c.fv(d.value) : "-",
				color: p.paint("accent")
			}]
		};
	}
	const pending = c.pending;
	const months = useMemo(() => {
		const out = [];
		if (pending) return out;
		let last = "";
		for (const d of days) {
			const dt = new Date(d.t);
			const key = `${d.year}-${dt.getMonth()}`;
			if (key !== last && dt.getDate() <= 7) {
				const x = x0 + d.week * step;
				const y = d.year * blockH + 7;
				const prev = out[out.length - 1];
				if (!prev || prev.y !== y || x - prev.x >= 26) out.push({
					x,
					y,
					label: formatDate(dt, {
						month: "short",
						locale: c.locale
					})
				});
				last = key;
			}
		}
		return out;
	}, [
		pending,
		days,
		x0,
		step,
		blockH,
		c.locale
	]);
	const msg = MSG25[c.lang];
	const desc = props.description ?? `${msg.kind}. ${msg.desc(days.length, c.fv(mx))}.`;
	const enabled = c.motion.enabled && c.hydrated;
	const dayIndex = useMemo(() => {
		const idx = new Int32Array(nYears * weeks * 7).fill(-1);
		for (const d of days) idx[(d.year * weeks + d.week) * 7 + d.wd] = d.i;
		return idx;
	}, [
		days,
		nYears,
		weeks
	]);
	const weekNodes = useMemo(() => {
		if (useCanvas || pending) return null;
		const byWeek = /* @__PURE__ */ new Map();
		for (const d of days) {
			const k = `${d.year}:${d.week}`;
			const arr = byWeek.get(k);
			if (arr) arr.push(d);
			else byWeek.set(k, [d]);
		}
		return [...byWeek.entries()].map(([k, list]) => {
			const w = list[0].week;
			return /* @__PURE__ */ jsx("g", {
				style: cssEntrance(enabled, m.waiting, "fade", w / Math.max(1, weeks - 1) * D * .9, 320),
				children: list.map((d) => {
					const q = {
						x: x0 + d.week * step,
						y: d.year * blockH + topH + d.wd * step
					};
					const s = d.value ? sequential(p, level(d.value), MIN_OPACITY) : null;
					const isHi = hi.has(d.i);
					return /* @__PURE__ */ jsx("rect", {
						x: q.x,
						y: q.y,
						width: cell,
						height: cell,
						rx: Math.min(2.5, cell / 3),
						fill: s ? s.fill : p.paint("neutralSoft"),
						opacity: s ? s.opacity : void 0,
						stroke: isHi ? p.paint("ink") : "none",
						strokeWidth: 1.2
					}, d.i);
				})
			}, k);
		});
	}, [
		useCanvas,
		pending,
		days,
		enabled,
		m.waiting,
		m.generation,
		weeks,
		D,
		x0,
		step,
		blockH,
		topH,
		cell,
		p,
		mn,
		span2,
		hi
	]);
	const labels = useMemo(() => /* @__PURE__ */ jsxs("g", {
		"aria-hidden": "true",
		children: [
			months.map((mm, k) => /* @__PURE__ */ jsx(Txt, {
				x: mm.x,
				y: mm.y,
				size: 10,
				fill: p.paint("muted"),
				children: mm.label
			}, k)),
			Array.from({ length: nYears }, (_, yi) => [
				1,
				3,
				5
			].map((r) => /* @__PURE__ */ jsx(Txt, {
				x: x0 - 6,
				y: yi * blockH + topH + r * step + cell / 2,
				anchor: "end",
				size: 9.5,
				fill: p.paint("muted"),
				children: wd[(r + ws) % 7]
			}, `${yi}-${r}`))),
			multi ? model.years.map((y, yi) => /* @__PURE__ */ jsx(Txt, {
				x: 2,
				y: yi * blockH + 7,
				size: 10,
				weight: 700,
				fill: p.paint("ink"),
				children: String(y)
			}, y)) : null
		]
	}), [
		months,
		nYears,
		x0,
		blockH,
		topH,
		step,
		cell,
		ws,
		multi,
		model.years,
		p,
		wd
	]);
	const prog = useCanvas ? m.get("__clock")?.[0] ?? 1 : 1;
	const draw = useMemo(() => {
		let bitmap = null;
		let bitmapKey = "";
		const paintAll = (ctx, acc, soft, ink) => {
			const rad = Math.min(2.5, cell / 3);
			const rounded = cell >= 5 && typeof ctx.roundRect === "function";
			const lo = Math.min(0, mn);
			const LEVELS = 32;
			const accBins = Array.from({ length: 33 }, () => []);
			const softBins = [];
			const marked = [];
			for (let k = 0; k < days.length; k++) {
				const d = days[k];
				if (d.value) accBins[Math.round((MIN_OPACITY + (1 - MIN_OPACITY) * Math.min(1, (d.value - lo) / span2)) * LEVELS)].push(k);
				else softBins.push(k);
				if (hi.has(d.i)) marked.push(k);
			}
			const shapes = (list) => {
				ctx.beginPath();
				for (const k of list) {
					const d = days[k];
					const x = x0 + d.week * step;
					const y = d.year * blockH + topH + d.wd * step;
					if (rounded) ctx.roundRect(x, y, cell, cell, rad);
					else ctx.rect(x, y, cell, cell);
				}
			};
			ctx.fillStyle = soft;
			shapes(softBins);
			ctx.fill();
			ctx.fillStyle = acc;
			for (let b = 1; b <= LEVELS; b++) {
				if (!accBins[b].length) continue;
				ctx.globalAlpha = b / LEVELS;
				shapes(accBins[b]);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
			if (marked.length) {
				ctx.strokeStyle = ink;
				ctx.lineWidth = 1.2;
				shapes(marked);
				ctx.stroke();
			}
		};
		let drawn = null;
		return (ctx, t, color) => {
			const acc = color("--ztd-accent", p.theme.accent);
			const soft = color("--ztd-neutral-soft", p.theme.neutralSoft);
			const ink = color("--ztd-ink", p.theme.ink);
			const pw = ctx.canvas.width;
			const ph = ctx.canvas.height;
			const k = pw / Math.max(1, W);
			const key = `${acc}|${soft}|${ink}|${pw}x${ph}`;
			if (!bitmap || bitmapKey !== key || !drawn) {
				bitmap = bitmap ?? document.createElement("canvas");
				bitmap.width = pw;
				bitmap.height = ph;
				const b = bitmap.getContext("2d");
				if (!b) return;
				b.setTransform(k, 0, 0, k, 0, 0);
				b.clearRect(0, 0, W, H);
				paintAll(b, acc, soft, ink);
				bitmapKey = key;
				ctx.clearRect(0, 0, W, H);
				drawn = new Float32Array(weeks);
			}
			const last = Math.max(1, weeks - 1);
			const edge = (w) => Math.round(Math.min(pw, Math.max(0, (x0 + w * step - gap / 2) * k)));
			for (let w = 0; w < weeks; w++) {
				const o = Math.max(0, Math.min(1, (t - w / last * .75) / .25));
				if (o === drawn[w]) continue;
				const a = edge(w);
				const b = w === weeks - 1 ? pw : edge(w + 1);
				if (b > a) {
					ctx.clearRect(a / k, 0, (b - a) / k, H);
					if (o > 0) {
						ctx.globalAlpha = o;
						ctx.drawImage(bitmap, a, 0, b - a, ph, a / k, 0, (b - a) / k, H);
					}
				}
				drawn[w] = o;
			}
			ctx.globalAlpha = 1;
		};
	}, [
		days,
		weeks,
		x0,
		step,
		gap,
		blockH,
		cell,
		mn,
		span2,
		hi,
		W,
		H,
		p.theme.accent,
		p.theme.neutralSoft,
		p.theme.ink
	]);
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, py, e) => {
			const w = Math.floor((px - x0) / step);
			const yi = Math.floor(py / blockH);
			const wd2 = Math.floor((py - yi * blockH - topH) / step);
			const hit = yi >= 0 && yi < nYears && w >= 0 && w < weeks && wd2 >= 0 && wd2 < 7 ? dayIndex[(yi * weeks + w) * 7 + wd2] : -1;
			const k = hit >= 0 ? hit : null;
			if (k !== c.active) c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer");
		},
		onKey: (e) => {
			const d = e.key === "ArrowRight" ? 7 : e.key === "ArrowLeft" ? -7 : 0;
			if (!d || c.active === null) return false;
			if (days[c.active + d]) c.setActive(c.active + d, "keyboard");
			return true;
		},
		underlay: useCanvas ? /* @__PURE__ */ jsx(CanvasLayer, {
			width: W,
			height: H,
			draw,
			progress: prog,
			version: c.sig,
			manualClear: true
		}) : void 0,
		children: [
			labels,
			weekNodes ? /* @__PURE__ */ jsx("g", { children: weekNodes }, m.generation) : null,
			c.active !== null && days[c.active] ? /* @__PURE__ */ jsx("rect", {
				x: pos(days[c.active]).x - .5,
				y: pos(days[c.active]).y - .5,
				width: cell + 1,
				height: cell + 1,
				rx: Math.min(3, cell / 3),
				fill: "none",
				stroke: p.paint("ink"),
				strokeWidth: 1.6,
				pointerEvents: "none"
			}) : null
		]
	});
}
var MSG26 = {
	en: {
		kind: "Bump chart",
		rank: (r) => `#${r}`,
		desc: (n, from, to) => `Rank changes of ${plural(n, "item")}, from ${from} to ${to}`
	},
	ko: {
		kind: "범프 차트",
		rank: (r) => `${r}위`,
		desc: (n, from, to) => `${n}개 항목의 순위 변화, ${from}부터 ${to}까지`
	}
};
function BumpChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(200, Math.min(300, w * .55)),
		duration: 1100,
		stagger: 90
	});
	const { p, width: W, height: H } = c;
	const byRank = props.rank !== void 0 || props.value === void 0;
	const model = useMemo(() => prepSeries(props.data, props.x, byRank ? props.rank ?? "rank" : props.value, props.series, {
		xType: "band",
		locale: c.locale,
		sum: false
	}), [
		props.data,
		props.x,
		props.rank,
		props.value,
		props.series,
		byRank,
		c.locale
	]);
	const nK = model.keys.length;
	const nS = model.series.length;
	const lines = useMemo(() => {
		const rk = model.series.map(() => new Array(nK).fill(NaN));
		for (let k = 0; k < nK; k++) if (byRank) model.series.forEach((_, s) => rk[s][k] = model.values[s][k]);
		else {
			const r = ranks(model.series.map((_, s) => Number.isFinite(model.values[s][k]) ? model.values[s][k] : -Infinity), true);
			model.series.forEach((_, s) => rk[s][k] = Number.isFinite(model.values[s][k]) ? r[s] : NaN);
		}
		const improve = rk.map((r) => {
			return (r.find(Number.isFinite) ?? 0) - ([...r].reverse().find(Number.isFinite) ?? 0);
		});
		const hi = resolveHighlight(props.highlight, model.series, model.series, improve, "max");
		return model.series.map((name, s) => ({
			s,
			name,
			ranks: rk[s],
			hi: hi.has(s)
		}));
	}, [
		model,
		nK,
		byRank,
		props.highlight
	]);
	const maxRank = Math.max(nS, ...lines.flatMap((l) => l.ranks.filter(Number.isFinite)));
	const lw = Math.min(W * .24, Math.max(...lines.map((l) => textWidth(l.name, 11, 800)), 20) + 16);
	const msg = MSG26[c.lang];
	const rw = Math.min(W * .26, Math.max(...lines.map((l) => textWidth(`${msg.rank([...l.ranks].reverse().find(Number.isFinite) ?? "")} ${l.name}`, 11, 800)), 20) + 16);
	const top = 12;
	const bottom = 24;
	const x0 = lw;
	const x1 = W - rw;
	const xs = (k) => nK > 1 ? x0 + k * (x1 - x0) / (nK - 1) : (x0 + x1) / 2;
	const rowH = (H - top - bottom) / Math.max(1, maxRank - 1 || 1);
	const yr = (r) => top + (r - 1) * rowH;
	const stg = c.motion.stagger ?? 90;
	const order = useMemo(() => [...lines].sort((a, b) => Number(a.hi) - Number(b.hi)), [lines]);
	const m = useMotion(useMemo(() => order.map((l, k) => ({
		key: `b:${l.name}`,
		to: [1, ...l.ranks.map((r) => Number.isFinite(r) ? yr(r) : NaN)],
		from: [0, ...l.ranks.map((r) => Number.isFinite(r) ? yr(r) : NaN)],
		enter: [0, ...l.ranks.map((r) => Number.isFinite(r) ? yr(r) : NaN)],
		delay: k * stg * .6,
		parts: [1, l.ranks.length],
		data: l
	})), [
		order,
		stg,
		H,
		maxRank
	]), c.motion);
	const accent = swatch(p, "accent");
	const events = model.keys.map((key, k) => ({
		datum: null,
		index: k,
		key,
		label: model.labels[k],
		value: null,
		formatted: [...lines].filter((l) => Number.isFinite(l.ranks[k])).sort((a, b) => a.ranks[k] - b.ranks[k]).map((l) => `${msg.rank(l.ranks[k])} ${l.name}`).join(", ")
	}));
	let tip = null;
	if (c.active !== null && model.keys[c.active] !== void 0) {
		const k = c.active;
		const rows = [...lines].filter((l) => Number.isFinite(l.ranks[k])).sort((a, b) => a.ranks[k] - b.ranks[k]).map((l) => ({
			label: l.name,
			value: msg.rank(l.ranks[k]),
			color: l.hi ? accent.fill : p.paint("neutralStrong"),
			strong: l.hi
		}));
		tip = {
			x: xs(k),
			y: top,
			title: model.labels[k],
			rows: capTipRows(rows, c.t.more)
		};
	}
	const D = c.motion.duration ?? 1100;
	const desc = props.description ?? `${msg.kind}. ${msg.desc(nS, model.labels[0] ?? "", model.labels[nK - 1] ?? "")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, _py, e) => nK && c.setActive(evenIndex(px, x0, x1, nK), e.pointerType === "touch" ? "touch" : "pointer"),
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: x0,
				y: 0,
				width: Math.max(0, x1 - x0),
				height: H - bottom,
				fill: "transparent"
			}),
			c.active !== null ? /* @__PURE__ */ jsx("line", {
				x1: xs(c.active),
				x2: xs(c.active),
				y1: 4,
				y2: H - bottom + 2,
				stroke: p.paint("line2"),
				strokeWidth: Math.max(8, (x1 - x0) / Math.max(1, nK - 1) * .6),
				pointerEvents: "none"
			}) : null,
			m.items.map((it) => {
				const l = it.data;
				const draw = it.v[0];
				const pts2 = it.v.slice(1).map((yy, k) => [xs(k), yy]).filter((q) => Number.isFinite(q[1]));
				const col = l.hi ? accent.fill : p.paint("neutralStrong");
				const dash = draw < .999;
				return /* @__PURE__ */ jsxs("g", {
					opacity: it.exiting ? .4 : 1,
					pointerEvents: "none",
					children: [/* @__PURE__ */ jsx("path", {
						d: monotonePath(pts2),
						fill: "none",
						stroke: col,
						strokeOpacity: l.hi ? 1 : .6,
						strokeWidth: l.hi ? 3.4 : 2,
						strokeLinecap: "round",
						strokeLinejoin: "round",
						pathLength: dash ? 1 : void 0,
						strokeDasharray: dash ? "1 1" : void 0,
						strokeDashoffset: dash ? 1 - draw : void 0
					}), pts2.map(([xx, yy], k) => {
						const f = pts2.length > 1 ? k / (pts2.length - 1) : 1;
						const o = Math.max(0, Math.min(1, (draw - f) * 8 + (draw >= .999 ? 1 : 0)));
						return /* @__PURE__ */ jsx("circle", {
							cx: xx,
							cy: yy,
							r: l.hi ? 4.6 : 3.4,
							fill: l.hi ? col : p.paint("panel"),
							stroke: col,
							strokeWidth: l.hi ? 0 : 1.6,
							opacity: Math.min(1, o)
						}, k);
					})]
				}, it.key);
			}),
			c.showLabels ? lines.map((l) => {
				const r0 = l.ranks.find(Number.isFinite);
				const r13 = [...l.ranks].reverse().find(Number.isFinite);
				const strong = l.hi;
				const fill = p.paint(strong ? "ink" : "muted");
				return /* @__PURE__ */ jsxs("g", {
					opacity: m.fade(D * .55, 300),
					children: [r0 !== void 0 ? /* @__PURE__ */ jsx(Txt, {
						x: x0 - 10,
						y: yr(r0),
						anchor: "end",
						size: 11,
						weight: strong ? 800 : 500,
						fill,
						children: truncate(l.name, lw - 10, 11, strong ? 800 : 500)
					}) : null, r13 !== void 0 ? /* @__PURE__ */ jsx(Txt, {
						x: x1 + 10,
						y: yr(r13),
						size: 11,
						weight: strong ? 800 : 500,
						fill,
						children: `${msg.rank(r13)} ${truncateBeside(l.name, msg.rank(r13), rw - 10, 11, strong ? 800 : 500)}`
					}) : null]
				}, l.name);
			}) : null,
			/* @__PURE__ */ jsx(AxisXBand, {
				p,
				labels: model.labels,
				centers: model.keys.map((_, k) => xs(k)),
				y: H - bottom + 14
			})
		]
	});
}
var MSG27 = {
	en: {
		box: "Box plot",
		violin: "Violin plot",
		max: "Max (whisker)",
		q3: "Q3",
		med: "Median",
		q1: "Q1",
		min: "Min (whisker)",
		pct: (p) => `P${p} (whisker)`,
		n: "Sample size",
		count: (n, outliers) => `${n}${outliers ? ` · ${plural(outliers, "outlier")}` : ""}`,
		summary: (median, q1, q3) => `median ${median}, IQR ${q1} to ${q3}`,
		median: (name, v) => `${name} median ${v}`
	},
	ko: {
		box: "박스 플롯",
		violin: "바이올린 플롯",
		max: "최대(수염)",
		q3: "3사분위",
		med: "중앙값",
		q1: "1사분위",
		min: "최소(수염)",
		pct: (p) => `${p}백분위(수염)`,
		n: "표본",
		count: (n, outliers) => `${n}개${outliers ? ` · 이상값 ${outliers}` : ""}`,
		summary: (median, q1, q3) => `중앙값 ${median}, 사분위 ${q1}~${q3}`,
		median: (name, v) => `${name} 중앙값 ${v}`
	}
};
var VS = 48;
function BoxPlot(props) {
	const c = useChart(props, {
		height: (w) => Math.max(200, Math.min(300, w * .55)),
		duration: 850,
		stagger: 90
	});
	const { p, width: W, height: H } = c;
	const variant = props.variant ?? "box";
	const [wa = NaN, wb = NaN] = props.whiskers ?? [];
	const isPct = wa >= 0 && wa <= 100 && wb >= 0 && wb <= 100;
	const wLo = isPct ? Math.min(wa, wb) : void 0;
	const wHi = isPct ? Math.max(wa, wb) : void 0;
	const model = useMemo(() => {
		const gg = strGetter(props.group, "group");
		const gv = numGetter(props.value, "value");
		const allNames = uniq(props.data.map((d, i) => gg(d, i)));
		const by = new Map(allNames.map((n) => [n, []]));
		props.data.forEach((d, i) => {
			const v = gv(d, i);
			if (Number.isFinite(v)) by.get(gg(d, i)).push(v);
		});
		const names = allNames.filter((n) => by.get(n).length > 0);
		const stats = names.map((n) => boxStats(by.get(n), wLo !== void 0 && wHi !== void 0 ? [wLo, wHi] : void 0));
		const [mn, mx] = extent([...by.values()].flat());
		const dom = fitDomain(mn, mx, 4, {
			zero: props.zero ?? false,
			pad: .06
		});
		const ys = Array.from({ length: VS }, (_, k) => dom[0] + (dom[1] - dom[0]) * k / (VS - 1));
		const dens = variant === "box" ? names.map(() => []) : names.map((n) => kde(by.get(n), ys));
		const hi = resolveHighlight(props.highlight, names, names, stats.map((s) => s.median), "max");
		return {
			boxes: names.map((n, g) => ({
				g,
				name: n,
				st: stats[g],
				dens: dens[g],
				hi: hi.has(g)
			})),
			dom,
			ys,
			peak: Math.max(1e-9, ...dens.flat())
		};
	}, [
		props.data,
		props.group,
		props.value,
		props.highlight,
		props.zero,
		variant,
		wLo,
		wHi
	]);
	const tickFmt = makeTickFormatter(props.format, c.locale, Math.max(Math.abs(model.dom[0]), Math.abs(model.dom[1])));
	const ticks = scaleLinear(model.dom, [0, 1]).ticks(Math.max(2, Math.round(H / 70)));
	const left = yAxisWidth(ticks, tickFmt, c.locale);
	const top = 10;
	const bottom = 22;
	const y = scaleLinear(model.dom, [H - bottom, top]);
	const band = scaleBand(model.boxes.map((b) => b.name), [left + 4, W - 4], .35, .15);
	const bw = Math.min(band.bandwidth, 64);
	const stg = c.motion.stagger ?? 90;
	const m = useMotion(useMemo(() => model.boxes.map((b, k) => {
		const med = y(b.st.median);
		const to = [
			y(b.st.q1),
			y(b.st.q3),
			y(b.st.lo),
			y(b.st.hi),
			med,
			1
		];
		return {
			key: `b:${b.name}`,
			to,
			from: [
				med,
				med,
				med,
				med,
				med,
				0
			],
			enter: [
				med,
				med,
				med,
				med,
				med,
				0
			],
			delay: k * stg,
			data: b
		};
	}), [
		model,
		H,
		stg
	]), c.motion);
	const accent = swatch(p, "accent");
	const msg = MSG27[c.lang];
	const events = model.boxes.map((b) => ({
		datum: null,
		index: b.g,
		key: b.name,
		label: b.name,
		value: b.st.median,
		formatted: msg.summary(c.fv(b.st.median), c.fv(b.st.q1), c.fv(b.st.q3))
	}));
	let tip = null;
	if (c.active !== null && model.boxes[c.active]) {
		const b = model.boxes[c.active];
		tip = {
			x: band(b.name) + band.bandwidth / 2,
			y: y(b.st.hi),
			title: b.name,
			rows: [
				{
					label: wHi !== void 0 ? msg.pct(wHi) : msg.max,
					value: c.fv(b.st.hi)
				},
				{
					label: msg.q3,
					value: c.fv(b.st.q3)
				},
				{
					label: msg.med,
					value: c.fv(b.st.median),
					color: b.hi ? accent.fill : p.paint("neutral"),
					strong: true
				},
				{
					label: msg.q1,
					value: c.fv(b.st.q1)
				},
				{
					label: wLo !== void 0 ? msg.pct(wLo) : msg.min,
					value: c.fv(b.st.lo)
				},
				{
					label: msg.n,
					value: msg.count(b.st.n, b.st.outliers.length)
				}
			]
		};
	}
	const kind = variant === "box" ? msg.box : msg.violin;
	const desc = props.description ?? `${kind}. ${model.boxes.map((b) => msg.median(b.name, c.fv(b.st.median))).join(", ")}.`;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			/* @__PURE__ */ jsx(GridY, {
				p,
				ticks,
				y,
				x0: left,
				x1: W,
				fmt: tickFmt,
				locale: c.locale,
				zero: false
			}),
			m.items.map((it) => {
				const b = it.data;
				const [q1, q3, lo, hi, med, o] = it.v;
				const cx = band(b.name) + band.bandwidth / 2;
				const fill = b.hi ? accent.fill : p.paint("neutral");
				const stroke = b.hi ? accent.fill : p.paint("neutralStrong");
				const isA = c.active === b.g;
				const half = variant === "box" ? bw / 2 : bw * .18;
				let violin = null;
				if (variant !== "box") {
					const wmax = Math.min(band.bandwidth / 2, 40);
					const pts2 = model.ys.map((v, k) => [cx + b.dens[k] / model.peak * wmax * o, y(v)]);
					const back = [...pts2].reverse().map(([px, py]) => [cx - (px - cx), py]);
					violin = `M${pts2.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join("L")}L${back.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join("L")}Z`;
				}
				return /* @__PURE__ */ jsxs("g", {
					className: "ztd-mark",
					opacity: it.exiting ? .4 : c.dim(b.g),
					onPointerEnter: (e) => c.setActive(b.g, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(b.g),
					children: [
						/* @__PURE__ */ jsx("rect", {
							x: cx - band.step / 2,
							y: top,
							width: band.step,
							height: H - top - bottom,
							fill: "transparent"
						}),
						violin ? /* @__PURE__ */ jsx("path", {
							d: violin,
							fill,
							fillOpacity: b.hi ? .85 : .9,
							stroke,
							strokeWidth: 1
						}) : null,
						/* @__PURE__ */ jsx("line", {
							x1: cx,
							x2: cx,
							y1: hi,
							y2: q3,
							stroke: p.paint(b.hi && variant === "box" ? "accent" : "dim"),
							strokeWidth: 1.4
						}),
						/* @__PURE__ */ jsx("line", {
							x1: cx,
							x2: cx,
							y1: q1,
							y2: lo,
							stroke: p.paint(b.hi && variant === "box" ? "accent" : "dim"),
							strokeWidth: 1.4
						}),
						variant === "box" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("line", {
							x1: cx - bw * .22,
							x2: cx + bw * .22,
							y1: hi,
							y2: hi,
							stroke: p.paint("dim"),
							strokeWidth: 1.4
						}), /* @__PURE__ */ jsx("line", {
							x1: cx - bw * .22,
							x2: cx + bw * .22,
							y1: lo,
							y2: lo,
							stroke: p.paint("dim"),
							strokeWidth: 1.4
						})] }) : null,
						/* @__PURE__ */ jsx("path", {
							d: roundRectPath(cx - half, Math.min(q1, q3), half * 2, Math.abs(q1 - q3), Math.min(4, half / 2)),
							fill: variant === "box" ? fill : p.paint(b.hi ? "onAccent" : "ink"),
							fillOpacity: variant === "box" ? 1 : .9,
							stroke: isA && c.via === "keyboard" ? p.paint("ink") : "none",
							strokeWidth: 2
						}),
						/* @__PURE__ */ jsx("line", {
							x1: cx - half,
							x2: cx + half,
							y1: med,
							y2: med,
							stroke: variant === "box" ? p.paint(b.hi ? "onAccent" : "ink") : p.paint(b.hi ? "accent" : "panel"),
							strokeWidth: 2.2
						}),
						props.outliers !== false ? b.st.outliers.map((v, k) => /* @__PURE__ */ jsx("circle", {
							cx,
							cy: y(v),
							r: 2.6,
							fill: "none",
							stroke: p.paint(b.hi ? "accent" : "neutralStrong"),
							strokeWidth: 1.3,
							opacity: o
						}, k)) : null
					]
				}, it.key);
			}),
			/* @__PURE__ */ jsx(AxisXBand, {
				p,
				labels: model.boxes.map((b) => b.name),
				centers: model.boxes.map((b) => band(b.name) + band.bandwidth / 2),
				y: H - bottom + 13,
				strong: new Set(model.boxes.filter((b) => b.hi).map((b) => b.g))
			})
		]
	});
}
var MSG28 = {
	en: {
		kind: "Parallel coordinates",
		nth: (i) => `#${i}`,
		desc: (rows, axes, names) => `${plural(rows, "row")}, ${plural(axes, "axis", "axes")} (${names})`
	},
	ko: {
		kind: "평행 좌표",
		nth: (i) => `${i}번`,
		desc: (rows, axes, names) => `행 ${rows}개, 축 ${axes}개(${names})`
	}
};
function traceGapped(ys, xAt, move, line) {
	let pen = false;
	ys.forEach((yy, j) => {
		if (!Number.isFinite(yy)) {
			pen = false;
			return;
		}
		(pen ? line : move)(xAt(j), yy);
		pen = true;
	});
}
function ParallelCoordinates(props) {
	const c = useChart(props, {
		height: (w) => Math.max(220, Math.min(320, w * .55)),
		duration: 1e3
	});
	const { p, width: W, height: H } = c;
	const msg = MSG28[c.lang];
	const dims = useMemo(() => {
		if (props.dimensions?.length) return props.dimensions;
		const first = props.data[0];
		if (!first) return [];
		return Object.keys(first).filter((k) => props.data.slice(0, 20).every((d) => Number.isFinite(toNumber(d[k]))));
	}, [props.data, props.dimensions]);
	const rows = useMemo(() => {
		const gl = strGetter(props.label, "label");
		return props.data.map((d, i) => ({
			d,
			i,
			label: gl(d, i),
			vals: dims.map((k) => toNumber(d[k]))
		}));
	}, [
		props.data,
		dims,
		props.label
	]);
	const n = rows.length;
	const useCanvas = c.hydrated && n > (props.canvasThreshold ?? 1500);
	const doms = useMemo(() => dims.map((_, j) => fitDomain(...extent(rows.map((r) => r.vals[j])), 4, {
		zero: false,
		pad: .02
	})), [dims, rows]);
	const fmts = useMemo(() => dims.map((k) => makeFormatter(props.formats?.[k], c.locale)), [
		dims,
		props.formats,
		c.locale
	]);
	const hi = useMemo(() => resolveHighlight(props.highlight, rows.map((r) => r.d), rows.map((r) => r.label), rows.map((r) => r.vals[0] ?? 0), "first"), [rows, props.highlight]);
	const labelR = Math.min(W * .18, Math.max(...rows.filter((r) => hi.has(r.i)).map((r) => textWidth(r.label, 11, 800)), 0) + 14);
	const bottom = 18;
	const dimName = (k) => props.dimensionLabels?.[k] ?? k;
	const nameW = dims.map((k) => textWidth(dimName(k), 11, 700));
	const firstW = nameW[0] ?? 0;
	const lastW = nameW[nameW.length - 1] ?? 0;
	const x0 = Math.max(24, Math.min(W * .15, firstW / 2 + 4));
	const x1 = W - Math.max(24, labelR, Math.min(W * .15, lastW / 2 + 4));
	const gapX = dims.length > 1 ? (x1 - x0) / (dims.length - 1) : 128;
	const stagger = dims.length > 2 && nameW.some((w) => w > gapX - 8);
	const top = stagger ? 44 : 30;
	const axX = (j) => dims.length > 1 ? x0 + j * (x1 - x0) / (dims.length - 1) : (x0 + x1) / 2;
	const scales = useMemo(() => doms.map((dm, j) => scaleLinear(dm, props.invert?.includes(dims[j]) ? [top, H - bottom] : [H - bottom, top])), [
		doms,
		H,
		dims,
		props.invert,
		top
	]);
	const lines = useMemo(() => rows.map((r) => ({
		i: r.i,
		label: r.label,
		vals: r.vals,
		ys: r.vals.map((v, j) => Number.isFinite(v) ? scales[j](v) : NaN),
		hi: hi.has(r.i),
		datum: r.d
	})), [
		rows,
		scales,
		hi
	]);
	const order = useMemo(() => [...lines].sort((a, b) => Number(a.hi) - Number(b.hi)), [lines]);
	const D = c.motion.duration ?? 1e3;
	const m = useMotion(useMemo(() => {
		if (useCanvas) return [{
			key: "__p",
			to: [1],
			from: [0],
			data: null
		}];
		return order.map((l, k) => ({
			key: `p:${l.i}`,
			to: [1, ...l.ys],
			from: [0, ...l.ys],
			enter: [0, ...l.ys],
			parts: [1, l.ys.length],
			delay: l.hi ? D * .35 : k / Math.max(1, order.length) * D * .3,
			data: l
		}));
	}, [
		order,
		useCanvas,
		D
	]), c.motion);
	const accent = swatch(p, "accent");
	const nearest = (px, py) => {
		if (dims.length < 2) return null;
		let j = 0;
		while (j < dims.length - 2 && px > axX(j + 1)) j++;
		const t = Math.max(0, Math.min(1, (px - axX(j)) / (axX(j + 1) - axX(j) || 1)));
		let best = -1;
		let bd = Infinity;
		for (const l of lines) {
			const a = l.ys[j];
			const b = l.ys[j + 1];
			if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
			const d = Math.abs(a + (b - a) * t - py);
			if (d < bd) {
				bd = d;
				best = l.i;
			}
		}
		return bd < 10 ? best : null;
	};
	const dimLabels = props.dimensionLabels;
	const events = useMemo(() => lazyArray(lines.length, (k) => {
		const l = lines[k];
		return {
			datum: l.datum,
			index: l.i,
			key: `${l.i}`,
			label: l.label || msg.nth(l.i + 1),
			value: l.vals[0] ?? null,
			formatted: dims.map((d, j) => `${dimLabels?.[d] ?? d} ${fmts[j](l.vals[j])}`).join(", ")
		};
	}), [
		lines,
		dims,
		dimLabels,
		fmts,
		msg
	]);
	let tip = null;
	if (c.active !== null && lines[c.active]) {
		const l = lines[c.active];
		tip = {
			x: axX(Math.floor((dims.length - 1) / 2)),
			y: Math.min(...l.ys.filter(Number.isFinite)),
			title: l.label || msg.nth(l.i + 1),
			rows: dims.map((k, j) => ({
				label: props.dimensionLabels?.[k] ?? k,
				value: fmts[j](l.vals[j])
			}))
		};
	}
	const prog = useCanvas ? m.get("__p")?.[0] ?? 1 : 1;
	const draw = useCallback((ctx, _t, color) => {
		const neu = color("--ztd-neutral-strong", p.theme.neutralStrong);
		const acc = color("--ztd-accent", p.theme.accent);
		ctx.save();
		ctx.lineWidth = 1;
		ctx.strokeStyle = neu;
		ctx.globalAlpha = Math.max(.04, Math.min(.35, 60 / Math.max(1, lines.length)));
		ctx.beginPath();
		for (const l of lines) {
			if (l.hi) continue;
			traceGapped(l.ys, axX, (x, y) => ctx.moveTo(x, y), (x, y) => ctx.lineTo(x, y));
		}
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.lineWidth = 2.4;
		ctx.strokeStyle = acc;
		for (const l of lines) {
			if (!l.hi) continue;
			ctx.beginPath();
			traceGapped(l.ys, axX, (x, y) => ctx.moveTo(x, y), (x, y) => ctx.lineTo(x, y));
			ctx.stroke();
		}
		ctx.restore();
	}, [
		lines,
		x0,
		x1,
		H,
		p.theme.neutralStrong,
		p.theme.accent,
		dims.length
	]);
	const desc = props.description ?? `${msg.kind}. ${msg.desc(n, dims.length, dims.map((k) => props.dimensionLabels?.[k] ?? k).join(", "))}.`;
	const path = (ys) => {
		let d = "";
		traceGapped(ys, axX, (x, y) => d += `M${x.toFixed(1)},${y.toFixed(1)}`, (x, y) => d += `L${x.toFixed(1)},${y.toFixed(1)}`);
		return d;
	};
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, py, e) => {
			const k = nearest(px, py);
			if (k !== c.active) c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer");
		},
		underlay: useCanvas ? /* @__PURE__ */ jsx(CanvasLayer, {
			width: W,
			height: H,
			draw,
			progress: 1,
			version: c.sig,
			clipRight: prog >= 1 ? 0 : Math.max(0, W - (x0 + (x1 - x0 + 2) * prog))
		}) : void 0,
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: x0,
				y: top,
				width: Math.max(0, x1 - x0),
				height: H - top - bottom,
				fill: "transparent"
			}),
			!useCanvas ? m.items.map((it) => {
				const l = it.data;
				if (!l) return null;
				const t = it.v[0];
				const ys = it.v.slice(1);
				const isA = c.active === l.i;
				const dash = t < .999;
				return /* @__PURE__ */ jsx("path", {
					d: path(ys),
					fill: "none",
					stroke: l.hi ? accent.fill : isA ? p.paint("ink") : p.paint("neutralStrong"),
					strokeOpacity: l.hi || isA ? 1 : c.active === null ? .55 : .25,
					strokeWidth: l.hi ? 2.6 : isA ? 2 : 1.3,
					strokeLinejoin: "round",
					pathLength: dash ? 1 : void 0,
					strokeDasharray: dash ? "1 1" : void 0,
					strokeDashoffset: dash ? 1 - t : void 0,
					pointerEvents: "none"
				}, it.key);
			}) : c.active !== null && lines[c.active] ? /* @__PURE__ */ jsx("path", {
				d: path(lines[c.active].ys),
				fill: "none",
				stroke: p.paint("ink"),
				strokeWidth: 2,
				pointerEvents: "none"
			}) : null,
			/* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: dims.map((k, j) => {
					const xx = axX(j);
					const [lo, hiV] = doms[j];
					const inv = props.invert?.includes(k);
					const name = dimName(k);
					const room = stagger ? Math.min(2 * gapX, 2 * Math.min(xx, W - xx)) - 8 : gapX - 8;
					return /* @__PURE__ */ jsxs("g", { children: [
						/* @__PURE__ */ jsx("line", {
							x1: xx,
							x2: xx,
							y1: top,
							y2: H - bottom,
							stroke: p.paint("dim"),
							strokeWidth: 1
						}),
						/* @__PURE__ */ jsx(Txt, {
							x: xx,
							y: stagger && j % 2 ? 23 : 9,
							anchor: "middle",
							size: 11,
							weight: 700,
							fill: p.paint("ink"),
							children: truncate(name, room, 11, 700)
						}),
						/* @__PURE__ */ jsx(Txt, {
							x: xx + 4,
							y: top - 9,
							anchor: "start",
							size: 9.5,
							fill: p.paint("muted"),
							children: fmts[j](inv ? lo : hiV)
						}),
						/* @__PURE__ */ jsx(Txt, {
							x: xx + 4,
							y: H - bottom + 9,
							anchor: "start",
							size: 9.5,
							fill: p.paint("muted"),
							children: fmts[j](inv ? hiV : lo)
						})
					] }, k);
				})
			}),
			c.showLabels && n <= 60 ? lines.filter((l) => l.hi || c.active === l.i).map((l) => /* @__PURE__ */ jsx(Txt, {
				x: x1 + 8,
				y: l.ys[l.ys.length - 1],
				size: 11,
				weight: 800,
				fill: p.paint("ink"),
				opacity: m.fade(D * .8, 300),
				children: truncate(l.label, labelR - 10, 11, 800)
			}, l.i)) : null
		]
	});
}
var CANDLE_TEXT = {
	en: {
		name: "Candlestick chart",
		open: "Open",
		high: "High",
		low: "Low",
		close: "Close",
		change: "Change",
		volume: "Volume",
		empty: "No data.",
		ohlc: (o, h, l, c) => `open ${o}, high ${h}, low ${l}, close ${c}`,
		/** 고른 구간을 읽어 줄 때 앞부분 */
		span: (from, to, change) => `${from} to ${to}: ${change}`,
		desc: (from, to, n, open, close) => `${from} to ${to}, ${plural(n, "candle")}. First open ${open}, last close ${close}`,
		/** 이동평균선 이름표 */
		ma: (d) => `MA${d}`,
		/** 카드 범례(card.legend: "auto")의 상승, 하락, 이동평균선 */
		up: "Up",
		down: "Down",
		maLegend: (d) => `${d}-day MA`
	},
	ko: {
		name: "캔들스틱",
		open: "시가",
		high: "고가",
		low: "저가",
		close: "종가",
		change: "등락률",
		volume: "거래량",
		empty: "데이터가 없어요.",
		ohlc: (o, h, l, c) => `시가 ${o}, 고가 ${h}, 저가 ${l}, 종가 ${c}`,
		span: (from, to, change) => `${from}부터 ${to}까지 ${change}`,
		desc: (from, to, n, open, close) => `${from}부터 ${to}까지 ${n}개 봉. 첫 시가 ${open}, 마지막 종가 ${close}`,
		ma: (d) => `${d}일선`,
		up: "상승",
		down: "하락",
		maLegend: (d) => `${d}일 이동평균`
	}
};
var MA_TOKENS = [
	"ink",
	"muted",
	"dim"
];
function maPeriods(ma, count) {
	return (ma ?? []).filter((d) => d >= 2 && d < count).slice(0, MA_TOKENS.length);
}
function toCandles(data, props, locale) {
	const gx = getter(props.x, "date");
	const go = numGetter(props.open, "open");
	const gh = numGetter(props.high, "high");
	const gl = numGetter(props.low, "low");
	const gc = numGetter(props.close, "close");
	const gv = props.volume === void 0 ? null : numGetter(props.volume, "volume");
	const raw = data.map((d, i) => {
		const xv = gx(d, i);
		const dt = typeof xv === "number" && Math.abs(xv) <= 1e10 || typeof xv === "string" && /^\d{4}$/.test(xv.trim()) ? null : toDate(xv);
		return {
			d,
			i,
			xv,
			dt,
			t: dt ? dt.getTime() : i,
			c: gc(d, i),
			o: go(d, i),
			h: gh(d, i),
			l: gl(d, i),
			v: gv ? gv(d, i) : NaN
		};
	});
	const dated = raw.every((r) => r.dt);
	const rows = raw.filter((r) => Number.isFinite(r.c));
	if (dated) rows.sort((a, b) => a.t - b.t);
	const out = [];
	const keys = /* @__PURE__ */ new Set();
	let prev = NaN;
	rows.forEach((r, k) => {
		const o = Number.isFinite(r.o) ? r.o : Number.isFinite(prev) ? prev : r.c;
		const h = Math.max(o, r.c, Number.isFinite(r.h) ? r.h : -Infinity);
		const l = Math.min(o, r.c, Number.isFinite(r.l) ? r.l : Infinity);
		const label = r.dt ? formatDate(r.dt, {
			locale,
			year: "numeric",
			month: "short",
			day: "numeric"
		}) : String(r.xv ?? k + 1);
		let key = r.dt ? String(r.t) : String(r.xv);
		if (keys.has(key)) key = `${key}#${k}`;
		keys.add(key);
		out.push({
			i: k,
			span: 1,
			key,
			label,
			t: dated ? r.t : k,
			o,
			h,
			l,
			c: r.c,
			v: r.v,
			datum: r.d
		});
		prev = r.c;
	});
	return {
		candles: out,
		dated
	};
}
function mergeCandles(cs, max) {
	if (cs.length <= max || max < 2) return cs;
	const size = Math.ceil(cs.length / max);
	const out = [];
	for (let a = 0; a < cs.length; a += size) {
		const g = cs.slice(a, a + size);
		const first = g[0];
		const last = g[g.length - 1];
		let h = -Infinity;
		let l = Infinity;
		let v = 0;
		let hasV = false;
		for (const q of g) {
			h = Math.max(h, q.h);
			l = Math.min(l, q.l);
			if (Number.isFinite(q.v)) {
				v += q.v;
				hasV = true;
			}
		}
		out.push({
			i: first.i,
			span: g.reduce((s, q) => s + q.span, 0),
			key: first.key,
			label: g.length > 1 ? `${first.label} ~ ${last.label}` : first.label,
			t: first.t,
			o: first.o,
			h,
			l,
			c: last.c,
			v: hasV ? v : NaN,
			datum: last.datum
		});
	}
	return out;
}
function movingAverage(values, period) {
	const out = new Array(values.length).fill(NaN);
	if (period < 1) return out;
	let sum3 = 0;
	for (let k = 0; k < values.length; k++) {
		sum3 += values[k];
		if (k >= period) sum3 -= values[k - period];
		if (k >= period - 1) out[k] = sum3 / period;
	}
	return out;
}
function CandlestickChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(240, Math.min(340, w * .55)),
		duration: 700,
		format: "number"
	});
	const { p, width: W, height: H } = c;
	const all = useMemo(() => toCandles(props.data, props, c.locale), [
		props.data,
		props.x,
		props.open,
		props.high,
		props.low,
		props.close,
		props.volume,
		c.locale
	]);
	const dated = all.dated;
	const zoom = useZoom(c.sig);
	const view = zoom.view;
	const visible = useMemo(() => view ? all.candles.slice(view[0], view[1] + 1) : all.candles, [all, view]);
	const { up, down } = useMemo(() => {
		const color = (v, fb) => ({
			fill: p.color(v, fb),
			text: readableOn(p, p.raw(v, fb))
		});
		return {
			up: color(props.upColor, "accent"),
			down: color(props.downColor, "neutralStrong")
		};
	}, [
		p,
		props.upColor,
		props.downColor
	]);
	const top = 10;
	const bottom = 22;
	const plotW0 = Math.max(40, W - 56);
	const maxCandles = Math.max(8, Math.round(props.maxCandles ?? plotW0 / 4));
	const { cs, lo, hi, vmax, hasVolume } = useMemo(() => {
		const merged = mergeCandles(visible, maxCandles);
		let l = Infinity;
		let h = -Infinity;
		let v = 0;
		let anyVolume = false;
		for (const q of merged) {
			l = Math.min(l, q.l);
			h = Math.max(h, q.h);
			if (Number.isFinite(q.v)) {
				v = Math.max(v, q.v);
				anyVolume = true;
			}
		}
		const empty = !Number.isFinite(l);
		return {
			cs: merged,
			lo: empty ? 0 : l,
			hi: empty ? 1 : h,
			vmax: v,
			hasVolume: props.volume !== void 0 && anyVolume
		};
	}, [
		visible,
		maxCandles,
		props.volume
	]);
	const n = cs.length;
	const volH = hasVolume ? Math.max(28, (H - top - bottom) * .18) : 0;
	const priceBottom = H - bottom - (hasVolume ? volH + 8 : 0);
	const yCount = Math.max(2, Math.round((priceBottom - top) / 60));
	const noteYs = annotationYs(props.annotations);
	const dom = props.yDomain ?? fitDomain(Math.min(lo, ...noteYs), Math.max(hi, ...noteYs), yCount, { zero: false });
	const tickFmt = makeTickFormatter(props.format, c.locale, 0);
	const yTicks = scaleLinear(dom, [0, 1]).ticks(yCount);
	const right = Math.max(yAxisWidth(yTicks, tickFmt, c.locale), textWidth(tickFmt(hi), 10.5, 700) + 14) + 4;
	const x0 = 4;
	const x1 = W - right;
	const step = n ? (x1 - x0) / n : 1;
	const bodyW = Math.max(1, Math.min(18, step * .64));
	const cx = (k) => x0 + step * (k + .5);
	const y = scaleLinear(dom, [priceBottom, top]);
	const vy = (v) => H - bottom - (vmax > 0 && Number.isFinite(v) ? v / vmax * volH : 0);
	const hiSet = useMemo(() => resolveHighlight(props.highlight, cs.map((q) => q.datum), cs.map((q) => q.label), cs.map((q) => q.c), "last"), [props.highlight, cs]);
	const markK = hiSet.size ? Math.max(...hiSet) : -1;
	const sweep = Math.min(700, 12 * n);
	const m = useMotion(useMemo(() => cs.map((q, k) => {
		const mid = (y(q.o) + y(q.c)) / 2;
		const base = H - bottom;
		return {
			key: q.key,
			to: [
				y(q.o),
				y(q.c),
				y(q.h),
				y(q.l),
				vy(q.v)
			],
			from: [
				mid,
				mid,
				mid,
				mid,
				base
			],
			enter: [
				mid,
				mid,
				mid,
				mid,
				base
			],
			delay: n > 1 ? k / (n - 1) * sweep : 0,
			data: k
		};
	}), [
		cs,
		H,
		dom[0],
		dom[1],
		volH,
		vmax,
		sweep
	]), c.motion);
	const maFull = useMemo(() => {
		const closes = all.candles.map((q) => q.c);
		return maPeriods(props.ma, closes.length).map((d) => ({
			d,
			v: movingAverage(closes, d)
		}));
	}, [props.ma, all]);
	const mas = useMemo(() => maFull.map((ma) => ({
		d: ma.d,
		v: cs.map((q) => ma.v[q.i + q.span - 1])
	})), [maFull, cs]);
	const maPaths = useMemo(() => mas.map((ma) => {
		let d = "";
		ma.v.forEach((v, k) => {
			if (Number.isFinite(v)) d += `${d ? "L" : "M"}${cx(k).toFixed(1)},${y(v).toFixed(1)}`;
		});
		return d;
	}), [
		mas,
		x1,
		priceBottom,
		dom[0],
		dom[1]
	]);
	const fv = c.fv;
	const msg = CANDLE_TEXT[c.lang];
	const events = useMemo(() => cs.map((q, k) => ({
		datum: q.datum,
		index: k,
		key: q.key,
		label: q.label,
		value: q.c,
		formatted: msg.ohlc(fv(q.o), fv(q.h), fv(q.l), fv(q.c))
	})), [
		cs,
		fv,
		msg
	]);
	const prevClose = (k) => k > 0 ? cs[k - 1].c : NaN;
	const indexAt = (px) => Math.max(0, Math.min(n - 1, Math.floor((px - x0) / step)));
	const { brush, frame: brushFrame, hint, text: brushText } = useChartBrush(props, zoom, {
		p,
		active: c.active,
		lang: c.lang,
		count: n,
		indexAt,
		inPlot: (px, py) => px >= x0 && px <= x1 && py >= top && py <= H - bottom,
		toXRange: (r) => {
			const a = cs[r.from];
			const b = cs[r.to];
			return {
				from: a.i,
				to: b.i + b.span - 1,
				fromKey: a.key,
				toKey: b.key,
				fromLabel: a.label,
				toLabel: b.label
			};
		}
	});
	useSync(c, props.syncId, cs.map((q) => q.key), cs.map((q) => q.label));
	let tip = null;
	if (c.active !== null && cs[c.active] && !brush.dragging) {
		const q = cs[c.active];
		const ch = changeRatio(prevClose(c.active), q.c);
		const col = q.c >= q.o ? up.fill : down.fill;
		tip = {
			x: cx(c.active),
			y: y(q.h),
			title: q.label,
			rows: [
				{
					label: msg.open,
					value: c.fv(q.o),
					strong: false
				},
				{
					label: msg.high,
					value: c.fv(q.h),
					strong: false
				},
				{
					label: msg.low,
					value: c.fv(q.l),
					strong: false
				},
				{
					label: msg.close,
					value: c.fv(q.c),
					color: col
				},
				...ch !== null ? [{
					label: msg.change,
					value: signedPercent(ch, c.locale)
				}] : [],
				...Number.isFinite(q.v) ? [{
					label: msg.volume,
					value: c.fmt(q.v),
					strong: false
				}] : []
			]
		};
	}
	let brushLayer = null;
	let announce;
	if (brush.range && brush.range.to < n) {
		const { from, to } = brush.range;
		let maxK = from;
		let minK = from;
		for (let k = from; k <= to; k++) {
			if (cs[k].h > cs[maxK].h) maxK = k;
			if (cs[k].l < cs[minK].l) minK = k;
		}
		const ratio = changeRatio(cs[from].o, cs[to].c);
		const main = ratio !== null ? signedPercent(ratio, c.locale) : "-";
		const short = (q) => dated ? formatDate(q.t, {
			locale: c.locale,
			month: "short",
			day: "numeric"
		}) : q.label;
		const sub = brushText.range(short(cs[from]), short(cs[to]));
		brushLayer = /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(BrushBand, {
			p,
			x0: cx(from) - step / 2,
			x1: cx(to) + step / 2,
			top,
			bottom: H - bottom,
			width: W,
			main,
			sub,
			dragging: brush.dragging
		}), /* @__PURE__ */ jsx(ExtremeTags, {
			p,
			lang: c.lang,
			width: W,
			top,
			bottom: priceBottom,
			max: {
				x: cx(maxK),
				y: y(cs[maxK].h),
				text: c.fv(cs[maxK].h)
			},
			min: {
				x: cx(minK),
				y: y(cs[minK].l),
				text: c.fv(cs[minK].l)
			}
		})] });
		if (!brush.dragging) announce = `${msg.span(cs[from].label, cs[to].label, main)}${brushText.extremes(c.fv(cs[maxK].h), c.fv(cs[minK].l))}.${hint}`;
	}
	const last = markK >= 0 ? cs[markK] : null;
	const tagY = last ? Math.max(18, Math.min(priceBottom - 8, y(last.c))) : null;
	let lastTag = null;
	if (last && tagY !== null) {
		const col = last.c >= last.o ? up : down;
		const text = tickFmt(last.c);
		const tw = textWidth(text, 10.5, 700) + 10;
		lastTag = /* @__PURE__ */ jsxs("g", {
			pointerEvents: "none",
			opacity: m.fade(sweep + 200, 300),
			"aria-hidden": "true",
			children: [
				/* @__PURE__ */ jsx("line", {
					x1: x0,
					x2: x1,
					y1: y(last.c),
					y2: y(last.c),
					stroke: col.fill,
					strokeWidth: 1,
					strokeDasharray: "2 3",
					opacity: .85
				}),
				/* @__PURE__ */ jsx("rect", {
					x: x1 + 3,
					y: tagY - 9,
					width: tw,
					height: 18,
					rx: 5,
					fill: col.fill
				}),
				/* @__PURE__ */ jsx(Txt, {
					x: x1 + 3 + tw / 2,
					y: tagY,
					anchor: "middle",
					size: 10.5,
					weight: 700,
					fill: col.text,
					children: text
				})
			]
		});
	}
	const xTicks = useMemo(() => {
		const ticks = [];
		if (n > 1) {
			const maxT = Math.max(2, Math.floor((x1 - x0) / 80));
			if (dated) {
				let kk = 0;
				for (const tk of timeTicks(cs[0].t, cs[n - 1].t, maxT, c.locale)) {
					while (kk < n - 1 && cs[kk + 1].t <= tk.t) kk++;
					ticks.push({
						x: cx(kk),
						label: tk.label
					});
				}
			} else {
				const every = Math.max(1, Math.ceil(n / maxT));
				for (let k = 0; k < n; k += every) ticks.push({
					x: cx(k),
					label: cs[k].label
				});
			}
		}
		return fitTickLabels(ticks, 0, x1 + 2);
	}, [
		cs,
		dated,
		x1,
		c.locale
	]);
	const autoDesc = useMemo(() => {
		if (!n) return `${msg.name}. ${msg.empty}`;
		const ch = changeRatio(cs[0].o, cs[n - 1].c);
		return `${msg.name}. ${msg.desc(cs[0].label, cs[n - 1].label, n, fv(cs[0].o), fv(cs[n - 1].c))}${ch !== null ? ` (${signedPercent(ch, c.locale)})` : ""}${brushText.extremes(fv(hi), fv(lo))}.`;
	}, [
		cs,
		n,
		lo,
		hi,
		fv,
		c.locale,
		msg,
		brushText
	]);
	const maColors = MA_TOKENS.map((t) => p.paint(t));
	const per = n > 1 ? (cs[n - 1].t - cs[0].t) / (n - 1) || 1 : 1;
	const xAtTime = (t) => {
		if (t <= cs[0].t) return cx(0) - (cs[0].t - t) / per * step;
		if (t >= cs[n - 1].t) return cx(n - 1) + (t - cs[n - 1].t) / per * step;
		let a = 0;
		let b = n - 1;
		while (b - a > 1) {
			const mid = a + b >> 1;
			if (cs[mid].t <= t) a = mid;
			else b = mid;
		}
		return cx(a) + (t - cs[a].t) / (cs[b].t - cs[a].t || 1) * step;
	};
	const kOf = (val) => {
		const t = dated ? toDate(val)?.getTime() : void 0;
		return cs.findIndex((q) => dated ? q.t === t : q.key === String(val) || q.label === String(val));
	};
	const xAt = (val) => {
		if (!n) return null;
		if (dated) {
			const d = toDate(val);
			return d ? xAtTime(d.getTime()) : null;
		}
		const k = kOf(val);
		return k < 0 ? null : cx(k);
	};
	const xText = (val) => cs[kOf(val)]?.label ?? String(val ?? "");
	const ag = {
		p,
		lang: c.lang,
		xAt,
		half: step / 2,
		y,
		x0,
		x1,
		top: top + (mas.length ? 14 : 0),
		bottom: priceBottom,
		time: dated && n > 1 ? {
			t0: cs[0].t,
			t1: cs[n - 1].t,
			n,
			xt: xAtTime
		} : void 0,
		points: () => cs.map((q, k) => ({
			x: cx(k),
			y: y(q.c)
		}))
	};
	const maK = c.active !== null && cs[c.active] ? c.active : n - 1;
	let maX = 6;
	const maLabels = mas.map((ma, mi) => {
		const text = `${msg.ma(ma.d)} ${Number.isFinite(ma.v[maK]) ? tickFmt(ma.v[maK]) : "-"}`;
		const node = /* @__PURE__ */ jsx(Txt, {
			x: maX,
			y: 12,
			size: 10,
			weight: 700,
			fill: maColors[mi],
			children: text
		}, ma.d);
		maX += textWidth(text, 10, 700) + 10;
		return node;
	});
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.name,
		ariaLabel: props.ariaLabel,
		description: props.description ?? `${autoDesc}${describeAnnotations(props.annotations, c.lang, c.fv, xText)}`,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		onPointerMove: (px, _py, e) => {
			if (!n) return;
			brush.move(px);
			c.setActive(indexAt(px), e.pointerType === "touch" ? "touch" : "pointer");
		},
		...brushFrame,
		announce,
		children: [
			/* @__PURE__ */ jsx(GridY, {
				p,
				ticks: yTicks,
				y,
				x0,
				x1,
				fmt: tickFmt,
				locale: c.locale,
				side: "right",
				zero: false,
				labels: false
			}),
			/* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: tickLabels(yTicks, tickFmt, c.locale).map((label, i) => tagY !== null && Math.abs(y(yTicks[i]) - tagY) < 14 ? null : /* @__PURE__ */ jsx(Txt, {
					x: x1 + 6,
					y: Math.round(y(yTicks[i])) + .5,
					size: AXIS_FONT,
					fill: p.paint("muted"),
					children: label
				}, yTicks[i]))
			}),
			/* @__PURE__ */ jsx("rect", {
				x: x0,
				y: top,
				width: Math.max(0, x1 - x0),
				height: Math.max(0, H - bottom - top),
				fill: "transparent"
			}),
			/* @__PURE__ */ jsx(AnnotationsUnder, {
				list: props.annotations,
				g: ag
			}),
			hasVolume ? /* @__PURE__ */ jsx("line", {
				x1: x0,
				x2: x1,
				y1: H - bottom + .5,
				y2: H - bottom + .5,
				stroke: p.paint("line")
			}) : null,
			m.items.map((it) => {
				const k = it.data;
				const q = cs[k];
				if (!q) return null;
				const [yo, yc, yh, yl, yv] = it.v;
				const col = q.c >= q.o ? up.fill : down.fill;
				const xx = cx(k);
				const bodyTop = Math.min(yo, yc);
				const bodyH = Math.max(1, Math.abs(yc - yo));
				const dimmed = c.active !== null && c.active !== k ? .55 : 1;
				return /* @__PURE__ */ jsxs("g", {
					opacity: it.exiting ? .3 : dimmed,
					children: [
						hasVolume && Number.isFinite(q.v) ? /* @__PURE__ */ jsx("rect", {
							x: xx - bodyW / 2,
							y: yv,
							width: bodyW,
							height: Math.max(0, H - bottom - yv),
							fill: col,
							opacity: .32
						}) : null,
						/* @__PURE__ */ jsx("line", {
							x1: xx,
							x2: xx,
							y1: yh,
							y2: yl,
							stroke: col,
							strokeWidth: 1
						}),
						/* @__PURE__ */ jsx("rect", {
							x: xx - bodyW / 2,
							y: bodyTop,
							width: bodyW,
							height: bodyH,
							rx: bodyW >= 6 ? 1.5 : 0,
							fill: col
						})
					]
				}, it.key);
			}),
			maPaths.map((d, mi) => d ? /* @__PURE__ */ jsx("path", {
				d,
				fill: "none",
				stroke: maColors[mi],
				strokeWidth: mi === 0 ? 1.4 : 1.2,
				strokeLinejoin: "round",
				opacity: m.fade(sweep, 400) * .9,
				pointerEvents: "none"
			}, mas[mi].d) : null),
			mas.length > 0 ? /* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				opacity: m.fade(sweep, 400),
				children: maLabels
			}) : null,
			/* @__PURE__ */ jsx(AnnotationsOver, {
				list: props.annotations,
				g: ag
			}),
			lastTag,
			c.active !== null && cs[c.active] && !brush.dragging ? /* @__PURE__ */ jsx(HoverLine, {
				p,
				x: cx(c.active),
				top,
				bottom: H - bottom,
				dots: [{
					k: 0,
					y: y(cs[c.active].c),
					color: cs[c.active].c >= cs[c.active].o ? up.fill : down.fill,
					strong: true
				}]
			}) : null,
			brushLayer,
			/* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: xTicks.map((t, i) => /* @__PURE__ */ jsx(Txt, {
					x: t.x,
					y: H - bottom + 13,
					anchor: "middle",
					size: AXIS_FONT,
					fill: p.paint("muted"),
					children: t.label
				}, i))
			}),
			c.active !== null && cs[c.active] && !brush.dragging ? /* @__PURE__ */ jsx(AxisPill, {
				p,
				x: cx(c.active),
				y: H - bottom + 13,
				label: cs[c.active].label,
				width: W
			}) : null
		]
	});
}
var MSG29 = {
	en: {
		kind: "Segmented bar",
		share: "Share",
		total: "Total"
	},
	ko: {
		kind: "비율 막대",
		share: "비중",
		total: "합계"
	}
};
var GAP2 = 2;
var ROW_H = 26;
function listColumns(width, n) {
	return width >= 420 && n >= 4 ? 2 : 1;
}
function SegmentedBar(props) {
	const tall = props.variant !== "thin";
	const barH = tall ? 28 : 8;
	const withList = props.list !== false;
	const n0 = props.data.length;
	const c = useChart(props, {
		height: (w) => barH + 4 + (withList ? 18 + Math.ceil(n0 / listColumns(w, n0)) * ROW_H : 0),
		duration: 800,
		stagger: 70,
		format: "number"
	});
	const { p, width: W, pct } = c;
	const msg = MSG29[c.lang];
	const { parts, total } = useMemo(() => {
		const gl = strGetter(props.label, "label");
		const gv = numGetter(props.value, "value");
		const rows = props.data.map((d, i) => ({
			d,
			i,
			label: gl(d, i),
			value: Math.max(0, gv(d, i) || 0)
		}));
		const ordered = props.sort === false ? rows : [...rows].sort((a, b) => b.value - a.value);
		const total2 = ordered.reduce((s, r3) => s + r3.value, 0);
		const hi = resolveHighlight(props.highlight, ordered.map((r3) => r3.d), ordered.map((r3) => r3.label), ordered.map((r3) => r3.value), "max");
		const colors = categorical(p, ordered.length, hi);
		return {
			parts: ordered.map((r3, k) => {
				const share = total2 > 0 ? r3.value / total2 : 0;
				return {
					i: r3.i,
					label: r3.label,
					value: r3.value,
					share,
					pct: pct(share * 100),
					sw: colors[k],
					hi: hi.has(k),
					datum: r3.d
				};
			}),
			total: total2
		};
	}, [
		props.data,
		props.label,
		props.value,
		props.sort,
		props.highlight,
		p,
		pct
	]);
	const layout = useMemo(() => {
		const drawn = parts.filter((q) => q.share > 0);
		const room = Math.max(0, W - GAP2 * Math.max(0, drawn.length - 1));
		let cursor = 0;
		return drawn.map((q) => {
			const w = room * q.share;
			const g = {
				q,
				key: `s:${q.label}`,
				x: cursor,
				w
			};
			cursor += w + GAP2;
			return g;
		});
	}, [parts, W]);
	const geo = useMemo(() => new Map(layout.map((g) => [g.q.i, g])), [layout]);
	const stg = c.motion.stagger ?? 70;
	const m = useMotion(useMemo(() => layout.map((g, k) => ({
		key: g.key,
		to: [g.x, g.w],
		from: [g.x, 0],
		enter: [g.x, 0],
		delay: k * stg,
		data: g.q.i
	})), [layout, stg]), c.motion);
	const index = useMemo(() => new Map(parts.map((q, k) => [q.i, k])), [parts]);
	const fv = c.fv;
	const events = useMemo(() => parts.map((q, k) => ({
		datum: q.datum,
		index: k,
		key: q.label,
		label: q.label,
		value: q.value,
		formatted: `${fv(q.value)} (${q.pct})`
	})), [parts, fv]);
	const top = 2;
	let tip = null;
	if (c.active !== null && parts[c.active]) {
		const q = parts[c.active];
		const g = geo.get(q.i);
		if (g) tip = {
			x: g.x + g.w / 2,
			y: top,
			title: q.label,
			rows: [{
				label: c.t.value,
				value: c.fv(q.value),
				color: q.sw.fill
			}, {
				label: msg.share,
				value: q.pct
			}]
		};
	}
	const cols = listColumns(W, parts.length);
	const colW = W / cols;
	const listTop = top + barH + 18;
	const desc = props.description ?? `${msg.kind}. ${msg.total} ${c.fv(total)}. ${parts.map((q) => `${q.label} ${q.pct}`).join(", ")}.`;
	const r = tall ? 4 : barH / 2;
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			layout.length ? null : /* @__PURE__ */ jsx("rect", {
				x: 0,
				y: top,
				width: W,
				height: barH,
				rx: r,
				fill: p.paint("neutralSoft")
			}),
			m.items.map((it) => {
				const k = index.get(it.data) ?? 0;
				const q = parts[k];
				if (!q) return null;
				const [x, w] = it.v;
				if (w < .5) return null;
				const fits = tall && c.showLabels && w >= textWidth(q.pct, 11, 700) + 14;
				return /* @__PURE__ */ jsxs("g", {
					className: "ztd-mark",
					opacity: it.exiting ? .4 : c.dim(k),
					onPointerEnter: (e) => c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(k),
					style: { cursor: props.onClick ? "pointer" : void 0 },
					children: [
						/* @__PURE__ */ jsx("path", {
							d: roundRectPath(x, top, w, barH, Math.min(r, w / 2)),
							fill: q.sw.fill
						}),
						c.active === k && c.via === "keyboard" ? /* @__PURE__ */ jsx("path", {
							d: roundRectPath(x - 2, 0, w + 4, barH + 4, Math.min(r + 2, w / 2 + 2)),
							fill: "none",
							stroke: p.paint("ink"),
							strokeWidth: 2
						}) : null,
						fits ? /* @__PURE__ */ jsx(Txt, {
							x: x + 8,
							y: top + barH / 2,
							size: 11,
							weight: 700,
							fill: q.sw.text,
							opacity: m.fade(k * stg + 300, 240),
							children: q.pct
						}) : null
					]
				}, it.key);
			}),
			withList ? parts.map((q, k) => {
				const col = k % cols;
				const row = Math.floor(k / cols);
				const x = col * colW;
				const y = listTop + row * ROW_H;
				const right = x + colW - (cols > 1 && col === 0 ? 16 : 0);
				const shareText = q.pct;
				const valueText = c.fv(q.value);
				const shareW = textWidth(shareText, 11.5, 500);
				const valueW = textWidth(valueText, 12, q.hi ? 800 : 600);
				const labelMax = right - x - 18 - shareW - valueW - 18;
				return /* @__PURE__ */ jsxs("g", {
					opacity: c.dim(k),
					onPointerEnter: (e) => c.setActive(k, e.pointerType === "touch" ? "touch" : "pointer"),
					onClick: () => c.click(k),
					children: [
						/* @__PURE__ */ jsx("rect", {
							x,
							y: y - ROW_H / 2 + 2,
							width: Math.max(0, right - x),
							height: ROW_H - 4,
							fill: "transparent"
						}),
						/* @__PURE__ */ jsx("rect", {
							x,
							y: y - 5,
							width: 10,
							height: 10,
							rx: 3,
							fill: q.sw.fill
						}),
						/* @__PURE__ */ jsx(Txt, {
							x: x + 18,
							y,
							size: 12,
							weight: q.hi ? 700 : 500,
							fill: p.paint(q.hi ? "ink" : "muted"),
							children: truncate(q.label, Math.max(24, labelMax), 12, q.hi ? 700 : 500)
						}),
						/* @__PURE__ */ jsx(Txt, {
							x: right - shareW - 10,
							y,
							anchor: "end",
							size: 12,
							weight: q.hi ? 800 : 600,
							fill: p.paint("ink"),
							children: valueText
						}),
						/* @__PURE__ */ jsx(Txt, {
							x: right,
							y,
							anchor: "end",
							size: 11.5,
							fill: p.paint("muted"),
							children: shareText
						})
					]
				}, `l${q.i}`);
			}) : null
		]
	});
}
var MSG30 = {
	en: {
		kind: "Skyline",
		/** 이벤트의 series와 라이브 영역에 쓰는 줄 이름 */
		row: {
			back: "back",
			front: "front"
		},
		total: {
			back: "Back total",
			front: "Front total"
		},
		sum: "total",
		/** 앞줄이 없을 때 툴팁의 합계 */
		sumLabel: "Total",
		rate: "Front ÷ back",
		peak: (v) => `Peak ${v}`,
		frontPeak: (label, v, rate) => `Front peak ${label} · ${v}${rate ? ` (${rate})` : ""}`,
		range: (a, b) => `${a}–${b}`,
		nothing: "Nothing to draw",
		ofBack: (rate) => `${rate} of the back row`,
		/** 숨긴 표 한 칸: 줄 이름, 합계, 계열 목록 */
		cell: (row, total, list) => `${row ? `${row} ` : ""}${total}${list ? ` (${list})` : ""}`,
		desc: (nB, names, from, to) => `${plural(nB, "series", "series")} (${names}) stacked from ${from} to ${to}`,
		descPeak: (at, v) => `Peak period ${at} at ${v}`,
		descFront: (names, at, v, rate) => `Front row (${names}) peaks at ${at} with ${v}${rate ? `, ${rate} of the back row` : ""}`,
		descFrontZero: (names) => `The front row (${names}) is all zero`,
		merged: (k) => `Neighboring periods are summed in groups of ${k}`,
		keys: "Use left and right arrows for periods, up and down to switch rows."
	},
	ko: {
		kind: "스카이라인",
		row: {
			back: "뒷줄",
			front: "앞줄"
		},
		total: {
			back: "뒷줄 합계",
			front: "앞줄 합계"
		},
		sum: "합계",
		sumLabel: "합계",
		rate: "앞줄 ÷ 뒷줄",
		peak: (v) => `최고 ${v}`,
		frontPeak: (label, v, rate) => `앞줄 최고 ${label} · ${v}${rate ? ` (${rate})` : ""}`,
		range: (a, b) => `${a}~${b}`,
		nothing: "그릴 값이 없어요",
		ofBack: (rate) => `뒷줄의 ${rate}`,
		cell: (row, total, list) => `${row ? `${row} ` : ""}${total}${list ? `(${list})` : ""}`,
		desc: (nB, names, from, to) => `계열 ${nB}개(${names})를 ${from}부터 ${to}까지 쌓았어요`,
		descPeak: (at, v) => `가장 많은 기간 ${at} ${v}`,
		descFront: (names, at, v, rate) => `앞줄(${names})이 가장 많은 기간 ${at} ${v}${rate ? `, 뒷줄의 ${rate}` : ""}`,
		descFrontZero: (names) => `앞줄(${names})은 모두 0이에요`,
		merged: (k) => `이웃 기간을 ${k}개씩 합쳤어요`,
		keys: "←→로 기간을, ↑↓로 앞줄과 뒷줄을 옮겨요."
	}
};
var FACE = .52;
var FRONT_DEPTH = .14;
var GAP3 = .05;
var DEPTH_RANGE = [.1, .32];
var MIN_SLOT = 20;
var MAX_SHOWN = 40;
var COS = .8944271909999159;
var SIN = .4472135954999579;
var X0 = 10;
var LABEL_ROOM = 20;
var SLAB = 4;
var STRIP_H = 26;
var LEGEND_LINE = 18;
var BOTH_ROWS = ["back", "front"];
var BACK_ROW = ["back"];
var r12 = (v) => Math.round(v * 10) / 10;
var pts = (list) => list.map(([x, y]) => `${r12(x)},${r12(y)}`).join(" ");
var sum2 = (xs) => xs.reduce((a, b) => a + b, 0);
var inside2 = (x, text, size, width, weight = 400) => {
	const half = textWidth(text, size, weight) / 2;
	return Math.max(half + 2, Math.min(width - half - 2, x));
};
function mergeFactor(plotW, n) {
	for (let k = 1; k < n; k++) {
		const shown = Math.ceil(n / k);
		if (shown <= MAX_SHOWN && plotW / (shown + .55) >= MIN_SLOT) return k;
	}
	return Math.max(1, n);
}
function groupRange(i, n, k) {
	const first = n - k * (Math.ceil(n / k) - 1);
	return i === 0 ? [0, first] : [first + (i - 1) * k, first + i * k];
}
function sumGroups(values, n, k) {
	return Array.from({ length: Math.ceil(n / k) }, (_, i) => {
		const [a, b] = groupRange(i, n, k);
		return values.map((row) => sum2(row.slice(a, b).map((v) => Number.isFinite(v) && v > 0 ? v : 0)));
	});
}
function skylineLayout(o) {
	const depth = Math.min(DEPTH_RANGE[1], Math.max(DEPTH_RANGE[0], o.depth));
	const plotWidth = (labelW2) => o.width - X0 - (o.wall ? labelW2 + 14 : 8);
	let k = 0;
	let labelW = 0;
	let back = [];
	let front = [];
	let dom = [0, 1];
	for (let pass = 0; pass < 3; pass++) {
		const next = mergeFactor(plotWidth(labelW), o.n);
		if (next === k) break;
		k = next;
		back = sumGroups(o.back, o.n, k);
		front = sumGroups(o.front, o.n, k);
		dom = fitDomain(0, Math.max(0, ...back.map(sum2), ...front.map(sum2)), 4);
		const f = o.tickFmt(dom[1]);
		labelW = o.wall ? Math.max(...ticksFor(dom[0], dom[1], 4).map((t) => textWidth(f(t), AXIS_FONT))) : 0;
	}
	const shown = back.length;
	const s = Math.max(1, plotWidth(labelW) / (shown + .55));
	const w = FACE * s;
	const lead = (FRONT_DEPTH + GAP3) * s;
	const deep = lead + depth * s;
	const floor = o.height - o.below;
	const wallBase = floor - deep * SIN;
	const top = o.legendH + LABEL_ROOM;
	const slotX = (i) => X0 + i * s;
	return {
		merge: k,
		shown,
		back,
		front,
		backTotal: back.map(sum2),
		frontTotal: front.map(sum2),
		ticks: ticksFor(dom[0], dom[1], 4),
		fmt: o.tickFmt(dom[1]),
		k: Math.max(0, wallBase - top) / (dom[1] || 1),
		s,
		w,
		floor,
		wallBase,
		top,
		shift: [lead * COS, lead * SIN],
		depthFront: FRONT_DEPTH * s,
		depthBack: depth * s,
		wallX: [X0 + deep * COS - 6, slotX(shown - 1) + w + deep * COS + 6],
		slotX
	};
}
function rowAfterKey(key, hasFront) {
	if (!hasFront) return null;
	return key === "ArrowUp" ? "back" : key === "ArrowDown" ? "front" : null;
}
function cumulative(values, k) {
	let acc = 0;
	return values.map((v) => acc += v * k);
}
function outline(g, h) {
	const dx = g.d * COS;
	const dy = -g.d * SIN;
	const top = g.base - h;
	return [
		[g.x, top],
		[g.x + dx, top + dy],
		[g.x + g.w + dx, top + dy],
		[g.x + g.w + dx, g.base + dy],
		[g.x + g.w, g.base],
		[g.x, g.base]
	];
}
function Prism(props) {
	const { p, g, cum, colors, hatch } = props;
	const dx = g.d * COS;
	const dy = -g.d * SIN;
	const right = g.x + g.w;
	const sideFace = (yTop, yBottom) => pts([
		[right, yTop],
		[right + dx, yTop + dy],
		[right + dx, yBottom + dy],
		[right, yBottom]
	]);
	const h = cum[cum.length - 1] ?? 0;
	const top = g.base - h;
	const faces = [];
	const seams = [];
	let prev = 0;
	cum.forEach((c, j) => {
		const y0 = g.base - prev;
		const y1 = g.base - c;
		if (c > prev) {
			faces.push(/* @__PURE__ */ jsx("rect", {
				x: r12(g.x),
				y: r12(y1),
				width: r12(g.w),
				height: r12(c - prev),
				fill: colors[j].fill
			}, `f${j}`));
			faces.push(/* @__PURE__ */ jsx("polygon", {
				points: sideFace(y1, y0),
				fill: colors[j].fill
			}, `s${j}`));
			if (prev > 0) seams.push(/* @__PURE__ */ jsx("polyline", {
				points: pts([
					[g.x, y0],
					[right, y0],
					[right + dx, y0 + dy]
				]),
				fill: "none",
				stroke: p.paint("panel"),
				strokeWidth: 1.2
			}, `g${j}`));
		}
		prev = c;
	});
	if (h < 1) return /* @__PURE__ */ jsx("g", { children: faces });
	const side = sideFace(top, g.base);
	return /* @__PURE__ */ jsxs("g", { children: [
		faces,
		/* @__PURE__ */ jsx("polygon", {
			points: side,
			fill: "#000",
			fillOpacity: props.shade
		}),
		hatch ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("rect", {
			x: r12(g.x),
			y: r12(top),
			width: r12(g.w),
			height: r12(h),
			fill: hatch
		}), /* @__PURE__ */ jsx("polygon", {
			points: side,
			fill: hatch
		})] }) : null,
		seams,
		/* @__PURE__ */ jsx("line", {
			x1: r12(right),
			x2: r12(right),
			y1: r12(top),
			y2: r12(g.base),
			stroke: p.paint("panel"),
			strokeOpacity: .7
		}),
		/* @__PURE__ */ jsx("polygon", {
			points: pts([
				[g.x, top],
				[right, top],
				[right + dx, top + dy],
				[g.x + dx, top + dy]
			]),
			fill: props.lid,
			stroke: props.lidStroke ? p.paint("neutralStrong") : void 0,
			strokeOpacity: props.lidStroke ? .55 : void 0,
			strokeLinejoin: "round"
		})
	] });
}
function Halo(props) {
	const { p } = props;
	return /* @__PURE__ */ jsx("text", {
		x: r12(props.x),
		y: r12(props.y),
		dy: "0.35em",
		fontSize: props.size ?? 11.5,
		fill: p.paint("ink"),
		textAnchor: "middle",
		fontWeight: 700,
		opacity: props.opacity === void 0 || props.opacity >= 1 ? void 0 : Math.max(0, props.opacity),
		stroke: p.paint("panel"),
		strokeWidth: 4,
		strokeLinejoin: "round",
		paintOrder: "stroke",
		style: {
			pointerEvents: "none",
			fontVariantNumeric: "tabular-nums"
		},
		children: props.children
	});
}
function legendPlaces(items, width) {
	const out = [];
	let x = 0;
	let line = 0;
	for (const it of items) {
		const w = 15 + textWidth(it.name, 11.5);
		if (x > 0) {
			const lead = it.divider ? 28 : 14;
			if (x + lead + w > width) {
				x = 0;
				line++;
			} else x += lead;
		}
		out.push({
			x,
			line
		});
		x += w;
	}
	return out;
}
function RateStrip(props) {
	const { p, rates } = props;
	const max = Math.max(0, ...rates.map((r) => r ?? 0));
	const top = niceDomain(0, max, 2)[1];
	const hi = max > 0 ? rates.indexOf(max) : -1;
	const bottom = props.top + STRIP_H;
	return /* @__PURE__ */ jsxs("g", {
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ jsx(Txt, {
				x: props.from,
				y: props.top - 8,
				size: 11,
				fill: p.paint("muted"),
				children: props.title
			}),
			/* @__PURE__ */ jsx("line", {
				x1: r12(props.from),
				x2: r12(props.to),
				y1: r12(props.top),
				y2: r12(props.top),
				stroke: p.paint("line2")
			}),
			/* @__PURE__ */ jsx("line", {
				x1: r12(props.from),
				x2: r12(props.to),
				y1: r12(bottom),
				y2: r12(bottom),
				stroke: p.paint("line")
			}),
			rates.map((r, i) => {
				if (r === null || r <= 0) return null;
				const h = r / top * STRIP_H;
				return /* @__PURE__ */ jsx("rect", {
					x: r12(props.x(i)),
					y: r12(bottom - h),
					width: r12(props.w),
					height: r12(h),
					rx: Math.min(1.5, h / 2),
					fill: p.paint(i === hi ? "accent" : "neutralStrong")
				}, i);
			}),
			/* @__PURE__ */ jsx(Txt, {
				x: props.right,
				y: bottom,
				size: AXIS_FONT,
				fill: p.paint("muted"),
				children: "0"
			}),
			/* @__PURE__ */ jsx(Txt, {
				x: props.right,
				y: props.top,
				size: AXIS_FONT,
				fill: p.paint("muted"),
				children: props.pct(top)
			}),
			hi >= 0 ? /* @__PURE__ */ jsx(Halo, {
				p,
				x: props.x(hi) + props.w / 2,
				y: bottom - max / top * STRIP_H - 8,
				size: 11,
				opacity: props.fade(hi),
				children: props.pct(max)
			}) : null
		]
	});
}
function SkylineChart(props) {
	const strip = props.frontRate === "strip" && props.front !== void 0;
	const c = useChart(props, {
		height: (w) => Math.max(300, Math.min(440, w * .58)) + (strip ? 40 : 0),
		duration: 800,
		stagger: 40
	});
	const { p, width: W, height: H } = c;
	const msg = MSG30[c.lang];
	const uid = useId().replace(/:/g, "");
	const [row, setRow] = useState("back");
	const frontFields = useMemo(() => props.front === void 0 ? [] : Array.isArray(props.front) ? props.front : [props.front], [props.front]);
	const backModel = useMemo(() => prepSeries(props.data, props.x, props.y, props.series, { locale: c.locale }), [
		props.data,
		props.x,
		props.y,
		props.series,
		c.locale
	]);
	const frontValues = useMemo(() => frontFields.length ? prepSeries(props.data, props.x, frontFields, void 0, {
		locale: c.locale,
		xType: backModel.type
	}).values : [], [
		props.data,
		props.x,
		frontFields,
		c.locale,
		backModel
	]);
	const valueName = typeof props.y === "string" ? props.y : c.t.value;
	const names = useMemo(() => backModel.series.map((s) => s || valueName), [backModel, valueName]);
	const all = useMemo(() => [...names, ...frontFields], [names, frontFields]);
	const nB = names.length;
	const nF = frontFields.length;
	const hasFront = nF > 0;
	const curRow = hasFront ? row : "back";
	const frontRate = props.frontRate ?? "label";
	const texture = props.texture ?? "front";
	const wall = props.wall !== false;
	const showStrip = strip && hasFront;
	const frontLabel = hasFront && !strip && c.showLabels;
	const legendItems = useMemo(() => nB > 1 || hasFront ? all.map((name, j) => ({
		name,
		divider: j === nB && nB > 0
	})) : [], [
		all,
		nB,
		hasFront
	]);
	const legendAt = useMemo(() => legendPlaces(legendItems, W), [legendItems, W]);
	const legendH = legendAt.length ? (legendAt[legendAt.length - 1].line + 1) * LEGEND_LINE + 6 : 0;
	const below = SLAB + (showStrip ? 70 : frontLabel ? 48 : 22);
	const L = useMemo(() => skylineLayout({
		width: W,
		height: H,
		back: backModel.values,
		front: frontValues,
		n: backModel.keys.length,
		depth: props.depth ?? DEPTH_RANGE[1],
		wall,
		legendH,
		below,
		tickFmt: (max) => makeTickFormatter(props.format, c.locale, max)
	}), [
		W,
		H,
		backModel,
		frontValues,
		props.depth,
		wall,
		legendH,
		below,
		props.format,
		c.locale
	]);
	const { shown, merge } = L;
	const periods = useMemo(() => {
		const n = backModel.keys.length;
		return Array.from({ length: shown }, (_, i) => {
			const [a, end] = groupRange(i, n, merge);
			const b = end - 1;
			const one = a === b;
			return {
				label: one ? backModel.labels[a] : msg.range(backModel.labels[a], backModel.labels[b]),
				key: one ? backModel.keys[a] : `${backModel.keys[a]}~${backModel.keys[b]}`,
				sync: syncKeyOf(backModel.keys[a]),
				datum: one ? backModel.rows[0]?.[a] ?? null : null
			};
		});
	}, [
		shown,
		merge,
		backModel,
		msg
	]);
	const colors = useMemo(() => {
		const h = props.highlight;
		const byName = typeof h === "string" ? all.includes(h) : Array.isArray(h) && h.some((x) => typeof x === "string" && all.includes(x));
		if (nB === 1 && !byName) {
			const hi2 = resolveHighlight(h, periods.map((x) => x.datum), periods.map((x) => x.label), L.backTotal, "max");
			return {
				periods: emphasis(p, shown, hi2),
				back: [swatch(p, "neutral")],
				front: ramp(p, nF, /* @__PURE__ */ new Set())
			};
		}
		const totals = [...names.map((_, j) => sum2(L.back.map((r) => r[j]))), ...frontFields.map((_, j) => sum2(L.front.map((r) => r[j])))];
		const hi = resolveHighlight(typeof h === "function" ? void 0 : h, all, all, totals, "first");
		const part = (from, n) => new Set([...hi].filter((i) => i >= from && i < from + n).map((i) => i - from));
		return {
			periods: null,
			back: ramp(p, nB, part(0, nB)),
			front: ramp(p, nF, part(nB, nF))
		};
	}, [
		props.highlight,
		all,
		nB,
		nF,
		periods,
		L,
		p,
		shown,
		names,
		frontFields
	]);
	const swatches = (i, r) => r === "front" ? colors.front : colors.periods ? [colors.periods[i]] : colors.back;
	const shade = luminance(parseColor(p.theme.panel) ?? [
		0,
		0,
		0,
		1
	]) < .4 ? .3 : .16;
	const hatchFill = `url(#${uid}h)`;
	const hatched = (r) => texture === "all" || texture === "front" && r === "front";
	const backLid = p.mix("panel", "neutralSoft", .5);
	const geom = (i, r) => r === "back" ? {
		x: L.slotX(i) + L.shift[0],
		base: L.floor - L.shift[1],
		w: L.w,
		d: L.depthBack
	} : {
		x: L.slotX(i),
		base: L.floor,
		w: L.w,
		d: L.depthFront
	};
	const total = (i, r) => r === "back" ? L.backTotal[i] : L.frontTotal[i];
	const values = (i, r) => r === "back" ? L.back[i] : L.front[i];
	const lidBackY = (i, r) => {
		const g = geom(i, r);
		return g.base - total(i, r) * L.k - g.d * SIN;
	};
	const rows = hasFront ? BOTH_ROWS : BACK_ROW;
	const D = c.motion.duration ?? 800;
	const stg = Math.min(c.motion.stagger ?? 40, 600 / Math.max(1, shown - 1));
	const m = useMotion(useMemo(() => periods.flatMap((pd, i) => rows.map((r) => {
		const to = cumulative(r === "back" ? L.back[i] : L.front[i], L.k);
		const zero = to.map(() => 0);
		return {
			key: `${pd.key}|${r}`,
			to,
			from: zero,
			enter: zero,
			delay: i * stg + (r === "front" ? 120 : 0),
			data: {
				i,
				r
			}
		};
	})), [
		L,
		periods,
		rows,
		stg
	]), c.motion);
	const byBlock = /* @__PURE__ */ new Map();
	for (const it of m.items) if (!it.exiting) byBlock.set(`${it.data.i}|${it.data.r}`, it);
	const fade = (i) => m.fade(i * stg + D * .7, 260);
	const fv = c.fv;
	const pct = (v) => formatPercent(v * 100, {
		locale: c.locale,
		maximumFractionDigits: 1
	});
	const rateOf = (i) => L.backTotal[i] > 0 ? L.frontTotal[i] / L.backTotal[i] : null;
	const rateText = (i) => {
		const rate = rateOf(i);
		return rate === null ? "" : pct(rate);
	};
	const topDown = (i, r) => (r === "back" ? names : frontFields).map((name, j) => ({
		name,
		v: values(i, r)[j],
		sw: swatches(i, r)[j]
	})).reverse();
	const listText = (i, r) => topDown(i, r).map((s) => `${s.name} ${fv(s.v)}`).join(", ");
	const several = (r) => (r === "back" ? nB : nF) > 1;
	const rowSentence = (i, r) => {
		const parts = several(r) ? [listText(i, r), `${msg.sum} ${fv(total(i, r))}`] : [listText(i, r)];
		if (r === "front" && frontRate !== false && rateOf(i) !== null) parts.push(msg.ofBack(rateText(i)));
		return `${periods[i].label}${hasFront ? ` ${msg.row[r]}` : ""}: ${parts.join(", ")} (${i + 1}/${shown})`;
	};
	const empty = L.backTotal.every((v) => v === 0) && L.frontTotal.every((v) => v === 0);
	const events = useMemo(() => empty ? [] : periods.map((pd, i) => ({
		datum: pd.datum,
		index: i,
		key: pd.key,
		label: pd.label,
		series: hasFront ? msg.row[curRow] : void 0,
		value: total(i, curRow),
		formatted: rows.map((r) => msg.cell(hasFront ? msg.row[r] : "", fv(total(i, r)), several(r) ? listText(i, r) : "")).join(", ")
	})), [
		L,
		periods,
		msg,
		curRow,
		fv,
		names,
		frontFields
	]);
	const syncKeys = useMemo(() => ({
		keys: periods.map((x) => x.sync),
		labels: periods.map((x) => x.label)
	}), [periods]);
	useSync(c, props.syncId, syncKeys.keys, syncKeys.labels);
	const active = c.active !== null && c.active < shown && !empty ? c.active : null;
	const tipAt = (i, tipRows, title) => {
		const b = geom(i, "back");
		const half = (b.w + b.d * COS) / 2;
		const cx = b.x + half;
		const topY = Math.min(lidBackY(i, "back"), lidBackY(i, "front"));
		const estH = 40 + tipRows.length * 18;
		if (topY - estH - 14 >= 2) return {
			x: cx,
			y: topY,
			title,
			rows: tipRows
		};
		const estW = Math.max(112, textWidth(title, 11.5, 600), ...tipRows.map((r) => (r.color ? 15 : 0) + textWidth(r.label ?? "", 12) + 16 + textWidth(r.value, 12, 700))) + 24;
		const away = half + 12 + estW / 2;
		const cardTop = Math.max(4, Math.min(topY, H - estH - 4));
		return {
			x: cx + away + estW / 2 <= W - 4 ? cx + away : cx - away,
			y: cardTop + estH + 14,
			title,
			rows: tipRows
		};
	};
	let tip = null;
	if (active !== null) {
		const tipRows = [];
		for (const r of rows) {
			const picked = r === curRow;
			for (const s of topDown(active, r)) tipRows.push({
				label: s.name,
				value: fv(s.v),
				color: s.sw.fill,
				strong: several(r) ? picked ? void 0 : false : picked
			});
			if (several(r)) tipRows.push({
				label: hasFront ? msg.total[r] : msg.sumLabel,
				value: fv(total(active, r)),
				strong: picked
			});
		}
		if (hasFront && frontRate !== false) tipRows.push({
			label: msg.rate,
			value: rateText(active) || "-",
			strong: false
		});
		tip = tipAt(active, tipRows, periods[active].label);
	}
	const announce = active !== null && c.via === "keyboard" ? rowSentence(active, curRow) : void 0;
	const peakB = L.backTotal.indexOf(Math.max(...L.backTotal));
	const peakF = hasFront ? L.frontTotal.indexOf(Math.max(...L.frontTotal)) : -1;
	let auto = msg.kind;
	if (shown) {
		const parts = [
			msg.kind,
			msg.desc(nB, names.join(", "), periods[0].label, periods[shown - 1].label),
			msg.descPeak(periods[peakB].label, fv(L.backTotal[peakB]))
		];
		if (hasFront) parts.push(L.frontTotal[peakF] > 0 ? msg.descFront(frontFields.join(", "), periods[peakF].label, fv(L.frontTotal[peakF]), rateText(peakF)) : msg.descFrontZero(frontFields.join(", ")));
		if (merge > 1) parts.push(msg.merged(merge));
		auto = parts.join(". ");
	}
	const desc = `${props.description ?? `${auto}.`}${hasFront ? ` ${msg.keys}` : ""}`;
	const dates = useMemo(() => {
		const xs = periods.map((pd, i) => inside2(L.slotX(i) + L.w / 2, pd.label, AXIS_FONT, W));
		return {
			xs,
			show: thinLabels(xs, periods.map((x) => x.label), AXIS_FONT, 6)
		};
	}, [
		L,
		periods,
		W
	]);
	const stripTop = L.floor + SLAB + 20;
	const dateY = showStrip ? stripTop + STRIP_H + 14 : L.floor + SLAB + 12;
	const pick = (px, py, touch) => {
		if (empty) return;
		const i = evenIndex(px, L.slotX(0) + L.s * .49, L.slotX(shown - 1) + L.s * .49, shown);
		const next = !touch && hasFront && py >= L.floor - L.frontTotal[i] * L.k - 6 ? "front" : "back";
		if (next !== row) setRow(next);
		if (i !== c.active) c.setActive(i, touch ? "touch" : "pointer");
	};
	const wallTop = L.top - 10;
	const fx0 = L.slotX(0) - 8;
	const fx1 = L.slotX(shown - 1) + L.w + 8;
	const deep = (FRONT_DEPTH + GAP3) * L.s + L.depthBack + 8;
	const floorTop = pts([
		[fx0, L.floor + SLAB],
		[fx1, L.floor + SLAB],
		[fx1 + deep * COS, L.floor + SLAB - deep * SIN],
		[fx0 + deep * COS, L.floor + SLAB - deep * SIN]
	]);
	const peakLabel = () => {
		const g = geom(peakB, "back");
		const text = msg.peak(fv(L.backTotal[peakB]));
		const x = Math.min(g.x + (g.w + g.d * COS) / 2, (wall ? L.wallX[1] : W - 2) - textWidth(text, 11.5, 700) / 2);
		return /* @__PURE__ */ jsx(Halo, {
			p,
			x,
			y: lidBackY(peakB, "back") - 11,
			opacity: fade(peakB),
			children: text
		});
	};
	const frontPeakLabel = () => {
		const rate = frontRate === "label" ? rateText(peakF) : "";
		const text = msg.frontPeak(periods[peakF].label, fv(L.frontTotal[peakF]), rate);
		const cx = L.slotX(peakF) + L.w / 2;
		return /* @__PURE__ */ jsxs("g", {
			opacity: fade(peakF),
			children: [/* @__PURE__ */ jsx("line", {
				x1: r12(cx),
				x2: r12(cx),
				y1: r12(dateY + 8),
				y2: r12(dateY + 14),
				stroke: p.paint("muted")
			}), /* @__PURE__ */ jsx(Halo, {
				p,
				x: inside2(cx, text, 11, W, 700),
				y: dateY + 25,
				size: 11,
				children: text
			})]
		});
	};
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		announce,
		onPointerMove: (px, py, e) => pick(px, py, e.pointerType === "touch"),
		onKey: (e) => {
			const next = rowAfterKey(e.key, hasFront);
			if (next === null) return false;
			if (next !== row) setRow(next);
			if (active === null && !empty) c.setActive(0, "keyboard");
			return true;
		},
		defs: texture !== "none" ? /* @__PURE__ */ jsx("pattern", {
			id: `${uid}h`,
			width: 4,
			height: 4,
			patternUnits: "userSpaceOnUse",
			patternTransform: "rotate(45)",
			children: /* @__PURE__ */ jsx("rect", {
				width: 1.6,
				height: 4,
				fill: p.paint("panel"),
				fillOpacity: .55
			})
		}) : void 0,
		children: [/* @__PURE__ */ jsx("g", {
			"aria-hidden": "true",
			children: legendItems.map((it, j) => {
				const { x, line } = legendAt[j];
				const y = line * LEGEND_LINE + 9;
				const front = j >= nB;
				return /* @__PURE__ */ jsxs("g", { children: [
					it.divider && x > 0 ? /* @__PURE__ */ jsx("line", {
						x1: x - 14,
						x2: x - 14,
						y1: y - 7,
						y2: y + 7,
						stroke: p.paint("line")
					}) : null,
					/* @__PURE__ */ jsx("rect", {
						x,
						y: y - 5,
						width: 10,
						height: 10,
						rx: 2,
						fill: front ? colors.front[j - nB].fill : colors.back[j].fill
					}),
					hatched(front ? "front" : "back") ? /* @__PURE__ */ jsx("rect", {
						x,
						y: y - 5,
						width: 10,
						height: 10,
						rx: 2,
						fill: hatchFill
					}) : null,
					/* @__PURE__ */ jsx(Txt, {
						x: x + 15,
						y,
						size: 11.5,
						fill: p.paint("muted"),
						children: it.name
					})
				] }, j);
			})
		}), empty ? /* @__PURE__ */ jsx(Txt, {
			x: W / 2,
			y: (L.top + L.floor) / 2,
			anchor: "middle",
			size: 13,
			fill: p.paint("muted"),
			children: msg.nothing
		}) : /* @__PURE__ */ jsxs(Fragment, { children: [
			/* @__PURE__ */ jsxs("g", {
				"aria-hidden": "true",
				children: [
					wall ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("rect", {
						x: r12(L.wallX[0]),
						y: r12(wallTop),
						width: r12(Math.max(0, L.wallX[1] - L.wallX[0])),
						height: r12(Math.max(0, L.wallBase - wallTop)),
						fill: p.paint("line2"),
						fillOpacity: .6
					}), L.ticks.map((t) => {
						const y = L.wallBase - t * L.k;
						return /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("line", {
							x1: r12(L.wallX[0]),
							x2: r12(L.wallX[1]),
							y1: r12(y),
							y2: r12(y),
							stroke: p.paint("line")
						}), /* @__PURE__ */ jsx(Txt, {
							x: L.wallX[1] + 6,
							y,
							size: AXIS_FONT,
							fill: p.paint("muted"),
							children: L.fmt(t)
						})] }, t);
					})] }) : null,
					/* @__PURE__ */ jsx("polygon", {
						points: floorTop,
						fill: p.paint("neutralSoft")
					}),
					/* @__PURE__ */ jsx("rect", {
						x: r12(fx0),
						y: r12(L.floor + SLAB),
						width: r12(Math.max(0, fx1 - fx0)),
						height: SLAB,
						fill: p.paint("line")
					})
				]
			}),
			periods.map((pd, i) => /* @__PURE__ */ jsxs("g", {
				className: "ztd-mark",
				opacity: active === null || active === i ? 1 : .38,
				onClick: () => c.click(i),
				style: { cursor: props.onClick ? "pointer" : void 0 },
				children: [
					/* @__PURE__ */ jsx("rect", {
						x: r12(L.slotX(i)),
						y: r12(wallTop),
						width: r12(L.s),
						height: r12(Math.max(0, H - wallTop)),
						fill: "transparent"
					}),
					rows.map((r) => {
						const it = byBlock.get(`${i}|${r}`);
						if (!it) return null;
						const g = geom(i, r);
						const target = total(i, r) * L.k;
						if (target > 0 && target < 1) {
							const vals = values(i, r);
							let topJ = vals.length - 1;
							while (topJ > 0 && !(vals[topJ] > 0)) topJ--;
							return /* @__PURE__ */ jsx("line", {
								x1: r12(g.x),
								x2: r12(g.x + g.w),
								y1: r12(g.base - .5),
								y2: r12(g.base - .5),
								stroke: swatches(i, r)[topJ].fill
							}, r);
						}
						return /* @__PURE__ */ jsx(Prism, {
							p,
							g,
							cum: it.v,
							colors: swatches(i, r),
							hatch: hatched(r) ? hatchFill : null,
							lid: r === "back" ? backLid : p.paint("neutralSoft"),
							lidStroke: r === "back",
							shade
						}, r);
					}),
					active === i && c.via !== "sync" ? /* @__PURE__ */ jsx("polygon", {
						points: pts(outline(geom(i, curRow), total(i, curRow) * L.k)),
						fill: "none",
						stroke: p.paint("ink"),
						strokeWidth: 2,
						strokeLinejoin: "round",
						pointerEvents: "none"
					}) : null
				]
			}, pd.key)),
			c.showLabels && L.backTotal[peakB] > 0 ? peakLabel() : null,
			showStrip ? /* @__PURE__ */ jsx(RateStrip, {
				p,
				rates: periods.map((_, i) => rateOf(i)),
				x: L.slotX,
				w: L.w,
				from: fx0,
				to: fx1,
				top: stripTop,
				right: wall ? L.wallX[1] + 6 : fx1 + 6,
				title: msg.rate,
				pct,
				fade
			}) : null,
			/* @__PURE__ */ jsx("g", {
				"aria-hidden": "true",
				children: dates.show.map((i) => /* @__PURE__ */ jsx(Txt, {
					x: dates.xs[i],
					y: dateY,
					anchor: "middle",
					size: AXIS_FONT,
					fill: p.paint(active === i ? "ink" : "muted"),
					weight: active === i ? 700 : 400,
					children: periods[i].label
				}, i))
			}),
			frontLabel && L.frontTotal[peakF] > 0 ? frontPeakLabel() : null
		] })]
	});
}
var MSG31 = {
	en: {
		kind: "Histogram",
		count: "Count",
		cum: "Cumulative",
		range: (a, b) => `${a} to ${b}`,
		inBin: (n, share) => `${n} · ${share}`,
		row: (n, share) => `${n} (${share})`,
		rowCum: (cum) => `cumulative ${cum}`,
		samples: (n) => plural(n, "sample"),
		median: (v) => `median ${v}`,
		about: (v) => `about ${v}`,
		peak: (range, n) => `the tallest bin is ${range} (${n})`,
		past: (count, above, value, label, share) => `${count} ${above ? "above" : "below"} ${label ? `the ${label} of ${value}` : value} (${share})`,
		outside: (n) => `${n} outside the edges`,
		excluded: (n) => `${n} at or below 0 left out`,
		dot: (n) => `1 dot = ${plural(n, "sample")}`,
		groups: (n) => plural(n, "group"),
		hidden: (drawn, all) => `Only the first ${drawn} of ${all} groups are drawn`
	},
	ko: {
		kind: "히스토그램",
		count: "건수",
		cum: "누적",
		range: (a, b) => `${a} ~ ${b}`,
		inBin: (n, share) => `${n}건 · ${share}`,
		row: (n, share) => `${n}건(${share})`,
		rowCum: (cum) => `누적 ${cum}`,
		samples: (n) => `표본 ${n}개`,
		median: (v) => `중앙값 ${v}`,
		about: (v) => `약 ${v}`,
		peak: (range, n) => `가장 많은 구간 ${range}(${n}건)`,
		past: (count, above, value, label, share) => `${label ? `${label} ` : ""}${value} ${above ? "넘음" : "미만"} ${count}건(${share})`,
		outside: (n) => `범위 밖 ${n}개`,
		excluded: (n) => `0 이하 ${n}개 제외`,
		dot: (n) => `점 하나 = ${n}건`,
		groups: (n) => `그룹 ${n}개`,
		hidden: (drawn, all) => `그룹 ${all}개 중 앞의 ${drawn}개만 그려요`
	}
};
var same = (v) => v;
var DEFAULT_MARKS = ["p50", "p95"];
var TAG_FONT = 10;
var TAG_H = 15;
var HEAD_H = 16;
var KDE_SAMPLES = 96;
var dashOf = (id) => id === "p50" ? void 0 : id === "p99" ? "1.5 2.5" : "4 3";
function rawModel(data, value, group, fn, opts) {
	const gv = numGetter(value, "value");
	const gg = group ? strGetter(group, "group") : () => "";
	const by = /* @__PURE__ */ new Map();
	const picked = [];
	data.forEach((d, i) => {
		const v = gv(d, i);
		if (!Number.isFinite(v)) return;
		const g = gg(d, i);
		let s = by.get(g);
		if (!s) by.set(g, s = {
			values: [],
			excluded: 0
		});
		if (opts.log && v <= 0) s.excluded++;
		else {
			s.values.push(v);
			if (fn?.(d, i)) picked.push({
				g,
				v
			});
		}
	});
	const names = [...by.keys()].slice(0, 2);
	const edges = names.length ? binEdges(names.flatMap((g) => by.get(g).values), opts) : [];
	const counted = names.map((g) => binCounts(by.get(g).values, edges));
	return {
		bins: edges.slice(1).map((x1, i) => ({
			i,
			x0: edges[i],
			x1,
			counts: counted.map((c) => c.counts[i])
		})),
		samples: names.map((name, k) => ({
			name,
			n: by.get(name).values.length,
			values: by.get(name).values,
			outside: counted[k].outside,
			excluded: by.get(name).excluded
		})),
		groupCount: by.size,
		binned: false,
		fnBins: new Set(picked.map((p) => binIndex(edges, p.v)).filter((k) => k >= 0)),
		fnGroup: picked.map((p) => names.indexOf(p.g)).find((k) => k >= 0) ?? -1
	};
}
function binnedModel(data, acc, fn, log) {
	const g0 = numGetter(acc.x0, "x0");
	const g1 = numGetter(acc.x1, "x1");
	const gc = numGetter(acc.count, "count");
	const gg = acc.group ? strGetter(acc.group, "group") : () => "";
	const excluded = /* @__PURE__ */ new Map();
	const cells = /* @__PURE__ */ new Map();
	data.forEach((d, i) => {
		const x0 = g0(d, i);
		const x1 = g1(d, i);
		const n = gc(d, i);
		if (!(Number.isFinite(x0) && Number.isFinite(x1) && x1 > x0 && Number.isFinite(n) && n >= 0)) return;
		const g = gg(d, i);
		excluded.set(g, excluded.get(g) ?? 0);
		if (log && x0 <= 0) {
			excluded.set(g, excluded.get(g) + n);
			return;
		}
		const key = `${x0}|${x1}`;
		let cell = cells.get(key);
		if (!cell) cells.set(key, cell = {
			x0,
			x1,
			by: /* @__PURE__ */ new Map(),
			picked: /* @__PURE__ */ new Set()
		});
		cell.by.set(g, (cell.by.get(g) ?? 0) + n);
		if (fn?.(d, i)) cell.picked.add(g);
	});
	const names = [...excluded.keys()].slice(0, 2);
	const bins = [];
	const fnBins = /* @__PURE__ */ new Set();
	for (const cell of [...cells.values()].sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1)) {
		const last = bins[bins.length - 1];
		if (last && cell.x0 > last.x1) bins.push({
			i: bins.length,
			x0: last.x1,
			x1: cell.x0,
			counts: names.map(() => 0)
		});
		if (cell.picked.size) fnBins.add(bins.length);
		bins.push({
			i: bins.length,
			x0: cell.x0,
			x1: cell.x1,
			counts: names.map((g) => cell.by.get(g) ?? 0)
		});
	}
	const samples = names.map((name, k) => ({
		name,
		n: bins.reduce((s, b) => s + b.counts[k], 0),
		values: [],
		outside: 0,
		excluded: excluded.get(name)
	}));
	const fnGroup = names.findIndex((g) => [...cells.values()].some((c) => c.picked.has(g)));
	return {
		bins,
		samples,
		groupCount: excluded.size,
		binned: true,
		fnBins,
		fnGroup
	};
}
function quantileOf(model, k, p, log) {
	const s = model.samples[k];
	if (!model.binned) return percentile(s.values, p);
	const target = p / 100 * s.n;
	let acc = 0;
	for (const b of model.bins) {
		const c = b.counts[k];
		if (c > 0 && acc + c >= target) {
			const f = (target - acc) / c;
			return log ? 10 ** (Math.log10(b.x0) + f * (Math.log10(b.x1) - Math.log10(b.x0))) : b.x0 + f * (b.x1 - b.x0);
		}
		acc += c;
	}
	return NaN;
}
function pastShare(b, t, log) {
	const f = log ? Math.log10 : same;
	if (log && t.value <= 0) return t.side === "below" ? 0 : 1;
	const k = (f(t.value) - f(b.x0)) / (f(b.x1) - f(b.x0));
	return Math.max(0, Math.min(1, t.side === "below" ? k : 1 - k));
}
function pastCount(model, k, t, log) {
	const above = t.side !== "below";
	const s = model.samples[k];
	if (!model.binned) return {
		n: s.values.filter((v) => above ? v > t.value : v < t.value).length,
		est: false
	};
	let n = 0;
	let est = false;
	for (const b of model.bins) {
		const share = pastShare(b, t, log);
		n += b.counts[k] * share;
		if (share > 0 && share < 1 && b.counts[k] > 0) est = true;
	}
	return {
		n: Math.round(n),
		est
	};
}
function stepPath2(ex, tops, base, a = -Infinity, b = Infinity) {
	const n = tops.length;
	const inside3 = (i) => Math.min(ex[i + 1], b) > Math.max(ex[i], a);
	let d = "";
	for (let i = 0; i < n; i++) {
		if (!inside3(i)) continue;
		let j = i;
		while (j + 1 < n && inside3(j + 1)) j++;
		const l = Math.max(ex[i], a);
		const r = Math.min(ex[j + 1], b);
		d += `M${r2(l)},${r2(l === ex[i] ? Math.max(i ? tops[i - 1] : base, tops[i]) : tops[i])}V${r2(tops[i])}`;
		for (let k = i; k < j; k++) d += `H${r2(ex[k + 1])}V${r2(tops[k + 1])}`;
		d += `H${r2(r)}`;
		if (r === ex[j + 1]) d += `V${r2(Math.max(j + 1 < n ? tops[j + 1] : base, tops[j]))}`;
		i = j;
	}
	return d;
}
function runs(idx, n) {
	const out = [];
	for (let i = 0; i < n; i++) {
		if (!idx.has(i)) continue;
		let j = i;
		while (idx.has(j + 1)) j++;
		out.push([i, j]);
		i = j;
	}
	return out;
}
function placeTags(tags, lo, hi) {
	const sorted = [...tags].sort((a, b) => a.at - b.at);
	const place = (order) => {
		const rows = [];
		return sorted.map((t) => {
			const w = textWidth(t.text, TAG_FONT, 700) + 10;
			const spots = [
				t.at,
				t.at + w / 2 - 4,
				t.at - w / 2 + 4
			].map((x) => Math.max(lo + w / 2, Math.min(hi - w / 2, x)));
			for (let row = 0;; row++) {
				const used = rows[row] ?? (rows[row] = []);
				const x = order.map((k) => spots[k]).find((s) => used.every(([a, b]) => s + w / 2 + 4 <= a || s - w / 2 - 4 >= b));
				if (x === void 0) continue;
				used.push([x - w / 2, x + w / 2]);
				return {
					...t,
					x,
					w,
					row
				};
			}
		});
	};
	const rowsOf = (list) => Math.max(0, ...list.map((t) => t.row));
	const centered = place([
		0,
		1,
		2
	]);
	const leftFirst = place([
		2,
		0,
		1
	]);
	return rowsOf(leftFirst) < rowsOf(centered) ? leftFirst : centered;
}
function linearTicks(lo, hi, count) {
	let out = [];
	for (let k = Math.max(2, count); k <= Math.max(2, count) + 4 && out.length < 3; k++) out = ticksFor(lo, hi, k).filter((t) => t >= lo - 1e-9 && t <= hi + 1e-9);
	return out;
}
function logTicks(lo, hi, pxPerDecade) {
	const pick = (steps) => decadeGrid(lo, hi, steps).filter((v) => v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9));
	const ticks = pick(pxPerDecade >= 110 ? [
		1,
		2,
		5
	] : [1]);
	return ticks.length >= 2 ? ticks : pick([
		1,
		2,
		3,
		4,
		5,
		6,
		7,
		8,
		9
	]);
}
function HistogramChart(props) {
	const c = useChart(props, {
		height: (w) => Math.max(230, Math.min(310, w * .55)),
		duration: 800
	});
	const { p, width: W, height: H } = c;
	const msg = MSG31[c.lang];
	const fv = c.fv;
	const log = props.log === true;
	const variant = props.variant ?? "bars";
	const th = props.threshold && Number.isFinite(props.threshold.value) ? props.threshold : void 0;
	const thValue = th?.value;
	const thSide = th?.side;
	const above = thSide !== "below";
	const edgesKey = props.edges?.join(",");
	const marksKey = (props.marks ?? DEFAULT_MARKS).filter((id) => Number.isFinite(markPercentile(id))).join(",");
	const fn = typeof props.highlight === "function" ? props.highlight : null;
	const hl = typeof props.highlight === "function" ? void 0 : props.highlight;
	const { data, value, group, x0, x1, count, binWidth, bins: binCount } = props;
	const model = useMemo(() => {
		if (isPreBinned(data.find((d) => d !== null && typeof d === "object"), value, count)) return binnedModel(data, {
			x0,
			x1,
			count,
			group
		}, fn, log);
		const edges = edgesKey ? edgesKey.split(",").map(Number) : void 0;
		return rawModel(data, value, group, fn, {
			edges,
			binWidth,
			bins: binCount,
			log
		});
	}, [
		data,
		value,
		group,
		x0,
		x1,
		count,
		edgesKey,
		binWidth,
		binCount,
		log,
		fn
	]);
	const { bins, samples } = model;
	const n = bins.length;
	const grouped = samples.length > 1;
	const quantiles = useMemo(() => model.samples.map((_, k) => {
		const marks2 = marksKey ? marksKey.split(",").map((id) => ({
			id,
			v: quantileOf(model, k, markPercentile(id), log)
		})) : [];
		return {
			median: marks2.find((mk) => mk.id === "p50")?.v ?? quantileOf(model, k, 50, log),
			marks: marks2
		};
	}), [
		model,
		marksKey,
		log
	]);
	const past = useMemo(() => thValue === void 0 ? [] : model.samples.map((_, k) => pastCount(model, k, {
		value: thValue,
		side: thSide
	}, log)), [
		model,
		thValue,
		thSide,
		log
	]);
	const [lo, hi] = useMemo(() => extent(model.bins.flatMap((b) => [b.x0, b.x1])), [model]);
	const showKde = props.kde === true && !model.binned;
	const density = useMemo(() => {
		if (!showKde || !model.bins.length) return null;
		const tf = log ? Math.log10 : same;
		const [a, z] = [tf(lo), tf(hi)];
		const xs = Array.from({ length: KDE_SAMPLES }, (_, k) => a + (z - a) * k / (KDE_SAMPLES - 1));
		const w = (z - a) / model.bins.length;
		return {
			xs,
			curves: model.samples.map((s) => kde(s.values.map(tf), xs).map((d) => d * s.n * w))
		};
	}, [
		showKde,
		model,
		log,
		lo,
		hi
	]);
	const names = samples.map((s) => s.name);
	const hiGroup = !grouped ? -1 : fn ? model.fnGroup : [...resolveHighlight(hl, names, names, samples.map((s) => s.n), "first")][0] ?? -1;
	const counts0 = bins.map((b) => b.counts[0]);
	const range = (b) => msg.range(fv(b.x0), fv(b.x1));
	const hiBins = grouped || th ? /* @__PURE__ */ new Set() : fn ? model.fnBins : resolveHighlight(hl, bins, bins.map(range), counts0, "max");
	const fillK = grouped && hiGroup === 0 ? 1 : 0;
	const lineK = grouped ? 1 - fillK : 0;
	const dots = variant === "dots" && !grouped;
	const step = variant === "step";
	const T = log ? Math.log10 : same;
	const maxCount = Math.max(0, ...bins.flatMap((b) => b.counts));
	const tickCount = Math.max(2, Math.round(H / 70));
	const dom = fitDomain(0, Math.max(1, maxCount, ...density?.curves.flat() ?? []), tickCount);
	const yTicks = scaleLinear(dom, [0, 1]).ticks(tickCount).filter((t) => Number.isInteger(t));
	const yFmt = makeTickFormatter(void 0, c.locale, dom[1]);
	const left = dots ? 8 : yAxisWidth(yTicks, yFmt, c.locale);
	const xl = left + 2;
	const xr = W - 10;
	const sx = scaleLinear([T(lo), T(hi)], [xl, xr]);
	const X = (v) => sx(T(v));
	const inDomain = (v) => Number.isFinite(v) && v >= lo && v <= hi && (!log || v > 0);
	const outside = samples.reduce((s, x) => s + x.outside, 0);
	const excluded = samples.reduce((s, x) => s + x.excluded, 0);
	const note = [outside ? msg.outside(outside) : "", excluded ? msg.excluded(excluded) : ""].filter(Boolean).join(" · ");
	const tagK = Math.max(0, hiGroup);
	const tags = c.pending || !n ? [] : placeTags([...(quantiles[tagK]?.marks ?? []).filter((mk) => inDomain(mk.v)).map((mk) => ({
		key: mk.id,
		at: X(mk.v),
		text: `${mk.id} ${fv(mk.v)}`,
		fill: p.paint(grouped ? "accentText" : "ink"),
		stroke: p.paint(grouped ? "accent" : "ink"),
		dash: dashOf(mk.id)
	})), ...th && inDomain(th.value) ? [{
		key: "threshold",
		at: X(th.value),
		text: th.label ? `${th.label} ${fv(th.value)}` : fv(th.value),
		fill: p.paint(grouped ? "ink" : "accentText"),
		stroke: p.paint(grouped ? "ink" : "accent")
	}] : []], 4, W - 4);
	const rows = c.showLabels ? Math.max(0, ...tags.map((t) => t.row + 1)) : 0;
	const head = note || dots ? HEAD_H : 0;
	const tagY = (row) => 6 + head + row * (TAG_H + 3);
	const top = tagY(rows) + (rows ? 4 : 0);
	const base = H - 22;
	const minPx = n ? Math.min(...bins.map((b) => X(b.x1) - X(b.x0))) : 10;
	const rMax = Math.max(1.5, Math.min(6, minPx / 2 - 1));
	const rMin = Math.min(rMax, 2.5);
	const unit = dots ? dotUnit(maxCount, (base - top) / (rMin * 2 + 1.5)) : 1;
	const rad = Math.max(rMin, Math.min(rMax, ((base - top) / Math.max(1, Math.ceil(maxCount / unit)) - 1.5) / 2));
	const pitch = rad * 2 + 1.5;
	const y = dots ? (v) => base - v / unit * pitch : scaleLinear(dom, [base, top]);
	const stg = props.stagger ?? Math.min(28, 520 / Math.max(1, n));
	const m = useMotion(useMemo(() => {
		const out = [];
		if (!step) for (const b of bins) out.push({
			key: `${dots ? "d" : "b"}${b.i}`,
			to: [dots ? 1 : y(b.counts[fillK])],
			from: [dots ? 0 : base],
			enter: [dots ? 0 : base],
			delay: b.i * stg,
			data: {
				k: fillK,
				i: b.i
			}
		});
		const outlines = grouped ? step ? [fillK, lineK] : [lineK] : step ? [0] : [];
		for (const k of outlines) out.push({
			key: `s${k}`,
			to: bins.map((b) => y(b.counts[k])),
			from: bins.map(() => base),
			enter: bins.map(() => base),
			delay: k === lineK ? 120 : 0,
			data: {
				k,
				i: -1
			}
		});
		return out;
	}, [
		model,
		W,
		H,
		top,
		unit,
		dots,
		step,
		grouped,
		fillK,
		lineK,
		stg,
		dom[1]
	]), c.motion);
	const share = (v) => formatPercent(v, {
		locale: c.locale,
		maximumFractionDigits: 1
	});
	const ofN = (k, v) => samples[k].n ? v / samples[k].n * 100 : 0;
	const cums = samples.map((_, k) => {
		let acc = 0;
		return bins.map((b) => acc += b.counts[k]);
	});
	const events = bins.map((b) => {
		const parts = samples.map((s, k) => {
			const r = msg.row(b.counts[k], share(ofN(k, b.counts[k])));
			return grouped ? `${s.name} ${r}` : `${r}, ${msg.rowCum(share(ofN(k, cums[k][b.i])))}`;
		});
		return {
			datum: null,
			index: b.i,
			key: `b${b.i}`,
			label: range(b),
			value: b.counts.reduce((a, v) => a + v, 0),
			formatted: parts.join(", ")
		};
	});
	const accent = p.paint("accent");
	const isHot = (b) => hiBins.has(b.i) || th !== void 0 && pastShare(b, th, log) >= .5;
	const groupColor = (k) => k === hiGroup ? accent : p.paint(k === fillK && !step ? "neutral" : "neutralStrong");
	let tip = null;
	if (c.active !== null && bins[c.active]) {
		const b = bins[c.active];
		const tallest = Math.max(...b.counts);
		const rowsOf = (k) => {
			const v = msg.inBin(b.counts[k], share(ofN(k, b.counts[k])));
			const cum = {
				label: msg.cum,
				value: share(ofN(k, cums[k][b.i])),
				strong: false
			};
			if (grouped) return [{
				label: samples[k].name,
				value: v,
				color: groupColor(k),
				strong: k === hiGroup
			}, cum];
			return [{
				label: msg.count,
				value: v,
				color: isHot(b) ? accent : p.paint(dots || step ? "neutralStrong" : "neutral"),
				strong: true
			}, cum];
		};
		tip = {
			x: (X(b.x0) + X(b.x1)) / 2,
			y: dots ? base - Math.ceil(tallest / unit) * pitch : y(tallest),
			title: range(b),
			rows: samples.flatMap((_, k) => rowsOf(k))
		};
	}
	const sampleText = (k) => {
		const s = samples[k];
		const qs = quantiles[k];
		const pk = past[k];
		const q = (v) => model.binned ? msg.about(fv(v)) : fv(v);
		const out = [
			msg.samples(s.n),
			msg.median(q(qs.median)),
			...qs.marks.filter((mk) => mk.id !== "p50").map((mk) => `${mk.id} ${q(mk.v)}`)
		];
		if (!grouped && maxCount) out.push(msg.peak(range(bins[counts0.indexOf(maxCount)]), maxCount));
		if (pk && th) out.push(msg.past(pk.est ? msg.about(`${pk.n}`) : `${pk.n}`, above, fv(th.value), th.label ?? "", share(ofN(k, pk.n))));
		return out;
	};
	const extra = [note, dots ? msg.dot(unit) : ""].filter(Boolean);
	const hidden = model.groupCount > samples.length ? ` ${msg.hidden(samples.length, model.groupCount)}.` : "";
	const auto = !n ? "" : grouped ? `${msg.kind}, ${msg.groups(samples.length)}. ${samples.map((s, k) => `${s.name}: ${sampleText(k).join(", ")}`).join("; ")}${extra.length ? `. ${extra.join(", ")}` : ""}.${hidden}` : `${msg.kind}. ${[...sampleText(0), ...extra].join(", ")}.`;
	const desc = props.description ?? auto;
	const tpx = th && inDomain(th.value) ? X(th.value) : null;
	const ex = n ? [X(bins[0].x0), ...bins.map((b) => X(b.x1))] : [];
	const yTop = (cnt, at) => cnt > 0 && base - at < 1 ? base - 1 : at;
	const bar = (b, at0, k) => {
		const xa = X(b.x0) + .5;
		const xb = X(b.x1) - .5;
		const w = xb - xa;
		if (w <= 0 || b.counts[k] <= 0) return null;
		const at = yTop(b.counts[k], at0);
		const r = Math.min(2, w / 4);
		const gray = p.paint("neutral");
		const sh = th && !grouped ? pastShare(b, th, log) : 0;
		if (sh <= 0 || sh >= 1 || tpx === null) return /* @__PURE__ */ jsx("path", {
			d: roundRectPath(xa, at, w, base - at, {
				tl: r,
				tr: r
			}),
			fill: sh >= 1 || hiBins.has(b.i) ? accent : gray
		});
		const cut = Math.max(xa, Math.min(xb, tpx));
		const [lc, rc] = above ? [gray, accent] : [accent, gray];
		return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("path", {
			d: roundRectPath(xa, at, cut - xa, base - at, { tl: r }),
			fill: lc
		}), /* @__PURE__ */ jsx("path", {
			d: roundRectPath(cut, at, xb - cut, base - at, { tr: r }),
			fill: rc
		})] });
	};
	const outline2 = (k, v) => {
		const tops = v.map((at, j) => yTop(bins[j]?.counts[k] ?? 0, at));
		const strong = grouped && k === lineK && hiGroup >= 0;
		const ranges = grouped ? [] : th ? tpx === null ? [] : [above ? [tpx, Infinity] : [-Infinity, tpx]] : runs(hiBins, n).map(([a, z]) => [ex[a], ex[z + 1]]);
		return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("path", {
			d: stepPath2(ex, tops, base),
			fill: "none",
			stroke: strong ? accent : p.paint("neutralStrong"),
			strokeWidth: strong ? 2 : 1.6,
			strokeLinejoin: "round"
		}), ranges.map(([a, z], j) => /* @__PURE__ */ jsx("path", {
			d: stepPath2(ex, tops, base, a, z),
			fill: "none",
			stroke: accent,
			strokeWidth: 2,
			strokeLinejoin: "round"
		}, j))] });
	};
	const dotColumn = (b, progress) => {
		const cnt = b.counts[0];
		const full = Math.floor(cnt / unit);
		const ring = cnt % unit > 0;
		const shown = Math.round(progress * (full + (ring ? 1 : 0)));
		const cx = r2((X(b.x0) + X(b.x1)) / 2);
		const col = isHot(b) ? accent : p.paint("neutralStrong");
		return /* @__PURE__ */ jsxs(Fragment, { children: [Array.from({ length: Math.min(shown, full) }, (_, j) => /* @__PURE__ */ jsx("circle", {
			cx,
			cy: r2(base - pitch * (j + .5)),
			r: r2(rad),
			fill: col
		}, j)), ring && shown > full ? /* @__PURE__ */ jsx("circle", {
			cx,
			cy: r2(base - pitch * (full + .5)),
			r: r2(rad - .65),
			fill: "none",
			stroke: col,
			strokeWidth: 1.3
		}) : null] });
	};
	const xTicks = !n ? [] : log ? logTicks(lo, hi, (xr - xl) / Math.max(1e-9, Math.log10(hi / lo))) : linearTicks(lo, hi, Math.round((xr - xl) / 70));
	const xFmt = makeTickFormatter(props.format, c.locale, Math.max(Math.abs(lo), Math.abs(hi)));
	const shownTicks = fitTickLabels(xTicks.map((t) => ({
		t,
		x: X(t),
		label: xFmt(t)
	})), 0, W);
	const activeBin = c.active !== null ? bins[c.active] : void 0;
	const band = activeBin && (dots || step || grouped);
	const fade = m.fade(Math.min(700, n * stg) + 200, 320);
	return /* @__PURE__ */ jsxs(ChartFrame, {
		c,
		kind: msg.kind,
		ariaLabel: props.ariaLabel,
		description: desc,
		events,
		tip,
		renderTip: props.tooltip,
		className: props.className,
		style: props.style,
		theme: props.theme,
		children: [
			!dots && n ? /* @__PURE__ */ jsx(GridY, {
				p,
				ticks: yTicks,
				y,
				x0: left,
				x1: W,
				fmt: yFmt,
				locale: c.locale
			}) : null,
			band ? /* @__PURE__ */ jsx("rect", {
				x: r2(X(activeBin.x0)),
				y: r2(top),
				width: r2(X(activeBin.x1) - X(activeBin.x0)),
				height: r2(base - top),
				fill: p.paint("line"),
				opacity: .6,
				pointerEvents: "none"
			}) : null,
			bins.map((b) => /* @__PURE__ */ jsx("rect", {
				x: r2(X(b.x0)),
				y: r2(top),
				width: r2(Math.max(0, X(b.x1) - X(b.x0))),
				height: r2(Math.max(0, base - top)),
				fill: "transparent",
				onPointerEnter: (e) => c.setActive(b.i, e.pointerType === "touch" ? "touch" : "pointer"),
				onClick: () => c.click(b.i),
				style: { cursor: props.onClick ? "pointer" : void 0 }
			}, `h${b.i}`)),
			m.items.map((it) => {
				const { k, i } = it.data;
				const b = bins[i];
				return /* @__PURE__ */ jsx("g", {
					className: "ztd-mark",
					pointerEvents: "none",
					opacity: it.exiting ? .4 : i < 0 ? 1 : c.dim(i),
					children: i < 0 ? outline2(k, it.v) : !b ? null : dots ? dotColumn(b, it.v[0]) : bar(b, it.v[0], k)
				}, it.key);
			}),
			activeBin && c.via === "keyboard" ? /* @__PURE__ */ jsx("rect", {
				x: r2(X(activeBin.x0) - 1),
				y: r2(top - 2),
				width: r2(X(activeBin.x1) - X(activeBin.x0) + 2),
				height: r2(base - top + 4),
				rx: 3,
				fill: "none",
				stroke: p.paint("ink"),
				strokeWidth: 2,
				pointerEvents: "none"
			}) : null,
			density?.curves.map((cv, k) => /* @__PURE__ */ jsx("path", {
				d: linePath(cv.map((v, j) => [sx(density.xs[j]), Math.max(top, y(v))])),
				fill: "none",
				stroke: grouped ? groupColor(k) : p.paint("ink"),
				strokeWidth: 1.6,
				opacity: fade,
				pointerEvents: "none"
			}, `k${k}`)),
			/* @__PURE__ */ jsxs("g", {
				opacity: fade,
				pointerEvents: "none",
				"aria-hidden": "true",
				children: [tags.map((t) => /* @__PURE__ */ jsx("line", {
					x1: r2(t.at),
					x2: r2(t.at),
					y1: c.showLabels ? tagY(t.row) + TAG_H : top,
					y2: base,
					stroke: t.stroke,
					strokeWidth: t.key === "threshold" ? 1.5 : 1.4,
					strokeDasharray: t.dash
				}, t.key)), c.showLabels ? tags.map((t) => /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("rect", {
					x: r2(t.x - t.w / 2),
					y: tagY(t.row),
					width: r2(t.w),
					height: TAG_H,
					rx: 5,
					fill: p.paint("panel"),
					opacity: .92
				}), /* @__PURE__ */ jsx(Txt, {
					x: t.x,
					y: tagY(t.row) + TAG_H / 2,
					anchor: "middle",
					size: TAG_FONT,
					weight: 700,
					fill: t.fill,
					children: t.text
				})] }, t.key)) : null]
			}),
			/* @__PURE__ */ jsxs("g", {
				"aria-hidden": "true",
				children: [
					shownTicks.map((t) => /* @__PURE__ */ jsx(Txt, {
						x: t.x,
						y: base + 11,
						anchor: "middle",
						size: AXIS_FONT,
						fill: p.paint("muted"),
						children: t.label
					}, t.t)),
					dots && n ? /* @__PURE__ */ jsx("line", {
						x1: xl,
						x2: xr,
						y1: r2(base) + .5,
						y2: r2(base) + .5,
						stroke: p.paint("dim"),
						shapeRendering: "crispEdges"
					}) : null,
					note ? /* @__PURE__ */ jsx(Txt, {
						x: xl,
						y: 6 + HEAD_H / 2,
						size: 10.5,
						fill: p.paint("muted"),
						children: truncate(note, Math.max(40, xr - xl - (dots ? 110 : 0)), 10.5)
					}) : null,
					dots ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("circle", {
						cx: r2(xr - textWidth(msg.dot(unit), 10.5, 600) - 8),
						cy: 6 + HEAD_H / 2,
						r: 3.5,
						fill: p.paint("neutralStrong")
					}), /* @__PURE__ */ jsx(Txt, {
						x: xr,
						y: 6 + HEAD_H / 2,
						anchor: "end",
						size: 10.5,
						weight: 600,
						fill: p.paint("muted"),
						children: msg.dot(unit)
					})] }) : null,
					!n ? /* @__PURE__ */ jsx(Txt, {
						x: W / 2,
						y: H / 2,
						anchor: "middle",
						size: 12,
						fill: p.paint("muted"),
						children: c.t.empty
					}) : null
				]
			})
		]
	});
}
var CHART_COMPONENTS = {
	pie: PieChart,
	donut: DonutChart,
	funnel: FunnelChart,
	waffle: WaffleChart,
	treemap: Treemap,
	sunburst: SunburstChart,
	waterfall: WaterfallChart,
	pareto: ParetoChart,
	marimekko: MarimekkoChart,
	heatmap: Heatmap,
	radar: RadarChart,
	bubble: BubbleChart,
	line: LineChart,
	area: AreaChart,
	stream: StreamGraph,
	bar: BarChart,
	radialBar: RadialBarChart,
	gauge: GaugeChart,
	bullet: BulletChart,
	sparkline: Sparkline,
	slope: SlopeChart,
	dumbbell: DumbbellChart,
	lollipop: LollipopChart,
	beeswarm: BeeswarmChart,
	ridgeline: RidgelineChart,
	sankey: SankeyChart,
	chord: ChordChart,
	calendar: CalendarHeatmap,
	bump: BumpChart,
	box: BoxPlot,
	parallel: ParallelCoordinates,
	candlestick: CandlestickChart,
	segmented: SegmentedBar,
	skyline: SkylineChart,
	histogram: HistogramChart,
	scatter: ScatterChart
};
function resolveDef(type, encoding) {
	const def = resolveMeta(type);
	return def?.type === "scatter" && encoding?.size !== void 0 ? resolveMeta("bubble") : def;
}
function encodingToProps(def, encoding = {}) {
	const out = {};
	for (const c of def.encoding) {
		const v = encoding[c.name];
		if (v !== void 0) out[c.prop ?? c.name] = v;
	}
	return out;
}
function autoLegend(spec, rows, locale) {
	const def = resolveDef(spec.type, spec.encoding);
	if (!def || !rows.length) return [];
	const enc = spec.encoding ?? {};
	const opt = spec.options ?? {};
	const h = opt.highlight;
	if ([
		"pie",
		"donut",
		"waffle"
	].includes(def.type)) {
		const gl = strGetter(enc.label, "label");
		const gv = numGetter(enc.value, "value");
		const labels = rows.map((r, i) => gl(r, i));
		const hi = resolveHighlight(h, rows, labels, rows.map((r, i) => gv(r, i)), def.type === "waffle" ? "first" : "max");
		const tokens = categoricalTokens(labels.length, hi);
		return labels.map((l, i) => ({
			label: l,
			color: tokens[i]
		}));
	}
	if (def.type === "candlestick") {
		const ma = maPeriods(Array.isArray(opt.ma) ? opt.ma : void 0, rows.length);
		const t = CANDLE_TEXT[langOf(locale)];
		return [
			{
				label: t.up,
				color: opt.upColor ?? "accent"
			},
			{
				label: t.down,
				color: opt.downColor ?? "neutralStrong"
			},
			...ma.map((d, i) => ({
				label: t.maLegend(d),
				color: MA_TOKENS[i],
				shape: "line"
			}))
		];
	}
	if (def.type === "scatter") {
		if (typeof enc.series !== "string") return [];
		const g = strGetter(enc.series, "series");
		const series = uniq(rows.map((r, i) => g(r, i)));
		if (series.length < 2) return [];
		const tokens = categoricalDotTokens(series.length, seriesHighlight(h, rows, series, g));
		const hidden = new Set(Array.isArray(opt.hidden) ? opt.hidden.map(String) : []);
		return series.flatMap((s, i) => hidden.has(s) ? [] : [{
			label: s,
			color: tokens[i],
			shape: "circle"
		}]);
	}
	if ([
		"marimekko",
		"area",
		"bar",
		"line",
		"stream",
		"radar"
	].includes(def.type)) {
		let series = [];
		if (Array.isArray(enc.y)) series = enc.y;
		else if (typeof enc.series === "string") {
			const g = strGetter(enc.series, "series");
			series = uniq(rows.map((r, i) => g(r, i)));
		}
		if (series.length < 2) return [];
		const hi = resolveHighlight(h, series, series, series.map(() => 0), "first");
		if (def.type === "line" || def.type === "radar") return series.map((s, i) => ({
			label: s,
			color: hi.has(i) ? "accent" : "neutralStrong",
			shape: def.type === "line" ? "line" : "square"
		}));
		const tokens = categoricalTokens(series.length, hi);
		return series.map((s, i) => ({
			label: s,
			color: tokens[i]
		}));
	}
	return [];
}
function Chart(props) {
	const { spec } = props;
	const def = resolveDef(spec.type, spec.encoding);
	const inline = useMemo(() => inlineRows(spec.data), [spec.data]);
	const remote = !inline && spec.data && typeof spec.data === "object" && "url" in spec.data ? spec.data : null;
	const explicit = specLocale(spec, props.locale);
	const locale = useChartLocale(explicit);
	const lang = langOf(locale);
	const st = useChartData(remote?.url ?? null, {
		parse: remote?.format ?? "auto",
		select: remote?.select,
		init: props.fetchInit,
		locale
	});
	if (!def) return /* @__PURE__ */ jsx(ChartState, {
		error: lang === "ko" ? `알 수 없는 차트 종류: ${spec.type}` : `Unknown chart type: ${spec.type}`,
		height: props.height ?? 200,
		locale: explicit
	});
	const rows = inline ?? st.data;
	const Comp = CHART_COMPONENTS[def.type];
	const options = { ...spec.options ?? {} };
	const chartProps = {
		...encodingToProps(def, spec.encoding),
		...options,
		data: rows,
		...props.width !== void 0 ? { width: props.width } : {},
		...props.height !== void 0 ? { height: props.height } : {},
		...props.animate !== void 0 ? { animate: props.animate } : {},
		...props.replayKey !== void 0 ? { replayKey: props.replayKey } : {},
		...props.onHover ? { onHover: props.onHover } : {},
		...props.onClick ? { onClick: props.onClick } : {},
		locale: explicit
	};
	const h = chartProps.height ?? 220;
	let body = remote && !rows.length && (st.loading || st.error || st.empty) ? /* @__PURE__ */ jsx(ChartState, {
		loading: st.loading,
		error: st.error,
		empty: st.empty,
		onRetry: st.reload,
		height: h,
		locale: explicit
	}) : /* @__PURE__ */ jsx(Comp, { ...chartProps });
	if (spec.card) {
		const c = spec.card;
		const legend = c.legend === "auto" ? autoLegend(spec, rows, locale) : c.legend;
		body = /* @__PURE__ */ jsx(ChartCard, {
			number: c.number,
			title: c.title ?? nameIn(def, lang),
			subtitle: c.subtitle,
			legend: legend && legend.length ? legend : void 0,
			takeaway: c.takeaway,
			level: c.level,
			sample: c.sample,
			replay: c.replay !== false,
			className: props.className,
			locale: explicit,
			children: body
		});
	}
	const theme = props.theme ?? spec.theme;
	if (theme) body = /* @__PURE__ */ jsx(ThemeProvider, {
		theme,
		children: body
	});
	return body;
}
// node_modules/.pnpm/ztd-charts@0.5.0_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/ztd-charts/dist/spec.js
var KO_CHARTS = {
	pie: {
		summary: "전체에서 각 항목이 차지하는 비중",
		useWhen: "항목이 2~4개이고 합이 100%일 때",
		avoidWhen: "항목이 4개를 넘거나 값 차이가 작을 때(막대가 더 정확해요)",
		why: "강조 조각(기본은 가장 큰 조각)만 강조색으로, 나머지는 무채색으로 칠해서 메시지가 분명해요.",
		channels: {
			label: "항목 이름 필드",
			value: "값 필드"
		},
		options: {
			colorMode: "항목마다 다른 무채색(categorical) 또는 강조 조각만 색(emphasis)",
			sort: "큰 값부터 정렬",
			startAngle: "시작 각도(도). 0이 12시",
			labelMode: "조각 라벨에 보일 내용"
		},
		example: {
			data: pieSampleKo,
			encoding: {
				label: "device",
				value: "sales"
			},
			options: { highlight: "모바일" },
			card: {
				subtitle: "기기별 매출 비중",
				takeaway: "2~4개 항목만",
				legend: "auto"
			}
		}
	},
	donut: {
		summary: "가운데에 합계를 둔 비중 차트",
		useWhen: "비중만큼 합계도 중요할 때",
		avoidWhen: "항목이 6개를 넘을 때",
		why: "등장할 때 가운데 숫자가 0부터 올라가서 합계가 먼저 눈에 들어와요.",
		channels: {
			label: "항목 이름 필드",
			value: "값 필드"
		},
		options: {
			innerRadius: "안쪽 반지름 비율",
			centerValue: "가운데 숫자: \"total\" | \"highlight\" | 숫자 | null(없음)",
			centerLabel: "가운데 숫자 아래 설명",
			legend: "범례 위치",
			sort: "큰 값부터 정렬"
		},
		example: {
			data: donutSampleKo,
			encoding: {
				label: "type",
				value: "count"
			},
			options: { centerLabel: "전환(건)" },
			card: {
				subtitle: "전환 유형별 비중",
				takeaway: "가운데에 총합"
			}
		}
	},
	funnel: {
		summary: "단계를 지날 때마다 줄어드는 양과 전환율",
		useWhen: "가입, 구매처럼 순서가 있는 단계의 이탈을 볼 때",
		avoidWhen: "단계에 순서가 없거나 값이 늘어날 때",
		why: "전환율이 가장 낮은 단계를 자동으로 강조해서 어디서 이탈하는지 바로 보여요.",
		channels: {
			label: "단계 이름",
			value: "단계 인원"
		},
		options: {
			showRates: "오른쪽에 전환율 표시",
			rateBase: "전환율 기준",
			rateLabel: "전환율 열 제목. 한국어 로캘의 기본값은 \"전 단계 대비\""
		},
		example: {
			data: funnelSampleKo,
			encoding: {
				label: "stage",
				value: "users"
			},
			card: {
				subtitle: "단계별 사용자(명)",
				takeaway: "단계별 이탈"
			}
		}
	},
	waffle: {
		summary: "100칸 격자로 보는 비율",
		useWhen: "'100명 중 38명'처럼 사람 수로 말하고 싶을 때",
		avoidWhen: "항목이 4개를 넘거나 1% 미만 차이가 중요할 때",
		why: "칸이 한 줄씩 채워지며 등장해서 숫자를 읽기 전에 감이 와요.",
		channels: {
			label: "항목 이름 필드",
			value: "값 필드"
		},
		options: {
			cells: "칸 수",
			columns: "한 줄 칸 수",
			total: "전체 값. 없으면 합계",
			summary: "오른쪽에 큰 숫자 표시",
			summaryLabel: "큰 숫자 아래 설명",
			summaryNote: "둘째 줄 설명"
		},
		example: {
			data: waffleSampleKo,
			encoding: {
				label: "segment",
				value: "customers"
			},
			options: {
				summaryLabel: "신규 고객",
				summaryNote: "재구매 62명"
			},
			card: {
				subtitle: "고객 100명 중",
				takeaway: "100칸으로 보는 비율",
				legend: "auto"
			}
		}
	},
	treemap: {
		summary: "넓이로 보는 계층 구조의 비율",
		useWhen: "카테고리 안 상품처럼 두 단계 비중을 한 번에 볼 때",
		avoidWhen: "정확한 크기 비교가 중요할 때",
		why: "squarified 배치로 칸이 정사각형에 가까워서 라벨이 잘 들어가요.",
		channels: {
			label: "잎(가장 아래 단계) 이름",
			value: "값 필드",
			group: "상위 그룹 필드"
		},
		options: {
			path: "여러 단계 경로 필드 목록",
			labelMode: "칸 라벨에 보일 내용",
			sort: "큰 값부터 정렬"
		},
		example: {
			data: treemapSampleKo,
			encoding: {
				group: "category",
				label: "product",
				value: "share"
			},
			card: {
				subtitle: "카테고리별 상품 매출 비중",
				takeaway: "계층의 비율"
			}
		}
	},
	sunburst: {
		summary: "원형으로 그린 계층",
		useWhen: "채널 > 캠페인처럼 2~3단계 구성을 볼 때",
		avoidWhen: "단계가 4개 이상이거나 잎이 20개를 넘을 때",
		why: "안쪽 고리부터 차례로 펼쳐지며 등장해서 계층을 단계별로 읽을 수 있어요.",
		channels: {
			label: "잎 이름",
			value: "값 필드",
			group: "상위 그룹 필드"
		},
		options: {
			path: "여러 단계 경로 필드 목록",
			sort: "큰 값부터 정렬",
			hole: "가운데 구멍 비율"
		},
		example: {
			data: sunburstSampleKo,
			encoding: {
				group: "channel",
				label: "campaign",
				value: "spend"
			},
			options: { highlight: "전체 상품" },
			card: {
				subtitle: "채널별, 캠페인별 광고비 비중",
				takeaway: "원형으로 그린 계층"
			}
		}
	},
	waterfall: {
		summary: "시작값에서 끝값까지 증감 요인 분해",
		useWhen: "지난달 매출이 이번 달 매출로 바뀐 이유를 설명할 때",
		avoidWhen: "요인이 12개를 넘을 때",
		why: "막대가 왼쪽부터 차례로 이어져서 어디서 늘고 줄었는지 보여요.",
		channels: {
			label: "항목 이름 필드",
			value: "증감 값(합계 행은 생략 가능)",
			type: "\"total\"이면 합계 막대"
		},
		options: {
			startTotal: "첫 행을 시작 합계로",
			endTotal: "끝에 누적 합계 막대. 문자열이면 이름",
			connectors: "막대 사이 연결선"
		},
		example: {
			data: waterfallSampleKo,
			encoding: {
				label: "item",
				value: "amount",
				type: "kind"
			},
			card: {
				subtitle: "9~10월 매출 변화(만 원)",
				takeaway: "증감 요인 분해",
				legend: [{
					label: "증가",
					color: "neutral"
				}, {
					label: "감소",
					color: "neutralStrong"
				}]
			}
		}
	},
	pareto: {
		summary: "큰 값부터 놓은 막대와 누적 비율 선",
		useWhen: "상위 몇 개가 전체의 80%를 만드는지 볼 때",
		avoidWhen: "항목 순서가 의미 있을 때(시간순 등)",
		why: "막대가 나온 뒤 누적선이 그려지고, 기준선(기본 80%)과 만나는 점을 표시해요.",
		channels: {
			label: "항목 이름 필드",
			value: "값 필드"
		},
		options: {
			threshold: "기준선(%)",
			sort: "큰 값부터 정렬",
			rankLabels: "x 라벨을 \"1위, 2위…\"로"
		},
		example: {
			data: paretoSampleKo,
			encoding: {
				label: "keyword",
				value: "spend"
			},
			options: { rankLabels: true },
			card: {
				subtitle: "키워드별 광고비 비중(%)",
				takeaway: "상위 20%가 80%?",
				legend: [{
					label: "비중",
					color: "neutral"
				}, {
					label: "누적",
					color: "ink",
					shape: "line"
				}]
			}
		}
	},
	marimekko: {
		summary: "폭(열 비중)과 높이(열 안 비중)로 함께 보는 두 비율",
		useWhen: "채널별 매출 규모와 기기 구성을 한 장에 담을 때",
		avoidWhen: "열이 6개를 넘거나 계열이 4개를 넘을 때",
		why: "열이 아래에서 차올라서 두 비율을 한 번에 읽을 수 있어요.",
		channels: {
			x: "열(가로 구분) 필드",
			series: "쌓는 계열 필드",
			value: "값 필드"
		},
		options: {},
		example: {
			data: marimekkoSampleKo,
			encoding: {
				x: "channel",
				series: "device",
				value: "sales"
			},
			card: {
				subtitle: "채널 매출, 기기 구성(%)",
				takeaway: "폭과 높이로 두 비율",
				legend: "auto"
			}
		}
	},
	heatmap: {
		summary: "두 범주가 만나는 칸의 값을 색 진하기로 나타낸 격자",
		useWhen: "요일 × 시간대 주문처럼 패턴을 찾을 때",
		avoidWhen: "정확한 값 비교가 중요할 때",
		why: "강조색 하나의 진하기만 써서 테마가 바뀌어도 일관돼요. 칸이 많으면 캔버스로 바꿔 1만 칸도 가볍게 그려요.",
		channels: {
			x: "열 필드",
			y: "행 필드",
			value: "값 필드"
		},
		options: {
			showValues: "칸 안 숫자. \"auto\"면 들어갈 때만 보여요",
			legend: "색 범례 표시",
			legendLabels: "범례 양끝 이름",
			canvasThreshold: "칸이 이보다 많으면 캔버스로 그려요"
		},
		example: {
			data: heatmapSampleKo,
			encoding: {
				x: "hour",
				y: "day",
				value: "orders"
			},
			card: {
				subtitle: "요일 × 시간대 주문 수",
				takeaway: "금요일 밤이 가장 붐벼요"
			}
		}
	},
	radar: {
		summary: "여러 지표를 한 번에 비교",
		useWhen: "제품, 후보를 5~8개 지표로 비교할 때",
		avoidWhen: "계열이 3개를 넘을 때(겹쳐서 읽기 어려워요)",
		why: "강조 계열 하나만 채우고 나머지는 선으로 그려서 겹쳐도 읽을 수 있어요.",
		channels: {
			axis: "지표(축) 필드",
			value: "값 필드",
			series: "계열 필드"
		},
		options: {
			max: "바깥 고리 값",
			levels: "고리 수",
			circular: "다각형 대신 원 격자"
		},
		example: {
			data: radarSampleKo,
			encoding: {
				axis: "metric",
				series: "product",
				value: "score"
			},
			card: {
				subtitle: "제품 평가(100점 만점)",
				takeaway: "디자인은 앞서고 가격은 뒤져요",
				legend: [{
					label: "우리 앱",
					color: "accent"
				}, {
					label: "업계 평균",
					color: "neutralStrong"
				}]
			}
		}
	},
	bubble: {
		summary: "x, y, 크기 세 값을 한 번에 보는 차트. 크기가 없으면 산점도예요",
		useWhen: "캠페인별 CPC, ROAS, 광고비처럼 세 지표의 관계를 볼 때",
		avoidWhen: "점이 겹쳐 크기 비교가 어려울 때",
		why: "점이 많으면 캔버스로 전환하고 격자 색인으로 가장 가까운 점을 바로 찾아 1만 점에서도 호버가 부드러워요.",
		channels: {
			x: "x 값",
			y: "y 값",
			size: "원 크기",
			label: "이름"
		},
		options: {
			sizeRange: "반지름 범위(px)",
			xLabel: "x축 이름",
			yLabel: "y축 이름",
			zero: "축에 0 포함",
			maxLabels: "점 라벨 최대 개수",
			canvasThreshold: "점이 이보다 많으면 캔버스로 그려요",
			xFormat: "x 값 포맷"
		},
		example: {
			data: bubbleSampleKo,
			encoding: {
				x: "cpc",
				y: "roas",
				size: "spend",
				label: "campaign"
			},
			options: {
				xLabel: "CPC(원)",
				yLabel: "ROAS(%)"
			},
			card: {
				subtitle: "캠페인별 CPC, ROAS, 광고비",
				takeaway: "큰 원이 효율도 좋을까요?"
			}
		}
	},
	line: {
		summary: "시간에 따른 변화",
		useWhen: "월별 지표의 흐름을 보거나 여러 계열을 비교할 때",
		avoidWhen: "x가 순서 없는 범주일 때",
		why: "강조 계열만 색으로, 나머지는 회색으로 칠하고 오른쪽에 이름표를 붙여요. 1만 점도 LTTB로 줄여 path 하나로 그려요.",
		channels: {
			x: "x 필드(날짜, 숫자, 범주)",
			y: "y 필드. 넓은 표에서는 배열",
			series: "계열 필드(긴 표)",
			lower: "범위 띠의 아래 경계. 넓은 표에서는 y와 같은 순서의 배열",
			upper: "범위 띠의 위 경계. lower와 같은 꼴"
		},
		options: {
			curve: "선 모양",
			xType: "x 종류를 직접 정해요. 없으면 자동",
			dots: "점 표시. \"auto\" | true | false",
			area: "강조 계열 아래 그라데이션",
			zero: "y축에 0 포함",
			endLabels: "오른쪽 끝 계열 이름표",
			colorMode: "강조 계열만 색 또는 계열마다 색",
			yDomain: "y 범위 고정",
			maxPoints: "점이 이보다 많으면 LTTB로 줄여요",
			referenceLines: "가로 기준선 [{ y, label }]",
			yLabel: "y축 이름",
			brush: "끌어서 구간 고르기. true면 등락과 최고, 최저를 보여 주고 \"zoom\"이면 그 구간으로 확대(키보드: Shift+화살표, Enter)",
			annotations: "주석: 목표 구간, 기간, 기준선, 사건, 예측, 추세선, 주말 음영. [{ type, x, y, from, label }]",
			signColors: "강조 계열을 baseline 위아래 색으로 나눠요(손익, 증감)",
			baseline: "signColors를 나누는 값",
			downColor: "baseline 아래 색(토큰 이름이나 CSS 색)",
			bandFrom: "범위 띠를 그리기 시작하는 곳. \"forecast\"면 예측 주석부터",
			outside: "범위 띠 밖으로 나간 점을 표시하고 설명에 그 수를 적어요",
			connectNulls: "빠진 값(null, NaN, 그 x에 행이 없음)을 건너 선을 이어요. 기본은 그 자리에서 선과 면이 끊기고, 혼자 남은 점은 점으로 그려요. 쌓은 영역에는 상관없어요"
		},
		example: {
			data: lineSampleKo,
			encoding: {
				x: "month",
				y: "mau",
				series: "app"
			},
			options: {
				unit: "만",
				area: true
			},
			card: {
				subtitle: "월간 활성 사용자(만 명)",
				takeaway: "우리 앱만 꾸준히 올라요"
			}
		}
	},
	area: {
		summary: "누적 합과 구성 변화(쌓기, 100% 쌓기)",
		useWhen: "채널별 유입이 전체 안에서 어떻게 바뀌는지 볼 때",
		avoidWhen: "계열 하나하나의 정확한 값이 중요할 때",
		why: "바닥에서 차오르며 등장해서 쌓이는 구성을 한눈에 볼 수 있어요.",
		channels: {
			x: "x 필드",
			y: "y 필드. 넓은 표에서는 배열",
			series: "계열 필드",
			lower: "범위 띠의 아래 경계(stack \"none\"일 때만). 넓은 표에서는 y와 같은 순서의 배열",
			upper: "범위 띠의 위 경계. lower와 같은 꼴"
		},
		options: {
			stack: "쌓기 방식",
			curve: "선 모양",
			xType: "x 종류를 직접 정해요. 없으면 자동",
			zero: "y축에 0 포함",
			endLabels: "오른쪽 끝 계열 이름표",
			yDomain: "y 범위 고정",
			maxPoints: "점이 이보다 많으면 LTTB로 줄여요",
			brush: "끌어서 구간 고르기. true면 등락과 최고, 최저를 보여 주고 \"zoom\"이면 그 구간으로 확대(키보드: Shift+화살표, Enter)",
			annotations: "주석: 목표 구간, 기간, 기준선, 사건, 예측, 추세선, 주말 음영. [{ type, x, y, from, label }]",
			signColors: "강조 계열을 baseline 위아래 색으로 나눠요(손익, 증감). stack \"none\"일 때만",
			baseline: "signColors를 나누는 값",
			downColor: "baseline 아래 색(토큰 이름이나 CSS 색)",
			bandFrom: "범위 띠를 그리기 시작하는 곳. \"forecast\"면 예측 주석부터",
			outside: "범위 띠 밖으로 나간 점을 표시하고 설명에 그 수를 적어요",
			connectNulls: "빠진 값(null, NaN, 그 x에 행이 없음)을 건너 선을 이어요. 기본은 그 자리에서 선과 면이 끊기고, 혼자 남은 점은 점으로 그려요. 쌓은 영역에는 상관없어요"
		},
		example: {
			data: areaSampleKo,
			encoding: {
				x: "month",
				y: "visits",
				series: "channel"
			},
			options: { highlight: "SNS" },
			card: {
				subtitle: "채널별 월 유입(천 명)",
				takeaway: "SNS 몫이 가장 빨리 커져요",
				legend: "auto"
			}
		}
	},
	stream: {
		summary: "여러 계열의 크기와 변화를 나타낸 흐르는 띠",
		useWhen: "장르별 시청처럼 계열이 5개 이상이고 흐름의 리듬이 중요할 때",
		avoidWhen: "정확한 값을 읽어야 할 때",
		why: "wiggle 기준선과 inside-out 정렬로 띠가 덜 출렁여요. 가장 두꺼운 곳에 이름을 넣어요.",
		channels: {
			x: "x 필드",
			y: "y 필드",
			series: "계열 필드"
		},
		options: {
			offset: "기준선 모양",
			reorder: "모양이 깔끔해지게 계열 순서 바꾸기",
			curve: "선 모양",
			xType: "x 종류를 직접 정해요. 없으면 자동"
		},
		example: {
			data: streamSampleKo,
			encoding: {
				x: "week",
				y: "hours",
				series: "genre"
			},
			options: { highlight: "예능" },
			card: {
				subtitle: "주별 장르 시청 시간(만 시간)",
				takeaway: "예능이 여름을 지배했어요"
			}
		}
	},
	bar: {
		summary: "묶은, 쌓은, 100% 막대와 가로 막대",
		useWhen: "범주끼리 크기를 정확히 비교할 때",
		avoidWhen: "시간 흐름이 핵심일 때(라인 차트가 나아요)",
		why: "계열이 하나면 가장 큰 막대만, 여럿이면 강조 계열만 색으로 칠해요.",
		channels: {
			x: "범주 필드",
			y: "값 필드. 넓은 표에서는 배열",
			series: "계열 필드"
		},
		options: {
			layout: "계열 배치 방식",
			orientation: "방향",
			sort: "값 순 정렬(계열 하나일 때)",
			annotations: "세로 막대 주석: 목표 구간, 기간, 기준선, 사건, 예측(뒤 막대는 옅게 점선 테두리), 추세선. [{ type, x, y, from, label }]"
		},
		example: {
			data: barSampleKo,
			encoding: {
				x: "quarter",
				y: "revenue",
				series: "team"
			},
			options: {
				layout: "stacked",
				highlight: "해외"
			},
			card: {
				subtitle: "분기별 매출(억 원)",
				takeaway: "해외 비중이 매 분기 커져요",
				legend: "auto"
			}
		}
	},
	radialBar: {
		summary: "목표 대비 달성률 같은 비율을 나타낸 고리",
		useWhen: "목표 3~6개의 달성률을 한 장에 보여 줄 때",
		avoidWhen: "값을 정밀하게 비교할 때(바깥 고리가 더 길어 보여요)",
		why: "진행률 고리가 하나뿐이면 게이지(variant \"ring\")가 맞아요.",
		channels: {
			label: "항목 이름 필드",
			value: "값 필드"
		},
		options: {
			max: "한 바퀴의 값",
			sweep: "호 길이(도)"
		},
		example: {
			data: radialBarSampleKo,
			encoding: {
				label: "goal",
				value: "rate"
			},
			options: {
				unit: "%",
				format: "integer"
			},
			card: {
				subtitle: "분기 목표 달성률",
				takeaway: "재구매만 목표에 가까워요"
			}
		}
	},
	gauge: {
		summary: "KPI 하나의 현재값과 목표",
		useWhen: "목표 대비 현재 위치 하나를 크게 보여 줄 때",
		avoidWhen: "여러 값을 비교할 때",
		why: "호가 차오르는 동안 숫자가 올라가요. variant로 호, 반원(semi), 진행률 고리(ring), 눈금(ticks) 모양을 골라요.",
		channels: {
			value: "값 필드",
			target: "목표 필드"
		},
		options: {
			min: "최솟값",
			max: "최댓값",
			label: "가운데 설명",
			variant: "모양. ticks는 눈금이 값까지 켜져요",
			bands: "구간 경계값(arc, semi)",
			ticks: "variant=ticks일 때 눈금 개수. 기본은 크기에 맞춰요"
		},
		example: {
			data: gaugeSampleKo,
			encoding: {
				value: "value",
				target: "target"
			},
			options: {
				label: "목표 달성률",
				unit: "%"
			},
			card: {
				subtitle: "분기 매출 목표(%)",
				takeaway: "목표까지 12%p 남았어요"
			}
		}
	},
	bullet: {
		summary: "목표와 구간(나쁨, 보통, 좋음) 대비 실적",
		useWhen: "KPI 여러 개를 작은 공간에서 목표와 함께 볼 때",
		avoidWhen: "목표나 구간이 없을 때",
		why: "게이지 대신 쓰는 작은 형태예요. 목표 대비 실적 비율이 가장 낮은 KPI를 강조해요.",
		channels: {
			label: "항목 이름 필드",
			value: "실적 필드",
			target: "목표 필드"
		},
		options: {
			ranges: "구간 경계 필드(작은 것부터)",
			independent: "행마다 축 범위 따로"
		},
		example: {
			data: bulletSampleKo,
			encoding: {
				label: "kpi",
				value: "actual",
				target: "target"
			},
			options: { ranges: [
				"poor",
				"ok",
				"good"
			] },
			card: {
				subtitle: "상반기 KPI(목표: 세로선)",
				takeaway: "신규 고객이 가장 뒤처져요"
			}
		}
	},
	sparkline: {
		summary: "표나 KPI 옆에 넣는 작은 추세선",
		useWhen: "정확한 값보다 흐름이 중요할 때",
		avoidWhen: "축 값을 읽어야 할 때",
		why: "글 사이에 넣는 작은 그래프예요. 축 없이 마지막 값을 글자로 보여 줘요.",
		channels: {
			x: "x 필드",
			y: "y 필드"
		},
		options: {
			variant: "모양",
			showValue: "마지막 값을 글자로 표시",
			showExtremes: "최고점과 최저점 표시",
			mark: "강조 점을 찍을 위치"
		},
		example: {
			data: sparklineSample,
			encoding: {
				x: "day",
				y: "revenue"
			},
			options: {
				unit: "만",
				height: 120,
				showExtremes: true
			},
			card: {
				subtitle: "6월 일 매출(만 원)",
				takeaway: "주말마다 튀어요"
			}
		}
	},
	slope: {
		summary: "두 시점 사이 크기와 순위 변화",
		useWhen: "작년과 올해 점유율처럼 두 시점만 비교할 때",
		avoidWhen: "시점이 3개 이상일 때(라인 차트나 범프 차트가 맞아요)",
		why: "선 기울기로 오르내림을 바로 알 수 있어요. 가장 많이 오른 항목을 강조해요.",
		channels: {
			label: "항목 이름 필드",
			x: "시점 필드(긴 표)",
			value: "값 필드(긴 표)"
		},
		options: {
			start: "넓은 표: 시작 값 필드",
			end: "넓은 표: 끝 값 필드",
			periodLabels: "양쪽 축 위 제목"
		},
		example: {
			data: slopeSampleKo,
			encoding: {
				label: "brand",
				x: "period",
				value: "share"
			},
			options: { unit: "%" },
			card: {
				subtitle: "브랜드 점유율(%)",
				takeaway: "우리만 크게 올랐어요"
			}
		}
	},
	dumbbell: {
		summary: "항목마다 두 값의 차이(전후, 목표와 실제)",
		useWhen: "지역별 개선 전후처럼 '격차'가 이야기의 중심일 때",
		avoidWhen: "값이 하나뿐일 때",
		why: "막대 두 개보다 잉크가 적고 차이 자체가 선 길이로 보여요.",
		channels: {
			label: "항목 이름 필드",
			start: "이전 값",
			end: "이후 값"
		},
		options: {
			labels: "범례 이름 [이전, 이후]",
			sort: "이후 값 순 정렬",
			zero: "축에 0 포함"
		},
		example: {
			data: dumbbellSampleKo,
			encoding: {
				label: "region",
				start: "before",
				end: "after"
			},
			options: {
				labels: ["2024", "2025"],
				unit: "%"
			},
			card: {
				subtitle: "지역별 구매 전환율(%)",
				takeaway: "서울이 가장 크게 올랐어요"
			}
		}
	},
	lollipop: {
		summary: "막대 대신 선과 점. 항목이 많아도 가벼워요",
		useWhen: "기능별 사용률처럼 항목 7~20개의 순위를 보여 줄 때",
		avoidWhen: "값 차이가 아주 작을 때",
		why: "기본으로 큰 값부터 정렬해서 순위표처럼 읽을 수 있어요.",
		channels: {
			label: "항목 이름 필드",
			value: "값 필드"
		},
		options: {
			orientation: "방향",
			sort: "큰 값부터 정렬"
		},
		example: {
			data: lollipopSampleKo,
			encoding: {
				label: "feature",
				value: "usage"
			},
			options: { unit: "%" },
			card: {
				subtitle: "기능별 주간 사용률(%)",
				takeaway: "검색이 압도적이에요"
			}
		}
	},
	beeswarm: {
		summary: "점 하나하나를 겹치지 않게 늘어놓은 분포",
		useWhen: "사용자 한 명 한 명의 분포를 그룹별로 볼 때",
		avoidWhen: "점이 수천 개를 넘어 겹칠 때(바이올린이나 릿지라인이 맞아요)",
		why: "평균에 가려진 값 하나하나를 보여 주고, 그룹마다 중앙값을 표시해요.",
		channels: {
			value: "값 필드",
			group: "그룹(행) 필드",
			label: "점 이름"
		},
		options: {
			radius: "점 반지름",
			showMedian: "그룹 중앙값 표시",
			canvasThreshold: "점이 이보다 많으면 캔버스로 그려요"
		},
		example: {
			data: beeswarmSampleKo,
			encoding: {
				value: "minutes",
				group: "plan",
				label: "id"
			},
			options: { unit: "분" },
			card: {
				subtitle: "플랜별 하루 사용 시간(분)",
				takeaway: "프로 플랜은 퍼짐도 커요"
			}
		}
	},
	ridgeline: {
		summary: "그룹별 분포를 겹쳐 쌓은 곡선",
		useWhen: "지역별 배송 시간처럼 그룹 5~12개의 분포를 비교할 때",
		avoidWhen: "그룹이 3개 이하일 때(박스 플롯이 간단해요)",
		why: "KDE 곡선이 위에서부터 차례로 솟아오르며 등장해요.",
		channels: {
			group: "그룹 필드",
			value: "값 필드"
		},
		options: {
			overlap: "겹치는 정도",
			bandwidth: "KDE 대역폭",
			sort: "정렬"
		},
		example: {
			data: ridgelineSampleKo,
			encoding: {
				group: "region",
				value: "hours"
			},
			options: { unit: "시간" },
			card: {
				subtitle: "지역별 배송 소요 시간",
				takeaway: "제주만 꼬리가 길어요"
			}
		}
	},
	sankey: {
		summary: "단계 사이 흐름의 양",
		useWhen: "유입 채널에서 구매나 이탈까지 사용자 흐름을 볼 때",
		avoidWhen: "흐름이 순환하거나 노드가 30개를 넘을 때",
		why: "노드 위치를 여러 번 고쳐 겹침을 줄이는 배치(relaxation)를 의존성 없이 구현했어요. 띠가 왼쪽에서 오른쪽으로 흘러가며 등장해요.",
		channels: {
			source: "출발 노드",
			target: "도착 노드",
			value: "값 필드"
		},
		options: {
			nodeWidth: "노드 폭(px)",
			nodePadding: "노드 간격(px)"
		},
		example: {
			data: sankeySampleKo,
			encoding: {
				source: "source",
				target: "target",
				value: "value"
			},
			options: {
				highlight: "구매",
				unit: "명"
			},
			card: {
				subtitle: "유입에서 구매까지(명)",
				takeaway: "상품 상세에서 절반이 떠나요"
			}
		}
	},
	chord: {
		summary: "그룹 사이 주고받는 양",
		useWhen: "팀 사이 협업 요청처럼 양방향 관계를 볼 때",
		avoidWhen: "그룹이 10개를 넘을 때",
		why: "합계가 가장 큰 그룹을 기본으로 강조해서, 복잡한 다이어그램도 '이 팀이 누구와 일하나'로 읽을 수 있어요.",
		channels: {
			source: "보내는 그룹",
			target: "받는 그룹",
			value: "값 필드"
		},
		options: { padAngle: "그룹 사이 틈(라디안)" },
		example: {
			data: chordSampleKo,
			encoding: {
				source: "from",
				target: "to",
				value: "value"
			},
			options: { highlight: "기획" },
			card: {
				subtitle: "팀 사이 협업 요청(건)",
				takeaway: "기획이 허브예요"
			}
		}
	},
	calendar: {
		summary: "하루하루의 양을 주 단위로 늘어놓은 격자",
		useWhen: "커밋, 주문처럼 하루 단위 활동의 리듬을 볼 때",
		avoidWhen: "기간이 한 달보다 짧을 때",
		why: "하루를 칸 하나로 그려요. 주 단위로 왼쪽부터 채워지고, 여러 해면 연도마다 줄을 나눠요.",
		channels: {
			date: "날짜 필드",
			value: "값 필드"
		},
		options: {
			weekStart: "주 시작 요일(0 일요일, 1 월요일)",
			gap: "칸 간격(px)",
			canvasThreshold: "날짜가 이보다 많으면 캔버스로 그려요"
		},
		example: {
			data: calendarSample,
			encoding: {
				date: "date",
				value: "commits"
			},
			options: { unit: "회" },
			card: {
				subtitle: "2025년 하루 커밋 수",
				takeaway: "주말은 조용해요"
			}
		}
	},
	bump: {
		summary: "시간에 따른 순위 변화",
		useWhen: "앱스토어 순위처럼 '몇 위인가'가 중요할 때",
		avoidWhen: "순위 사이 값 차이가 중요할 때",
		why: "순위만 남겨 교차가 잘 보여요. 가장 많이 오른 항목을 자동으로 강조해요.",
		channels: {
			x: "시점 필드",
			series: "항목 필드",
			rank: "순위 필드(1이 1등)",
			value: "값 필드(rank 대신, 큰 값이 1등)"
		},
		options: {},
		example: {
			data: bumpSampleKo,
			encoding: {
				x: "month",
				series: "app",
				rank: "rank"
			},
			card: {
				subtitle: "월별 앱스토어 순위",
				takeaway: "5위에서 1위까지"
			}
		}
	},
	box: {
		summary: "그룹별 분포 요약(사분위, 중앙값, 이상값)",
		useWhen: "API별 응답 시간처럼 분포와 이상값을 같이 볼 때",
		avoidWhen: "청중이 사분위에 익숙하지 않을 때(비스웜이 쉬워요)",
		why: "variant 하나로 박스, 바이올린, 둘 다 중에서 골라요. 중앙값에서 위아래로 펼쳐지며 등장해요.",
		channels: {
			group: "그룹 필드",
			value: "값 필드"
		},
		options: {
			variant: "모양",
			outliers: "이상값 점 표시",
			zero: "축에 0 포함",
			whiskers: "수염 끝 백분위 [낮은 쪽, 높은 쪽]. 예: [5, 95]. 없으면 사분위 범위의 1.5배 안에서 가장 먼 값"
		},
		example: {
			data: boxSample,
			encoding: {
				group: "api",
				value: "ms"
			},
			options: {
				unit: "ms",
				variant: "box"
			},
			card: {
				subtitle: "API별 응답 시간(ms)",
				takeaway: "결제 API가 가장 느려요"
			}
		}
	},
	parallel: {
		summary: "여러 숫자 지표를 축마다 세워 한 줄로 비교",
		useWhen: "제품 사양처럼 지표 4~8개를 한 번에 비교할 때",
		avoidWhen: "청중이 처음 볼 때(설명이 필요해요)",
		why: "강조 한 줄과 회색 다수로 읽기 어려운 형태를 이야기로 바꿔요. 행이 많으면 캔버스로 1만 줄도 그려요.",
		channels: { label: "행 이름 필드" },
		options: {
			dimensions: "축으로 쓸 숫자 필드",
			dimensionLabels: "축 이름 바꾸기",
			invert: "작을수록 좋은 축",
			canvasThreshold: "행이 이보다 많으면 캔버스로 그려요"
		},
		example: {
			data: parallelSampleKo,
			encoding: { label: "model" },
			options: {
				dimensions: [
					"price",
					"weight",
					"battery",
					"perf",
					"screen"
				],
				dimensionLabels: {
					price: "가격(만 원)",
					weight: "무게(kg)",
					battery: "배터리(시간)",
					perf: "성능",
					screen: "화면(인치)"
				},
				invert: ["price", "weight"],
				highlight: "에어 13"
			},
			card: {
				subtitle: "노트북 모델 비교",
				takeaway: "에어 13은 가볍고 싸요"
			}
		}
	},
	candlestick: {
		summary: "기간마다 시가, 고가, 저가, 종가를 담은 봉",
		useWhen: "주가, 환율, 코인처럼 기간 안의 출렁임까지 봐야 할 때",
		avoidWhen: "값이 하나뿐인 추이일 때(라인 차트가 더 깔끔해요)",
		why: "상승 봉은 강조색, 하락 봉은 회색으로 칠해요. 끌어서 기간을 고르면 그 기간의 등락과 최고가, 최저가를 보여 줘요.",
		channels: {
			x: "날짜(시점) 필드",
			open: "시가 필드",
			high: "고가 필드",
			low: "저가 필드",
			close: "종가 필드",
			volume: "거래량 필드"
		},
		options: {
			ma: "종가 이동평균선 기간. 예: [5, 20]",
			upColor: "오르는 봉 색(토큰 이름이나 CSS 색)",
			downColor: "내리는 봉 색",
			maxCandles: "봉이 이보다 많으면 이웃 봉을 합쳐요. 기본값은 그래프 폭 / 4",
			brush: "끌어서 구간 고르기. true면 등락과 최고, 최저를 보여 주고 \"zoom\"이면 그 구간으로 확대(키보드: Shift+화살표, Enter)",
			yDomain: "가격 축 범위 고정",
			annotations: "주석: 목표 구간, 기간, 기준선, 사건, 예측, 종가 추세선, 주말 음영. [{ type, x, y, from, label }]"
		},
		example: {
			data: candlestickSample,
			encoding: {
				x: "date",
				open: "open",
				high: "high",
				low: "low",
				close: "close",
				volume: "volume"
			},
			options: {
				unit: "원",
				ma: [5, 20],
				brush: true
			},
			card: {
				subtitle: "가상 종목 일봉(원)",
				takeaway: "10월 중순부터 고점을 높여요",
				legend: "auto"
			}
		}
	},
	segmented: {
		summary: "전체 하나를 비중대로 나눈 막대와 목록",
		useWhen: "카드 안에서 구성비를 한 줄로 보여 줄 때(항목 2~6개)",
		avoidWhen: "비슷한 값끼리 비교하거나 항목이 많을 때(막대 차트가 더 정확해요)",
		why: "파이보다 공간을 적게 쓰고, 아래 목록에 값과 비중을 함께 보여 줘요.",
		channels: {
			label: "항목 이름 필드",
			value: "값 필드"
		},
		options: {
			variant: "tall은 28px에 비중 글자, thin은 8px",
			sort: "큰 값부터 정렬",
			list: "아래에 이름, 값, 비중 목록 표시"
		},
		example: {
			data: segmentedSampleKo,
			encoding: {
				label: "method",
				value: "amount"
			},
			options: {
				unit: "억",
				highlight: "간편결제"
			},
			card: {
				subtitle: "결제 수단별 거래액(억 원)",
				takeaway: "간편결제가 셋 중 하나"
			}
		}
	},
	skyline: {
		summary: "기간마다 쌓은 양을 블록으로 세우고, 같은 단위의 작은 결과를 앞줄에 세운 차트",
		useWhen: "기간 7~40개의 쌓은 양과 같은 단위의 작은 결과(실패, 재시도)를 대시보드 대표 카드 하나에 담을 때",
		avoidWhen: "음수가 있을 때, 값을 정밀하게 비교할 때(막대가 더 정확해요), 단위가 다른 두 값일 때(차트를 나누고 syncId로 묶어요)",
		why: "수평 바닥에 기간마다 블록을 세워서 높은 블록이 늘 더 많은 값이에요. 강조 계열만 강조색으로 칠하고, 같은 단위의 작은 결과(실패, 재작업)는 같은 눈금의 앞줄에 따로 세워요.",
		channels: {
			x: "기간 필드(날짜나 범주)",
			y: "블록에 쌓을 뒷줄 필드. 넓은 표에서는 배열",
			series: "계열 필드(긴 표, 뒷줄만)",
			front: "앞줄 필드: y와 같은 단위의 작은 결과(넓은 표만)"
		},
		options: {
			depth: "칸 폭 대비 뒷줄 깊이. 0.1~0.32이고, 밖의 값은 범위 안으로 묶어요",
			wall: "뒷벽 눈금과 오른쪽 눈금 글자",
			texture: "빗금을 그릴 줄. 인쇄할 때나 회색 단계를 구분하기 어려운 사용자에게",
			frontRate: "앞줄 합계가 뒷줄의 몇 %인지: \"label\"은 라벨과 툴팁에, \"strip\"은 바닥 아래 비율 띠로, false면 숨겨요"
		},
		example: {
			data: skylineSampleKo,
			encoding: {
				x: "day",
				y: [
					"입력",
					"캐시",
					"출력",
					"추론"
				],
				front: ["실패", "재시도"]
			},
			options: { format: "compact" },
			card: {
				subtitle: "일별 토큰(최근 14일)",
				takeaway: "11월 5일이 가장 많았어요"
			}
		}
	},
	histogram: {
		summary: "원시 표본의 분포, 꼬리, 기준 초과 비율",
		useWhen: "요청 지연 시간처럼 원시 표본 30개 이상의 분포, 꼬리, 기준 초과를 볼 때",
		avoidWhen: "범주를 비교할 때(막대가 맞아요), 표본이 10개 미만일 때(비스웜이 맞아요)",
		why: "기준선의 나쁜 쪽 구간만 강조색으로 칠하고 p50, p95 선에 값을 달아서 범례 없이도 꼬리가 읽혀요. 두 그룹은 구간 경계를 함께 써요.",
		channels: {
			value: "표본 값 필드(원시 행)",
			group: "그룹 필드. 2개까지 겹쳐요",
			x0: "구간 시작(미리 나눈 행)",
			x1: "구간 끝(미리 나눈 행)",
			count: "구간의 표본 수(미리 나눈 행)"
		},
		options: {
			variant: "모양. dots는 점 하나가 N건, step은 겹쳐 보기 좋은 윤곽",
			marks: "라벨을 단 분위 선. 예: [\"p50\", \"p95\", \"p99\"]. p50은 실선, 나머지는 점선. 미리 나눈 행이면 구간 안을 나눠 어림해요",
			threshold: "기준선 { value, label, side }. side \"above\"(기본)나 \"below\"가 나쁜 쪽이고, 그쪽 구간을 강조색으로 칠하고 넘은 표본 수를 설명에 적어요",
			edges: "구간 경계(작은 것부터). 밖의 표본은 그리지 않고 세어서 알려요. 구간은 edges, binWidth, bins, 자동(Freedman-Diaconis, 표본 30개 미만은 Sturges) 순서로 정해요",
			binWidth: "구간 폭. 경계는 폭의 배수예요. log면 쓰지 않아요",
			bins: "대략의 구간 수. 폭은 읽기 쉬운 값으로 맞춰요",
			log: "로그 구간과 로그 축. 모든 값이 0보다 커야 해요",
			kde: "구간 위에 얹는 밀도 곡선(원시 행에서만)"
		},
		example: {
			data: histogramSample,
			encoding: { value: "ms" },
			options: {
				unit: "ms",
				marks: ["p50", "p95"],
				threshold: {
					value: 400,
					label: "목표",
					side: "above"
				}
			},
			card: {
				subtitle: "API 요청 지연 시간(ms)",
				takeaway: "16건 중 1건이 목표를 넘어요",
				legend: [{
					label: "목표 초과",
					color: "accent"
				}, {
					label: "목표 안",
					color: "neutral"
				}]
			}
		}
	},
	scatter: {
		summary: "두 숫자 값의 관계를 점 하나하나로 보고 계열마다 색을 나눈 차트",
		useWhen: "요청별 비용과 응답 시간처럼 두 숫자 값의 관계를 볼 때(계열 4개 이하)",
		avoidWhen: "x가 시간일 때(라인 차트가 나아요), 점이 5만 개를 넘을 때",
		why: "계열 색을 전체 계열로 한 번만 정해서 계열 하나를 숨겨도 나머지 색이 그대로예요. 화살표 키는 그 방향의 가장 가까운 점으로 옮기고, 흔들림은 고정 씨앗을 써서 서버와 브라우저가 같은 그림을 그려요.",
		channels: {
			x: "x 값",
			y: "y 값",
			series: "계열 필드(계열마다 색을 나눠요)",
			label: "이름"
		},
		options: {
			xLabel: "x축 이름",
			yLabel: "y축 이름",
			zero: "축에 0 포함",
			maxLabels: "점 라벨 최대 개수. 계열 채널이 있으면 계열 이름을 대신 붙이고 기본값은 0이에요",
			canvasThreshold: "점이 이보다 많으면 캔버스로 그려요",
			xFormat: "x 값 포맷",
			hidden: "숨길 계열. 색은 모든 계열을 보일 때와 같아요",
			fit: "보이는 점에 맞춘 추세선(최소제곱). 툴팁에 기울기와 R²를 보여 줘요",
			refLines: "기준선 { x, y }. 둘 다 있으면 그림을 사분면으로 나눠요",
			quadrants: "사분면 이름. refLines에 x와 y가 모두 있을 때 그려요. 순서는 왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래",
			jitter: "{ amount, seed }: x 값이 같은 점을 옆으로 퍼뜨려요. 가장 좁은 x 간격 × amount(기본 0.4)까지 움직이고, 씨앗(seed, 기본 1)이 같으면 언제나 같은 그림이에요"
		},
		example: {
			data: scatterSampleKo,
			encoding: {
				x: "cost",
				y: "ms",
				series: "model",
				label: "id"
			},
			options: {
				highlight: "대형",
				xLabel: "비용(센트)",
				yLabel: "응답 시간(ms)",
				unit: "ms",
				refLines: { y: 2e3 },
				quadrants: [
					"느리고 저렴",
					"느리고 비쌈",
					"빠르고 저렴",
					"빠르고 비쌈"
				]
			},
			card: {
				subtitle: "모델별 요청 비용과 응답 시간",
				takeaway: "2초를 넘는 건 대형 모델뿐이에요",
				legend: "auto"
			}
		}
	}
};
var KO_LOCALE = "ko-KR";
function withKoLocale(spec) {
	const { card, ...rest } = spec;
	return {
		...rest,
		options: {
			locale: KO_LOCALE,
			...rest.options
		},
		...card ? { card } : {}
	};
}
function localizeDef(def, lang) {
	const ko = lang === "ko" ? KO_CHARTS[def.type] : void 0;
	if (!ko) return def;
	const name = META[def.type]?.nameKo ?? def.name;
	const { card, ...spec } = ko.example;
	const { legend, ...text } = card;
	return {
		...def,
		name,
		summary: ko.summary,
		useWhen: ko.useWhen,
		avoidWhen: ko.avoidWhen,
		why: ko.why,
		encoding: def.encoding.map((c) => ({
			...c,
			description: ko.channels[c.name] ?? c.description
		})),
		options: def.options.map((o) => ({
			...o,
			description: ko.options[o.name] ?? o.description
		})),
		example: withKoLocale({
			type: def.type,
			...spec,
			card: {
				number: def.example.card?.number,
				title: name,
				...text,
				level: findLevel(def.level)?.ko,
				...legend && { legend }
			}
		})
	};
}
function chartsIn(lang) {
	return lang === "ko" ? CHARTS.map((c) => localizeDef(c, "ko")) : CHARTS;
}
var SOURCE_RE = /^(source|from|src|출발|보낸|origin|시작)/i;
var TARGET_RE = /^(target|to|dst|도착|받은|dest)/i;
var DATE_NAME = /(date|day|month|week|year|time|날짜|일자|월|주|연도|시간|기간|period)/i;
var YEAR_NAME = /(year|연도|년도|^년$)/i;
var MONTH_KO = /^(1[0-2]|[1-9])월$/;
var YMD = /^\d{8}$/;
var RANK_RE = /(rank|순위|등수)/i;
var STAGE_RE = /(stage|step|funnel|단계|스텝)/i;
var BEFORE_RE = /(before|prev|start|이전|전|작년|기존|old)/i;
var AFTER_RE = /(after|next|end|이후|후|올해|신규|new)/i;
var TARGET_KPI = /(target|goal|목표)/i;
function profileData(rows) {
	const sample = rows.slice(0, 5e3);
	const columns = uniq(sample.slice(0, 200).flatMap((r) => Object.keys(r ?? {}))).map((name) => {
		const vals = sample.map((r) => r?.[name]);
		const present = vals.filter((v2) => v2 !== null && v2 !== void 0 && v2 !== "");
		const nulls = vals.length - present.length;
		const nums = present.map((v2) => toNumber(v2));
		const numOk = present.length ? nums.filter(Number.isFinite).length / present.length : 0;
		const distinct = new Set(present.map((v2) => String(v2))).size;
		if (present.length && present.every((v2) => typeof v2 === "string" && MONTH_KO.test(v2.trim()))) return {
			name,
			kind: "date",
			distinct,
			nulls,
			daily: false
		};
		const compact = YEAR_NAME.test(name) && nums.every(isYear) || DATE_NAME.test(name) && present.every((v2) => YMD.test(String(v2).trim()) && toDate(v2));
		if (present.length > 0 && (compact || present.every((v2) => typeof v2 === "string" && /^\d{4}[-./]\d{1,2}([-./]\d{1,2})?/.test(v2) || v2 instanceof Date) && present.filter((v2) => toDate(v2)).length / present.length > .9)) {
			const ts = present.map((v2) => toDate(v2).getTime()).sort((a, b) => a - b);
			const gaps = ts.slice(1).map((t, i) => t - ts[i]).filter((g) => g > 0);
			const med = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;
			return {
				name,
				kind: "date",
				distinct,
				nulls,
				min: ts[0],
				max: ts[ts.length - 1],
				daily: med > 0 && med <= 1296e5
			};
		}
		if (numOk >= .9 && !(typeof present[0] === "string" && /^0\d/.test(String(present[0])))) {
			const f = nums.filter(Number.isFinite);
			return {
				name,
				kind: "number",
				distinct,
				nulls,
				min: Math.min(...f),
				max: Math.max(...f),
				negatives: f.some((v2) => v2 < 0),
				integer: f.every((v2) => Number.isInteger(v2))
			};
		}
		const avgLen = present.reduce((a, v2) => a + String(v2).length, 0) / Math.max(1, present.length);
		return {
			name,
			kind: distinct <= Math.max(60, present.length * .6) && avgLen < 40 ? "category" : "text",
			distinct,
			nulls
		};
	});
	return {
		rows: rows.length,
		columns
	};
}
function mk(type, score, reason, rows, encoding, options) {
	const def = getChartDef(type);
	return {
		type,
		name: def.name,
		score: Math.round(score * 100) / 100,
		reason,
		spec: {
			type,
			data: rows.slice(0, 5e3),
			encoding,
			...options ? { options } : {},
			card: {
				title: def.name,
				takeaway: def.summary,
				level: def.level
			}
		}
	};
}
function inLang(s, lang) {
	if (lang === "en") return s;
	const def = localizeDef(getChartDef(s.type), lang);
	return {
		...s,
		name: def.name,
		spec: withKoLocale({
			...s.spec,
			card: {
				...s.spec.card,
				title: def.name,
				takeaway: def.summary
			}
		})
	};
}
function suggestCharts(rows, opts = {}) {
	const lang = opts.lang ?? "en";
	const t = (en, ko) => lang === "ko" ? ko : en;
	const profile = profileData(rows);
	const cols = profile.columns;
	const n = profile.rows;
	const nums = cols.filter((c) => c.kind === "number" && !RANK_RE.test(c.name));
	const ranksC = cols.filter((c) => c.kind === "number" && RANK_RE.test(c.name));
	const dates = cols.filter((c) => c.kind === "date");
	const cats = cols.filter((c) => c.kind === "category");
	const out = [];
	const v0 = nums[0];
	if (!n || !cols.length) return {
		profile,
		suggestions: []
	};
	const src = cats.find((c) => SOURCE_RE.test(c.name));
	const dst = cats.find((c) => TARGET_RE.test(c.name));
	if (src && dst && v0) {
		const pairs = new Set(rows.map((r) => `${r[src.name]}>${r[dst.name]}`));
		const reciprocal = rows.some((r) => pairs.has(`${r[dst.name]}>${r[src.name]}`));
		const srcVals = new Set(rows.map((r) => String(r[src.name])));
		const chained = rows.some((r) => srcVals.has(String(r[dst.name])));
		if (reciprocal) out.push(mk("chord", .92, t(`${src.name}→${dst.name} goes both ways, so a chord diagram fits`, `${src.name}→${dst.name} 관계가 양방향이라 코드 다이어그램이 맞아요`), rows, {
			source: src.name,
			target: dst.name,
			value: v0.name
		}));
		out.push(mk("sankey", reciprocal ? .8 : .95, chained ? t("The flow runs through several stages, which a Sankey diagram shows well", "흐름이 여러 단계로 이어져서 생키 다이어그램이 잘 맞아요") : t("A Sankey diagram shows the amount between source and target as band width", "생키 다이어그램으로 출발과 도착 사이 양을 띠 굵기로 보여 줘요"), rows, {
			source: src.name,
			target: dst.name,
			value: v0.name
		}));
	}
	const t0 = dates[0];
	if (t0 && v0) {
		const seriesCat = cats.find((c) => c.distinct >= 2 && c.distinct <= 12);
		const span = (t0.max ?? 0) - (t0.min ?? 0);
		const xt = rows.slice(0, 50).some((r) => YMD.test(String(r[t0.name] ?? "").trim())) ? { xType: "date" } : void 0;
		if (t0.daily && span > 5184e6 && !seriesCat) out.push(mk("calendar", .9, t("Daily values over more than two months show weekday and seasonal patterns in a calendar heatmap", "하루 단위 값이 두 달 넘게 있어 캘린더 히트맵으로 요일, 계절 패턴이 보여요"), rows, {
			date: t0.name,
			value: v0.name
		}));
		if (seriesCat) {
			out.push(mk("line", .93, t(`Compares the ${t0.name} trend by ${seriesCat.name} (one highlighted line, the rest gray)`, `${t0.name} 흐름을 ${seriesCat.name}별로 비교해요(강조 한 줄, 나머지는 회색)`), rows, {
				x: t0.name,
				y: v0.name,
				series: seriesCat.name
			}, xt));
			out.push(mk("area", .8, t("If the series add up to something meaningful, stacked areas show how the mix changes", "계열 합이 의미 있으면 쌓은 영역으로 구성 변화를 봐요"), rows, {
				x: t0.name,
				y: v0.name,
				series: seriesCat.name
			}, xt));
			if (seriesCat.distinct >= 5) out.push(mk("stream", .72, t("With many series, a streamgraph can show the rhythm of the flow", "계열이 많아서 스트림그래프로 흐름의 리듬을 보여 줄 수 있어요"), rows, {
				x: t0.name,
				y: v0.name,
				series: seriesCat.name
			}));
		} else {
			out.push(mk("line", .9, t(`A line chart shows ${v0.name} over ${t0.name}`, `라인 차트로 ${t0.name}에 따른 ${v0.name} 추이를 봐요`), rows, {
				x: t0.name,
				y: nums.length > 1 && nums.length <= 6 ? nums.map((c) => c.name) : v0.name
			}, nums.length <= 1 ? {
				...xt,
				area: true
			} : xt));
			out.push(mk("sparkline", .6, t("A sparkline fits the trend next to a KPI", "스파크라인으로 KPI 옆에 작은 추세선을 넣어요"), rows, {
				x: t0.name,
				y: v0.name
			}));
		}
	}
	const rk = ranksC[0];
	const timeCat = dates[0] ?? cats.find((c) => DATE_NAME.test(c.name));
	const item = cats.find((c) => c !== timeCat && c.distinct >= 3 && c.distinct <= 12);
	if (rk && timeCat && item) out.push(mk("bump", .94, t(`There is a ${rk.name} field, so a bump chart shows the rank changes`, `${rk.name} 필드가 있어서 범프 차트로 순위 변화를 보여 줘요`), rows, {
		x: timeCat.name,
		series: item.name,
		rank: rk.name
	}));
	const cat = cats.find((c) => c !== src && c !== dst && !STAGE_RE.test(c.name)) ?? cats[0];
	const stage = cats.find((c) => STAGE_RE.test(c.name));
	if (stage && v0 && !src) {
		const vals = rows.map((r) => toNumber(r[v0.name]));
		if (vals.every((v2, i) => i === 0 || v2 <= vals[i - 1])) out.push(mk("funnel", .96, t("Values shrink at every stage, so a funnel shows the drop-off", "단계마다 값이 줄어서 퍼널 차트로 이탈을 보여 줘요"), rows, {
			label: stage.name,
			value: v0.name
		}));
	}
	if (cat && v0 && !t0 && !src) {
		const perCat = n / Math.max(1, cat.distinct);
		const second = cats.find((c) => c !== cat && c !== src && c !== dst);
		if (perCat >= 6 && !second) {
			out.push(mk("box", .86, t(`Each ${cat.name} has many values, so a box plot summarizes the distribution`, `${cat.name}마다 값이 여러 개라 분포를 박스 플롯으로 요약해요`), rows, {
				group: cat.name,
				value: v0.name
			}));
			out.push(mk("beeswarm", n <= 1500 ? .84 : .6, t("A beeswarm shows every single dot", "비스웜으로 점 하나하나를 보여 줘요"), rows, {
				group: cat.name,
				value: v0.name
			}));
			if (cat.distinct >= 4) out.push(mk("ridgeline", .8, t("With several groups, a ridgeline compares the shape of each distribution", "그룹이 여러 개라 릿지라인으로 분포 모양을 비교해요"), rows, {
				group: cat.name,
				value: v0.name
			}));
		} else if (second && cat.distinct <= 40) {
			const pairs = new Set(rows.map((r) => `${r[cat.name]}|${r[second.name]}`)).size;
			const parent = cat.distinct < second.distinct ? cat : second;
			const child = parent === cat ? second : cat;
			const childToParent = /* @__PURE__ */ new Map();
			rows.forEach((r) => {
				const k = String(r[child.name]);
				if (!childToParent.has(k)) childToParent.set(k, /* @__PURE__ */ new Set());
				childToParent.get(k).add(String(r[parent.name]));
			});
			const hierarchical = [...childToParent.values()].every((s) => s.size === 1) && child.distinct > parent.distinct;
			const full = pairs >= cat.distinct * second.distinct * .8;
			if (hierarchical) {
				out.push(mk("treemap", .92, t(`${child.name} sits under ${parent.name}, so a treemap fits the hierarchy`, `${child.name} 필드가 ${parent.name} 필드 아래에 있는 계층이라 트리맵이 맞아요`), rows, {
					group: parent.name,
					label: child.name,
					value: v0.name
				}));
				out.push(mk("sunburst", .82, t("A sunburst shows the same hierarchy in rings", "선버스트로 같은 계층을 고리 모양으로 보여 줘요"), rows, {
					group: parent.name,
					label: child.name,
					value: v0.name
				}));
			} else if (full) {
				const rowsCat = cat.distinct <= second.distinct ? cat : second;
				const colsCat = rowsCat === cat ? second : cat;
				out.push(mk("heatmap", .88, t(`The ${rowsCat.name} × ${colsCat.name} grid is full, so a heatmap shows the pattern`, `${rowsCat.name} × ${colsCat.name} 격자가 꽉 차 있어 히트맵으로 패턴을 봐요`), rows, {
					x: colsCat.name,
					y: rowsCat.name,
					value: v0.name
				}));
				if (colsCat.distinct <= 6 && rowsCat.distinct <= 5) out.push(mk("marimekko", .74, t("A marimekko shows the column share and the share within each column together", "마리메코 차트로 열 비중과 열 안 비중을 함께 보여 줘요"), rows, {
					x: colsCat.name,
					series: rowsCat.name,
					value: v0.name
				}));
				if (rowsCat.distinct <= 4) out.push(mk("bar", .8, t("Grouped bars compare each series by category", "범주별로 계열을 묶은 막대로 비교해요"), rows, {
					x: colsCat.name,
					y: v0.name,
					series: rowsCat.name
				}));
				const periodsC = [cat, second].find((c) => c.distinct === 2);
				const other = periodsC === cat ? second : cat;
				if (periodsC) out.push(mk("slope", .86, t(`${periodsC.name} has only two values, so a slope chart shows the change`, `${periodsC.name} 값이 두 개뿐이라 슬로프 차트로 변화를 보여 줘요`), rows, {
					label: other.name,
					x: periodsC.name,
					value: v0.name
				}));
				if (colsCat.distinct >= 4 && colsCat.distinct <= 10 && rowsCat.distinct <= 3) out.push(mk("radar", .7, t("A radar chart compares several metrics by series", "레이더 차트로 지표 여러 개를 계열별로 비교해요"), rows, {
					axis: colsCat.name,
					series: rowsCat.name,
					value: v0.name
				}));
			}
		} else {
			const k = cat.distinct;
			const vals = rows.map((r) => toNumber(r[v0.name])).filter(Number.isFinite);
			const allPos = vals.every((v2) => v2 >= 0);
			const hasNeg = vals.some((v2) => v2 < 0);
			const sorted = [...vals].sort((a, b) => b - a);
			const tot = sorted.reduce((a, b) => a + b, 0) || 1;
			const top20 = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * .2))).reduce((a, b) => a + b, 0) / tot;
			if (hasNeg && n >= 3) out.push(mk("waterfall", .9, t("Positive and negative values are mixed, so a waterfall separates the ups and downs", "양수와 음수가 섞여 있어 폭포 차트로 증감을 나눠요"), rows, {
				label: cat.name,
				value: v0.name
			}));
			if (allPos && k >= 2 && k <= 4) {
				out.push(mk("pie", .88, t(`With ${k} items, a pie chart shows the shares at a glance`, `항목이 ${k}개라 파이 차트로 비중이 바로 보여요`), rows, {
					label: cat.name,
					value: v0.name
				}));
				out.push(mk("donut", .86, t("A donut chart adds the total in the center", "도넛 차트로 가운데에 합계를 함께 보여 줘요"), rows, {
					label: cat.name,
					value: v0.name
				}));
				if (k <= 3) out.push(mk("waffle", .75, t("A waffle chart shows it in 100 cells, like a head count", "와플 차트로 100칸 중 몇 칸인지 사람 수처럼 보여 줘요"), rows, {
					label: cat.name,
					value: v0.name
				}));
			}
			if (allPos && k >= 5 && k <= 7) out.push(mk("donut", .7, t("A few more items, but a donut chart can still show the shares", "항목이 조금 많지만 도넛 차트로 비중을 볼 수 있어요"), rows, {
				label: cat.name,
				value: v0.name
			}));
			out.push(mk("bar", k <= 12 ? .85 : .7, t("A bar chart compares sizes across categories most accurately", "막대 차트로 범주끼리 크기를 가장 정확하게 비교해요"), rows, {
				x: cat.name,
				y: v0.name
			}, k > 8 ? {
				orientation: "horizontal",
				sort: true
			} : void 0));
			if (k >= 6) out.push(mk("lollipop", .82, t("Many items, so a lollipop chart stays light", "항목이 많아도 롤리팝 차트는 가볍게 보여요"), rows, {
				label: cat.name,
				value: v0.name
			}));
			if (allPos && k >= 6 && top20 >= .5) out.push(mk("pareto", .86, t(`The top 20% make up ${Math.round(top20 * 100)}%, so a Pareto chart shows the concentration`, `상위 20%가 ${Math.round(top20 * 100)}%를 차지해서 파레토 차트로 집중도를 보여 줘요`), rows, {
				label: cat.name,
				value: v0.name
			}));
			if (allPos && k >= 6) out.push(mk("treemap", .66, t("A treemap shows the shares as area", "트리맵으로 비중을 넓이로 보여 줘요"), rows, {
				label: cat.name,
				value: v0.name
			}));
			if (vals.length >= 3 && vals.every((v2, i) => i === 0 || v2 <= vals[i - 1]) && k <= 8) out.push(mk("funnel", .78, t("Values keep shrinking, so it reads like a funnel", "값이 계속 줄어서 퍼널 차트로 읽을 수 있어요"), rows, {
				label: cat.name,
				value: v0.name
			}));
			if (allPos && vals.every((v2) => v2 <= 100) && k <= 6) out.push(mk("radialBar", .66, t("Values from 0 to 100 read as progress rings", "0~100 사이 값이라 달성률 고리로 보여 줘요"), rows, {
				label: cat.name,
				value: v0.name
			}));
		}
	}
	if (cat && nums.length >= 2 && !t0) {
		const a = nums.find((c) => BEFORE_RE.test(c.name));
		const b = nums.find((c) => AFTER_RE.test(c.name) && c !== a);
		const tg = nums.find((c) => TARGET_KPI.test(c.name));
		if (a && b) {
			out.push(mk("dumbbell", .9, t(`A dumbbell chart shows the gap between ${a.name} and ${b.name}`, `덤벨 차트로 ${a.name} 값과 ${b.name} 값의 차이를 보여 줘요`), rows, {
				label: cat.name,
				start: a.name,
				end: b.name
			}));
			out.push(mk("slope", .82, t("A slope chart shows the change between two points in time", "슬로프 차트로 두 시점 사이 변화를 보여 줘요"), rows, { label: cat.name }, {
				start: a.name,
				end: b.name
			}));
		}
		if (tg) {
			const actual = nums.find((c) => c !== tg && !/(poor|ok|good|나쁨|보통|좋음)/i.test(c.name));
			if (actual) out.push(mk("bullet", .88, t("There is a target field, so a bullet chart shows attainment", "목표 필드가 있어서 불릿 차트로 목표 달성 정도를 보여 줘요"), rows, {
				label: cat.name,
				value: actual.name,
				target: tg.name
			}));
		}
	}
	if (nums.length >= 1 && n === 1) {
		const tg = nums.find((c) => TARGET_KPI.test(c.name));
		const val = nums.find((c) => c !== tg) ?? nums[0];
		out.push(mk("gauge", .95, t("A single value works best as a large gauge", "값이 하나라서 게이지로 크게 보여 줘요"), rows, {
			value: val.name,
			...tg ? { target: tg.name } : {}
		}));
	}
	if (nums.length >= 2 && !src) {
		const label = cats[0] ?? cols.find((c) => c.kind === "text");
		if (nums.length >= 4 && n <= 2e4) out.push(mk("parallel", nums.length >= 5 ? .84 : .7, t(`${nums.length} numeric metrics, so parallel coordinates compare them one line per row`, `숫자 지표가 ${nums.length}개라 평행 좌표로 한 줄씩 비교해요`), rows, label ? { label: label.name } : {}, { dimensions: nums.slice(0, 8).map((c) => c.name) }));
		const enc = {
			x: nums[0].name,
			y: nums[1].name
		};
		if (nums[2]) enc.size = nums[2].name;
		if (label) enc.label = label.name;
		out.push(mk(nums[2] ? "bubble" : "scatter", nums[2] ? .86 : .8, nums[2] ? t(`A bubble chart shows ${nums[0].name}, ${nums[1].name} and ${nums[2].name} together`, `버블 차트로 ${nums[0].name}, ${nums[1].name}, ${nums[2].name} 세 값을 함께 보여 줘요`) : t(`A scatter plot shows how ${nums[0].name} relates to ${nums[1].name}`, `산점도로 ${nums[0].name} 값과 ${nums[1].name} 값의 관계를 보여 줘요`), rows, enc));
	}
	const best = /* @__PURE__ */ new Map();
	for (const s of out) {
		const prev = best.get(s.type);
		if (!prev || s.score > prev.score) best.set(s.type, s);
	}
	return {
		profile,
		suggestions: [...best.values()].sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 5).map((s) => inLang(s, lang))
	};
}
var CHART_FAMILIES = Object.freeze([
	{
		id: "all",
		labelKo: "전체",
		labelEn: "All"
	},
	{
		id: "comparison",
		labelKo: "비교",
		labelEn: "Comparison"
	},
	{
		id: "trend",
		labelKo: "추세",
		labelEn: "Trend"
	},
	{
		id: "proportion",
		labelKo: "비율",
		labelEn: "Proportion"
	},
	{
		id: "relationship",
		labelKo: "관계",
		labelEn: "Relationship"
	},
	{
		id: "distribution",
		labelKo: "분포",
		labelEn: "Distribution"
	},
	{
		id: "flow",
		labelKo: "흐름",
		labelEn: "Flow"
	},
	{
		id: "hierarchy",
		labelKo: "계층",
		labelEn: "Hierarchy"
	},
	{
		id: "kpi",
		labelKo: "KPI",
		labelEn: "KPI"
	}
]);
var CHART_TYPES = Object.freeze(CHARTS.map((def) => def.type));
var CHART_TYPE_SET = new Set(CHART_TYPES);
/** Quick-switch chart types exposed directly in the selection-bar segmented control. */
var QUICK_CHART_OPTIONS = Object.freeze([
	{
		label: "막대",
		value: "bar"
	},
	{
		label: "라인",
		value: "line"
	},
	{
		label: "영역",
		value: "area"
	},
	{
		label: "파이",
		value: "pie"
	},
	{
		label: "도넛",
		value: "donut"
	},
	{
		label: "산점도",
		value: "scatter"
	},
	{
		label: "레이더",
		value: "radar"
	},
	{
		label: "생키",
		value: "sankey"
	}
]);
var CHART_DEFAULTS = Object.freeze({
	chartType: "bar",
	title: "",
	subtitle: "",
	takeaway: "",
	theme: "light",
	locale: "ko",
	variant: "card",
	legendMode: "auto",
	accentColor: "#3182f6",
	backgroundColor: "",
	cornerRadius: 0,
	data: [],
	encoding: {},
	options: {}
});
var HIGHLIGHT_PRESETS = Object.freeze([
	{
		id: "auto",
		value: "auto",
		labelKo: "자동",
		labelEn: "Auto"
	},
	{
		id: "max",
		value: "max",
		labelKo: "최댓값",
		labelEn: "Max"
	},
	{
		id: "min",
		value: "min",
		labelKo: "최솟값",
		labelEn: "Min"
	},
	{
		id: "first",
		value: "first",
		labelKo: "첫 항목",
		labelEn: "First"
	},
	{
		id: "last",
		value: "last",
		labelKo: "끝 항목",
		labelEn: "Last"
	},
	{
		id: "none",
		value: "none",
		labelKo: "없음",
		labelEn: "None"
	}
]);
function isValidHexColor(value) {
	return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim());
}
/** Stored card background: a hex color, `transparent`, or '' for the theme panel. */
function resolveBackgroundColor(value) {
	if (typeof value !== "string") return "";
	const trimmed = value.trim();
	if (trimmed.toLowerCase() === "transparent") return "transparent";
	return isValidHexColor(trimmed) ? trimmed : "";
}
/** Card corner radius in pixels. Square by default; capped so a card cannot become a circle. */
function resolveCornerRadius(value) {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.min(64, Math.round(n));
}
var CATALOG_CACHE = {
	ko: Object.freeze(chartsIn("ko").map((def) => {
		const canonical = getChartDef(def.type);
		return Object.freeze({
			type: def.type,
			family: canonical?.family || canonical?.group || "comparison",
			name: def.name,
			summary: def.summary || def.whenToUse?.[0] || "",
			whenToUse: Object.freeze([...def.whenToUse ?? []]),
			avoidWhen: Object.freeze([...def.avoidWhen ?? []]),
			encodings: Object.freeze({ ...def.example?.encoding ?? {} }),
			example: def.example
		});
	})),
	en: Object.freeze(chartsIn("en").map((def) => {
		const canonical = getChartDef(def.type);
		return Object.freeze({
			type: def.type,
			family: canonical?.family || canonical?.group || "comparison",
			name: def.name,
			summary: def.summary || def.whenToUse?.[0] || "",
			whenToUse: Object.freeze([...def.whenToUse ?? []]),
			avoidWhen: Object.freeze([...def.avoidWhen ?? []]),
			encodings: Object.freeze({ ...def.example?.encoding ?? {} }),
			example: def.example
		});
	}))
};
function normalizeLang(locale) {
	if (typeof locale === "string" && locale.toLowerCase().startsWith("en")) return "en";
	return "ko";
}
function normalizeLocaleTag(locale) {
	return normalizeLang(locale) === "en" ? "en-US" : "ko-KR";
}
function normalizeChartType(type) {
	if (typeof type === "string" && CHART_TYPE_SET.has(type)) return type;
	return "bar";
}
function getChartCatalog(locale = "ko") {
	return CATALOG_CACHE[normalizeLang(locale)];
}
function getLocalizedChartDef(chartType, locale = "ko") {
	const safeType = normalizeChartType(chartType);
	const lang = normalizeLang(locale);
	return localizeDef(getChartDef(safeType) ?? getChartDef("bar"), lang);
}
function resolveChartTheme(theme = "light", accentColor = "#3182f6", backgroundColor = "", neutralColor = "") {
	const validBg = isValidHexColor(backgroundColor) ? backgroundColor.trim() : "";
	const validAccent = isValidHexColor(accentColor) ? accentColor.trim() : "";
	const validNeutral = isValidHexColor(neutralColor) ? neutralColor.trim() : "";
	const parsedBg = validBg ? parseColor(validBg) : null;
	const baseName = parsedBg ? luminance(parsedBg) < .28 ? "dark" : "light" : theme === "dark" ? "dark" : "light";
	const baseTheme = resolveThemeInput(baseName);
	const customTokens = {};
	if (validAccent) {
		customTokens.accent = validAccent;
		customTokens.accentText = validAccent;
	}
	if (validBg) {
		customTokens.bg = validBg;
		customTokens.panel = validBg;
		customTokens.line = mixHex(validBg, baseTheme.ink, baseName === "dark" ? .14 : .11);
		customTokens.line2 = mixHex(validBg, baseTheme.ink, baseName === "dark" ? .09 : .06);
		customTokens.lift = mixHex(validBg, baseTheme.ink, baseName === "dark" ? .06 : .04);
		customTokens.neutralSoft = mixHex(validBg, baseTheme.ink, baseName === "dark" ? .1 : .08);
	}
	if (validNeutral) {
		const panelRef = validBg || baseTheme.panel;
		customTokens.neutral = validNeutral;
		customTokens.neutralStrong = mixHex(validNeutral, baseTheme.ink, .28);
		customTokens.neutralSoft = mixHex(validNeutral, panelRef, .72);
	}
	if (Object.keys(customTokens).length > 0) return resolveThemeInput({
		...baseTheme,
		...customTokens
	});
	return baseTheme;
}
function isPlainRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function cloneJsonRows(rows) {
	if (!Array.isArray(rows)) return [];
	const cleaned = [];
	for (const item of rows) {
		if (!isPlainRecord$1(item)) continue;
		const row = {};
		for (const [k, v] of Object.entries(item)) if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) row[k] = v;
		if (Object.keys(row).length > 0) cleaned.push(row);
	}
	return cleaned;
}
/**
* Attempts to adapt encoding keys when a user switches `chartType` on custom tabular data.
*/
function adaptEncodingForType(chartType, rows, currentEncoding, lang) {
	if (!Array.isArray(rows) || rows.length === 0) return null;
	try {
		const suggested = suggestCharts(rows, { lang })?.suggestions?.find((item) => item.type === chartType);
		if (suggested?.spec?.encoding) return { ...suggested.spec.encoding };
	} catch {}
	const columns = profileData(rows)?.columns ?? [];
	if (columns.length === 0) return null;
	const catCols = columns.filter((c) => c.kind === "category" || c.kind === "date");
	const numCols = columns.filter((c) => c.kind === "number");
	const firstDim = currentEncoding?.x || currentEncoding?.label || currentEncoding?.stage || currentEncoding?.category || catCols[0]?.name || columns[0]?.name;
	const secondDim = currentEncoding?.series || currentEncoding?.group || catCols[1]?.name;
	const firstNum = currentEncoding?.y || currentEncoding?.value || numCols[0]?.name || columns[1]?.name || columns[0]?.name;
	const secondNum = numCols[1]?.name || firstNum;
	const thirdNum = numCols[2]?.name || secondNum;
	const exampleEncoding = getLocalizedChartDef(chartType, lang)?.example?.encoding ?? {};
	const neededKeys = Object.keys(exampleEncoding);
	const adapted = {};
	for (const key of neededKeys) {
		if (currentEncoding && typeof currentEncoding[key] === "string" && columns.some((c) => c.name === currentEncoding[key])) {
			adapted[key] = currentEncoding[key];
			continue;
		}
		if ([
			"x",
			"label",
			"stage",
			"category",
			"item",
			"region",
			"feature",
			"goal",
			"kpi",
			"method",
			"day",
			"date",
			"week",
			"month",
			"quarter",
			"brand",
			"api",
			"model"
		].includes(key)) {
			if (firstDim) adapted[key] = firstDim;
		} else if ([
			"y",
			"value",
			"amount",
			"sales",
			"count",
			"users",
			"customers",
			"share",
			"spend",
			"orders",
			"score",
			"mau",
			"visits",
			"hours",
			"revenue",
			"rate",
			"actual",
			"usage",
			"minutes",
			"commits",
			"ms"
		].includes(key)) {
			if (firstNum) adapted[key] = firstNum;
		} else if ([
			"series",
			"group",
			"channel",
			"product",
			"team",
			"plan"
		].includes(key)) {
			if (secondDim) adapted[key] = secondDim;
		} else if (key === "source" || key === "from") {
			if (firstDim) adapted[key] = firstDim;
		} else if (key === "target" || key === "to") {
			if (secondDim || firstNum) adapted[key] = secondDim || firstNum;
		} else if (key === "before" || key === "low" || key === "open") {
			if (firstNum) adapted[key] = firstNum;
		} else if (key === "after" || key === "high" || key === "close") {
			if (secondNum) adapted[key] = secondNum;
		} else if (key === "size" || key === "r") {
			if (thirdNum) adapted[key] = thirdNum;
		} else if (key === "dimensions" || key === "metrics" || key === "columns") adapted[key] = numCols.map((c) => c.name);
	}
	return Object.keys(adapted).length > 0 ? adapted : null;
}
/**
* Resolves highlighted indices in the same way as `ztd-charts`'s internal `resolveHighlight`.
*/
function resolveHighlightIndices(highlight, labels = [], values = [], fallback = "max") {
	const out = /* @__PURE__ */ new Set();
	const n = labels.length;
	const pick = (mode) => {
		if (!n || mode === "none") return;
		if (mode === "first") out.add(0);
		else if (mode === "last") out.add(n - 1);
		else if (mode === "max" || mode === "min") {
			let best = -1;
			let bv = mode === "max" ? -Infinity : Infinity;
			values.forEach((v, i) => {
				const num = Number(v);
				if (!Number.isFinite(num)) return;
				if (mode === "max" ? num > bv : num < bv) {
					bv = num;
					best = i;
				}
			});
			if (best >= 0) out.add(best);
		}
	};
	if (highlight === void 0 || highlight === null || highlight === "" || highlight === "auto") {
		pick(fallback);
		return out;
	}
	const list = Array.isArray(highlight) ? highlight : [highlight];
	for (const item of list) if (typeof item === "number") {
		if (item >= 0 && item < n) out.add(item);
	} else if (item === "max" || item === "min" || item === "first" || item === "last" || item === "none") pick(item);
	else if (typeof item === "string") labels.forEach((l, i) => {
		if (String(l) === item) out.add(i);
	});
	return out;
}
function sanitizeItemColors(rawItemColors) {
	if (!isPlainRecord$1(rawItemColors)) return {};
	const out = {};
	for (const [k, v] of Object.entries(rawItemColors)) {
		const key = String(k ?? "").trim();
		if (!key || !isValidHexColor(v)) continue;
		out[key] = v.trim();
	}
	return out;
}
function uniqueStrings(items) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const item of items) {
		const str = String(item ?? "").trim();
		if (!str || seen.has(str)) continue;
		seen.add(str);
		out.push(str);
	}
	return out;
}
function defaultCategoricalSwatches(resolvedTheme, count, hiSet) {
	const out = new Array(count);
	const rest = [];
	for (let i = 0; i < count; i++) if (hiSet.has(i)) out[i] = resolvedTheme.accent;
	else rest.push(i);
	const k = rest.length;
	rest.forEach((idx, j) => {
		if (k === 1) out[idx] = resolvedTheme.neutral;
		else if (j === 0) out[idx] = resolvedTheme.ink;
		else if (j === k - 1) out[idx] = resolvedTheme.neutral;
		else if (k === 3) out[idx] = resolvedTheme.neutralStrong;
		else {
			const t = (j - 1) / Math.max(1, k - 2);
			out[idx] = t <= .001 ? resolvedTheme.neutralStrong : mixHex(resolvedTheme.neutralStrong, resolvedTheme.neutral, 1 - t);
		}
	});
	return out;
}
function attachTargetMetadata(items, kind = "category") {
	const normalized = items.map((it) => ({
		...it,
		id: it.id ?? it.key,
		key: it.key ?? it.id
	}));
	Object.defineProperty(normalized, "items", {
		value: normalized,
		enumerable: false
	});
	Object.defineProperty(normalized, "kind", {
		value: kind,
		enumerable: false
	});
	return normalized;
}
/**
* Extracts selectable data components (series, categories, slices, nodes, or up/down)
* for highlight selection and per-component color customization.
*/
function extractChartDataTargets(chartType, rows = [], encoding = {}, options = {}, resolvedTheme = resolveChartTheme("light"), localeTag = "ko-KR") {
	const safeType = normalizeChartType(chartType);
	const safeRows = Array.isArray(rows) ? rows : [];
	const enc = isPlainRecord$1(encoding) ? encoding : {};
	const opt = isPlainRecord$1(options) ? options : {};
	const itemColors = sanitizeItemColors(opt.itemColors);
	const lang = normalizeLang(localeTag);
	if (safeType === "candlestick") {
		const upCustom = isValidHexColor(opt.upColor) ? opt.upColor.trim() : itemColors.up;
		const downCustom = isValidHexColor(opt.downColor) ? opt.downColor.trim() : itemColors.down;
		return attachTargetMetadata([{
			id: "up",
			key: "up",
			label: lang === "en" ? "Up (Bullish)" : "상승(양봉)",
			kind: "candle",
			defaultColor: resolvedTheme.accent,
			customColor: upCustom || "",
			effectiveColor: upCustom || resolvedTheme.accent,
			highlighted: true
		}, {
			id: "down",
			key: "down",
			label: lang === "en" ? "Down (Bearish)" : "하락(음봉)",
			kind: "candle",
			defaultColor: resolvedTheme.neutralStrong,
			customColor: downCustom || "",
			effectiveColor: downCustom || resolvedTheme.neutralStrong,
			highlighted: false
		}], "updown");
	}
	const seriesCol = typeof enc.series === "string" ? enc.series : null;
	const wideSeries = Array.isArray(enc.y) ? enc.y.map(String) : [];
	const frontFields = Array.isArray(enc.front) ? enc.front.map(String) : typeof enc.front === "string" ? [enc.front] : [];
	const backFields = Array.isArray(enc.back) ? enc.back.map(String) : typeof enc.back === "string" ? [enc.back] : [];
	if (safeType === "skyline" && (backFields.length > 0 || frontFields.length > 0)) {
		const names = uniqueStrings([...backFields, ...frontFields]);
		const hiSet = resolveHighlightIndices(opt.highlight, names, names.map(() => 0), "first");
		const defaults = defaultCategoricalSwatches(resolvedTheme, names.length, hiSet);
		return attachTargetMetadata(names.map((name, i) => ({
			id: name,
			label: name,
			kind: "series",
			defaultColor: defaults[i] || resolvedTheme.neutral,
			customColor: itemColors[name] || "",
			effectiveColor: itemColors[name] || defaults[i] || resolvedTheme.neutral,
			highlighted: hiSet.has(i)
		})), "series");
	}
	let seriesList = [];
	if (wideSeries.length >= 2) seriesList = wideSeries;
	else if (seriesCol && safeRows.length > 0) seriesList = uniqueStrings(safeRows.map((r) => r?.[seriesCol]));
	if (([
		"line",
		"area",
		"stream",
		"radar",
		"bump",
		"marimekko"
	].includes(safeType) || [
		"bar",
		"scatter",
		"bubble",
		"histogram"
	].includes(safeType) && seriesList.length >= 2) && seriesList.length >= 1) {
		const valCol = typeof enc.y === "string" ? enc.y : typeof enc.value === "string" ? enc.value : "value";
		const totals = seriesList.map((sName) => {
			if (wideSeries.includes(sName)) return safeRows.reduce((acc, r) => acc + (Number(r?.[sName]) || 0), 0);
			return safeRows.filter((r) => String(r?.[seriesCol] ?? "") === sName).reduce((acc, r) => acc + (Number(r?.[valCol]) || 0), 0);
		});
		const fallbackRule = ["stream", "bump"].includes(safeType) ? "max" : "first";
		const hiSet = resolveHighlightIndices(opt.highlight, seriesList, totals, fallbackRule);
		const defaults = [
			"line",
			"radar",
			"bump"
		].includes(safeType) ? seriesList.map((_, i) => hiSet.has(i) ? resolvedTheme.accent : resolvedTheme.neutralStrong) : defaultCategoricalSwatches(resolvedTheme, seriesList.length, hiSet);
		return attachTargetMetadata(seriesList.map((name, i) => ({
			id: name,
			label: name,
			kind: "series",
			defaultColor: defaults[i] || resolvedTheme.neutral,
			customColor: itemColors[name] || "",
			effectiveColor: itemColors[name] || defaults[i] || resolvedTheme.neutral,
			highlighted: hiSet.has(i)
		})), "series");
	}
	const groupCol = typeof enc.group === "string" ? enc.group : null;
	if ([
		"ridgeline",
		"box",
		"beeswarm"
	].includes(safeType) && groupCol) {
		const groups = uniqueStrings(safeRows.map((r) => r?.[groupCol]));
		const valCol = typeof enc.value === "string" ? enc.value : typeof enc.y === "string" ? enc.y : "value";
		const groupVals = groups.map((g) => {
			const nums = safeRows.filter((r) => String(r?.[groupCol] ?? "") === g).map((r) => Number(r?.[valCol])).filter(Number.isFinite).sort((a, b) => a - b);
			return nums.length ? nums[Math.floor(nums.length / 2)] : 0;
		});
		const hiSet = resolveHighlightIndices(opt.highlight, groups, groupVals, "max");
		return attachTargetMetadata(groups.map((name, i) => {
			const defColor = hiSet.has(i) ? resolvedTheme.accent : resolvedTheme.neutralStrong;
			return {
				id: name,
				label: name,
				kind: "group",
				defaultColor: defColor,
				customColor: itemColors[name] || "",
				effectiveColor: itemColors[name] || defColor,
				highlighted: hiSet.has(i)
			};
		}), "group");
	}
	if (safeType === "sankey" || safeType === "chord") {
		const srcCol = typeof enc.source === "string" ? enc.source : typeof enc.from === "string" ? enc.from : "source";
		const tgtCol = typeof enc.target === "string" ? enc.target : typeof enc.to === "string" ? enc.to : "target";
		const valCol = typeof enc.value === "string" ? enc.value : "value";
		const nodes = uniqueStrings(safeRows.flatMap((r) => [r?.[srcCol], r?.[tgtCol]]));
		const totals = nodes.map((n) => safeRows.reduce((acc, r) => String(r?.[srcCol] ?? "") === n || String(r?.[tgtCol] ?? "") === n ? acc + (Number(r?.[valCol]) || 0) : acc, 0));
		const hiSet = resolveHighlightIndices(opt.highlight, nodes, totals, "max");
		return attachTargetMetadata(nodes.map((name, i) => {
			const defColor = hiSet.has(i) ? resolvedTheme.accent : resolvedTheme.ink;
			return {
				id: name,
				label: name,
				kind: "node",
				defaultColor: defColor,
				customColor: itemColors[name] || "",
				effectiveColor: itemColors[name] || defColor,
				highlighted: hiSet.has(i)
			};
		}), "node");
	}
	if (safeType === "treemap" || safeType === "sunburst") {
		const labelCol = typeof enc.label === "string" ? enc.label : "label";
		const parentCol = typeof enc.group === "string" ? enc.group : typeof enc.parent === "string" ? enc.parent : null;
		const valCol = typeof enc.value === "string" ? enc.value : "value";
		const items = [];
		const vals = [];
		for (const r of safeRows) {
			const lbl = String(r?.[labelCol] ?? "").trim();
			if (!lbl) continue;
			const par = parentCol ? String(r?.[parentCol] ?? "").trim() : "";
			items.push({
				id: lbl,
				label: par ? `${par} · ${lbl}` : lbl,
				group: par
			});
			vals.push(Number(r?.[valCol]) || 0);
		}
		const labels = items.map((it) => it.id);
		const hiSet = resolveHighlightIndices(opt.highlight, labels, vals, "max");
		return attachTargetMetadata(items.map((it, i) => {
			const custom = itemColors[it.id] || (it.group ? itemColors[it.group] : "") || "";
			const defColor = hiSet.has(i) ? resolvedTheme.accent : resolvedTheme.neutral;
			return {
				id: it.id,
				label: it.label,
				kind: "item",
				defaultColor: defColor,
				customColor: custom,
				effectiveColor: custom || defColor,
				highlighted: hiSet.has(i)
			};
		}), "hierarchy");
	}
	const labelKey = enc.label || enc.x || enc.stage || enc.category || enc.item || (safeRows[0] ? Object.keys(safeRows[0]).find((k) => typeof safeRows[0][k] === "string") : "label") || "label";
	const valueKey = (typeof enc.y === "string" ? enc.y : Array.isArray(enc.y) ? enc.y[0] : null) || enc.value || enc.end || enc.after || enc.size || (safeRows[0] ? Object.keys(safeRows[0]).find((k) => typeof safeRows[0][k] === "number") : "value") || "value";
	const labels = [];
	const values = [];
	for (let i = 0; i < safeRows.length; i++) {
		const row = safeRows[i];
		const lbl = String(row?.[labelKey] ?? `${i + 1}`).trim();
		if (!lbl) continue;
		labels.push(lbl);
		values.push(Number(row?.[valueKey]) || 0);
	}
	const displayLabels = uniqueStrings(labels).slice(0, 24);
	const displayValues = displayLabels.map((lbl) => {
		const idx = labels.indexOf(lbl);
		return idx >= 0 ? values[idx] : 0;
	});
	const fallbackRule = safeType === "waffle" || safeType === "parallel" ? "first" : safeType === "bullet" ? "min" : "max";
	const hiSet = resolveHighlightIndices(opt.highlight, displayLabels, displayValues, fallbackRule);
	const defaults = (/* @__PURE__ */ new Set([
		"pie",
		"donut",
		"waffle",
		"segmented"
	])).has(safeType) ? defaultCategoricalSwatches(resolvedTheme, displayLabels.length, hiSet) : displayLabels.map((_, i) => hiSet.has(i) ? resolvedTheme.accent : resolvedTheme.neutral);
	return attachTargetMetadata(displayLabels.map((lbl, i) => ({
		id: lbl,
		label: lbl,
		kind: "item",
		defaultColor: defaults[i] || resolvedTheme.neutral,
		customColor: itemColors[lbl] || "",
		effectiveColor: itemColors[lbl] || defaults[i] || resolvedTheme.neutral,
		highlighted: hiSet.has(i)
	})), "category");
}
/**
* Resolves a custom `#rrggbb` color for an SVG element given its `data-ztd-key` or `data-k`.
*/
function resolveColorForZtdKey(chartType, ztdKey, dataK, isMark, itemColors = {}, dataTargets = [], rows = [], encoding = {}) {
	if (!isPlainRecord$1(itemColors) || Object.keys(itemColors).length === 0) return null;
	const targetList = Array.isArray(dataTargets) ? dataTargets : dataTargets?.items ?? [];
	if (dataK !== void 0 && dataK !== null && dataK !== "") {
		const kIdx = Number(dataK);
		if (Number.isFinite(kIdx) && kIdx >= 0 && targetList[kIdx]) {
			const c = itemColors[targetList[kIdx].id ?? targetList[kIdx].key];
			if (isValidHexColor(c)) return c;
		}
	}
	const key = String(ztdKey ?? "").trim();
	if (!key) return null;
	if (isValidHexColor(itemColors[key])) return itemColors[key];
	if (key.includes("|")) {
		const [cat, series] = key.split("|");
		if (series && isValidHexColor(itemColors[series])) return itemColors[series];
		if (cat && isValidHexColor(itemColors[cat])) return itemColors[cat];
		return null;
	}
	const bubbleMatch = key.match(/^b(\d+):(.*)$/);
	if (bubbleMatch) {
		const rowIdx = Number(bubbleMatch[1]);
		const lbl = bubbleMatch[2];
		if (lbl && isValidHexColor(itemColors[lbl])) return itemColors[lbl];
		const seriesCol = typeof encoding?.series === "string" ? encoding.series : null;
		if (seriesCol && rows[rowIdx]) {
			const sVal = String(rows[rowIdx][seriesCol] ?? "");
			if (sVal && isValidHexColor(itemColors[sVal])) return itemColors[sVal];
		}
		return null;
	}
	if (key.startsWith("t:") || key.startsWith("a:")) {
		const body = key.slice(2);
		if (isValidHexColor(itemColors[body])) return itemColors[body];
		if (body.includes("/")) {
			const [parent, leaf] = body.split("/");
			if (leaf && isValidHexColor(itemColors[leaf])) return itemColors[leaf];
			if (parent && isValidHexColor(itemColors[parent])) return itemColors[parent];
		}
		return null;
	}
	if (key.startsWith("n:")) {
		const nodeName = key.slice(2);
		return isValidHexColor(itemColors[nodeName]) ? itemColors[nodeName] : null;
	}
	if (key.startsWith("l:") && key.includes(">")) {
		const linkBody = key.slice(2);
		if (isValidHexColor(itemColors[linkBody])) return itemColors[linkBody];
		const [src, tgt] = linkBody.split(">");
		if (src && isValidHexColor(itemColors[src])) return itemColors[src];
		if (tgt && isValidHexColor(itemColors[tgt])) return itemColors[tgt];
		return null;
	}
	if (key.startsWith("p:")) {
		const idx = Number(key.slice(2));
		if (Number.isFinite(idx) && targetList[idx]) {
			const c = itemColors[targetList[idx].id ?? targetList[idx].key];
			if (isValidHexColor(c)) return c;
		}
		return null;
	}
	const prefixMatch = key.match(/^[srbwdl]:(.*)$/);
	if (prefixMatch) {
		const name = prefixMatch[1];
		if (name && isValidHexColor(itemColors[name])) return itemColors[name];
		return null;
	}
	if (chartType === "segmented" && /^l(\d+)$/.test(key)) {
		const idx = Number(key.slice(1));
		if (Number.isFinite(idx) && targetList[idx]) {
			const c = itemColors[targetList[idx].id ?? targetList[idx].key];
			if (isValidHexColor(c)) return c;
		}
		return null;
	}
	if (chartType === "beeswarm" && /^b(\d+)$/.test(key)) {
		const rowIdx = Number(key.slice(1));
		const groupCol = typeof encoding?.group === "string" ? encoding.group : "group";
		const labelCol = typeof encoding?.label === "string" ? encoding.label : "label";
		const row = rows[rowIdx];
		if (row) {
			const gVal = String(row[groupCol] ?? "");
			const lVal = String(row[labelCol] ?? "");
			if (gVal && isValidHexColor(itemColors[gVal])) return itemColors[gVal];
			if (lVal && isValidHexColor(itemColors[lVal])) return itemColors[lVal];
		}
		return null;
	}
	if (/^\d+$/.test(key)) {
		const idx = Number(key);
		if (chartType === "funnel" && isMark || chartType === "donut" && !isMark || chartType === "chord" && !isMark || chartType === "skyline" && !isMark) {
			const target = targetList[idx];
			const targetKey = target?.id ?? target?.key;
			if (targetKey && isValidHexColor(itemColors[targetKey])) return itemColors[targetKey];
		}
	}
	return null;
}
/**
* Resolves canonical aspect props into a validated `ztd-charts` ChartSpec and metadata.
*/
function resolveChartSpec(rawProps = {}) {
	const chartType = normalizeChartType(rawProps.chartType);
	const lang = normalizeLang(rawProps.locale);
	const localeTag = normalizeLocaleTag(rawProps.locale);
	const themeName = rawProps.theme === "dark" ? "dark" : "light";
	const variant = rawProps.variant === "bare" ? "bare" : "card";
	const legendMode = [
		"auto",
		"true",
		"false"
	].includes(rawProps.legendMode) ? rawProps.legendMode : "auto";
	const accentColor = isValidHexColor(rawProps.accentColor) ? rawProps.accentColor.trim() : CHART_DEFAULTS.accentColor;
	const def = getLocalizedChartDef(chartType, lang);
	const example = def.example;
	const customRows = cloneJsonRows(rawProps.data);
	const customEncoding = isPlainRecord$1(rawProps.encoding) ? { ...rawProps.encoding } : {};
	const customOptions = isPlainRecord$1(rawProps.options) ? { ...rawProps.options } : {};
	const textOverrides = isPlainRecord$1(customOptions.textOverrides) ? { ...customOptions.textOverrides } : {};
	const itemColors = sanitizeItemColors(customOptions.itemColors);
	const backgroundColor = resolveBackgroundColor(rawProps.backgroundColor) || resolveBackgroundColor(customOptions.backgroundColor);
	const themeBackground = backgroundColor === "transparent" ? "" : backgroundColor;
	const neutralColor = isValidHexColor(customOptions.neutralColor) ? customOptions.neutralColor.trim() : "";
	const cornerRadius = resolveCornerRadius(rawProps.cornerRadius);
	const resolvedTheme = {
		...resolveChartTheme(themeName, accentColor, themeBackground, neutralColor),
		radius: cornerRadius
	};
	let effectiveRows = example.data;
	let effectiveEncoding = { ...example.encoding ?? {} };
	let effectiveOptions = {
		...example.options ?? {},
		...customOptions,
		locale: localeTag
	};
	if (customOptions.highlight === "auto") delete effectiveOptions.highlight;
	if (chartType === "candlestick") {
		if (isValidHexColor(itemColors.up) && !isValidHexColor(effectiveOptions.upColor)) effectiveOptions.upColor = itemColors.up;
		if (isValidHexColor(itemColors.down) && !isValidHexColor(effectiveOptions.downColor)) effectiveOptions.downColor = itemColors.down;
	}
	let usingSampleData = true;
	if (customRows.length > 0) {
		const candidateDirect = {
			type: chartType,
			data: customRows,
			encoding: Object.keys(customEncoding).length > 0 ? customEncoding : effectiveEncoding,
			options: effectiveOptions
		};
		if (validateSpec(candidateDirect, { lang }).valid) {
			effectiveRows = customRows;
			effectiveEncoding = candidateDirect.encoding;
			usingSampleData = false;
		} else {
			const adaptedEncoding = adaptEncodingForType(chartType, customRows, customEncoding, lang);
			if (adaptedEncoding) {
				if (validateSpec({
					type: chartType,
					data: customRows,
					encoding: adaptedEncoding,
					options: effectiveOptions
				}, { lang }).valid) {
					effectiveRows = customRows;
					effectiveEncoding = adaptedEncoding;
					usingSampleData = false;
				}
			}
		}
	}
	const dataTargets = extractChartDataTargets(chartType, effectiveRows, effectiveEncoding, effectiveOptions, resolvedTheme, localeTag);
	const singleTargetCustomColor = (chartType === "gauge" || chartType === "sparkline") && dataTargets[0]?.customColor ? dataTargets[0].customColor : "";
	const finalTheme = singleTargetCustomColor ? {
		...resolveChartTheme(themeName, singleTargetCustomColor, themeBackground, neutralColor),
		radius: cornerRadius
	} : resolvedTheme;
	const title = textOverrides["field:title"] !== void 0 ? String(textOverrides["field:title"]) : typeof rawProps.title === "string" && rawProps.title.length > 0 ? rawProps.title : example.card?.title ?? def.name ?? chartType;
	const subtitle = textOverrides["field:subtitle"] !== void 0 ? String(textOverrides["field:subtitle"]) : typeof rawProps.subtitle === "string" && rawProps.subtitle.length > 0 ? rawProps.subtitle : example.card?.subtitle ?? "";
	const takeaway = textOverrides["field:takeaway"] !== void 0 ? String(textOverrides["field:takeaway"]) : typeof rawProps.takeaway === "string" ? rawProps.takeaway : "";
	const cardNumber = textOverrides["field:cardNumber"] !== void 0 ? String(textOverrides["field:cardNumber"]) : customOptions.cardNumber !== void 0 ? String(customOptions.cardNumber) : "";
	const cardLevel = textOverrides["field:cardLevel"] !== void 0 ? String(textOverrides["field:cardLevel"]) : customOptions.cardLevel !== void 0 ? String(customOptions.cardLevel) : "";
	const baseSpecForLegend = {
		type: chartType,
		data: effectiveRows,
		encoding: effectiveEncoding,
		options: effectiveOptions
	};
	let legendItems = [];
	if (variant === "card" && legendMode !== "false") try {
		const computed = autoLegend(baseSpecForLegend, effectiveRows, localeTag);
		if (Array.isArray(computed)) legendItems = computed.map((item, idx) => {
			const baseLabel = String(item?.label ?? "");
			const override = textOverrides[`legend:${idx}`] ?? textOverrides[`text:${baseLabel}`];
			const customColor = itemColors[baseLabel] || (chartType === "candlestick" && idx === 0 ? itemColors.up : "") || (chartType === "candlestick" && idx === 1 ? itemColors.down : "");
			return {
				...item,
				...override !== void 0 ? { label: String(override) } : {},
				...isValidHexColor(customColor) ? { color: customColor } : {}
			};
		});
	} catch {
		legendItems = [];
	}
	const hasLegendOverrides = legendItems.some((item, idx) => textOverrides[`legend:${idx}`] !== void 0 || textOverrides[`text:${item?.label}`] !== void 0 || isValidHexColor(item?.color));
	const cardLegend = legendMode === "false" ? false : hasLegendOverrides && legendItems.length > 0 ? legendItems : "auto";
	const card = variant === "card" ? {
		title,
		subtitle: subtitle || void 0,
		...cardNumber ? { number: cardNumber } : {},
		...takeaway ? { takeaway } : {},
		...cardLevel ? { level: cardLevel } : {},
		legend: cardLegend,
		replay: false
	} : void 0;
	const spec = {
		type: chartType,
		data: effectiveRows,
		encoding: effectiveEncoding,
		options: effectiveOptions,
		...card ? { card } : {}
	};
	return {
		chartType,
		lang,
		localeTag,
		themeName,
		accentColor,
		backgroundColor,
		cornerRadius,
		neutralColor,
		highlight: customOptions.highlight ?? "auto",
		itemColors,
		dataTargets,
		resolvedTheme: finalTheme,
		variant,
		legendMode,
		title,
		subtitle,
		takeaway,
		cardNumber,
		cardLevel,
		textOverrides,
		usingSampleData,
		spec,
		bareSpec: {
			type: chartType,
			data: effectiveRows,
			encoding: effectiveEncoding,
			options: effectiveOptions
		},
		legendItems,
		def
	};
}
function deriveChartGeometry(props, id, view) {
	const transform = view?.getCanonical?.(id, "core.transform") ?? {
		x: 0,
		y: 0,
		rotation: 0
	};
	const bounds = view?.getCanonical?.(id, "core.bounds") ?? {
		width: 480,
		height: 340
	};
	const x = Number.isFinite(transform.x) ? transform.x : 0;
	const y = Number.isFinite(transform.y) ? transform.y : 0;
	const rotation = Number.isFinite(transform.rotation) ? transform.rotation : 0;
	return {
		x,
		y,
		width: Number.isFinite(bounds.width) && bounds.width > 0 ? Math.max(240, Math.round(bounds.width)) : 480,
		height: Number.isFinite(bounds.height) && bounds.height > 0 ? Math.max(180, Math.round(bounds.height)) : 340,
		rotation
	};
}
/**
* Parses either CSV text or JSON array/spec text into `{ rows, encoding, options, chartType }`.
*/
function parseDataInput(input, fallbackLocale = "ko") {
	if (Array.isArray(input)) {
		const rows = normalizeData(input);
		return {
			ok: rows.length > 0,
			rows,
			format: "array"
		};
	}
	if (isPlainRecord$1(input)) {
		if (Array.isArray(input.data)) {
			const rows = normalizeData(input.data);
			return {
				ok: rows.length > 0,
				rows,
				format: "spec",
				chartType: input.type ? normalizeChartType(input.type) : void 0,
				encoding: isPlainRecord$1(input.encoding) ? input.encoding : void 0,
				options: isPlainRecord$1(input.options) ? input.options : void 0,
				title: input.card?.title ?? input.title,
				subtitle: input.card?.subtitle ?? input.subtitle,
				takeaway: input.card?.takeaway ?? input.takeaway
			};
		}
	}
	if (typeof input !== "string" || !input.trim()) return {
		ok: false,
		rows: [],
		error: "데이터 입력이 비어 있습니다."
	};
	const trimmed = input.trim();
	if (trimmed.startsWith("[") || trimmed.startsWith("{")) try {
		return parseDataInput(JSON.parse(trimmed), fallbackLocale);
	} catch (error) {
		return {
			ok: false,
			rows: [],
			error: `JSON 파싱 오류: ${error instanceof Error ? error.message : String(error)}`
		};
	}
	try {
		const rows = parseCSV(trimmed);
		if (!Array.isArray(rows) || rows.length === 0) return {
			ok: false,
			rows: [],
			error: "CSV에서 유효한 데이터 행을 찾지 못했습니다."
		};
		return {
			ok: true,
			rows,
			format: "csv"
		};
	} catch (error) {
		return {
			ok: false,
			rows: [],
			error: `CSV 파싱 오류: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}
function formatRowsAsCsv(rows) {
	if (!Array.isArray(rows) || rows.length === 0) return "";
	try {
		return toCSV(rows);
	} catch {
		return "";
	}
}
function suggestChartsForRows(rows, locale = "ko") {
	const lang = normalizeLang(locale);
	if (!Array.isArray(rows) || rows.length === 0) return {
		profile: {
			rows: 0,
			columns: []
		},
		suggestions: []
	};
	try {
		const result = suggestCharts(rows, { lang });
		const catalogByType = new Map(getChartCatalog(lang).map((item) => [item.type, item]));
		const suggestions = (result.suggestions ?? []).map((item) => ({
			type: item.type,
			name: catalogByType.get(item.type)?.name ?? item.name ?? item.type,
			score: item.score,
			reason: item.reason,
			spec: item.spec
		}));
		return {
			profile: result.profile ?? profileData(rows),
			suggestions
		};
	} catch {
		return {
			profile: profileData(rows),
			suggestions: []
		};
	}
}
function createSamplePropsForType(chartType = "bar", locale = "ko", theme = "light") {
	const safeType = normalizeChartType(chartType);
	const lang = normalizeLang(locale);
	const def = getLocalizedChartDef(safeType, lang);
	const ex = def.example ?? {};
	return {
		...CHART_DEFAULTS,
		chartType: safeType,
		locale: lang,
		theme: theme === "dark" ? "dark" : "light",
		title: ex.card?.title ?? def.name ?? safeType,
		subtitle: ex.card?.subtitle ?? "",
		takeaway: "",
		data: [],
		encoding: {},
		options: {}
	};
}
// src/svg-renderer.js
var SVG_CAMEL_ATTRS = /* @__PURE__ */ new Set([
	"viewBox",
	"preserveAspectRatio",
	"gradientUnits",
	"gradientTransform",
	"patternUnits",
	"patternTransform",
	"clipPathUnits",
	"maskUnits",
	"maskContentUnits",
	"filterUnits",
	"primitiveUnits",
	"spreadMethod",
	"markerWidth",
	"markerHeight",
	"markerUnits",
	"refX",
	"refY",
	"stdDeviation",
	"baseFrequency",
	"numOctaves",
	"stitchTiles",
	"tableValues",
	"attributeName",
	"attributeType",
	"repeatCount",
	"repeatDur",
	"calcMode",
	"keyTimes",
	"keySplines",
	"PathLength",
	"pathLength",
	"startOffset",
	"textLength",
	"lengthAdjust"
]);
var UNITLESS_CSS_PROPS = /* @__PURE__ */ new Set([
	"opacity",
	"fillOpacity",
	"strokeOpacity",
	"zIndex",
	"fontWeight",
	"lineHeight",
	"flex",
	"flexGrow",
	"flexShrink",
	"order",
	"zoom",
	"scale"
]);
function escapeXml(value) {
	return String(value ?? "").replace(/[&<>"']/g, (ch) => ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "\"" ? "&quot;" : "&apos;");
}
function sanitizeIdFragment(value) {
	return String(value ?? "chart").replace(/[^A-Za-z0-9_-]/g, "_") || "chart";
}
function toAttributeName(propName) {
	if (propName === "className") return "class";
	if (propName === "htmlFor") return "for";
	if (SVG_CAMEL_ATTRS.has(propName)) return propName;
	return propName.replace(/([A-Z])/g, "-$1").toLowerCase();
}
function serializeStyleObject(styleObj) {
	if (!styleObj || typeof styleObj !== "object") return "";
	const parts = [];
	for (const [key, rawVal] of Object.entries(styleObj)) {
		if (rawVal === null || rawVal === void 0 || rawVal === false || rawVal === "") continue;
		const cssKey = key.startsWith("--") ? key : key.replace(/([A-Z])/g, "-$1").toLowerCase();
		const cssVal = typeof rawVal === "number" && !UNITLESS_CSS_PROPS.has(key) && !key.startsWith("--") ? `${rawVal}px` : String(rawVal);
		parts.push(`${cssKey}:${cssVal}`);
	}
	return parts.join(";");
}
function getReactInternals() {
	return React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ?? React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher;
}
/**
* Synchronous, zero-CJS static React element serializer tailored for `ztd-charts`.
* Avoids `react-dom/server` so the ESM bundle never emits CommonJS `require("react")`.
*/
function renderStaticElement(rootElement, idPrefix = "ztd", colorContext = null) {
	const internals = getReactInternals();
	let idCounter = 0;
	function renderComponent(Component, props, contextMap, activeColor, inheritedKey) {
		const dispatcher = {
			useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
			useReducer: (_reducer, initArg, init) => [typeof init === "function" ? init(initArg) : initArg, () => {}],
			useEffect: () => {},
			useLayoutEffect: () => {},
			useInsertionEffect: () => {},
			useRef: (initialValue) => ({ current: initialValue }),
			useMemo: (factory) => factory(),
			useCallback: (callback) => callback,
			useContext: (ctx) => contextMap.has(ctx) ? contextMap.get(ctx) : ctx._currentValue,
			useId: () => `${idPrefix}-${++idCounter}`,
			useTransition: () => [false, (fn) => fn()],
			useDeferredValue: (value) => value,
			useSyncExternalStore: (_sub, getSnapshot, getServerSnapshot) => getServerSnapshot ? getServerSnapshot() : getSnapshot(),
			useImperativeHandle: () => {},
			useDebugValue: () => {}
		};
		const usesModernField = internals && "H" in internals;
		const previous = usesModernField ? internals.H : internals?.current;
		if (usesModernField) internals.H = dispatcher;
		else if (internals) internals.current = dispatcher;
		try {
			return walk(Component(props), contextMap, activeColor, inheritedKey);
		} finally {
			if (usesModernField) internals.H = previous;
			else if (internals) internals.current = previous;
		}
	}
	function walk(node, contextMap, activeColor = null, inheritedKey = "") {
		if (node === null || node === void 0 || typeof node === "boolean") return "";
		if (typeof node === "string" || typeof node === "number") return escapeXml(node);
		if (Array.isArray(node)) {
			let out = "";
			for (const child of node) out += walk(child, contextMap, activeColor, "");
			return out;
		}
		if (typeof node === "object" && node.$$typeof) {
			const { type, props, key } = node;
			const ownKey = key !== null && key !== void 0 ? String(key) : inheritedKey;
			if (type === React.Fragment) return walk(props?.children, contextMap, activeColor, ownKey);
			if (typeof type === "object" && type !== null) {
				if ("value" in (props ?? {}) && ("_context" in type || "_currentValue" in type || "Provider" in type)) {
					const ctx = type._context ?? type;
					const nextMap = new Map(contextMap);
					nextMap.set(ctx, props.value);
					return walk(props.children, nextMap, activeColor, ownKey);
				}
				if (typeof type.render === "function") return renderComponent((p) => type.render(p, null), props, contextMap, activeColor, ownKey);
				if (typeof type.type === "function") return renderComponent(type.type, props, contextMap, activeColor, ownKey);
			}
			if (typeof type === "function") return renderComponent(type, props ?? {}, contextMap, activeColor, ownKey);
			if (typeof type === "string") {
				const { children, dangerouslySetInnerHTML, style, ...rest } = props ?? {};
				const isMark = typeof rest.className === "string" && rest.className.includes("ztd-mark");
				const effectiveColor = (colorContext ? resolveColorForZtdKey(colorContext.chartType, ownKey, rest["data-k"], isMark, colorContext.itemColors, colorContext.dataTargets, colorContext.rows, colorContext.encoding) : null) || activeColor;
				if (effectiveColor && [
					"path",
					"rect",
					"circle",
					"line",
					"polygon"
				].includes(type)) {
					const isBulletBgOrTarget = colorContext?.chartType === "bullet" && (type === "line" || type === "path" && ownKey && /^\d+$/.test(ownKey));
					const isBoxWhisker = colorContext?.chartType === "box" && type === "line";
					if (!isBulletBgOrTarget && !isBoxWhisker && rest.fill !== "transparent") {
						if (typeof rest.fill === "string" && rest.fill !== "none" && rest.fill !== "transparent" && !rest.fill.includes("--ztd-panel")) rest.fill = effectiveColor;
						if (typeof rest.stroke === "string" && rest.stroke !== "none" && !rest.stroke.includes("--ztd-panel") && !rest.stroke.includes("--ztd-line") && !rest.stroke.includes("--ztd-dim") && !rest.stroke.includes("--ztd-neutral-soft")) rest.stroke = effectiveColor;
					}
				}
				let attrString = "";
				if (ownKey) attrString += ` data-ztd-key="${escapeXml(ownKey)}"`;
				for (const [propKey, val] of Object.entries(rest)) {
					if (val === null || val === void 0 || val === false || typeof val === "function" || propKey === "ref" || propKey === "key") continue;
					const attrName = toAttributeName(propKey);
					attrString += ` ${attrName}="${escapeXml(val === true ? "" : String(val))}"`;
				}
				if (style && typeof style === "object") {
					const css = serializeStyleObject(style);
					if (css) attrString += ` style="${escapeXml(css)}"`;
				}
				const inner = dangerouslySetInnerHTML?.__html !== void 0 ? String(dangerouslySetInnerHTML.__html) : walk(children, contextMap, effectiveColor, "");
				return `<${type}${attrString}>${inner}</${type}>`;
			}
		}
		return "";
	}
	return walk(rootElement, /* @__PURE__ */ new Map(), null, "");
}
/**
* Resolves `var(--ztd-..., fallback)` expressions into concrete color/token values
* so standalone exported SVGs render identically in external vector tools.
*/
function inlineZtdCssVariables(svgMarkup, resolvedTheme) {
	const tokenMap = {
		"--ztd-bg": resolvedTheme.bg,
		"--ztd-panel": resolvedTheme.panel,
		"--ztd-ink": resolvedTheme.ink,
		"--ztd-muted": resolvedTheme.muted,
		"--ztd-dim": resolvedTheme.dim,
		"--ztd-accent": resolvedTheme.accent,
		"--ztd-accent-text": resolvedTheme.accentText,
		"--ztd-on-accent": resolvedTheme.onAccent,
		"--ztd-on-ink": resolvedTheme.onInk,
		"--ztd-line": resolvedTheme.line,
		"--ztd-line2": resolvedTheme.line2,
		"--ztd-neutral": resolvedTheme.neutral,
		"--ztd-neutral-strong": resolvedTheme.neutralStrong,
		"--ztd-on-neutral-strong": resolvedTheme.onNeutralStrong,
		"--ztd-neutral-soft": resolvedTheme.neutralSoft,
		"--ztd-lift": resolvedTheme.lift,
		"--ztd-tint": resolvedTheme.tint,
		"--ztd-font": resolvedTheme.fontFamily,
		"--ztd-mono": resolvedTheme.monoFamily
	};
	return svgMarkup.replace(/var\((--ztd-[a-z0-9-]+)(?:,\s*([^)]+))?\)/gi, (_match, varName, fallback) => {
		const resolved = tokenMap[varName];
		if (resolved !== void 0 && resolved !== null) return String(resolved);
		return fallback ? String(fallback).trim() : "#64748b";
	});
}
function unescapeXml(value) {
	return String(value ?? "").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}
function applySvgTextOverrides(svgContent, textOverrides) {
	if (!svgContent) return "";
	let idx = 0;
	return svgContent.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi, (_full, attrs, inner) => {
		const slotKey = `svg:${idx++}`;
		const plainBase = unescapeXml(inner.replace(/<[^>]+>/g, "")).trim();
		const override = textOverrides?.[slotKey] ?? (plainBase ? textOverrides?.[`text:${plainBase}`] : void 0);
		return `<text data-chart-text-slot="${slotKey}"${attrs}>${override !== void 0 ? escapeXml(String(override)) : inner}</text>`;
	});
}
function renderLegendSvg(legendItems, maxWidth, yOffset, resolvedTheme) {
	if (!Array.isArray(legendItems) || legendItems.length === 0) return "";
	const tokenColorMap = {
		accent: resolvedTheme.accent,
		neutral: resolvedTheme.neutral,
		neutralStrong: resolvedTheme.neutralStrong,
		neutralSoft: resolvedTheme.neutralSoft,
		ink: resolvedTheme.ink
	};
	let cursorX = 0;
	const parts = [];
	for (let idx = 0; idx < Math.min(legendItems.length, 6); idx++) {
		const item = legendItems[idx];
		const label = String(item?.label ?? "");
		if (!label) continue;
		const itemWidth = Math.ceil(textWidth(label, 11) + 22);
		if (cursorX > 0 && cursorX + itemWidth > maxWidth) break;
		const rawColor = tokenColorMap[item?.color] || item?.color || resolvedTheme.accent;
		const swatchColor = inlineZtdCssVariables(String(rawColor), resolvedTheme);
		parts.push(`<g transform="translate(${cursorX},${yOffset})"><rect x="0" y="2" width="9" height="9" rx="2.5" fill="${escapeXml(swatchColor)}"/><text data-chart-text-slot="legend:${idx}" x="14" y="10" font-size="11" font-weight="500" fill="${escapeXml(resolvedTheme.muted)}">${escapeXml(label)}</text></g>`);
		cursorX += itemWidth;
	}
	return parts.join("");
}
/**
* Compiles a `diagram.ztd-charts.chart` entity into a pure vector `<g>` SVG node.
*/
function renderChartSvg(props, derived, entityId = "chart") {
	const geom = derived ?? {
		x: 0,
		y: 0,
		width: 480,
		height: 340,
		rotation: 0
	};
	const width = Math.max(120, Math.round(Number.isFinite(geom.width) ? geom.width : 480));
	const height = Math.max(100, Math.round(Number.isFinite(geom.height) ? geom.height : 340));
	const x = Number.isFinite(geom.x) ? geom.x : 0;
	const y = Number.isFinite(geom.y) ? geom.y : 0;
	const rotationDeg = Number.isFinite(geom.rotation) ? geom.rotation * 180 / Math.PI : 0;
	const resolved = resolveChartSpec(props);
	const { bareSpec, resolvedTheme, localeTag, variant, title, subtitle, takeaway, textOverrides, legendItems, cornerRadius } = resolved;
	const cardFill = resolved.backgroundColor === "transparent" ? "none" : resolved.backgroundColor || resolvedTheme.panel;
	const cardStroke = resolved.backgroundColor === "transparent" ? "none" : resolvedTheme.line;
	const padX = variant === "card" ? 20 : 12;
	const padTop = variant === "card" ? 18 : 12;
	const padBottom = variant === "card" ? 16 : 12;
	const hasSubtitle = variant === "card" && Boolean(subtitle);
	const hasLegend = variant === "card" && legendItems.length > 0;
	const hasTakeaway = variant === "card" && Boolean(takeaway);
	const headerHeight = variant === "card" ? 24 + (hasSubtitle ? 18 : 0) + (hasLegend ? 20 : 0) + 8 : 0;
	const footerHeight = hasTakeaway ? 28 : 0;
	const plotX = padX;
	const plotY = padTop + headerHeight;
	const plotWidth = Math.max(140, width - padX * 2);
	const plotHeight = Math.max(96, height - plotY - padBottom - footerHeight);
	const safeId = sanitizeIdFragment(entityId);
	const svgMatch = renderStaticElement(React.createElement(ThemeProvider, { theme: resolvedTheme }, React.createElement(Chart, {
		spec: bareSpec,
		width: plotWidth,
		height: plotHeight,
		animate: false,
		locale: localeTag
	})), `ztd-${safeId}`, {
		chartType: resolved.chartType,
		itemColors: resolved.itemColors,
		dataTargets: resolved.dataTargets,
		rows: bareSpec.data,
		encoding: bareSpec.encoding
	}).match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
	const viewBox = (svgMatch?.[1]?.match(/viewBox="([^"]+)"/i))?.[1] ?? `0 0 ${plotWidth} ${plotHeight}`;
	const innerPlotSvg = svgMatch?.[2] ? applySvgTextOverrides(inlineZtdCssVariables(svgMatch[2], resolvedTheme), textOverrides) : "";
	const clipId = `ztd-card-clip-${safeId}`;
	const transformAttr = rotationDeg !== 0 ? `translate(${x},${y}) rotate(${rotationDeg},${width / 2},${height / 2})` : `translate(${x},${y})`;
	let headerSvg = "";
	if (variant === "card") {
		let cursorY = padTop + 15;
		headerSvg += `<text data-chart-field="title" x="${padX}" y="${cursorY}" font-size="15" font-weight="700" fill="${escapeXml(resolvedTheme.ink)}">${escapeXml(title)}</text>`;
		if (hasSubtitle) {
			cursorY += 18;
			headerSvg += `<text data-chart-field="subtitle" x="${padX}" y="${cursorY}" font-size="11.5" font-weight="400" fill="${escapeXml(resolvedTheme.muted)}">${escapeXml(subtitle)}</text>`;
		}
		if (hasLegend) {
			cursorY += 10;
			headerSvg += `<g transform="translate(${padX},0)">${renderLegendSvg(legendItems, plotWidth, cursorY, resolvedTheme)}</g>`;
		}
	}
	let footerSvg = "";
	if (hasTakeaway) {
		const lineY = height - padBottom - 20;
		const textY = height - padBottom - 4;
		footerSvg = `<line x1="${padX}" y1="${lineY}" x2="${width - padX}" y2="${lineY}" stroke="${escapeXml(resolvedTheme.line)}" stroke-width="1"/><text data-chart-field="takeaway" x="${padX}" y="${textY}" font-size="11.5" font-weight="600" fill="${escapeXml(resolvedTheme.accentText)}">${escapeXml(takeaway)}</text>`;
	}
	const fontFamily = escapeXml(resolvedTheme.fontFamily || "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif");
	return { svg: `<g transform="${transformAttr}" data-chart-type="${escapeXml(resolved.chartType)}" font-family="${fontFamily}"><defs><clipPath id="${clipId}"><rect width="${width}" height="${height}" rx="${cornerRadius}"/></clipPath></defs><g clip-path="url(#${clipId})"><rect data-chart-card="background" width="${width}" height="${height}" rx="${cornerRadius}" fill="${escapeXml(cardFill)}" stroke="${escapeXml(cardStroke)}" stroke-width="1"/>` + headerSvg + `<svg x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" viewBox="${escapeXml(viewBox)}" preserveAspectRatio="xMidYMid meet">` + innerPlotSvg + `</svg>` + footerSvg + "</g></g>" };
}
// src/dom-renderer.js
var mountedRoots = /* @__PURE__ */ new WeakMap();
var injectedDocs = /* @__PURE__ */ new WeakSet();
var NON_DATA_OPTION_KEYS$1 = Object.freeze([
	"centerLabel",
	"label",
	"xLabel",
	"yLabel",
	"note"
]);
function ensureDocumentBaseCss(doc) {
	if (!doc || typeof doc.createElement !== "function" || injectedDocs.has(doc)) return;
	try {
		if (!doc.getElementById?.("ztd-charts-extension-css")) {
			const style = doc.createElement("style");
			style.id = "ztd-charts-extension-css";
			style.textContent = [
				baseCss,
				"[data-role=\"ztd-chart-mount\"] .ztd-card { height: 100%; box-sizing: border-box; margin: 0; }",
				"[data-ztd-card-background=\"transparent\"] .ztd-card { background: transparent !important; border-color: transparent !important; box-shadow: none !important; }",
				"[data-role=\"ztd-chart-mount\"] [data-chart-field], [data-role=\"ztd-chart-mount\"] [data-chart-option-field] { pointer-events: auto !important; cursor: text !important; }",
				"input[data-ztd-chart-editor=\"true\"], input[data-ztd-chart-editor=\"true\"]:focus, input[data-ztd-chart-editor=\"true\"]:focus-visible { background: transparent !important; border: none !important; outline: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }"
			].join("\n");
			(doc.head ?? doc.documentElement)?.appendChild?.(style);
		}
		injectedDocs.add(doc);
	} catch {}
}
function getElementZtdKey(el) {
	if (!el || typeof el.getAttribute !== "function") return "";
	const existing = el.getAttribute("data-ztd-key");
	if (existing) return existing;
	const keys = Object.keys(el);
	for (let i = 0; i < keys.length; i++) {
		const k = keys[i];
		if (k.startsWith("__reactFiber$")) {
			const fiber = el[k];
			const ownKey = fiber?.key ?? (fiber?.return && typeof fiber.return.type !== "string" ? fiber.return.key : null);
			if (ownKey !== null && ownKey !== void 0 && ownKey !== "") {
				const keyStr = String(ownKey);
				el.setAttribute("data-ztd-key", keyStr);
				return keyStr;
			}
			break;
		}
	}
	return "";
}
function applyDomCustomColors(root, resolved) {
	if (!root || !resolved || typeof root.querySelector !== "function") return;
	const svgEl = root.querySelector("svg.ztd-svg") ?? root.querySelector("svg");
	if (!svgEl) return;
	const itemColors = resolved.itemColors ?? {};
	const hasCustom = Object.keys(itemColors).length > 0;
	function walkSvgNode(el, inheritedColor) {
		if (!el || el.nodeType !== 1) return;
		const tag = (el.tagName || "").toLowerCase();
		const ztdKey = getElementZtdKey(el);
		const dataK = el.getAttribute?.("data-k");
		const isMark = (el.getAttribute?.("class") || "").includes("ztd-mark");
		const effectiveColor = (hasCustom ? resolveColorForZtdKey(resolved.chartType, ztdKey, dataK, isMark, itemColors, resolved.dataTargets, resolved.spec?.data, resolved.spec?.encoding) : null) || inheritedColor;
		if ([
			"path",
			"rect",
			"circle",
			"line",
			"polygon"
		].includes(tag)) {
			const isBulletBgOrTarget = resolved.chartType === "bullet" && (tag === "line" || tag === "path" && ztdKey && /^\d+$/.test(ztdKey));
			const isBoxWhisker = resolved.chartType === "box" && tag === "line";
			const currentFill = el.getAttribute("fill");
			const currentStroke = el.getAttribute("stroke");
			if (effectiveColor && !isBulletBgOrTarget && !isBoxWhisker && currentFill !== "transparent") {
				if (typeof currentFill === "string" && currentFill !== "none" && currentFill !== "transparent" && !currentFill.includes("--ztd-panel")) {
					if (!el.hasAttribute("data-orig-fill")) el.setAttribute("data-orig-fill", currentFill);
					if (currentFill !== effectiveColor) el.setAttribute("fill", effectiveColor);
				}
				if (typeof currentStroke === "string" && currentStroke !== "none" && !currentStroke.includes("--ztd-panel") && !currentStroke.includes("--ztd-line") && !currentStroke.includes("--ztd-dim") && !currentStroke.includes("--ztd-neutral-soft")) {
					if (!el.hasAttribute("data-orig-stroke")) el.setAttribute("data-orig-stroke", currentStroke);
					if (currentStroke !== effectiveColor) el.setAttribute("stroke", effectiveColor);
				}
			} else {
				if (el.hasAttribute("data-orig-fill")) {
					el.setAttribute("fill", el.getAttribute("data-orig-fill"));
					el.removeAttribute("data-orig-fill");
				}
				if (el.hasAttribute("data-orig-stroke")) {
					el.setAttribute("stroke", el.getAttribute("data-orig-stroke"));
					el.removeAttribute("data-orig-stroke");
				}
			}
		}
		const children = el.children;
		if (children) for (let i = 0; i < children.length; i++) walkSvgNode(children[i], effectiveColor);
	}
	walkSvgNode(svgEl, null);
}
function ChartIslandContent({ activeSpec, resolved, variant, plotWidth, plotHeight, localeTag, textOverrides, cardNumber, cardLevel, hostEl }) {
	const wrapRef = React.useRef(null);
	React.useLayoutEffect(() => {
		const root = wrapRef.current;
		if (!root || typeof root.querySelector !== "function") return;
		applyDomCustomColors(root, resolved);
		const headerRows = root.querySelectorAll?.(".ztd-card > header > div") ?? [];
		const firstHeaderRow = headerRows[0];
		const titleEl = root.querySelector(".ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3");
		if (titleEl) {
			titleEl.dataset.chartField = "title";
			titleEl.dataset.chartTextSlot = "field:title";
		}
		if (firstHeaderRow) {
			const firstSpan = firstHeaderRow.querySelector?.("span:first-child");
			if (firstSpan && firstSpan !== titleEl) {
				firstSpan.dataset.chartField = "cardNumber";
				firstSpan.dataset.chartTextSlot = "field:cardNumber";
				if (cardNumber !== void 0) firstSpan.textContent = String(cardNumber);
			}
		}
		const subtitleEl = headerRows[1]?.querySelector?.("span:first-child");
		if (subtitleEl && !subtitleEl.closest?.("ul")) {
			subtitleEl.dataset.chartField = "subtitle";
			subtitleEl.dataset.chartTextSlot = "field:subtitle";
		}
		const takeawayEl = root.querySelector(".ztd-card > footer > span:first-child");
		if (takeawayEl) {
			takeawayEl.dataset.chartField = "takeaway";
			takeawayEl.dataset.chartTextSlot = "field:takeaway";
		}
		const footerRightSpans = root.querySelectorAll?.(".ztd-card > footer > span:nth-child(2) > span") ?? [];
		const levelEl = footerRightSpans.length > 0 ? footerRightSpans[footerRightSpans.length - 1] : null;
		if (levelEl) {
			levelEl.dataset.chartField = "cardLevel";
			levelEl.dataset.chartTextSlot = "field:cardLevel";
			if (cardLevel !== void 0 && cardLevel !== "") levelEl.textContent = String(cardLevel);
		}
		const optionValues = /* @__PURE__ */ new Map();
		for (const optKey of NON_DATA_OPTION_KEYS$1) {
			const val = activeSpec?.options?.[optKey];
			if (typeof val === "string" && val.trim().length > 0) optionValues.set(val.trim(), optKey);
		}
		const svgTexts = root.querySelectorAll?.("svg text") ?? [];
		for (let i = 0; i < svgTexts.length; i++) {
			const textEl = svgTexts[i];
			const txt = (textEl.textContent ?? "").trim();
			const matchedOpt = optionValues.get(txt);
			if (matchedOpt) {
				const slotKey = `option:${matchedOpt}`;
				textEl.dataset.chartOptionField = matchedOpt;
				textEl.dataset.chartTextSlot = slotKey;
				if (textEl.style) {
					textEl.style.pointerEvents = "auto";
					textEl.style.cursor = "text";
				}
			} else {
				delete textEl.dataset?.chartOptionField;
				delete textEl.dataset?.chartTextSlot;
				if (textEl.style) textEl.style.cursor = "";
			}
		}
		const outerIsland = hostEl?.closest?.(".ecanvas-island") ?? hostEl?.closest?.("[data-entity-id]") ?? hostEl;
		const activeSlot = hostEl?.__ztdActiveEditSlot ?? outerIsland?.__ztdActiveEditSlot ?? null;
		const allSlots = root.querySelectorAll?.("[data-chart-text-slot], [data-chart-field], [data-chart-option-field]") ?? [];
		for (const el of allSlots) if (Boolean(activeSlot && (el.dataset?.chartTextSlot === activeSlot || `field:${el.dataset?.chartField}` === activeSlot || `option:${el.dataset?.chartOptionField}` === activeSlot || el.dataset?.chartField === activeSlot))) {
			if (el.style) el.style.opacity = "0";
			if (el.dataset) el.dataset.hiddenByEditor = "true";
		} else if (el.dataset?.hiddenByEditor === "true") {
			if (el.style) el.style.opacity = "";
			delete el.dataset.hiddenByEditor;
		}
		if (resolved?.itemColors && Object.keys(resolved.itemColors).length > 0 && typeof MutationObserver === "function") {
			let applying = false;
			const observer = new MutationObserver(() => {
				if (applying) return;
				applying = true;
				try {
					applyDomCustomColors(root, resolved);
				} finally {
					applying = false;
				}
			});
			const svgEl = root.querySelector("svg");
			if (svgEl) {
				observer.observe(svgEl, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ["fill", "stroke"]
				});
				return () => observer.disconnect();
			}
		}
	});
	return React.createElement("div", {
		ref: wrapRef,
		style: {
			width: "100%",
			height: "100%",
			boxSizing: "border-box",
			padding: variant === "card" ? "0px" : "12px",
			display: "flex",
			flexDirection: "column",
			justifyContent: "center"
		}
	}, React.createElement(Chart, {
		spec: activeSpec,
		width: plotWidth,
		height: plotHeight,
		locale: localeTag
	}));
}
/**
* Interactive DOM island renderer for `diagram.ztd-charts.chart`.
* Uses React 19 `createRoot` with generation-guarded microtask cleanup so
* `CanvasViewport.reconcileEntity` updates preserve hover/interaction state
* while `clearIslandContent` unmounts cleanly.
*/
function renderChartDom(hostEl, props, derived, entityId = "chart") {
	if (!hostEl) return () => {};
	const geom = derived ?? {
		x: 0,
		y: 0,
		width: 480,
		height: 340,
		rotation: 0
	};
	const width = Math.max(120, Math.round(Number.isFinite(geom.width) ? geom.width : 480));
	const height = Math.max(100, Math.round(Number.isFinite(geom.height) ? geom.height : 340));
	const resolved = resolveChartSpec(props);
	const { spec, bareSpec, resolvedTheme, localeTag, variant, chartType, themeName, title, cardNumber, cardLevel, textOverrides, legendItems } = resolved;
	if (hostEl.dataset) {
		hostEl.dataset.chartType = chartType;
		hostEl.dataset.chartTheme = themeName;
		hostEl.dataset.chartVariant = variant;
		hostEl.dataset.chartTitle = title;
		hostEl.dataset.chartBackground = resolved.backgroundColor || "";
	}
	const themeVars = themeToCss(resolvedTheme);
	const transparentCard = resolved.backgroundColor === "transparent";
	if (hostEl.dataset) {
		if (transparentCard) hostEl.dataset.ztdCardBackground = "transparent";
		else delete hostEl.dataset.ztdCardBackground;
	}
	if (hostEl.style) hostEl.style.cssText = `${themeVars};width:100%;height:${height}px;box-sizing:border-box;position:relative;overflow:hidden;border-radius:${resolved.cornerRadius}px;background:${transparentCard ? "transparent" : resolved.backgroundColor || resolvedTheme.panel};border:1px solid ${transparentCard ? "transparent" : resolvedTheme.line};color:${resolvedTheme.ink};font-family:${resolvedTheme.fontFamily};user-select:none;`;
	const doc = hostEl.ownerDocument;
	if (!doc || typeof doc.createElement !== "function") {
		const { svg } = renderChartSvg(props, {
			...geom,
			x: 0,
			y: 0,
			rotation: 0
		}, entityId);
		hostEl.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
		return () => {
			hostEl.innerHTML = "";
		};
	}
	ensureDocumentBaseCss(doc);
	let entry = mountedRoots.get(hostEl);
	if (!entry || !hostEl.contains?.(entry.mountNode)) {
		const mountNode = doc.createElement("div");
		mountNode.dataset.role = "ztd-chart-mount";
		mountNode.style.cssText = "width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:stretch;";
		hostEl.replaceChildren(mountNode);
		entry = {
			root: createRoot(mountNode),
			mountNode,
			gen: 0
		};
		mountedRoots.set(hostEl, entry);
	}
	const hasSubtitle = variant === "card" && Boolean(resolved.subtitle);
	const hasLegend = variant === "card" && legendItems.length > 0;
	const hasTakeaway = variant === "card" && Boolean(resolved.takeaway);
	const plotHeight = Math.max(96, height - (variant === "card" ? (variant === "card" && Boolean(cardNumber) ? 68 : 48) + (hasSubtitle ? 20 : 0) + (hasLegend ? 24 : 0) + (hasTakeaway ? 34 : 0) : 24));
	const plotWidth = Math.max(140, width - (variant === "card" ? 40 : 24));
	const activeSpec = variant === "card" ? spec : bareSpec;
	const element = React.createElement(ThemeProvider, { theme: resolvedTheme }, React.createElement(ChartIslandContent, {
		activeSpec,
		resolved,
		variant,
		plotWidth,
		plotHeight,
		localeTag,
		textOverrides,
		cardNumber,
		cardLevel,
		hostEl
	}));
	const renderGen = ++entry.gen;
	entry.root.render(element);
	return () => {
		const current = entry;
		queueMicrotask(() => {
			if (!current) return;
			if (current.gen === renderGen || !hostEl.contains?.(current.mountNode)) {
				try {
					current.root.unmount();
				} catch {}
				if (mountedRoots.get(hostEl) === current) mountedRoots.delete(hostEl);
			}
		});
	};
}
// src/manifest.js
var EXTENSION_ID = extension_default.id;
var CHART_ASPECT_ID = `${EXTENSION_ID}.chart`;
var STUDIO_PANEL_ID = `${EXTENSION_ID}.studio`;
var COMMAND_NAMES = Object.freeze([
	"insert-chart",
	"edit-chart",
	"set-chart-type",
	"update-data",
	"update-style",
	"reset-sample-data",
	"apply-top-suggestion",
	"toggle-theme",
	"toggle-variant",
	"toggle-locale"
]);
var settingsSchema = Object.freeze([
	{
		key: "defaultTheme",
		label: "기본 차트 테마",
		kind: "select",
		defaultValue: "light",
		options: [{
			value: "light",
			label: "라이트"
		}, {
			value: "dark",
			label: "다크"
		}]
	},
	{
		key: "defaultLocale",
		label: "기본 차트 언어",
		kind: "select",
		defaultValue: "ko",
		options: [{
			value: "ko",
			label: "한국어"
		}, {
			value: "en",
			label: "English"
		}]
	},
	{
		key: "defaultVariant",
		label: "기본 표시 형태",
		kind: "select",
		defaultValue: "card",
		options: [{
			value: "card",
			label: "카드형 (제목·범례·요약 포함)"
		}, {
			value: "bare",
			label: "차트만 표시"
		}]
	}
]);
/** Shared by the bundle and build script; keep the reviewed and executed contracts identical. */
function createPackageManifest(metadata = extension_default) {
	return {
		id: metadata.id,
		settingsSchema,
		version: metadata.version,
		engine: metadata.engine,
		dependencies: { ...metadata.dependencies },
		optionalDependencies: { ...metadata.optionalDependencies },
		conflicts: [...metadata.conflicts],
		provides: {
			services: [...metadata.provides.services],
			aspects: [`${metadata.id}.chart`],
			hsmSlots: [...metadata.provides.hsmSlots]
		}
	};
}
Object.freeze(createPackageManifest(extension_default));
// src/inline-editor.js
var CARD_FIELDS = Object.freeze([
	"title",
	"subtitle",
	"takeaway",
	"cardNumber",
	"cardLevel"
]);
var NON_DATA_OPTION_KEYS = Object.freeze([
	"centerLabel",
	"label",
	"xLabel",
	"yLabel",
	"note"
]);
/**
* Merges a local draft with concurrent remote updates so changes outside
* the locally edited span survive remote updates during IME composition.
*/
function mergeDraft(base, local, remote) {
	if (remote === base || local === remote) return local;
	if (local === base) return remote;
	let a = 0;
	let z = 0;
	while (a < base.length && a < local.length && base[a] === local[a]) a++;
	while (z < base.length - a && z < local.length - a && base[base.length - 1 - z] === local[local.length - 1 - z]) z++;
	let r = 0;
	let t = 0;
	while (r < base.length && r < remote.length && base[r] === remote[r]) r++;
	while (t < base.length - r && t < remote.length - r && base[base.length - 1 - t] === remote[remote.length - 1 - t]) t++;
	const end = base.length - z;
	const remoteEnd = base.length - t;
	const insert = local.slice(a, local.length - z);
	const delta = remote.length - base.length;
	if (remoteEnd <= a) return remote.slice(0, a + delta) + insert + remote.slice(end + delta);
	if (r >= end) return remote.slice(0, a) + insert + remote.slice(end);
	return remote.slice(0, Math.min(a, r)) + remote.slice(r, remote.length - t) + insert + remote.slice(Math.max(remoteEnd, end) + delta);
}
/**
* Parses a displayed numeric label (e.g. "1,240", "42.5%", "+18", "−380", "₩3,200") into a finite number.
*/
function parseDisplayedNumber(text) {
	if (typeof text !== "string") return null;
	const cleaned = text.trim().replace(/−/g, "-").replace(/[,%\s₩$€¥£원건명개점]/g, "").replace(/^[+]/, "");
	if (!cleaned || !/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
	const num = Number(cleaned);
	return Number.isFinite(num) ? num : null;
}
/**
* Detects whether a text string corresponds to a data cell (category, series, or numeric value)
* in `rows`. Used to guard against editing data cells via inline canvas text editing.
*/
function matchTextToChartData(rawText, rows, localeTag = "ko-KR") {
	if (typeof rawText !== "string") return null;
	const trimmed = rawText.trim();
	if (!trimmed || !Array.isArray(rows) || rows.length === 0) return null;
	const stringMatches = [];
	for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
		const row = rows[rowIndex];
		if (!row || typeof row !== "object") continue;
		for (const [colKey, val] of Object.entries(row)) if (typeof val === "string" && val.trim() === trimmed) stringMatches.push({
			rowIndex,
			colKey
		});
	}
	if (stringMatches.length > 0) {
		const first = stringMatches[0];
		return {
			kind: "data",
			cellKind: "string",
			colKey: first.colKey,
			rowIndex: first.rowIndex,
			matches: stringMatches,
			initialValue: String(rows[first.rowIndex][first.colKey] ?? trimmed)
		};
	}
	const parsedNum = parseDisplayedNumber(trimmed);
	if (parsedNum !== null) {
		const numMatches = [];
		for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
			const row = rows[rowIndex];
			if (!row || typeof row !== "object") continue;
			for (const [colKey, val] of Object.entries(row)) {
				if (typeof val !== "number" || !Number.isFinite(val)) continue;
				const formatted = val.toLocaleString(localeTag);
				if (val === parsedNum || Math.abs(val - parsedNum) < 1e-6 || Number(val.toFixed(1)) === parsedNum || formatted === trimmed) numMatches.push({
					rowIndex,
					colKey
				});
			}
		}
		if (numMatches.length > 0) {
			const first = numMatches[0];
			return {
				kind: "data",
				cellKind: "number",
				colKey: first.colKey,
				rowIndex: first.rowIndex,
				matches: [first],
				initialValue: String(rows[first.rowIndex][first.colKey])
			};
		}
	}
	return null;
}
function isPlainRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Resolves the world-space bounding box of a chart entity across both the real
* `@alid/kernel` `CanvasWorld` (`getComputed(id, aspect)`) and lightweight test mocks.
*/
function getChartWorldBounds(world, entityId, props) {
	if (!world || !entityId) return null;
	const computed = world.getComputed?.(entityId, `computed.${CHART_ASPECT_ID}`) ?? world.getComputed?.(entityId, "computed.effectiveBounds") ?? world.getComputed?.(entityId, "computed.layoutBounds") ?? world.getComputed?.(entityId);
	if (computed && Number.isFinite(computed.width) && Number.isFinite(computed.height)) return computed;
	return deriveChartGeometry(props ?? world.getCanonical?.(entityId, CHART_ASPECT_ID), entityId, world);
}
function readTargetValue(props, target) {
	if (!props || !target) return "";
	const resolved = resolveChartSpec(props);
	const textOverrides = resolved.textOverrides ?? {};
	if (target.slotKey && textOverrides[target.slotKey] !== void 0) return String(textOverrides[target.slotKey]);
	if (target.kind === "field") {
		const field = target.field;
		if (field === "cardNumber") return String(resolved.cardNumber ?? "");
		if (field === "cardLevel") return String(resolved.cardLevel ?? "");
		const raw = props[field];
		if (typeof raw === "string" && raw.length > 0) return raw;
		return String(resolved[field] ?? "");
	}
	if (target.kind === "option") {
		const optKey = target.optionKey;
		const rawOpt = props.options?.[optKey] ?? resolved.spec?.options?.[optKey];
		if (typeof rawOpt === "string") return rawOpt;
		return String(target.initialValue ?? "");
	}
	return "";
}
/**
* Builds a canonical patch for non-data targets only.
* Never mutates `props.data`.
*/
function buildPatchForTarget(props, target, rawValue) {
	if (!props || !target) return null;
	const prevOptions = isPlainRecord(props.options) ? { ...props.options } : {};
	const prevOverrides = isPlainRecord(prevOptions.textOverrides) ? { ...prevOptions.textOverrides } : {};
	if (target.kind === "field") {
		const field = target.field;
		if (!CARD_FIELDS.includes(field)) return null;
		if (rawValue === readTargetValue(props, target) && (field === "cardNumber" || field === "cardLevel" || props[field] === rawValue)) return null;
		if (field === "cardNumber") return { options: {
			...prevOptions,
			cardNumber: rawValue,
			textOverrides: {
				...prevOverrides,
				"field:cardNumber": rawValue
			}
		} };
		if (field === "cardLevel") return { options: {
			...prevOptions,
			cardLevel: rawValue,
			textOverrides: {
				...prevOverrides,
				"field:cardLevel": rawValue
			}
		} };
		const nextOverrides = { ...prevOverrides };
		if (rawValue === "") nextOverrides[`field:${field}`] = "";
		else delete nextOverrides[`field:${field}`];
		return {
			[field]: rawValue,
			options: {
				...prevOptions,
				textOverrides: nextOverrides
			}
		};
	}
	if (target.kind === "option") {
		const optKey = target.optionKey;
		if (!NON_DATA_OPTION_KEYS.includes(optKey)) return null;
		const slotKey = target.slotKey || `option:${optKey}`;
		if (rawValue === readTargetValue(props, target) && prevOptions[optKey] === rawValue) return null;
		return { options: {
			...prevOptions,
			[optKey]: rawValue,
			textOverrides: {
				...prevOverrides,
				[slotKey]: rawValue
			}
		} };
	}
	return null;
}
function findIslandElement(surfaceEl, entityId) {
	if (!surfaceEl || typeof surfaceEl.querySelector !== "function") return null;
	return surfaceEl.querySelector(`[data-entity-id="${entityId}"]`);
}
function setActiveSlotOnIsland(surfaceEl, entityId, slotKey) {
	const islandEl = findIslandElement(surfaceEl, entityId);
	if (islandEl) {
		if (slotKey) islandEl.__ztdActiveEditSlot = slotKey;
		else delete islandEl.__ztdActiveEditSlot;
	}
	if (surfaceEl && typeof surfaceEl.querySelectorAll === "function") {
		const allMatching = surfaceEl.querySelectorAll(`[data-entity-id="${entityId}"]`);
		for (const node of allMatching) if (slotKey) node.__ztdActiveEditSlot = slotKey;
		else delete node.__ztdActiveEditSlot;
	}
}
function findFieldElementInIsland(islandEl, field) {
	if (!islandEl || typeof islandEl.querySelector !== "function") return null;
	const tagged = islandEl.querySelector(`[data-chart-field="${field}"]`);
	if (tagged) return tagged;
	if (field === "title") return islandEl.querySelector(".ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3");
	if (field === "subtitle") return (islandEl.querySelectorAll?.(".ztd-card > header > div"))?.[1]?.querySelector?.("span:first-child") ?? null;
	if (field === "takeaway") return islandEl.querySelector(".ztd-card > footer > span:first-child");
	return null;
}
function findSlotElementInIsland(islandEl, target) {
	if (!islandEl || !target) return null;
	if (target.slotKey && typeof islandEl.querySelector === "function") {
		const bySlot = islandEl.querySelector(`[data-chart-text-slot="${target.slotKey}"]`);
		if (bySlot) return bySlot;
	}
	if (target.kind === "field" && target.field) return findFieldElementInIsland(islandEl, target.field);
	if (target.kind === "option" && target.optionKey && typeof islandEl.querySelector === "function") return islandEl.querySelector(`[data-chart-option-field="${target.optionKey}"]`);
	return null;
}
function isScreenReaderOrHidden(el) {
	let cur = el;
	while (cur) {
		if (cur.classList?.contains?.("ztd-sr")) return true;
		if (cur.getAttribute?.("aria-hidden") === "true") return true;
		const tag = cur.tagName?.toLowerCase?.();
		if (tag === "title" || tag === "desc" || tag === "defs") return true;
		cur = cur.parentElement;
	}
	return false;
}
function matchNonDataOptionKey(el, resolved) {
	if (!el) return null;
	const explicit = el.getAttribute?.("data-chart-option-field") ?? el.dataset?.chartOptionField;
	if (explicit && NON_DATA_OPTION_KEYS.includes(explicit)) return explicit;
	const text = (el.textContent ?? "").trim();
	if (!text) return null;
	if (matchTextToChartData(text, resolved?.spec?.data ?? [], resolved?.localeTag) || parseDisplayedNumber(text) !== null) return null;
	for (const optKey of NON_DATA_OPTION_KEYS) {
		const optVal = resolved?.spec?.options?.[optKey];
		if (typeof optVal === "string" && optVal.trim().length > 0 && optVal.trim() === text) return optKey;
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
		if (cur.dataset?.chartField && CARD_FIELDS.includes(cur.dataset.chartField)) return false;
		if (matchNonDataOptionKey(cur, resolved)) return false;
		const tag = cur.tagName?.toLowerCase?.();
		if (tag === "svg" || tag === "text" || tag === "tspan" || tag === "rect" || tag === "path" || tag === "circle" || tag === "line" || tag === "polygon" || tag === "polyline" || tag === "g" || tag === "ul" || tag === "li") return true;
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
	const fieldEl = el.closest?.("[data-chart-field]") ?? (el.dataset?.chartField ? el : null);
	if (fieldEl) {
		const field = fieldEl.getAttribute?.("data-chart-field") ?? fieldEl.dataset?.chartField;
		if (CARD_FIELDS.includes(field)) return {
			target: {
				kind: "field",
				field,
				slotKey: `field:${field}`
			},
			anchorEl: fieldEl
		};
	}
	const optEl = el.closest?.("[data-chart-option-field]") ?? (el.dataset?.chartOptionField ? el : null);
	if (optEl) {
		const optKey = optEl.getAttribute?.("data-chart-option-field") ?? optEl.dataset?.chartOptionField;
		if (NON_DATA_OPTION_KEYS.includes(optKey)) return {
			target: {
				kind: "option",
				optionKey: optKey,
				slotKey: `option:${optKey}`,
				initialValue: (optEl.textContent ?? "").trim()
			},
			anchorEl: optEl
		};
	}
	const svgTextEl = el.closest?.("svg text") ?? (el.tagName?.toLowerCase?.() === "text" ? el : null);
	if (svgTextEl) {
		const optKey = matchNonDataOptionKey(svgTextEl, resolved);
		if (optKey) return {
			target: {
				kind: "option",
				optionKey: optKey,
				slotKey: `option:${optKey}`,
				initialValue: (svgTextEl.textContent ?? "").trim()
			},
			anchorEl: svgTextEl
		};
		return null;
	}
	if (isDataAreaElement(el, resolved)) return null;
	const headerTitle = el.closest?.(".ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3");
	if (headerTitle) return {
		target: {
			kind: "field",
			field: "title",
			slotKey: "field:title"
		},
		anchorEl: headerTitle
	};
	const spanEl = el.closest?.("span");
	if (spanEl && islandEl?.contains?.(spanEl) && !isScreenReaderOrHidden(spanEl)) {
		const spanText = (spanEl.textContent ?? "").trim();
		if (spanText) {
			if (spanText === resolved.subtitle) return {
				target: {
					kind: "field",
					field: "subtitle",
					slotKey: "field:subtitle"
				},
				anchorEl: spanEl
			};
			if (spanText === resolved.takeaway) return {
				target: {
					kind: "field",
					field: "takeaway",
					slotKey: "field:takeaway"
				},
				anchorEl: spanEl
			};
			if (spanText === String(resolved.cardNumber ?? "")) return {
				target: {
					kind: "field",
					field: "cardNumber",
					slotKey: "field:cardNumber"
				},
				anchorEl: spanEl
			};
			if (spanText === String(resolved.cardLevel ?? "")) return {
				target: {
					kind: "field",
					field: "cardLevel",
					slotKey: "field:cardLevel"
				},
				anchorEl: spanEl
			};
		}
	}
	const headerEl = el.closest?.(".ztd-card > header");
	if (headerEl) return {
		target: {
			kind: "field",
			field: "title",
			slotKey: "field:title"
		},
		anchorEl: findFieldElementInIsland(islandEl, "title") ?? headerEl
	};
	const footerEl = el.closest?.(".ztd-card > footer");
	if (footerEl) return {
		target: {
			kind: "field",
			field: "takeaway",
			slotKey: "field:takeaway"
		},
		anchorEl: findFieldElementInIsland(islandEl, "takeaway") ?? footerEl
	};
	return null;
}
function resolveHitTargetInIsland(islandEl, clientX, clientY, eventTARGETS, props, bounds, worldPoint) {
	const resolved = resolveChartSpec(props);
	const doc = islandEl?.ownerDocument;
	const candidates = [];
	for (const t of eventTARGETS) if (t && islandEl?.contains?.(t) && !candidates.includes(t)) candidates.push(t);
	if (doc && typeof doc.elementsFromPoint === "function" && Number.isFinite(clientX) && Number.isFinite(clientY)) {
		for (const el of doc.elementsFromPoint(clientX, clientY)) if (islandEl?.contains?.(el) && !candidates.includes(el)) candidates.push(el);
	} else if (doc && typeof doc.elementFromPoint === "function" && Number.isFinite(clientX) && Number.isFinite(clientY)) {
		const el = doc.elementFromPoint(clientX, clientY);
		if (el && islandEl?.contains?.(el) && !candidates.includes(el)) candidates.push(el);
	}
	for (const el of candidates) {
		if (el === islandEl) continue;
		const hit = buildNonDataTargetFromElement(islandEl, el, resolved);
		if (hit) return hit;
		if (isDataAreaElement(el, resolved)) return null;
	}
	if (islandEl && typeof islandEl.querySelectorAll === "function" && Number.isFinite(clientX) && Number.isFinite(clientY)) {
		const nonDataNodes = islandEl.querySelectorAll("[data-chart-field], [data-chart-option-field], .ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3");
		let bestNode = null;
		let bestScore = Infinity;
		for (const node of nonDataNodes) {
			if (isScreenReaderOrHidden(node)) continue;
			const rect = node.getBoundingClientRect?.();
			if (!rect || rect.width <= 0 || rect.height <= 0) continue;
			const pad = 8;
			if (clientX >= rect.left - pad && clientX <= rect.right + pad && clientY >= rect.top - pad && clientY <= rect.bottom + pad) {
				const cx = (rect.left + rect.right) / 2;
				const cy = (rect.top + rect.bottom) / 2;
				const score = Math.hypot(clientX - cx, clientY - cy) + rect.width * rect.height * .001;
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
		const dataContainers = islandEl.querySelectorAll("svg, .ztd-card > header ul");
		for (const dataBox of dataContainers) {
			const rect = dataBox.getBoundingClientRect?.();
			if (rect && rect.width > 0 && rect.height > 0 && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return null;
		}
		const headerEl = islandEl.querySelector?.(".ztd-card > header");
		const headerRect = headerEl?.getBoundingClientRect?.();
		if (headerRect && headerRect.width > 0 && headerRect.height > 0 && clientX >= headerRect.left - 4 && clientX <= headerRect.right + 4 && clientY >= headerRect.top - 4 && clientY <= headerRect.bottom + 4) return {
			target: {
				kind: "field",
				field: "title",
				slotKey: "field:title"
			},
			anchorEl: findFieldElementInIsland(islandEl, "title") ?? headerEl
		};
		const footerEl = islandEl.querySelector?.(".ztd-card > footer");
		const footerRect = footerEl?.getBoundingClientRect?.();
		if (footerRect && footerRect.width > 0 && footerRect.height > 0 && clientX >= footerRect.left - 4 && clientX <= footerRect.right + 4 && clientY >= footerRect.top - 4 && clientY <= footerRect.bottom + 4) return {
			target: {
				kind: "field",
				field: "takeaway",
				slotKey: "field:takeaway"
			},
			anchorEl: findFieldElementInIsland(islandEl, "takeaway") ?? footerEl
		};
	}
	if (bounds && worldPoint && resolved.variant === "card") {
		const localY = worldPoint.y - bounds.y;
		const hasSubtitle = Boolean(resolved.subtitle);
		const hasLegend = (resolved.legendItems?.length ?? 0) > 0;
		const headerBottom = 56 + (hasSubtitle ? 22 : 0) + (hasLegend ? 20 : 0);
		const footerTop = bounds.height - 52;
		if (localY >= 40 && localY <= headerBottom && hasSubtitle) return {
			target: {
				kind: "field",
				field: "subtitle",
				slotKey: "field:subtitle"
			},
			anchorEl: findFieldElementInIsland(islandEl, "subtitle")
		};
		if (localY >= footerTop) return {
			target: {
				kind: "field",
				field: "takeaway",
				slotKey: "field:takeaway"
			},
			anchorEl: findFieldElementInIsland(islandEl, "takeaway")
		};
		if (localY <= headerBottom) return {
			target: {
				kind: "field",
				field: "title",
				slotKey: "field:title"
			},
			anchorEl: findFieldElementInIsland(islandEl, "title")
		};
		if (islandEl?.querySelector?.("svg")) return null;
	}
	return {
		target: {
			kind: "field",
			field: "title",
			slotKey: "field:title"
		},
		anchorEl: findFieldElementInIsland(islandEl, "title")
	};
}
function captureAnchorMetrics(islandEl, anchorEl, target, resolved, zoom) {
	const win = (islandEl?.ownerDocument ?? anchorEl?.ownerDocument)?.defaultView ?? globalThis;
	const cs = anchorEl && typeof win.getComputedStyle === "function" ? win.getComputedStyle(anchorEl) : null;
	const isSvgText = anchorEl?.tagName?.toLowerCase?.() === "text";
	let textAlign = "left";
	if (isSvgText) {
		const anchorAttr = anchorEl.getAttribute?.("text-anchor") || cs?.textAnchor || "start";
		if (anchorAttr === "middle") textAlign = "center";
		else if (anchorAttr === "end") textAlign = "right";
	} else if (cs?.textAlign && [
		"left",
		"center",
		"right"
	].includes(cs.textAlign)) textAlign = cs.textAlign;
	let baseFontSize = parseFloat(anchorEl?.getAttribute?.("font-size") ?? "") || parseFloat(cs?.fontSize ?? "");
	if (!Number.isFinite(baseFontSize) || baseFontSize <= 0) {
		if (target.kind === "field") baseFontSize = target.field === "title" ? 22 : target.field === "takeaway" || target.field === "cardNumber" ? 17 : 12.5;
		else baseFontSize = 11.5;
	}
	const fontWeight = anchorEl?.getAttribute?.("font-weight") || cs?.fontWeight || (target.kind === "field" && (target.field === "title" || target.field === "takeaway") ? "800" : "500");
	const fontFamily = cs?.fontFamily || resolved.resolvedTheme.fontFamily || "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
	const letterSpacing = cs?.letterSpacing || "normal";
	let color = resolved.resolvedTheme.ink;
	if (isSvgText) {
		const fillAttr = anchorEl.getAttribute?.("fill");
		const csFill = cs?.fill;
		if (csFill && csFill !== "none" && !csFill.startsWith("url(")) color = csFill;
		else if (fillAttr && fillAttr !== "none" && !fillAttr.startsWith("url(")) color = fillAttr;
	} else if (cs?.color) color = cs.color;
	let svgScaleRatio = 1;
	if (isSvgText) {
		const svgEl = anchorEl.closest?.("svg");
		const svgRect = svgEl?.getBoundingClientRect?.();
		const vbAttr = svgEl?.getAttribute?.("viewBox");
		const vbParts = vbAttr ? vbAttr.trim().split(/[\s,]+/).map(Number) : null;
		if (svgRect && svgRect.width > 0 && vbParts && vbParts.length === 4 && vbParts[2] > 0) svgScaleRatio = svgRect.width / zoom / vbParts[2];
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
			height: elRect.height / zoom
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
		relBox
	};
}
function estimateTextPixelWidth(text, fontSizePx) {
	const str = String(text ?? "");
	let units = 0;
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		units += code > 255 ? .95 : .62;
	}
	return Math.ceil(Math.max(1.5, units + .8) * fontSizePx);
}
function resolveToolSurface(provider) {
	const active = provider?.get?.();
	if (active?.surface?.hud && active?.surface?.element) return active;
	return null;
}
/**
* Mounts a seamless, zero-chrome inline text editor onto the active Alid canvas HUD
* so non-data text areas of a chart (`title`, `subtitle`, `takeaway`, `cardNumber`,
* `cardLevel`, and explicit non-data option labels) can be edited in place via
* double-click or `Enter`.
*/
function mountInlineEditor(context) {
	const provider = context?.services?.get?.("canvas.active-tool-surface");
	const frames = context?.services?.get?.("canvas.frames");
	const textHistory = context?.services?.get?.("canvas.text-history");
	let closeCurrent = () => {};
	let openCurrent = () => false;
	let detachCurrent = () => {};
	let mountedSurfaceEl = null;
	function mount() {
		const s = resolveToolSurface(provider);
		if (!s?.surface?.hud || !s?.surface?.element || typeof document === "undefined") {
			closeCurrent();
			detachCurrent();
			mountedSurfaceEl = null;
			return;
		}
		if (mountedSurfaceEl === s.surface.element) return;
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
		const container = doc.createElement("div");
		container.dataset.canvasUi = "true";
		container.dataset.ztdChartEditorContainer = "true";
		Object.assign(container.style, {
			position: "absolute",
			display: "none",
			pointerEvents: "auto",
			zIndex: "25",
			boxSizing: "border-box",
			background: "transparent",
			border: "none",
			padding: "0",
			margin: "0"
		});
		const input = doc.createElement("input");
		input.type = "text";
		input.dataset.canvasEditor = "true";
		input.dataset.ztdChartEditor = "true";
		input.dataset.escapeOwner = "true";
		input.spellcheck = false;
		input.setAttribute("aria-label", "차트 텍스트 편집");
		Object.assign(input.style, {
			width: "100%",
			height: "100%",
			boxSizing: "border-box",
			margin: "0",
			padding: "0",
			border: "none",
			borderRadius: "0",
			outline: "none",
			background: "transparent",
			boxShadow: "none",
			fontVariantNumeric: "tabular-nums"
		});
		container.append(input);
		s.surface.hud.append(container);
		let hiddenElements = [];
		function restoreHiddenElements(entityId) {
			if (entityId) setActiveSlotOnIsland(s.surface.element, entityId, null);
			for (const el of hiddenElements) {
				if (el && el.style) el.style.opacity = "";
				if (el && el.dataset) delete el.dataset.hiddenByEditor;
			}
			hiddenElements = [];
		}
		function hideTargetElement(el) {
			if (!el || !el.style) return;
			el.style.opacity = "0";
			if (el.dataset) el.dataset.hiddenByEditor = "true";
			if (!hiddenElements.includes(el)) hiddenElements.push(el);
		}
		function positionEditor() {
			if (!session) return;
			const props = context.world.getCanonical?.(session.id, CHART_ASPECT_ID);
			if (!props) return;
			const hudRect = s.surface.hud.getBoundingClientRect?.() ?? {
				left: 0,
				top: 0,
				width: 0,
				height: 0
			};
			const zoom = Math.max(.1, s.host?.getZoom?.() ?? 1);
			const islandEl = findIslandElement(s.surface.element, session.id);
			if (session.target.slotKey) setActiveSlotOnIsland(s.surface.element, session.id, session.target.slotKey);
			const liveTargetEl = findSlotElementInIsland(islandEl, session.target) ?? session.anchorEl;
			if (liveTargetEl) hideTargetElement(liveTargetEl);
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
				background: "transparent",
				border: "none",
				outline: "none",
				boxShadow: "none"
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
				if (metrics.textAlign === "center") left = screenLeft + baseWidth / 2 - boxWidth / 2;
				else if (metrics.textAlign === "right") left = screenLeft + baseWidth - boxWidth;
				container.style.left = `${Math.round(left * 10) / 10}px`;
				container.style.top = `${Math.round((screenTop - (boxHeight - relBox.height * zoom) / 2) * 10) / 10}px`;
				container.style.width = `${Math.ceil(boxWidth)}px`;
				container.style.height = `${boxHeight}px`;
				container.style.transform = "none";
				input.style.lineHeight = `${boxHeight}px`;
				return;
			}
			const b = getChartWorldBounds(context.world, session.id, props);
			const wx = Number.isFinite(b?.x) ? b.x : 0;
			const wy = Number.isFinite(b?.y) ? b.y : 0;
			const ww = Number.isFinite(b?.width) ? b.width : 480;
			const wh = Number.isFinite(b?.height) ? b.height : 340;
			const topLeft = {
				x: 0,
				y: 0
			};
			const bottomRight = {
				x: 0,
				y: 0
			};
			s.host?.worldToScreen?.(wx, wy, topLeft);
			s.host?.worldToScreen?.(wx + ww, wy + wh, bottomRight);
			const boxLeft = topLeft.x - hudRect.left;
			const boxTop = topLeft.y - hudRect.top;
			const boxWidth = Math.max(160, bottomRight.x - topLeft.x);
			const boxHeight = Math.max(120, bottomRight.y - topLeft.y);
			const field = session.target.field ?? "title";
			const yOffset = field === "title" || field === "cardNumber" ? 18 * zoom : field === "subtitle" ? 46 * zoom : boxHeight - 36 * zoom;
			const h = Math.max(22, Math.ceil(fontSizePx * 1.35));
			container.style.left = `${boxLeft + 20 * zoom}px`;
			container.style.top = `${boxTop + yOffset}px`;
			container.style.width = `${Math.max(120, boxWidth - 40 * zoom)}px`;
			container.style.height = `${h}px`;
			container.style.transform = "none";
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
				context.world.applyCanonicalTransaction(`${EXTENSION_ID}:inline-edit`, [{
					id: session.id,
					aspect: CHART_ASPECT_ID,
					patch
				}]);
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
			container.style.display = "none";
			if (commit && context.world.isAlive?.(ending.id)) {
				const props = context.world.getCanonical?.(ending.id, CHART_ASPECT_ID);
				if (props) {
					const patch = buildPatchForTarget(props, ending.target, input.value);
					if (patch) {
						textHistory?.change?.();
						context.world.applyCanonicalTransaction(`${EXTENSION_ID}:inline-edit`, [{
							id: ending.id,
							aspect: CHART_ASPECT_ID,
							patch
						}]);
					}
				}
			}
			textHistory?.seal?.();
			if (doc.activeElement === input) input.blur?.();
			s.host?.requestRender?.();
		}
		function startEditing(entityId, target, explicitAnchorEl = null) {
			if (!entityId || !target || !context.world.isAlive?.(entityId)) return false;
			if (context.world.isEntityReadOnly?.(entityId)) return false;
			const props = context.world.getCanonical?.(entityId, CHART_ASPECT_ID);
			if (!props) return false;
			if (session) finish(true);
			const resolved = resolveChartSpec(props);
			const zoom = Math.max(.1, s.host?.getZoom?.() ?? 1);
			const islandEl = findIslandElement(s.surface.element, entityId);
			const anchorEl = explicitAnchorEl ?? findSlotElementInIsland(islandEl, target);
			const metrics = captureAnchorMetrics(islandEl, anchorEl, target, resolved, zoom);
			const initial = readTargetValue(props, target);
			if (target.slotKey) setActiveSlotOnIsland(s.surface.element, entityId, target.slotKey);
			if (anchorEl) hideTargetElement(anchorEl);
			session = {
				id: entityId,
				target,
				anchorEl,
				metrics,
				base: initial,
				writing: false
			};
			lastOpenedAt = Date.now();
			input.value = initial;
			container.style.display = "block";
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
					if (!composing && input.value !== next) input.value = next;
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
			if (islandEl && typeof islandEl.querySelectorAll === "function") {
				const nodes = Array.from(islandEl.querySelectorAll("[data-chart-field], [data-chart-option-field]")).filter((el) => !isScreenReaderOrHidden(el));
				const uniqueSlots = [];
				const seen = /* @__PURE__ */ new Set();
				for (const el of nodes) {
					const hit = buildNonDataTargetFromElement(islandEl, el, resolved);
					if (!hit || !hit.target.slotKey || seen.has(hit.target.slotKey)) continue;
					seen.add(hit.target.slotKey);
					uniqueSlots.push(hit);
				}
				if (uniqueSlots.length > 1) {
					const currentIdx = uniqueSlots.findIndex((item) => item.target.slotKey === session.target.slotKey);
					const nextHit = uniqueSlots[((currentIdx >= 0 ? currentIdx : 0) + step + uniqueSlots.length) % uniqueSlots.length];
					startEditing(entityId, nextHit.target, nextHit.anchorEl);
					return;
				}
			}
			const basicFields = [
				"title",
				"subtitle",
				"takeaway"
			];
			const currentField = session.target.field ?? "title";
			const nextField = basicFields[(Math.max(0, basicFields.indexOf(currentField)) + step + basicFields.length) % basicFields.length];
			startEditing(entityId, {
				kind: "field",
				field: nextField,
				slotKey: `field:${nextField}`
			});
		}
		function resolveChartEntityAtPoint(clientX, clientY, candidateTargets) {
			const worldPoint = {
				x: 0,
				y: 0
			};
			if (Number.isFinite(clientX) && Number.isFinite(clientY) && s.host?.screenToWorld) s.host.screenToWorld(clientX, clientY, worldPoint);
			for (const candidate of candidateTargets) {
				if (!candidate || typeof candidate.closest !== "function") continue;
				const island = candidate.closest("[data-entity-id]");
				const id = island?.getAttribute?.("data-entity-id") ?? island?.dataset?.entityId;
				if (id && context.world.getCanonical?.(id, CHART_ASPECT_ID)) return {
					hitId: id,
					hitBounds: getChartWorldBounds(context.world, id),
					worldPoint
				};
			}
			if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
				const pointEls = typeof doc.elementsFromPoint === "function" ? doc.elementsFromPoint(clientX, clientY) : typeof doc.elementFromPoint === "function" ? [doc.elementFromPoint(clientX, clientY)].filter(Boolean) : [];
				for (const el of pointEls) {
					if (!el || typeof el.closest !== "function") continue;
					const island = el.closest("[data-entity-id]");
					const id = island?.getAttribute?.("data-entity-id") ?? island?.dataset?.entityId;
					if (id && context.world.getCanonical?.(id, CHART_ASPECT_ID)) return {
						hitId: id,
						hitBounds: getChartWorldBounds(context.world, id),
						worldPoint
					};
				}
			}
			const ids = [...s.selection?.getSelection?.() ?? [], ...context.world.listEntityIds?.() ?? []];
			const visited = /* @__PURE__ */ new Set();
			for (const id of ids) {
				if (!id || visited.has(id)) continue;
				visited.add(id);
				const props = context.world.getCanonical?.(id, CHART_ASPECT_ID);
				if (!props) continue;
				const b = getChartWorldBounds(context.world, id, props);
				if (b && worldPoint.x >= b.x && worldPoint.x <= b.x + b.width && worldPoint.y >= b.y && worldPoint.y <= b.y + b.height) return {
					hitId: id,
					hitBounds: b,
					worldPoint
				};
			}
			if (Number.isFinite(clientX) && Number.isFinite(clientY) && typeof s.surface.element.querySelectorAll === "function") {
				const islands = s.surface.element.querySelectorAll("[data-entity-id]");
				for (const node of islands) {
					const id = node.getAttribute?.("data-entity-id") ?? node.dataset?.entityId;
					if (!id || !context.world.getCanonical?.(id, CHART_ASPECT_ID)) continue;
					const rect = node.getBoundingClientRect?.();
					if (rect && rect.width > 0 && rect.height > 0 && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return {
						hitId: id,
						hitBounds: getChartWorldBounds(context.world, id),
						worldPoint
					};
				}
			}
			return {
				hitId: null,
				hitBounds: null,
				worldPoint
			};
		}
		function tryOpenAtPoint(clientX, clientY, candidateTargets, sourceEvent) {
			if (composing) return false;
			for (const t of candidateTargets) if (t && container.contains?.(t)) return false;
			const { hitId, hitBounds, worldPoint } = resolveChartEntityAtPoint(clientX, clientY, candidateTargets);
			if (!hitId) return false;
			const props = context.world.getCanonical?.(hitId, CHART_ASPECT_ID);
			if (!props) return false;
			const hit = resolveHitTargetInIsland(findIslandElement(s.surface.element, hitId), clientX, clientY, candidateTargets, props, hitBounds, worldPoint);
			if (!hit || !hit.target) return false;
			sourceEvent?.preventDefault?.();
			sourceEvent?.stopPropagation?.();
			return startEditing(hitId, hit.target, hit.anchorEl);
		}
		const locked = (e) => Boolean(composing || e?.isComposing || e?.keyCode === 229);
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
		const onInput = (e) => {
			if (!session) return;
			positionEditor();
			if (composing || e?.isComposing) return;
			applyDraftValue(input.value);
			positionEditor();
		};
		const onKeyDown = (e) => {
			if (!session) return;
			if (locked(e)) {
				e.stopPropagation?.();
				return;
			}
			if (e.key === "Tab") {
				e.preventDefault?.();
				e.stopPropagation?.();
				cycleEditableTarget(e.shiftKey ? -1 : 1);
				return;
			}
			if (e.key === "Enter" || e.key === "Escape") {
				e.preventDefault?.();
				e.stopPropagation?.();
				finish(e.key === "Enter");
			}
		};
		const onBlur = () => {
			if (composing) return;
			if (Date.now() - lastOpenedAt < 80) return;
			finish(true);
		};
		const onPointerDown = (e) => {
			if (e.button !== void 0 && e.button !== 0) return;
			if (e.target && container.contains?.(e.target)) return;
			if (session && !composing) finish(true);
			downState = {
				pointerId: e.pointerId,
				x: e.clientX,
				y: e.clientY,
				target: e.target,
				time: Date.now()
			};
		};
		const onPointerUp = (e) => {
			if (!downState || e.pointerId !== void 0 && downState.pointerId !== e.pointerId) return;
			const currentDown = downState;
			downState = null;
			if (e.button !== void 0 && e.button !== 0) return;
			if ((Number.isFinite(e.clientX) && Number.isFinite(currentDown.x) ? Math.hypot(e.clientX - currentDown.x, e.clientY - currentDown.y) : 0) > 6) {
				lastTap = null;
				return;
			}
			const now = Date.now();
			const prevTap = lastTap;
			if (prevTap && now - prevTap.time <= 380 && (!Number.isFinite(e.clientX) || Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) <= 8)) {
				lastTap = null;
				const cx = e.clientX;
				const cy = e.clientY;
				const targets = [
					currentDown.target,
					prevTap.target,
					e.target
				].filter(Boolean);
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
				target: currentDown.target ?? e.target
			};
		};
		const onDoubleClick = (e) => {
			if (e.defaultPrevented || composing) return;
			if (e.button !== void 0 && e.button !== 0) return;
			if (session && Date.now() - lastOpenedAt < 250) {
				e.preventDefault?.();
				e.stopPropagation?.();
				input.focus?.();
				return;
			}
			const now = Date.now();
			const recentTapTarget = lastTap && now - lastTap.time <= 400 && (!Number.isFinite(e.clientX) || Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) <= 8) ? lastTap.target : null;
			const recentDownTarget = downState && now - downState.time <= 400 && (!Number.isFinite(e.clientX) || Math.hypot(e.clientX - downState.x, e.clientY - downState.y) <= 8) ? downState.target : null;
			lastTap = null;
			downState = null;
			const targets = [
				e.target,
				recentDownTarget,
				recentTapTarget
			].filter(Boolean);
			tryOpenAtPoint(e.clientX, e.clientY, targets, e);
		};
		const offFrame = frames?.subscribe?.(() => {
			mount();
			if (session) positionEditor();
		}) ?? (() => {});
		input.addEventListener("compositionstart", onCompositionStart);
		input.addEventListener("compositionend", onCompositionEnd);
		input.addEventListener("input", onInput);
		input.addEventListener("keydown", onKeyDown);
		input.addEventListener("blur", onBlur);
		s.surface.element.addEventListener("pointerdown", onPointerDown, true);
		s.surface.element.addEventListener("pointerup", onPointerUp, true);
		s.surface.element.addEventListener("dblclick", onDoubleClick, true);
		closeCurrent = () => finish(true);
		openCurrent = (entityId, field = "title") => {
			const targetId = entityId ?? (s.selection?.getSelection?.() ?? []).find((id) => Boolean(context.world.getCanonical?.(id, CHART_ASPECT_ID)));
			if (!targetId) return false;
			const safeField = CARD_FIELDS.includes(field) ? field : "title";
			return startEditing(targetId, {
				kind: "field",
				field: safeField,
				slotKey: `field:${safeField}`
			});
		};
		detachCurrent = () => {
			offFrame();
			offWorld();
			if (session) restoreHiddenElements(session.id);
			input.removeEventListener("compositionstart", onCompositionStart);
			input.removeEventListener("compositionend", onCompositionEnd);
			input.removeEventListener("input", onInput);
			input.removeEventListener("keydown", onKeyDown);
			input.removeEventListener("blur", onBlur);
			s.surface.element.removeEventListener("pointerdown", onPointerDown, true);
			s.surface.element.removeEventListener("pointerup", onPointerUp, true);
			s.surface.element.removeEventListener("dblclick", onDoubleClick, true);
			container.remove();
		};
	}
	mount();
	const offSurface = provider?.subscribe?.(() => mount()) ?? (() => {});
	return {
		open(entityId, field = "title") {
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
		}
	};
}
// src/panel.js
var COLOR_INSPECTOR_PANEL_ID = `${EXTENSION_ID}.color-inspector`;
var ACCENT_PRESETS = Object.freeze([
	"#3182f6",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4"
]);
var BG_PRESETS = Object.freeze([
	{
		label: "화이트",
		value: "#ffffff"
	},
	{
		label: "슬레이트",
		value: "#f8fafc"
	},
	{
		label: "웜아이보리",
		value: "#fffbeb"
	},
	{
		label: "민트틴트",
		value: "#f0fdf4"
	},
	{
		label: "블루틴트",
		value: "#eff6ff"
	},
	{
		label: "다크네이비",
		value: "#0f172a"
	},
	{
		label: "차콜블랙",
		value: "#18181b"
	},
	{
		label: "딥인디고",
		value: "#1e1b4b"
	}
]);
var COMPONENT_PALETTE = Object.freeze([
	"#3182f6",
	"#10b981",
	"#f59e0b",
	"#8b5cf6",
	"#ef4444",
	"#06b6d4",
	"#ec4899",
	"#14b8a6",
	"#f97316",
	"#6366f1"
]);
function ensureHexForPicker(color, fallback = "#3182f6") {
	return isValidHexColor(color) ? color.trim() : fallback;
}
function readSelectedChartEntity(world, selectedIds) {
	if (!world || !Array.isArray(selectedIds)) return null;
	for (const id of selectedIds) {
		const props = world.getCanonical?.(id, CHART_ASPECT_ID);
		if (props) return {
			id,
			props
		};
	}
	return null;
}
function controlRow(label, field, { wrap = false } = {}) {
	return React.createElement("div", { className: "wb-control" }, React.createElement("div", {
		className: "wb-control-row",
		style: wrap ? {
			flexWrap: "wrap",
			height: "auto",
			alignItems: "flex-start"
		} : void 0
	}, React.createElement("span", { className: "wb-control-label" }, label), React.createElement("div", {
		className: "wb-control-field",
		style: wrap ? {
			flex: "1 1 100%",
			justifyContent: "flex-start"
		} : void 0
	}, field)));
}
function textButton(label, onClick, pressed) {
	return React.createElement("button", {
		type: "button",
		className: "wb-control-action",
		"aria-pressed": pressed ? "true" : void 0,
		onClick,
		style: pressed ? {
			background: "var(--alid-accent-soft, transparent)",
			color: "var(--alid-accent, inherit)",
			borderColor: "var(--alid-accent, currentColor)"
		} : void 0
	}, label);
}
function swatchButton(hex, label, pressed, onClick) {
	return React.createElement("button", {
		type: "button",
		className: "wb-swatch",
		"aria-label": label,
		"aria-pressed": pressed ? "true" : "false",
		title: label,
		onClick
	}, React.createElement("span", { style: { background: hex } }));
}
function colorInput(label, value, fallback, onChange) {
	return React.createElement("input", {
		type: "color",
		"aria-label": label,
		value: ensureHexForPicker(value, fallback),
		onChange: (event) => onChange(event.target.value)
	});
}
function ChartColorAndHighlightControls({ selected, resolved, context }) {
	if (!selected || !resolved) return null;
	const dispatchStyleUpdate = (patchArgs) => {
		const payload = {
			entityId: selected.id,
			...patchArgs
		};
		if (typeof context?.executeCommand === "function") context.executeCommand(`${EXTENSION_ID}:update-style`, payload);
	};
	const rawHighlight = resolved.highlight;
	const presetIds = HIGHLIGHT_PRESETS.map((p) => p.id);
	const activePreset = rawHighlight === void 0 || rawHighlight === null || rawHighlight === "auto" ? "auto" : typeof rawHighlight === "string" && presetIds.includes(rawHighlight) ? rawHighlight : "custom";
	const customHighlightSet = new Set(Array.isArray(rawHighlight) ? rawHighlight.map(String) : activePreset === "custom" && rawHighlight !== void 0 && rawHighlight !== null ? [String(rawHighlight)] : []);
	const dataItems = resolved.dataTargets?.items ?? [];
	const itemColors = resolved.itemColors ?? {};
	const hasCustomItemColors = Object.keys(itemColors).length > 0;
	const handleToggleHighlightItem = (itemKey) => {
		const next = new Set(customHighlightSet);
		if (next.has(itemKey)) next.delete(itemKey);
		else next.add(itemKey);
		const list = [...next];
		dispatchStyleUpdate({ highlight: list.length === 0 ? "none" : list.length === 1 ? list[0] : list });
	};
	const handleAssignPalette = () => {
		if (dataItems.length === 0) return;
		const nextMap = {};
		dataItems.forEach((item, idx) => {
			nextMap[item.key] = COMPONENT_PALETTE[idx % COMPONENT_PALETTE.length];
		});
		dispatchStyleUpdate({
			itemColors: nextMap,
			replaceItemColors: true
		});
	};
	const panelFallback = resolved.resolvedTheme?.panel || "#ffffff";
	const accentFallback = resolved.resolvedTheme?.accent || "#3182f6";
	const neutralFallback = resolved.resolvedTheme?.neutral || "#cbd5e1";
	return React.createElement("div", { className: "wb-controls" }, React.createElement("fieldset", { className: "wb-control-group" }, React.createElement("legend", null, "배경"), controlRow("배경 색상", React.createElement(React.Fragment, null, resolved.backgroundColor !== "transparent" ? colorInput("배경 색상", resolved.backgroundColor, panelFallback, (value) => dispatchStyleUpdate({ backgroundColor: value })) : null, textButton("투명", () => dispatchStyleUpdate({ backgroundColor: "transparent" }), resolved.backgroundColor === "transparent"), resolved.backgroundColor ? textButton("기본값", () => dispatchStyleUpdate({ backgroundColor: "" })) : null)), controlRow("배경 팔레트", React.createElement("div", {
		className: "wb-segmented",
		role: "group",
		"aria-label": "배경 팔레트"
	}, ...BG_PRESETS.map((preset) => swatchButton(preset.value, `${preset.label} (${preset.value})`, resolved.backgroundColor?.toLowerCase() === preset.value.toLowerCase(), () => dispatchStyleUpdate({ backgroundColor: preset.value })))), { wrap: true })), React.createElement("fieldset", { className: "wb-control-group" }, React.createElement("legend", null, "색상"), controlRow("강조색", colorInput("강조 색상", resolved.accentColor, accentFallback, (value) => dispatchStyleUpdate({ accentColor: value }))), controlRow("강조 팔레트", React.createElement("div", {
		className: "wb-segmented",
		role: "group",
		"aria-label": "강조 팔레트"
	}, ...ACCENT_PRESETS.map((hex) => swatchButton(hex, `강조색 ${hex}`, resolved.accentColor?.toLowerCase() === hex.toLowerCase(), () => dispatchStyleUpdate({ accentColor: hex })))), { wrap: true }), controlRow("기본 데이터색", React.createElement(React.Fragment, null, colorInput("비강조 기본 데이터 색상", resolved.neutralColor, neutralFallback, (value) => dispatchStyleUpdate({ neutralColor: value })), resolved.neutralColor ? textButton("초기화", () => dispatchStyleUpdate({ neutralColor: "" })) : null))), React.createElement("fieldset", { className: "wb-control-group" }, React.createElement("legend", null, "강조 데이터"), controlRow("강조 규칙", React.createElement("div", {
		className: "wb-segmented",
		role: "group",
		"aria-label": "강조 데이터 지정"
	}, ...HIGHLIGHT_PRESETS.map((preset) => React.createElement("button", {
		key: preset.id,
		type: "button",
		"aria-pressed": activePreset === preset.id ? "true" : "false",
		onClick: () => dispatchStyleUpdate({ highlight: preset.id })
	}, preset.labelKo))), { wrap: true }), activePreset === "custom" ? controlRow("직접 선택", textButton("자동으로", () => dispatchStyleUpdate({ highlight: "auto" }))) : null, dataItems.length > 0 && resolved.dataTargets?.kind !== "updown" ? controlRow("항목", React.createElement("div", {
		className: "wb-segmented",
		role: "group",
		"aria-label": "특정 데이터 항목 강조"
	}, ...dataItems.map((item) => React.createElement("button", {
		key: item.key,
		type: "button",
		"aria-pressed": customHighlightSet.has(item.key) ? "true" : "false",
		onClick: () => handleToggleHighlightItem(item.key)
	}, item.label))), { wrap: true }) : null), dataItems.length > 0 ? React.createElement("fieldset", { className: "wb-control-group" }, React.createElement("legend", null, "세부 데이터 색상"), controlRow("일괄", React.createElement(React.Fragment, null, textButton("팔레트 자동 배정", handleAssignPalette), hasCustomItemColors ? textButton("초기화", () => dispatchStyleUpdate({
		itemColors: {},
		replaceItemColors: true
	})) : null)), ...dataItems.map((item, idx) => {
		const customHex = itemColors[item.key];
		const defaultFallback = item.key === "up" ? accentFallback : item.key === "down" ? resolved.resolvedTheme?.neutralStrong || "#64748b" : customHighlightSet.has(item.key) ? accentFallback : COMPONENT_PALETTE[idx % COMPONENT_PALETTE.length];
		return controlRow(item.label, React.createElement(React.Fragment, null, colorInput(item.label, customHex, defaultFallback, (value) => dispatchStyleUpdate({ itemColors: { [item.key]: value } })), customHex ? textButton("해제", () => dispatchStyleUpdate({ itemColors: { [item.key]: "" } })) : null));
	})) : null);
}
function ZtdChartStudioView({ context }) {
	const [tick, setTick] = useState(0);
	const [familyFilter, setFamilyFilter] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [editorMode, setEditorMode] = useState("csv");
	const [dataDraft, setDataDraft] = useState("");
	const [parseStatus, setParseStatus] = useState(null);
	useEffect(() => {
		if (!context) return void 0;
		const bump = () => setTick((v) => v + 1);
		const offSel = context.onSelectionChange?.(bump);
		const offWorld = context.onWorldMutated?.(bump);
		return () => {
			offSel?.();
			offWorld?.();
		};
	}, [context]);
	const selected = useMemo(() => {
		const ids = context?.getSelectedIds?.() ?? [];
		return readSelectedChartEntity(context?.world, ids);
	}, [context, tick]);
	const resolved = useMemo(() => selected ? resolveChartSpec(selected.props) : null, [selected]);
	useEffect(() => {
		if (!resolved) {
			setDataDraft("");
			setParseStatus(null);
			return;
		}
		const rows = resolved.spec.data ?? [];
		if (editorMode === "csv") setDataDraft(formatRowsAsCsv(rows));
		else setDataDraft(JSON.stringify(rows, null, 2));
		setParseStatus(null);
	}, [
		selected?.id,
		resolved?.chartType,
		resolved?.usingSampleData,
		editorMode
	]);
	const catalog = useMemo(() => getChartCatalog(resolved?.lang ?? "ko"), [resolved?.lang]);
	const filteredCatalog = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		return catalog.filter((item) => {
			if (familyFilter !== "all" && item.family !== familyFilter) return false;
			if (!q) return true;
			return item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q);
		});
	}, [
		catalog,
		familyFilter,
		searchQuery
	]);
	const recommendations = useMemo(() => {
		if (!resolved) return [];
		return suggestChartsForRows(resolved.spec.data, resolved.lang).suggestions.slice(0, 4);
	}, [resolved]);
	const handleCreateOrSwitchType = (chartType) => {
		if (selected) context.executeCommand(`${EXTENSION_ID}:set-chart-type`, {
			entityId: selected.id,
			chartType
		});
		else context.executeCommand(`${EXTENSION_ID}:insert-chart`, { chartType });
	};
	const handleApplyDataDraft = () => {
		if (!selected) return;
		const parsed = parseDataInput(dataDraft, resolved?.lang ?? "ko");
		if (!parsed.ok) {
			setParseStatus({
				ok: false,
				message: parsed.error || "데이터를 파싱하지 못했습니다."
			});
			return;
		}
		setParseStatus({
			ok: true,
			message: `${parsed.rows.length}개 행이 적용되었습니다.`
		});
		context.executeCommand(`${EXTENSION_ID}:update-data`, {
			entityId: selected.id,
			rows: parsed.rows,
			...parsed.chartType ? { chartType: parsed.chartType } : {},
			...parsed.encoding ? { encoding: parsed.encoding } : {},
			...parsed.options ? { options: parsed.options } : {}
		});
	};
	const handleResetSampleData = () => {
		if (!selected) return;
		setParseStatus({
			ok: true,
			message: "샘플 데이터로 초기화했습니다."
		});
		context.executeCommand(`${EXTENSION_ID}:reset-sample-data`, { entityId: selected.id });
	};
	const handleApplySuggestion = (item) => {
		if (!selected || !item) return;
		context.executeCommand(`${EXTENSION_ID}:set-chart-type`, {
			entityId: selected.id,
			chartType: item.type,
			...item.spec?.encoding ? { encoding: item.spec.encoding } : {}
		});
	};
	return React.createElement("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: "12px",
		padding: "12px",
		fontSize: "12px",
		lineHeight: 1.45,
		color: "var(--alid-text, #18181b)"
	} }, React.createElement("div", { style: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "8px"
	} }, React.createElement("div", null, React.createElement("div", { style: {
		fontWeight: 700,
		fontSize: "13px"
	} }, "ZTD 차트 스튜디오 (36종)"), React.createElement("div", { style: {
		color: "var(--alid-text-muted, #71717a)",
		fontSize: "11px"
	} }, selected ? `선택됨: ${resolved?.title || selected.id} (${resolved?.chartType})` : "차트를 클릭해 즉시 캔버스에 추가하세요")), React.createElement("button", {
		type: "button",
		onClick: () => void context.executeCommand(`${EXTENSION_ID}:insert-chart`, { chartType: resolved?.chartType ?? "bar" }),
		style: {
			padding: "5px 10px",
			borderRadius: "6px",
			border: "1px solid var(--alid-border-subtle, #d4d4d8)",
			background: "#3182f6",
			color: "#ffffff",
			fontWeight: 600,
			fontSize: "11.5px",
			cursor: "pointer"
		}
	}, "+ 새 차트 추가")), React.createElement("input", {
		type: "search",
		value: searchQuery,
		onChange: (e) => setSearchQuery(e.target.value),
		placeholder: "차트 검색 (예: 막대, 라인, 생키, 퍼널, 캔들스틱…)",
		style: {
			width: "100%",
			boxSizing: "border-box",
			padding: "6px 8px",
			borderRadius: "6px",
			border: "1px solid var(--alid-border-subtle, #d4d4d8)",
			background: "var(--alid-bg-surface, #ffffff)",
			color: "inherit",
			fontSize: "12px"
		}
	}), React.createElement("div", { style: {
		display: "flex",
		flexWrap: "wrap",
		gap: "4px"
	} }, ...CHART_FAMILIES.map((fam) => React.createElement("button", {
		key: fam.id,
		type: "button",
		onClick: () => setFamilyFilter(fam.id),
		style: {
			padding: "3px 8px",
			borderRadius: "999px",
			border: "1px solid var(--alid-border-subtle, #d4d4d8)",
			background: familyFilter === fam.id ? "#3182f6" : "transparent",
			color: familyFilter === fam.id ? "#ffffff" : "inherit",
			fontSize: "11px",
			fontWeight: familyFilter === fam.id ? 600 : 400,
			cursor: "pointer"
		}
	}, fam.labelKo))), React.createElement("div", { style: {
		display: "grid",
		gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
		gap: "6px",
		maxHeight: "196px",
		overflowY: "auto",
		paddingRight: "2px"
	} }, ...filteredCatalog.map((item) => {
		const isActive = resolved?.chartType === item.type;
		return React.createElement("button", {
			key: item.type,
			type: "button",
			onClick: () => handleCreateOrSwitchType(item.type),
			title: item.summary,
			style: {
				textAlign: "left",
				padding: "6px 8px",
				borderRadius: "8px",
				border: isActive ? "1.5px solid #3182f6" : "1px solid var(--alid-border-subtle, #e4e4e7)",
				background: isActive ? "rgba(49, 130, 246, 0.08)" : "var(--alid-bg-surface, #ffffff)",
				color: "inherit",
				cursor: "pointer",
				display: "flex",
				flexDirection: "column",
				gap: "2px"
			}
		}, React.createElement("span", { style: {
			fontWeight: 600,
			fontSize: "11.5px"
		} }, item.name), React.createElement("span", { style: {
			fontSize: "10px",
			color: "var(--alid-text-muted, #71717a)",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		} }, item.type));
	})), selected && resolved ? React.createElement(React.Fragment, null, React.createElement(ChartColorAndHighlightControls, {
		selected,
		resolved,
		context
	}), recommendations.length > 0 && React.createElement("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: "6px",
		padding: "8px",
		borderRadius: "8px",
		border: "1px solid var(--alid-border-subtle, #e4e4e7)"
	} }, React.createElement("div", { style: {
		fontWeight: 600,
		fontSize: "11.5px"
	} }, "데이터 맞춤 추천 차트"), ...recommendations.map((rec) => React.createElement("div", {
		key: rec.type,
		style: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "6px",
			fontSize: "11px"
		}
	}, React.createElement("div", { style: {
		minWidth: 0,
		flex: 1
	} }, React.createElement("strong", null, `${rec.name} (${Math.round((rec.score ?? 0) * 100)}%)`), React.createElement("div", { style: {
		color: "var(--alid-text-muted, #71717a)",
		fontSize: "10.5px"
	} }, rec.reason)), React.createElement("button", {
		type: "button",
		onClick: () => handleApplySuggestion(rec),
		style: {
			padding: "3px 7px",
			borderRadius: "5px",
			border: "1px solid var(--alid-border-subtle, #d4d4d8)",
			background: "transparent",
			color: "inherit",
			fontSize: "10.5px",
			cursor: "pointer"
		}
	}, "적용")))), React.createElement("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: "6px"
	} }, React.createElement("div", { style: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between"
	} }, React.createElement("span", { style: {
		fontWeight: 600,
		fontSize: "11.5px"
	} }, "데이터 편집 (CSV / JSON)"), React.createElement("div", { style: {
		display: "flex",
		gap: "4px"
	} }, React.createElement("button", {
		type: "button",
		onClick: () => setEditorMode("csv"),
		style: {
			padding: "2px 6px",
			borderRadius: "4px",
			border: "1px solid var(--alid-border-subtle, #d4d4d8)",
			background: editorMode === "csv" ? "#3182f6" : "transparent",
			color: editorMode === "csv" ? "#ffffff" : "inherit",
			fontSize: "10.5px",
			cursor: "pointer"
		}
	}, "CSV"), React.createElement("button", {
		type: "button",
		onClick: () => setEditorMode("json"),
		style: {
			padding: "2px 6px",
			borderRadius: "4px",
			border: "1px solid var(--alid-border-subtle, #d4d4d8)",
			background: editorMode === "json" ? "#3182f6" : "transparent",
			color: editorMode === "json" ? "#ffffff" : "inherit",
			fontSize: "10.5px",
			cursor: "pointer"
		}
	}, "JSON"))), React.createElement("textarea", {
		value: dataDraft,
		onChange: (e) => setDataDraft(e.target.value),
		rows: 7,
		spellCheck: false,
		style: {
			width: "100%",
			boxSizing: "border-box",
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			fontSize: "11px",
			padding: "6px 8px",
			borderRadius: "6px",
			border: "1px solid var(--alid-border-subtle, #d4d4d8)",
			background: "var(--alid-bg-surface, #ffffff)",
			color: "inherit",
			resize: "vertical"
		}
	}), parseStatus && React.createElement("div", { style: {
		fontSize: "11px",
		color: parseStatus.ok ? "#16a34a" : "#dc2626"
	} }, parseStatus.message), React.createElement("div", { style: {
		display: "flex",
		gap: "6px"
	} }, React.createElement("button", {
		type: "button",
		onClick: handleApplyDataDraft,
		style: {
			flex: 1,
			padding: "6px 10px",
			borderRadius: "6px",
			border: "none",
			background: "#3182f6",
			color: "#ffffff",
			fontWeight: 600,
			fontSize: "11.5px",
			cursor: "pointer"
		}
	}, "데이터 반영"), React.createElement("button", {
		type: "button",
		onClick: handleResetSampleData,
		style: {
			padding: "6px 10px",
			borderRadius: "6px",
			border: "1px solid var(--alid-border-subtle, #d4d4d8)",
			background: "transparent",
			color: "inherit",
			fontSize: "11.5px",
			cursor: "pointer"
		}
	}, "샘플 복원")))) : null);
}
function ZtdChartColorInspectorView({ context }) {
	const [tick, setTick] = useState(0);
	useEffect(() => {
		if (!context) return void 0;
		const bump = () => setTick((v) => v + 1);
		const offSel = context.onSelectionChange?.(bump);
		const offWorld = context.onWorldMutated?.(bump);
		return () => {
			offSel?.();
			offWorld?.();
		};
	}, [context]);
	const selected = useMemo(() => {
		const ids = context?.getSelectedIds?.() ?? [];
		return readSelectedChartEntity(context?.world, ids);
	}, [context, tick]);
	const resolved = useMemo(() => selected ? resolveChartSpec(selected.props) : null, [selected]);
	if (!selected || !resolved) return null;
	return React.createElement(ChartColorAndHighlightControls, {
		selected,
		resolved,
		context
	});
}
function createColorInspectorPanelSpec() {
	return {
		panelId: COLOR_INSPECTOR_PANEL_ID,
		title: "강조 데이터 및 세부 색상",
		defaultZone: "right",
		inspectorFor: CHART_ASPECT_ID,
		isolation: "container",
		mount(hostEl, context) {
			if (!hostEl) return () => {};
			const doc = hostEl.ownerDocument;
			if (!doc || typeof doc.createElement !== "function") {
				hostEl.textContent = "강조 데이터 및 세부 색상";
				return () => {
					hostEl.textContent = "";
				};
			}
			const root = createRoot(hostEl);
			root.render(React.createElement(ZtdChartColorInspectorView, { context }));
			return () => {
				try {
					root.unmount();
				} catch {}
			};
		}
	};
}
function createStudioPanelSpec() {
	return {
		panelId: STUDIO_PANEL_ID,
		title: "ZTD 차트 스튜디오",
		icon: { paths: [
			"M3 3v14h14",
			"M7 14V9",
			"M11 14V6",
			"M15 14v-4"
		] },
		defaultZone: "right",
		isolation: "container",
		navigation: {
			group: "document",
			order: 45
		},
		mount(hostEl, context) {
			if (!hostEl) return () => {};
			const doc = hostEl.ownerDocument;
			if (!doc || typeof doc.createElement !== "function") {
				hostEl.textContent = "ZTD 차트 스튜디오";
				return () => {
					hostEl.textContent = "";
				};
			}
			const root = createRoot(hostEl);
			root.render(React.createElement(ZtdChartStudioView, { context }));
			return () => {
				try {
					root.unmount();
				} catch {}
			};
		}
	};
}
// src/tools.js
var ALLOWED_THEMES = ["light", "dark"];
var ALLOWED_LOCALES = ["ko", "en"];
var ALLOWED_VARIANTS = ["card", "bare"];
var ALLOWED_LEGENDS = [
	"auto",
	"true",
	"false"
];
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sanitizePatch(rawPatch, existingProps = CHART_DEFAULTS) {
	if (!isPlainObject(rawPatch)) throw new Error("INVALID_INPUT: patch must be a JSON object");
	const clean = {};
	if (rawPatch.chartType !== void 0) {
		if (typeof rawPatch.chartType !== "string" || !CHART_TYPE_SET.has(rawPatch.chartType)) throw new Error(`INVALID_INPUT: unsupported chartType "${String(rawPatch.chartType)}"`);
		clean.chartType = rawPatch.chartType;
	}
	for (const textField of [
		"title",
		"subtitle",
		"takeaway"
	]) if (rawPatch[textField] !== void 0) {
		if (typeof rawPatch[textField] !== "string" || rawPatch[textField].length > 500) throw new Error(`INVALID_INPUT: ${textField} must be a string <= 500 chars`);
		clean[textField] = rawPatch[textField];
	}
	if (rawPatch.theme !== void 0) {
		if (!ALLOWED_THEMES.includes(rawPatch.theme)) throw new Error("INVALID_INPUT: theme must be \"light\" or \"dark\"");
		clean.theme = rawPatch.theme;
	}
	if (rawPatch.locale !== void 0) {
		if (!ALLOWED_LOCALES.includes(rawPatch.locale)) throw new Error("INVALID_INPUT: locale must be \"ko\" or \"en\"");
		clean.locale = rawPatch.locale;
	}
	if (rawPatch.variant !== void 0) {
		if (!ALLOWED_VARIANTS.includes(rawPatch.variant)) throw new Error("INVALID_INPUT: variant must be \"card\" or \"bare\"");
		clean.variant = rawPatch.variant;
	}
	if (rawPatch.legendMode !== void 0) {
		if (!ALLOWED_LEGENDS.includes(rawPatch.legendMode)) throw new Error("INVALID_INPUT: legendMode must be \"auto\", \"true\", or \"false\"");
		clean.legendMode = rawPatch.legendMode;
	}
	if (rawPatch.accentColor !== void 0) {
		if (!isValidHexColor(rawPatch.accentColor)) throw new Error("INVALID_INPUT: accentColor must be a #rrggbb hex string");
		clean.accentColor = rawPatch.accentColor.trim();
	}
	if (rawPatch.backgroundColor !== void 0) {
		if (rawPatch.backgroundColor === "") clean.backgroundColor = "";
		else {
			const background = resolveBackgroundColor(rawPatch.backgroundColor);
			if (!background) throw new Error("INVALID_INPUT: backgroundColor must be \"\", \"transparent\", or a #rrggbb hex string");
			clean.backgroundColor = background;
		}
	}
	if (rawPatch.cornerRadius !== void 0) {
		const radius = Number(rawPatch.cornerRadius);
		if (!Number.isFinite(radius) || radius < 0 || radius > 64) throw new Error("INVALID_INPUT: cornerRadius must be a number from 0 to 64");
		clean.cornerRadius = resolveCornerRadius(radius);
	}
	if (rawPatch.data !== void 0) {
		if (typeof rawPatch.data === "string") {
			const parsed = parseDataInput(rawPatch.data, clean.locale ?? existingProps.locale ?? "ko");
			if (!parsed.ok) throw new Error(`INVALID_INPUT: ${parsed.error}`);
			clean.data = parsed.rows;
		} else if (Array.isArray(rawPatch.data)) {
			if (rawPatch.data.length > 1e3) throw new Error("INVALID_INPUT: data rows exceed 1000 limit");
			clean.data = parseDataInput(rawPatch.data, clean.locale ?? existingProps.locale ?? "ko").rows;
		} else throw new Error("INVALID_INPUT: data must be an array of row objects or CSV/JSON string");
	}
	if (rawPatch.encoding !== void 0) {
		if (!isPlainObject(rawPatch.encoding)) throw new Error("INVALID_INPUT: encoding must be an object");
		clean.encoding = { ...rawPatch.encoding };
	}
	if (rawPatch.options !== void 0) {
		if (!isPlainObject(rawPatch.options)) throw new Error("INVALID_INPUT: options must be an object");
		clean.options = {
			...existingProps.options ?? {},
			...rawPatch.options
		};
		if (clean.options.itemColors !== void 0) clean.options.itemColors = sanitizeItemColors(clean.options.itemColors);
	}
	if (rawPatch.highlight !== void 0) clean.options = {
		...clean.options ?? existingProps.options ?? {},
		highlight: rawPatch.highlight
	};
	if (rawPatch.neutralColor !== void 0) {
		if (rawPatch.neutralColor !== "" && !isValidHexColor(rawPatch.neutralColor)) throw new Error("INVALID_INPUT: neutralColor must be \"\" or a #rrggbb hex string");
		const nextOpts = { ...clean.options ?? existingProps.options ?? {} };
		if (rawPatch.neutralColor === "") delete nextOpts.neutralColor;
		else nextOpts.neutralColor = rawPatch.neutralColor.trim();
		clean.options = nextOpts;
	}
	if (rawPatch.itemColors !== void 0) {
		if (!isPlainObject(rawPatch.itemColors)) throw new Error("INVALID_INPUT: itemColors must be an object mapping data labels/keys to #rrggbb hex colors");
		clean.options = {
			...clean.options ?? existingProps.options ?? {},
			itemColors: sanitizeItemColors(rawPatch.itemColors)
		};
	}
	return clean;
}
/**
* Plans a batch of chart operations into `CanonicalPatchOp[]` without mutating the world.
*/
function planZtdChartChanges(world, actions) {
	if (!Array.isArray(actions) || actions.length === 0 || actions.length > 50) throw new Error("INVALID_INPUT: actions must be a non-empty array of at most 50 items");
	const snapshot = world.exportCanonicalSnapshot?.() ?? {};
	const aliases = /* @__PURE__ */ new Map();
	const ops = [];
	for (const action of actions) {
		if (!isPlainObject(action)) throw new Error("INVALID_INPUT: each action must be an object");
		if (action.action === "create") {
			if (action.id !== void 0) {
				if (typeof action.id !== "string" || !action.id.trim() || aliases.has(action.id) || Object.hasOwn(snapshot, action.id)) throw new Error("INVALID_INPUT: duplicate or invalid create alias");
			}
			const generatedId = `ztd-chart-${crypto.randomUUID()}`;
			aliases.set(action.id ?? generatedId, generatedId);
		}
	}
	let createSeq = 0;
	const createdIds = [...aliases.values()];
	const resolveId = (rawId) => aliases.get(rawId) ?? rawId;
	for (const action of actions) {
		const kind = action.action;
		if (![
			"create",
			"update",
			"move",
			"delete"
		].includes(kind)) throw new Error(`INVALID_INPUT: unsupported action "${String(kind)}"`);
		const id = kind === "create" ? createdIds[createSeq++] : resolveId(action.id);
		if (typeof id !== "string" || !id) throw new Error("INVALID_INPUT: missing target entity id");
		if (kind !== "create") {
			const alive = world.isAlive ? world.isAlive(id) : Boolean(snapshot[id]);
			const hasChart = Boolean(world.getCanonical?.(id, CHART_ASPECT_ID) ?? snapshot[id]?.[CHART_ASPECT_ID]);
			if (!alive || !hasChart) throw new Error(`INVALID_INPUT: chart entity "${id}" does not exist`);
		}
		if (kind === "delete") {
			ops.push({
				id,
				aspect: CHART_ASPECT_ID,
				patch: null
			});
			continue;
		}
		if (kind === "move") {
			if (action.x !== void 0 || action.y !== void 0) {
				const currentTransform = world.getCanonical?.(id, "core.transform") ?? {
					x: 0,
					y: 0,
					rotation: 0
				};
				const x = action.x !== void 0 ? action.x : currentTransform.x;
				const y = action.y !== void 0 ? action.y : currentTransform.y;
				if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e7 || Math.abs(y) > 1e7) throw new Error("INVALID_INPUT: invalid x/y coordinates");
				ops.push({
					id,
					aspect: "core.transform",
					patch: {
						x,
						y
					}
				});
			}
			if (action.width !== void 0 || action.height !== void 0) {
				const currentBounds = world.getCanonical?.(id, "core.bounds") ?? {
					width: 480,
					height: 340
				};
				const width = action.width !== void 0 ? action.width : currentBounds.width;
				const height = action.height !== void 0 ? action.height : currentBounds.height;
				if (!Number.isFinite(width) || !Number.isFinite(height) || width < 240 || height < 180 || width > 4e3 || height > 4e3) throw new Error("INVALID_INPUT: invalid width/height bounds");
				ops.push({
					id,
					aspect: "core.bounds",
					patch: {
						width: Math.round(width),
						height: Math.round(height)
					}
				});
			}
			continue;
		}
		const existing = kind === "update" ? world.getCanonical?.(id, CHART_ASPECT_ID) ?? CHART_DEFAULTS : CHART_DEFAULTS;
		const sanitized = sanitizePatch(action.patch ?? {}, existing);
		const merged = {
			...kind === "create" ? CHART_DEFAULTS : existing,
			...sanitized
		};
		if (Array.isArray(merged.data) && merged.data.length > 0 && (!merged.encoding || Object.keys(merged.encoding).length === 0)) {
			const suggested = suggestChartsForRows(merged.data, merged.locale).suggestions;
			const match = suggested.find((s) => s.type === merged.chartType) ?? suggested[0];
			if (match?.spec?.encoding) merged.encoding = { ...match.spec.encoding };
		}
		if (kind === "create") {
			const x = action.x ?? 80;
			const y = action.y ?? 80;
			const width = action.width ?? 480;
			const height = action.height ?? 340;
			if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e7 || Math.abs(y) > 1e7) throw new Error("INVALID_INPUT: invalid create x/y coordinates");
			if (!Number.isFinite(width) || !Number.isFinite(height) || width < 240 || height < 180) throw new Error("INVALID_INPUT: invalid create width/height bounds");
			ops.push({
				id,
				aspect: "core.transform",
				patch: {
					x,
					y,
					rotation: 0
				}
			});
			ops.push({
				id,
				aspect: "core.bounds",
				patch: {
					width: Math.round(width),
					height: Math.round(height)
				}
			});
			ops.push({
				id,
				aspect: CHART_ASPECT_ID,
				patch: merged
			});
		} else ops.push({
			id,
			aspect: CHART_ASPECT_ID,
			patch: sanitized
		});
	}
	if (ops.length > 150) throw new Error("INVALID_INPUT: operation budget exceeded");
	return ops;
}
/**
* Registers `euclidraw.ztd-charts` read & proposal tools with the host `workspace.tools` service.
*/
function registerZtdChartTools(context) {
	const tools = context?.services?.get?.("workspace.tools");
	if (!tools) return () => {};
	const { world } = context;
	const disposers = [];
	const registerTool = (name, description, properties, required, execute) => {
		disposers.push(tools.register({
			id: `${EXTENSION_ID}:${name}`,
			description,
			inputSchema: {
				type: "object",
				properties,
				required
			},
			execute: async (input, meta) => {
				meta?.signal?.throwIfAborted?.();
				return execute(input ?? {});
			}
		}));
	};
	try {
		if (typeof tools.registerDescriptor === "function") disposers.push(tools.registerDescriptor({
			aspect: CHART_ASPECT_ID,
			description: "ZTD 36종 통계·비즈니스 차트 도형. 생성·수정·이동·삭제는 반드시 plan-changes 도구를 통해 사용자 승인 제안(prepareChange)으로만 수행하세요.",
			fields: {
				chartType: `Allowed (${CHART_TYPES.length} types): ${CHART_TYPES.join(", ")}`,
				title: "string: 차트 카드 제목 (비워 두면 차트 유형별 기본 제목 사용)",
				subtitle: "string: 차트 부제목 또는 단위 설명",
				takeaway: "string: 핵심 인사이트 한 줄 요약",
				theme: `Allowed: ${ALLOWED_THEMES.join(", ")}`,
				locale: `Allowed: ${ALLOWED_LOCALES.join(", ")}`,
				variant: `Allowed: ${ALLOWED_VARIANTS.join(", ")}`,
				legendMode: `Allowed: ${ALLOWED_LEGENDS.join(", ")}`,
				accentColor: "string (#rrggbb): 강조 계열 색상",
				backgroundColor: "string (#rrggbb, \"transparent\", or \"\"): 차트 카드 배경 색상. transparent면 카드 배경만 투명",
				cornerRadius: "number (0–64): 차트 카드 모서리 둥글기. 0이면 직각",
				data: "array of row objects (비워 두면 해당 차트 유형의 내장 샘플 데이터 사용)",
				encoding: "object: 데이터 컬럼 매핑 (예: { x, y, series } 또는 { label, value })",
				options: "object: 차트별 세부 옵션 (highlight: \"auto\"|\"max\"|\"min\"|\"first\"|\"last\"|\"none\"|string|string[], neutralColor: \"#rrggbb\", itemColors: { [label]: \"#rrggbb\" } 등)"
			}
		}));
		registerTool("catalog", "ZTD 차트 36종 카탈로그 및 용도·권장 인코딩 조회 (읽기 전용).", {
			family: { type: "string" },
			query: { type: "string" },
			locale: { type: "string" }
		}, [], ({ family = "all", query = "", locale = "ko" }) => {
			const lang = normalizeLang(locale);
			const q = String(query ?? "").trim().toLowerCase();
			const items = getChartCatalog(lang).filter((item) => {
				if (family && family !== "all" && item.family !== family) return false;
				if (!q) return true;
				return item.type.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q);
			});
			return {
				total: items.length,
				families: CHART_FAMILIES,
				charts: items.map((item) => ({
					type: item.type,
					family: item.family,
					name: item.name,
					summary: item.summary,
					whenToUse: item.whenToUse,
					encodings: item.encodings
				}))
			};
		});
		registerTool("suggest", "CSV 또는 JSON 배열 데이터를 분석해 가장 적합한 ZTD 차트 종류와 자동 컬럼 인코딩을 추천합니다 (읽기 전용).", {
			data: { type: "string" },
			locale: { type: "string" }
		}, ["data"], ({ data, locale = "ko" }) => {
			const parsed = parseDataInput(data, locale);
			if (!parsed.ok) throw new Error(`INVALID_INPUT: ${parsed.error}`);
			const { profile, suggestions } = suggestChartsForRows(parsed.rows, locale);
			return {
				rowCount: parsed.rows.length,
				profile,
				suggestions: suggestions.map((item) => ({
					type: item.type,
					name: item.name,
					score: item.score,
					reason: item.reason,
					encoding: item.spec?.encoding ?? {}
				}))
			};
		});
		registerTool("search", "현재 캔버스에 배치된 ZTD 차트 엔티티 목록과 설정·데이터 요약 조회 (읽기 전용).", { query: { type: "string" } }, [], ({ query = "" }) => {
			const q = String(query ?? "").trim().toLowerCase();
			const entities = [];
			for (const id of world.listEntityIds?.() ?? []) {
				if (world.isAlive && !world.isAlive(id)) continue;
				const props = world.getCanonical?.(id, CHART_ASPECT_ID);
				if (!props) continue;
				const resolved = resolveChartSpec(props);
				const haystack = `${id} ${resolved.chartType} ${resolved.title} ${resolved.subtitle} ${resolved.takeaway}`.toLowerCase();
				if (q && !haystack.includes(q)) continue;
				entities.push({
					id,
					chartType: resolved.chartType,
					title: resolved.title,
					subtitle: resolved.subtitle,
					takeaway: resolved.takeaway,
					theme: resolved.themeName,
					locale: resolved.lang,
					variant: resolved.variant,
					usingSampleData: resolved.usingSampleData,
					rowCount: resolved.spec.data?.length ?? 0,
					encoding: resolved.spec.encoding,
					transform: world.getCanonical?.(id, "core.transform"),
					bounds: world.getCanonical?.(id, "core.bounds")
				});
			}
			return {
				total: entities.length,
				entities
			};
		});
		registerTool("plan-changes", "ZTD 차트 생성·수정·이동·크기 변경·삭제 승인 제안 생성. actions는 JSON 배열 문자열입니다: [{\"action\":\"create\",\"id\":\"c1\",\"x\":80,\"y\":80,\"width\":480,\"height\":340,\"patch\":{\"chartType\":\"bar\",\"title\":\"분기별 매출\",\"data\":[{\"quarter\":\"1분기\",\"revenue\":120}]}},{\"action\":\"update\",\"id\":\"existing-id\",\"patch\":{\"chartType\":\"line\",\"theme\":\"dark\"}},{\"action\":\"move\",\"id\":\"existing-id\",\"x\":200,\"y\":160,\"width\":520,\"height\":360},{\"action\":\"delete\",\"id\":\"existing-id\"}]. 직접 적용하지 않고 사용자 승인 제안을 반환합니다.", { actions: { type: "string" } }, ["actions"], ({ actions }) => {
			if (typeof tools.prepareChange !== "function") throw new Error("Host update required: workspace.tools.prepareChange is unavailable");
			let parsedActions;
			try {
				parsedActions = JSON.parse(actions);
			} catch (error) {
				throw new Error(`INVALID_INPUT: actions must be valid JSON (${error instanceof Error ? error.message : String(error)})`);
			}
			const ops = planZtdChartChanges(world, parsedActions);
			return tools.prepareChange(ops);
		});
	} catch (error) {
		for (const dispose of disposers.reverse()) try {
			dispose();
		} catch {}
		throw error;
	}
	return () => {
		for (const dispose of disposers.splice(0).reverse()) try {
			dispose();
		} catch {}
	};
}
// src/index.js
var CHART_ICON = Object.freeze({ paths: Object.freeze([
	"M3 3v14h14",
	"M7 14V9",
	"M11 14V6",
	"M15 14v-4"
]) });
var COMMAND_LABELS = Object.freeze({
	"insert-chart": "ZTD 차트 추가",
	"edit-chart": "차트 텍스트 인라인 편집",
	"set-chart-type": "차트 종류 변경",
	"update-data": "차트 데이터 업데이트",
	"update-style": "차트 색상·배경·강조 데이터 변경",
	"reset-sample-data": "샘플 데이터 복원",
	"apply-top-suggestion": "데이터 맞춤 추천 차트 적용",
	"toggle-theme": "차트 라이트/다크 테마 전환",
	"toggle-variant": "카드/단독 표시 전환",
	"toggle-locale": "한국어/영어 로케일 전환"
});
var ztdChartAspect = Object.freeze({
	id: CHART_ASPECT_ID,
	label: "ZTD 차트",
	summary: "36종의 zero-dependency 통계·비즈니스 데이터 시각화 차트 도형",
	layout: true,
	dependsOnCanonical: [
		"core.transform",
		"core.bounds",
		CHART_ASPECT_ID
	],
	dependsOnComputed: [],
	defaults: CHART_DEFAULTS,
	textSearchFields: [
		"title",
		"subtitle",
		"takeaway"
	],
	derive: deriveChartGeometry,
	renderDom: renderChartDom,
	renderSvg: renderChartSvg,
	ui: {
		controls: [
			{
				id: "ztd-charts.insert.shelf",
				kind: "action",
				label: "ZTD 차트 추가",
				icon: CHART_ICON,
				commandSymbol: `${EXTENSION_ID}:insert-chart`,
				placement: "tool-shelf",
				requiresSelection: false
			},
			{
				id: "ztd-charts.type.selection",
				kind: "segmented",
				field: "chartType",
				label: "차트 종류",
				placement: "selection-bar",
				options: QUICK_CHART_OPTIONS
			},
			{
				id: "ztd-charts.theme.selection",
				kind: "segmented",
				field: "theme",
				label: "테마",
				placement: "selection-bar",
				options: [{
					label: "라이트",
					value: "light"
				}, {
					label: "다크",
					value: "dark"
				}]
			},
			{
				id: "ztd-charts.suggest.selection",
				kind: "action",
				label: "추천 차트 적용",
				icon: CHART_ICON,
				commandSymbol: `${EXTENSION_ID}:apply-top-suggestion`,
				placement: "selection-bar",
				requiresSelection: true
			},
			{
				id: "ztd-charts.type.inspector",
				kind: "segmented",
				field: "chartType",
				label: "빠른 차트 전환",
				section: "차트 유형",
				placement: "inspector",
				options: QUICK_CHART_OPTIONS
			},
			{
				id: "ztd-charts.title.inspector",
				kind: "text",
				field: "title",
				label: "제목",
				section: "차트 텍스트",
				placement: "inspector"
			},
			{
				id: "ztd-charts.subtitle.inspector",
				kind: "text",
				field: "subtitle",
				label: "부제목·단위",
				section: "차트 텍스트",
				placement: "inspector"
			},
			{
				id: "ztd-charts.takeaway.inspector",
				kind: "text",
				field: "takeaway",
				label: "핵심 요약 (Takeaway)",
				section: "차트 텍스트",
				placement: "inspector"
			},
			{
				id: "ztd-charts.theme.inspector",
				kind: "segmented",
				field: "theme",
				label: "테마",
				section: "스타일 및 표시",
				placement: "inspector",
				options: [{
					label: "라이트",
					value: "light"
				}, {
					label: "다크",
					value: "dark"
				}]
			},
			{
				id: "ztd-charts.variant.inspector",
				kind: "segmented",
				field: "variant",
				label: "표시 형태",
				section: "스타일 및 표시",
				placement: "inspector",
				options: [{
					label: "카드형",
					value: "card"
				}, {
					label: "차트만",
					value: "bare"
				}]
			},
			{
				id: "ztd-charts.locale.inspector",
				kind: "segmented",
				field: "locale",
				label: "언어",
				section: "스타일 및 표시",
				placement: "inspector",
				options: [{
					label: "한국어",
					value: "ko"
				}, {
					label: "English",
					value: "en"
				}]
			},
			{
				id: "ztd-charts.legend.inspector",
				kind: "segmented",
				field: "legendMode",
				label: "범례 표시",
				section: "스타일 및 표시",
				placement: "inspector",
				options: [{
					label: "자동",
					value: "auto"
				}, {
					label: "숨김",
					value: "false"
				}]
			},
			{
				id: "ztd-charts.accent.inspector",
				kind: "color",
				field: "accentColor",
				label: "강조 색상",
				section: "스타일 및 표시",
				placement: "inspector"
			},
			{
				id: "ztd-charts.radius.inspector",
				kind: "number",
				field: "cornerRadius",
				label: "모서리 둥글기",
				section: "스타일 및 표시",
				placement: "inspector",
				min: 0,
				max: 64,
				step: 1
			},
			{
				id: "ztd-charts.background.inspector",
				kind: "color",
				field: "backgroundColor",
				label: "배경 색상",
				section: "스타일 및 표시",
				placement: "inspector"
			},
			{
				id: "ztd-charts.suggest.inspector",
				kind: "action",
				label: "데이터 맞춤 추천 차트 적용",
				icon: CHART_ICON,
				commandSymbol: `${EXTENSION_ID}:apply-top-suggestion`,
				section: "데이터 도구",
				placement: "inspector",
				requiresSelection: true
			},
			{
				id: "ztd-charts.reset.inspector",
				kind: "action",
				label: "내장 샘플 데이터로 복원",
				commandSymbol: `${EXTENSION_ID}:reset-sample-data`,
				section: "데이터 도구",
				placement: "inspector",
				requiresSelection: true
			}
		],
		panels: [createColorInspectorPanelSpec(), createStudioPanelSpec()]
	}
});
function getActiveSurface(context) {
	return context?.services?.get?.("canvas.active-tool-surface")?.get?.() ?? null;
}
function getSelectedChartIds(context, explicitEntityId) {
	if (typeof explicitEntityId === "string" && explicitEntityId) return context.world.getCanonical?.(explicitEntityId, CHART_ASPECT_ID) ? [explicitEntityId] : [];
	return (getActiveSurface(context)?.selection?.getSelection?.() ?? []).filter((id) => Boolean(context.world.getCanonical?.(id, CHART_ASPECT_ID)));
}
function withHistoryGroup(context, fn) {
	const history = getActiveSurface(context)?.host?.history;
	history?.begin?.();
	try {
		const result = fn();
		history?.commit?.();
		return result;
	} catch (error) {
		history?.abort?.();
		throw error;
	}
}
function readPreference(context, key, fallback) {
	try {
		const val = (context?.services?.get?.("extensions.preferences"))?.get?.(key);
		return val !== void 0 ? val : fallback;
	} catch {
		return fallback;
	}
}
function countExistingCharts(world) {
	let count = 0;
	for (const id of world?.listEntityIds?.() ?? []) {
		if (world.isAlive && !world.isAlive(id)) continue;
		if (world.getCanonical?.(id, CHART_ASPECT_ID)) count++;
	}
	return count;
}
var plugin = {
	...createPackageManifest(extension_default),
	summary: extension_default.summary,
	aspects: [ztdChartAspect],
	ui: { panels: [createStudioPanelSpec()] },
	activate(context) {
		const disposers = [];
		const editor = mountInlineEditor(context);
		disposers.push(() => editor.dispose());
		const editChart = (rawArgs = {}) => {
			const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};
			const targetIds = getSelectedChartIds(context, args.entityId);
			if (targetIds.length === 0) return null;
			const field = typeof args.field === "string" && args.field ? args.field : "title";
			editor.open(targetIds[0], field);
			return targetIds[0];
		};
		const insertChart = (rawArgs = {}) => {
			const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};
			const chartType = normalizeChartType(args.chartType ?? "bar");
			const locale = normalizeLang(args.locale ?? readPreference(context, "defaultLocale", "ko"));
			const theme = (args.theme ?? readPreference(context, "defaultTheme", "light")) === "dark" ? "dark" : "light";
			const variant = (args.variant ?? readPreference(context, "defaultVariant", "card")) === "bare" ? "bare" : "card";
			const existingCount = countExistingCharts(context.world);
			const hasExplicitX = Number.isFinite(args.x);
			const hasExplicitY = Number.isFinite(args.y);
			const x = hasExplicitX ? args.x : 80 + existingCount % 4 * 36;
			const y = hasExplicitY ? args.y : 80 + existingCount % 4 * 36;
			const width = Number.isFinite(args.width) && args.width > 0 ? Math.round(args.width) : 480;
			const height = Number.isFinite(args.height) && args.height > 0 ? Math.round(args.height) : 340;
			const sampleProps = createSamplePropsForType(chartType, locale, theme);
			const initialOptions = {
				...sampleProps.options ?? {},
				...args.options && typeof args.options === "object" ? args.options : {},
				...args.highlight !== void 0 ? { highlight: args.highlight } : {},
				...isValidHexColor(args.neutralColor) ? { neutralColor: args.neutralColor.trim() } : {},
				...args.itemColors && typeof args.itemColors === "object" ? { itemColors: sanitizeItemColors(args.itemColors) } : {}
			};
			const chartProps = {
				...sampleProps,
				variant,
				...typeof args.title === "string" ? { title: args.title } : {},
				...typeof args.subtitle === "string" ? { subtitle: args.subtitle } : {},
				...typeof args.takeaway === "string" ? { takeaway: args.takeaway } : {},
				...isValidHexColor(args.accentColor) ? { accentColor: args.accentColor.trim() } : {},
				...resolveBackgroundColor(args.backgroundColor) ? { backgroundColor: resolveBackgroundColor(args.backgroundColor) } : {},
				...Array.isArray(args.data) ? { data: args.data } : {},
				...args.encoding && typeof args.encoding === "object" ? { encoding: args.encoding } : {},
				...Object.keys(initialOptions).length > 0 ? { options: initialOptions } : {}
			};
			const creation = context?.services?.get?.("canvas.creation");
			if (creation && typeof creation.create === "function") return creation.create({
				caller: `${EXTENSION_ID}:insert-chart`,
				...hasExplicitX ? { x } : {},
				...hasExplicitY ? { y } : {},
				width,
				height,
				aspects: { [CHART_ASPECT_ID]: chartProps }
			});
			const id = typeof args.id === "string" && args.id ? args.id : `ztd-chart-${crypto.randomUUID()}`;
			withHistoryGroup(context, () => {
				context.world.applyCanonicalTransaction(`${EXTENSION_ID}:insert-chart`, [
					{
						id,
						aspect: "core.transform",
						patch: {
							x,
							y,
							rotation: 0
						}
					},
					{
						id,
						aspect: "core.bounds",
						patch: {
							width,
							height
						}
					},
					{
						id,
						aspect: CHART_ASPECT_ID,
						patch: chartProps
					}
				]);
			});
			getActiveSurface(context)?.selection?.select?.(id);
			return id;
		};
		const setChartType = (rawArgs = {}) => {
			const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};
			const targetIds = getSelectedChartIds(context, args.entityId);
			if (targetIds.length === 0) return null;
			const nextType = normalizeChartType(args.chartType);
			const ops = [];
			for (const id of targetIds) {
				const current = context.world.getCanonical(id, CHART_ASPECT_ID);
				if (!current) continue;
				const patch = {
					chartType: nextType,
					...args.encoding && typeof args.encoding === "object" ? { encoding: args.encoding } : {}
				};
				if (!Array.isArray(current.data) || current.data.length === 0) {
					const sample = createSamplePropsForType(nextType, current.locale, current.theme);
					patch.title = sample.title;
					patch.subtitle = sample.subtitle;
					patch.takeaway = "";
				}
				ops.push({
					id,
					aspect: CHART_ASPECT_ID,
					patch
				});
			}
			if (ops.length > 0) withHistoryGroup(context, () => {
				context.world.applyCanonicalTransaction(`${EXTENSION_ID}:set-chart-type`, ops);
			});
			return targetIds;
		};
		const updateData = (rawArgs = {}) => {
			const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};
			const targetIds = getSelectedChartIds(context, args.entityId);
			if (targetIds.length === 0) return null;
			const parsed = parseDataInput(args.rows ?? args.data ?? "");
			if (!parsed.ok) return null;
			const ops = [];
			for (const id of targetIds) {
				const current = context.world.getCanonical(id, CHART_ASPECT_ID);
				if (!current) continue;
				const nextChartType = args.chartType ? normalizeChartType(args.chartType) : current.chartType;
				const suggested = suggestChartsForRows(parsed.rows, current.locale).suggestions;
				const matchingSuggestion = suggested.find((s) => s.type === nextChartType) ?? suggested[0];
				const nextEncoding = args.encoding ?? parsed.encoding ?? matchingSuggestion?.spec?.encoding ?? current.encoding ?? {};
				ops.push({
					id,
					aspect: CHART_ASPECT_ID,
					patch: {
						chartType: nextChartType,
						data: parsed.rows,
						encoding: nextEncoding,
						...args.options || parsed.options ? { options: {
							...current.options ?? {},
							...parsed.options ?? {},
							...args.options ?? {}
						} } : {}
					}
				});
			}
			if (ops.length > 0) withHistoryGroup(context, () => {
				context.world.applyCanonicalTransaction(`${EXTENSION_ID}:update-data`, ops);
			});
			return targetIds;
		};
		const updateStyle = (rawArgs = {}) => {
			const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};
			const targetIds = getSelectedChartIds(context, args.entityId);
			if (targetIds.length === 0) return null;
			const ops = [];
			for (const id of targetIds) {
				const current = context.world.getCanonical(id, CHART_ASPECT_ID);
				if (!current) continue;
				const nextOptions = { ...current.options ?? {} };
				let optionsChanged = false;
				if (args.options && typeof args.options === "object" && !Array.isArray(args.options)) {
					for (const [k, v] of Object.entries(args.options)) if (v === void 0 || v === null) delete nextOptions[k];
					else nextOptions[k] = v;
					optionsChanged = true;
				}
				if ("highlight" in args) {
					if (args.highlight === void 0 || args.highlight === null || args.highlight === "auto") delete nextOptions.highlight;
					else nextOptions.highlight = args.highlight;
					optionsChanged = true;
				}
				if ("neutralColor" in args) {
					if (!args.neutralColor) delete nextOptions.neutralColor;
					else if (isValidHexColor(args.neutralColor)) nextOptions.neutralColor = args.neutralColor.trim();
					optionsChanged = true;
				}
				if ("itemColors" in args) {
					if (!args.itemColors || typeof args.itemColors === "object" && Object.keys(args.itemColors).length === 0 && args.replaceItemColors) delete nextOptions.itemColors;
					else if (typeof args.itemColors === "object" && !Array.isArray(args.itemColors)) {
						const mergedColors = args.replaceItemColors ? {} : { ...nextOptions.itemColors ?? {} };
						for (const [k, v] of Object.entries(args.itemColors)) {
							const keyStr = String(k ?? "").trim();
							if (!keyStr) continue;
							if (!v) delete mergedColors[keyStr];
							else if (isValidHexColor(v)) mergedColors[keyStr] = v.trim();
						}
						if (Object.keys(mergedColors).length > 0) nextOptions.itemColors = mergedColors;
						else delete nextOptions.itemColors;
					}
					optionsChanged = true;
				}
				const patch = {};
				if (typeof args.theme === "string" && (args.theme === "light" || args.theme === "dark")) patch.theme = args.theme;
				if ("accentColor" in args && isValidHexColor(args.accentColor)) patch.accentColor = args.accentColor.trim();
				if ("backgroundColor" in args) patch.backgroundColor = resolveBackgroundColor(args.backgroundColor);
				if (optionsChanged) patch.options = nextOptions;
				if (Object.keys(patch).length > 0) ops.push({
					id,
					aspect: CHART_ASPECT_ID,
					patch
				});
			}
			if (ops.length > 0) withHistoryGroup(context, () => {
				context.world.applyCanonicalTransaction(`${EXTENSION_ID}:update-style`, ops);
			});
			return targetIds;
		};
		const resetSampleData = (rawArgs = {}) => {
			const targetIds = getSelectedChartIds(context, (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {}).entityId);
			if (targetIds.length === 0) return null;
			const ops = [];
			for (const id of targetIds) {
				const current = context.world.getCanonical(id, CHART_ASPECT_ID);
				if (!current) continue;
				const sample = createSamplePropsForType(current.chartType, current.locale, current.theme);
				ops.push({
					id,
					aspect: CHART_ASPECT_ID,
					patch: {
						title: sample.title,
						subtitle: sample.subtitle,
						takeaway: "",
						data: [],
						encoding: {},
						options: {}
					}
				});
			}
			if (ops.length > 0) withHistoryGroup(context, () => {
				context.world.applyCanonicalTransaction(`${EXTENSION_ID}:reset-sample-data`, ops);
			});
			return targetIds;
		};
		const applyTopSuggestion = (rawArgs = {}) => {
			const targetIds = getSelectedChartIds(context, (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {}).entityId);
			if (targetIds.length === 0) return null;
			const ops = [];
			for (const id of targetIds) {
				const current = context.world.getCanonical(id, CHART_ASPECT_ID);
				if (!current) continue;
				const resolved = resolveChartSpec(current);
				const suggestions = suggestChartsForRows(resolved.spec.data, resolved.lang).suggestions;
				const nextChoice = suggestions.find((s) => s.type !== resolved.chartType) ?? suggestions[0];
				if (!nextChoice) continue;
				ops.push({
					id,
					aspect: CHART_ASPECT_ID,
					patch: {
						chartType: nextChoice.type,
						data: resolved.spec.data,
						encoding: nextChoice.spec?.encoding ?? {}
					}
				});
			}
			if (ops.length > 0) withHistoryGroup(context, () => {
				context.world.applyCanonicalTransaction(`${EXTENSION_ID}:apply-top-suggestion`, ops);
			});
			return targetIds;
		};
		const toggleField = (field, values, rawArgs = {}) => {
			const targetIds = getSelectedChartIds(context, (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {}).entityId);
			if (targetIds.length === 0) return null;
			const ops = [];
			for (const id of targetIds) {
				const current = context.world.getCanonical(id, CHART_ASPECT_ID);
				if (!current) continue;
				const nextVal = values[(values.indexOf(current[field]) + 1) % values.length];
				ops.push({
					id,
					aspect: CHART_ASPECT_ID,
					patch: { [field]: nextVal }
				});
			}
			if (ops.length > 0) withHistoryGroup(context, () => {
				context.world.applyCanonicalTransaction(`${EXTENSION_ID}:toggle-${field}`, ops);
			});
			return targetIds;
		};
		const runCommand = (name, rawArgs = {}) => {
			const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};
			switch (name) {
				case "insert-chart": return insertChart(args);
				case "edit-chart": return editChart(args);
				case "set-chart-type": return setChartType(args);
				case "update-data": return updateData(args);
				case "update-style": return updateStyle(args);
				case "reset-sample-data": return resetSampleData(args);
				case "apply-top-suggestion": return applyTopSuggestion(args);
				case "toggle-theme": return toggleField("theme", ["light", "dark"], args);
				case "toggle-variant": return toggleField("variant", ["card", "bare"], args);
				case "toggle-locale": return toggleField("locale", ["ko", "en"], args);
				default:
					if (CHART_TYPES.includes(name)) return insertChart({
						...args,
						chartType: name
					});
					return null;
			}
		};
		try {
			disposers.push(registerZtdChartTools(context));
			for (const name of COMMAND_NAMES) {
				const off = context.commands?.register?.({
					id: `${EXTENSION_ID}:${name}`,
					title: COMMAND_LABELS[name] ?? name,
					summary: COMMAND_LABELS[name] ?? name,
					shortcutScope: "canvas",
					...name === "edit-chart" ? {
						shortcutSelectionAspect: CHART_ASPECT_ID,
						keys: ["Enter"]
					} : {},
					run: (args) => runCommand(name, args)
				});
				if (typeof off === "function") disposers.push(off);
			}
		} catch (error) {
			for (const dispose of disposers.reverse()) try {
				dispose();
			} catch {}
			throw error;
		}
		return {
			api: Object.freeze({
				run: runCommand,
				insertChart,
				editChart,
				setChartType,
				updateData,
				updateStyle,
				resetSampleData,
				applyTopSuggestion,
				editor
			}),
			dispose() {
				for (const dispose of disposers.splice(0).reverse()) try {
					dispose();
				} catch {}
			}
		};
	}
};
export { CHART_ASPECT_ID, CHART_DEFAULTS, CHART_FAMILIES, CHART_TYPES, COLOR_INSPECTOR_PANEL_ID, COMMAND_NAMES, EXTENSION_ID, HIGHLIGHT_PRESETS, STUDIO_PANEL_ID, createPackageManifest, createSamplePropsForType, plugin as default, deriveChartGeometry, extractChartDataTargets, formatRowsAsCsv, getChartCatalog, matchTextToChartData, mergeDraft, mountInlineEditor, parseDataInput, planZtdChartChanges, registerZtdChartTools, renderChartDom, renderChartSvg, resolveChartSpec, resolveColorForZtdKey, sanitizeItemColors, settingsSchema, suggestChartsForRows, ztdChartAspect };
