import { env } from './lib/env.js'
import { prisma } from './lib/prisma.js'
import { createApp } from './app.js'
import { logger } from './lib/logger.js'

const app = createApp()
const server = app.listen(env.PORT, '0.0.0.0', () => logger.info('server_started', { port: env.PORT, environment: env.NODE_ENV }))
let shuttingDown = false

async function shutdown(signal: string, exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('server_stopping', { signal })
  const forceTimer = setTimeout(() => {
    logger.error('server_shutdown_timeout', { signal })
    process.exit(1)
  }, 10_000)
  forceTimer.unref()
  server.close(async (error) => {
    if (error) logger.error('server_close_failed', { errorMessage: error.message })
    await prisma.$disconnect().catch((disconnectError: unknown) => {
      logger.error('database_disconnect_failed', { errorMessage: disconnectError instanceof Error ? disconnectError.message : 'Unknown error' })
    })
    clearTimeout(forceTimer)
    logger.info('server_stopped', { signal })
    process.exit(error ? 1 : exitCode)
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { errorName: error.name, errorMessage: error.message })
  void shutdown('uncaughtException', 1)
})
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { errorMessage: reason instanceof Error ? reason.message : String(reason) })
  void shutdown('unhandledRejection', 1)
})
