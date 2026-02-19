export interface ExecutionConfig {
  maxRetries: number
  defaultTimeout: number
  longRunningCommandTimeout: number
  pathCheckEnabled: boolean
  commandSafetyCheckEnabled: boolean
  llmCorrectionEnabled: boolean
  toolExecutionCacheEnabled: boolean
  retryDelayMs: number
}

export interface Config {
  execution: ExecutionConfig
}

export const config: Config = {
  execution: {
    maxRetries: 3,
    defaultTimeout: 60000,
    longRunningCommandTimeout: 600000,
    pathCheckEnabled: true,
    commandSafetyCheckEnabled: true,
    llmCorrectionEnabled: true,
    toolExecutionCacheEnabled: false,
    retryDelayMs: 1000
  }
}

export default config
