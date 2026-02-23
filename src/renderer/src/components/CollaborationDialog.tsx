import React, { useState, useEffect } from 'react'
import './CollaborationDialog.css'

interface CollaborationRequest {
  id: string
  taskId: string
  phase: string
  title: string
  description: string
  content: any
  alternatives?: string[]
  editableParams?: string[]
  timestamp: number
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  userResponse?: string
  modifiedParams?: any
}

interface CollaborationDialogProps {
  onClose?: () => void
}

const CollaborationDialog: React.FC<CollaborationDialogProps> = ({ onClose }) => {
  const [visible, setVisible] = useState(false)
  const [request, setRequest] = useState<CollaborationRequest | null>(null)
  const [feedback, setFeedback] = useState('')
  const [isModifying, setIsModifying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 阶段显示名称映射
  const phaseNames: Record<string, string> = {
    'requirements': '需求分析',
    'architecture': '架构设计',
    'implementation': '代码实现',
    'review': '代码审查'
  }

  // 获取阶段显示名称
  const getPhaseName = (phase: string): string => {
    return phaseNames[phase] || phase
  }

  // 获取阶段样式类
  const getPhaseClass = (phase: string): string => {
    switch (phase) {
      case 'requirements': return 'phase-pm'
      case 'architecture': return 'phase-ui'
      case 'implementation': return 'phase-code'
      case 'review': return 'phase-review'
      default: return 'phase-default'
    }
  }

  useEffect(() => {
    // 监听协作请求事件
    const unsubscribe = window.electron?.collaboration?.onEvent?.((event: any) => {
      console.log('[CollaborationDialog] 收到协作事件:', event)
      
      if (event.type === 'collaboration:request') {
        setRequest(event)
        setVisible(true)
        setIsModifying(false)
        setFeedback('')
      }
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  // 处理确认
  const handleApprove = async () => {
    if (!request) return
    
    setIsLoading(true)
    try {
      // 如果用户选择了方向选项，将选择的选项作为 approvedOption 传递
      const responseText = feedback && request.alternatives?.includes(feedback) 
        ? `用户选择方向: ${feedback}` 
        : '用户已确认方案'
      
      await window.electron?.collaboration?.approve?.(request.id, responseText)
      setVisible(false)
      onClose?.()
    } catch (error) {
      console.error('[CollaborationDialog] 确认失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 处理拒绝
  const handleReject = async () => {
    if (!request) return
    
    const reason = prompt('请输入拒绝原因:')
    if (reason === null) return // 用户取消
    
    setIsLoading(true)
    try {
      await window.electron?.collaboration?.reject?.(request.id, reason || '用户拒绝方案')
      setVisible(false)
      onClose?.()
    } catch (error) {
      console.error('[CollaborationDialog] 拒绝失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 处理修改
  const handleModify = async () => {
    if (!request) return
    
    if (!feedback.trim()) {
      alert('请输入修改意见')
      return
    }
    
    setIsLoading(true)
    try {
      await window.electron?.collaboration?.modify?.(request.id, {}, feedback)
      setVisible(false)
      setIsModifying(false)
      onClose?.()
    } catch (error) {
      console.error('[CollaborationDialog] 修改失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 快捷操作：简化需求
  const handleSimplify = () => {
    setIsModifying(true)
    setFeedback('请简化方案，去除复杂的功能需求，保留核心功能即可。')
  }

  // 快捷操作：增加功能
  const handleAddFeatures = () => {
    setIsModifying(true)
    setFeedback('请增加以下功能：')
  }

  // 快捷操作：调整界面
  const handleAdjustUI = () => {
    setIsModifying(true)
    setFeedback('请调整界面设计，使界面更简洁美观。')
  }

  // 快捷操作：调整代码
  const handleAdjustCode = () => {
    setIsModifying(true)
    setFeedback('请调整代码实现方式，优化代码结构和性能。')
  }

  // 渲染内容
  const renderContent = (content: any) => {
    if (!content) return <p className="no-content">暂无内容</p>
    
    // 如果是字符串，直接显示
    if (typeof content === 'string') {
      return <pre className="content-text">{content}</pre>
    }
    
    // 如果是对象，尝试格式化
    if (typeof content === 'object') {
      return <pre className="content-json">{JSON.stringify(content, null, 2)}</pre>
    }
    
    return <p className="no-content">无法显示内容</p>
  }

  if (!visible || !request) return null

  return (
    <div className="collaboration-dialog-overlay">
      <div className="collaboration-dialog">
        {/* 头部 */}
        <div className="dialog-header">
          <div className="header-left">
            <span className={`phase-badge ${getPhaseClass(request.phase)}`}>
              {getPhaseName(request.phase)}
            </span>
          </div>
          <div className="header-center">
            <h2>{request.title}</h2>
          </div>
          <div className="header-right">
            {/* 可以添加关闭按钮，但通常需要用户做出选择 */}
          </div>
        </div>

        {/* 描述 */}
        <div className="dialog-description">
          <p>{request.description}</p>
        </div>

        {/* 内容区域 */}
        <div className="dialog-content">
          {/* 如果有替代方案（方向选项），显示选项选择器 */}
          {request.alternatives && request.alternatives.length > 0 && (
            <div className="alternatives-section">
              <h3>请选择方案方向：</h3>
              <div className="alternatives-list">
                {request.alternatives.map((alt, index) => (
                  <button
                    key={index}
                    className={`alternative-option ${feedback === alt ? 'selected' : ''}`}
                    onClick={() => setFeedback(alt)}
                    disabled={isLoading}
                  >
                    {alt}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {renderContent(request.content)}
        </div>

        {/* 修改反馈区域 */}
        {isModifying && (
          <div className="dialog-feedback">
            <label htmlFor="feedback-input">请输入您的修改意见：</label>
            <textarea
              id="feedback-input"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="描述您希望如何修改..."
              rows={4}
              disabled={isLoading}
            />
          </div>
        )}

        {/* 底部按钮区域 */}
        <div className="dialog-footer">
          {isModifying ? (
            <>
              <button 
                className="btn btn-ghost"
                onClick={() => setIsModifying(false)}
                disabled={isLoading}
              >
                取消
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleModify}
                disabled={isLoading || !feedback.trim()}
              >
                {isLoading ? '提交中...' : '提交修改'}
              </button>
            </>
          ) : (
            <>
              <button 
                className="btn btn-danger"
                onClick={handleReject}
                disabled={isLoading}
              >
                拒绝
              </button>
              
              <div className="btn-group">
                <button 
                  className="btn btn-secondary"
                  onClick={handleModify}
                  disabled={isLoading}
                >
                  需要修改
                </button>
                
                {/* 根据阶段显示不同的快捷操作 */}
                {request.phase === 'requirements' && (
                  <>
                    <button 
                      className="btn btn-outline"
                      onClick={handleSimplify}
                      disabled={isLoading}
                    >
                      简化需求
                    </button>
                    <button 
                      className="btn btn-outline"
                      onClick={handleAddFeatures}
                      disabled={isLoading}
                    >
                      增加功能
                    </button>
                  </>
                )}
                
                {request.phase === 'architecture' && (
                  <>
                    <button 
                      className="btn btn-outline"
                      onClick={handleAdjustUI}
                      disabled={isLoading}
                    >
调整界面
                    </button>
                  </>
                )}
                
                {request.phase === 'implementation' && (
                  <>
                    <button 
                      className="btn btn-outline"
                      onClick={handleAdjustCode}
                      disabled={isLoading}
                    >
                      调整代码
                    </button>
                  </>
                )}
              </div>
              
              <button 
                className="btn btn-success"
                onClick={handleApprove}
                disabled={isLoading}
              >
                {isLoading ? '确认中...' : '确认方案'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CollaborationDialog
