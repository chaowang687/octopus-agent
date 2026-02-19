import * as fs from 'fs'
import * as path from 'path'

export interface ProjectContext {
  projectPath: string
  projectName: string
  projectType: string
  language: string
  framework: string
  buildSystem: string
  packageManager: string
  testFramework: string
  structure: {
    directories: string[]
    mainFiles: string[]
    configFiles: string[]
  }
  dependencies: {
    production: Record<string, string>
    development: Record<string, string>
  }
  scripts: Record<string, string>
  conventions: {
    codeStyle: string
    fileNaming: string
    directoryStructure: string
    documentation: string
  }
  metadata: {
    version?: string
    author?: string
    license?: string
    description?: string
  }
  lastUpdated: number
}

export class ProjectContextAnalyzer {
  private contexts: Map<string, ProjectContext> = new Map()
  private contextCachePath: string

  constructor(cachePath?: string) {
    this.contextCachePath = cachePath || path.join(process.cwd(), '.project-contexts.json')
    this.loadContexts()
  }

  async analyzeProject(projectPath: string): Promise<ProjectContext> {
    const context = this.contexts.get(projectPath)
    if (context && this.isContextValid(context)) {
      console.log(`[ProjectContextAnalyzer] 使用缓存的上下文: ${projectPath}`)
      return context
    }

    console.log(`[ProjectContextAnalyzer] 分析项目: ${projectPath}`)
    const newContext = await this.buildContext(projectPath)
    this.contexts.set(projectPath, newContext)
    this.saveContexts()
    return newContext
  }

  private async buildContext(projectPath: string): Promise<ProjectContext> {
    const projectName = path.basename(projectPath)
    const packageJsonPath = path.join(projectPath, 'package.json')
    const packageJson = this.readJsonFile(packageJsonPath)

    const projectType = this.detectProjectType(projectPath, packageJson)
    const language = this.detectLanguage(projectPath, packageJson)
    const framework = this.detectFramework(projectPath, packageJson)
    const buildSystem = this.detectBuildSystem(projectPath, packageJson)
    const packageManager = this.detectPackageManager(projectPath)
    const testFramework = this.detectTestFramework(projectPath, packageJson)

    const structure = await this.analyzeStructure(projectPath)
    const dependencies = this.extractDependencies(packageJson)
    const scripts = this.extractScripts(packageJson)
    const conventions = this.analyzeConventions(projectPath, packageJson)
    const metadata = this.extractMetadata(packageJson)

    return {
      projectPath,
      projectName,
      projectType,
      language,
      framework,
      buildSystem,
      packageManager,
      testFramework,
      structure,
      dependencies,
      scripts,
      conventions,
      metadata,
      lastUpdated: Date.now()
    }
  }

  private detectProjectType(projectPath: string, _packageJson: any): string {
    if (fs.existsSync(path.join(projectPath, 'electron.vite.config.ts'))) {
      return 'electron'
    }
    if (fs.existsSync(path.join(projectPath, 'next.config.js'))) {
      return 'nextjs'
    }
    if (fs.existsSync(path.join(projectPath, 'vite.config.ts'))) {
      return 'vite'
    }
    if (fs.existsSync(path.join(projectPath, 'webpack.config.js'))) {
      return 'webpack'
    }
    if (fs.existsSync(path.join(projectPath, 'angular.json'))) {
      return 'angular'
    }
    if (fs.existsSync(path.join(projectPath, 'vue.config.js'))) {
      return 'vue'
    }
    return 'unknown'
  }

  private detectLanguage(projectPath: string, packageJson: any): string {
    const tsFiles = this.findFiles(projectPath, '.ts', ['node_modules', 'dist', 'build'])
    const jsFiles = this.findFiles(projectPath, '.js', ['node_modules', 'dist', 'build'])
    const pyFiles = this.findFiles(projectPath, '.py', ['node_modules', '__pycache__', 'venv', '.venv'])

    if (tsFiles.length > jsFiles.length) return 'typescript'
    if (jsFiles.length > 0) return 'javascript'
    if (pyFiles.length > 0) return 'python'

    return packageJson?.devDependencies?.typescript ? 'typescript' : 'javascript'
  }

  private findFiles(dir: string, extension: string, ignoreDirs: string[] = []): string[] {
    const files: string[] = []
    
    const walk = (currentPath: string) => {
      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name)
          const relativePath = path.relative(dir, fullPath)
          
          if (entry.isDirectory()) {
            const shouldIgnore = ignoreDirs.some(ignoreDir => 
              relativePath.startsWith(ignoreDir) || 
              entry.name === ignoreDir
            )
            if (!shouldIgnore) {
              walk(fullPath)
            }
          } else if (entry.isFile() && entry.name.endsWith(extension)) {
            files.push(fullPath)
          }
        }
      } catch (error) {
        console.error(`[ProjectContextAnalyzer] 读取目录失败 ${currentPath}:`, error)
      }
    }
    
    walk(dir)
    return files
  }

  private detectFramework(_projectPath: string, packageJson: any): string {
    const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies }

    if (deps['react']) return 'react'
    if (deps['vue']) return 'vue'
    if (deps['angular']) return 'angular'
    if (deps['svelte']) return 'svelte'
    if (deps['express']) return 'express'
    if (deps['next']) return 'nextjs'
    if (deps['nuxt']) return 'nuxtjs'

    return 'none'
  }

  private detectBuildSystem(projectPath: string, _packageJson: any): string {
    if (fs.existsSync(path.join(projectPath, 'vite.config.ts'))) return 'vite'
    if (fs.existsSync(path.join(projectPath, 'webpack.config.js'))) return 'webpack'
    if (fs.existsSync(path.join(projectPath, 'rollup.config.js'))) return 'rollup'
    if (fs.existsSync(path.join(projectPath, 'tsconfig.json'))) return 'tsc'

    return 'none'
  }

  private detectPackageManager(projectPath: string): string {
    if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn'
    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm'
    if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) return 'npm'

    return 'npm'
  }

  private detectTestFramework(_projectPath: string, packageJson: any): string {
    const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies }

    if (deps['jest']) return 'jest'
    if (deps['vitest']) return 'vitest'
    if (deps['mocha']) return 'mocha'
    if (deps['jasmine']) return 'jasmine'
    if (deps['@testing-library/react']) return 'testing-library'

    return 'none'
  }

  private async analyzeStructure(projectPath: string): Promise<{
    directories: string[]
    mainFiles: string[]
    configFiles: string[]
  }> {
    const directories: string[] = []
    const mainFiles: string[] = []
    const configFiles: string[] = []

    const entries = fs.readdirSync(projectPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        directories.push(entry.name)
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.config.ts') || entry.name.endsWith('.config.js')) {
          configFiles.push(entry.name)
        } else if (entry.name === 'package.json' || entry.name === 'tsconfig.json') {
          configFiles.push(entry.name)
        } else if (entry.name === 'index.ts' || entry.name === 'index.js' || entry.name === 'main.ts') {
          mainFiles.push(entry.name)
        }
      }
    }

    return { directories, mainFiles, configFiles }
  }

  private extractDependencies(packageJson: any): {
    production: Record<string, string>
    development: Record<string, string>
  } {
    return {
      production: packageJson?.dependencies || {},
      development: packageJson?.devDependencies || {}
    }
  }

  private extractScripts(packageJson: any): Record<string, string> {
    return packageJson?.scripts || {}
  }

  private analyzeConventions(projectPath: string, _packageJson: any): {
    codeStyle: string
    fileNaming: string
    directoryStructure: string
    documentation: string
  } {
    const tsconfigPath = path.join(projectPath, 'tsconfig.json')
    const tsconfig = this.readJsonFile(tsconfigPath)

    const eslintPath = path.join(projectPath, '.eslintrc.json') ||
                        path.join(projectPath, '.eslintrc.js') ||
                        path.join(projectPath, 'eslint.config.js')
    const hasEslint = fs.existsSync(eslintPath)

    const prettierPath = path.join(projectPath, '.prettierrc') ||
                         path.join(projectPath, '.prettierrc.json')
    const hasPrettier = fs.existsSync(prettierPath)

    const readmePath = path.join(projectPath, 'README.md')
    const hasReadme = fs.existsSync(readmePath)

    const docsPath = path.join(projectPath, 'docs')
    const hasDocs = fs.existsSync(docsPath)

    return {
      codeStyle: hasEslint ? 'eslint' : hasPrettier ? 'prettier' : 'none',
      fileNaming: tsconfig?.compilerOptions?.strict ? 'strict' : 'standard',
      directoryStructure: this.detectDirectoryStructure(projectPath),
      documentation: hasDocs ? 'docs' : hasReadme ? 'readme' : 'none'
    }
  }

  private detectDirectoryStructure(projectPath: string): string {
    const hasSrc = fs.existsSync(path.join(projectPath, 'src'))
    const hasComponents = fs.existsSync(path.join(projectPath, 'src', 'components'))
    const hasPages = fs.existsSync(path.join(projectPath, 'src', 'pages'))
    const hasUtils = fs.existsSync(path.join(projectPath, 'src', 'utils'))

    if (hasSrc && hasComponents && hasPages) return 'feature-based'
    if (hasSrc && hasUtils) return 'layered'
    if (hasSrc) return 'standard'
    return 'flat'
  }

  private extractMetadata(packageJson: any): {
    version?: string
    author?: string
    license?: string
    description?: string
  } {
    return {
      version: packageJson?.version,
      author: packageJson?.author,
      license: packageJson?.license,
      description: packageJson?.description
    }
  }

  private readJsonFile(filePath: string): any {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(content)
      }
    } catch (error) {
      console.error(`[ProjectContextAnalyzer] 读取 JSON 文件失败 ${filePath}:`, error)
    }
    return {}
  }

  private isContextValid(context: ProjectContext): boolean {
    const maxAge = 24 * 60 * 60 * 1000
    return Date.now() - context.lastUpdated < maxAge
  }

  private loadContexts(): void {
    try {
      if (fs.existsSync(this.contextCachePath)) {
        const content = fs.readFileSync(this.contextCachePath, 'utf-8')
        const data = JSON.parse(content)
        for (const [projectPath, context] of Object.entries(data)) {
          this.contexts.set(projectPath, context as ProjectContext)
        }
        console.log('[ProjectContextAnalyzer] 加载项目上下文缓存')
      }
    } catch (error) {
      console.error('[ProjectContextAnalyzer] 加载上下文缓存失败:', error)
    }
  }

  private saveContexts(): void {
    try {
      const data = Object.fromEntries(this.contexts)
      fs.writeFileSync(this.contextCachePath, JSON.stringify(data, null, 2))
      console.log('[ProjectContextAnalyzer] 保存项目上下文缓存')
    } catch (error) {
      console.error('[ProjectContextAnalyzer] 保存上下文缓存失败:', error)
    }
  }

  getContext(projectPath: string): ProjectContext | undefined {
    return this.contexts.get(projectPath)
  }

  generateProjectGuide(context: ProjectContext): string {
    return `# 项目指南: ${context.projectName}

## 项目信息
- 项目路径: ${context.projectPath}
- 项目类型: ${context.projectType}
- 编程语言: ${context.language}
- 框架: ${context.framework}
- 构建系统: ${context.buildSystem}
- 包管理器: ${context.packageManager}
- 测试框架: ${context.testFramework}

## 项目结构
主要目录: ${context.structure.directories.join(', ') || '无'}
主要文件: ${context.structure.mainFiles.join(', ') || '无'}
配置文件: ${context.structure.configFiles.join(', ') || '无'}

## 依赖管理
生产依赖: ${Object.keys(context.dependencies.production).slice(0, 10).join(', ') || '无'}
开发依赖: ${Object.keys(context.dependencies.development).slice(0, 10).join(', ') || '无'}

## 可用脚本
${Object.entries(context.scripts).map(([name, script]) => `- ${name}: ${script}`).join('\n') || '无'}

## 代码规范
- 代码风格: ${context.conventions.codeStyle}
- 文件命名: ${context.conventions.fileNaming}
- 目录结构: ${context.conventions.directoryStructure}
- 文档: ${context.conventions.documentation}

## 注意事项
1. 使用 ${context.packageManager} 作为包管理器
2. 运行 ${context.packageManager} install 安装依赖
3. 使用 ${context.packageManager} run dev 启动开发服务器
4. 使用 ${context.packageManager} run build 构建项目
${context.testFramework !== 'none' ? `5. 使用 ${context.packageManager} test 运行测试` : ''}
`
  }

  invalidateContext(projectPath: string): void {
    this.contexts.delete(projectPath)
    this.saveContexts()
  }
}

export const projectContextAnalyzer = new ProjectContextAnalyzer()
