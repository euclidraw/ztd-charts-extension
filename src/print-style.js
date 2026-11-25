import { CHART_FONT, KOREAN_SANS } from './chart-fonts.js';
import { contrastRatio, mixHex, pickText } from 'ztd-charts';

// An intentionally small declaration grammar. User input is never inserted into a stylesheet.
export const PRINT_PRESETS = [
  { id: 'climate', name: '기후 편차 · 막대와 점', chart: 'bar', note: '옅은 회색 막대와 먹선. 점은 차트에 점 계열이 있을 때만 표시합니다.', fill: '#bababa' },
  { id: 'population', name: '인구 변화 · 회색 누적면', chart: 'area', note: '직선 경계와 회색 명암으로 계열을 구분합니다. 소형 다중 도표는 별개 차트로 배치하세요.', fill: '#777777' },
  { id: 'bars', name: '구성비 · 빗금 막대', chart: 'bar', note: '점선 눈금과 얇은 막대 테두리. 두 번째 계열(단일 계열이면 두 번째 항목)에 빗금을 넣습니다.', fill: '#959595', hatch: true, dash: '4 3' },
  { id: 'energy', name: '에너지 구성 · 빗금 누적면', chart: 'area', note: '두 번째 면에 사선 무늬를 넣습니다. 연도 축 방향과 백분율 변환은 바꾸지 않습니다.', fill: '#929292', hatch: true },
  { id: 'bubbles', name: '인구 구조 · 윤곽 버블', chart: 'bubble', note: '원 중심과 반지름은 유지하고 먹선 테두리와 회색 채움으로 구분합니다.', fill: '#a0a0a0', dash: '3 2' },
  { id: 'periods', name: '두 시점 · 삼각형과 사각형', chart: 'dumbbell', note: '시작은 빈 삼각형, 끝은 회색 사각형으로 표시합니다. 범례에도 같은 기호를 씁니다.', fill: '#bbbbbb', dash: '4 3' },
];
export const EXAMPLE_CSS = '--exam-ink: #181818;\n--exam-fill: #aaaaaa;\n--exam-grid-dash: 4 3;\n--exam-stroke: 1px;\n--exam-font: serif;';
const validators = {
  ink: /^#[0-9a-f]{6}$/i, fill: /^#[0-9a-f]{6}$/i, paper: /^#[0-9a-f]{6}$/i,
  grid: /^#[0-9a-f]{6}$/i, 'grid-dash': /^(?:none|[1-9]\d? [1-9]\d?)$/,
  stroke: /^(?:0\.[5-9]|[12](?:\.\d)?|3(?:\.0)?)px$/, font: /^(?:serif|sans-serif)$/,
};
export function parsePrintCss(css) {
  const values = {};
  if (typeof css !== 'string' || css.length > 2048) return { error: 'CSS는 2048자 이내로 입력하세요.' };
  for (const raw of css.split(';')) {
    if (!raw.trim()) continue;
    const pair = /^--exam-([a-z-]+)\s*:\s*(.+)$/.exec(raw.trim());
    if (!pair || !Object.hasOwn(validators, pair[1]) || !validators[pair[1]].test(pair[2])) {
      return { error: `지원하지 않는 선언: ${raw.trim().slice(0, 80)}` };
    }
    values[pair[1]] = pair[2];
  }
  return { values };
}
export function resolvePrintStyle(presetId, css = '') {
  const preset = PRINT_PRESETS.find(p => p.id === presetId);
  const { values } = parsePrintCss(css);
  if (!preset && !Object.keys(values ?? {}).length) return null;
  const v = values ?? {};
  return {
    preset, ink: v.ink ?? '#171717', paper: v.paper ?? '#ffffff', fill: v.fill ?? preset?.fill ?? '#aaaaaa',
    grid: v.grid ?? '#777777', dash: v['grid-dash'] ?? preset?.dash ?? 'none', stroke: parseFloat(v.stroke ?? '1'),
    font: v.font === 'sans-serif' ? KOREAN_SANS : CHART_FONT,
  };
}
export function labelInk(background, preferred) {
  if (contrastRatio(background, '#ffffff') > contrastRatio(background, '#171717')) return '#ffffff';
  return contrastRatio(background, preferred) >= 4.5 ? preferred : '#171717';
}
export function printTheme(s, base) {
  // Do not alias accent to ink: pie, scatter and status scales use both as distinct data roles.
  const accent = mixHex(s.ink, s.fill, 0.65);
  const strong = mixHex(s.fill, s.paper, 0.55);
  const readable = bg => pickText(bg, [s.ink, s.paper, '#000000', '#ffffff']);
  return { ...base, name: 'light', bg: s.paper, panel: s.paper, ink: labelInk(s.paper, s.ink), muted: labelInk(s.paper, s.ink), dim: s.ink,
    accent, accentText: s.ink, accent2: strong, accent3: mixHex(s.fill, s.ink, 0.75), tint: '#eeeeee', lift: s.paper,
    neutral: s.fill, neutralStrong: strong, neutralSoft: mixHex(s.fill, s.paper, 0.17), line: s.grid, line2: '#dddddd',
    onInk: readable(s.ink), onAccent: readable(accent), onNeutralStrong: readable(strong), fontFamily: s.font, monoFamily: s.font,
    radius: 0, radiusMark: 0 };
}
