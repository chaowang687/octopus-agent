/**
 * 项目管理功能测试 - 核心功能验证
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { ProjectManager, Project, ProjectTask } from '../../src/main/services/ProjectManager'
import * as fs from 'fs'
import * as path from 'path'
import os from 'os'

describe('项目管理功能测试', () => {
  let tempDir: string

  beforeEach(() => {
    // 不需要临时目录，使用内存存储
  })

  afterEach(() => {
    // 不需要清理，内存存储会自动清理
  })

  describe('项目CRUD操作', () => {
    it('应该能够创建项目', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '这是一个测试项目',
        priority: 'high',
        estimatedHours: 40
      })

      expect(project).toBeDefined()
      expect(project.title).toBe('测试项目')
      expect(project.description).toBe('这是一个测试项目')
      expect(project.priority).toBe('high')
      expect(project.estimatedHours).toBe(40)
      expect(project.status).toBe('planning')
      expect(project.progress).toBe(0)
    })

    it('应该能够获取项目', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const created = projectManager.createProject({
        title: '测试项目',
        description: '测试描述'
      })

      const retrieved = projectManager.getProject(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.title).toBe('测试项目')
    })

    it('应该能够列出所有项目', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project1 = projectManager.createProject({ title: '项目1' })
      const project2 = projectManager.createProject({ title: '项目2' })
      const project3 = projectManager.createProject({ title: '项目3' })

      const projects = projectManager.listProjects()

      expect(projects).toHaveLength(3)
    })

    it('应该能够更新项目', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const created = projectManager.createProject({
        title: '测试项目',
        status: 'planning'
      })

      const updated = projectManager.updateProject(created.id, {
        title: '更新后的项目',
        status: 'active'
      })

      expect(updated).toBeDefined()
      expect(updated?.title).toBe('更新后的项目')
      expect(updated?.status).toBe('active')
    })

    it('应该能够删除项目', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const created = projectManager.createProject({ title: '测试项目' })

      const deleted = projectManager.deleteProject(created.id)

      expect(deleted).toBe(true)

      const retrieved = projectManager.getProject(created.id)
      expect(retrieved).toBeNull()
    })

    it('应该能够按状态过滤项目', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      projectManager.createProject({ title: '项目1', status: 'planning' })
      projectManager.createProject({ title: '项目2', status: 'active' })
      projectManager.createProject({ title: '项目3', status: 'completed' })

      const activeProjects = projectManager.listProjects({ status: 'active' })

      expect(activeProjects).toHaveLength(1)
      expect(activeProjects[0].title).toBe('项目2')
    })

    it('应该能够按优先级过滤项目', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      projectManager.createProject({ title: '项目1', priority: 'low' })
      projectManager.createProject({ title: '项目2', priority: 'medium' })
      projectManager.createProject({ title: '项目3', priority: 'high' })

      const highPriorityProjects = projectManager.listProjects({ priority: 'high' })

      expect(highPriorityProjects).toHaveLength(1)
      expect(highPriorityProjects[0].title).toBe('项目3')
    })
  })

  describe('任务管理', () => {
    it('应该能够添加任务', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '测试描述'
      })

      const task = projectManager.addTask({
        projectId: project.id,
        title: '测试任务',
        description: '任务描述',
        priority: 'high',
        estimatedHours: 8
      })

      expect(task).toBeDefined()
      expect(task.title).toBe('测试任务')
      expect(task.description).toBe('任务描述')
      expect(task.priority).toBe('high')
      expect(task.estimatedHours).toBe(8)
      expect(task.status).toBe('pending')
    })

    it('应该能够获取任务', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '测试描述'
      })
      const created = projectManager.addTask({
        projectId: project.id,
        title: '测试任务'
      })

      const retrieved = projectManager.getTask(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.title).toBe('测试任务')
    })

    it('应该能够获取项目的所有任务', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '测试描述'
      })
      projectManager.addTask({ projectId: project.id, title: '任务1' })
      projectManager.addTask({ projectId: project.id, title: '任务2' })
      projectManager.addTask({ projectId: project.id, title: '任务3' })

      const tasks = projectManager.getProjectTasks(project.id)

      expect(tasks).toHaveLength(3)
    })

    it('应该能够更新任务', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '测试描述'
      })
      const created = projectManager.addTask({
        projectId: project.id,
        title: '测试任务',
        status: 'pending'
      })

      const updated = projectManager.updateTask(created.id, {
        title: '更新后的任务',
        status: 'completed',
        actualHours: 8
      })

      expect(updated).toBeDefined()
      expect(updated?.title).toBe('更新后的任务')
      expect(updated?.status).toBe('completed')
      expect(updated?.actualHours).toBe(8)
    })

    it('应该能够删除任务', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '测试描述'
      })
      const created = projectManager.addTask({
        projectId: project.id,
        title: '测试任务'
      })

      const deleted = projectManager.deleteTask(created.id)

      expect(deleted).toBe(true)

      const retrieved = projectManager.getTask(created.id)
      expect(retrieved).toBeNull()
    })

    it('应该能够添加任务评论', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '测试描述'
      })
      const created = projectManager.addTask({
        projectId: project.id,
        title: '测试任务'
      })

      const updated = projectManager.addTaskComment(
        created.id,
        '用户A',
        '这是一条评论'
      )

      expect(updated).toBeDefined()
      expect(updated?.comments).toHaveLength(1)
      expect(updated?.comments[0].author).toBe('用户A')
      expect(updated?.comments[0].content).toBe('这是一条评论')
    })
  })

  describe('报告生成', () => {
    it('应该能够生成摘要报告', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '测试描述',
        estimatedHours: 100
      })

      const report = projectManager.generateReport(
        project.id,
        'summary',
        '项目摘要报告'
      )

      expect(report).toBeDefined()
      expect(report.type).toBe('summary')
      expect(report.title).toBe('项目摘要报告')
      expect(report.data.project).toBeDefined()
      expect(report.data.tasks).toBeDefined()
      expect(report.data.time).toBeDefined()
    })

    it('应该能够生成进度报告', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '测试描述',
        estimatedHours: 100
      })

      const report = projectManager.generateReport(
        project.id,
        'progress',
        '项目进度报告'
      )

      expect(report).toBeDefined()
      expect(report.type).toBe('progress')
      expect(report.data.progress).toBeDefined()
      expect(report.data.tasksByStatus).toBeDefined()
      expect(report.data.timeline).toBeDefined()
    })

    it('应该能够生成任务报告', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '测试描述',
        estimatedHours: 100
      })

      const report = projectManager.generateReport(
        project.id,
        'tasks',
        '任务报告'
      )

      expect(report).toBeDefined()
      expect(report.type).toBe('tasks')
      expect(report.data.byStatus).toBeDefined()
      expect(report.data.byPriority).toBeDefined()
    })

    it('应该能够生成时间报告', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        description: '测试描述',
        estimatedHours: 100
      })

      const report = projectManager.generateReport(
        project.id,
        'time',
        '时间报告'
      )

      expect(report).toBeDefined()
      expect(report.type).toBe('time')
      expect(report.data.project).toBeDefined()
      expect(report.data.tasks).toBeDefined()
      expect(report.data.byAssignee).toBeDefined()
    })
  })

  describe('时间估算', () => {
    it('应该能够估算项目时间', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        startDate: Date.now() - 86400000,
        estimatedHours: 100
      })

      const estimate = projectManager.estimateProjectTime(project.id)

      expect(estimate).toBeDefined()
      expect(estimate.totalEstimatedHours).toBeDefined()
      expect(estimate.totalActualHours).toBeDefined()
      expect(estimate.remainingHours).toBeDefined()
      expect(estimate.completionPercentage).toBeDefined()
    })
  })

  describe('进度跟踪', () => {
    it('应该能够跟踪项目进度', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目',
        estimatedHours: 100
      })

      const progress = projectManager.trackProjectProgress(project.id)

      expect(progress).toBeDefined()
      expect(progress.progress).toBeDefined()
      expect(progress.tasks).toBeDefined()
      expect(progress.time).toBeDefined()
      expect(progress.milestones).toBeDefined()
    })
  })

  describe('项目模式', () => {
    it('应该能够设置项目模式', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目'
      })

      const updated = projectManager.setProjectMode(project.id, 'execute')

      expect(updated).toBeDefined()
      expect(updated?.settings.mode).toBe('execute')
    })

    it('应该能够获取项目模式', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      const project = projectManager.createProject({
        title: '测试项目'
      })

      const mode = projectManager.getProjectMode(project.id)

      expect(mode).toBe('plan')
    })
  })

  describe('统计信息', () => {
    it('应该能够获取统计信息', () => {
      const projectManager = new ProjectManager(undefined, true) as any
      projectManager.createProject({
        title: '项目1',
        status: 'active',
        priority: 'high',
        estimatedHours: 100
      })

      const stats = projectManager.getStatistics()

      expect(stats).toBeDefined()
      expect(stats.totalProjects).toBeDefined()
      expect(stats.activeProjects).toBeDefined()
      expect(stats.completedProjects).toBeDefined()
      expect(stats.totalTasks).toBeDefined()
      expect(stats.completedTasks).toBeDefined()
      expect(stats.totalHours).toBeDefined()
      expect(stats.completedHours).toBeDefined()
      expect(stats.averageProgress).toBeDefined()
      expect(stats.byPriority).toBeDefined()
      expect(stats.byStatus).toBeDefined()
    })
  })
})
