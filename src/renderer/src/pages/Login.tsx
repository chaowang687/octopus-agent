import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await window.electron.auth.login(username, password)
      
      if (result.success) {
        const { token, user } = result
        localStorage.setItem('authToken', token)
        localStorage.setItem('currentUser', JSON.stringify(user))
        onLoginSuccess(token, user)
        navigate('/')
      } else {
        setError(result.error || '登录失败')
      }
    } catch (err: any) {
      setError(err.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致')
        setLoading(false)
        return
      }

      if (password.length < 6) {
        setError('密码长度至少为6位')
        setLoading(false)
        return
      }

      if (!usernameAvailable) {
        setError('用户名已被占用')
        setLoading(false)
        return
      }

      const result = await window.electron.auth.register(username, email, password)
      
      if (result.success) {
        const { user } = result
        const token = await window.electron.auth.login(username, password)
        
        if (token.success) {
          localStorage.setItem('authToken', token.token)
          localStorage.setItem('currentUser', JSON.stringify(user))
          onLoginSuccess(token.token, user)
          navigate('/')
        } else {
          setError('注册成功但自动登录失败，请手动登录')
          setIsLoginMode(true)
        }
      } else {
        setError(result.error || '注册失败')
      }
    } catch (err: any) {
      setError(err.message || '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email) {
        setError('请输入邮箱')
        setLoading(false)
        return
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('邮箱格式不正确')
        setLoading(false)
        return
      }

      const result = await window.electron.auth.forgotPassword(email)
      
      if (result.success) {
        setError('密码重置邮件已发送，请查收')
        setTimeout(() => {
          setIsForgotPasswordMode(false)
          setIsLoginMode(true)
        }, 3000)
      } else {
        setError(result.error || '发送邮件失败')
      }
    } catch (err: any) {
      setError(err.message || '发送邮件失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const checkUsernameAvailability = async (value: string) => {
    if (value.length < 3) {
      setUsernameAvailable(null)
      return
    }

    setCheckingUsername(true)
    try {
      console.log(`[Login] 检查用户名: ${value}`)
      const result = await window.electron.auth.checkUsername(value)
      console.log(`[Login] 用户名检查结果:`, result)
      if (result.success) {
        console.log(`[Login] 设置usernameAvailable为: ${result.available}`)
        setUsernameAvailable(result.available)
      }
    } catch (error) {
      console.error('检查用户名失败:', error)
    } finally {
      setCheckingUsername(false)
    }
  }

  const handleUsernameChange = (value: string) => {
    setUsername(value)
    setUsernameAvailable(null)
    
    // 只在注册模式下检查用户名可用性
    if (!isLoginMode && value.length >= 3) {
      const timer = setTimeout(() => {
        checkUsernameAvailability(value)
      }, 500)
      
      // 清理定时器
      return () => clearTimeout(timer)
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '30px',
          color: '#333',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          Octopus Agent
        </h1>
        
        {!isForgotPasswordMode && (
          <div style={{
            display: 'flex',
            marginBottom: '20px',
            borderBottom: '2px solid #eee'
          }}>
            <button
              type="button"
              onClick={() => setIsLoginMode(true)}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                background: 'transparent',
                fontSize: '14px',
                fontWeight: isLoginMode ? 'bold' : 'normal',
                color: isLoginMode ? '#667eea' : '#999',
                borderBottom: isLoginMode ? '2px solid #667eea' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setIsLoginMode(false)}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                background: 'transparent',
                fontSize: '14px',
                fontWeight: !isLoginMode ? 'bold' : 'normal',
                color: !isLoginMode ? '#667eea' : '#999',
                borderBottom: !isLoginMode ? '2px solid #667eea' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              注册
            </button>
          </div>
        )}
        
        {isForgotPasswordMode ? (
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#555',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入注册时使用的邮箱"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '#f44336' : '#ddd'}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => {
                  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    e.target.style.borderColor = '#f44336'
                  } else {
                    e.target.style.borderColor = '#ddd'
                  }
                }}
              />
              {email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                <div style={{
                  marginTop: '5px',
                  fontSize: '12px',
                  color: '#f44336'
                }}>
                  邮箱格式不正确
                </div>
              )}
            </div>

            {error && (
              <div style={{
                padding: '12px',
                marginBottom: '20px',
                backgroundColor: error.includes('已发送') ? '#efe' : '#fee',
                border: error.includes('已发送') ? '1px solid #cfc' : '1px solid #fcc',
                borderRadius: '4px',
                color: error.includes('已发送') ? '#3c3' : '#c33',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#999' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#5568d3'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#667eea'
                }
              }}
            >
              {loading ? '发送中...' : '发送重置邮件'}
            </button>

            <div style={{
              marginTop: '20px',
              textAlign: 'center'
            }}>
              <button
                type="button"
                onClick={() => setIsForgotPasswordMode(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#667eea',
                  fontSize: '14px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                返回登录
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={isLoginMode ? handleLogin : handleRegister}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#555',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="请输入用户名"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${!isLoginMode && usernameAvailable === false ? '#f44336' : !isLoginMode && usernameAvailable === true ? '#4caf50' : '#ddd'}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => {
                  if (!isLoginMode && usernameAvailable === false) {
                    e.target.style.borderColor = '#f44336'
                  } else if (!isLoginMode && usernameAvailable === true) {
                    e.target.style.borderColor = '#4caf50'
                  } else {
                    e.target.style.borderColor = '#ddd'
                  }
                }}
              />
              {checkingUsername && (
                <div style={{
                  marginTop: '5px',
                  fontSize: '12px',
                  color: '#667eea'
                }}>
                  检查用户名中...
                </div>
              )}
              {!isLoginMode && usernameAvailable === false && (
                <div style={{
                  marginTop: '5px',
                  fontSize: '12px',
                  color: '#f44336'
                }}>
                  用户名已被占用
                </div>
              )}
              {!isLoginMode && usernameAvailable === true && (
                <div style={{
                  marginTop: '5px',
                  fontSize: '12px',
                  color: '#4caf50'
                }}>
                  用户名可用
                </div>
              )}
            </div>

            {!isLoginMode && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#555',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  邮箱
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '#f44336' : '#ddd'}`,
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.3s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => {
                    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                      e.target.style.borderColor = '#f44336'
                    } else {
                      e.target.style.borderColor = '#ddd'
                    }
                  }}
                />
                {email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                  <div style={{
                    marginTop: '5px',
                    fontSize: '12px',
                    color: '#f44336'
                  }}>
                    邮箱格式不正确
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#555',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${password && password.length < 6 ? '#f44336' : '#ddd'}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => {
                  if (password && password.length < 6) {
                    e.target.style.borderColor = '#f44336'
                  } else {
                    e.target.style.borderColor = '#ddd'
                  }
                }}
              />
              {password && password.length < 6 && (
                <div style={{
                  marginTop: '5px',
                  fontSize: '12px',
                  color: '#f44336'
                }}>
                  密码长度至少为6位
                </div>
              )}
            </div>

            {!isLoginMode && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#555',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  确认密码
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${confirmPassword && password !== confirmPassword ? '#f44336' : '#ddd'}`,
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.3s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => {
                    if (confirmPassword && password !== confirmPassword) {
                      e.target.style.borderColor = '#f44336'
                    } else {
                      e.target.style.borderColor = '#ddd'
                    }
                  }}
                />
                {confirmPassword && password !== confirmPassword && (
                  <div style={{
                    marginTop: '5px',
                    fontSize: '12px',
                    color: '#f44336'
                  }}>
                    两次输入的密码不一致
                  </div>
                )}
              </div>
            )}

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

            <button
              type="submit"
              disabled={loading || (
                isLoginMode ? 
                false : 
                (!username || username.length < 3 || 
                 !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || 
                 !password || password.length < 6 || 
                 !confirmPassword || password !== confirmPassword || 
                 usernameAvailable === false)
              )}
              style={{
                width: '100%',
                padding: '12px',
                background: loading || (
                  isLoginMode ? 
                  false : 
                  (!username || username.length < 3 || 
                   !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || 
                   !password || password.length < 6 || 
                   !confirmPassword || password !== confirmPassword || 
                   usernameAvailable === false)
                ) ? '#999' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: loading || (
                  isLoginMode ? 
                  false : 
                  (!username || username.length < 3 || 
                   !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || 
                   !password || password.length < 6 || 
                   !confirmPassword || password !== confirmPassword || 
                   usernameAvailable === false)
                ) ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s'
              }}
              onMouseEnter={(e) => {
                if (!loading && (
                  isLoginMode || 
                  (username && username.length >= 3 && 
                   email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && 
                   password && password.length >= 6 && 
                   confirmPassword && password === confirmPassword && 
                   usernameAvailable !== false)
                )) {
                  e.currentTarget.style.background = '#5568d3'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && (
                  isLoginMode || 
                  (username && username.length >= 3 && 
                   email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && 
                   password && password.length >= 6 && 
                   confirmPassword && password === confirmPassword && 
                   usernameAvailable !== false)
                )) {
                  e.currentTarget.style.background = '#667eea'
                }
              }}
            >
              {loading ? (isLoginMode ? '登录中...' : '注册中...') : (isLoginMode ? '登录' : '注册')}
            </button>

            {isLoginMode && (
              <div style={{
                marginTop: '20px',
                textAlign: 'center'
              }}>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordMode(true)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#667eea',
                    fontSize: '14px',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  忘记密码？
                </button>
              </div>
            )}
          </form>
        )}

        {isLoginMode && !isForgotPasswordMode && (
          <div style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#999'
          }}>
            默认管理员账号: admin / admin123
          </div>
        )}
      </div>
    </div>
  )
}
