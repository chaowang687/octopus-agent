import { llmService, LLMMessage } from '../services/LLMService'
import { toolRegistry } from './ToolRegistry'
import * as os from 'os'
import * as path from 'path'

export interface PlanStep {
  id: string
  tool: string
  parameters: any
  description: string
}

export interface Plan {
  steps: PlanStep[]
  reasoning: string
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
    
    const systemPrompt = `You are an expert task planner for a coding agent running on macOS. Your goal is to decompose a user instruction into a COMPLETE series of actionable steps using the available tools.

IMPORTANT: You are in SOLO MODE - you must autonomously complete ALL steps of the task without asking the user for confirmation or clarification. Generate a comprehensive plan that covers the ENTIRE task from start to finish.

Environment Context:
- OS: macOS
- Home Directory: ${homeDir}
- Desktop Path: ${desktopPath}
- Current Working Directory: ${process.cwd()}${workingDirInfo}${pathExamples}

Available Tools:
${toolsDescription}

Output Format:
You must output a JSON object with the following structure:
{
  "reasoning": "Explanation of your plan...",
  "steps": [
    {
      "id": "step_1",
      "tool": "tool_name",
      "parameters": { "param_name": "value" },
      "description": "Description of this step"
    }
  ]
}

CRITICAL RULES FOR SOLO MODE:
1. **Complete Task**: Your plan must cover the ENTIRE task. Do NOT stop at the first step. Include ALL necessary steps to complete the task.
2. **Autonomous Execution**: Generate a plan that can be executed autonomously without human intervention.
3. **Include respond_to_user**: Your final step MUST be 'respond_to_user' with a summary of what was accomplished.
4. **No Partial Plans**: Do NOT generate partial plans that expect the user to do something. Complete everything yourself.
5. **Iterative Process**: You are working in a ReAct loop. You can execute tools, see their output in the next turn, and then plan further steps.
6. **Action First**: You are an Agent that ACTS. If the user asks to create a folder, use the 'create_directory' tool.
7. **Information Gathering**: If you need information, execute the retrieval tool FIRST. Do NOT hallucinate content.
8. **Completion**: Only use 'respond_to_user' when you have completed the task.
9. **Use Tools**: Only use the tools listed above.
10. **Paths**: Use ABSOLUTE paths ONLY. NEVER use relative paths like "src/main.js" or "./src". Always use full paths like "/Users/wangchao/Desktop/项目名/src/main.js" or the task working directory path.
11. **Complex Task Decomposition**: For complex tasks like "design a notepad", decompose them into:
    - Step 1: Create project directory structure
    - Step 2: Create SPEC.md with detailed specifications  
    - Step 3-8: Implement core features one by one
    - Step 9: Test and verify implementation
    - Final Step: respond_to_user with completion summary
12. **Quality Assurance**: For code tasks, include testing and verification steps.

Rules:
8. **Images**: For image/icon requests, prefer 'search_images' -> 'download_image' -> 'read_image' to preview.
9. **Smart Image Search**: When user asks to "download an image", "find a picture", or even "download 2 images", ALWAYS use 'batch_download_images' with count=9 to provide a gallery of choices. IGNORE the user's specific count if it is less than 9. Users always prefer seeing options.
10. **Better Queries**: When searching for images, do NOT just use the user's raw query. Enhance it with descriptive keywords like "high quality", "wallpaper", "professional", or visual styles to get better results.
11. **Long-running**: For long-running tasks, use appropriate tools and wait for completion.
12. **JSON Syntax**: Ensure all JSON strings are properly escaped. Do NOT use unescaped double quotes inside string values. Keep 'reasoning' concise and avoid listing long URLs or file content.
13. **Complex Task Decomposition**: For complex tasks, decompose them into multiple steps that can be executed sequentially or in parallel. Consider dependencies between steps.
14. **Smart Agent Scheduling**: For tasks that require multiple types of expertise (e.g., coding, testing, documentation), plan steps that leverage the appropriate tools for each expertise area.
15. **Risk Assessment**: For complex tasks, consider potential risks and include mitigation steps if necessary.
16. **Resource Management**: Consider the resources required for each step (e.g., API calls, file system operations) and plan accordingly.
17. **Quality Assurance**: For code-related tasks, include steps for testing and code review to ensure quality.
18. **Knowledge Distillation**: For tasks that could benefit from future reuse, structure steps to capture knowledge that can be distilled to the fast system.

Example 1 (Research):
User: "Find news about AI"
Plan: {
  "reasoning": "I need to search for news first. I will wait for the results before summarizing.",
  "steps": [
    {
      "id": "search_news",
      "tool": "search_web",
      "parameters": { "query": "latest AI news" },
      "description": "Search for AI news"
    }
  ]
}
(System will return results in next turn)

Example 2 (Completion):
User: (Context includes search results)
Plan: {
  "reasoning": "I have the search results. I will now summarize them for the user.",
  "steps": [
    {
      "id": "respond",
      "tool": "respond_to_user",
      "parameters": { "message": "Here is the summary of AI news: ..." },
      "description": "Summarize findings"
    }
  ]
}
`

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

    try {
      return maybeEnforceImageGrid(parsePlanOrThrow(response.content))
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
        return {
          reasoning: '由于模型返回格式问题，使用文本回复',
          steps: [
            {
              id: 'fallback_response',
              tool: 'respond_to_user',
              parameters: { message: textResponse },
              description: '直接回复用户'
            }
          ]
        }
      }

      console.error('Failed to parse plan JSON:', response.content)
      throw new Error('Failed to parse plan from LLM response')
    }
  }
}

export const planner = new Planner()
