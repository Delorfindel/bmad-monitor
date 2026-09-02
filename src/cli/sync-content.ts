#!/usr/bin/env node
import process from 'node:process'
import { loadConfig, loadDotEnv, redactSecrets, ConfigError } from '../config/env.js'
import { collectSprint } from '../generation/collect.js'
import { generateSite } from '../generation/pages.js'
import { assertNoSecrets } from '../generation/verify.js'
import { createContentSource } from '../github/index.js'
import { SourceError } from '../github/errors.js'
import { SprintStatusError } from '../bmad/sprint-status.js'
import { createLogger } from '../shared/logger.js'
import { STATUS_DISPLAY_ORDER, STATUS_LABELS } from '../bmad/types.js'

async function main(): Promise<void> {
  const logger = createLogger(process.env.BMAD_LOG_LEVEL === 'debug' ? 'debug' : 'info')
  loadDotEnv(process.cwd(), process.env)
  const config = loadConfig(process.env)

  logger.info(
    config.source.mode === 'local'
      ? `Source: local fixture ${config.source.label}`
      : `Source: ${config.source.repository.full}@${config.source.ref}`
  )

  const source = await createContentSource(config, { logger })
  const collected = await collectSprint(config, source, { logger })
  const result = await generateSite(collected, config, source, logger)
  await assertNoSecrets(
    config.outputDir,
    config.source.mode === 'github' ? config.source.token : undefined
  )

  const { data } = collected
  logger.info('')
  logger.info(`${data.project}${data.sprintLabel ? ` — ${data.sprintLabel}` : ''}`)
  logger.info(`  revision   ${data.snapshot.shortSha} (${data.snapshot.ref})`)
  logger.info(`  epics      ${data.epics.length}`)
  logger.info(
    `  stories    ${data.totalStories} — ${STATUS_DISPLAY_ORDER.filter(
      (status) => data.progress[status] > 0
    )
      .map((status) => `${data.progress[status]} ${STATUS_LABELS[status].toLowerCase()}`)
      .join(', ')}`
  )
  logger.info(`  documents  ${data.references.length} linked, ${result.assets.length} assets`)

  if (data.warnings.length > 0) {
    logger.info('')
    for (const warning of data.warnings) {
      const line = `${warning.code}: ${warning.message}`
      if (warning.severity === 'warning') logger.warn(line)
      else logger.info(`  ${line}`)
    }
  }
}

main().catch((error: unknown) => {
  const known =
    error instanceof ConfigError ||
    error instanceof SourceError ||
    error instanceof SprintStatusError
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\nsync-content failed: ${redactSecrets(message)}`)
  if (!known && error instanceof Error && error.stack) {
    console.error(redactSecrets(error.stack.split('\n').slice(1, 4).join('\n')))
  }
  process.exitCode = 1
})
