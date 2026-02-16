import { Plan, PlanStep } from './Planner'
import { toolRegistry } from './ToolRegistry'
import { llmService } from '../services/LLMService'
import type { ToolContext } from './ToolRegistry'
import * as path from 'path'
import * as fs from 'fs'

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
  parameters?: any
  durationMs?: number
  artifacts?: any[]
  resultSummary?: string
  final?: boolean
  error?: string
  retryCount?: number
  maxRetries?: number
}

export class Executor {
  // 辅助函数：修正相对路径为绝对路径
  private fixPath(filePath: string, taskDir?: string): string {
    if (!filePath) return filePath
    
    // 如果已经是绝对路径，直接返回
    if (path.isAbsolute(filePath)) {
      return filePath
    }
    
    // 定义可能的根目录
    const possibleRoots = [
      '/Users/wangchao/Desktop/本地化TRAE',
      '/Users/wangchao/Desktop',
      process.cwd()
    ]
    
    // 如果有taskDir，优先使用
    if (taskDir) {
      const fullPath = path.join(taskDir, filePath)
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }
    
    // 尝试在可能的根目录下查找
    for (const root of possibleRoots) {
      const fullPath = path.join(root, filePath)
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }
    
    // 如果都找不到，返回原始路径（让工具报错更清晰）
    return filePath
  }
  
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

    for (const step of plan.steps) {
      if (ctx?.signal?.aborted) {
        return {
          success: false,
          stepResults,
          error: 'Task cancelled'
        }
      }
      console.log(`Executing step ${step.id}: ${step.description}`)
      onProgress?.({
        type: 'step_start',
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        parameters: step.parameters
      })
      
      const tool = toolRegistry.getTool(step.tool)
      if (!tool) {
        return {
          success: false,
          stepResults,
          error: `Tool not found: ${step.tool}`
        }
      }

      let currentParams = step.parameters ?? {}
      if (step.tool === 'read_image') {
        const p = (currentParams as any)?.path || (currentParams as any)?.filePath || (currentParams as any)?.filepath
        if (!p) {
          const inferred = getLatestImagePath()
          if (inferred) currentParams = { path: inferred }
        }
      }
      
      // 自动修正路径 - 对于需要路径的工具
      const pathTools = ['read_file', 'write_file', 'create_directory', 'list_files', 'glob_paths', 'execute_command']
      if (pathTools.includes(step.tool) && currentParams) {
        const taskDir = ctx?.taskDir
        const pathParamNames = ['path', 'filePath', 'filepath', 'directory', 'dir', 'file', 'targetPath', 'outputPath']
        
        for (const paramName of pathParamNames) {
          if ((currentParams as any)[paramName]) {
            const originalPath = (currentParams as any)[paramName]
            const fixedPath = this.fixPath(originalPath, taskDir)
            if (fixedPath !== originalPath) {
              console.log(`[Executor] Auto-fixed path: ${originalPath} -> ${fixedPath}`)
              ;(currentParams as any)[paramName] = fixedPath
            }
          }
        }
      }
      
      let success = false
      let errorMessage = ''
      const startedAt = Date.now()
      const maxRetries = 3

      // Initial execution attempt
      try {
        const result = await tool.handler(currentParams, ctx)
        if (result.error) {
          throw new Error(result.error)
        }
        stepResults[step.id] = result
        success = true
        console.log(`Step ${step.id} completed successfully`)
        let resultSummary: string | undefined
        if (step.tool === 'read_file' || step.tool === 'fetch_webpage') {
          resultSummary = undefined
        } else {
          resultSummary =
            typeof result.output === 'string' ? result.output.slice(0, 200)
            : typeof result.content === 'string' ? result.content.slice(0, 200)
            : typeof result.path === 'string' ? result.path
            : Array.isArray(result.matches) ? result.matches.slice(0, 3).join('\n')
            : Array.isArray(result.results) ? `${result.results.length} items`
            : undefined
        }
        onProgress?.({
          type: 'step_success',
          stepId: step.id,
          tool: step.tool,
          description: step.description,
          parameters: currentParams,
          durationMs: Date.now() - startedAt,
          artifacts: Array.isArray(result.artifacts) ? result.artifacts : undefined,
          resultSummary
        })
      } catch (error: any) {
        errorMessage = error.message
        console.warn(`Step ${step.id} failed: ${errorMessage}. Attempting auto-correction...`)
        onProgress?.({
          type: 'step_error',
          stepId: step.id,
          tool: step.tool,
          description: step.description,
          error: errorMessage,
          durationMs: Date.now() - startedAt,
          retryCount: 0,
          maxRetries,
          final: false
        })
      }

      // Retry loop with LLM correction
      if (!success) {
        let retryCount = 0

        while (retryCount < maxRetries) {
          if (ctx?.signal?.aborted) {
            return {
              success: false,
              stepResults,
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
          
          const fixedParams = await this.fixParameters(step, currentParams, errorMessage, model, ctx?.signal)
          if (!fixedParams) {
            console.warn(`LLM failed to suggest fixes for step ${step.id}`)
            break
          }

          try {
            console.log(`Retrying step ${step.id} with new parameters:`, JSON.stringify(fixedParams))
            const retryStartedAt = Date.now()
            const result = await tool.handler(fixedParams, ctx)
            if (result.error) {
              throw new Error(result.error)
            }
            stepResults[step.id] = result
            success = true
            console.log(`Step ${step.id} completed successfully after retry`)
            let resultSummary: string | undefined
            if (step.tool === 'read_file' || step.tool === 'fetch_webpage') {
              resultSummary = undefined
            } else {
              resultSummary =
                typeof result.output === 'string' ? result.output.slice(0, 200)
                : typeof result.content === 'string' ? result.content.slice(0, 200)
                : typeof result.path === 'string' ? result.path
                : Array.isArray(result.matches) ? result.matches.slice(0, 3).join('\n')
                : Array.isArray(result.results) ? `${result.results.length} items`
                : undefined
            }
            onProgress?.({
              type: 'step_success',
              stepId: step.id,
              tool: step.tool,
              description: step.description,
              parameters: fixedParams,
              durationMs: Date.now() - retryStartedAt,
              artifacts: Array.isArray(result.artifacts) ? result.artifacts : undefined,
              resultSummary
            })
            break
          } catch (error: any) {
            errorMessage = error.message
            currentParams = fixedParams // Use the fixed params as the base for next correction
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
          stepResults,
          error: `Step ${step.id} failed after retries: ${errorMessage}`
        }
      }
    }

    return {
      success: true,
      stepResults
    }
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
