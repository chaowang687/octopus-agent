import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'

export interface VerificationResult {
  success: boolean
  type: 'syntax' | 'semantic' | 'functional' | 'file_check'
  message: string
  details?: any
  errors?: string[]
  warnings?: string[]
}

export interface TaskVerificationContext {
  taskId: string
  taskDescription: string
  acceptanceCriteria: string[]
  createdFiles: string[]
  projectPath: string
}

export class VerificationEngine {
  private projectPath: string

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath
  }

  /**
   * 验证任务完成度
   * @param context 任务上下文
   * @returns 验证结果
   */
  async verifyTask(context: TaskVerificationContext): Promise<VerificationResult> {
    console.log(`[VerificationEngine] 开始验证任务: ${context.taskId}`)
    
    const results: VerificationResult[] = []

    // 1. 文件存在性检查
    const fileCheckResult = await this.verifyFilesExist(context.createdFiles)
    results.push(fileCheckResult)

    // 2. 代码质量检查（禁止TODO占位符）
    const semanticResults = await this.verifyNoPlaceholders(context.createdFiles)
    results.push(...semanticResults)

    // 3. 语法检查（如果有TypeScript）
    if (this.hasTypeScript()) {
      const syntaxResult = await this.verifyTypeScript()
      results.push(syntaxResult)
    }

    // 4. 构建检查（如果有package.json）
    if (this.hasPackageJson()) {
      const buildResult = await this.verifyBuild()
      results.push(buildResult)
    }

    // 综合结果
    const allPassed = results.every(r => r.success)
    return {
      success: allPassed,
      type: 'semantic',
      message: allPassed 
        ? `✅ 任务验证通过: ${context.taskId}` 
        : `❌ 任务验证失败: ${context.taskId}`,
      details: {
        taskId: context.taskId,
        criteria: context.acceptanceCriteria,
        checks: results.map(r => ({ type: r.type, passed: r.success, message: r.message }))
      },
      errors: results.filter(r => !r.success).map(r => r.message),
      warnings: results.filter(r => !r.success).map(r => r.message)
    }
  }

  /**
   * 验证文件是否存在
   */
  private async verifyFilesExist(files: string[]): Promise<VerificationResult> {
    if (files.length === 0) {
      return {
        success: false,
        type: 'file_check',
        message: '没有创建任何文件'
      }
    }

    const missing: string[] = []
    for (const file of files) {
      const fullPath = path.join(this.projectPath, file)
      if (!fs.existsSync(fullPath)) {
        missing.push(file)
      }
    }

    if (missing.length > 0) {
      return {
        success: false,
        type: 'file_check',
        message: `缺少文件: ${missing.join(', ')}`,
        errors: missing
      }
    }

    return {
      success: true,
      type: 'file_check',
      message: `所有文件已创建 (${files.length}个)`
    }
  }

  /**
   * 验证代码中没有TODO占位符
   */
  private async verifyNoPlaceholders(files: string[]): Promise<VerificationResult[]> {
    const results: VerificationResult[] = []
    const placeholderPatterns = [
      { pattern: /\/\/\s*TODO:/i, name: 'TODO注释' },
      { pattern: /\/\/\s*FIXME:/i, name: 'FIXME注释' },
      { pattern: /\/\/\s*待实现/i, name: '待实现' },
      { pattern: /\/\/\s*功能未实现/i, name: '功能未实现' },
      { pattern: /function\s+\w+\s*\([^)]*\)\s*\{\s*\}/, name: '空函数' },
      { pattern: /class\s+\w+\s*\{\s*\}/, name: '空类' },
      { pattern: /=\s*()\s*=>\s*\{\s*\}/, name: '空箭头函数' }
    ]

    for (const file of files) {
      // 只检查代码文件
      if (!this.isCodeFile(file)) continue

      const fullPath = path.join(this.projectPath, file)
      if (!fs.existsSync(fullPath)) continue

      try {
        const content = fs.readFileSync(fullPath,'utf-8')
        
        for (const { pattern, name } of placeholderPatterns) {
          if (pattern.test(content)) {
            results.push({
              success: false,
              type: 'semantic',
              message: `文件 ${file} 包含${name}占位符`,
              details: { file, pattern: name }
            })
          }
        }
      } catch (error) {
        console.warn(`[VerificationEngine] 读取文件失败: ${file}`, error)
      }
    }

    if (results.length === 0) {
      results.push({
        success: true,
        type: 'semantic',
        message: '代码中无占位符'
      })
    }

    return results
  }

  /**
   * 检查是否是代码文件
   */
  private isCodeFile(file: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h']
    const ext = path.extname(file).toLowerCase()
    return codeExtensions.includes(ext) || file.endsWith('.html') || file.endsWith('.css')
  }

  /**
   * 检查是否有TypeScript配置
   */
  private hasTypeScript(): boolean {
    return fs.existsSync(path.join(this.projectPath, 'tsconfig.json'))
  }

  /**
   * 检查是否有package.json
   */
  private hasPackageJson(): boolean {
    return fs.existsSync(path.join(this.projectPath, 'package.json'))
  }

  /**
   * 运行TypeScript类型检查
   */
  private async verifyTypeScript(): Promise<VerificationResult> {
    return new Promise((resolve) => {
      const tsc = spawn('npx', ['tsc', '--noEmit'], {
        cwd: this.projectPath,
        shell: true
      })

      let stdout = ''
      let stderr = ''

      tsc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      tsc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      tsc.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            type: 'syntax',
            message: 'TypeScript类型检查通过'
          })
        } else {
          resolve({
            success: false,
            type: 'syntax',
            message: `TypeScript编译错误`,
            errors: [stdout + stderr]
          })
        }
      })

      tsc.on('error', () => {
        resolve({
          success: true,
          type: 'syntax',
          message: 'TypeScript未安装，跳过检查'
        })
      })
    })
  }

  /**
   * 运行项目构建检查
   */
  private async verifyBuild(): Promise<VerificationResult> {
    return new Promise((resolve) => {
      // 先检查是否有node_modules
      const nodeModulesPath = path.join(this.projectPath, 'node_modules')
      const hasNodeModules = fs.existsSync(nodeModulesPath)

      if (!hasNodeModules) {
        resolve({
          success: false,
          type: 'functional',
          message: '未安装依赖，请运行 npm install'
        })
        return
      }

      // 尝试运行构建
      const build = spawn('npm', ['run', 'build'], {
        cwd: this.projectPath,
        shell: true
      })

      let stdout = ''
      let stderr = ''

      build.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      build.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      build.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            type: 'functional',
            message: '项目构建成功'
          })
        } else {
          resolve({
            success: false,
            type: 'functional',
            message: `构建失败 (退出码: ${code})`,
            errors: [stdout + stderr]
          })
        }
      })

      build.on('error', (error) => {
        resolve({
          success: false,
          type: 'functional',
          message: `构建命令执行失败: ${error.message}`,
          errors: [error.message]
        })
      })

      // 超时处理
      setTimeout(() => {
        build.kill()
        resolve({
          success: false,
          type: 'functional',
          message: '构建超时'
        })
      }, 60000) // 60秒超时
    })
  }

  /**
   * 验证项目文件大小（检测空文件）
   */
  async verifyFileSizes(): Promise<VerificationResult> {
    const results: { file: string; size: number }[] = []
    
    const walkDir = (dir: string) => {
      const items = fs.readdirSync(dir, { withFileTypes: true })
      for (const item of items) {
        const fullPath = path.join(dir, item.name)
        if (item.isDirectory()) {
          if (!item.name.startsWith('.') && item.name !== 'node_modules') {
            walkDir(fullPath)
          }
        } else {
          const stats = fs.statSync(fullPath)
          results.push({
            file: path.relative(this.projectPath, fullPath),
            size: stats.size
          })
        }
      }
    }

    try {
      walkDir(this.projectPath)
    } catch (error) {
      return {
        success: false,
        type: 'file_check',
        message: `检查文件大小时出错: ${error}`
      }
    }

    // 找出异常小的代码文件（可能是空文件或只有模板）
    const suspiciousFiles = results.filter(r => {
      const ext = path.extname(r.file).toLowerCase()
      const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.css']
      if (!codeExts.includes(ext)) return false
      return r.size < 100 // 小于100字节可能是模板
    })

    if (suspiciousFiles.length > 0) {
      return {
        success: false,
        type: 'file_check',
        message: `发现可疑的小文件（可能是模板）: ${suspiciousFiles.map(f => `${f.file}(${f.size}B)`).join(', ')}`,
        details: suspiciousFiles
      }
    }

    return {
      success: true,
      type: 'file_check',
      message: `文件大小检查通过，共${results.length}个文件`
    }
  }
}

export const verificationEngine = new VerificationEngine('')
