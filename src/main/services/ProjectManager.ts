import { EventEmitter } from 'events'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import PATHS from '../config/paths'
import { userService } from './UserService'

export interface ProjectTask {
  id: string
  projectId: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignee?: string
  estimatedHours: number
  actualHours: number
  startDate?: number
  endDate?: number
  dependencies: string[]
  tags: string[]
  attachments: string[]
  comments: Array<{
    id: string
    author: string
    content: string
    timestamp: number
  }>
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  title: string
  description: string
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  path?: string
  startDate?: number
  endDate?: number
  estimatedHours: number
  actualHours: number
  progress: number
  budget?: number
  actualCost?: number
  tags: string[]
  ownerId: string
  members: Array<{
    id: string
    name: string
    role: string
    joinedAt: number
  }>
  permissions: {
    [userId: string]: 'owner' | 'editor' | 'viewer'
  }
  settings: {
    mode: 'plan' | 'execute' | 'review'
    autoSave: boolean
    notifications: boolean
    gitIntegration: boolean
  }
  metadata: {
    createdAt: number
    updatedAt: number
    createdBy: string
    lastModifiedBy: string
  }
}

export interface ProjectReport {
  id: string
  projectId: string
  type: 'summary' | 'progress' | 'tasks' | 'time' | 'budget' | 'custom'
  title: string
  data: any
  generatedAt: number
  generatedBy: string
}

export interface ProjectStatistics {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  totalTasks: number
  completedTasks: number
  totalHours: number
  completedHours: number
  averageProgress: number
  byPriority: {
    low: number
    medium: number
    high: number
    critical: number
  }
  byStatus: {
    planning: number
    active: number
    on_hold: number
    completed: number
    cancelled: number
  }
}

export class ProjectManager extends EventEmitter {
  private projects: Map<string, Project> = new Map()
  private tasks: Map<string, ProjectTask> = new Map()
  private reports: Map<string, ProjectReport> = new Map()
  private dataDir: string
  private useMemoryStorage: boolean

  constructor(dataDir?: string, useMemoryStorage: boolean = false) {
    super()
    // 优先使用显式传入的目录，其次使用 Electron 的 userData 目录下的 projects 子目录，
    // 最后回退到全局 PROJECT_ROOT，确保在打包环境中始终指向可写目录
    const defaultDataDir =
      dataDir ||
      (app ? path.join(app.getPath('userData'), 'projects') : PATHS.PROJECT_ROOT)

    this.dataDir = defaultDataDir
    this.useMemoryStorage = useMemoryStorage
    if (!useMemoryStorage) {
      try {
        this.initializeDataDirectory()
        this.loadProjects()
        this.loadTasks()
        this.loadReports()
      } catch (error) {
        console.error('初始化项目管理器失败:', error)
        // 回退到内存存储
        this.useMemoryStorage = true
        console.warn('回退到内存存储模式')
      }
    }
  }

  private initializeDataDirectory() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true })
      }
    } catch (error) {
      // 尝试使用临时目录作为回退
      const tempDir = path.join(PATHS.TEMP, 'trae', 'projects')
      console.warn(`无法创建项目目录 ${this.dataDir}，使用临时目录 ${tempDir}`, error)
      this.dataDir = tempDir
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true })
      }
    }
  }

  private getProjectsFilePath(): string {
    return path.join(this.dataDir, 'projects.json')
  }

  private getTasksFilePath(): string {
    return path.join(this.dataDir, 'tasks.json')
  }

  private getReportsFilePath(): string {
    return path.join(this.dataDir, 'reports.json')
  }

  private loadProjects() {
    try {
      const filePath = this.getProjectsFilePath()
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8')
        const projectsArray: Project[] = JSON.parse(data)
        projectsArray.forEach(project => {
          this.projects.set(project.id, project)
        })
      }
    } catch (error) {
      console.error('加载项目失败:', error)
    }
  }

  private saveProjects() {
    if (this.useMemoryStorage) return
    try {
      const filePath = this.getProjectsFilePath()
      const projectsArray = Array.from(this.projects.values())
      fs.writeFileSync(filePath, JSON.stringify(projectsArray, null, 2))
    } catch (error) {
      console.error('保存项目失败:', error)
    }
  }

  private loadTasks() {
    try {
      const filePath = this.getTasksFilePath()
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8')
        const tasksArray: ProjectTask[] = JSON.parse(data)
        tasksArray.forEach(task => {
          this.tasks.set(task.id, task)
        })
      }
    } catch (error) {
      console.error('加载任务失败:', error)
    }
  }

  private saveTasks() {
    if (this.useMemoryStorage) return
    try {
      const filePath = this.getTasksFilePath()
      const tasksArray = Array.from(this.tasks.values())
      fs.writeFileSync(filePath, JSON.stringify(tasksArray, null, 2))
    } catch (error) {
      console.error('保存任务失败:', error)
    }
  }

  private loadReports() {
    try {
      const filePath = this.getReportsFilePath()
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8')
        const reportsArray: ProjectReport[] = JSON.parse(data)
        reportsArray.forEach(report => {
          this.reports.set(report.id, report)
        })
      }
    } catch (error) {
      console.error('加载报告失败:', error)
    }
  }

  private saveReports() {
    if (this.useMemoryStorage) return
    try {
      const filePath = this.getReportsFilePath()
      const reportsArray = Array.from(this.reports.values())
      fs.writeFileSync(filePath, JSON.stringify(reportsArray, null, 2))
    } catch (error) {
      console.error('保存报告失败:', error)
    }
  }

  createProject(data: Partial<Project> & { title: string; ownerId: string }): Project {
    const now = Date.now()
    const random = Math.floor(Math.random() * 1000)
    const project: Project = {
      id: `proj_${now}_${random}`,
      title: data.title,
      description: data.description || '',
      status: data.status || 'planning',
      priority: data.priority || 'medium',
      path: data.path,
      startDate: data.startDate,
      endDate: data.endDate,
      estimatedHours: data.estimatedHours || 0,
      actualHours: 0,
      progress: 0,
      budget: data.budget,
      actualCost: 0,
      tags: data.tags || [],
      ownerId: data.ownerId,
      members: data.members || [],
      permissions: {
        [data.ownerId]: 'owner'
      },
      settings: {
        mode: 'plan',
        autoSave: true,
        notifications: true,
        gitIntegration: false
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        createdBy: data.ownerId,
        lastModifiedBy: data.ownerId
      }
    }

    this.projects.set(project.id, project)
    this.saveProjects()
    this.emit('project:created', project)
    return project
  }

  // 权限检查方法
  checkPermission(userId: string, projectId: string, requiredRole: 'owner' | 'editor' | 'viewer'): boolean {
    const project = this.projects.get(projectId)
    if (!project) {
      return false
    }

    // 检查用户服务中的权限
    if (!userService.checkProjectPermission(userId, projectId, requiredRole)) {
      return false
    }

    // 检查项目级别的权限
    const projectPermission = project.permissions[userId]
    if (!projectPermission) {
      return false
    }

    // 权限层级：owner > editor > viewer
    const rolePriority = {
      owner: 3,
      editor: 2,
      viewer: 1
    }

    return rolePriority[projectPermission] >= rolePriority[requiredRole]
  }

  // 添加项目成员
  addProjectMember(projectId: string, userId: string, role: 'editor' | 'viewer'): boolean {
    const project = this.projects.get(projectId)
    if (!project) {
      return false
    }

    project.permissions[userId] = role
    this.projects.set(projectId, project)
    this.saveProjects()
    
    // 同时更新用户服务中的权限
    userService.setProjectPermission(userId, projectId, role)
    
    this.emit('project:memberAdded', { projectId, userId, role })
    return true
  }

  // 移除项目成员
  removeProjectMember(projectId: string, userId: string): boolean {
    const project = this.projects.get(projectId)
    if (!project) {
      return false
    }

    // 不能移除所有者
    if (project.ownerId === userId) {
      return false
    }

    delete project.permissions[userId]
    this.projects.set(projectId, project)
    this.saveProjects()
    
    // 同时从用户服务中移除权限
    const user = userService.getUserById(userId)
    if (user) {
      delete user.permissions.projects[projectId]
      userService.updateUser(userId, user)
    }
    
    this.emit('project:memberRemoved', { projectId, userId })
    return true
  }

  // 更新项目成员权限
  updateProjectMemberPermission(projectId: string, userId: string, role: 'editor' | 'viewer'): boolean {
    const project = this.projects.get(projectId)
    if (!project) {
      return false
    }

    // 不能修改所有者权限
    if (project.ownerId === userId) {
      return false
    }

    project.permissions[userId] = role
    this.projects.set(projectId, project)
    this.saveProjects()
    
    // 同时更新用户服务中的权限
    userService.setProjectPermission(userId, projectId, role)
    
    this.emit('project:permissionUpdated', { projectId, userId, role })
    return true
  }

  getProject(projectId: string): Project | null {
    return this.projects.get(projectId) || null
  }

  listProjects(filter?: {
    status?: Project['status']
    priority?: Project['priority']
    tags?: string[]
  }): Project[] {
    let projects = Array.from(this.projects.values())

    if (filter) {
      if (filter.status) {
        projects = projects.filter(p => p.status === filter.status)
      }
      if (filter.priority) {
        projects = projects.filter(p => p.priority === filter.priority)
      }
      if (filter.tags && filter.tags.length > 0) {
        projects = projects.filter(p => 
          filter.tags!.some(tag => p.tags.includes(tag))
        )
      }
    }

    return projects.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt)
  }

  updateProject(projectId: string, updates: Partial<Project>): Project | null {
    const project = this.projects.get(projectId)
    if (!project) return null

    const updatedProject = {
      ...project,
      ...updates,
      metadata: {
        ...project.metadata,
        updatedAt: Date.now(),
        lastModifiedBy: 'user'
      }
    }

    this.projects.set(projectId, updatedProject)
    this.saveProjects()
    this.emit('project:updated', updatedProject)
    return updatedProject
  }

  deleteProject(projectId: string): boolean {
    const project = this.projects.get(projectId)
    if (!project) return false

    this.projects.delete(projectId)

    const tasksToDelete = Array.from(this.tasks.values())
      .filter(task => task.projectId === projectId)
      .map(task => task.id)
    tasksToDelete.forEach(taskId => this.tasks.delete(taskId))

    const reportsToDelete = Array.from(this.reports.values())
      .filter(report => report.projectId === projectId)
      .map(report => report.id)
    reportsToDelete.forEach(reportId => this.reports.delete(reportId))

    this.saveProjects()
    this.saveTasks()
    this.saveReports()
    this.emit('project:deleted', { projectId })
    return true
  }

  addTask(data: Partial<ProjectTask> & { projectId: string; title: string }): ProjectTask {
    const now = Date.now()
    const random = Math.floor(Math.random() * 1000)
    const task: ProjectTask = {
      id: `task_${now}_${random}`,
      projectId: data.projectId,
      title: data.title,
      description: data.description || '',
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      assignee: data.assignee,
      estimatedHours: data.estimatedHours || 0,
      actualHours: 0,
      startDate: data.startDate,
      endDate: data.endDate,
      dependencies: data.dependencies || [],
      tags: data.tags || [],
      attachments: data.attachments || [],
      comments: [],
      createdAt: now,
      updatedAt: now
    }

    this.tasks.set(task.id, task)
    this.saveTasks()
    this.updateProjectProgress(data.projectId)
    this.emit('task:added', task)
    return task
  }

  getTask(taskId: string): ProjectTask | null {
    return this.tasks.get(taskId) || null
  }

  getProjectTasks(projectId: string): ProjectTask[] {
    return Array.from(this.tasks.values())
      .filter(task => task.projectId === projectId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  updateTask(taskId: string, updates: Partial<ProjectTask>): ProjectTask | null {
    const task = this.tasks.get(taskId)
    if (!task) return null

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: Date.now()
    }

    this.tasks.set(taskId, updatedTask)
    this.saveTasks()
    this.updateProjectProgress(task.projectId)
    this.emit('task:updated', updatedTask)
    return updatedTask
  }

  deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false

    this.tasks.delete(taskId)
    this.saveTasks()
    this.updateProjectProgress(task.projectId)
    this.emit('task:deleted', { taskId, projectId: task.projectId })
    return true
  }

  addTaskComment(taskId: string, author: string, content: string): ProjectTask | null {
    const task = this.tasks.get(taskId)
    if (!task) return null

    const comment = {
      id: `comment_${Date.now()}`,
      author,
      content,
      timestamp: Date.now()
    }

    const updatedTask = {
      ...task,
      comments: [...task.comments, comment],
      updatedAt: Date.now()
    }

    this.tasks.set(taskId, updatedTask)
    this.saveTasks()
    this.emit('task:commented', updatedTask)
    return updatedTask
  }

  private updateProjectProgress(projectId: string) {
    const tasks = this.getProjectTasks(projectId)
    if (tasks.length === 0) return

    const completedTasks = tasks.filter(t => t.status === 'completed')
    const progress = Math.round((completedTasks.length / tasks.length) * 100)

    const totalEstimated = tasks.reduce((sum, t) => sum + t.estimatedHours, 0)
    const totalActual = tasks.reduce((sum, t) => sum + t.actualHours, 0)

    this.updateProject(projectId, {
      progress,
      estimatedHours: totalEstimated,
      actualHours: totalActual
    })
  }

  generateReport(projectId: string, type: ProjectReport['type'], title: string): ProjectReport {
    const project = this.getProject(projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    const tasks = this.getProjectTasks(projectId)
    const data = this.calculateReportData(project, tasks, type)

    const report: ProjectReport = {
      id: `report_${Date.now()}`,
      projectId,
      type,
      title,
      data,
      generatedAt: Date.now(),
      generatedBy: 'user'
    }

    this.reports.set(report.id, report)
    this.saveReports()
    this.emit('report:generated', report)
    return report
  }

  private calculateReportData(project: Project, tasks: ProjectTask[], type: ProjectReport['type']): any {
    switch (type) {
      case 'summary':
        return {
          project: {
            title: project.title,
            status: project.status,
            priority: project.priority,
            progress: project.progress,
            startDate: project.startDate,
            endDate: project.endDate
          },
          tasks: {
            total: tasks.length,
            completed: tasks.filter(t => t.status === 'completed').length,
            inProgress: tasks.filter(t => t.status === 'in_progress').length,
            pending: tasks.filter(t => t.status === 'pending').length
          },
          time: {
            estimated: project.estimatedHours,
            actual: project.actualHours,
            remaining: project.estimatedHours - project.actualHours
          }
        }

      case 'progress':
        return {
          progress: project.progress,
          tasksByStatus: {
            pending: tasks.filter(t => t.status === 'pending').length,
            inProgress: tasks.filter(t => t.status === 'in_progress').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            skipped: tasks.filter(t => t.status === 'skipped').length
          },
          timeline: tasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            startDate: t.startDate,
            endDate: t.endDate
          }))
        }

      case 'tasks':
        return {
          total: tasks.length,
          byStatus: {
            pending: tasks.filter(t => t.status === 'pending'),
            inProgress: tasks.filter(t => t.status === 'in_progress'),
            completed: tasks.filter(t => t.status === 'completed'),
            failed: tasks.filter(t => t.status === 'failed'),
            skipped: tasks.filter(t => t.status === 'skipped')
          },
          byPriority: {
            low: tasks.filter(t => t.priority === 'low'),
            medium: tasks.filter(t => t.priority === 'medium'),
            high: tasks.filter(t => t.priority === 'high'),
            critical: tasks.filter(t => t.priority === 'critical')
          },
          tasks
        }

      case 'time':
        return {
          project: {
            estimated: project.estimatedHours,
            actual: project.actualHours,
            variance: project.actualHours - project.estimatedHours
          },
          tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            estimated: t.estimatedHours,
            actual: t.actualHours,
            variance: t.actualHours - t.estimatedHours
          })),
          byAssignee: this.groupTasksByAssignee(tasks)
        }

      case 'budget':
        return {
          project: {
            budget: project.budget || 0,
            actualCost: project.actualCost || 0,
            remaining: (project.budget || 0) - (project.actualCost || 0)
          },
          breakdown: tasks.map(t => ({
            id: t.id,
            title: t.title,
            estimatedCost: t.estimatedHours * 100,
            actualCost: t.actualHours * 100
          }))
        }

      case 'custom':
        return {
          project,
          tasks,
          generatedAt: Date.now()
        }

      default:
        return {}
    }
  }

  private groupTasksByAssignee(tasks: ProjectTask[]): any {
    const grouped: Record<string, any> = {}
    
    tasks.forEach(task => {
      const assignee = task.assignee || '未分配'
      if (!grouped[assignee]) {
        grouped[assignee] = {
          totalTasks: 0,
          estimatedHours: 0,
          actualHours: 0,
          completedTasks: 0
        }
      }
      
      grouped[assignee].totalTasks++
      grouped[assignee].estimatedHours += task.estimatedHours
      grouped[assignee].actualHours += task.actualHours
      if (task.status === 'completed') {
        grouped[assignee].completedTasks++
      }
    })
    
    return grouped
  }

  getProjectReports(projectId: string): ProjectReport[] {
    return Array.from(this.reports.values())
      .filter(report => report.projectId === projectId)
      .sort((a, b) => b.generatedAt - a.generatedAt)
  }

  getReport(reportId: string): ProjectReport | null {
    return this.reports.get(reportId) || null
  }

  estimateProjectTime(projectId: string): {
    totalEstimatedHours: number
    totalActualHours: number
    remainingHours: number
    completionPercentage: number
    estimatedCompletionDate: number | null
  } {
    const project = this.getProject(projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    const tasks = this.getProjectTasks(projectId)
    const totalEstimated = tasks.reduce((sum, t) => sum + t.estimatedHours, 0)
    const totalActual = tasks.reduce((sum, t) => sum + t.actualHours, 0)
    const remaining = totalEstimated - totalActual

    const completedTasks = tasks.filter(t => t.status === 'completed')
    const completionPercentage = tasks.length > 0 
      ? Math.round((completedTasks.length / tasks.length) * 100)
      : 0

    let estimatedCompletionDate: number | null = null
    if (project.startDate && completionPercentage > 0) {
      const elapsed = Date.now() - project.startDate
      const totalEstimatedTime = (elapsed / completionPercentage) * 100
      estimatedCompletionDate = project.startDate + totalEstimatedTime
    }

    return {
      totalEstimatedHours: totalEstimated,
      totalActualHours: totalActual,
      remainingHours: remaining,
      completionPercentage,
      estimatedCompletionDate
    }
  }

  trackProjectProgress(projectId: string): {
    progress: number
    tasks: {
      total: number
      completed: number
      inProgress: number
      pending: number
      failed: number
      skipped: number
    }
    time: {
      estimated: number
      actual: number
      remaining: number
    }
    milestones: Array<{
      title: string
      achieved: boolean
      date?: number
    }>
  } {
    const project = this.getProject(projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    const tasks = this.getProjectTasks(projectId)
    const completedTasks = tasks.filter(t => t.status === 'completed')
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
    const pendingTasks = tasks.filter(t => t.status === 'pending')
    const failedTasks = tasks.filter(t => t.status === 'failed')
    const skippedTasks = tasks.filter(t => t.status === 'skipped')

    return {
      progress: project.progress,
      tasks: {
        total: tasks.length,
        completed: completedTasks.length,
        inProgress: inProgressTasks.length,
        pending: pendingTasks.length,
        failed: failedTasks.length,
        skipped: skippedTasks.length
      },
      time: {
        estimated: project.estimatedHours,
        actual: project.actualHours,
        remaining: project.estimatedHours - project.actualHours
      },
      milestones: [
        {
          title: '项目启动',
          achieved: !!project.startDate,
          date: project.startDate
        },
        {
          title: '50%完成',
          achieved: project.progress >= 50
        },
        {
          title: '100%完成',
          achieved: project.progress === 100,
          date: project.progress === 100 ? project.endDate : undefined
        }
      ]
    }
  }

  setProjectMode(projectId: string, mode: Project['settings']['mode']): Project | null {
    const project = this.getProject(projectId)
    if (!project) return null

    return this.updateProject(projectId, {
      settings: {
        ...project.settings,
        mode
      }
    })
  }

  getProjectMode(projectId: string): Project['settings']['mode'] | null {
    const project = this.getProject(projectId)
    return project?.settings.mode || null
  }

  getStatistics(): ProjectStatistics {
    const projects = Array.from(this.projects.values())
    const tasks = Array.from(this.tasks.values())

    const byPriority = {
      low: projects.filter(p => p.priority === 'low').length,
      medium: projects.filter(p => p.priority === 'medium').length,
      high: projects.filter(p => p.priority === 'high').length,
      critical: projects.filter(p => p.priority === 'critical').length
    }

    const byStatus = {
      planning: projects.filter(p => p.status === 'planning').length,
      active: projects.filter(p => p.status === 'active').length,
      on_hold: projects.filter(p => p.status === 'on_hold').length,
      completed: projects.filter(p => p.status === 'completed').length,
      cancelled: projects.filter(p => p.status === 'cancelled').length
    }

    const totalProgress = projects.reduce((sum, p) => sum + p.progress, 0)
    const averageProgress = projects.length > 0 
      ? Math.round(totalProgress / projects.length)
      : 0

    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      totalHours: projects.reduce((sum, p) => sum + p.estimatedHours, 0),
      completedHours: projects.reduce((sum, p) => sum + p.actualHours, 0),
      averageProgress,
      byPriority,
      byStatus
    }
  }

  // 导出项目数据
  exportProject(projectId: string): any {
    const project = this.projects.get(projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    const projectTasks = Array.from(this.tasks.values()).filter(task => task.projectId === projectId)
    const projectReports = Array.from(this.reports.values()).filter(report => report.projectId === projectId)

    const exportData = {
      version: '1.0',
      exportedAt: Date.now(),
      project,
      tasks: projectTasks,
      reports: projectReports
    }

    return exportData
  }

  // 导出项目到文件
  exportProjectToFile(projectId: string, filePath: string): boolean {
    try {
      const exportData = this.exportProject(projectId)
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2))
      return true
    } catch (error) {
      console.error('导出项目失败:', error)
      return false
    }
  }

  // 从文件导入项目
  importProjectFromFile(filePath: string, ownerId: string): Project | null {
    try {
      const data = fs.readFileSync(filePath, 'utf-8')
      const importData = JSON.parse(data)

      if (!importData.project) {
        throw new Error('无效的项目文件格式')
      }

      // 生成新的项目ID，避免冲突
      const now = Date.now()
      const random = Math.floor(Math.random() * 1000)
      const newProjectId = `proj_${now}_${random}`
      
      // 创建新项目
      const projectData = {
        ...importData.project,
        id: newProjectId,
        ownerId,
        permissions: {
          [ownerId]: 'owner'
        },
        metadata: {
          ...importData.project.metadata,
          createdAt: now,
          updatedAt: now,
          createdBy: ownerId,
          lastModifiedBy: ownerId
        }
      }

      const project = this.createProject(projectData as any)

      // 导入任务
      if (importData.tasks && Array.isArray(importData.tasks)) {
        importData.tasks.forEach((taskData: any) => {
          const newTaskId = `task_${now}_${Math.floor(Math.random() * 1000)}`
          this.addTask({
            ...taskData,
            id: newTaskId,
            projectId: newProjectId
          })
        })
      }

      // 导入报告
      if (importData.reports && Array.isArray(importData.reports)) {
        importData.reports.forEach((reportData: any) => {
          const newReportId = `report_${now}_${Math.floor(Math.random() * 1000)}`
          const report: ProjectReport = {
            id: newReportId,
            projectId: newProjectId,
            type: reportData.type,
            title: reportData.title,
            data: reportData.data,
            generatedAt: Date.now(),
            generatedBy: ownerId
          }
          this.reports.set(newReportId, report)
        })
        this.saveReports()
      }

      this.emit('project:imported', project)
      return project
    } catch (error) {
      console.error('导入项目失败:', error)
      return null
    }
  }

  // 批量导出项目
  exportProjects(projectIds: string[]): any {
    const exportData = {
      version: '1.0',
      exportedAt: Date.now(),
      projects: [] as any[]
    }

    projectIds.forEach(projectId => {
      try {
        const projectData = this.exportProject(projectId)
        exportData.projects.push(projectData)
      } catch (error) {
        console.error(`导出项目 ${projectId} 失败:`, error)
      }
    })

    return exportData
  }

  // 批量导出项目到文件
  exportProjectsToFile(projectIds: string[], filePath: string): boolean {
    try {
      const exportData = this.exportProjects(projectIds)
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2))
      return true
    } catch (error) {
      console.error('批量导出项目失败:', error)
      return false
    }
  }
}

export const projectManager = new ProjectManager()
