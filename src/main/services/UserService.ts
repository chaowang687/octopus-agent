import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface User {
  id: string
  username: string
  email: string
  passwordHash: string
  role: 'admin' | 'user' | 'guest'
  createdAt: number
  lastLoginAt?: number
  permissions: {
    projects: {
      [projectId: string]: 'owner' | 'editor' | 'viewer'
    }
    canCreateProjects: boolean
    canManageUsers: boolean
  }
}

export interface AuthToken {
  token: string
  userId: string
  expiresAt: number
  createdAt: number
}

export class UserService {
  private users: Map<string, User> = new Map()
  private authTokens: Map<string, AuthToken> = new Map()
  private usersFilePath: string
  private tokensFilePath: string

  constructor(dataDir?: string) {
    const baseDir = dataDir || path.join(process.env.USERDATA || '', 'users')
    this.usersFilePath = path.join(baseDir, 'users.json')
    this.tokensFilePath = path.join(baseDir, 'tokens.json')
    this.initializeDirectories()
    this.loadUsers()
    this.loadTokens()
    this.createDefaultAdmin()
  }

  private initializeDirectories() {
    const baseDir = path.dirname(this.usersFilePath)
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
  }

  private createDefaultAdmin() {
    if (this.users.size === 0) {
      const defaultAdmin: User = {
        id: uuidv4(),
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: this.hashPassword('admin123'), // 默认密码
        role: 'admin',
        createdAt: Date.now(),
        permissions: {
          projects: {},
          canCreateProjects: true,
          canManageUsers: true
        }
      }
      this.users.set(defaultAdmin.id, defaultAdmin)
      this.saveUsers()
      console.log('Created default admin user: admin/admin123')
    }
  }

  private hashPassword(password: string): string {
    // 简单的密码哈希实现，实际项目中应该使用更安全的方法
    return Buffer.from(password).toString('base64')
  }

  private verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash
  }

  private loadUsers() {
    try {
      if (fs.existsSync(this.usersFilePath)) {
        const data = fs.readFileSync(this.usersFilePath, 'utf-8')
        const usersArray: User[] = JSON.parse(data)
        usersArray.forEach(user => {
          this.users.set(user.id, user)
        })
      }
    } catch (error) {
      console.error('加载用户失败:', error)
    }
  }

  private saveUsers() {
    try {
      const usersArray = Array.from(this.users.values())
      fs.writeFileSync(this.usersFilePath, JSON.stringify(usersArray, null, 2))
    } catch (error) {
      console.error('保存用户失败:', error)
    }
  }

  private loadTokens() {
    try {
      if (fs.existsSync(this.tokensFilePath)) {
        const data = fs.readFileSync(this.tokensFilePath, 'utf-8')
        const tokensArray: AuthToken[] = JSON.parse(data)
        tokensArray.forEach(token => {
          if (token.expiresAt > Date.now()) {
            this.authTokens.set(token.token, token)
          }
        })
      }
    } catch (error) {
      console.error('加载令牌失败:', error)
    }
  }

  private saveTokens() {
    try {
      const tokensArray = Array.from(this.authTokens.values())
        .filter(token => token.expiresAt > Date.now())
      fs.writeFileSync(this.tokensFilePath, JSON.stringify(tokensArray, null, 2))
    } catch (error) {
      console.error('保存令牌失败:', error)
    }
  }

  // 用户管理
  createUser(username: string, email: string, password: string, role: 'admin' | 'user' | 'guest' = 'user'): User {
    const existingUser = Array.from(this.users.values()).find(
      user => user.username === username || user.email === email
    )
    
    if (existingUser) {
      throw new Error('用户名或邮箱已存在')
    }

    const user: User = {
      id: uuidv4(),
      username,
      email,
      passwordHash: this.hashPassword(password),
      role,
      createdAt: Date.now(),
      permissions: {
        projects: {},
        canCreateProjects: role === 'admin' || role === 'user',
        canManageUsers: role === 'admin'
      }
    }

    this.users.set(user.id, user)
    this.saveUsers()
    return user
  }

  authenticate(username: string, password: string): AuthToken | null {
    const user = Array.from(this.users.values()).find(
      u => u.username === username
    )

    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      return null
    }

    // 更新最后登录时间
    user.lastLoginAt = Date.now()
    this.users.set(user.id, user)
    this.saveUsers()

    // 创建认证令牌
    const token: AuthToken = {
      token: uuidv4(),
      userId: user.id,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7天过期
      createdAt: Date.now()
    }

    this.authTokens.set(token.token, token)
    this.saveTokens()
    return token
  }

  verifyToken(token: string): User | null {
    const authToken = this.authTokens.get(token)
    if (!authToken || authToken.expiresAt < Date.now()) {
      if (authToken) {
        this.authTokens.delete(token)
        this.saveTokens()
      }
      return null
    }

    return this.users.get(authToken.userId) || null
  }

  logout(token: string): boolean {
    const removed = this.authTokens.delete(token)
    if (removed) {
      this.saveTokens()
    }
    return removed
  }

  // 项目权限管理
  setProjectPermission(userId: string, projectId: string, role: 'owner' | 'editor' | 'viewer'): boolean {
    const user = this.users.get(userId)
    if (!user) {
      return false
    }

    user.permissions.projects[projectId] = role
    this.users.set(userId, user)
    this.saveUsers()
    return true
  }

  checkProjectPermission(userId: string, projectId: string, requiredRole: 'owner' | 'editor' | 'viewer'): boolean {
    const user = this.users.get(userId)
    if (!user) {
      return false
    }

    // 管理员拥有所有权限
    if (user.role === 'admin') {
      return true
    }

    const userRole = user.permissions.projects[projectId]
    if (!userRole) {
      return false
    }

    // 权限层级：owner > editor > viewer
    const rolePriority = {
      owner: 3,
      editor: 2,
      viewer: 1
    }

    return rolePriority[userRole] >= rolePriority[requiredRole]
  }

  // 获取用户信息
  getUserById(userId: string): User | null {
    return this.users.get(userId) || null
  }

  getUserByUsername(username: string): User | null {
    return Array.from(this.users.values()).find(user => user.username === username) || null
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values())
  }

  // 更新用户信息
  updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt' | 'passwordHash'>>): User | null {
    const user = this.users.get(userId)
    if (!user) {
      return null
    }

    const updatedUser = {
      ...user,
      ...updates
    }

    this.users.set(userId, updatedUser)
    this.saveUsers()
    return updatedUser
  }

  // 修改密码
  changePassword(userId: string, oldPassword: string, newPassword: string): boolean {
    const user = this.users.get(userId)
    if (!user || !this.verifyPassword(oldPassword, user.passwordHash)) {
      return false
    }

    user.passwordHash = this.hashPassword(newPassword)
    this.users.set(userId, user)
    this.saveUsers()
    return true
  }

  // 删除用户
  deleteUser(userId: string): boolean {
    // 不能删除最后一个管理员
    if (this.users.get(userId)?.role === 'admin') {
      const adminCount = Array.from(this.users.values()).filter(user => user.role === 'admin').length
      if (adminCount <= 1) {
        throw new Error('不能删除最后一个管理员')
      }
    }

    const removed = this.users.delete(userId)
    if (removed) {
      this.saveUsers()
    }
    return removed
  }
}

export const userService = new UserService()
