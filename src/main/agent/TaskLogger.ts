import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import {
  TaskLogEntry,
  TaskLogType,
  TaskExecutionLog,
  ReActTraceLog,
  ReActStepLog,
  IterationLog,
  AgentExecutionLog,
  TaskLogStorage
} from './TaskLogTypes'

export class TaskLogger implements TaskLogStorage {
  private logsDir: string
  private currentLog: TaskExecutionLog | null = null
  private logEntries: TaskLogEntry[] = []
  
  constructor() {
    this.logsDir = this.initLogsDir()
  }
  
  private initLogsDir(): string {
    try {
      const logsDir = path.join(app.getPath('userData'), 'task-logs')
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
      }
      return logsDir
    } catch (error) {
      console.warn('[TaskLogger] 无法创建日志目录，使用备用目录:', error)
      // 使用应用数据目录下的子目录
      const fallbackDir = path.join(app.getPath('temp') || '/tmp', 'octopus-agent-logs')
      try {
        if (!fs.existsSync(fallbackDir)) {
          fs.mkdirSync(fallbackDir, { recursive: true })
        }
        return fallbackDir
      } catch (fallbackError) {
        console.error('[TaskLogger] 无法创建备用日志目录:', fallbackError)
        // 返回临时目录
        return '/tmp'
      }
    }
  }
  
  private ensureLogsDir(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true })
      }
    } catch (error) {
      console.warn('[TaskLogger] 无法确保日志目录存在:', error)
    }
  }
  
  startTask(params: {
    taskId: string
    projectName: string
    instruction: string
    originalInstruction: string
    taskDir: string
  }): TaskExecutionLog {
    this.currentLog = {
      taskId: params.taskId,
      projectName: params.projectName,
      instruction: params.instruction,
      originalInstruction: params.originalInstruction,
      taskDir: params.taskDir,
      startTime: Date.now(),
      status: 'running',
      routing: {
        targetSystem: 'system2'
      },
      iterations: [],
      summary: {
        totalSteps: 0,
        totalToolCalls: 0,
        totalLLMCalls: 0,
        totalTokens: 0,
        errorCount: 0,
        retryCount: 0,
        correctionCount: 0
      },
      logs: []
    }
    this.logEntries = []
    
    this.addLog({
      type: 'task_start',
      level: 'info',
      category: 'task',
      message: `任务开始: ${params.projectName}`,
      details: {
        taskDir: params.taskDir,
        instruction: params.originalInstruction.slice(0, 200)
      }
    })
    
    return this.currentLog
  }
  
  logRouting(params: {
    targetSystem: 'system1' | 'system2'
    reasoning?: string
    confidence?: number
  }): void {
    if (!this.currentLog) return
    
    this.currentLog.routing = params
    
    this.addLog({
      type: 'routing',
      level: 'info',
      category: 'routing',
      message: `路由到 ${params.targetSystem}`,
      details: params
    })
  }
  
  logDistillation(params: {
    enabled: boolean
    skillName?: string
    cacheHit?: boolean
    knowledgeInjected?: boolean
  }): void {
    if (!this.currentLog) return
    
    this.currentLog.distillation = params
    
    this.addLog({
      type: 'distillation',
      level: 'info',
      category: 'distillation',
      message: params.cacheHit 
        ? `使用缓存技能: ${params.skillName}`
        : params.knowledgeInjected 
          ? `注入蒸馏知识: ${params.skillName}`
          : '蒸馏未启用',
      details: params
    })
  }
  
  startIteration(iterationNumber: number): IterationLog | null {
    if (!this.currentLog) return null
    
    const iteration: IterationLog = {
      iterationNumber,
      startTime: Date.now(),
      agents: [],
      result: {
        completed: false,
        delivered: false,
        summary: ''
      }
    }
    
    this.currentLog.iterations.push(iteration)
    
    this.addLog({
      type: 'iteration_start',
      level: 'info',
      category: 'iteration',
      message: `开始第 ${iterationNumber} 轮迭代`,
      details: { iterationNumber }
    })
    
    return iteration
  }
  
  endIteration(iterationNumber: number, result: {
    completed: boolean
    delivered: boolean
    summary: string
  }): void {
    if (!this.currentLog) return
    
    const iteration = this.currentLog.iterations.find(
      i => i.iterationNumber === iterationNumber
    )
    if (iteration) {
      iteration.endTime = Date.now()
      iteration.duration = iteration.endTime - iteration.startTime
      iteration.result = result
    }
    
    this.addLog({
      type: 'iteration_end',
      level: result.completed ? 'success' : 'warning',
      category: 'iteration',
      message: `第 ${iterationNumber} 轮迭代${result.completed ? '完成' : '未完成'}`,
      details: result
    })
  }
  
  startAgent(params: {
    agentId: string
    agentName: string
    agentRole: string
    iterationNumber: number
  }): AgentExecutionLog | null {
    if (!this.currentLog) return null
    
    const iteration = this.currentLog.iterations.find(
      i => i.iterationNumber === params.iterationNumber
    )
    if (!iteration) return null
    
    const agent: AgentExecutionLog = {
      agentId: params.agentId,
      agentName: params.agentName,
      agentRole: params.agentRole,
      startTime: Date.now(),
      phases: {},
      outputs: {
        files: [],
        messages: [],
        artifacts: []
      },
      status: 'running'
    }
    
    iteration.agents.push(agent)
    
    this.addLog({
      type: 'agent_message',
      level: 'info',
      category: 'agent',
      message: `${params.agentName} 开始执行`,
      details: params
    })
    
    return agent
  }
  
  endAgent(agentId: string, status: 'completed' | 'failed', outputs?: {
    files?: string[]
    messages?: string[]
    artifacts?: string[]
  }): void {
    if (!this.currentLog) return
    
    for (const iteration of this.currentLog.iterations) {
      const agent = iteration.agents.find(a => a.agentId === agentId)
      if (agent) {
        agent.endTime = Date.now()
        agent.duration = agent.endTime - agent.startTime
        agent.status = status
        if (outputs) {
          agent.outputs = { ...agent.outputs, ...outputs }
        }
        break
      }
    }
    
    this.addLog({
      type: 'agent_message',
      level: status === 'completed' ? 'success' : 'error',
      category: 'agent',
      message: `智能体 ${agentId} ${status === 'completed' ? '完成' : '失败'}`,
      details: { agentId, status, outputs }
    })
  }
  
  logReActTrace(trace: ReActTraceLog, agentId?: string): void {
    if (!this.currentLog) return
    
    this.currentLog.summary.totalSteps += trace.steps.length
    this.currentLog.summary.totalLLMCalls += trace.steps.filter(
      s => s.llmCall
    ).length
    
    if (trace.success) {
      this.currentLog.summary.totalTokens += trace.steps.reduce(
        (sum, s) => sum + (s.llmCall?.totalTokens || 0), 0
      )
    }
    
    for (const step of trace.steps) {
      this.logReActStep(step, agentId)
    }
  }
  
  logReActStep(step: ReActStepLog, agentId?: string): void {
    if (!this.currentLog) return
    
    const entry: TaskLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: step.timestamp,
      type: step.type as TaskLogType,
      level: step.observe?.success === false ? 'error' : 'info',
      category: agentId ? `agent:${agentId}` : 'react',
      message: this.formatStepMessage(step),
      details: {
        stepId: step.stepId,
        stepNumber: step.stepNumber,
        think: step.think,
        act: step.act,
        observe: step.observe,
        llmCall: step.llmCall
      },
      duration: step.duration,
      parentStepId: agentId
    }
    
    this.addLog(entry)
    
    if (step.act) {
      this.currentLog.summary.totalToolCalls++
    }
  }
  
  private formatStepMessage(step: ReActStepLog): string {
    switch (step.type) {
      case 'think':
        return `思考: ${step.think?.reasoning?.slice(0, 100) || ''}`
      case 'act':
        return `行动: ${step.act?.tool}(${JSON.stringify(step.act?.parameters || {}).slice(0, 50)})`
      case 'observe':
        return `观察: ${step.observe?.success ? '成功' : '失败'} - ${String(step.observe?.result || '').slice(0, 100)}`
      case 'final':
        return `最终答案: ${String(step.think?.reasoning || '').slice(0, 100)}`
      default:
        return `步骤 ${step.stepNumber}`
    }
  }
  
  logToolCall(params: {
    tool: string
    parameters: any
    result?: any
    error?: string
    duration?: number
  }): void {
    if (!this.currentLog) return
    
    this.currentLog.summary.totalToolCalls++
    
    this.addLog({
      type: params.error ? 'error' : 'tool_result',
      level: params.error ? 'error' : 'success',
      category: 'tool',
      message: `工具调用: ${params.tool}`,
      details: {
        tool: params.tool,
        parameters: params.parameters,
        result: params.result,
        error: params.error
      },
      duration: params.duration
    })
  }
  
  logLLMCall(params: {
    model: string
    promptTokens?: number
    completionTokens?: number
    latency: number
    success: boolean
    error?: string
  }): void {
    if (!this.currentLog) return
    
    this.currentLog.summary.totalLLMCalls++
    this.currentLog.summary.totalTokens += (params.promptTokens || 0) + (params.completionTokens || 0)
    
    this.addLog({
      type: params.success ? 'llm_response' : 'error',
      level: params.success ? 'success' : 'error',
      category: 'llm',
      message: `LLM调用: ${params.model} (${params.latency}ms)`,
      details: params,
      duration: params.latency
    })
  }
  
  logError(error: string, context?: any): void {
    if (!this.currentLog) return
    
    this.currentLog.summary.errorCount++
    
    this.addLog({
      type: 'error',
      level: 'error',
      category: 'error',
      message: error,
      details: context
    })
  }
  
  logRetry(params: {
    attempt: number
    maxAttempts: number
    reason: string
    delay?: number
  }): void {
    if (!this.currentLog) return
    
    this.currentLog.summary.retryCount++
    
    this.addLog({
      type: 'retry',
      level: 'warning',
      category: 'retry',
      message: `重试 (${params.attempt}/${params.maxAttempts}): ${params.reason}`,
      details: params
    })
  }
  
  logCorrection(params: {
    strategy: string
    reason: string
    success?: boolean
  }): void {
    if (!this.currentLog) return
    
    this.currentLog.summary.correctionCount++
    
    this.addLog({
      type: 'correction',
      level: params.success === false ? 'warning' : 'info',
      category: 'correction',
      message: `自我纠正: ${params.strategy}`,
      details: params
    })
  }
  
  endTask(status: 'completed' | 'failed' | 'cancelled'): TaskExecutionLog | null {
    if (!this.currentLog) return null
    
    this.currentLog.endTime = Date.now()
    this.currentLog.totalDuration = this.currentLog.endTime - this.currentLog.startTime
    this.currentLog.status = status
    this.currentLog.logs = this.logEntries
    
    this.addLog({
      type: 'task_end',
      level: status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'warning',
      category: 'task',
      message: `任务${status === 'completed' ? '完成' : status === 'failed' ? '失败' : '取消'}`,
      details: {
        totalDuration: this.currentLog.totalDuration,
        summary: this.currentLog.summary
      }
    })
    
    this.saveLog(this.currentLog)
    
    const log = this.currentLog
    this.currentLog = null
    this.logEntries = []
    
    return log
  }
  
  private addLog(entry: Omit<TaskLogEntry, 'id' | 'timestamp'> & { timestamp?: number }): void {
    const fullEntry: TaskLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: entry.timestamp || Date.now(),
      ...entry
    }
    
    this.logEntries.push(fullEntry)
    
    if (this.currentLog) {
      this.currentLog.logs = [...this.logEntries]
    }
  }
  
  getCurrentLog(): TaskExecutionLog | null {
    return this.currentLog
  }
  
  async saveLog(log: TaskExecutionLog): Promise<void> {
    const logPath = path.join(this.logsDir, `${log.taskId}.json`)
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8')
  }
  
  async loadLog(taskId: string): Promise<TaskExecutionLog | null> {
    const logPath = path.join(this.logsDir, `${taskId}.json`)
    if (!fs.existsSync(logPath)) return null
    
    try {
      const content = fs.readFileSync(logPath, 'utf8')
      return JSON.parse(content) as TaskExecutionLog
    } catch {
      return null
    }
  }
  
  async listLogs(limit: number = 50): Promise<TaskExecutionLog[]> {
    if (!fs.existsSync(this.logsDir)) return []
    
    const files = fs.readdirSync(this.logsDir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(this.logsDir, a))
        const statB = fs.statSync(path.join(this.logsDir, b))
        return statB.mtimeMs - statA.mtimeMs
      })
      .slice(0, limit)
    
    const logs: TaskExecutionLog[] = []
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.logsDir, file), 'utf8')
        logs.push(JSON.parse(content) as TaskExecutionLog)
      } catch {
      }
    }
    
    return logs
  }
  
  async deleteLog(taskId: string): Promise<void> {
    const logPath = path.join(this.logsDir, `${taskId}.json`)
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath)
    }
  }
  
  async searchLogs(query: string): Promise<TaskExecutionLog[]> {
    const logs = await this.listLogs(100)
    const lowerQuery = query.toLowerCase()
    
    return logs.filter(log => 
      log.projectName.toLowerCase().includes(lowerQuery) ||
      log.originalInstruction.toLowerCase().includes(lowerQuery) ||
      log.logs.some(l => l.message.toLowerCase().includes(lowerQuery))
    )
  }
  
  getLogStats(): {
    totalLogs: number
    totalSize: number
    oldestLog?: Date
    newestLog?: Date
  } {
    if (!fs.existsSync(this.logsDir)) {
      return { totalLogs: 0, totalSize: 0 }
    }
    
    const files = fs.readdirSync(this.logsDir).filter(f => f.endsWith('.json'))
    let totalSize = 0
    let oldestTime = Infinity
    let newestTime = 0
    
    for (const file of files) {
      const filePath = path.join(this.logsDir, file)
      const stat = fs.statSync(filePath)
      totalSize += stat.size
      
      if (stat.mtimeMs < oldestTime) oldestTime = stat.mtimeMs
      if (stat.mtimeMs > newestTime) newestTime = stat.mtimeMs
    }
    
    return {
      totalLogs: files.length,
      totalSize,
      oldestLog: oldestTime !== Infinity ? new Date(oldestTime) : undefined,
      newestLog: newestTime !== 0 ? new Date(newestTime) : undefined
    }
  }
}

export const taskLogger = new TaskLogger()
