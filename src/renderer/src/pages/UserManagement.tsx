import React, { useState, useEffect } from 'react'

interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'user' | 'guest'
  createdAt: number
  lastLoginAt?: number
  permissions: {
    projects: { [projectId: string]: 'owner' | 'editor' | 'viewer' }
    canCreateProjects: boolean
    canManageUsers: boolean
  }
}

interface UserManagementProps {
  token: string
  currentUser: User
}

export const UserManagement: React.FC<UserManagementProps> = ({ token, currentUser }) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // 防御性检查
  if (!token) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: '#666'
      }}>
        <div>
          <p>请先登录</p>
          <button onClick={() => window.location.href = '/login'}>返回登录</button>
        </div>
      </div>
    )
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: '#666'
      }}>
        <div>
          <p>您没有权限访问此页面</p>
        </div>
      </div>
    )
  }

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user' | 'guest'
  })

  useEffect(() => {
    loadUsers()
  }, [token])

  const loadUsers = async () => {
    try {
      setLoading(true)
      console.log(`[UserManagement] loadUsers 被调用，token:`, token)
      console.log(`[UserManagement] token 类型:`, typeof token)
      console.log(`[UserManagement] token 长度:`, token?.length)
      const result = await window.electron.user.getAll(token)
      
      if (result.success) {
        setUsers(result.users)
      } else {
        setError(result.error || '加载用户列表失败')
      }
    } catch (err: any) {
      setError(err.message || '加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const result = await window.electron.user.create(
        token,
        newUser.username,
        newUser.email,
        newUser.password,
        newUser.role
      )

      if (result.success) {
        setShowCreateModal(false)
        setNewUser({ username: '', email: '', password: '', role: 'user' })
        loadUsers()
      } else {
        setError(result.error || '创建用户失败')
      }
    } catch (err: any) {
      setError(err.message || '创建用户失败')
    }
  }

  const handleUpdateUser = async (userId: string, updates: any) => {
    try {
      const result = await window.electron.user.update(token, userId, updates)

      if (result.success) {
        loadUsers()
        setEditingUser(null)
      } else {
        setError(result.error || '更新用户失败')
      }
    } catch (err: any) {
      setError(err.message || '更新用户失败')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('确定要删除此用户吗？')) {
      return
    }

    try {
      const result = await window.electron.user.delete(token, userId)

      if (result.success) {
        loadUsers()
      } else {
        setError(result.error || '删除用户失败')
      }
    } catch (err: any) {
      setError(err.message || '删除用户失败')
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: '#666'
      }}>
        加载中...
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
          用户管理
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 20px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          创建用户
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                用户名
              </th>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                邮箱
              </th>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                角色
              </th>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                创建时间
              </th>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                最后登录
              </th>
              <th style={{
                padding: '12px',
                textAlign: 'center',
                borderBottom: '1px solid #ddd',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  {user.username}
                </td>
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  {user.email}
                </td>
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    background: user.role === 'admin' ? '#e3f2fd' : user.role === 'user' ? '#f3e5f5' : '#f5f5f5',
                    color: user.role === 'admin' ? '#1976d2' : user.role === 'user' ? '#7b1fa2' : '#666'
                  }}>
                    {user.role === 'admin' ? '管理员' : user.role === 'user' ? '用户' : '访客'}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>
                  {formatDate(user.createdAt)}
                </td>
                <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : '-'}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {user.id !== currentUser.id && (
                    <>
                      <button
                        onClick={() => setEditingUser(user)}
                        style={{
                          padding: '6px 12px',
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          marginRight: '8px'
                        }}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        删除
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 'bold' }}>
              创建用户
            </h2>
            
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#555'
                }}>
                  用户名
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#555'
                }}>
                  邮箱
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#555'
                }}>
                  密码
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#555'
                }}>
                  角色
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="user">用户</option>
                  <option value="admin">管理员</option>
                  <option value="guest">访客</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  创建
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#999',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          token={token}
          onUpdate={handleUpdateUser}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  )
}

interface EditUserModalProps {
  user: User
  token: string
  onUpdate: (userId: string, updates: any) => void
  onClose: () => void
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, token, onUpdate, onClose }) => {
  const [updates, setUpdates] = useState({
    username: user.username,
    email: user.email,
    role: user.role
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate(user.id, updates)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 'bold' }}>
          编辑用户
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#555'
            }}>
              用户名
            </label>
            <input
              type="text"
              value={updates.username}
              onChange={(e) => setUpdates({ ...updates, username: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#555'
            }}>
              邮箱
            </label>
            <input
              type="email"
              value={updates.email}
              onChange={(e) => setUpdates({ ...updates, email: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#555'
            }}>
              角色
            </label>
            <select
              value={updates.role}
              onChange={(e) => setUpdates({ ...updates, role: e.target.value as any })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              <option value="user">用户</option>
              <option value="admin">管理员</option>
              <option value="guest">访客</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '10px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              保存
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                background: '#999',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
