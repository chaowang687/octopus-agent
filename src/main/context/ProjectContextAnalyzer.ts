import * as fs from 'fs'
import * as path from 'path'
import { FileCache } from '../utils/FileCache'

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

const IGNORE_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', '.svn', '.hg',
  '__pycache__', 'venv', '.venv', 'env', '.env',
  '.next', '.nuxt', 'coverage', '.cache', 'tmp', 'temp'
])

const CONFIG_FILES = new Set([
  'package.json', 'tsconfig.json', 'jsconfig.json',
  '.eslintrc', '.eslintrc.json', '.eslintrc.js', 'eslint.config.js',
  '.prettierrc', '.prettierrc.json', '.prettierrc.js',
  'vite.config.ts', 'vite.config.js', 'webpack.config.js',
  'rollup.config.js', 'electron.vite.config.ts'
])

export class ProjectContextAnalyzer {
  private contexts: Map<string, ProjectContext> = new Map()
  private contextCachePath: string
  private fileCache: FileCache

  constructor(cachePath?: string) {
    this.contextCachePath = cachePath || path.join(process.cwd(), '.project-contexts.json')
    this.fileCache = new FileCache(500, 50)
    this.loadContexts()
  }

  async analyzeProject(projectPath: string): Promise<ProjectContext> {
    const context = this.contexts.get(projectPath)
    if (context && await this.isContextValid(context, projectPath)) {
      console.log(`[ProjectContextAnalyzer] Using cached context: ${projectPath}`)
      return context
    }

    console.log(`[ProjectContextAnalyzer] Analyzing project: ${projectPath}`)
    const newContext = await this.buildContext(projectPath)
    this.contexts.set(projectPath, newContext)
    this.saveContexts()
    return newContext
  }

  private async buildContext(projectPath: string): Promise<ProjectContext> {
    const projectName = path.basename(projectPath)
    const packageJson = await this.readJsonFile(path.join(projectPath, 'package.json'))

    const [projectType, language, framework, buildSystem, packageManager, testFramework, structure] = await Promise.all([
      this.detectProjectType(projectPath, packageJson),
      this.detectLanguage(projectPath),
      this.detectFramework(projectPath, packageJson),
      this.detectBuildSystem(projectPath, packageJson),
      this.detectPackageManager(projectPath),
      this.detectTestFramework(projectPath, packageJson),
      this.analyzeStructure(projectPath)
    ])

    const dependencies = this.extractDependencies(packageJson)
    const scripts = this.extractScripts(packageJson)
    const conventions = await this.analyzeConventions(projectPath, packageJson)
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

  private async detectProjectType(projectPath: string, _packageJson: any): Promise<string> {
    const checks = [
      ['electron.vite.config.ts', 'electron'],
      ['next.config.js', 'nextjs'],
      ['next.config.mjs', 'nextjs'],
      ['vite.config.ts', 'vite'],
      ['vite.config.js', 'vite'],
      ['webpack.config.js', 'webpack'],
      ['angular.json', 'angular'],
      ['vue.config.js', 'vue']
    ]

    for (const [file, type] of checks) {
      if (fs.existsSync(path.join(projectPath, file))) {
        return type
      }
    }
    return 'unknown'
  }

  private async detectLanguage(projectPath: string): Promise<string> {
    const counts = await this.countFileExtensions(projectPath, ['.ts', '.tsx', '.js', '.jsx', '.py'])
    
    const tsCount = counts['.ts'] + counts['.tsx']
    const jsCount = counts['.js'] + counts['.jsx']
    const pyCount = counts['.py']

    if (tsCount > jsCount) return 'typescript'
    if (jsCount > 0) return 'javascript'
    if (pyCount > 0) return 'python'

    return 'unknown'
  }

  private async countFileExtensions(dir: string, extensions: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {}
    for (const ext of extensions) {
      counts[ext] = 0
    }

    const countInDir = async (currentPath: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })
        
        const promises: Promise<void>[] = []
        
        for (const entry of entries) {
          if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) {
            continue
          }

          const fullPath = path.join(currentPath, entry.name)

          if (entry.isDirectory()) {
            promises.push(countInDir(fullPath))
          } else if (entry.isFile()) {
            for (const ext of extensions) {
              if (entry.name.endsWith(ext)) {
                counts[ext]++
                break
              }
            }
          }
        }

        await Promise.all(promises)
      } catch (error) {
        console.error(`[ProjectContextAnalyzer] Error reading directory ${currentPath}:`, error)
      }
    }

    await countInDir(dir)
    return counts
  }

  private detectFramework(_projectPath: string, packageJson: any): string {
    const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies }

    if (deps['react']) return 'react'
    if (deps['vue']) return 'vue'
    if (deps['angular'] || deps['@angular/core']) return 'angular'
    if (deps['svelte']) return 'svelte'
    if (deps['express']) return 'express'
    if (deps['next']) return 'nextjs'
    if (deps['nuxt']) return 'nuxtjs'
    if (deps['electron']) return 'electron'

    return 'none'
  }

  private detectBuildSystem(projectPath: string, _packageJson: any): string {
    const checks = [
      ['vite.config.ts', 'vite'],
      ['vite.config.js', 'vite'],
      ['webpack.config.js', 'webpack'],
      ['rollup.config.js', 'rollup'],
      ['tsconfig.json', 'tsc']
    ]

    for (const [file, system] of checks) {
      if (fs.existsSync(path.join(projectPath, file))) {
        return system
      }
    }
    return 'none'
  }

  private async detectPackageManager(projectPath: string): Promise<string> {
    if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn'
    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm'
    if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) return 'bun'
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
    if (deps['cypress']) return 'cypress'
    if (deps['@playwright/test']) return 'playwright'

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

    try {
      const entries = await fs.promises.readdir(projectPath, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') {
            directories.push(entry.name)
          }
        } else if (entry.isFile()) {
          if (CONFIG_FILES.has(entry.name) || entry.name.endsWith('.config.ts') || entry.name.endsWith('.config.js')) {
            configFiles.push(entry.name)
          } else if (['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js'].includes(entry.name)) {
            mainFiles.push(entry.name)
          }
        }
      }
    } catch (error) {
      console.error(`[ProjectContextAnalyzer] Error analyzing structure:`, error)
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

  private async analyzeConventions(projectPath: string, _packageJson: any): Promise<{
    codeStyle: string
    fileNaming: string
    directoryStructure: string
    documentation: string
  }> {
    const hasEslint = fs.existsSync(path.join(projectPath, '.eslintrc.json')) ||
                      fs.existsSync(path.join(projectPath, '.eslintrc.js')) ||
                      fs.existsSync(path.join(projectPath, 'eslint.config.js'))
    
    const hasPrettier = fs.existsSync(path.join(projectPath, '.prettierrc')) ||
                        fs.existsSync(path.join(projectPath, '.prettierrc.json'))

    const tsconfig = await this.readJsonFile(path.join(projectPath, 'tsconfig.json'))
    const hasReadme = fs.existsSync(path.join(projectPath, 'README.md'))
    const hasDocs = fs.existsSync(path.join(projectPath, 'docs'))

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

  private async readJsonFile(filePath: string): Promise<any> {
    try {
      if (fs.existsSync(filePath)) {
        return await this.fileCache.getOrLoad(filePath, async () => {
          const content = await fs.promises.readFile(filePath, 'utf-8')
          return JSON.parse(content)
        })
      }
    } catch (error) {
      console.error(`[ProjectContextAnalyzer] Failed to read JSON file ${filePath}:`, error)
    }
    return {}
  }

  private async isContextValid(context: ProjectContext, projectPath: string): Promise<boolean> {
    const maxAge = 24 * 60 * 60 * 1000
    if (Date.now() - context.lastUpdated >= maxAge) {
      return false
    }

    const packageJsonPath = path.join(projectPath, 'package.json')
    try {
      const stat = await fs.promises.stat(packageJsonPath)
      return stat.mtimeMs <= context.lastUpdated
    } catch {
      return true
    }
  }

  private loadContexts(): void {
    try {
      if (fs.existsSync(this.contextCachePath)) {
        const content = fs.readFileSync(this.contextCachePath, 'utf-8')
        const data = JSON.parse(content)
        for (const [projectPath, context] of Object.entries(data)) {
          this.contexts.set(projectPath, context as ProjectContext)
        }
        console.log('[ProjectContextAnalyzer] Loaded project context cache')
      }
    } catch (error) {
      console.error('[ProjectContextAnalyzer] Failed to load context cache:', error)
    }
  }

  private saveContexts(): void {
    try {
      const data = Object.fromEntries(this.contexts)
      fs.writeFileSync(this.contextCachePath, JSON.stringify(data, null, 2))
      console.log('[ProjectContextAnalyzer] Saved project context cache')
    } catch (error) {
      console.error('[ProjectContextAnalyzer] Failed to save context cache:', error)
    }
  }

  getContext(projectPath: string): ProjectContext | undefined {
    return this.contexts.get(projectPath)
  }

  generateProjectGuide(context: ProjectContext): string {
    return `# Project Guide: ${context.projectName}

## Project Information
- Path: ${context.projectPath}
- Type: ${context.projectType}
- Language: ${context.language}
- Framework: ${context.framework}
- Build System: ${context.buildSystem}
- Package Manager: ${context.packageManager}
- Test Framework: ${context.testFramework}

## Project Structure
Main Directories: ${context.structure.directories.join(', ') || 'None'}
Main Files: ${context.structure.mainFiles.join(', ') || 'None'}
Config Files: ${context.structure.configFiles.join(', ') || 'None'}

## Dependencies
Production: ${Object.keys(context.dependencies.production).slice(0, 10).join(', ') || 'None'}
Development: ${Object.keys(context.dependencies.development).slice(0, 10).join(', ') || 'None'}

## Available Scripts
${Object.entries(context.scripts).map(([name, script]) => `- ${name}: ${script}`).join('\n') || 'None'}

## Code Conventions
- Code Style: ${context.conventions.codeStyle}
- File Naming: ${context.conventions.fileNaming}
- Directory Structure: ${context.conventions.directoryStructure}
- Documentation: ${context.conventions.documentation}

## Notes
1. Use ${context.packageManager} as package manager
2. Run ${context.packageManager} install to install dependencies
3. Use ${context.packageManager} run dev to start development server
4. Use ${context.packageManager} run build to build the project
${context.testFramework !== 'none' ? `5. Use ${context.packageManager} test to run tests` : ''}
`
  }

  invalidateContext(projectPath: string): void {
    this.contexts.delete(projectPath)
    this.fileCache.invalidate(projectPath)
    this.saveContexts()
  }

  clearCache(): void {
    this.contexts.clear()
    this.fileCache.clear()
    this.saveContexts()
  }
}

export const projectContextAnalyzer = new ProjectContextAnalyzer()
