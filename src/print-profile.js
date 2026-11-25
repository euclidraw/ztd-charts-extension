// Pick by the visual encoding, not by catalog family: a calendar is a tone scale,
// a bump chart is a set of traces, and a flow map encodes volume in line width.
const groups = {
  region: 'pie donut waffle treemap sunburst marimekko bar area stream segmented barRace',
  trace: 'line radar bump slope parallel ridgeline sparkline horizon',
  point: 'bubble scatter beeswarm lollipop dumbbell',
  scale: 'heatmap calendar tileMap choropleth cohort',
  flow: 'sankey chord network tree symbolMap flowMap',
  measure: 'funnel waterfall pareto radialBar gauge bullet box candlestick skyline histogram timeline sparkTable',
};
export const PRINT_PROFILE = Object.freeze(Object.fromEntries(Object.entries(groups).flatMap(([kind, types]) => types.split(' ').map(t => [t, kind]))));
export const PROFILE_NOTE = {
  region: '범주를 명암으로 나누고 빗금 프리셋에서는 면과 범례에 같은 무늬를 씁니다.',
  trace: '여러 계열의 선은 선종으로 구분하고 기준선·예측선은 유지합니다.',
  point: '점의 위치와 크기를 보존하고 채움과 윤곽을 구분합니다.',
  scale: '값을 나타내는 명암 단계와 결측값을 보존합니다.',
  flow: '노드 크기, 연결 방향, 흐름량을 나타내는 폭은 유지합니다.',
  measure: '측정값, 구간, 목표 표식은 그대로 두고 인쇄용 명암으로 구분합니다.',
};
