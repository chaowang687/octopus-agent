import { ErrorRecord } from './types'

export class ErrorManager {
  private errorHistory: ErrorRecord[] = []
  private errorThreshold: number = 3
  private errorWindow: number = 300000

  setErrorThreshold(threshold: number): void {
    this.errorThreshold = threshold
  }

  setErrorWindow(window: number): void {
    this.errorWindow = window
  }

  recordError(agentId: string, error: string, round: number = 0): void {
    this.errorHistory.push({
      agentId,
      error,
      timestamp: Date.now(),
      round
    })
    
    this.cleanupOldErrors()
  }

  private cleanupOldErrors(): void {
    const cutoff = Date.now() - this.errorWindow
    this.errorHistory = this.errorHistory.filter(e => e.timestamp > cutoff)
  }

  hasRepeatingError(agentId: string, error: string): boolean {
    const similarErrors = this.errorHistory.filter(
      e => e.agentId === agentId && this.isSimilarError(e.error, error)
    )
    return similarErrors.length >= this.errorThreshold
  }

  private isSimilarError(error1: string, error2: string): boolean {
    const normalizeError = (e: string) => {
      return e
        .replace(/\d+/g, 'N')
        .replace(/at\s+\S+/g, 'at STACK')
        .toLowerCase()
        .trim()
    }
    
    const norm1 = normalizeError(error1)
    const norm2 = normalizeError(error2)
    
    if (norm1 === norm2) return true
    
    const commonPatterns = [
      /timeout/i,
      /network/i,
      /permission/i,
      /not found/i,
      /invalid/i,
      /failed/i
    ]
    
    for (const pattern of commonPatterns) {
      if (pattern.test(norm1) && pattern.test(norm2)) {
        return true
      }
    }
    
    return false
  }

  detectLoopState(errorHistory?: ErrorRecord[]): { isLooping: boolean; reason: string } {
    const history = errorHistory || this.errorHistory
    if (history.length < 3) {
      return { isLooping: false, reason: '' }
    }

    const recentErrors = history.slice(-6)
    const agentErrorCounts = new Map<string, number>()
    
    for (const error of recentErrors) {
      const count = agentErrorCounts.get(error.agentId) || 0
      agentErrorCounts.set(error.agentId, count + 1)
    }
    
    for (const [agentId, count] of agentErrorCounts) {
      if (count >= 3) {
        return {
          isLooping: true,
          reason: `智能体 ${agentId} 连续出现 ${count} 次错误，可能陷入循环`
        }
      }
    }

    const errorPatterns = new Map<string, number>()
    for (const error of recentErrors) {
      const normalizedError = error.error.toLowerCase().slice(0, 50)
      const count = errorPatterns.get(normalizedError) || 0
      errorPatterns.set(normalizedError, count + 1)
    }
    
    for (const [pattern, count] of errorPatterns) {
      if (count >= 3) {
        return {
          isLooping: true,
          reason: `检测到重复错误模式: "${pattern.slice(0, 30)}..." 出现 ${count} 次`
        }
      }
    }

    return { isLooping: false, reason: '' }
  }

  getErrorHistory(agentId?: string): ErrorRecord[] {
    if (agentId) {
      return this.errorHistory.filter(e => e.agentId === agentId)
    }
    return [...this.errorHistory]
  }

  clearHistory(): void {
    this.errorHistory = []
  }

  getStats(): {
    totalErrors: number
    errorsByAgent: Record<string, number>
    recentErrors: ErrorRecord[]
  } {
    const errorsByAgent: Record<string, number> = {}
    for (const error of this.errorHistory) {
      errorsByAgent[error.agentId] = (errorsByAgent[error.agentId] || 0) + 1
    }
    
    return {
      totalErrors: this.errorHistory.length,
      errorsByAgent,
      recentErrors: this.errorHistory.slice(-10)
    }
  }
}

export const errorManager = new ErrorManager()
