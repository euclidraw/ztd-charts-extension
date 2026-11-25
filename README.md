# ZTD 차트 확장 (`euclidraw/ztd-charts-extension`)

[ztd-charts](https://github.com/Junhan2/ztd-charts) (`0.13.1`) 기반의 **47종 zero-dependency 통계·비즈니스 차트**를 Alid 캔버스 도형(`diagram.ztd-charts.chart`), 100% 순수 벡터 정적 SVG 출판, 데이터 스튜디오 패널, 코파일럿 승인 도구(`workspace.tools`)로 제공하는 공식 외부 저장소 확장입니다.

## 주요 기능

- **47종 차트 카탈로그 지원**:
  - **비교 (Comparison)**: `bar`, `waterfall`, `pareto`, `radar`, `slope`, `dumbbell`, `lollipop`, `barRace`
  - **추세 (Trend)**: `line`, `area`, `stream`, `sparkline`, `calendar`, `bump`, `candlestick`, `skyline`, `timeline`, `cohort`, `horizon`
  - **비율 (Proportion)**: `pie`, `donut`, `waffle`, `marimekko`, `segmented`
  - **관계 (Relationship)**: `heatmap`, `bubble`, `parallel`, `scatter`, `network`
  - **분포 (Distribution)**: `beeswarm`, `ridgeline`, `box`, `histogram`
  - **흐름 (Flow)**: `funnel`, `sankey`, `chord`
  - **계층 (Hierarchy)**: `treemap`, `sunburst`, `tree`
  - **KPI**: `radialBar`, `gauge`, `bullet`, `sparkTable`
  - **지도 (Map)**: `tileMap`, `choropleth`, `symbolMap`, `flowMap`. 한국 시도·미국 주·세계 경계를 번들에 포함해 별도 다운로드 없이 표시합니다 ([데이터 출처 및 라이선스](docs/third-party-notices.md)).
- **캔버스 DOM 아일랜드 & 줌 보정**:
  - `transform: scale(camera.zoom)` 캔버스 좌표계에서 호버 툴팁 및 반응형 컨테이너 폭이 왜곡되지 않도록 번들 타임 패치를 적용했습니다.
- **무의존성 순수 벡터 SVG 컴파일 (`renderSvg`)**:
  - `react-dom/server` CJS 번들링이나 `<foreignObject>` 없이 47종 차트 전체와 카드 헤더·부제목·자동 범례·핵심 요약(takeaway)을 결정론적 순수 SVG 벡터로 컴파일합니다.
- **ZTD 차트 스튜디오 도크 패널 (`diagram.ztd-charts.studio`)**:
  - 47종 차트 갤러리 검색·카테고리 필터, CSV/JSON 실시간 데이터 편집기, `suggestCharts` 기반 데이터 맞춤 차트 자동 추천을 제공합니다.
  - 차트를 선택한 뒤 **데이터 열 안내**를 열면 필수·선택 필드와 현재 연결된 열을 확인할 수 있습니다. **차트 표시 옵션**에서는 코호트의 비율/건수, 트리 방향 등 해당 유형이 지원하는 설정을 바꾸거나 기본값으로 되돌릴 수 있습니다.
- **코파일럿 도구 연동 (`workspace.tools`)**:
  - `diagram.ztd-charts:catalog`, `diagram.ztd-charts:suggest`, `diagram.ztd-charts:search`, `diagram.ztd-charts:plan-changes` (`prepareChange` 사용자 승인 배치)를 제공합니다.

## 수능 인쇄 스타일

차트를 선택한 뒤 **ZTD 차트 스튜디오 → 수능 인쇄 스타일**에서 프리셋을 고릅니다. 프리셋 위에 CSS 선언을 덧쓸 수 있고, **인쇄 스타일 초기화**는 데이터와 일반 차트 설정을 보존합니다. [레퍼런스별 대응, CSS 문법과 예시](docs/print-styles.md)를 참고하세요.

## 설치 및 개발

Alid 워크벤치의 **확장 관리 → GitHub 저장소 설치**에 다음 저장소를 입력해 설치할 수 있습니다.

```text
euclidraw/ztd-charts-extension
```

로컬 개발 서버 실행:

```bash
pnpm install
pnpm dev
```

빌드 및 검증:

```bash
pnpm build
pnpm test
pnpm check:dist
pnpm test:host
```
