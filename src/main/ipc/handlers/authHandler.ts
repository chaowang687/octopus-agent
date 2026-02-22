import { ipcMain } from 'electron'
import { userService } from '../../services/UserService'
import { llmService } from '../../services/LLMService'

// 检查处理器是否已注册
function isHandlerRegistered(channel: string): boolean {
  try {
    ipcMain.listenerCount(channel)
    return ipcMain.listenerCount(channel) > 0
  } catch {
    return false
  }
}

// 用户认证相关的 IPC 处理器
export function registerAuthHandlers() {
  // 用户注册
  if (!isHandlerRegistered('auth:register')) {
    ipcMain.handle('auth:register', async (_, username: string, email: string, password: string) => {
      try {
        const user = userService.createUser(username, email, password, 'user')
        return { success: true, user }
      } catch (error: any) {
        console.error('注册失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 检查用户名是否可用
  if (!isHandlerRegistered('auth:checkUsername')) {
    ipcMain.handle('auth:checkUsername', async (_, username: string) => {
      try {
        console.log(`[AuthHandler] 检查用户名: ${username}`)
        const existingUser = userService.getUserByUsername(username)
        console.log(`[AuthHandler] 用户名检查结果:`, existingUser ? '已存在' : '可用')
        return { success: true, available: !existingUser }
      } catch (error: any) {
        console.error('检查用户名失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 登录
  if (!isHandlerRegistered('auth:login')) {
    ipcMain.handle('auth:login', async (_, username: string, password: string) => {
      try {
        console.log(`[AuthHandler] 尝试登录用户: ${username}`)
        const authToken = userService.authenticate(username, password)
        console.log(`[AuthHandler] 认证结果:`, authToken ? '成功' : '失败')
        
        if (!authToken) {
          return { success: false, error: '用户名或密码错误' }
        }
        
        const user = userService.getUserById(authToken.userId)
        console.log(`[AuthHandler] 获取用户信息:`, user ? user.username : '未找到')
        
        // 设置当前用户ID到LLMService
        llmService.setUserId(authToken.userId)
        
        // 迁移旧的全局API密钥到用户目录
        llmService.migrateGlobalApiKeys(authToken.userId)
        
        return { success: true, token: authToken.token, user }
      } catch (error: any) {
        console.error('登录失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 注销
  if (!isHandlerRegistered('auth:logout')) {
    ipcMain.handle('auth:logout', async (_, token: string) => {
      try {
        const removed = userService.logout(token)
        // 清除LLMService中的用户ID
        llmService.setUserId(null)
        return { success: removed }
      } catch (error: any) {
        console.error('注销失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 验证令牌
  if (!isHandlerRegistered('auth:verify')) {
    ipcMain.handle('auth:verify', async (_, token: string) => {
      try {
        const user = userService.verifyToken(token)
        if (!user) {
          return { success: false, error: '令牌无效或已过期' }
        }
        
        // 设置当前用户ID到LLMService
        llmService.setUserId(user.id)
        
        return { success: true, user }
      } catch (error: any) {
        console.error('验证令牌失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 获取当前用户
  if (!isHandlerRegistered('auth:getCurrentUser')) {
    ipcMain.handle('auth:getCurrentUser', async (_, token: string) => {
      try {
        const user = userService.verifyToken(token)
        if (!user) {
          return { success: false, error: '未登录' }
        }
        
        return { success: true, user }
      } catch (error: any) {
        console.error('获取当前用户失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 修改密码
  if (!isHandlerRegistered('auth:changePassword')) {
    ipcMain.handle('auth:changePassword', async (_, token: string, oldPassword: string, newPassword: string) => {
      try {
        const user = userService.verifyToken(token)
        if (!user) {
          return { success: false, error: '未登录' }
        }
        
        const success = await userService.changePassword(user.id, oldPassword, newPassword)
        if (!success) {
          return { success: false, error: '旧密码错误' }
        }
        
        return { success: true }
      } catch (error: any) {
        console.error('修改密码失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 忘记密码
  if (!isHandlerRegistered('auth:forgotPassword')) {
    ipcMain.handle('auth:forgotPassword', async (_, email: string) => {
      try {
        const user = userService.getUserByEmail(email)
        if (!user) {
          return { success: false, error: '邮箱未注册' }
        }
        
        // 这里可以添加发送密码重置邮件的逻辑
        // 由于是模拟环境，我们直接返回成功
        console.log(`密码重置邮件已发送到: ${email}`)
        return { success: true }
      } catch (error: any) {
        console.error('发送密码重置邮件失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
}
