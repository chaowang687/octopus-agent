/**
 * WorkspaceManager 集成测试
 * 验证文件创建、读取、验证功能
 */

import { WorkspaceManager } from '../../src/main/services/WorkspaceManager'
import * as fs from 'fs'
import * as path from 'path'

describe('WorkspaceManager 集成测试', () => {
  let workspaceManager: WorkspaceManager
  const testSessionId = `test_${Date.now()}`

  beforeEach(() => {
    workspaceManager = new WorkspaceManager(testSessionId)
  })

  afterEach(async () => {
    // 清理测试工作区
    await workspaceManager.cleanup()
  })

  describe('文件写入和读取', () => {
    it('应该能够写入文件', async () => {
      const content = 'Hello World'
      const filePath = 'test.txt'
      
      const fullPath = await workspaceManager.writeFile(filePath, content)
      
      expect(fs.existsSync(fullPath)).toBe(true)
      expect(fs.readFileSync(fullPath, 'utf-8')).toBe(content)
    })

    it('应该能够读取文件', async () => {
      const content = 'Test Content'
      const filePath = 'read_test.txt'
      
      await workspaceManager.writeFile(filePath, content)
      const readContent = await workspaceManager.readFile(filePath)
      
      expect(readContent).toBe(content)
    })

    it('应该能够批量写入文件', async () => {
      const files = [
        { path: 'dir1/file1.txt', content: 'Content 1' },
        { path: 'dir2/file2.txt', content: 'Content 2' },
        { path: 'dir3/file3.txt', content: 'Content 3' }
      ]
      
      const writtenPaths = await workspaceManager.writeFiles(files)
      
      expect(writtenPaths).toHaveLength(3)
      expect(fs.existsSync(writtenPaths[0])).toBe(true)
      expect(fs.existsSync(writtenPaths[1])).toBe(true)
      expect(fs.existsSync(writtenPaths[2])).toBe(true)
    })

    it('应该能够批量读取文件', async () => {
      const files = [
        { path: 'batch1.txt', content: 'Batch Content 1' },
        { path: 'batch2.txt', content: 'Batch Content 2' }
      ]
      
      await workspaceManager.writeFiles(files)
      const readFiles = await workspaceManager.readFiles(['batch1.txt', 'batch2.txt'])
      
      expect(readFiles).toHaveLength(2)
      expect(readFiles[0].content).toBe('Batch Content 1')
      expect(readFiles[1].content).toBe('Batch Content 2')
    })
  })

  describe('文件验证', () => {
    it('应该能够检查文件是否存在', async () => {
      const filePath = 'exists_test.txt'
      
      expect(await workspaceManager.exists(filePath)).toBe(false)
      
      await workspaceManager.writeFile(filePath, 'content')
      
      expect(await workspaceManager.exists(filePath)).toBe(true)
    })

    it('应该能够验证多个文件并返回存在和不存在的列表', async () => {
      await workspaceManager.writeFile('file1.txt', 'content1')
      await workspaceManager.writeFile('file2.txt', 'content2')
      
      const result = await workspaceManager.verifyFiles([
        'file1.txt',
        'file2.txt',
        'missing.txt'
      ])
      
      expect(result.exists).toContain('file1.txt')
      expect(result.exists).toContain('file2.txt')
      expect(result.missing).toContain('missing.txt')
    })
  })

  describe('目录操作', () => {
    it('应该能够列出目录中的文件', async () => {
      await workspaceManager.writeFile('dir/file1.txt', 'content1')
      await workspaceManager.writeFile('dir/file2.txt', 'content2')
      await workspaceManager.writeFile('root.txt', 'root content')
      
      const files = await workspaceManager.listFiles('', false)
      
      expect(files.length).toBeGreaterThan(0)
    })

    it('应该能够递归列出所有文件', async () => {
      await workspaceManager.writeFile('level1/level2/deep.txt', 'deep content')
      await workspaceManager.writeFile('root.txt', 'root')
      
      const files = await workspaceManager.listFiles('', true)
      const allPaths = files.map(f => f.path)
      
      expect(allPaths).toContain('level1/level2/deep.txt')
      expect(allPaths).toContain('root.txt')
    })

    it('应该能够获取项目结构', async () => {
      await workspaceManager.writeFile('src/index.ts', 'console.log("hello")')
      await workspaceManager.writeFile('src/utils.ts', 'export const util = () => {}')
      await workspaceManager.writeFile('package.json', '{}')
      
      const structure = await workspaceManager.getProjectStructure()
      
      expect(structure).toBeDefined()
      expect(structure.type).toBe('directory')
      expect(structure.children).toBeDefined()
    })
  })

  describe('统计信息', () => {
    it('应该能够获取工作区统计信息', async () => {
      await workspaceManager.writeFile('file1.txt', 'a'.repeat(100))
      await workspaceManager.writeFile('file2.txt', 'b'.repeat(200))
      await workspaceManager.writeFile('src/file3.txt', 'c'.repeat(50))
      
      const stats = await workspaceManager.getStats()
      
      expect(stats.totalFiles).toBe(3)
      expect(stats.totalDirectories).toBeGreaterThan(0)
      expect(stats.totalSize).toBe(350)
    })
  })

  describe('安全性', () => {
    it('应该能够防止路径遍历攻击', async () => {
      await expect(
        workspaceManager.readFile('../../../etc/passwd')
      ).rejects.toThrow('路径遍历攻击检测')
    })

    it('应该能够防止绝对路径攻击', async () => {
      await expect(
        workspaceManager.readFile('/etc/passwd')
      ).rejects.toThrow()
    })
  })

  describe('MultiAgentCoordinator 集成', () => {
    it('MultiAgentCoordinator 应该能够创建工作区并获取路径', async () => {
      const { MultiAgentCoordinator } = await import('../../src/main/agent/MultiAgentCoordinator')
      
      const coordinator = new MultiAgentCoordinator()
      const workspacePath = coordinator.getWorkspacePath()
      
      expect(workspacePath).toBeDefined()
      expect(workspacePath).toContain('workspaces')
      
      // 验证目录已创建
      expect(fs.existsSync(workspacePath!)).toBe(true)
})

    it('MultiAgentCoordinator 应该能够获取文件列表', async () => {
      const { MultiAgentCoordinator } = await import('../../src/main/agent/MultiAgentCoordinator')
      
      const coordinator = new MultiAgentCoordinator()
      const wsManager = coordinator.getWorkspaceManager()
      
      // 写入测试文件
      await wsManager?.writeFile('test_integration.txt', 'Integration test content')
      
      // 获取文件列表
      const files = await wsManager?.listFiles('', true)
      
      expect(files).toBeDefined()
      expect(files!.length).toBeGreaterThan(0)
    })
  })
})
