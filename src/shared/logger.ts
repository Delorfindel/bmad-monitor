export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

const PREFIX: Record<LogLevel, string> = {
  debug: '  ',
  info: '  ',
  warn: '  ! ',
  error: '  x '
}

/**
 * Deliberately message-only: no object dumping, so a token or a full document
 * body can never reach the build log through a stray argument.
 */
export function createLogger(minLevel: LogLevel = 'info'): Logger {
  const order: LogLevel[] = ['debug', 'info', 'warn', 'error']
  const threshold = order.indexOf(minLevel)
  const emit = (level: LogLevel, message: string): void => {
    if (order.indexOf(level) < threshold) return
    const line = `${PREFIX[level]}${message}`
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  }
  return {
    debug: (m) => emit('debug', m),
    info: (m) => emit('info', m),
    warn: (m) => emit('warn', m),
    error: (m) => emit('error', m)
  }
}

export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
}
