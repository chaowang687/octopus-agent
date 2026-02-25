import { toolRegistry } from './ToolRegistry'
import { llmService } from '../services/LLMService'
import type { ToolContext } from './ToolRegistry'
import { enhancedReActEngine } from './EnhancedReActEngine'
import { VerificationEngine, type TaskVerificationContext } from './VerificationEngine'
import * as path from 'path'
import { PATHS } from '../config/paths'
import { config } from '../config/config'
import { ErrorHandler, ErrorCategory } from '../utils/ErrorHandler'

export interface PlanStep {
  id: string
  description: string
  tool: string
  parameters?: Record<string, any>
  acceptanceCriteria?: string[]
  expectedFiles?: string[]
  verified?: boolean
  verificationMessage?: string
}

export interface Plan {
  steps: PlanStep[]
}

export interface ExecutionResult {
  success: boolean
  stepResults: Record<string, any>
  error?: string
}

export interface ExecutionProgressEvent {
  type: 'step_start' | 'step_success' | 'step_error' | 'retry'
  stepId: string
  tool: string
  description: string
  parameters?: Record<string, any>
  durationMs?: number
  artifacts?: any[]
  resultSummary?: string
  final?: boolean
  error?: string
  retryCount?: number
  maxRetries?: number
}

export class Executor {
  // 验证引擎实例
  private verificationEngine: VerificationEngine
  // 执行结果缓存
  private executionCache: Map<string, any> = new Map()
  private cacheTimeout: Map<string, NodeJS.Timeout> = new Map()
  private cacheTTL: number = 3600000 // 缓存1小时
  
  constructor() {
    this.verificationEngine = new VerificationEngine()
  }
  
  private fixPath(filePath: string, taskDir?: string): string {
    if (!filePath) return filePath
    
    if (path.isAbsolute(filePath)) {
      return filePath
    }
    
    // 构建可能的路径列表
    const possiblePaths = []
    
    if (taskDir) {
      possiblePaths.push(path.join(taskDir, filePath))
    }
    
    possiblePaths.push(
      path.join(PATHS.PROJECT_ROOT, filePath),
      path.join(PATHS.DESKTOP, filePath),
      path.join(process.cwd(), filePath)
    )
    
    // 返回第一个可能的路径，不进行文件系统检查
    // 工具执行时会处理路径不存在的情况
    return possiblePaths[0] || filePath
  }
  
/**
 * 执行计划
 * @param plan 执行计划
 * @param model 使用的LLM模型
 * @param ctx 工具上下文
 * @param onProgress 进度回调
 * @returns 执行结果
 */
  async executePlan(
    plan: Plan,
    model: string = 'openai',
    ctx?: ToolContext,
    onProgress?: (evt: ExecutionProgressEvent) => void
  ): Promise<ExecutionResult> {
    const stepResults: Record<string, any> = {}
    const getLatestImagePath = () => {
      for (const v of Object.values(stepResults).reverse()) {
        const artifacts = (v as any)?.artifacts
        if (Array.isArray(artifacts)) {
          const img = artifacts.find((a: any) => a?.type === 'image' && typeof a?.path === 'string')
          if (img?.path) return img.path as string
        }
        if (typeof (v as any)?.path === 'string') return (v as any).path as string
      }
      return undefined
    }

    // 预加载所有工具，减少重复调用
    const stepsWithTools = this.preloadTools(plan)

    // 检查所有工具是否存在
    const validationError = this.validateTools(stepsWithTools)
    if (validationError) {
      return {
        success: false,
        stepResults,
        error: validationError
      }
    }

    for (const { step, tool } of stepsWithTools) {
      if (ctx?.signal?.aborted) {
        return {
          success: false,
          stepResults,
          error: 'Task cancelled'
        }
      }
      
      // 处理参数
      let currentParams = this.processParameters(step, step.parameters ?? {}, getLatestImagePath, ctx?.taskDir)
      
      // 智能工具选择
      let selectedTool = tool
      let selectedToolName = step.tool


      
      try {
        const toolSelection = await this.selectBestTool(step, currentParams)
        if (toolSelection && toolSelection.confidence > 0.6) {
          const bestTool = toolRegistry.getTool(toolSelection.toolName)
          if (bestTool) {
            selectedTool = bestTool
            selectedToolName = toolSelection.toolName
            console.log(`[Executor] Switched to better tool for step ${step.id}: ${selectedToolName} (confidence: ${toolSelection.confidence})`)
            console.log(`[Executor] Reasoning: ${toolSelection.reasoning}`)
          }
        }
      } catch (selectionError) {
        console.error('[Executor] Smart tool selection failed, using original tool:', selectionError)
      }
      
      console.log(`Executing step ${step.id}: ${step.description}`)
      onProgress?.({
        type: 'step_start',
        stepId: step.id,
        tool: selectedToolName,
        description: step.description,
        parameters: currentParams
      })

      // 执行步骤
      const executionResult = await this.executeStep(
        { ...step, tool: selectedToolName },
        selectedTool,
        currentParams,
        model,
        ctx,
        onProgress
      )
      
      if (!executionResult.success) {
        // 检查是否可以跳过当前步骤
        if (this.canSkipStep(step)) {
          console.warn(`Skipping failed step ${step.id} and continuing execution`)
          stepResults[step.id] = {
            skipped: true,
            error: executionResult.error
          }
          // 继续执行下一个步骤
          continue
        }
        
        return {
          success: false,
          stepResults,
          error: executionResult.error
        }
      }
      
      stepResults[step.id] = executionResult.result
      
      // ========== 步骤执行后验证 ==========
      // 如果步骤有验收标准，执行验证
      if (step.acceptanceCriteria && step.acceptanceCriteria.length > 0) {
        console.log(`[Executor] Verifying step ${step.id} with ${step.acceptanceCriteria.length} acceptance criteria`)
        
        // 获取项目路径
        const projectPath = ctx?.taskDir || PATHS.PROJECT_ROOT
        
        // 构建验证上下文
        const verificationContext: TaskVerificationContext = {
          taskId: step.id,
          taskDescription: step.description,
          acceptanceCriteria: step.acceptanceCriteria,
          createdFiles: step.expectedFiles || this.extractFilesFromResult(executionResult.result),
          projectPath
        }
        
        // 执行验证
        const verificationResult = await this.verificationEngine.verifyTask(verificationContext)
        
        // 更新步骤验证状态
        step.verified = verificationResult.success
        step.verificationMessage = verificationResult.message
        
        // 触发验证进度事件
        onProgress?.({
          type: verificationResult.success ? 'step_success' : 'step_error',
          stepId: step.id,
          tool: 'verification',
          description: `Verification for step ${step.id}`,
          resultSummary: verificationResult.message,
          final: false
        })
        
        // 如果验证失败，记录警告但继续执行（可以根据需求改为失败）
        if (!verificationResult.success) {
          console.warn(`[Executor] Step ${step.id} verification warnings:`, verificationResult.warnings)
        }
      }
    }

    return {
      success: true,
      stepResults
    }
  }

  /**
   * 预加载所有工具
   * @param plan 执行计划
   * @returns 带有工具的步骤列表
   */
  private preloadTools(plan: Plan) {
    return plan.steps.map(step => {
      const tool = toolRegistry.getTool(step.tool)
      return {
        step,
        tool
      }
    })
  }

  /**
   * 智能工具选择
   * @param step 执行步骤
   * @param params 执行参数
   * @param ctx 工具上下文
   * @returns 最佳工具信息
   */
  private async selectBestTool(
    step: PlanStep,
    params: any
  ): Promise<{ toolName: string; reasoning: string; confidence: number } | null> {
    try {
      // 获取所有可用工具
      const availableTools = toolRegistry.getAllTools().map(t => t.name)
      
      // 如果没有可用工具，返回null
      if (availableTools.length === 0) {
        return null
      }
      
      // 构建任务描述
      const taskDescription = `${step.description}: ${JSON.stringify(params)}`
      
      // 使用EnhancedReActEngine的智能工具选择
      const toolSelection = await enhancedReActEngine.selectBestTool(
        taskDescription,
        availableTools
      )
      
      console.log(`[Executor] Smart tool selection for step ${step.id}:`, toolSelection)
      
      return {
        toolName: toolSelection.tool,
        reasoning: toolSelection.reasoning,
        confidence: toolSelection.confidence
      }
    } catch (error) {
      console.error('[Executor] Smart tool selection failed:', error)
      return null
    }
  }

  /**
   * 验证工具是否存在
   * @param stepsWithTools 带有工具的步骤列表
   * @returns 错误信息，如果所有工具都存在则返回null
   */
  private validateTools(stepsWithTools: Array<{ step: PlanStep, tool: any }>) {
    for (const { step, tool } of stepsWithTools) {
      if (!tool) {
        return `Tool not found: ${step.tool}`
      }
    }
    return null
  }

  /**
   * 处理参数
   * @param step 执行步骤
   * @param params 原始参数
   * @param getLatestImagePath 获取最新图片路径的函数
   * @param taskDir 任务目录
   * @returns 处理后的参数
   */
  private processParameters(
    step: PlanStep,
    params: any,
    getLatestImagePath: () => string | undefined,
    taskDir?: string
  ) {
    let currentParams = params
    
    // 处理图片路径推断
    if (step.tool === 'read_image') {
      const p = currentParams?.path || currentParams?.filePath || currentParams?.filepath
      if (!p) {
        const inferred = getLatestImagePath()
        if (inferred) currentParams = { path: inferred }
      }
    }
    
    // 自动修正路径 - 对于需要路径的工具
    const pathTools = ['read_file', 'write_file', 'create_directory', 'list_files', 'glob_paths', 'execute_command']
    if (pathTools.includes(step.tool) && currentParams) {
      const pathParamNames = ['path', 'filePath', 'filepath', 'directory', 'dir', 'file', 'targetPath', 'outputPath']
      
      for (const paramName of pathParamNames) {
        if (currentParams[paramName]) {
          const originalPath = currentParams[paramName]
          const fixedPath = this.fixPath(originalPath, taskDir)
          if (fixedPath !== originalPath) {
            console.log(`[Executor] Auto-fixed path: ${originalPath} -> ${fixedPath}`)
            currentParams[paramName] = fixedPath
          }
        }
      }
      
      // 对于执行命令的工具，进行安全检查
      if (step.tool === 'execute_command' && config.execution.commandSafetyCheckEnabled) {
        const command = currentParams.command
        if (command && this.isUnsafeCommand(command)) {
          const appError = ErrorHandler.createError(
            `Unsafe command detected: ${command}`,
            ErrorCategory.PERMISSION,
            ErrorHandler.determineSeverity({ message: 'Unsafe command detected' }),
            {
              component: 'Executor',
              operation: 'execute_command',
              stepId: step.id,
              tool: step.tool
            }
          )
          throw appError
        }
      }
    }
    
    return currentParams
  }

  /**
   * 执行单个步骤
   * @param step 执行步骤
   * @param tool 工具
   * @param params 参数
   * @param model 使用的LLM模型
   * @param ctx 工具上下文
   * @param onProgress 进度回调
   * @returns 执行结果
   */
  private async executeStep(
    step: PlanStep,
    tool: any,
    params: any,
    model: string,
    ctx?: ToolContext,
    onProgress?: (evt: ExecutionProgressEvent) => void
  ): Promise<{ success: boolean, result?: any, error?: string }> {
    let success = false
    let errorMessage = ''
    let executionResult: any = null
    const startedAt = Date.now()
    // 根据错误类型动态调整重试次数
    const maxRetries = this.getMaxRetries(step.tool, errorMessage)

    // 检查缓存
    const cachedResult = this.getCachedResult(step.tool, params)
    if (cachedResult) {
      console.log(`Using cached result for step ${step.id}`)
      success = true
      executionResult = cachedResult
      
      onProgress?.({
        type: 'step_success',
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        parameters: params,
        durationMs: 0, // 缓存结果，没有执行时间
        artifacts: Array.isArray(cachedResult.artifacts) ? cachedResult.artifacts : undefined,
        resultSummary: this.generateResultSummary(step.tool, cachedResult)
      })
    } else {
      // Initial execution attempt
      const initialResult = await this.executeToolInitialAttempt(
        step,
        tool,
        params,
        ctx,
        startedAt,
        maxRetries,
        onProgress
      )
      
      success = initialResult.success
      errorMessage = initialResult.error || ''
      executionResult = initialResult.result
    }

    // Retry loop with LLM correction
    if (!success) {
      const retryResult = await this.retryWithLLMCorrection(
        step,
        tool,
        params,
        errorMessage,
        model,
        maxRetries,
        ctx,
        onProgress
      )
      
      success = retryResult.success
      errorMessage = retryResult.error || ''
      executionResult = retryResult.result
    }

    if (!success) {
      onProgress?.({
        type: 'step_error',
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        error: errorMessage,
        retryCount: maxRetries,
        maxRetries,
        final: true
      })
      
      return {
        success: false,
        error: `Step ${step.id} failed after retries: ${errorMessage}`
      }
    }

    return {
      success: true,
      result: executionResult
    }
  }

  /**
   * 执行工具的初始尝试
   * @param step 执行步骤
   * @param tool 工具
   * @param params 参数
   * @param ctx 工具上下文
   * @param startedAt 开始时间
   * @param maxRetries 最大重试次数
   * @param onProgress 进度回调
   * @returns 执行结果
   */
  private async executeToolInitialAttempt(
    step: PlanStep,
    tool: any,
    params: any,
    ctx?: ToolContext,
    startedAt?: number,
    maxRetries?: number,
    onProgress?: (evt: ExecutionProgressEvent) => void
  ): Promise<{ success: boolean, result?: any, error?: string }> {
    try {
      const result = await tool.handler(params, ctx)
      if (result.error) {
        const appError = ErrorHandler.createError(
          result.error || `Tool ${step.tool} execution failed`,
          ErrorCategory.TOOL_EXECUTION,
          ErrorHandler.determineSeverity({ message: result.error || 'Tool execution failed' }),
          {
            component: 'Executor',
            operation: `execute_${step.tool}`,
            stepId: step.id,
            tool: step.tool
          }
        )
        throw appError
      }
      
      // 存储结果到缓存
      this.setCachedResult(step.tool, params, result)
      
      console.log(`Step ${step.id} completed successfully`)
      onProgress?.({
        type: 'step_success',
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        parameters: params,
        durationMs: Date.now() - (startedAt || Date.now()),
        artifacts: Array.isArray(result.artifacts) ? result.artifacts : undefined,
        resultSummary: this.generateResultSummary(step.tool, result)
      })
      
      return {
        success: true,
        result
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleError(error, {
        component: 'Executor',
        operation: `execute_${step.tool}`,
        stepId: step.id,
        tool: step.tool
      })
      const errorMessage = appError.message
      console.warn(`Step ${step.id} failed: ${errorMessage}. Attempting auto-correction...`)
      
      // 检查是否是超时错误，如果是，对于某些命令可能需要增加超时时间
      const isTimeoutError = errorMessage.includes('timed out') || errorMessage.includes('timeout')
      const isLongRunningCommand = step.tool === 'execute_command' && 
        (params.command?.includes('npm install') || 
         params.command?.includes('npm run build') ||
         params.command?.includes('yarn install'))
      
      // 对于长时间运行的命令超时，增加超时时间并重试，不使用LLM修正
      if (isTimeoutError && isLongRunningCommand) {
        return await this.retryLongRunningCommand(
          step,
          tool,
          params,
          ctx,
          startedAt || Date.now(),
          maxRetries || 3,
          onProgress
        )
      } else {
        // 其他错误，使用LLM修正
        onProgress?.({
          type: 'step_error',
          stepId: step.id,
          tool: step.tool,
          description: step.description,
          error: errorMessage,
          durationMs: Date.now() - (startedAt || Date.now()),
          retryCount: 0,
          maxRetries: maxRetries || 3,
          final: false
        })
        
        return {
          success: false,
          error: errorMessage
        }
      }
    }
  }

  /**
   * 重试长时间运行的命令
   * @param step 执行步骤
   * @param tool 工具
   * @param params 参数
   * @param errorMessage 错误信息
   * @param ctx 工具上下文
   * @param startedAt 开始时间
   * @param maxRetries 最大重试次数
   * @param onProgress 进度回调
   * @returns 执行结果
   */
  private async retryLongRunningCommand(
    step: PlanStep,
    tool: any,
    params: any,
    ctx?: ToolContext,
    startedAt?: number,
    maxRetries?: number,
    onProgress?: (evt: ExecutionProgressEvent) => void
  ): Promise<{ success: boolean, result?: any, error?: string }> {
    console.log(`Detected timeout for long-running command, increasing timeout...`)
    const increasedTimeout = config.execution.longRunningCommandTimeout // 从配置中获取长时间运行命令的超时时间
    params.timeout = increasedTimeout
    
    try {
      console.log(`Retrying step ${step.id} with increased timeout: ${increasedTimeout}ms`)
      const retryStartedAt = Date.now()
      const result = await tool.handler(params, ctx)
      if (result.error) {
        throw new Error(result.error || `Tool ${step.tool} execution failed with increased timeout`)
      }
      
      // 存储结果到缓存
      this.setCachedResult(step.tool, params, result)
      
      console.log(`Step ${step.id} completed successfully with increased timeout`)
      onProgress?.({
        type: 'step_success',
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        parameters: params,
        durationMs: Date.now() - retryStartedAt,
        artifacts: Array.isArray(result.artifacts) ? result.artifacts : undefined,
        resultSummary: this.generateResultSummary(step.tool, result)
      })
      
      return {
        success: true,
        result
      }
    } catch (retryError: any) {
      const newErrorMessage = retryError.message || `Unknown error executing ${step.tool} with increased timeout`
      console.warn(`Step ${step.id} failed even with increased timeout: ${newErrorMessage}`)
      onProgress?.({
        type: 'step_error',
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        error: newErrorMessage,
        durationMs: Date.now() - (startedAt || Date.now()),
        retryCount: 0,
        maxRetries: maxRetries || 3,
        final: false
      })
      
      return {
        success: false,
        error: newErrorMessage
      }
    }
  }

  /**
   * 使用LLM修正进行重试
   * @param step 执行步骤
   * @param tool 工具
   * @param params 参数
   * @param errorMessage 错误信息
   * @param model 使用的LLM模型
   * @param maxRetries 最大重试次数
   * @param ctx 工具上下文
   * @param onProgress 进度回调
   * @returns 执行结果
   */
  private async retryWithLLMCorrection(
    step: PlanStep,
    tool: any,
    params: any,
    errorMessage: string,
    model: string,
    maxRetries: number,
    ctx?: ToolContext,
    onProgress?: (evt: ExecutionProgressEvent) => void
  ): Promise<{ success: boolean, result?: any, error?: string }> {
    let retryCount = 0

    while (retryCount < maxRetries) {
      if (ctx?.signal?.aborted) {
        return {
          success: false,
          error: 'Task cancelled'
        }
      }
      console.log(`Retry attempt ${retryCount + 1}/${maxRetries} for step ${step.id}`)
      onProgress?.({
        type: 'retry',
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        retryCount: retryCount + 1,
        maxRetries
      })
      
      const fixedParams = await this.fixParameters(step, params, errorMessage, model, ctx?.signal)
      if (!fixedParams) {
        console.warn(`LLM failed to suggest fixes for step ${step.id}`)
        errorMessage = `LLM failed to suggest fixes for step ${step.id}. Original error: ${errorMessage}`
        break
      }

      // 检查缓存
      const cachedResult = this.getCachedResult(step.tool, fixedParams)
      if (cachedResult) {
        console.log(`Using cached result for retry step ${step.id}`)
        onProgress?.({
          type: 'step_success',
          stepId: step.id,
          tool: step.tool,
          description: step.description,
          parameters: fixedParams,
          durationMs: 0, // 缓存结果，没有执行时间
          artifacts: Array.isArray(cachedResult.artifacts) ? cachedResult.artifacts : undefined,
          resultSummary: this.generateResultSummary(step.tool, cachedResult)
        })
        
        return {
          success: true,
          result: cachedResult
        }
      } else {
        try {
          console.log(`Retrying step ${step.id} with new parameters:`, JSON.stringify(fixedParams))
          const retryStartedAt = Date.now()
          const result = await tool.handler(fixedParams, ctx)
          if (result.error) {
            throw new Error(result.error || `Tool ${step.tool} execution failed after retry`)
          }
          
          // 存储结果到缓存
          this.setCachedResult(step.tool, fixedParams, result)
          
          console.log(`Step ${step.id} completed successfully after retry`)
          onProgress?.({
            type: 'step_success',
            stepId: step.id,
            tool: step.tool,
            description: step.description,
            parameters: fixedParams,
            durationMs: Date.now() - retryStartedAt,
            artifacts: Array.isArray(result.artifacts) ? result.artifacts : undefined,
            resultSummary: this.generateResultSummary(step.tool, result)
          })
          
          return {
            success: true,
            result
          }
        } catch (error: any) {
          errorMessage = error.message || `Unknown error executing ${step.tool} after retry`
          params = fixedParams // Use the fixed params as the base for next correction
          retryCount++
          onProgress?.({
            type: 'step_error',
            stepId: step.id,
            tool: step.tool,
            description: step.description,
            error: errorMessage,
            retryCount,
            maxRetries,
            final: false
          })
        }
      }
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }

  /**
   * 生成结果摘要
   * @param tool 工具类型
   * @param result 执行结果
   * @returns 结果摘要
   */
  private generateResultSummary(tool: string, result: any): string | undefined {
    if (tool === 'read_file' || tool === 'fetch_webpage') {
      return undefined
    } else {
      return typeof result.output === 'string' ? result.output.slice(0, 200)
        : typeof result.content === 'string' ? result.content.slice(0, 200)
        : typeof result.path === 'string' ? result.path
        : Array.isArray(result.matches) ? result.matches.slice(0, 3).join('\n')
        : Array.isArray(result.results) ? `${result.results.length} items`
        : undefined
    }
  }

  private isUnsafeCommand(command: string): boolean {
    // 检查命令是否包含危险操作
    const dangerousPatterns = [
      /rm\s+-rf/, // 危险的删除操作
      /sudo/, // 提升权限
      /chmod/, // 修改权限
      /chown/, // 修改所有者
      /<|>|&|;|\|/ // 重定向和管道
    ]
    
    return dangerousPatterns.some(pattern => pattern.test(command))
  }

  private getMaxRetries(tool: string, errorMessage: string): number {
    // 基础重试次数
    let baseRetries = config.execution.maxRetries
    
    // 根据工具类型调整重试次数
    const toolRetryMap: Record<string, number> = {
      'execute_command': 2, // 命令执行失败重试次数较少
      'fetch_webpage': 4, // 网络请求可以多重试几次
      'read_file': 1, // 文件读取失败通常是路径问题，重试意义不大
      'write_file': 1, // 文件写入失败通常是权限问题，重试意义不大
    }
    
    if (toolRetryMap[tool]) {
      baseRetries = toolRetryMap[tool]
    }
    
    // 根据错误类型调整重试次数
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      baseRetries += 1 // 超时错误可以多重试一次
    }
    
    return baseRetries
  }

  // 生成缓存键
  private generateCacheKey(tool: string, params: any): string {
    return `${tool}:${JSON.stringify(params)}`
  }

  // 检查缓存
  private getCachedResult(tool: string, params: any): any | null {
    if (!config.execution.toolExecutionCacheEnabled) return null
    
    const cacheKey = this.generateCacheKey(tool, params)
    return this.executionCache.get(cacheKey) || null
  }

  // 存储缓存
  private setCachedResult(tool: string, params: any, result: any): void {
    if (!config.execution.toolExecutionCacheEnabled) return
    
    const cacheKey = this.generateCacheKey(tool, params)
    this.executionCache.set(cacheKey, result)
    
    // 设置缓存过期
    if (this.cacheTimeout.has(cacheKey)) {
      clearTimeout(this.cacheTimeout.get(cacheKey))
    }
    
    const timeout = setTimeout(() => {
      this.executionCache.delete(cacheKey)
      this.cacheTimeout.delete(cacheKey)
      console.log(`[Executor] Cache expired for key: ${cacheKey}`)
    }, this.cacheTTL)
    
    this.cacheTimeout.set(cacheKey, timeout)
  }

  // 清除缓存
  public clearCache(): void {
    this.executionCache.clear()
    
    // 清除所有缓存过期定时器
    for (const timeout of this.cacheTimeout.values()) {
      clearTimeout(timeout)
    }
    this.cacheTimeout.clear()
  }

  // 获取缓存大小
  public getCacheSize(): number {
    return this.executionCache.size
  }

  // 判断是否可以跳过当前步骤
  private canSkipStep(step: PlanStep): boolean {
    // 基于工具类型判断是否可以跳过
    const skippableTools = [
      'read_file', // 读取文件失败可以跳过
      'fetch_webpage', // 网页获取失败可以跳过
      'list_files', // 列出文件失败可以跳过
      'glob_paths', // 路径匹配失败可以跳过
      'execute_command' // 命令执行失败可以跳过
    ]
    
    // 基于步骤描述判断是否可以跳过
    const skippableKeywords = [
      'check', // 检查操作可以跳过
      'verify', // 验证操作可以跳过
      'list', // 列表操作可以跳过
      'get', // 获取操作可以跳过
      'fetch', // 获取操作可以跳过
      'read' // 读取操作可以跳过
    ]
    
    // 检查工具类型是否可跳过
    if (skippableTools.includes(step.tool)) {
      return true
    }
    
    // 检查步骤描述是否包含可跳过的关键词
    const stepDescriptionLower = step.description.toLowerCase()
    if (skippableKeywords.some(keyword => stepDescriptionLower.includes(keyword))) {
      return true
    }
    
    // 默认不可跳过
    return false
  }

  /**
   * 从执行结果中提取创建的文件列表
   * @param result 执行结果
   * @returns 文件路径列表
   */
  private extractFilesFromResult(result: any): string[] {
    const files: string[] = []
    
    if (!result) return files
    
    // 1. 检查 result.path (单个文件路径)
    if (typeof result.path === 'string') {
      files.push(result.path)
    }
    
    // 2. 检查 result.filePath
    if (typeof result.filePath === 'string') {
      files.push(result.filePath)
    }
    
    // 3. 检查 result.files (文件数组)
    if (Array.isArray(result.files)) {
      for (const f of result.files) {
        if (typeof f === 'string') {
          files.push(f)
        } else if (f?.path) {
          files.push(f.path)
        }
      }
    }
    
    // 4. 检查 result.artifacts
    if (Array.isArray(result.artifacts)) {
      for (const a of result.artifacts) {
        if (a?.path) {
          files.push(a.path)
        }
      }
    }
    
    // 5. 检查 result.outputPath
    if (typeof result.outputPath === 'string') {
      files.push(result.outputPath)
    }
    
    return [...new Set(files)] // 去重
  }

  private async fixParameters(step: PlanStep, currentParams: any, error: string, model: string, signal?: AbortSignal): Promise<any> {
    const toolDef = toolRegistry.getTool(step.tool)
    if (!toolDef) return null

    const prompt = `
The execution of tool '${step.tool}' failed.
Description: ${step.description}
Current Parameters: ${JSON.stringify(currentParams)}
Error Message: ${error}

Tool Definition:
${JSON.stringify(toolDef.parameters)}

Please analyze the error and provide corrected parameters for this tool call.
Output ONLY the JSON object for the parameters.
`

    const response = await llmService.chat(model, [
      { role: 'system', content: 'You are an expert debugger. Fix the tool parameters based on the error.' },
      { role: 'user', content: prompt }
    ], { signal })

    if (response.success && response.content) {
      try {
        const jsonStr = response.content.replace(/```json|\n```/g, '').replace(/```/g, '').trim()
        return JSON.parse(jsonStr)
      } catch (e) {
        console.error('Failed to parse fixed parameters', e)
      }
    }
    return null
  }
}

export const executor = new Executor()
