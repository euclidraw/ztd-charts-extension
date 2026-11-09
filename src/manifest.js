import rawConfig from '../extension.json' with { type: 'json' };

export const EXTENSION_ID = rawConfig.id;
export const CHART_ASPECT_ID = `${EXTENSION_ID}.chart`;
export const STUDIO_PANEL_ID = `${EXTENSION_ID}.studio`;

export const COMMAND_NAMES = Object.freeze([
  'insert-chart',
  'set-chart-type',
  'update-data',
  'reset-sample-data',
  'apply-top-suggestion',
  'toggle-theme',
  'toggle-variant',
  'toggle-locale',
]);

export const settingsSchema = Object.freeze([
  {
    key: 'defaultTheme',
    label: '기본 차트 테마',
    kind: 'select',
    defaultValue: 'light',
    options: [
      { value: 'light', label: '라이트' },
      { value: 'dark', label: '다크' },
    ],
  },
  {
    key: 'defaultLocale',
    label: '기본 차트 언어',
    kind: 'select',
    defaultValue: 'ko',
    options: [
      { value: 'ko', label: '한국어' },
      { value: 'en', label: 'English' },
    ],
  },
  {
    key: 'defaultVariant',
    label: '기본 표시 형태',
    kind: 'select',
    defaultValue: 'card',
    options: [
      { value: 'card', label: '카드형 (제목·범례·요약 포함)' },
      { value: 'bare', label: '차트만 표시' },
    ],
  },
]);

/** Shared by the bundle and build script; keep the reviewed and executed contracts identical. */
export function createPackageManifest(metadata = rawConfig) {
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
      hsmSlots: [...metadata.provides.hsmSlots],
    },
  };
}

export const EXTENSION_MANIFEST = Object.freeze(createPackageManifest(rawConfig));
