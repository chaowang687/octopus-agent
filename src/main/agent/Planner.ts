import { llmService, LLMMessage } from '../services/LLMService'
import { toolRegistry } from './ToolRegistry'
import * as os from 'os'
import * as path from 'path'

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
  async createPlan(instruction: string, history: LLMMessage[] = [], model: string = 'openai', options: any = {}): Promise<Plan> {
    const fullToolsDescription = toolRegistry.getToolsDescription()
    // Limit tool description to ~5000 chars to save tokens for history/reasoning
    const toolsDescription = fullToolsDescription.length > 5000
      ? `${fullToolsDescription.slice(0, 5000)}\n... (tools list truncated for length)`
      : fullToolsDescription
    const homeDir = os.homedir()
    const desktopPath = path.join(homeDir, 'Desktop')
    
    // 获取工作目录（如果有的话）
    const taskDir = options?.taskDir || ''
    const workspacePath = '/Users/wangchao/Desktop/本地化TRAE'
    
    const workingDirInfo = taskDir 
      ? `\n- Working Directory (任务工作目录): ${taskDir}`
      : `\n- Workspace Path (项目根目录): ${workspacePath}`
    
    const pathExamples = taskDir 
      ? `\n\nPATH EXAMPLES - For this task, use paths like:
  - ${path.join(taskDir, 'src/index.ts')}
  - ${path.join(taskDir, 'src/renderer/index.html')}
  - ${path.join(taskDir, 'package.json')}
  DO NOT use: main/index.ts, src/main.js, or any relative paths.`
      : `\n\nPATH EXAMPLES - ALWAYS use full absolute paths:
  - ${workspacePath}/src/main/index.ts
  - ${workspacePath}/src/renderer/index.html
  - /Users/wangchao/Desktop/项目名/src/index.js
  DO NOT use: main/index.ts, src/main.js, ./src, /path/to/..., or any relative paths.`
    
    const systemPrompt = `You are a task PLANNER. Your job is to create a detailed JSON plan with MULTIPLE steps.

Environment: macOS, /Users/wangchao/Desktop

Available tools: create_directory, create_file, write_file, execute_command, respond_to_user

CRITICAL REQUIREMENTS:
1. ALWAYS create at least 3-5 steps for a typical development task
2. Steps should be ordered logically (create directories first, then files, then install dependencies, then run)
3. NEVER create only 1 step - that is too simplistic
4. ALWAYS include: create project folder → create source files → install dependencies → verify with command

Output format (MUST follow this structure):
{"reasoning": "I will create the project step by step", "steps": [
  {"id": "step_1", "tool": "create_directory", "parameters": {"path": "/Users/wangchao/Desktop/notepad"}, "description": "Create notepad project directory"},
  {"id": "step_2", "tool": "write_file", "parameters": {"path": "/Users/wangchao/Desktop/notepad/index.html", "content": "<!DOCTYPE html>..."}, "description": "Create main HTML file"},
  {"id": "step_3", "tool": "execute_command", "parameters": {"command": "cd /Users/wangchao/Desktop/notepad && npm init -y"}, "description": "Initialize npm project"},
  {"id": "step_4", "tool": "execute_command", "parameters": {"command": "cd /Users/wangchao/Desktop/notepad && npm install"}, "description": "Install project dependencies"}
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
      throw new Error(`Failed to generate plan: ${response.error || 'Empty response'}`)
    }

    const extractJson = (text: string): string | null => {
      const trimmed = text.trim()
      // First try to extract from markdown code block
      const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim()

      // If no code block, try to find the JSON object directly
      const firstObj = trimmed.indexOf('{')
      const firstArr = trimmed.indexOf('[')
      const start =
        firstObj === -1 ? firstArr
        : firstArr === -1 ? firstObj
        : Math.min(firstObj, firstArr)
      if (start === -1) return null

      // Simple extraction strategy: find the matching closing brace
      const open = trimmed[start]
      const close = open === '{' ? '}' : ']'
      
      let depth = 0
      let inString = false
      let escaped = false
      
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

        if (depth === 0) return trimmed.slice(start, i + 1)
      }

      // Fallback: if proper nesting failed (e.g. malformed JSON), try to return everything from start to end
      // This allows the repair mechanism to have a chance with the full content
      const lastClose = trimmed.lastIndexOf(close)
      if (lastClose > start) {
        return trimmed.slice(start, lastClose + 1)
      }

      return null
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
      const plan = JSON.parse(jsonStr) as Plan
      if (!validatePlan(plan)) throw new Error('Parsed JSON does not match Plan schema')
      return plan
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
        reasoning: p.reasoning || 'Provide a 9-image gallery for user selection.',
        steps: [
          {
            id: stepId,
            tool: 'batch_download_images',
            parameters: { query, count: 9 },
            description: 'Search and download 9 candidate images for user selection'
          },
          ...p.steps.filter(s => s?.tool !== 'respond_to_user')
        ]
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
      return enhancePlan(parsedPlan)
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
        return {
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
      }

      console.error('Failed to parse plan JSON:', response.content)
      throw new Error('Failed to parse plan from LLM response')
    }
  }
}

export const planner = new Planner()
