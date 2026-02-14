import React, { useState } from 'react'
import { chatDataService } from '../services/ChatDataService'

interface CreateAgentModalProps {
  onClose: () => void
  onCreated: () => void
}

const AVATAR_SEEDS = ['Felix', 'Aneka', 'Bob', 'Jack', 'Molly', 'Simba', 'Willow', 'Pepper', 'Oscar', 'Ginger']

const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('openai')
  const [avatarSeed, setAvatarSeed] = useState(AVATAR_SEEDS[0])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !systemPrompt) return

    chatDataService.createAgent({
      name,
      description,
      systemPrompt,
      model,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`
    })
    onCreated()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', width: '500px',
        border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)'
      }}>
        <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>创建新角色</h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Avatar Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px', color: 'var(--text-secondary)' }}>头像</label>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
              {AVATAR_SEEDS.map(seed => (
                <img 
                  key={seed} 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} 
                  alt={seed}
                  onClick={() => setAvatarSeed(seed)}
                  style={{
                    width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer',
                    border: avatarSeed === seed ? '2px solid var(--accent-color)' : '2px solid transparent'
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>名称</label>
            <input 
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="例如：Python 专家"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>描述 (短)</label>
            <input 
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="例如：精通 Python 脚本和数据分析"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>系统提示词 (设定性格与能力)</label>
            <textarea 
              value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} required
              placeholder="你是... 你的职责是..."
              rows={4}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit', resize: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>首选模型</label>
            <select 
              value={model} onChange={e => setModel(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit' }}
            >
              <option value="openai">OpenAI GPT-4</option>
              <option value="claude">Claude 3.5 Sonnet</option>
              <option value="deepseek">DeepSeek V3</option>
              <option value="minimax">MiniMax</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'inherit' }}>取消</button>
            <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'var(--accent-text)', cursor: 'pointer' }}>创建</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateAgentModal
