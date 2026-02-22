import React, { useState, useEffect } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js'
import { Pie, Doughnut } from 'react-chartjs-2'

// 注册Chart.js组件
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

interface Project {
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
  members: Array<{
    id: string
    name: string
    role: string
    joinedAt: number
  }>
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

interface ProjectTask {
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

interface ProjectManagementProps {
  onBack?: () => void
}

export const ProjectManagement: React.FC<ProjectManagementProps> = ({ onBack }) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'reports'>('overview')
  const [statistics, setStatistics] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [reportType, setReportType] = useState<'summary' | 'progress' | 'tasks' | 'time'>('summary')
  const [reportTitle, setReportTitle] = useState('')

  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    path: '',
    estimatedHours: 0,
    budget: 0
  })

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    estimatedHours: 0,
    assignee: ''
  })

  useEffect(() => {
    loadProjects()
    loadStatistics()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      loadTasks(selectedProject.id)
      loadReports(selectedProject.id)
    } else {
      setReports([])
      setSelectedReport(null)
    }
  }, [selectedProject])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const response = await window.electron.projectManager.list()
      if (response.success) {
        setProjects(response.projects)
      }
    } catch (error) {
      console.error('加载项目失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = async (projectId: string) => {
    try {
      const response = await window.electron.projectManager.getTasks(projectId)
      if (response.success) {
        setTasks(response.tasks)
      }
    } catch (error) {
      console.error('加载任务失败:', error)
    }
  }

  const loadStatistics = async () => {
    try {
      const response = await window.electron.projectManager.getStatistics()
      if (response.success) {
        setStatistics(response.statistics)
      }
    } catch (error) {
      console.error('加载统计信息失败:', error)
    }
  }

  const handleCreateProject = async () => {
    if (!newProject.title.trim()) {
      alert('请输入项目名称')
      return
    }

    setLoading(true)
    try {
      const response = await window.electron.projectManager.create({
        title: newProject.title,
        description: newProject.description,
        priority: newProject.priority,
        path: newProject.path || undefined,
        estimatedHours: newProject.estimatedHours,
        budget: newProject.budget || undefined
      })

      if (response.success) {
        alert('项目创建成功')
        setShowCreateDialog(false)
        setNewProject({
          title: '',
          description: '',
          priority: 'medium',
          path: '',
          estimatedHours: 0,
          budget: 0
        })
        loadProjects()
        loadStatistics()
      } else {
        alert('创建失败: ' + response.error)
      }
    } catch (error) {
      console.error('创建项目失败:', error)
      alert('创建项目失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('确定要删除此项目吗？此操作不可恢复。')) {
      return
    }

    setLoading(true)
    try {
      const response = await window.electron.projectManager.delete(projectId)
      if (response.success) {
        alert('项目删除成功')
        if (selectedProject?.id === projectId) {
          setSelectedProject(null)
          setTasks([])
        }
        loadProjects()
        loadStatistics()
      } else {
        alert('删除失败: ' + response.error)
      }
    } catch (error) {
      console.error('删除项目失败:', error)
      alert('删除项目失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = async () => {
    if (!selectedProject) return
    if (!newTask.title.trim()) {
      alert('请输入任务名称')
      return
    }

    setLoading(true)
    try {
      const response = await window.electron.projectManager.addTask({
        projectId: selectedProject.id,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        estimatedHours: newTask.estimatedHours,
        assignee: newTask.assignee || undefined
      })

      if (response.success) {
        alert('任务创建成功')
        setShowTaskDialog(false)
        setNewTask({
          title: '',
          description: '',
          priority: 'medium',
          estimatedHours: 0,
          assignee: ''
        })
        loadTasks(selectedProject.id)
      } else {
        alert('创建失败: ' + response.error)
      }
    } catch (error) {
      console.error('创建任务失败:', error)
      alert('创建任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, status: ProjectTask['status']) => {
    setLoading(true)
    try {
      const response = await window.electron.projectManager.updateTask(taskId, { status })
      if (response.success) {
        loadTasks(selectedProject!.id)
      } else {
        alert('更新失败: ' + response.error)
      }
    } catch (error) {
      console.error('更新任务失败:', error)
      alert('更新任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定要删除此任务吗？')) {
      return
    }

    setLoading(true)
    try {
      const response = await window.electron.projectManager.deleteTask(taskId)
      if (response.success) {
        loadTasks(selectedProject!.id)
      } else {
        alert('删除失败: ' + response.error)
      }
    } catch (error) {
      console.error('删除任务失败:', error)
      alert('删除任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSetProjectMode = async (mode: 'plan' | 'execute' | 'review') => {
    if (!selectedProject) return

    setLoading(true)
    try {
      const response = await window.electron.projectManager.setMode(selectedProject.id, mode)
      if (response.success) {
        setSelectedProject(response.project)
      } else {
        alert('设置失败: ' + response.error)
      }
    } catch (error) {
      console.error('设置模式失败:', error)
      alert('设置模式失败')
    } finally {
      setLoading(false)
    }
  }

  const loadReports = async (projectId: string) => {
    try {
      const response = await window.electron.projectManager.getReports(projectId)
      if (response.success) {
        setReports(response.reports)
      }
    } catch (error) {
      console.error('加载报告失败:', error)
    }
  }

  const handleGenerateReport = async () => {
    if (!selectedProject) return

    setLoading(true)
    try {
      const response = await window.electron.projectManager.generateReport(selectedProject.id, reportType, reportTitle)
      if (response.success) {
        alert('报告生成成功')
        setShowReportDialog(false)
        setReportType('summary')
        setReportTitle('')
        loadReports(selectedProject.id)
      } else {
        alert('生成失败: ' + response.error)
      }
    } catch (error) {
      console.error('生成报告失败:', error)
      alert('生成报告失败')
    } finally {
      setLoading(false)
    }
  }

  const handleViewReport = async (reportId: string) => {
    try {
      const response = await window.electron.projectManager.getReport(reportId)
      if (response.success) {
        setSelectedReport(response.report)
      } else {
        alert('获取报告失败: ' + response.error)
      }
    } catch (error) {
      console.error('获取报告失败:', error)
      alert('获取报告失败')
    }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('确定要删除此报告吗？')) {
      return
    }

    setLoading(true)
    try {
      const response = { success: false, error: '删除报告功能暂不可用' }
      if (response.success) {
        setReports(reports.filter(report => report.id !== reportId))
        if (selectedReport?.id === reportId) {
          setSelectedReport(null)
        }
      } else {
        alert('删除失败: ' + response.error)
      }
    } catch (error) {
      console.error('删除报告失败:', error)
      alert('删除报告失败')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: '#FF9800',
      active: '#2196F3',
      on_hold: '#9E9E9E',
      completed: '#4CAF50',
      cancelled: '#F44336',
      pending: '#FF9800',
      in_progress: '#2196F3',
      failed: '#F44336',
      skipped: '#9E9E9E'
    }
    return colors[status] || '#9E9E9E'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
      critical: '#D32F2F'
    }
    return colors[priority] || '#9E9E9E'
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }}>
      <div style={{
        padding: '16px 24px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#333' }}>
            项目管理
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#666' }}>
            管理所有项目和项目计划
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {statistics && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#E3F2FD',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#1976D2'
            }}>
              {statistics.totalProjects} 个项目 · {statistics.activeProjects} 个活跃
            </div>
          )}
          <button
            onClick={() => setShowCreateDialog(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            新建项目
          </button>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '8px 16px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              返回
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{
          width: '350px',
          backgroundColor: 'white',
          borderRight: '1px solid #e0e0e0',
          overflow: 'auto'
        }}>
          <div style={{ padding: '16px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#333' }}>
              项目列表 ({projects.length})
            </h2>
            {loading && projects.length === 0 ? (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: '#999',
                fontSize: '14px'
              }}>
                加载中...
              </div>
            ) : projects.length === 0 ? (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: '#999',
                fontSize: '14px'
              }}>
                暂无项目
                <br />
                <button
                  onClick={() => setShowCreateDialog(true)}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    backgroundColor: '#007AFF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  创建第一个项目
                </button>
              </div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: selectedProject?.id === project.id ? '#E3F2FD' : '#f9f9f9',
                    border: selectedProject?.id === project.id ? '2px solid #007AFF' : '1px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#333', flex: 1 }}>
                      {project.title}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        backgroundColor: getStatusColor(project.status),
                        color: 'white',
                        fontWeight: 500
                      }}>
                        {project.status}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        backgroundColor: getPriorityColor(project.priority),
                        color: 'white',
                        fontWeight: 500
                      }}>
                        {project.priority}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    {formatDate(project.metadata.updatedAt)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px' }}>
                      <div
                        style={{
                          height: '100%',
                          backgroundColor: '#4CAF50',
                          borderRadius: '2px',
                          width: `${project.progress}%`
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: '#666', minWidth: '35px' }}>
                      {project.progress}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedProject ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#999',
              fontSize: '14px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              请选择一个项目查看详情
            </div>
          ) : (
            <>
              <div style={{
                padding: '16px 24px',
                backgroundColor: 'white',
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: '#333' }}>
                    {selectedProject.title}
                  </h2>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {formatDate(selectedProject.metadata.updatedAt)} · {selectedProject.status}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={selectedProject.settings.mode}
                    onChange={(e) => handleSetProjectMode(e.target.value as any)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  >
                    <option value="plan">计划模式</option>
                    <option value="execute">执行模式</option>
                    <option value="review">审查模式</option>
                  </select>
                  <button
                    onClick={() => handleDeleteProject(selectedProject.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#F44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    删除项目
                  </button>
                </div>
              </div>

              <div style={{
                padding: '0 24px',
                backgroundColor: 'white',
                borderBottom: '1px solid #e0e0e0'
              }}>
                <div style={{ display: 'flex', gap: '24px' }}>
                  {['overview', 'tasks', 'reports'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      style={{
                        padding: '12px 0',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === tab ? '2px solid #007AFF' : '2px solid transparent',
                        color: activeTab === tab ? '#007AFF' : '#666',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      {tab === 'overview' ? '概览' : tab === 'tasks' ? '任务' : '报告'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                {activeTab === 'overview' && (
                  <div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '16px',
                      marginBottom: '24px'
                    }}>
                      <div style={{
                        padding: '16px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>进度</div>
                        <div style={{ fontSize: '32px', fontWeight: 600, color: '#4CAF50' }}>
                          {selectedProject.progress}%
                        </div>
                      </div>
                      <div style={{
                        padding: '16px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>任务</div>
                        <div style={{ fontSize: '32px', fontWeight: 600, color: '#2196F3' }}>
                          {tasks.length}
                        </div>
                      </div>
                      <div style={{
                        padding: '16px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>预估时间</div>
                        <div style={{ fontSize: '32px', fontWeight: 600, color: '#FF9800' }}>
                          {selectedProject.estimatedHours}h
                        </div>
                      </div>
                      <div style={{
                        padding: '16px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>实际时间</div>
                        <div style={{ fontSize: '32px', fontWeight: 600, color: '#9C27B0' }}>
                          {selectedProject.actualHours}h
                        </div>
                      </div>
                    </div>

                    <div style={{
                      padding: '16px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0',
                      marginBottom: '16px'
                    }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#333' }}>
                        项目描述
                      </h3>
                      <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
                        {selectedProject.description || '暂无描述'}
                      </div>
                    </div>

                    {selectedProject.tags.length > 0 && (
                      <div style={{
                        padding: '16px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        marginBottom: '16px'
                      }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#333' }}>
                          标签
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {selectedProject.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                padding: '4px 12px',
                                backgroundColor: '#E3F2FD',
                                color: '#1976D2',
                                borderRadius: '12px',
                                fontSize: '12px'
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 统计数据可视化 */}
                    <div style={{
                      padding: '16px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0',
                      marginBottom: '16px'
                    }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#333' }}>
                        统计数据
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        {/* 任务状态分布 */}
                        <div>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#666' }}>
                            任务状态分布
                          </h4>
                          <div style={{ height: '200px' }}>
                            {tasks.length > 0 ? (
                              <Pie
                                data={{
                                  labels: ['待处理', '进行中', '已完成', '失败', '跳过'],
                                  datasets: [
                                    {
                                      data: [
                                        tasks.filter(t => t.status === 'pending').length,
                                        tasks.filter(t => t.status === 'in_progress').length,
                                        tasks.filter(t => t.status === 'completed').length,
                                        tasks.filter(t => t.status === 'failed').length,
                                        tasks.filter(t => t.status === 'skipped').length
                                      ],
                                      backgroundColor: [
                                        '#FF9800',
                                        '#2196F3',
                                        '#4CAF50',
                                        '#F44336',
                                        '#9E9E9E'
                                      ],
                                      borderColor: [
                                        '#FF9800',
                                        '#2196F3',
                                        '#4CAF50',
                                        '#F44336',
                                        '#9E9E9E'
                                      ],
                                      borderWidth: 1
                                    }
                                  ]
                                }}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      position: 'bottom' as const,
                                      labels: {
                                        font: {
                                          size: 11
                                        }
                                      }
                                    }
                                  }
                                }}
                              />
                            ) : (
                              <div style={{
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: '#999',
                                fontSize: '12px'
                              }}>
                                暂无任务数据
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 任务优先级分布 */}
                        <div>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#666' }}>
                            任务优先级分布
                          </h4>
                          <div style={{ height: '200px' }}>
                            {tasks.length > 0 ? (
                              <Doughnut
                                data={{
                                  labels: ['低', '中', '高', '紧急'],
                                  datasets: [
                                    {
                                      data: [
                                        tasks.filter(t => t.priority === 'low').length,
                                        tasks.filter(t => t.priority === 'medium').length,
                                        tasks.filter(t => t.priority === 'high').length,
                                        tasks.filter(t => t.priority === 'critical').length
                                      ],
                                      backgroundColor: [
                                        '#4CAF50',
                                        '#FF9800',
                                        '#F44336',
                                        '#D32F2F'
                                      ],
                                      borderColor: [
                                        '#4CAF50',
                                        '#FF9800',
                                        '#F44336',
                                        '#D32F2F'
                                      ],
                                      borderWidth: 1
                                    }
                                  ]
                                }}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      position: 'bottom' as const,
                                      labels: {
                                        font: {
                                          size: 11
                                        }
                                      }
                                    }
                                  }
                                }}
                              />
                            ) : (
                              <div style={{
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: '#999',
                                fontSize: '12px'
                              }}>
                                暂无任务数据
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#333' }}>
                        任务列表 ({tasks.length})
                      </h3>
                      <button
                        onClick={() => setShowTaskDialog(true)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#007AFF',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      >
                        新建任务
                      </button>
                    </div>

                    {tasks.length === 0 ? (
                      <div style={{
                        padding: '48px',
                        textAlign: 'center',
                        color: '#999',
                        fontSize: '14px'
                      }}>
                        暂无任务
                        <br />
                        <button
                          onClick={() => setShowTaskDialog(true)}
                          style={{
                            marginTop: '12px',
                            padding: '8px 16px',
                            backgroundColor: '#007AFF',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          创建第一个任务
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            style={{
                              padding: '16px',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #e0e0e0'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>
                                  {task.title}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                  {task.description || '暂无描述'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  backgroundColor: getStatusColor(task.status),
                                  color: 'white',
                                  fontWeight: 500
                                }}>
                                  {task.status}
                                </span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  backgroundColor: getPriorityColor(task.priority),
                                  color: 'white',
                                  fontWeight: 500
                                }}>
                                  {task.priority}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                {task.estimatedHours}h 预估 · {task.actualHours}h 实际
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <select
                                  value={task.status}
                                  onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                                  style={{
                                    padding: '4px 8px',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '4px',
                                    fontSize: '11px'
                                  }}
                                >
                                  <option value="pending">待处理</option>
                                  <option value="in_progress">进行中</option>
                                  <option value="completed">已完成</option>
                                  <option value="failed">失败</option>
                                  <option value="skipped">跳过</option>
                                </select>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#F44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '11px'
                                  }}
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'reports' && (
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#333' }}>
                        报告管理 ({reports.length})
                      </h3>
                      <button
                        onClick={() => setShowReportDialog(true)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#007AFF',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      >
                        生成报告
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '24px' }}>
                      {/* 报告列表 */}
                      <div style={{ flex: 1, maxWidth: '400px' }}>
                        {reports.length === 0 ? (
                          <div style={{
                            padding: '32px',
                            textAlign: 'center',
                            color: '#999',
                            fontSize: '14px',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0'
                          }}>
                            暂无报告
                            <br />
                            <button
                              onClick={() => setShowReportDialog(true)}
                              style={{
                                marginTop: '12px',
                                padding: '8px 16px',
                                backgroundColor: '#007AFF',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              生成第一个报告
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {reports.map((report) => (
                              <div
                                key={report.id}
                                onClick={() => handleViewReport(report.id)}
                                style={{
                                  padding: '12px',
                                  backgroundColor: selectedReport?.id === report.id ? '#E3F2FD' : '#f9f9f9',
                                  border: selectedReport?.id === report.id ? '2px solid #007AFF' : '1px solid #e0e0e0',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>
                                  {report.title}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                                  类型: {report.type === 'summary' ? '摘要' : report.type === 'progress' ? '进度' : report.type === 'tasks' ? '任务' : '时间'}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: '11px', color: '#999' }}>
                                    {formatDate(report.generatedAt)}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteReport(report.id)
                                    }}
                                    style={{
                                      padding: '2px 8px',
                                      backgroundColor: '#F44336',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '10px'
                                    }}
                                  >
                                    删除
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 报告详情 */}
                      <div style={{ flex: 2 }}>
                        {!selectedReport ? (
                          <div style={{
                            padding: '48px',
                            textAlign: 'center',
                            color: '#999',
                            fontSize: '14px',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0'
                          }}>
                            请选择一个报告查看详情
                          </div>
                        ) : (
                          <div style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            padding: '24px'
                          }}>
                            <div style={{ marginBottom: '24px' }}>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: '#333' }}>
                                {selectedReport.title}
                              </h4>
                              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#666' }}>
                                <div>类型: {selectedReport.type === 'summary' ? '摘要' : selectedReport.type === 'progress' ? '进度' : selectedReport.type === 'tasks' ? '任务' : '时间'}</div>
                                <div>生成时间: {formatDate(selectedReport.generatedAt)}</div>
                                <div>生成者: {selectedReport.generatedBy}</div>
                              </div>
                            </div>

                            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px' }}>
                              <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#333' }}>
                                报告内容
                              </h5>
                              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                                {JSON.stringify(selectedReport.data, null, 2)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showCreateDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '500px',
            maxWidth: '90%'
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#333' }}>
              创建新项目
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  项目名称 *
                </label>
                <input
                  type="text"
                  value={newProject.title}
                  onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="输入项目名称"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  项目描述
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="输入项目描述"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  优先级
                </label>
                <select
                  value={newProject.priority}
                  onChange={(e) => setNewProject({ ...newProject, priority: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="critical">紧急</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  项目路径
                </label>
                <input
                  type="text"
                  value={newProject.path}
                  onChange={(e) => setNewProject({ ...newProject, path: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="输入项目路径（可选）"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  预估工时（小时）
                </label>
                <input
                  type="number"
                  value={newProject.estimatedHours}
                  onChange={(e) => setNewProject({ ...newProject, estimatedHours: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="0"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  预算（可选）
                </label>
                <input
                  type="number"
                  value={newProject.budget}
                  onChange={(e) => setNewProject({ ...newProject, budget: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="0"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <button
                onClick={() => setShowCreateDialog(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                取消
              </button>
              <button
                onClick={handleCreateProject}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007AFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: loading ? 0.5 : 1
                }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {showTaskDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '500px',
            maxWidth: '90%'
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#333' }}>
              创建新任务
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  任务名称 *
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="输入任务名称"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  任务描述
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="输入任务描述"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  优先级
                </label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="critical">紧急</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  预估工时（小时）
                </label>
                <input
                  type="number"
                  value={newTask.estimatedHours}
                  onChange={(e) => setNewTask({ ...newTask, estimatedHours: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="0"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  分配给
                </label>
                <input
                  type="text"
                  value={newTask.assignee}
                  onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="输入负责人（可选）"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <button
                onClick={() => setShowTaskDialog(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                取消
              </button>
              <button
                onClick={handleCreateTask}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007AFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: loading ? 0.5 : 1
                }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '500px',
            maxWidth: '90%'
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#333' }}>
              生成报告
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  报告标题 *
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="输入报告标题"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  报告类型
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="summary">摘要报告</option>
                  <option value="progress">进度报告</option>
                  <option value="tasks">任务报告</option>
                  <option value="time">时间报告</option>
                </select>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#F5F5F5', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {reportType === 'summary' && '摘要报告：包含项目概览、任务状态和时间统计'}
                  {reportType === 'progress' && '进度报告：详细的项目进度、任务状态分布和时间线'}
                  {reportType === 'tasks' && '任务报告：按状态和优先级分类的任务详情'}
                  {reportType === 'time' && '时间报告：项目和任务的时间估算与实际消耗'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <button
                onClick={() => setShowReportDialog(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                取消
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={loading || !reportTitle.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007AFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (loading || !reportTitle.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: (loading || !reportTitle.trim()) ? 0.5 : 1
                }}
              >
                生成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
