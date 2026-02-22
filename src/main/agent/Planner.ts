import { llmService, LLMMessage } from '../services/LLMService'

import { PATHS } from '../config/paths'
import { toolRegistry } from './ToolRegistry'

// ============================================
// 执行步骤状态枚举
// ============================================
export enum StepStatus {
  PENDING = 'pending',         // 待执行
  RUNNING = 'running',         // 执行中
  PAUSED = 'paused',          // 暂停等待用户确认
  COMPLETED = 'completed',    // 已完成
  FAILED = 'failed',          // 执行失败
  SKIPPED = 'skipped'         // 已跳过
}

// ============================================
// 增强的执行步骤接口 - 支持人机协同
// ============================================
export interface PlanStep {
  id: string
  tool: string
  parameters: any
  description: string
  
  // 状态管理
  status: StepStatus
  
  // 验收标准 - 用于验证任务是否真正完成
  acceptanceCriteria?: string[]
  
  // 预期创建的文件
  expectedFiles?: string[]
  
  // 决策解释
  reasoning?: string          // 此步骤的选择理由
  alternatives?: string[]     // 考虑的替代方案
  
  // 依赖关系（DAG）
  dependsOn?: string[]       // 依赖的步骤ID
  
  // 可编辑参数（用户可修改）
  editableParams?: {
    targetFiles?: string[]
    codeSnippet?: string
    instruction?: string
    command?: string
  }
  
  // 执行结果
  result?: any
  error?: string
  startTime?: number
  endTime?: number
  
  // 验证结果
  verified?: boolean
  verificationMessage?: string
}

// ============================================
// 增强的执行计划接口
// ============================================
export interface Plan {
  planId: string
  originalGoal: string       // 原始任务目标
  steps: PlanStep[]
  reasoning: string
  
  // 执行控制
  currentStepId: string | null
  autoExecute: boolean        // 是否自动执行
  
  // 元数据
  createdAt: number
  updatedAt: number
  
  // 整体决策解释
  decisionRationale?: string // 整体规划的理由
  alternativesConsidered?: string[] // 考虑过的替代方案
}

export class Planner {
  private planCache: Map<string, { plan: Plan; timestamp: number }> = new Map()
  private cacheMaxAge = 3600000 // 缓存1小时

  private generateCacheKey(instruction: string, model: string): string {
    return `${model}:${instruction.trim().toLowerCase().slice(0, 500)}`
  }

  private getCachedPlan(instruction: string, model: string): Plan | null {
    const key = this.generateCacheKey(instruction, model)
    const cached = this.planCache.get(key)
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheMaxAge) {
      console.log('[Planner] Using cached plan')
      return cached.plan
    }
    
    return null
  }

  private setCachedPlan(instruction: string, model: string, plan: Plan): void {
    const key = this.generateCacheKey(instruction, model)
    this.planCache.set(key, { plan, timestamp: Date.now() })
    
    // 限制缓存大小
    if (this.planCache.size > 50) {
      const oldestKey = Array.from(this.planCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0]
      if (oldestKey) {
        this.planCache.delete(oldestKey)
      }
    }
  }

  async createPlan(instruction: string, history: LLMMessage[] = [], model: string = 'openai', options: any = {}): Promise<Plan> {

    // 检查缓存
    if (instruction) {
      const cachedPlan = this.getCachedPlan(instruction, model)
      if (cachedPlan) {
        return cachedPlan
      }
    }
    
    // 获取任务目录
    const taskDir = options?.taskDir || PATHS.DESKTOP
    console.log('[Planner] 使用任务目录:', taskDir)
    
    const fullToolsDescription = toolRegistry.getToolsDescription()
    const toolsDescription = fullToolsDescription.length > 5000
      ? `${fullToolsDescription.slice(0, 5000)}\n... (tools list truncated for length)`
      : fullToolsDescription
    
    const systemPrompt = `You are a task PLANNER. Your job is to create a detailed JSON plan with MULTIPLE steps.

Environment: macOS, ${taskDir}

Available tools:
${toolsDescription}

CRITICAL REQUIREMENTS:
1. ALWAYS create at least 3-5 steps for a typical development task
2. Steps should be ordered logically (create directories first, then files, then install dependencies, then run)
3. NEVER create only 1 step - that is too simplistic
4. ALWAYS include: create project folder → create source files → install dependencies → verify with command
5. ALWAYS use write_file to create files (NOT create_file, which does not exist)
6. ALWAYS end with an execute_command step to verify project was created successfully
7. For web applications, ALWAYS create: HTML file, CSS file, JavaScript file
8. For React/Vue projects, ALWAYS include: npm init, npm install, and build steps

9. CRITICAL: Each step MUST include "acceptanceCriteria" - how you will verify this step was actually completed
10. CRITICAL: Each step MUST include "expectedFiles" - list of files this step should create/modify
11. CRITICAL: Write REAL implementation code, not placeholder code. Empty functions, TODO comments will be rejected.

VERIFICATION RULES:
- "write_file" step: acceptanceCriteria should check file exists and contains actual code (>100 bytes)
- "execute_command" step: acceptanceCriteria should check command exits with code 0
- Each step must specify what "success" looks like

Example step format:
{
  "id": "step_1",
  "tool": "write_file",
  "parameters": {"path": "${taskDir}/index.html", "content": "<!DOCTYPE html>..."},
  "description": "Create main HTML file with grid layout",
  "acceptanceCriteria": ["File exists", "File size > 500 bytes", "Contains <table> or grid div"],
  "expectedFiles": ["${taskDir}/index.html"]
}

12. CRITICAL: When using execute_command, ensure proper shell syntax:
   
   WRONG: "find /path -name '*.js' head -20"
   RIGHT: "find /path -name '*.js' | head -20"
   REASON: Missing pipe operator | between commands
   
   WRONG: "cd /path npm install"
   RIGHT: "cd /path && npm install"
   REASON: Missing && to chain commands
   
   WRONG: "/path/with spaces"
   RIGHT: "/path/with spaces"
   REASON: Paths with spaces need quoting
   
   WRONG: "ls -la | grep .js head -10"
   RIGHT: "ls -la | grep .js | head -10"
   REASON: Each pipe needs proper spacing
   
   ALWAYS test your commands before including them in the plan!

IMPORTANT: Use the task directory "${taskDir}" for all file operations. Do NOT use ${PATHS.getWorkspacePath('notepad')}.

Output format (MUST follow this structure):
{"reasoning": "I will create a complete project with all necessary files", "steps": [
  {"id": "step_1", "tool": "create_directory", "parameters": {"path": "${taskDir}"}, "description": "Create project directory", "acceptanceCriteria": ["Directory exists"], "expectedFiles": []},
  {"id": "step_2", "tool": "write_file", "parameters": {"path": "${taskDir}/index.html", "content": "<!DOCTYPE html>..."}, "description": "Create main HTML file", "acceptanceCriteria": ["File exists", "File size > 500 bytes"], "expectedFiles": ["${taskDir}/index.html"]},
  {"id": "step_3", "tool": "write_file", "parameters": {"path": "${taskDir}/style.css", "content": "body { ... }"}, "description": "Create CSS file", "acceptanceCriteria": ["File exists", "Contains CSS rules"], "expectedFiles": ["${taskDir}/style.css"]},
  {"id": "step_4", "tool": "write_file", "parameters": {"path": "${taskDir}/app.js", "content": "document.addEventListener..."}, "description": "Create JavaScript file"},
  {"id": "step_5", "tool": "execute_command", "parameters": {"command": "cd ${taskDir} && npm init -y"}, "description": "Initialize npm project"},
  {"id": "step_6", "tool": "execute_command", "parameters": {"command": "cd ${taskDir} && ls -la"}, "description": "Verify project structure"}
]}

IMPORTANT: Output ONLY valid JSON with at least 3 steps, no other text!`

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history
    ]

    if (instruction && instruction.trim().length > 0) {
       messages.push({ role: 'user', content: instruction })
    }

    const planOptions: any = {
      ...options,
      max_tokens: options?.max_tokens ?? 8000,  // 增加默认token数以支持更完整的计划
      temperature: options?.temperature ?? 0
    }
    // For OpenAI, always request structured JSON to reduce parsing failures
    if (model === 'openai') {
      planOptions.response_format = planOptions.response_format || { type: 'json_object' }
      if (!planOptions.model) {
        planOptions.model = 'gpt-4o-mini'
      }
    }

    const response = await llmService.chat(model, messages, planOptions)

    if (!response.success || !response.content) {
      console.warn(`Planner: LLM error - ${response.error || 'Empty response'}`)
      const now = Date.now()
      return {
        planId: `plan_${Date.now()}_error`,
        originalGoal: instruction,
        steps: [],
        reasoning: `Failed to create plan: ${response.error || 'Empty response'}`,
        currentStepId: null,
        autoExecute: true,
        createdAt: now,
        updatedAt: now
      }
    }

    console.log('[Planner] LLM 原始响应 (前 500 字符):', response.content?.slice(0, 500))
    console.log('[Planner] LLM 原始响应长度:', response.content?.length)

    const extractJson = (text: string): string | null => {
      const trimmed = text.trim()
      console.log('[Planner] 开始提取 JSON，输入长度:', trimmed.length)
      
      // First try to extract from markdown code block
      const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (codeBlockMatch?.[1]) {
        const jsonStr = codeBlockMatch[1].trim()
        console.log('[Planner] 从代码块提取 JSON，长度:', jsonStr.length)
        return jsonStr
      }

      // If no code block, try to find the JSON object directly
      const firstObj = trimmed.indexOf('{')
      const firstArr = trimmed.indexOf('[')
      const start =
        firstObj === -1 ? firstArr
        : firstArr === -1 ? firstObj
        : Math.min(firstObj, firstArr)
      if (start === -1) {
        console.log('[Planner] 未找到 JSON 开始标记')
        return null
      }

      // Enhanced extraction strategy: find the matching closing brace with better string handling
      const open = trimmed[start]
      const close = open === '{' ? '}' : ']'
      
      let depth = 0
      let inString = false
      let escaped = false
      let jsonEnd = -1
      
      for (let i = start; i < trimmed.length; i++) {
        const ch = trimmed[i]

        if (inString) {
          if (escaped) {
            escaped = false
          } else if (ch === '\\') {
            escaped = true
          } else if (ch === '"') {
            inString = false
          }
          continue
        }

        if (ch === '"') {
          inString = true
          continue
        }

        if (ch === open) depth++
        if (ch === close) depth--

        if (depth === 0) {
          jsonEnd = i + 1
          break
        }
      }

      if (jsonEnd === -1) {
        console.log('[Planner] 未找到匹配的 JSON 结束标记')
        return null
      }

      const jsonStr = trimmed.slice(start, jsonEnd)
      console.log('[Planner] 提取的 JSON 长度:', jsonStr.length)
      return jsonStr
    }

    const validatePlan = (p: any): p is Plan => {
      if (!p || typeof p !== 'object') return false
      if (typeof p.reasoning !== 'string') return false
      if (!Array.isArray(p.steps)) return false
      for (const s of p.steps) {
        if (!s || typeof s !== 'object') return false
        if (typeof s.id !== 'string') return false
        if (typeof s.tool !== 'string') return false
        if (!('parameters' in s)) return false
        if (typeof s.description !== 'string') return false
      }
      return true
    }

    const parsePlanOrThrow = (raw: string): Plan => {
      const jsonStr = extractJson(raw)
      if (!jsonStr) throw new Error('No JSON found in LLM response')
      
      console.log('[Planner] 提取的 JSON (前 500 字符):', jsonStr?.slice(0, 500))
      console.log('[Planner] 提取的 JSON 长度:', jsonStr?.length)
      
      try {
        const plan = JSON.parse(jsonStr) as Plan
        console.log('[Planner] 解析后的计划步骤数:', plan?.steps?.length)
        
        if (!validatePlan(plan)) {
          throw new Error('Parsed JSON does not match Plan schema')
        }
        
        return plan
      } catch (parseError: any) {
        console.error('[Planner] JSON 解析失败:', parseError.message)
        console.error('[Planner] 错误位置:', parseError.stack)
        
        // 尝试修复常见的 JSON 错误
        try {
          const repaired = repairJson(jsonStr)
          console.log('[Planner] 尝试修复 JSON')
          const plan = JSON.parse(repaired) as Plan
          
          if (validatePlan(plan)) {
            console.log('[Planner] JSON 修复成功')
            return plan
          }
        } catch (repairError: any) {
          console.error('[Planner] JSON 修复失败:', repairError.message)
        }
        
        throw new Error(`Failed to parse plan JSON: ${parseError.message}`)
      }
    }
    
    const repairJson = (jsonStr: string): string => {
      // 尝试修复常见的 JSON 错误
      let repaired = jsonStr
      
      // 修复未转义的引号（在字符串值中）
      // 这是一个简单的启发式方法，可能无法处理所有情况
      repaired = repaired.replace(/"([^"]*)"([^",\s\]}]*?)"/g, (match, p1, p2) => {
        // 如果 p2 包含未转义的引号，尝试修复
        if (p2.includes('"')) {
          return `"${p1}${p2.replace(/"/g, '\\"')}"`
        }
        return match
      })
      
      // 修复尾随逗号
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1')
      
      // 修复单引号
      repaired = repaired.replace(/'([^']*)'/g, '"$1"')
      
      return repaired
    }

    const maybeEnforceImageGrid = (p: Plan): Plan => {
      const instr = (instruction || '').trim()
      if (!instr) return p

      const looksLikeImageDownload =
        /下载|爬图|找图|搜图|图片|照片|图像|image/i.test(instr) &&
        (/下载|找|搜|爬/i.test(instr) || /image/i.test(instr))

      if (!looksLikeImageDownload) return p

      const hasBatch = p.steps.some(s => s?.tool === 'batch_download_images')
      if (hasBatch) {
        return {
          ...p,
          steps: p.steps.map(s => {
            if (s?.tool !== 'batch_download_images') return s
            const requested = Number(s?.parameters?.count)
            const count = Number.isFinite(requested) && requested > 0 ? requested : 9
            return {
              ...s,
              parameters: {
                ...s.parameters,
                count: Math.max(9, count)
              }
            }
          })
        }
      }

      const stripped = instr
        .replace(/搜索并/g, ' ')
        .replace(/搜索/g, ' ')
        .replace(/并/g, ' ')
        .replace(/下载/g, ' ')
        .replace(/图片|照片|图像|图/g, ' ')
        .replace(/[一二两三四五六七八九十\d]+\s*张/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const query = stripped || instr

      const stepId = `download_images_${Date.now()}`
      return {
        planId: `plan_${Date.now()}`,
        originalGoal: instruction,
        reasoning: p.reasoning || 'Provide a 9-image gallery for user selection.',
        steps: [
          {
            id: stepId,
            tool: 'batch_download_images',
            parameters: { query, count: 9 },
            description: 'Search and download 9 candidate images for user selection',
            status: StepStatus.PENDING
          },
          ...p.steps.filter(s => s?.tool !== 'respond_to_user')
        ],
        currentStepId: null,
        autoExecute: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    }

    // 增强Plan格式 - 添加状态、决策解释等
    const enhancePlan = (p: Plan): Plan => {
      const now = Date.now()
      return {
        planId: `plan_${now}_${Math.random().toString(36).slice(2, 8)}`,
        originalGoal: instruction || '用户任务',
        reasoning: p.reasoning,
        decisionRationale: `基于任务需求 "${instruction?.slice(0, 50)}..." 制定执行计划`,
        alternativesConsidered: [
          '使用单一文件实现所有功能',
          '分步骤创建多个文件',
          '使用现有框架快速搭建'
        ],
        currentStepId: null,
        autoExecute: true,
        createdAt: now,
        updatedAt: now,
        steps: p.steps.map((step, index) => ({
          ...step,
          status: StepStatus.PENDING,
          reasoning: `步骤${index + 1}: ${step.description}`,
          alternatives: index === 0 ? ['直接在桌面创建', '使用现有项目目录'] : undefined,
          dependsOn: index > 0 ? [p.steps[index - 1].id] : undefined,
          editableParams: {
            targetFiles: step.parameters?.path ? [step.parameters.path] : undefined,
            command: step.parameters?.command,
            instruction: step.parameters?.instruction
          }
        }))
      }
    }

    try {
      const parsedPlan = maybeEnforceImageGrid(parsePlanOrThrow(response.content))
      const finalPlan = enhancePlan(parsedPlan)
      
      // 缓存计划
      if (instruction) {
        this.setCachedPlan(instruction, model, finalPlan)
      }
      
      return finalPlan
    } catch (error: any) {
      const repairMessages: LLMMessage[] = [
        {
          role: 'system',
          content:
            'You are a JSON repair assistant. The user provided a malformed JSON plan. Fix syntax errors, especially unescaped quotes in strings. Output ONLY the valid JSON object.'
        },
        {
          role: 'user',
          content: `Schema:\n{\n  "reasoning": string,\n  "steps": Array<{ "id": string, "tool": string, "parameters": any, "description": string }>\n}\n\nContent to convert:\n${response.content}`
        }
      ]

      const repair = await llmService.chat(model, repairMessages, planOptions)
      if (repair.success && repair.content) {
        try {
          return maybeEnforceImageGrid(parsePlanOrThrow(repair.content))
        } catch {}
      }

      // 如果JSON解析失败，尝试从响应中提取文本作为回复
      console.warn('Planner: JSON解析失败，尝试使用文本回复')
      const textResponse = response.content || repair.content
      if (textResponse) {
        const now = Date.now()
        const fallbackPlan = {
          planId: `plan_fallback_${now}`,
          originalGoal: instruction || '用户任务',
          reasoning: '由于模型返回格式问题，使用文本回复',
          decisionRationale: '无法生成结构化执行计划，回退到文本响应',
          alternativesConsidered: [],
          currentStepId: null,
          autoExecute: false,
          createdAt: now,
          updatedAt: now,
          steps: [
            {
              id: 'fallback_response',
              tool: 'respond_to_user',
              parameters: { message: textResponse },
              description: '直接回复用户',
              status: StepStatus.PENDING,
              reasoning: '文本响应是最直接的交互方式'
            }
          ]
        } as Plan
        
        // 缓存fallback计划
        if (instruction) {
          this.setCachedPlan(instruction, model, fallbackPlan)
        }
        
        return fallbackPlan
      }

      console.error('Failed to parse plan JSON:', response.content)
      throw new Error('Failed to parse plan from LLM response')
    }
  }
}

export const planner = new Planner()
