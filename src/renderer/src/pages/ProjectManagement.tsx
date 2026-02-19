import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Project {
  id: string
  title: string
  status: string
  timestamp: number
  logs: string[]
  path?: string
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
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [planContent, setPlanContent] = useState<string>('')
  const [planVersions, setPlanVersions] = useState<PlanVersion[]>([])
  const [editingPlan, setEditingPlan] = useState(false)
  const [gitStatus, setGitStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadProjects()
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
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
          onClick={() => navigate('/')}
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
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#333' }}>
              项目列表 ({projects.length})
            </h2>
            {projects.length === 0 ? (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: '#999',
                fontSize: '14px'
              }}>
                暂无项目
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
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedProject ? (
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
                    {formatDate(selectedProject.timestamp)} · {selectedProject.status}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!gitStatus && (
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
