/**
 * 结果处理器
 * 负责格式化输出、执行附加动作和处理错误
 */

import { EventEmitter } from 'events'
import { OmniAgentResult, TaskType } from '../OmniAgent'
import { ProcessedResult, FormattedOutput, ActionResult, CodeBlock, Table } from './types'

export interface ResultProcessorOptions {
  enableMarkdown?: boolean
  enableCodeHighlighting?: boolean
  enableActionExecution?: boolean
  maxCodeLength?: number
}

export class ResultProcessor extends EventEmitter {
  private enableMarkdown: boolean
  private enableCodeHighlighting: boolean
  private enableActionExecution: boolean
  private maxCodeLength: number

  constructor(options: ResultProcessorOptions = {}) {
    super()
    this.enableMarkdown = options.enableMarkdown !== false
    this.enableCodeHighlighting = options.enableCodeHighlighting !== false
    this.enableActionExecution = options.enableActionExecution !== false
    this.maxCodeLength = options.maxCodeLength || 10000
  }

  async process(
    result: OmniAgentResult,
    context: any
  ): Promise<ProcessedResult> {
    const startTime = Date.now()

    try {
      const formatted = this.format(result)
      const actions = this.extractActions(result)
      const actionResults = this.enableActionExecution
        ? await this.executeActions(actions)
        : []
      const memoryEntries = this.generateMemoryEntries(result, context)

      const processedResult: ProcessedResult = {
        original: result,
        formatted,
        actions: actionResults,
        memoryEntries
      }

      const processingTime = Date.now() - startTime
      this.emit('result_processed', { result, processedResult, processingTime })

      return processedResult
    } catch (error: any) {
      this.emit('error', { result, error: error.message })
      return this.getFallbackResult(result, error)
    }
  }

  format(result: OmniAgentResult): FormattedOutput {
    const answer = result.answer || ''

    return {
      text: answer,
      markdown: this.enableMarkdown ? this.toMarkdown(answer) : undefined,
      html: this.enableMarkdown ? this.toHtml(answer) : undefined,
      codeBlocks: this.extractCodeBlocks(answer),
      tables: this.extractTables(answer),
      images: this.extractImagesFromResult(result)
    }
  }

  extractActions(result: OmniAgentResult): any[] {
    const actions: any[] = []

    if (result.artifacts?.code) {
      actions.push({
        type: 'write_file',
        parameters: {
          content: result.artifacts.code,
          language: this.detectLanguage(result.artifacts.code)
        },
        priority: 'medium'
      })
    }

    if (result.artifacts?.files) {
      for (const [filename, content] of Object.entries(result.artifacts.files)) {
        actions.push({
          type: 'write_file',
          parameters: {
            filename,
            content
          },
          priority: 'medium'
        })
      }
    }

    return actions
  }

  async executeActions(actions: any[]): Promise<ActionResult[]> {
    const results: ActionResult[] = []

    for (const action of actions) {
      try {
        const result = await this.executeAction(action)
        results.push({
          type: action.type,
          success: true,
          result,
          timestamp: Date.now()
        })
      } catch (error: any) {
        results.push({
          type: action.type,
          success: false,
          error: error.message,
          timestamp: Date.now()
        })
      }
    }

    return results
  }

  generateMemoryEntries(result: OmniAgentResult, context: any): any[] {
    const entries: any[] = []

    if (result.success && result.answer) {
      entries.push({
        id: `mem_${Date.now()}_answer`,
        type: 'short',
        content: {
          type: 'answer',
          answer: result.answer,
          reasoning: result.reasoning
        },
        timestamp: Date.now(),
        metadata: {
          sessionId: context.sessionId,
          taskType: result.statistics?.toolsUsed
        }
      })
    }

    if (result.artifacts?.code) {
      entries.push({
        id: `mem_${Date.now()}_code`,
        type: 'medium',
        content: {
          type: 'code',
          code: result.artifacts.code,
          language: this.detectLanguage(result.artifacts.code)
        },
        timestamp: Date.now(),
        metadata: {
          sessionId: context.sessionId
        }
      })
    }

    return entries
  }

  private toMarkdown(text: string): string {
    return text
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `\`\`\`${lang || 'typescript'}\n${code.trim()}\n\`\`\``
      })
      .replace(/`([^`]+)`/g, '`$1`')
      .replace(/\*\*([^*]+)\*\*/g, '**$1**')
      .replace(/\*([^*]+)\*/g, '*$1*')
  }

  private toHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang || 'typescript'}">${this.escapeHtml(code.trim())}</code></pre>`
      })
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
  }

  private extractCodeBlocks(text: string): CodeBlock[] {
    const blocks: CodeBlock[] = []
    const regex = /```(\w+)?\n([\s\S]*?)```/g
    let match

    let lineNumber = 1
    while ((match = regex.exec(text)) !== null) {
      const language = match[1] || 'typescript'
      const code = match[2]
      const lines = code.split('\n')

      blocks.push({
        language,
        code: code.trim(),
        startLine: lineNumber,
        endLine: lineNumber + lines.length - 1
      })

      lineNumber += lines.length + 2
    }

    return blocks
  }

  private extractTables(text: string): Table[] {
    const tables: Table[] = []
    const lines = text.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith('|') && line.endsWith('|')) {
        const headers = line.split('|').slice(1, -1).map(h => h.trim())

        if (i + 1 < lines.length && lines[i + 1].includes('---')) {
          const rows: string[][] = []
          let j = i + 2

          while (j < lines.length && lines[j].trim().startsWith('|')) {
            rows.push(
              lines[j].split('|').slice(1, -1).map(cell => cell.trim())
            )
            j++
          }

          if (rows.length > 0) {
            tables.push({
              headers,
              rows,
              caption: this.extractCaption(lines, i)
            })
          }

          i = j - 1
        }
      }
    }

    return tables
  }

  private extractCaption(lines: string[], tableIndex: number): string | undefined {
    for (let i = tableIndex - 3; i >= 0 && i >= tableIndex - 10; i--) {
      if (lines[i].trim().startsWith('![')) {
        const match = lines[i].match(/!\[([^\]]*)\]\(([^)]+)\)/)
        if (match) {
          return match[2]
        }
      }
    }
    return undefined
  }

  private extractImagesFromResult(result: OmniAgentResult): string[] {
    const images: string[] = []

    if (result.artifacts?.images) {
      images.push(...result.artifacts.images)
    }

    return images
  }

  private detectLanguage(code: string): string {
    const patterns: Record<string, RegExp> = {
      typescript: /\b(interface|type|enum|implements|extends)\b/,
      javascript: /\b(const|let|var|function|=>|async|await)\b/,
      python: /\b(def|class|import|from|print|len)\b/,
      java: /\b(public|private|protected|class|interface|extends|implements)\b/,
      go: /\b(func|var|const|type|struct|package|import)\b/,
      rust: /\b(fn|let|mut|pub|struct|enum|impl)\b/
    }

    for (const [language, pattern] of Object.entries(patterns)) {
      if (pattern.test(code)) {
        return language
      }
    }

    return 'typescript'
  }

  private async executeAction(action: any): Promise<any> {
    this.emit('action_executing', { action })

    switch (action.type) {
      case 'write_file':
        return { status: 'file_written', filename: action.parameters.filename }
      case 'execute_command':
        return { status: 'command_executed', command: action.parameters.command }
      default:
        return { status: 'unknown_action', type: action.type }
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  private getFallbackResult(result: OmniAgentResult, error: Error): ProcessedResult {
    return {
      original: result,
      formatted: {
        text: result.answer || '处理结果时发生错误',
        markdown: `处理结果时发生错误：${error.message}`
      },
      actions: [],
      memoryEntries: []
    }
  }
}
