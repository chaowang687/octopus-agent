import React, { useState, useEffect } from 'react'
import './OmniAgentPanel.css'

interface OmniAgentPanelProps {
  onClose?: () => void
}

const OmniAgentPanel: React.FC<OmniAgentPanelProps> = ({ onClose }) => {
  const [instruction, setInstruction] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [activeProject, setActiveProject] = useState<any>(null)
  const [permissionLevel, setPermissionLevel] = useState<string>('super_admin')
  const [taskHistory, setTaskHistory] = useState<any[]>([])
  const [healthStatus, setHealthStatus] = useState<any>(null)

  useEffect(() => {
    loadProjects()
    loadTaskHistory()
    checkHealth()
  }, [])

  const loadProjects = async () => {
    try {
      const response = await window.electron.omni.getAllProjects()
      if (response.success) {
        setProjects(response.projects)
      }
    } catch (error) {
      console.error('加载项目失败:', error)
    }
  }

  const loadTaskHistory = async () => {
    try {
      const response = await window.electron.omni.getTaskHistory()
      if (response.success) {
        setTaskHistory(response.history)
      }
    } catch (error) {
      console.error('加载任务历史失败:', error)
    }
  }

  const checkHealth = async () => {
    try {
      const response = await window.electron.omni.healthCheck()
      if (response.success) {
        setHealthStatus(response.health)
      }
    } catch (error) {
      console.error('健康检查失败:', error)
    }
  }

  const handleExecuteTask = async () => {
    if (!instruction.trim() || isExecuting) return

    setIsExecuting(true)
    setResult(null)

    try {
      const response = await window.electron.omni.executeTask(instruction, {
        projectId: activeProject?.projectId,
        permissionLevel: permissionLevel as any,
        enableMultimodal: true,
        enableDeepReasoning: true,
        enableSelfCorrection: true
      })

      if (response.success) {
        setResult(response.result)
        await loadTaskHistory()
      } else {
        setResult({ error: response.error })
      }
    } catch (error: any) {
      setResult({ error: error.message })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleSwitchProject = async (projectId: string) => {
    try {
      const response = await window.electron.omni.switchProject(projectId)
      if (response.success) {
        const project = projects.find(p => p.projectId === projectId)
        setActiveProject(project)
      }
    } catch (error) {
      console.error('切换项目失败:', error)
    }
  }

  const handleAddProject = async () => {
    const name = prompt('请输入项目名称:')
    if (!name) return

    const projectPath = prompt('请输入项目路径:')
    if (!projectPath) return

    try {
      const response = await window.electron.omni.addProject({
        projectId: `project_${Date.now()}`,
        name,
        path: projectPath,
        type: 'web',
        techStack: ['React', 'TypeScript']
      })

      if (response.success) {
        await loadProjects()
        alert('项目添加成功!')
      }
    } catch (error) {
      console.error('添加项目失败:', error)
      alert('添加项目失败: ' + error)
    }
  }

  const getHealthStatusColor = () => {
    if (!healthStatus) return '#999'
    switch (healthStatus.status) {
      case 'healthy': return '#4CAF50'
      case 'degraded': return '#FF9800'
      case 'unhealthy': return '#F44336'
      default: return '#999'
    }
  }

  const getHealthStatusText = () => {
    if (!healthStatus) return '未知'
    switch (healthStatus.status) {
      case 'healthy': return '健康'
      case 'degraded': return '降级'
      case 'unhealthy': return '不健康'
      default: return '未知'
    }
  }

  return (
    <div className="omni-agent-panel">
      <div className="omni-agent-header">
        <h2>🤖 全能智能体管家</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <div className="omni-agent-content">
        {/* 健康状态 */}
        <div className="health-status">
          <div className="status-indicator" style={{ backgroundColor: getHealthStatusColor() }}></div>
          <span className="status-text">{getHealthStatusText()}</span>
          <button className="refresh-button" onClick={checkHealth}>刷新</button>
        </div>

        {/* 项目管理 */}
        <div className="project-section">
          <h3>📁 项目管理</h3>
          <div className="project-controls">
            <select 
              value={activeProject?.projectId || ''} 
              onChange={(e) => handleSwitchProject(e.target.value)}
              className="project-select"
            >
              <option value="">选择项目...</option>
              {projects.map(project => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name} ({project.type})
                </option>
              ))}
            </select>
            <button className="add-project-button" onClick={handleAddProject}>+ 添加项目</button>
          </div>
          {activeProject && (
            <div className="active-project-info">
              <p><strong>当前项目:</strong> {activeProject.name}</p>
              <p><strong>路径:</strong> {activeProject.path}</p>
              <p><strong>技术栈:</strong> {activeProject.techStack.join(', ')}</p>
            </div>
          )}
        </div>

        {/* 权限管理 */}
        <div className="permission-section">
          <h3>🔐 权限管理</h3>
          <select 
            value={permissionLevel}
            onChange={(e) => setPermissionLevel(e.target.value)}
            className="permission-select"
          >
            <option value="read_only">只读</option>
            <option value="execute">执行</option>
            <option value="modify">修改</option>
            <option value="admin">管理员</option>
            <option value="super_admin">超级管理员</option>
          </select>
        </div>

        {/* 任务执行 */}
        <div className="task-section">
          <h3>🎯 任务执行</h3>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="请输入您的指令..."
            className="task-input"
            rows={6}
            disabled={isExecuting}
          />
          <button 
            className="execute-button"
            onClick={handleExecuteTask}
            disabled={isExecuting || !instruction.trim()}
          >
            {isExecuting ? '执行中...' : '执行任务'}
          </button>
        </div>

        {/* 执行结果 */}
        {result && (
          <div className="result-section">
            <h3>📊 执行结果</h3>
            {result.error ? (
              <div className="error-result">
                <p><strong>错误:</strong> {result.error}</p>
              </div>
            ) : (
              <div className="success-result">
                {result.answer && (
                  <div className="result-answer">
                    <h4>答案:</h4>
                    <p>{result.answer}</p>
                  </div>
                )}
                {result.reasoning && (
                  <div className="result-reasoning">
                    <h4>推理过程:</h4>
                    <p>{result.reasoning}</p>
                  </div>
                )}
                {result.artifacts && (
                  <div className="result-artifacts">
                    <h4>生成的文件:</h4>
                    {result.artifacts.files && Object.keys(result.artifacts.files).length > 0 && (
                      <ul>
                        {Object.keys(result.artifacts.files).map(fileName => (
                          <li key={fileName}>{fileName}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {result.statistics && (
                  <div className="result-statistics">
                    <h4>统计信息:</h4>
                    <p>总耗时: {result.statistics.totalDurationMs}ms</p>
                    <p>推理耗时: {result.statistics.reasoningDurationMs}ms</p>
                    <p>多模态耗时: {result.statistics.multimodalDurationMs}ms</p>
                    <p>使用的工具: {result.statistics.toolsUsed.join(', ') || '无'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 任务历史 */}
        {taskHistory.length > 0 && (
          <div className="history-section">
            <h3>📜 任务历史</h3>
            <div className="task-history-list">
              {taskHistory.slice(0, 10).map((task, index) => (
                <div key={task.taskId} className="history-item">
                  <div className="history-header">
                    <span className="history-index">#{index + 1}</span>
                    <span className="history-type">{task.taskType}</span>
                    <span className={`history-priority priority-${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="history-time">
                    {new Date(task.startTime).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OmniAgentPanel