import { llmService } from '../services/LLMService'
import { contextManager } from './ContextManager'

interface CodeGenerationRequest {
  instruction: string
  language: string
  context?: any
  style?: 'clean' | 'verbose' | 'minimal'
}

interface TestGenerationRequest {
  code: string
  language: string
  testFramework: string
  context?: any
}

interface CodeReviewRequest {
  code: string
  language: string
  context?: any
  focusAreas?: ('security' | 'performance' | 'readability' | 'correctness')[]
}

interface CodeGenerationResult {
  success: boolean
  code: string
  explanation: string
  suggestions: string[]
  errors?: string[]
}

interface TestGenerationResult {
  success: boolean
  tests: string
  explanation: string
  coverage: string
  errors?: string[]
}

interface CodeReviewResult {
  success: boolean
  issues: {
    severity: 'high' | 'medium' | 'low'
    type: string
    message: string
    location: { line: number; column?: number }
    fix?: string
  }[]
  suggestions: string[]
  score: number
  errors?: string[]
}

export class SoloCoderService {
  // 代码生成
  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    try {
      const { instruction, language, context, style = 'clean' } = request
      
      // 构建提示
      const prompt = this.buildCodeGenerationPrompt(instruction, language, style)
      
      // 注入上下文
      const enhancedPrompt = context ? await contextManager.injectContext(prompt, context) : prompt
      
      // 调用LLM生成代码
      const response = await llmService.chat('doubao-seed-2-0-lite-260215', [
        {
          role: 'system',
          content: `You are an expert ${language} coder. Generate clean, efficient, and well-documented code.`
        },
        {
          role: 'user',
          content: enhancedPrompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 2000
      })
      
      if (!response.success || !response.content) {
        return {
          success: false,
          code: '',
          explanation: '',
          suggestions: [],
          errors: ['Failed to generate code']
        }
      }
      
      // 提取代码和解释
      const { code, explanation, suggestions } = this.parseCodeGenerationResponse(response.content, language)
      
      return {
        success: true,
        code,
        explanation,
        suggestions
      }
    } catch (error: any) {
      return {
        success: false,
        code: '',
        explanation: '',
        suggestions: [],
        errors: [error.message]
      }
    }
  }

  // 测试生成
  async generateTests(request: TestGenerationRequest): Promise<TestGenerationResult> {
    try {
      const { code, language, context } = request
      
      // 构建提示
      const prompt = this.buildTestGenerationPrompt(code, language)
      
      // 注入上下文
      const enhancedPrompt = context ? await contextManager.injectContext(prompt, context) : prompt
      
      // 调用LLM生成测试
      const response = await llmService.chat('doubao-seed-2-0-lite-260215', [
        {
          role: 'system',
          content: `You are an expert ${language} tester. Generate comprehensive tests.`
        },
        {
          role: 'user',
          content: enhancedPrompt
        }
      ], {
        temperature: 0.2,
        max_tokens: 2000
      })
      
      if (!response.success || !response.content) {
        return {
          success: false,
          tests: '',
          explanation: '',
          coverage: '',
          errors: ['Failed to generate tests']
        }
      }
      
      // 提取测试代码和解释
      const { tests, explanation, coverage } = this.parseTestGenerationResponse(response.content)
      
      return {
        success: true,
        tests,
        explanation,
        coverage
      }
    } catch (error: any) {
      return {
        success: false,
        tests: '',
        explanation: '',
        coverage: '',
        errors: [error.message]
      }
    }
  }

  // 代码审查
  async reviewCode(request: CodeReviewRequest): Promise<CodeReviewResult> {
    try {
      const { code, language, context, focusAreas = ['security', 'performance', 'readability', 'correctness'] } = request
      
      // 构建提示
      const prompt = this.buildCodeReviewPrompt(code, language, focusAreas)
      
      // 注入上下文
      const enhancedPrompt = context ? await contextManager.injectContext(prompt, context) : prompt
      
      // 调用LLM进行代码审查
      const response = await llmService.chat('openai', [
        {
          role: 'system',
          content: `You are an expert ${language} code reviewer. Analyze the code for issues and provide detailed feedback.`
        },
        {
          role: 'user',
          content: enhancedPrompt
        }
      ], {
        temperature: 0.3,
        max_tokens: 2000
      })
      
      if (!response.success || !response.content) {
        return {
          success: false,
          issues: [],
          suggestions: [],
          score: 0,
          errors: ['Failed to review code']
        }
      }
      
      // 解析审查结果
      const { issues, suggestions, score } = this.parseCodeReviewResponse(response.content)
      
      return {
        success: true,
        issues,
        suggestions,
        score
      }
    } catch (error: any) {
      return {
        success: false,
        issues: [],
        suggestions: [],
        score: 0,
        errors: [error.message]
      }
    }
  }

  // 构建代码生成提示
  private buildCodeGenerationPrompt(instruction: string, language: string, style: string): string {
    return `Generate ${language} code that implements the following instruction:

${instruction}

Style: ${style}

Requirements:
1. The code should be clean, efficient, and well-documented
2. Include comments explaining key parts of the code
3. Handle edge cases appropriately
4. Follow best practices for ${language}
5. Provide a brief explanation of how the code works

Output format:
${language}
// Code here


Explanation:
// Explanation here

Suggestions:
// Suggestions here`
  }

  // 构建测试生成提示
  private buildTestGenerationPrompt(code: string, language: string): string {
    return `Generate tests for the following ${language} code:

${language}
${code}


Requirements:
1. Tests should be comprehensive and cover all major functionality
2. Include edge cases and error handling
3. Follow best practices for testing
4. Provide a brief explanation of the test strategy
5. Estimate test coverage

Output format:
${language}
// Tests here


Explanation:
// Explanation here

Coverage:
// Coverage estimate here`
  }

  // 构建代码审查提示
  private buildCodeReviewPrompt(code: string, language: string, focusAreas: string[]): string {
    return `Review the following ${language} code with focus on: ${focusAreas.join(', ')}

${language}
${code}


Requirements:
1. Identify any issues or potential problems
2. Provide detailed feedback for each issue
3. Suggest improvements
4. Assign severity levels to issues
5. Provide a overall score (0-100)
6. For major issues, suggest fixes

Output format:
Issues:
// List of issues here

Suggestions:
// List of suggestions here

Score:
// Overall score here`
  }

  // 解析代码生成响应
  private parseCodeGenerationResponse(response: string, language: string): {
    code: string
    explanation: string
    suggestions: string[]
  } {
    // 提取代码块
    const codeBlockRegex = new RegExp(`\`\`\`${language}[\\s\\S]*?\`\`\``, 'g')
    const codeMatch = response.match(codeBlockRegex)
    const codeReplaceRegex = new RegExp(`\`\`\`${language}|\`\`\``, 'g')
    let code = codeMatch ? codeMatch[0].replace(codeReplaceRegex, '').trim() : ''

    // 提取解释
    const explanationMatch = response.match(/Explanation:\s*([\s\S]*?)(?=Suggestions:|$)/)
    const explanation = explanationMatch ? explanationMatch[1].trim() : ''

    // 提取建议
    const suggestionsMatch = response.match(/Suggestions:\s*([\s\S]*)$/)
    const suggestionsText = suggestionsMatch ? suggestionsMatch[1].trim() : ''
    const suggestions = suggestionsText ? suggestionsText.split('\n').filter(s => s.trim()) : []

    return {
      code,
      explanation,
      suggestions
    }
  }

  // 解析测试生成响应
  private parseTestGenerationResponse(response: string): {
    tests: string
    explanation: string
    coverage: string
  } {
    // 提取测试代码
    const testsMatch = response.match(/```[\s\S]*?```/g)
    let tests = testsMatch ? testsMatch[0].replace(/```/g, '').trim() : ''

    // 提取解释
    const explanationMatch = response.match(/Explanation:\s*([\s\S]*?)(?=Coverage:|$)/)
    const explanation = explanationMatch ? explanationMatch[1].trim() : ''

    // 提取覆盖率
    const coverageMatch = response.match(/Coverage:\s*([\s\S]*)$/)
    const coverage = coverageMatch ? coverageMatch[1].trim() : ''

    return {
      tests,
      explanation,
      coverage
    }
  }

  // 解析代码审查响应
  private parseCodeReviewResponse(response: string): {
    issues: {
      severity: 'high' | 'medium' | 'low'
      type: string
      message: string
      location: { line: number; column?: number }
      fix?: string
    }[]
    suggestions: string[]
    score: number
  } {
    // 提取问题
    const issuesMatch = response.match(/Issues:\s*([\s\S]*?)(?=Suggestions:|Score:|$)/)
    const issuesText = issuesMatch ? issuesMatch[1].trim() : ''
    const issues = this.parseIssues(issuesText)

    // 提取建议
    const suggestionsMatch = response.match(/Suggestions:\s*([\s\S]*?)(?=Score:|$)/)
    const suggestionsText = suggestionsMatch ? suggestionsMatch[1].trim() : ''
    const suggestions = suggestionsText ? suggestionsText.split('\n').filter(s => s.trim()) : []

    // 提取分数
    const scoreMatch = response.match(/Score:\s*(\d+)/)
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0

    return {
      issues,
      suggestions,
      score
    }
  }

  // 解析问题列表
  private parseIssues(issuesText: string): {
    severity: 'high' | 'medium' | 'low'
    type: string
    message: string
    location: { line: number; column?: number }
    fix?: string
  }[] {
    const issues: any[] = []
    const issueLines = issuesText.split('\n').filter(line => line.trim())

    issueLines.forEach(line => {
      // 简单的问题解析，实际应用中可能需要更复杂的解析
      const match = line.match(/(high|medium|low):\s*(\w+):\s*(.*?)\s*\((\d+)\)/i)
      if (match) {
        issues.push({
          severity: match[1].toLowerCase() as 'high' | 'medium' | 'low',
          type: match[2],
          message: match[3],
          location: { line: parseInt(match[4]) }
        })
      }
    })

    return issues
  }

  // 智能代码补全
  async autocompleteCode(prefix: string, language: string, context: string): Promise<string> {
    const prompt = `Complete the following ${language} code:

${prefix}

Context:
${context}

Continue the code naturally, maintaining the same style and indentation.`

    const response = await llmService.chat('doubao-seed-2-0-lite-260215', [
      { role: 'system', content: `You are an expert ${language} coder. Complete code snippets accurately.` },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.2,
      max_tokens: 500
    })

    if (response.success && response.content) {
      return response.content.trim()
    }

    return ''
  }

  // 代码重构建议
  async suggestRefactoring(code: string, language: string): Promise<string[]> {
    const prompt = `Suggest refactoring improvements for the following ${language} code:

${code}

Focus on:
1. Readability
2. Performance
3. Maintainability
4. Best practices

Provide specific, actionable suggestions.`

    const response = await llmService.chat('openai', [
      { role: 'system', content: `You are an expert ${language} refactoring specialist.` },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.3,
      max_tokens: 1000
    })

    if (response.success && response.content) {
      return response.content.split('\n').filter(line => line.trim())
    }

    return []
  }
}

export const soloCoderService = new SoloCoderService()
