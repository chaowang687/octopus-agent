import React, { useState } from 'react'

interface MCPMarketplaceModalProps {
  isOpen: boolean
  onClose: () => void
}

interface MCPServer {
  id: string
  name: string
  description: string
  icon: string
  iconBg: string
  type: 'Local' | 'Remote'
}

const MCPMarketplaceModal: React.FC<MCPMarketplaceModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('')

  if (!isOpen) return null

  const servers: MCPServer[] = [
    {
      id: 'puppeteer',
      name: 'Puppeteer',
      description: 'Enables browser automation and web scraping with Puppeteer, allowing LLMs to interact with web pages.',
      icon: 'P',
      iconBg: '#9ca3af',
      type: 'Local'
    },
    {
      id: 'postgresql',
      name: 'PostgreSQL',
      description: 'Provides read-only access to PostgreSQL databases, enabling LLMs to inspect data schemas and execute queries.',
      icon: 'P',
      iconBg: '#4ade80',
      type: 'Local'
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Integrates with the GitHub API, enabling repository management, file operations, issue tracking, and more.',
      icon: 'G',
      iconBg: '#f87171',
      type: 'Local'
    },
    {
      id: 'chrome-devtools',
      name: 'Chrome DevTools MCP',
      description: 'Give your AI coding assistant access to the full power of Chrome DevTools to control and inspect the browser.',
      icon: 'C',
      iconBg: '#d8b4fe',
      type: 'Local' // Assuming type from screenshot context, usually local
    },
    {
      id: 'ida-pro',
      name: 'IDA Pro MCP',
      description: 'AI-powered reverse engineering assistant that bridges IDA Pro with language models for binary analysis.',
      icon: 'I',
      iconBg: '#a3e635',
      type: 'Local'
    },
    {
      id: 'imcp-feedback',
      name: 'IMCP Feedback Enhanced',
      description: 'Enhanced MCP server for interactive user feedback and command execution in AI workflows.',
      icon: 'I',
      iconBg: '#a3e635',
      type: 'Local'
    },
    {
      id: 'supabase',
      name: 'Supabase',
      description: 'Supabase gives you a dedicated Postgres database to build your web, mobile, and AI applications.',
      icon: 'S',
      iconBg: '#a3e635',
      type: 'Local'
    },
    {
      id: 'figma',
      name: 'Figma AI Bridge',
      description: 'Offers tools to view, comment on, and analyze Figma designs, ensuring precise implementation.',
      icon: 'F',
      iconBg: '#4ade80',
      type: 'Local'
    }
  ]

  const filteredServers = servers.filter(server => 
    server.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    server.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        width: '800px',
        maxHeight: '80vh',
        backgroundColor: '#1e1e1e', // Dark theme background matching screenshot
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        border: '1px solid #333'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e5e7eb' }}>MCP Marketplace</h2>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{
              position: 'absolute',
              left: '12px',
              color: '#9ca3af'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <input 
              type="text"
              placeholder="搜索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#262626',
                border: '1px solid #404040',
                borderRadius: '4px',
                padding: '8px 12px 8px 36px',
                color: '#e5e7eb',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 20px'
        }}>
          {filteredServers.map(server => (
            <div key={server.id} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px 0',
              borderBottom: '1px solid #333'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                backgroundColor: server.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#1f2937',
                flexShrink: 0
              }}>
                {server.icon}
              </div>
              
              <div style={{ flex: 1, marginLeft: '16px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#e5e7eb', margin: 0 }}>{server.name}</h3>
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '12px',
                    color: '#9ca3af',
                    border: '1px solid #404040',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    {server.type}
                  </span>
                </div>
                <p style={{
                  fontSize: '14px',
                  color: '#9ca3af',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {server.description}
                </p>
              </div>

              <button style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                backgroundColor: '#e5e7eb',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                marginLeft: '16px',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MCPMarketplaceModal