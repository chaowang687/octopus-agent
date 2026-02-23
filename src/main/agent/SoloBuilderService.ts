import { llmService } from '../services/LLMService'
import { contextManager } from './ContextManager'

interface AppBuildingRequest {
  instruction: string
  appType: 'web' | 'mobile' | 'desktop'
  techStack: {
    frontend: string
    backend?: string
    database?: string
  }
  context?: any
  features?: string[]
}

interface PRDGenerationRequest {
  instruction: string
  appType: string
  context?: any
}

interface UIGenerationRequest {
  prd: string
  techStack: string
  context?: any
  designStyle?: 'modern' | 'minimal' | 'corporate' | 'creative'
}

interface AppBuildingResult {
  success: boolean
  prd: string
  code: {
    frontend: string
    backend?: string
    database?: string
  }
  structure: string
  previewUrl?: string
  errors?: string[]
}

interface PRDGenerationResult {
  success: boolean
  prd: string
  sections: {
    title: string
    content: string
  }[]
  errors?: string[]
}



export class SoloBuilderService {
  // 应用构建
  async buildApp(request: AppBuildingRequest): Promise<AppBuildingResult> {
    try {
      const { instruction, appType, techStack, context } = request
      
      // 1. 生成PRD
      const prdResult = await this.generatePRD({
        instruction,
        appType: appType.toString(),
        context
      })
      
      if (!prdResult.success) {
        return {
          success: false,
          prd: '',
          code: { frontend: '' },
          structure: '',
          errors: prdResult.errors
        }
      }
      
      // 2. 生成前端代码
      const frontendCode = await this.generateFrontendCode({
        prd: prdResult.prd,
        techStack: techStack.frontend,
        context,
        designStyle: 'modern'
      })
      
      // 3. 生成后端代码（如果需要）
      let backendCode: string = ''
      if (techStack.backend) {
        backendCode = await this.generateBackendCode({
          prd: prdResult.prd,
          techStack: techStack.backend,
          context
        })
      }
      
      // 4. 生成数据库设计（如果需要）
      let databaseCode: string = ''
      if (techStack.database) {
        databaseCode = await this.generateDatabaseCode({
          prd: prdResult.prd,
          techStack: techStack.database,
          context
        })
      }
      
      // 5. 生成项目结构
      const structure = this.generateProjectStructure(techStack)
      
      // 6. 创建预览（模拟）
      const previewUrl = await this.createPreview()
      
      return {
        success: true,
        prd: prdResult.prd,
        code: {
          frontend: frontendCode,
          backend: backendCode,
          database: databaseCode
        },
        structure,
        previewUrl
      }
    } catch (error: any) {
      return {
        success: false,
        prd: '',
        code: { frontend: '' },
        structure: '',
        errors: [error.message]
      }
    }
  }

  // 生成PRD
  async generatePRD(request: PRDGenerationRequest): Promise<PRDGenerationResult> {
    try {
      const { instruction, appType, context } = request
      
      const prompt = this.buildPRDGenerationPrompt(instruction, appType)
      const enhancedPrompt = context ? await contextManager.injectContext(prompt, context) : prompt
      
      const response = await llmService.chat('openai', [
        { role: 'system', content: 'You are an expert product manager. Generate detailed PRDs for applications.' },
        { role: 'user', content: enhancedPrompt }
      ], {
        temperature: 0.7,
        max_tokens: 4000
      })
      
      if (!response.success || !response.content) {
        return {
          success: false,
          prd: '',
          sections: [],
          errors: ['Failed to generate PRD']
        }
      }
      
      const sections = this.parsePRDSections(response.content)
      
      return {
        success: true,
        prd: response.content,
        sections
      }
    } catch (error: any) {
      return {
        success: false,
        prd: '',
        sections: [],
        errors: [error.message]
      }
    }
  }

  // 生成前端代码
  async generateFrontendCode(request: UIGenerationRequest): Promise<string> {
    try {
      const { prd, techStack, context, designStyle } = request
      
      const prompt = this.buildFrontendGenerationPrompt(prd, techStack, designStyle || 'modern')
      const enhancedPrompt = context ? await contextManager.injectContext(prompt, context) : prompt
      
      const response = await llmService.chat('doubao-seed-2-0-lite-260215', [
        { role: 'system', content: `You are an expert frontend developer. Generate complete frontend code using ${techStack}.` },
        { role: 'user', content: enhancedPrompt }
      ], {
        temperature: 0.7,
        max_tokens: 4000
      })
      
      if (!response.success || !response.content) {
        throw new Error('Failed to generate frontend code')
      }
      
      return response.content
    } catch (error: any) {
      throw error
    }
  }

  // 生成后端代码
  async generateBackendCode(request: {
    prd: string
    techStack: string
    context?: any
  }): Promise<string> {
    try {
      const { prd, techStack, context } = request
      
      const prompt = this.buildBackendGenerationPrompt(prd, techStack)
      const enhancedPrompt = context ? await contextManager.injectContext(prompt, context) : prompt
      
      const response = await llmService.chat('openai', [
        { role: 'system', content: `You are an expert backend developer. Generate complete backend code using ${techStack}.` },
        { role: 'user', content: enhancedPrompt }
      ], {
        temperature: 0.7,
        max_tokens: 4000
      })
      
      if (!response.success || !response.content) {
        throw new Error('Failed to generate backend code')
      }
      
      return response.content
    } catch (error: any) {
      throw error
    }
  }

  // 生成数据库代码
  async generateDatabaseCode(request: {
    prd: string
    techStack: string
    context?: any
  }): Promise<string> {
    try {
      const { prd, techStack, context } = request
      
      const prompt = this.buildDatabaseGenerationPrompt(prd, techStack)
      const enhancedPrompt = context ? await contextManager.injectContext(prompt, context) : prompt
      
      const response = await llmService.chat('openai', [
        { role: 'system', content: `You are an expert database designer. Generate database schema using ${techStack}.` },
        { role: 'user', content: enhancedPrompt }
      ], {
        temperature: 0.7,
        max_tokens: 2000
      })
      
      if (!response.success || !response.content) {
        throw new Error('Failed to generate database code')
      }
      
      return response.content
    } catch (error: any) {
      throw error
    }
  }

  // 生成项目结构
  private generateProjectStructure(techStack: {
    frontend: string
    backend?: string
    database?: string
  }): string {
    const structure = {
      frontend: this.getFrontendStructure(techStack.frontend),
      backend: techStack.backend ? this.getBackendStructure(techStack.backend) : undefined,
      database: techStack.database ? this.getDatabaseStructure(techStack.database) : undefined
    }

    return JSON.stringify(structure, null, 2)
  }

  // 创建预览
  private async createPreview(): Promise<string> {
    // 模拟预览URL
    return `http://localhost:3000/preview-${Date.now()}`
  }

  // 构建PRD生成提示
  private buildPRDGenerationPrompt(instruction: string, appType: string): string {
    return `Generate a detailed PRD (Product Requirements Document) for a ${appType} application based on the following instruction:

${instruction}

PRD should include:
1. Product Overview
2. Core Features
   - User Roles (if applicable)
   - Feature List
   - Page Navigation
3. Core Process
   - User Flow
   - System Architecture
4. User Interface Design
   - Design Style
   - Page Design Overview
   - Responsiveness
5. Technical Requirements
   - Tech Stack
   - Dependencies
6. Project Plan
   - Development Phases
   - Timeline
7. Risk Assessment

Output the complete PRD document with clear sections and subsections.`
  }

  // 构建前端代码生成提示
  private buildFrontendGenerationPrompt(prd: string, techStack: string, designStyle: string): string {
    return `Generate complete frontend code for a web application based on the following PRD:

${prd}

Tech Stack: ${techStack}
Design Style: ${designStyle}

Requirements:
1. Generate complete, runnable code
2. Include all necessary files and components
3. Follow best practices for the selected tech stack
4. Implement responsive design
5. Include proper error handling
6. Add basic styling that matches the design style
7. Provide clear comments
8. Include a README.md file with setup instructions

Output the code structure and content for all files.`
  }

  // 构建后端代码生成提示
  private buildBackendGenerationPrompt(prd: string, techStack: string): string {
    return `Generate complete backend code for an application based on the following PRD:

${prd}

Tech Stack: ${techStack}

Requirements:
1. Generate complete, runnable code
2. Include all necessary files and modules
3. Follow best practices for the selected tech stack
4. Implement proper API endpoints
5. Include database models (if applicable)
6. Add authentication and authorization (if needed)
7. Include proper error handling
8. Provide clear comments
9. Include a README.md file with setup instructions

Output the code structure and content for all files.`
  }

  // 构建数据库代码生成提示
  private buildDatabaseGenerationPrompt(prd: string, techStack: string): string {
    return `Generate database schema for an application based on the following PRD:

${prd}

Tech Stack: ${techStack}

Requirements:
1. Generate complete database schema
2. Include all necessary tables and relationships
3. Define proper data types and constraints
4. Add indexes for performance optimization
5. Include sample data (if applicable)
6. Provide clear comments
7. Include setup scripts

Output the database schema and setup instructions.`
  }

  // 解析PRD sections
  private parsePRDSections(prd: string): {
    title: string
    content: string
  }[] {
    const sections: { title: string; content: string }[] = []
    const sectionRegex = /^(#{1,3})\s+(.*?)$/gm
    let match
    
    while ((match = sectionRegex.exec(prd)) !== null) {
      const title = match[2].trim()
      
      // 提取section内容
      const startIndex = match.index + match[0].length
      const nextMatch = sectionRegex.exec(prd)
      const endIndex = nextMatch ? nextMatch.index : prd.length
      const content = prd.substring(startIndex, endIndex).trim()
      
      sections.push({ title, content })
    }
    
    return sections
  }

  // 获取前端结构
  private getFrontendStructure(techStack: string): any {
    switch (techStack.toLowerCase()) {
      case 'react':
        return {
          'src/': {
            'components/': {},
            'pages/': {},
            'services/': {},
            'assets/': {},
            'App.js': '',
            'index.js': ''
          },
          'public/': {},
          'package.json': '',
          'README.md': ''
        }
      case 'vue':
        return {
          'src/': {
            'components/': {},
            'views/': {},
            'services/': {},
            'assets/': {},
            'App.vue': '',
            'main.js': ''
          },
          'public/': {},
          'package.json': '',
          'README.md': ''
        }
      case 'angular':
        return {
          'src/': {
            'app/': {
              'components/': {},
              'services/': {},
              'models/': {}
            },
            'assets/': {},
            'environments/': {}
          },
          'package.json': '',
          'README.md': ''
        }
      default:
        return {
          'src/': {},
          'package.json': '',
          'README.md': ''
        }
    }
  }

  // 获取后端结构
  private getBackendStructure(techStack: string): any {
    switch (techStack.toLowerCase()) {
      case 'node.js':
      case 'express':
        return {
          'src/': {
            'routes/': {},
            'controllers/': {},
            'models/': {},
            'middleware/': {},
            'services/': {},
            'app.js': '',
            'server.js': ''
          },
          'package.json': '',
          'README.md': ''
        }
      case 'python':
      case 'flask':
        return {
          'app/': {
            'routes/': {},
            'controllers/': {},
            'models/': {},
            'services/': {}
          },
          'run.py': '',
          'requirements.txt': '',
          'README.md': ''
        }
      case 'java':
      case 'spring':
        return {
          'src/main/java/': {
            'com/example/app/': {
              'controllers/': {},
              'services/': {},
              'models/': {},
              'repositories/': {}
            }
          },
          'pom.xml': '',
          'README.md': ''
        }
      default:
        return {
          'src/': {},
          'package.json': '',
          'README.md': ''
        }
    }
  }

  // 获取数据库结构
  private getDatabaseStructure(techStack: string): any {
    switch (techStack.toLowerCase()) {
      case 'mongodb':
        return {
          'models/': {},
          'schemas/': {},
          'seed/': {},
          'README.md': ''
        }
      case 'mysql':
      case 'postgresql':
        return {
          'migrations/': {},
          'seeds/': {},
          'schema.sql': '',
          'README.md': ''
        }
      case 'sqlite':
        return {
          'schema.sql': '',
          'seed.sql': '',
          'README.md': ''
        }
      default:
        return {
          'schema.sql': '',
          'README.md': ''
        }
    }
  }

  // 智能UI组件生成
  async generateUIComponent(componentType: string, techStack: string, props: any): Promise<string> {
    const prompt = `Generate a ${componentType} component using ${techStack} with the following props:

${JSON.stringify(props, null, 2)}

Requirements:
1. Generate complete, functional component
2. Follow best practices for ${techStack}
3. Include proper props typing
4. Add basic styling
5. Provide clear comments`

    const response = await llmService.chat('openai', [
      { role: 'system', content: `You are an expert UI developer. Generate clean, efficient UI components.` },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.7,
      max_tokens: 2000
    })

    if (response.success && response.content) {
      return response.content
    }

    throw new Error('Failed to generate UI component')
  }

  // API集成
  async integrateAPI(apiSpec: string, techStack: string): Promise<string> {
    const prompt = `Generate code to integrate the following API into a ${techStack} application:

${apiSpec}

Requirements:
1. Generate complete API integration code
2. Include proper error handling
3. Add authentication (if needed)
4. Provide clear comments
5. Include usage examples`

    const response = await llmService.chat('openai', [
      { role: 'system', content: `You are an expert API integration specialist. Generate clean, efficient API integration code.` },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.7,
      max_tokens: 2000
    })

    if (response.success && response.content) {
      return response.content
    }

    throw new Error('Failed to generate API integration code')
  }
}

export const soloBuilderService = new SoloBuilderService()
