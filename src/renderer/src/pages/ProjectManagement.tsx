import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatDataService, ChatSession } from '../services/ChatDataService'

interface Project {
  id: string
  title: string
  status: string
  timestamp: number
  logs: string[]
  path?: string
  description?: string
  version?: string
  fileCount?: number
  createdAt?: number
  modifiedAt?: number
}

interface FileSystemProject {
  name: string
  description: string
  version: string
  path: string
  fileCount: number
  createdAt: number
  modifiedAt: number
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

interface PlanVersion {
  id: string
  timestamp: number
  message: string
  author: string
}

const ProjectManagement: React.FC = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [fileSystemProjects, setFileSystemProjects] = useState<FileSystemProject[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedFsProject, setSelectedFsProject] = useState<FileSystemProject | null>(null)
  const [planContent, setPlanContent] = useState<string>('')
  const [planVersions, setPlanVersions] = useState<PlanVersion[]>([])
  const [editingPlan, setEditingPlan] = useState(false)
  const [gitStatus, setGitStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'task' | 'filesystem'>('task')
  const [butlerProblem, setButlerProblem] = useState('')
  const [butlerSolution, setButlerSolution] = useState<{ success: boolean; solution?: string; steps?: string[] } | null>(null)
  const [butlerLoading, setButlerLoading] = useState(false)

  useEffect(() => {
    loadProjects()
    loadFileSystemProjects()
  }, [])

  const loadProjects = () => {
    try {
      const saved = localStorage.getItem('trae_task_history')
      if (saved) {
        const parsed = JSON.parse(saved)
        setProjects(parsed)
      }
    } catch (error) {
      console.error('加载项目失败:', error)
    }
  }

  const loadFileSystemProjects = async () => {
    try {
      const projectsDir = '/Users/wangchao/Desktop/本地化TRAE/projects'
      const result = await window.electron.fs.scanProjectsDirectory(projectsDir)
      if (result.success && result.projects) {
        setFileSystemProjects(result.projects)
      } else {
        console.error('加载文件系统项目失败:', result.error)
      }
    } catch (error) {
      console.error('加载文件系统项目失败:', error)
    }
  }

  const loadProjectPlan = async (project: Project) => {
    setSelectedProject(project)
    setLoading(true)

    try {
      if (project.path) {
        const planPath = `${project.path}/project/PROJECT_PLAN.md`
        const result = await window.electron.api.readFile(planPath)
        if (result.success && result.content) {
          setPlanContent(result.content)
        } else {
          setPlanContent('未找到项目计划文件')
        }
      } else {
        setPlanContent('项目路径未设置，无法加载项目计划')
      }

      await loadGitStatus(project)
      await loadPlanVersions(project)
    } catch (error) {
      console.error('加载项目计划失败:', error)
      setPlanContent('加载项目计划失败')
    } finally {
      setLoading(false)
    }
  }

  const loadGitStatus = async (project: Project) => {
    try {
      if (project.path) {
        const result = await window.electron.api.getGitStatus(project.path)
        if (result.success) {
          setGitStatus(result.status)
        } else {
          setGitStatus(null)
        }
      }
    } catch (error) {
      console.error('加载Git状态失败:', error)
      setGitStatus(null)
    }
  }

  const loadPlanVersions = async (project: Project) => {
    try {
      if (project.path) {
        const result = await window.electron.api.getPlanVersions(project.path)
        if (result.success && result.versions) {
          setPlanVersions(result.versions)
        } else {
          setPlanVersions([])
        }
      }
    } catch (error) {
      console.error('加载Plan版本失败:', error)
      setPlanVersions([])
    }
  }

  const savePlan = async () => {
    if (!selectedProject || !selectedProject.path) {
      alert('项目路径未设置')
      return
    }

    setLoading(true)
    try {
      const planPath = `${selectedProject.path}/project/PROJECT_PLAN.md`
      const result = await window.electron.api.writeFile(planPath, planContent)
      if (result.success) {
        alert('项目计划保存成功')
        setEditingPlan(false)
      } else {
        alert('保存失败: ' + result.error)
      }
    } catch (error) {
      console.error('保存项目计划失败:', error)
      alert('保存项目计划失败')
    } finally {
      setLoading(false)
    }
  }

  const commitPlan = async (message: string) => {
    if (!selectedProject || !selectedProject.path) {
      alert('项目路径未设置')
      return
    }

    setLoading(true)
    try {
      const result = await window.electron.api.commitPlan(selectedProject.path, message)
      if (result.success) {
        alert('提交成功')
        await loadGitStatus(selectedProject)
        await loadPlanVersions(selectedProject)
      } else {
        alert('提交失败: ' + result.error)
      }
    } catch (error) {
      console.error('提交失败:', error)
      alert('提交失败')
    } finally {
      setLoading(false)
    }
  }

  const initGit = async () => {
    if (!selectedProject || !selectedProject.path) {
      alert('项目路径未设置')
      return
    }

    setLoading(true)
    try {
      const result = await window.electron.api.initGit(selectedProject.path)
      if (result.success) {
        alert('Git初始化成功')
        await loadGitStatus(selectedProject)
      } else {
        alert('Git初始化失败: ' + result.error)
      }
    } catch (error) {
      console.error('Git初始化失败:', error)
      alert('Git初始化失败')
    } finally {
      setLoading(false)
    }
  }

  const restorePlanVersion = async (versionId: string) => {
    if (!selectedProject || !selectedProject.path) {
      alert('项目路径未设置')
      return
    }

    if (!confirm('确定要恢复到此版本吗？当前未保存的更改将丢失。')) {
      return
    }

    setLoading(true)
    try {
      const result = await window.electron.api.restorePlanVersion(selectedProject.path, versionId)
      if (result.success) {
        alert('恢复成功')
        await loadProjectPlan(selectedProject)
      } else {
        alert('恢复失败: ' + result.error)
      }
    } catch (error) {
      console.error('恢复版本失败:', error)
      alert('恢复版本失败')
    } finally {
      setLoading(false)
    }
  }

  const setProjectPath = async () => {
    if (!selectedProject) {
      alert('请先选择一个项目')
      return
    }

    try {
      console.log('开始设置项目路径，当前项目:', selectedProject)
      const result = await window.electron.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择项目目录',
        message: '请选择一个目录作为项目的存储位置'
      })

      console.log('对话框结果:', result)

      if (result.success && result.filePaths && result.filePaths.length > 0) {
        const newPath = result.filePaths[0]
        
        // 更新本地存储中的项目路径
        const updatedProjects = projects.map(project => 
          project.id === selectedProject.id ? { ...project, path: newPath } : project
        )
        localStorage.setItem('trae_task_history', JSON.stringify(updatedProjects))
        setProjects(updatedProjects)
        
        // 更新当前选中的项目
        const updatedProject = { ...selectedProject, path: newPath }
        setSelectedProject(updatedProject)
        
        // 重新加载项目计划
        await loadProjectPlan(updatedProject)
        alert('项目路径设置成功')
      } else if (result.canceled) {
        console.log('用户取消了选择')
      } else {
        console.error('对话框返回失败:', result)
        alert('选择目录失败: ' + (result.error || '未知错误'))
      }
    } catch (error: any) {
      console.error('设置项目路径失败:', error)
      alert('设置项目路径失败: ' + error.message)
    }
  }

  const changeProjectPath = async () => {
    if (!selectedProject) return

    try {
      const result = await window.electron.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '更改项目目录',
        message: '请选择一个新的目录作为项目的存储位置',
        defaultPath: selectedProject.path
      })

      if (result.success && result.filePaths && result.filePaths.length > 0) {
        const newPath = result.filePaths[0]
        
        // 更新本地存储中的项目路径
        const updatedProjects = projects.map(project => 
          project.id === selectedProject.id ? { ...project, path: newPath } : project
        )
        localStorage.setItem('trae_task_history', JSON.stringify(updatedProjects))
        setProjects(updatedProjects)
        
        // 更新当前选中的项目
        const updatedProject = { ...selectedProject, path: newPath }
        setSelectedProject(updatedProject)
        
        // 重新加载项目计划
        await loadProjectPlan(updatedProject)
        alert('项目路径修改成功')
      }
    } catch (error) {
      console.error('修改项目路径失败:', error)
      alert('修改项目路径失败')
    }
  }

  const deleteProject = async (project: Project) => {
    if (!confirm(`确定要删除项目 "${project.title}" 吗？此操作不可撤销。`)) {
      return
    }

    try {
      // 从本地存储中删除项目
      const updatedProjects = projects.filter(p => p.id !== project.id)
      localStorage.setItem('trae_task_history', JSON.stringify(updatedProjects))
      setProjects(updatedProjects)
      
      // 如果删除的是当前选中的项目，清除选中状态
      if (selectedProject && selectedProject.id === project.id) {
        setSelectedProject(null)
        setPlanContent('')
        setPlanVersions([])
        setGitStatus(null)
      }
      
      alert('项目删除成功')
    } catch (error) {
      console.error('删除项目失败:', error)
      alert('删除项目失败')
    }
  }

  const handleReturnToChat = () => {
    if (selectedProject) {
      // 查找与当前项目关联的聊天会话
      let projectSession = chatDataService.getSessions().find(session => session.projectId === selectedProject.id)
      
      // 如果没有找到，创建一个新的会话
      if (!projectSession) {
        projectSession = chatDataService.createSession(
          `${selectedProject.title} - 项目聊天`,
          ['agent-dev'], // 默认使用开发智能体
          'direct'
        )
        // 设置项目关联
        chatDataService.updateSession(projectSession.id, { projectId: selectedProject.id })
      }
      
      // 存储当前会话ID到sessionStorage
      sessionStorage.setItem('currentChatSessionId', projectSession.id)
      sessionStorage.setItem('currentProjectId', selectedProject.id)
      
      // 导航到聊天页面
      navigate('/chat')
    } else {
      // 没有选中项目，直接返回首页
      navigate('/')
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const handleButlerSolve = async () => {
    if (!selectedFsProject || !butlerProblem.trim()) {
      alert('请输入问题描述')
      return
    }

    setButlerLoading(true)
    setButlerSolution(null)

    try {
      const result = await window.electron.butler.solveProjectProblem(
        selectedFsProject.name,
        selectedFsProject.name,
        selectedFsProject.path,
        butlerProblem
      )

      setButlerSolution(result)
    } catch (error: any) {
      console.error('智能管家解决问题失败:', error)
      alert('智能管家解决问题失败: ' + error.message)
    } finally {
      setButlerLoading(false)
    }
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
        <button
          onClick={() => handleReturnToChat()}
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
          返回聊天
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{
          width: '350px',
          backgroundColor: 'white',
          borderRight: '1px solid #e0e0e0',
          overflow: 'auto'
        }}>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => setActiveTab('task')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: activeTab === 'task' ? '#007AFF' : '#f0f0f0',
                  color: activeTab === 'task' ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                任务项目 ({projects.length})
              </button>
              <button
                onClick={() => setActiveTab('filesystem')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: activeTab === 'filesystem' ? '#007AFF' : '#f0f0f0',
                  color: activeTab === 'filesystem' ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                文件系统项目 ({fileSystemProjects.length})
              </button>
            </div>

            {activeTab === 'task' && (
              <>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#333' }}>
                  任务项目列表
                </h2>
                {projects.length === 0 ? (
                  <div style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: '#999',
                    fontSize: '14px'
                  }}>
                    暂无任务项目
                  </div>
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => loadProjectPlan(project)}
                      style={{
                        padding: '12px',
                        marginBottom: '8px',
                        backgroundColor: selectedProject?.id === project.id ? '#E3F2FD' : '#f9f9f9',
                        border: selectedProject?.id === project.id ? '2px solid #007AFF' : '1px solid #e0e0e0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedProject?.id !== project.id) {
                          e.currentTarget.style.backgroundColor = '#f0f0f0'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedProject?.id !== project.id) {
                          e.currentTarget.style.backgroundColor = '#f9f9f9'
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#333', flex: 1 }}>
                          {project.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: project.status === '已完成' ? '#4CAF50' : '#FF9800',
                            color: 'white',
                            fontWeight: 500
                          }}>
                            {project.status}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProject(project);
                            }}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '10px',
                              fontWeight: 500
                            }}
                            title="删除项目"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        {formatDate(project.timestamp)}
                      </div>
                      {project.path && (
                        <div style={{ fontSize: '11px', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📁 {project.path}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'filesystem' && (
              <>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#333' }}>
                  文件系统项目列表
                </h2>
                {fileSystemProjects.length === 0 ? (
                  <div style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: '#999',
                    fontSize: '14px'
                  }}>
                    暂无文件系统项目
                  </div>
                ) : (
                  fileSystemProjects.map((project) => (
                    <div
                      key={project.path}
                      onClick={() => setSelectedFsProject(project)}
                      style={{
                        padding: '12px',
                        marginBottom: '8px',
                        backgroundColor: selectedFsProject?.path === project.path ? '#E3F2FD' : '#f9f9f9',
                        border: selectedFsProject?.path === project.path ? '2px solid #007AFF' : '1px solid #e0e0e0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedFsProject?.path !== project.path) {
                          e.currentTarget.style.backgroundColor = '#f0f0f0'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedFsProject?.path !== project.path) {
                          e.currentTarget.style.backgroundColor = '#f9f9f9'
                        }
                      }}
                    >
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>
                        {project.name}
                      </div>
                      {project.description && (
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          {project.description}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
                        版本: {project.version}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
                        文件数: {project.fileCount}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📁 {project.path}
                      </div>
                      {Object.keys(project.scripts).length > 0 && (
                        <div style={{ fontSize: '11px', color: '#007AFF', marginTop: '4px' }}>
                          可用脚本: {Object.keys(project.scripts).join(', ')}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedProject && !selectedFsProject ? (
            <div style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#999',
              fontSize: '14px'
            }}>
              请选择一个项目查看详情
            </div>
          ) : selectedFsProject ? (
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
                    {selectedFsProject.name}
                  </h2>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    版本 {selectedFsProject.version} · {selectedFsProject.fileCount} 个文件
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={async () => {
                      const commonScripts = ['dev', 'start', 'serve', 'run']
                      const availableScript = commonScripts.find(script => selectedFsProject.scripts[script])
                      
                      if (availableScript) {
                        const result = await window.electron.fs.runNpmScript(selectedFsProject.path, availableScript)
                        if (result.success) {
                          alert(result.message)
                        } else {
                          alert(`执行失败: ${result.error}`)
                        }
                      } else {
                        alert('该项目没有常见的启动脚本（dev/start/serve/run），请从下方脚本列表中选择一个运行')
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    运行应用
                  </button>
                  <button
                    onClick={() => window.electron.tools.openPath(selectedFsProject.path)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#007AFF',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    在VSCode中打开
                  </button>
                  <button
                    onClick={() => window.electron.system.openExternal(`file://${selectedFsProject.path}`)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#FF9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    在Finder中显示
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, padding: '24px', overflow: 'auto', backgroundColor: '#f5f5f5' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#333' }}>
                    项目信息
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>项目名称</div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>{selectedFsProject.name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>版本</div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>{selectedFsProject.version}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>文件数量</div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>{selectedFsProject.fileCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>创建时间</div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>{formatDate(selectedFsProject.createdAt)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>修改时间</div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>{formatDate(selectedFsProject.modifiedAt)}</div>
                    </div>
                  </div>
                  {selectedFsProject.description && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>描述</div>
                      <div style={{ fontSize: '14px', color: '#333' }}>{selectedFsProject.description}</div>
                    </div>
                  )}
                </div>

                {Object.keys(selectedFsProject.scripts).length > 0 && (
                  <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#333' }}>
                      可用脚本
                    </h3>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {Object.entries(selectedFsProject.scripts).map(([name, script]) => (
                        <div
                          key={name}
                          style={{
                            padding: '12px',
                            backgroundColor: '#f9f9f9',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', marginBottom: '4px' }}>
                              {name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{script}</div>
                          </div>
                          <button
                            onClick={async () => {
                              const result = await window.electron.fs.runNpmScript(selectedFsProject.path, name)
                              if (result.success) {
                                alert(result.message)
                              } else {
                                alert(`执行失败: ${result.error}`)
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#007AFF',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 500
                            }}
                          >
                            运行
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(Object.keys(selectedFsProject.dependencies).length > 0 || Object.keys(selectedFsProject.devDependencies).length > 0) && (
                  <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#333' }}>
                      依赖项
                    </h3>
                    {Object.keys(selectedFsProject.dependencies).length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', marginBottom: '8px' }}>
                          生产依赖 ({Object.keys(selectedFsProject.dependencies).length})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {Object.entries(selectedFsProject.dependencies).map(([name, version]) => (
                            <span
                              key={name}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#E3F2FD',
                                color: '#007AFF',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 500
                              }}
                            >
                              {name}@{version}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {Object.keys(selectedFsProject.devDependencies).length > 0 && (
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', marginBottom: '8px' }}>
                          开发依赖 ({Object.keys(selectedFsProject.devDependencies).length})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {Object.entries(selectedFsProject.devDependencies).map(([name, version]) => (
                            <span
                              key={name}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#FFF3E0',
                                color: '#FF9800',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 500
                              }}
                            >
                              {name}@{version}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#333' }}>
                    智能管家 - 问题解决
                  </h3>
                  <div style={{ marginBottom: '16px' }}>
                    <textarea
                      value={butlerProblem}
                      onChange={(e) => setButlerProblem(e.target.value)}
                      placeholder="描述您遇到的项目问题，智能管家将自动分析并提供解决方案..."
                      style={{
                        width: '100%',
                        minHeight: '100px',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <button
                    onClick={handleButlerSolve}
                    disabled={butlerLoading}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: butlerLoading ? '#ccc' : '#007AFF',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: butlerLoading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    {butlerLoading ? '正在分析...' : '让智能管家解决'}
                  </button>

                  {butlerSolution && (
                    <div style={{ marginTop: '16px', padding: '16px', backgroundColor: butlerSolution.success ? '#E8F5E9' : '#FFEBEE', borderRadius: '6px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: butlerSolution.success ? '#2E7D32' : '#C62828', marginBottom: '8px' }}>
                        {butlerSolution.success ? '✓ 解决方案' : '✗ 分析结果'}
                      </div>
                      {butlerSolution.solution && (
                        <div style={{ fontSize: '14px', color: '#333', marginBottom: '12px' }}>
                          {butlerSolution.solution}
                        </div>
                      )}
                      {butlerSolution.steps && butlerSolution.steps.length > 0 && (
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#666', marginBottom: '8px' }}>
                            建议步骤：
                          </div>
                          <ol style={{ margin: 0, paddingLeft: '20px' }}>
                            {butlerSolution.steps.map((step, index) => (
                              <li key={index} style={{ fontSize: '13px', color: '#333', marginBottom: '4px' }}>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
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
                    {selectedProject?.title}
                  </h2>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {selectedProject ? `${formatDate(selectedProject.timestamp)} · ${selectedProject.status}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!selectedProject?.path && (
                    <button
                      onClick={setProjectPath}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#FF9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      设置项目路径
                    </button>
                  )}
                  {selectedProject?.path && (
                    <button
                      onClick={changeProjectPath}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#9C27B0',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      修改项目路径
                    </button>
                  )}
                  {!gitStatus && selectedProject?.path && (
                    <button
                      onClick={initGit}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      初始化Git
                    </button>
                  )}
                  {gitStatus && (
                    <button
                      onClick={() => {
                        const message = prompt('请输入提交消息:', '更新项目计划')
                        if (message) {
                          commitPlan(message)
                        }
                      }}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#007AFF',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      提交更改
                    </button>
                  )}
                  <button
                    onClick={() => setEditingPlan(!editingPlan)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: editingPlan ? '#FF9800' : '#007AFF',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    {editingPlan ? '取消编辑' : '编辑计划'}
                  </button>
                  {editingPlan && (
                    <button
                      onClick={savePlan}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      保存
                    </button>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#f5f5f5',
                    borderBottom: '1px solid #e0e0e0',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#333'
                  }}>
                    项目计划
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                    {loading ? (
                      <div style={{ textAlign: 'center', color: '#999', padding: '32px' }}>
                        加载中...
                      </div>
                    ) : editingPlan ? (
                      <textarea
                        value={planContent}
                        onChange={(e) => setPlanContent(e.target.value)}
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '400px',
                          padding: '12px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '6px',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                          resize: 'none'
                        }}
                      />
                    ) : (
                      <div style={{
                        whiteSpace: 'pre-wrap',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: '#333'
                      }}>
                        {planContent}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{
                  width: '300px',
                  backgroundColor: 'white',
                  borderLeft: '1px solid #e0e0e0',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#f5f5f5',
                    borderBottom: '1px solid #e0e0e0',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#333'
                  }}>
                    版本历史 ({planVersions.length})
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                    {planVersions.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        color: '#999',
                        fontSize: '12px',
                        padding: '32px 0'
                      }}>
                        {gitStatus ? '暂无版本记录' : '请先初始化Git'}
                      </div>
                    ) : (
                      planVersions.map((version) => (
                        <div
                          key={version.id}
                          style={{
                            padding: '12px',
                            marginBottom: '8px',
                            backgroundColor: '#f9f9f9',
                            border: '1px solid #e0e0e0',
                            borderRadius: '6px'
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>
                            {version.message}
                          </div>
                          <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                            {version.author} · {formatDate(version.timestamp)}
                          </div>
                          <button
                            onClick={() => restorePlanVersion(version.id)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#007AFF',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 500
                            }}
                          >
                            恢复此版本
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProjectManagement
