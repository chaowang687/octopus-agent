import React, { useState, useEffect } from 'react'

const MainContent: React.FC = () => {
  const [greeting, setGreeting] = useState('')
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('上午好')
    else if (hour < 18) setGreeting('下午好')
    else setGreeting('晚上好')
  }, [])

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%', 
      width: '100%',
      padding: '0 20px',
      backgroundColor: 'var(--bg-primary)'
    }}>
      {/* 标题 */}
      <h1 style={{ 
        fontSize: '32px', 
        fontWeight: 600, 
        marginBottom: '40px',
        color: 'var(--text-primary)',
        letterSpacing: '-0.5px'
      }}>
        {greeting}，和我一起工作吧！
      </h1>

      {/* 搜索/输入框区域 */}
      <div style={{ 
        width: '100%', 
        maxWidth: '680px', 
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        border: '1px solid var(--border-color)',
        position: 'relative'
      }}>
        <textarea 
          placeholder="我要给初中生做一个中世纪历史的PPT，得让他们真的能听进去。要解释清楚、配图到位、举的例子能让他们产生共鸣，再加几道题检验下理解程度。"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          style={{
            width: '100%',
            minHeight: '80px',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            fontSize: '15px',
            lineHeight: '1.6',
            color: 'var(--text-primary)',
            resize: 'none',
            fontFamily: 'inherit'
          }}
        />
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="icon-btn" title="附件">📎</button>
            <button className="icon-btn" title="设置">⚙️</button>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              userSelect: 'none'
            }}>
              <span>📁 projects</span>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>▼</span>
            </div>
          </div>

          <button style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-color)',
            color: 'var(--accent-text)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '16px'
          }}>
            ➜
          </button>
        </div>
      </div>

      {/* 快捷卡片 */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginTop: '32px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {[
          { icon: '⏰', label: '定时任务' },
          { icon: '📄', label: '文件整理' },
          { icon: '📡', label: '社媒发布' },
          { icon: '📺', label: 'AI PPT' },
          { icon: '', label: '更多' }
        ].map((item, idx) => (
          <div key={idx} style={{
            padding: '8px 16px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
          >
            {item.icon && <span>{item.icon}</span>}
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        .icon-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: var(--text-secondary);
          transition: background 0.2s;
        }
        .icon-btn:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  )
}

export default MainContent