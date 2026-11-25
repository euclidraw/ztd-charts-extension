// CSS font matching is per glyph: Latin letters/digits use the bundled CMU Serif faces, and missing
// Hangul glyphs fall through to Pretendard even within the same SVG text node.
export const KOREAN_SANS = 'Pretendard, "Pretendard Variable", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
export const CHART_FONT = '"CMU Serif", ' + KOREAN_SANS;
