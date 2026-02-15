import React, { useState, useEffect } from 'react'
import { chatDataService, Agent } from '../services/ChatDataService'

interface CreateGroupModalProps {
  onClose: () => void
  onCreated: () => void
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('')
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([])

  useEffect(() => {
    setAvailableAgents(chatDataService.getAgents())
  }, [])

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev => 
      prev.includes(id) ? prev.filter(aid => aid !== id) : [...prev, id]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || selectedAgents.length === 0) return

    chatDataService.createSession(name, selectedAgents, 'group')
    onCreated()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }} onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div style={{
        backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', width: '500px',
        border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>创建协作小组</h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>小组名称</label>
            <input 
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="例如：产品研发全流程组"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px' }}>选择成员 (多选)</label>
            <div style={{ 
              maxHeight: '200px', overflowY: 'auto', 
              border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px',
              display: 'flex', flexDirection: 'column', gap: '4px'
            }}>
              {availableAgents.map(agent => (
                <div 
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: selectedAgents.includes(agent.id) ? 'var(--bg-tertiary)' : 'transparent'
                  }}
                >
                  <img src={agent.avatar} alt={agent.name} style={{ width: '32px', height: '32px', borderRadius: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{agent.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{agent.description}</div>
                  </div>
                  {selectedAgents.includes(agent.id) && <span style={{ color: 'var(--accent-color)' }}>✓</span>}
                </div>
              ))}
            </div>
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

export default CreateGroupModal
