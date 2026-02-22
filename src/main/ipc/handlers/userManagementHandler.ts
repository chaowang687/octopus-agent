import { ipcMain } from 'electron'
import { userService } from '../../services/UserService'

// 检查处理器是否已注册
function isHandlerRegistered(channel: string): boolean {
  try {
    ipcMain.listenerCount(channel)
    return ipcMain.listenerCount(channel) > 0
  } catch {
    return false
  }
}

// 用户管理相关的 IPC 处理器
export function registerUserManagementHandlers() {
  // 获取所有用户（管理员）
  if (!isHandlerRegistered('user:getAll')) {
    ipcMain.handle('user:getAll', async (_, token: string) => {
      try {
        console.log(`[UserManagement] 尝试获取所有用户，token: ${token.substring(0, 8)}...`)
        const currentUser = userService.verifyToken(token)
        console.log(`[UserManagement] 当前用户:`, currentUser ? currentUser.username : '未找到')
        console.log(`[UserManagement] 用户角色:`, currentUser ? currentUser.role : 'N/A')
        console.log(`[UserManagement] 用户权限:`, currentUser ? currentUser.permissions : 'N/A')
        
        if (!currentUser || currentUser.role !== 'admin') {
          console.log(`[UserManagement] 权限检查失败:`, !currentUser ? '角色不是admin' : '用户不存在')
          return { success: false, error: '权限不足' }
        }
        
        const users = userService.getAllUsers()
        console.log(`[UserManagement] 成功获取用户列表，数量: ${users.length}`)
        return { success: true, users }
      } catch (error: any) {
        console.error('获取用户列表失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 创建用户（管理员）
  if (!isHandlerRegistered('user:create')) {
    ipcMain.handle('user:create', async (_, token: string, username: string, email: string, password: string, role: 'admin' | 'user' | 'guest') => {
      try {
        const currentUser = userService.verifyToken(token)
        if (!currentUser || !currentUser.permissions.canManageUsers) {
          return { success: false, error: '权限不足' }
        }
        
        const user = userService.createUser(username, email, password, role)
        return { success: true, user }
      } catch (error: any) {
        console.error('创建用户失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 更新用户（管理员）
  if (!isHandlerRegistered('user:update')) {
    ipcMain.handle('user:update', async (_, token: string, userId: string, updates: any) => {
      try {
        const currentUser = userService.verifyToken(token)
        if (!currentUser || !currentUser.permissions.canManageUsers) {
          return { success: false, error: '权限不足' }
        }
        
        const user = userService.updateUser(userId, updates)
        if (!user) {
          return { success: false, error: '用户不存在' }
        }
        
        return { success: true, user }
      } catch (error: any) {
        console.error('更新用户失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 删除用户（管理员）
  if (!isHandlerRegistered('user:delete')) {
    ipcMain.handle('user:delete', async (_, token: string, userId: string) => {
      try {
        const currentUser = userService.verifyToken(token)
        if (!currentUser || !currentUser.permissions.canManageUsers) {
          return { success: false, error: '权限不足' }
        }
        
        const success = userService.deleteUser(userId)
        if (!success) {
          return { success: false, error: '删除失败' }
        }
        
        return { success: true }
      } catch (error: any) {
        console.error('删除用户失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 设置项目权限
  if (!isHandlerRegistered('user:setProjectPermission')) {
    ipcMain.handle('user:setProjectPermission', async (_, token: string, userId: string, projectId: string, role: 'owner' | 'editor' | 'viewer') => {
      try {
        const currentUser = userService.verifyToken(token)
        if (!currentUser) {
          return { success: false, error: '未登录' }
        }
        
        const success = userService.setProjectPermission(userId, projectId, role)
        if (!success) {
          return { success: false, error: '设置权限失败' }
        }
        
        return { success: true }
      } catch (error: any) {
        console.error('设置项目权限失败:', error)
        return { success: false, error: error.message }
      }
    })
  }

  // 检查项目权限
  if (!isHandlerRegistered('user:checkProjectPermission')) {
    ipcMain.handle('user:checkProjectPermission', async (_, token: string, projectId: string, requiredRole: 'owner' | 'editor' | 'viewer') => {
      try {
        const currentUser = userService.verifyToken(token)
        if (!currentUser) {
          return { success: false, error: '未登录' }
        }
        
        const hasPermission = userService.checkProjectPermission(currentUser.id, projectId, requiredRole)
        return { success: true, hasPermission }
      } catch (error: any) {
        console.error('检查项目权限失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
}
