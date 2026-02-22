import { ProblemDiagnosis, Solution, Workflow } from './SmartButlerKnowledge'
import * as fs from 'fs'
import * as path from 'path'

export class SmartButlerExpert {
  private knowledgeBase: Map<string, any>
  private experiences: Map<string, any[]>
  private expertiseLevels: Map<string, any>

  constructor() {
    this.knowledgeBase = new Map()
    this.experiences = new Map()
    this.expertiseLevels = new Map()
    this.loadKnowledge()
    this.loadExperiences()
    this.loadExpertiseLevels()
  }

  private loadKnowledge() {
    this.knowledgeBase.set('product', this.getProductKnowledge())
    this.knowledgeBase.set('ui', this.getUIKnowledge())
    this.knowledgeBase.set('development', this.getDevelopmentKnowledge())
    this.knowledgeBase.set('testing', this.getTestingKnowledge())
    this.knowledgeBase.set('architecture', this.getArchitectureKnowledge())
  }

  private loadExperiences() {
    const experiencesPath = path.join(__dirname, '../../data/butler_experiences.json')
    if (fs.existsSync(experiencesPath)) {
      const data = fs.readFileSync(experiencesPath, 'utf-8')
      this.experiences = new Map(JSON.parse(data))
    }
  }

  private loadExpertiseLevels() {
    const expertisePath = path.join(__dirname, '../../data/butler_expertise.json')
    if (fs.existsSync(expertisePath)) {
      const data = fs.readFileSync(expertisePath, 'utf-8')
      this.expertiseLevels = new Map(JSON.parse(data))
    }
  }

  private saveExperiences() {
    const experiencesPath = path.join(__dirname, '../../data/butler_expperiences.json')
    const data = JSON.stringify(Array.from(this.experiences.entries()))
    fs.writeFileSync(experiencesPath, data, 'utf-8')
  }

  private saveExpertiseLevels() {
    const expertisePath = path.join(__dirname, '../../data/butler_expertise.json')
    const data = JSON.stringify(Array.from(this.expertiseLevels.entries()))
    fs.writeFileSync(expertisePath, data, 'utf-8')
  }

  diagnoseProblem(projectPath: string, problemDescription: string): ProblemDiagnosis {
    console.log(`[SmartButlerExpert] 诊断问题: ${problemDescription}`)

    const diagnosis: ProblemDiagnosis = {
      problemId: this.generateId(),
      symptoms: this.extractSymptoms(problemDescription),
      possibleCauses: this.analyzePossibleCauses(projectPath, problemDescription),
      diagnosticSteps: this.generateDiagnosticSteps(projectPath, problemDescription),
      severity: this.assessSeverity(problemDescription),
      urgency: this.assessUrgency(problemDescription)
    }

    return diagnosis
  }

  private extractSymptoms(description: string): string[] {
    const symptoms: string[] = []
    const lowerDesc = description.toLowerCase()

    if (lowerDesc.includes('错误') || lowerDesc.includes('error')) {
      symptoms.push('出现错误信息')
    }
    if (lowerDesc.includes('慢') || lowerDesc.includes('卡') || lowerDesc.includes('慢')) {
      symptoms.push('性能问题')
    }
    if (lowerDesc.includes('崩溃') || lowerDesc.includes('crash')) {
      symptoms.push('应用崩溃')
    }
    if (lowerDesc.includes('界面') || lowerDesc.includes('ui')) {
      symptoms.push('界面问题')
    }
    if (lowerDesc.includes('运行') || lowerDesc.includes('run')) {
      symptoms.push('运行问题')
    }
    if (lowerDesc.includes('依赖') || lowerDesc.includes('dependency')) {
      symptoms.push('依赖问题')
    }
    if (lowerDesc.includes('构建') || lowerDesc.includes('build')) {
      symptoms.push('构建问题')
    }
    if (lowerDesc.includes('测试') || lowerDesc.includes('test')) {
      symptoms.push('测试问题')
    }

    return symptoms
  }

  private analyzePossibleCauses(projectPath: string, description: string): any[] {
    const causes: any[] = []
    const lowerDesc = description.toLowerCase()

    const packageJsonPath = path.join(projectPath, 'package.json')
    const hasPackageJson = fs.existsSync(packageJsonPath)

    if (!hasPackageJson) {
      causes.push({
        cause: '缺少 package.json 文件',
        likelihood: 0.9,
        evidence: ['无法找到 package.json']
      })
    }

    if (hasPackageJson) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        
        if (!packageJson.scripts || Object.keys(packageJson.scripts).length === 0) {
          causes.push({
            cause: 'package.json 中没有定义脚本',
            likelihood: 0.8,
            evidence: ['scripts 字段为空或不存在']
          })
        }

        if (!packageJson.dependencies || Object.keys(packageJson.dependencies).length === 0) {
          causes.push({
            cause: '没有定义依赖',
            likelihood: 0.7,
            evidence: ['dependencies 字段为空或不存在']
          })
        }

        const nodeModulesPath = path.join(projectPath, 'node_modules')
        if (!fs.existsSync(nodeModulesPath)) {
          causes.push({
            cause: '依赖未安装',
            likelihood: 0.95,
            evidence: ['node_modules 目录不存在']
          })
        }
      } catch (error) {
        causes.push({
          cause: 'package.json 格式错误',
          likelihood: 0.8,
          evidence: ['无法解析 package.json']
        })
      }
    }

    if (lowerDesc.includes('界面') || lowerDesc.includes('ui')) {
      const uiExtensions = ['.html', '.vue', '.jsx', '.tsx', '.css']
      let hasUiFiles = false
      try {
        const files = fs.readdirSync(projectPath, { recursive: true }) as string[]
        hasUiFiles = files.some(f => uiExtensions.some(ext => f.endsWith(ext)))
        
        if (!hasUiFiles) {
          causes.push({
            cause: '项目缺少界面文件',
            likelihood: 0.9,
            evidence: ['未找到 .html, .vue, .jsx, .tsx, .css 文件']
          })
        }
      } catch (error) {
        causes.push({
          cause: '无法扫描项目文件',
          likelihood: 0.5,
          evidence: ['文件系统访问错误']
        })
      }
    }

    if (lowerDesc.includes('测试') || lowerDesc.includes('test')) {
      const testFiles = ['.test.ts', '.test.js', '.spec.ts', '.spec.js']
      let hasTestFiles = false
      try {
        const files = fs.readdirSync(projectPath, { recursive: true }) as string[]
        hasTestFiles = files.some(f => testFiles.some(ext => f.endsWith(ext)))
        
        if (!hasTestFiles) {
          causes.push({
            cause: '项目缺少测试文件',
            likelihood: 0.8,
            evidence: ['未找到测试文件']
          })
        }
      } catch (error) {
        causes.push({
          cause: '无法扫描测试文件',
          likelihood: 0.5,
          evidence: ['文件系统访问错误']
        })
      }
    }

    if (causes.length === 0) {
      causes.push({
        cause: '问题原因不明确',
        likelihood: 0.5,
        evidence: ['需要更多信息']
      })
    }

    return causes.sort((a, b) => b.likelihood - a.likelihood)
  }

  private generateDiagnosticSteps(projectPath: string, description: string): any[] {
    const steps: any[] = []
    const lowerDesc = description.toLowerCase()

    steps.push({
      step: 1,
      action: '检查项目结构',
      expectedResult: '确认项目类型和结构',
      tool: 'file system'
    })

    if (lowerDesc.includes('依赖') || lowerDesc.includes('dependency')) {
      steps.push({
        step: 2,
        action: '检查 package.json',
        expectedResult: '确认依赖配置',
        tool: 'file reader'
      })
      steps.push({
        step: 3,
        action: '检查 node_modules',
        expectedResult: '确认依赖是否安装',
        tool: 'file system'
      })
    }

    if (lowerDesc.includes('运行') || lowerDesc.includes('run')) {
      steps.push({
        step: 2,
        action: '检查启动脚本',
        expectedResult: '确认启动命令',
        tool: 'package.json reader'
      })
      steps.push({
        step: 3,
        action: '尝试运行项目',
        expectedResult: '查看运行结果',
        tool: 'npm run'
      })
    }

    if (lowerDesc.includes('构建') || lowerDesc.includes('build')) {
      steps.push({
        step: 2,
        action: '检查构建配置',
        expectedResult: '确认构建工具',
        tool: 'config reader'
      })
      steps.push({
        step: 3,
        action: '尝试构建项目',
        expectedResult: '查看构建结果',
        tool: 'npm run build'
      })
    }

    if (lowerDesc.includes('测试') || lowerDesc.includes('test')) {
      steps.push({
        step: 2,
        action: '检查测试配置',
        expectedResult: '确认测试框架',
        tool: 'config reader'
      })
      steps.push({
        step: 3,
        action: '运行测试',
        expectedResult: '查看测试结果',
        tool: 'npm test'
      })
    }

    return steps
  }

  private assessSeverity(description: string): 'low' | 'medium' | 'high' | 'critical' {
    const lowerDesc = description.toLowerCase()

    if (lowerDesc.includes('崩溃') || lowerDesc.includes('crash') || lowerDesc.includes('严重')) {
      return 'critical'
    }
    if (lowerDesc.includes('错误') || lowerDesc.includes('error') || lowerDesc.includes('失败')) {
      return 'high'
    }
    if (lowerDesc.includes('警告') || lowerDesc.includes('warning') || lowerDesc.includes('慢')) {
      return 'medium'
    }
    return 'low'
  }

  private assessUrgency(description: string): 'low' | 'medium' | 'high' {
    const lowerDesc = description.toLowerCase()

    if (lowerDesc.includes('紧急') || lowerDesc.includes('urgent') || lowerDesc.includes('立即')) {
      return 'high'
    }
    if (lowerDesc.includes('重要') || lowerDesc.includes('important') || lowerDesc.includes('尽快')) {
      return 'medium'
    }
    return 'low'
  }

  generateSolution(diagnosis: ProblemDiagnosis, projectPath: string): Solution {
    console.log(`[SmartButlerExpert] 生成解决方案: ${diagnosis.problemId}`)

    const solution: Solution = {
      solutionId: this.generateId(),
      problemId: diagnosis.problemId,
      approach: this.determineApproach(diagnosis),
      description: this.generateSolutionDescription(diagnosis, projectPath),
      steps: this.generateSolutionSteps(diagnosis, projectPath),
      estimatedEffort: this.estimateEffort(diagnosis),
      risks: this.identifyRisks(diagnosis),
      alternatives: this.generateAlternatives(diagnosis)
    }

    return solution
  }

  private determineApproach(diagnosis: ProblemDiagnosis): 'quick_fix' | 'proper_fix' | 'refactor' | 'redesign' {
    if (diagnosis.severity === 'critical' || diagnosis.urgency === 'high') {
      return 'quick_fix'
    }
    if (diagnosis.severity === 'high') {
      return 'proper_fix'
    }
    if (diagnosis.possibleCauses.some(c => c.likelihood > 0.8)) {
      return 'proper_fix'
    }
    return 'refactor'
  }

  private generateSolutionDescription(diagnosis: ProblemDiagnosis, projectPath: string): string {
    const topCause = diagnosis.possibleCauses[0]
    
    let description = `基于问题诊断，主要原因是：${topCause.cause}\n\n`
    description += `解决方案：\n`
    
    if (topCause.cause.includes('package.json')) {
      description += `1. 检查并修复 package.json 文件\n`
      description += `2. 确保所有必需字段都存在\n`
      description += `3. 验证 JSON 格式正确\n`
    } else if (topCause.cause.includes('依赖')) {
      description += `1. 运行 npm install 安装依赖\n`
      description += `2. 检查 package.json 中的依赖版本\n`
      description += `3. 清理缓存并重新安装：npm cache clean --force && npm install\n`
    } else if (topCause.cause.includes('脚本')) {
      description += `1. 在 package.json 中添加启动脚本\n`
      description += `2. 定义 dev 和 build 脚本\n`
      description += `3. 确保脚本命令正确\n`
    } else if (topCause.cause.includes('界面')) {
      description += `1. 创建 UI 组件和页面\n`
      description += `2. 使用合适的 UI 框架\n`
      description += `3. 实现响应式设计\n`
    } else if (topCause.cause.includes('测试')) {
      description += `1. 设置测试框架\n`
      description += `2. 编写单元测试\n`
      description += `3. 添加集成测试\n`
    } else {
      description += `1. 根据问题类型采取相应措施\n`
      description += `2. 参考最佳实践\n`
      description += `3. 进行测试验证\n`
    }

    return description
  }

  private generateSolutionSteps(diagnosis: ProblemDiagnosis, projectPath: string): any[] {
    const steps: any[] = []
    const topCause = diagnosis.possibleCauses[0]
    let stepNumber = 1

    if (topCause.cause.includes('package.json')) {
      steps.push({
        step: stepNumber++,
        action: '检查 package.json 文件',
        command: `cat ${path.join(projectPath, 'package.json')}`,
        verification: '确认文件存在且格式正确'
      })
      steps.push({
        step: stepNumber++,
        action: '修复 package.json',
        code: '// 添加缺失的字段\n{\n  "name": "your-project",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  }\n}',
        verification: 'JSON 格式正确'
      })
    } else if (topCause.cause.includes('依赖')) {
      steps.push({
        step: stepNumber++,
        action: '安装依赖',
        command: 'npm install',
        verification: 'node_modules 目录存在'
      })
      steps.push({
        step: stepNumber++,
        action: '清理缓存并重新安装',
        command: 'npm cache clean --force && npm install',
        verification: '依赖成功安装'
      })
    } else if (topCause.cause.includes('脚本')) {
      steps.push({
        step: stepNumber++,
        action: '添加启动脚本',
        code: '// 在 package.json 中添加\n"scripts": {\n  "dev": "vite",\n  "build": "vite build",\n  "preview": "vite preview"\n}',
        verification: '脚本可以运行'
      })
    } else if (topCause.cause.includes('界面')) {
      steps.push({
        step: stepNumber++,
        action: '创建主页面',
        code: '// src/App.vue\n<template>\n  <div class="app">\n    <h1>欢迎使用</h1>\n  </div>\n</template>\n\n<style>\n.app {\n  padding: 20px;\n}\n</style>',
        verification: '页面正常显示'
      })
      steps.push({
        step: stepNumber++,
        action: '添加路由',
        code: '// src/router/index.ts\nimport { createRouter, createWebHistory } from \'vue-router\'\n\nconst routes = [\n  { path: \'/\', component: () => import(\'../views/Home.vue\') }\n]\n\nexport default createRouter({\n  history: createWebHistory(),\n  routes\n})',
        verification: '路由正常工作'
      })
    } else if (topCause.cause.includes('测试')) {
      steps.push({
        step: stepNumber++,
        action: '创建测试文件',
        code: '// src/App.test.ts\nimport { describe, it, expect } from \'vitest\'\nimport { mount } from \'@vue/test-utils\'\nimport App from \'../App.vue\'\n\ndescribe(\'App\', () => {\n  it(\'renders properly\', () => {\n    const wrapper = mount(App)\n    expect(wrapper.text()).toContain(\'欢迎使用\')\n  })\n})',
        verification: '测试通过'
      })
      steps.push({
        step: stepNumber++,
        action: '运行测试',
        command: 'npm test',
        verification: '所有测试通过'
      })
    }

    steps.push({
      step: stepNumber++,
      action: '验证解决方案',
      command: 'npm run dev',
      verification: '项目正常运行'
    })

    return steps
  }

  private estimateEffort(diagnosis: ProblemDiagnosis): string {
    const severity = diagnosis.severity
    const causeCount = diagnosis.possibleCauses.length

    if (severity === 'critical') {
      return '1-2小时'
    }
    if (severity === 'high') {
      return '2-4小时'
    }
    if (severity === 'medium') {
      return '4-8小时'
    }
    return '1-2天'
  }

  private identifyRisks(diagnosis: ProblemDiagnosis): string[] {
    const risks: string[] = []

    if (diagnosis.severity === 'critical') {
      risks.push('快速修复可能引入新问题')
      risks.push('需要充分测试')
    }
    if (diagnosis.possibleCauses.length > 3) {
      risks.push('可能需要多次尝试')
      risks.push('问题可能比预期复杂')
    }
    if (diagnosis.urgency === 'high') {
      risks.push('时间压力可能导致质量下降')
    }

    return risks
  }

  private generateAlternatives(diagnosis: ProblemDiagnosis): string[] {
    const alternatives: string[] = []

    alternatives.push('使用不同的技术栈')
    alternatives.push('重构相关代码')
    alternatives.push('寻求社区支持')
    alternatives.push('参考官方文档')

    return alternatives
  }

  generateWorkflow(problemType: string, projectPath: string): Workflow {
    console.log(`[SmartButlerExpert] 生成工作流: ${problemType}`)

    const workflow: Workflow = {
      workflowId: this.generateId(),
      name: this.getWorkflowName(problemType),
      description: this.getWorkflowDescription(problemType),
      trigger: problemType,
      steps: this.getWorkflowSteps(problemType, projectPath),
      conditions: [],
      expectedOutcome: this.getExpectedOutcome(problemType)
    }

    return workflow
  }

  private getWorkflowName(problemType: string): string {
    const lowerType = problemType.toLowerCase()

    if (lowerType.includes('依赖') || lowerType.includes('dependency')) {
      return '依赖安装工作流'
    }
    if (lowerType.includes('运行') || lowerType.includes('run')) {
      return '项目启动工作流'
    }
    if (lowerType.includes('构建') || lowerType.includes('build')) {
      return '项目构建工作流'
    }
    if (lowerType.includes('测试') || lowerType.includes('test')) {
      return '测试执行工作流'
    }
    if (lowerType.includes('界面') || lowerType.includes('ui')) {
      return 'UI开发工作流'
    }

    return '通用问题解决工作流'
  }

  private getWorkflowDescription(problemType: string): string {
    const lowerType = problemType.toLowerCase()

    if (lowerType.includes('依赖') || lowerType.includes('dependency')) {
      return '自动检查和安装项目依赖'
    }
    if (lowerType.includes('运行') || lowerType.includes('run')) {
      return '自动启动开发服务器'
    }
    if (lowerType.includes('构建') || lowerType.includes('build')) {
      return '自动构建项目'
    }
    if (lowerType.includes('测试') || lowerType.includes('test')) {
      return '自动运行测试'
    }
    if (lowerType.includes('界面') || lowerType.includes('ui')) {
      return '创建和优化UI组件'
    }

    return '解决项目问题'
  }

  private getWorkflowSteps(problemType: string, projectPath: string): any[] {
    const steps: any[] = []
    const lowerType = problemType.toLowerCase()

    if (lowerType.includes('依赖') || lowerType.includes('dependency')) {
      steps.push({
        step: 1,
        action: '检查 package.json',
        tool: 'file reader',
        parameters: { path: path.join(projectPath, 'package.json') }
      })
      steps.push({
        step: 2,
        action: '安装依赖',
        tool: 'npm',
        parameters: { command: 'install' },
        onSuccess: '依赖安装成功',
        onFailure: '检查网络连接和依赖配置'
      })
      steps.push({
        step: 3,
        action: '验证安装',
        tool: 'file system',
        parameters: { path: path.join(projectPath, 'node_modules') }
      })
    } else if (lowerType.includes('运行') || lowerType.includes('run')) {
      steps.push({
        step: 1,
        action: '检查启动脚本',
        tool: 'package.json reader',
        parameters: { path: projectPath }
      })
      steps.push({
        step: 2,
        action: '启动开发服务器',
        tool: 'npm',
        parameters: { command: 'run dev' },
        onSuccess: '开发服务器启动成功',
        onFailure: '检查依赖和配置'
      })
      steps.push({
        step: 3,
        action: '验证服务',
        tool: 'http',
        parameters: { url: 'http://localhost:5173' }
      })
    } else if (lowerType.includes('构建') || lowerType.includes('build')) {
      steps.push({
        step: 1,
        action: '检查构建配置',
        tool: 'config reader',
        parameters: { path: projectPath }
      })
      steps.push({
        step: 2,
        action: '运行构建',
        tool: 'npm',
        parameters: { command: 'run build' },
        onSuccess: '构建成功',
        onFailure: '检查构建错误'
      })
      steps.push({
        step: 3,
        action: '验证输出',
        tool: 'file system',
        parameters: { path: path.join(projectPath, 'dist') }
      })
    } else if (lowerType.includes('测试') || lowerType.includes('test')) {
      steps.push({
        step: 1,
        action: '检查测试配置',
        tool: 'config reader',
        parameters: { path: projectPath }
      })
      steps.push({
        step: 2,
        action: '运行测试',
        tool: 'npm',
        parameters: { command: 'test' },
        onSuccess: '测试通过',
        onFailure: '检查测试代码'
      })
      steps.push({
        step: 3,
        action: '生成报告',
        tool: 'test reporter',
        parameters: { format: 'html' }
      })
    } else if (lowerType.includes('界面') || lowerType.includes('ui')) {
      steps.push({
        step: 1,
        action: '分析UI需求',
        tool: 'product analyzer',
        parameters: { projectPath }
      })
      steps.push({
        step: 2,
        action: '创建UI组件',
        tool: 'code generator',
        parameters: { type: 'component' }
      })
      steps.push({
        step: 3,
        action: '添加样式',
        tool: 'style generator',
        parameters: { framework: 'tailwind' }
      })
      steps.push({
        step: 4,
        action: '测试UI',
        tool: 'e2e test',
        parameters: { scenarios: ['navigation', 'interaction'] }
      })
    }

    return steps
  }

  private getExpectedOutcome(problemType: string): string {
    const lowerType = problemType.toLowerCase()

    if (lowerType.includes('依赖') || lowerType.includes('dependency')) {
      return '所有依赖成功安装，项目可以正常运行'
    }
    if (lowerType.includes('运行') || lowerType.includes('run')) {
      return '开发服务器成功启动，可以访问应用'
    }
    if (lowerType.includes('构建') || lowerType.includes('build')) {
      return '项目成功构建，生成可部署的文件'
    }
    if (lowerType.includes('测试') || lowerType.includes('test')) {
      return '所有测试通过，代码质量得到保证'
    }
    if (lowerType.includes('界面') || lowerType.includes('ui')) {
      return 'UI组件创建完成，界面美观且功能正常'
    }

    return '问题得到解决'
  }

  learnFromExperience(experience: any) {
    const domain = experience.domain || 'general'
    
    if (!this.experiences.has(domain)) {
      this.experiences.set(domain, [])
    }

    const domainExperiences = this.experiences.get(domain)
    if (!domainExperiences) {
      this.experiences.set(domain, [])
      return
    }
    
    domainExperiences.push(experience)
    
    this.updateExpertiseLevel(domain, experience)
    this.saveExperiences()
    this.saveExpertiseLevels()
  }

  private updateExpertiseLevel(domain: string, experience: any) {
    let expertise = this.expertiseLevels.get(domain)
    
    if (!expertise) {
      expertise = {
        domain,
        level: 'novice',
        experiences: 0,
        successRate: 0,
        lastUpdated: Date.now()
      }
    }

    expertise.experiences++
    
    if (experience.outcome === 'success') {
      expertise.successRate = (expertise.successRate * (expertise.experiences - 1) + 1) / expertise.experiences
    } else {
      expertise.successRate = (expertise.successRate * (expertise.experiences - 1) + 0) / expertise.experiences
    }

    if (expertise.experiences >= 50 && expertise.successRate >= 0.9) {
      expertise.level = 'master'
    } else if (expertise.experiences >= 30 && expertise.successRate >= 0.8) {
      expertise.level = 'expert'
    } else if (expertise.experiences >= 15 && expertise.successRate >= 0.7) {
      expertise.level = 'practitioner'
    } else if (expertise.experiences >= 5 && expertise.successRate >= 0.6) {
      expertise.level = 'apprentice'
    }

    expertise.lastUpdated = Date.now()
    this.expertiseLevels.set(domain, expertise)
  }

  getExpertiseLevel(domain: string): any {
    return this.expertiseLevels.get(domain) || {
      domain,
      level: 'novice',
      experiences: 0,
      successRate: 0,
      lastUpdated: Date.now()
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private getProductKnowledge(): any {
    return {
      concepts: ['MVP', '用户故事', '产品路线图', '需求分析', '用户调研'],
      bestPractices: ['以用户为中心', '敏捷开发', '快速迭代', '数据驱动'],
      tools: ['Figma', 'Jira', 'Notion', 'Miro', 'Linear'],
      metrics: ['用户留存率', 'NPS', 'DAU/MAU', '转化率']
    }
  }

  private getUIKnowledge(): any {
    return {
      concepts: ['响应式设计', '可访问性', '设计系统', '组件化', '用户体验'],
      bestPractices: ['一致性原则', '移动优先', '可访问性', '性能优化'],
      tools: ['React', 'Vue', 'Tailwind CSS', 'Figma', 'Storybook'],
      metrics: ['页面加载时间', 'FCP', 'LCP', 'CLS']
    }
  }

  private getDevelopmentKnowledge(): any {
    return {
      concepts: ['代码复用', '设计模式', '代码审查', '重构', '架构设计'],
      bestPractices: ['DRY原则', 'SOLID原则', '测试驱动开发', '持续集成'],
      tools: ['TypeScript', 'ESLint', 'Prettier', 'Git', 'CI/CD'],
      metrics: ['代码覆盖率', '代码复杂度', '技术债务', '构建时间']
    }
  }

  private getTestingKnowledge(): any {
    return {
      concepts: ['单元测试', '集成测试', '端到端测试', '测试金字塔', 'TDD'],
      bestPractices: ['AAA模式', '测试独立性', '测试覆盖率', '自动化测试'],
      tools: ['Jest', 'Cypress', 'Playwright', 'Testing Library', 'Vitest'],
      metrics: ['测试通过率', '测试执行时间', '缺陷密度', '测试覆盖率']
    }
  }

  private getArchitectureKnowledge(): any {
    return {
      concepts: ['微服务', '单体架构', '事件驱动', '分层架构', 'API设计'],
      bestPractices: ['高内聚低耦合', '可扩展性', '容错性', '安全性'],
      tools: ['Docker', 'Kubernetes', 'Redis', 'Nginx', 'AWS'],
      metrics: ['系统可用性', '响应时间', '吞吐量', '错误率']
    }
  }
}
