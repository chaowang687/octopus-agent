import React, { useState, useEffect } from 'react'

interface DualSystemState {
  coordinationScore: number
  system1Score: number
  system2Score: number
  distillationAccuracy: number
  distilledItems: number
  projectFiles: number
  conversationHistory: number
}

const DualSystemSidebar: React.FC = () => {
  const [state, setState] = useState<DualSystemState>({
    coordinationScore: 80,
    system1Score: 75,
    system2Score: 85,
    distillationAccuracy: 85,
    distilledItems: 0,
    projectFiles: 0,
    conversationHistory: 0
  })

  // 定时更新状态（模拟实时数据）
  useEffect(() => {
    const interval = setInterval(() => {
      // 模拟数据变化
      setState(prev => ({
        ...prev,
        coordinationScore: Math.min(100, Math.max(60, prev.coordinationScore + (Math.random() > 0.5 ? 1 : -1))),
        system1Score: Math.min(100, Math.max(50, prev.system1Score + (Math.random() > 0.5 ? 2 : -2))),
        system2Score: Math.min(100, Math.max(50, prev.system2Score + (Math.random() > 0.5 ? 2 : -2)))
      }))
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#34a853'
    if (score >= 60) return '#fbbc04'
    return '#ea4335'
  }



  return (
    <div style={{
      width: '280px',
      backgroundColor: 'var(--bg-primary)',
      borderRight: '1px solid var(--border-color)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      height: '100%',
      overflowY: 'auto'
    }}>
      {/* 标题 */}
      <div>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: 600, 
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '18px' }}>🧠</span>
          双系统协同状态
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          System 1 / System 2 Coordination
        </p>
      </div>

      {/* 协同评分 */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: '16px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>协同评分</span>
          <span style={{ 
            fontSize: '20px', 
            fontWeight: 700,
            color: getScoreColor(state.coordinationScore)
          }}>
            {state.coordinationScore}%
          </span>
        </div>
        <div style={{
          height: '6px',
          backgroundColor: 'var(--border-color)',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${state.coordinationScore}%`,
            backgroundColor: getScoreColor(state.coordinationScore),
            borderRadius: '3px',
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* 系统性能 */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: '16px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>系统性能</div>
        
        {/* System 1 */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '4px',
            fontSize: '12px'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>系统1 (快速直觉)</span>
            <span style={{ 
              fontWeight: 600,
              color: getScoreColor(state.system1Score)
            }}>
              {state.system1Score}%
            </span>
          </div>
          <div style={{
            height: '4px',
            backgroundColor: 'var(--border-color)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${state.system1Score}%`,
              backgroundColor: getScoreColor(state.system1Score),
              borderRadius: '2px',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>

        {/* System 2 */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '4px',
            fontSize: '12px'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>系统2 (慢速深思)</span>
            <span style={{ 
              fontWeight: 600,
              color: getScoreColor(state.system2Score)
            }}>
              {state.system2Score}%
            </span>
          </div>
          <div style={{
            height: '4px',
            backgroundColor: 'var(--border-color)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${state.system2Score}%`,
              backgroundColor: getScoreColor(state.system2Score),
              borderRadius: '2px',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
      </div>

      {/* 知识蒸馏 */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: '16px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>知识蒸馏</div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '8px',
          fontSize: '12px'
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>准确率</span>
          <span style={{ 
            fontWeight: 600,
            color: getScoreColor(state.distillationAccuracy)
          }}>
            {state.distillationAccuracy}%
          </span>
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          fontSize: '12px'
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>已蒸馏</span>
          <span style={{ fontWeight: 500 }}>{state.distilledItems} 项</span>
        </div>
      </div>

      {/* 共享上下文 */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: '16px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>共享上下文</div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '8px',
          fontSize: '12px'
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>项目文件</span>
          <span style={{ fontWeight: 500 }}>{state.projectFiles} 个</span>
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          fontSize: '12px'
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>对话历史</span>
          <span style={{ fontWeight: 500 }}>{state.conversationHistory} 条</span>
        </div>
      </div>

      {/* 系统说明 */}
      <div style={{
        marginTop: 'auto',
        padding: '12px',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        fontSize: '11px',
        color: 'var(--text-tertiary)',
        lineHeight: '1.5'
      }}>
        <div style={{ fontWeight: 500, marginBottom: '4px' }}>💡 系统说明</div>
        <div>• 系统1: 快速响应，适合简单任务</div>
        <div>• 系统2: 深度思考，适合复杂推理</div>
        <div>• 知识蒸馏: 将系统2能力迁移到系统1</div>
      </div>
    </div>
  )
}

export default DualSystemSidebar
