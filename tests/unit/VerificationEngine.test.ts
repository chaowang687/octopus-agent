import { VerificationEngine, TaskVerificationContext } from '../../src/main/agent/VerificationEngine'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('VerificationEngine', () => {
  let engine: VerificationEngine
  let testDir: string

  beforeEach(() => {
    // 创建临时测试目录
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verification-test-'))
    engine = new VerificationEngine(testDir)
  })

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('verifyTask', () => {
    it('应该验证任务完成度', async () => {
      // 创建测试文件
      const testFile = path.join(testDir, 'test.ts')
      fs.writeFileSync(testFile, 'console.log("hello")', 'utf-8')

      const context: TaskVerificationContext = {
        taskId: 'test-task-1',
        taskDescription: '创建测试文件',
        acceptanceCriteria: ['文件已创建'],
        createdFiles: [testFile],
        projectPath: testDir
      }

      const result = await engine.verifyTask(context)
      
      expect(result.success).toBe(true)
      expect(result.type).toBe('semantic')
      expect(result.details?.taskId).toBe('test-task-1')
    })

    it('应该检测缺失的文件', async () => {
      const context: TaskVerificationContext = {
        taskId: 'test-task-2',
        taskDescription: '创建不存在的文件',
        acceptanceCriteria: ['文件已创建'],
        createdFiles: [path.join(testDir, 'nonexistent.ts')],
        projectPath: testDir
      }

      const result = await engine.verifyTask(context)
      
      expect(result.success).toBe(false)
      expect(result.errors?.length).toBeGreaterThan(0)
    })

    it('应该检测代码占位符', async () => {
      // 创建包含TODO的文件
      const testFile = path.join(testDir, 'todo.ts')
      fs.writeFileSync(testFile, '// TODO: implement this', 'utf-8')

      const context: TaskVerificationContext = {
        taskId: 'test-task-3',
        taskDescription: '创建有占位符的文件',
        acceptanceCriteria: ['无TODO占位符'],
        createdFiles: [testFile],
        projectPath: testDir
      }

      const result = await engine.verifyTask(context)
      
      expect(result.success).toBe(false)
    })
  })

  describe('verifyFilesExist', () => {
    it('应该验证存在的文件', async () => {
      const testFile = path.join(testDir, 'exists.ts')
      fs.writeFileSync(testFile, 'export const x = 1', 'utf-8')

      const result = await engine.verifyTask({
        taskId: 'test',
        taskDescription: 'test',
        acceptanceCriteria: [],
        createdFiles: [testFile],
        projectPath: testDir
      })

      // 文件存在性检查应该通过
      expect(result.details?.checks?.some((c: any) => c.type === 'file_check' && c.passed)).toBe(true)
    })
  })

  describe('verifyNoPlaceholders', () => {
    it('应该检测TODO占位符', async () => {
      const testFile = path.join(testDir, 'placeholder.ts')
      fs.writeFileSync(testFile, `function test() {
  // TODO: implement
  return true
}`, 'utf-8')

      const result = await engine.verifyTask({
        taskId: 'test',
        taskDescription: 'test',
        acceptanceCriteria: [],
        createdFiles: [testFile],
        projectPath: testDir
      })

      // TODO检测应该失败
      const hasPlaceholderCheck = result.details?.checks?.some((c: any) => 
        c.type === 'semantic' && !c.passed && c.message.includes('TODO')
      )
      expect(hasPlaceholderCheck).toBe(true)
    })

    it('应该检测FIXME占位符', async () => {
      const testFile = path.join(testDir, 'fixme.ts')
      fs.writeFileSync(testFile, `// FIXME: this is broken`, 'utf-8')

      const result = await engine.verifyTask({
        taskId: 'test',
        taskDescription: 'test',
        acceptanceCriteria: [],
        createdFiles: [testFile],
        projectPath: testDir
      })

      const hasFixmeCheck = result.details?.checks?.some((c: any) => 
        c.type === 'semantic' && !c.passed && c.message.includes('FIXME')
      )
      expect(hasFixmeCheck).toBe(true)
    })

    it('应该通过没有占位符的代码', async () => {
      const testFile = path.join(testDir, 'clean.ts')
      fs.writeFileSync(testFile, `function hello() {
  console.log("Hello World")
  return "hello"
}`, 'utf-8')

      const result = await engine.verifyTask({
        taskId: 'test',
        taskDescription: 'test',
        acceptanceCriteria: [],
        createdFiles: [testFile],
        projectPath: testDir
      })

      // 如果没有占位符，占位符检查应该通过
      const placeholderChecks = result.details?.checks?.filter((c: any) => c.type === 'semantic')
      const allPassed = placeholderChecks?.every((c: any) => c.passed)
      expect(allPassed || placeholderChecks?.length === 0).toBe(true)
    })
  })

  describe('verifyBuild', () => {
    it('应该检查package.json存在', async () => {
      const pkgFile = path.join(testDir, 'package.json')
      fs.writeFileSync(pkgFile, JSON.stringify({ name: 'test', version: '1.0.0' }), 'utf-8')

      const result = await engine.verifyTask({
        taskId: 'test',
        taskDescription: 'test',
        acceptanceCriteria: [],
        createdFiles: [pkgFile],
        projectPath: testDir
      })

      // 应该有构建检查
      expect(result.details?.checks?.some((c: any) => c.type === 'functional')).toBe(true)
    })
  })

  describe('边界情况', () => {
    it('应该处理空文件列表', async () => {
      const result = await engine.verifyTask({
        taskId: 'test',
        taskDescription: 'test',
        acceptanceCriteria: [],
        createdFiles: [],
        projectPath: testDir
      })

      // 空文件列表应该通过文件存在性检查
      expect(result.details?.checks?.some((c: any) => c.type === 'file_check' && c.passed)).toBe(true)
    })

    it('应该处理空目录', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-test-'))
      
      try {
        const result = await engine.verifyTask({
          taskId: 'test',
          taskDescription: 'test',
          acceptanceCriteria: [],
          createdFiles: [],
          projectPath: emptyDir
        })

        expect(result.success).toBe(true)
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true })
      }
    })
  })
})
