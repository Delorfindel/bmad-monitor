import path from 'node:path'
import type { AppConfig } from '../../src/config/env'

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    source: { mode: 'local', root: path.resolve('fixtures/sample-project'), label: 'fixture' },
    sprintStatusPath: 'sprint/sprint-status.yaml',
    outputDir: path.resolve('.generated-test'),
    cleanUrls: true,
    maxLinkedDocuments: 40,
    maxAssets: 60,
    maxAssetBytes: 5 * 1024 * 1024,
    concurrency: 4,
    ...overrides
  }
}
