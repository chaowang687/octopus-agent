import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'
import { app, safeStorage } from 'electron'

export interface User {
  id: string
  username: string
  email: string
  passwordHash: string
  role: 'admin' | 'user' | 'guest'
  createdAt: number
  lastLoginAt?: number
  isDefaultPassword?: boolean
  mustChangePassword?: boolean
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
  private usersFilePath: string = ''
  private tokensFilePath: string = ''
  private initialized: boolean = false
  private fallbackKey: Buffer | null = null

  constructor(dataDir?: string) {
    if (dataDir) {
      this.initializePaths(dataDir)
    } else {
      this.usersFilePath = ''
      this.tokensFilePath = ''
    }
  }
  
  // 获取或创建备用加密密钥
  private getOrCreateFallbackKey(): Buffer {
    if (this.fallbackKey) {
      return this.fallbackKey
    }
    
    const keyPath = path.join(app.getPath('userData'), '.encryption_key')
    try {
      if (fs.existsSync(keyPath)) {
        const key = fs.readFileSync(keyPath)
        if (key.length === 32) {
          this.fallbackKey = key
          return key
        }
      }
      const newKey = crypto.randomBytes(32)
      fs.writeFileSync(keyPath, newKey, { mode: 0o600 })
      this.fallbackKey = newKey
      return newKey
    } catch (error) {
      console.error('Failed to get or create fallback encryption key:', error)
      const newKey = crypto.randomBytes(32)
      this.fallbackKey = newKey
      return newKey
    }
  }

  private initializePaths(dataDir: string) {
    const baseDir = path.join(dataDir, 'users')
    this.usersFilePath = path.join(baseDir, 'users.json')
    this.tokensFilePath = path.join(baseDir, 'tokens.json')
    this.initializeDirectories()
    this.loadUsers()
    this.loadTokens()
    try {
      this.createDefaultAdmin()
    } catch (error) {
      console.error('创建默认管理员失败:', error)
    }
    this.initialized = true
  }

  public initialize(appDataPath?: string) {
    if (!this.initialized) {
      const dataDir = appDataPath || app.getPath('userData')
      this.initializePaths(dataDir)
    }
  }

  private initializeDirectories() {
    const baseDir = path.dirname(this.usersFilePath)
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 })
    } else {
      try {
        fs.chmodSync(baseDir, 0o700)
      } catch (error) {
        console.warn('无法设置用户目录权限:', error)
      }
    }
    
    // 确保现有文件权限正确
    if (fs.existsSync(this.usersFilePath)) {
      try {
        fs.chmodSync(this.usersFilePath, 0o600)
      } catch (error) {
        console.warn('无法设置用户文件权限:', error)
      }
    }
    
    if (fs.existsSync(this.tokensFilePath)) {
      try {
        fs.chmodSync(this.tokensFilePath, 0o600)
      } catch (error) {
        console.warn('无法设置令牌文件权限:', error)
      }
    }
  }

  private createDefaultAdmin() {
    if (this.users.size === 0) {
      const defaultAdmin: User = {
        id: uuidv4(),
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: this.hashPassword('admin123'),
        role: 'admin',
        createdAt: Date.now(),
        isDefaultPassword: true,
        mustChangePassword: true,
        permissions: {
          projects: {},
          canCreateProjects: true,
          canManageUsers: true
        }
      }
      this.users.set(defaultAdmin.id, defaultAdmin)
      this.saveUsers()
      console.log('[UserService] 已创建默认管理员账户，首次登录需要修改密码')
    }
  }

  private hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10)
  }

  private verifyPassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash)
  }

  private loadUsers() {
    try {
      console.log(`[UserService] 加载用户文件: ${this.usersFilePath}`)
      console.log(`[UserService] 用户文件存在: ${fs.existsSync(this.usersFilePath)}`)
      
      if (fs.existsSync(this.usersFilePath)) {
        const data = fs.readFileSync(this.usersFilePath, 'utf-8')
        console.log(`[UserService] 读取用户数据成功，长度: ${data.length}`)
        const usersArray: User[] = JSON.parse(data)
        console.log(`[UserService] 解析用户数据成功，数量: ${usersArray.length}`)
        usersArray.forEach(user => {
          this.users.set(user.id, user)
        })
        console.log(`[UserService] 加载用户完成，内存中用户数量: ${this.users.size}`)
      } else {
        console.log(`[UserService] 用户文件不存在，将创建默认管理员`)
      }
    } catch (error) {
      console.error('加载用户失败:', error)
    }
  }

  private saveUsers() {
    try {
      const usersArray = Array.from(this.users.values())
      fs.writeFileSync(this.usersFilePath, JSON.stringify(usersArray, null, 2), { mode: 0o600 })
    } catch (error) {
      console.error('保存用户失败:', error)
    }
  }

  private loadTokens() {
    try {
      console.log(`[UserService] 加载令牌文件: ${this.tokensFilePath}`)
      console.log(`[UserService] 令牌文件存在: ${fs.existsSync(this.tokensFilePath)}`)
      
      if (fs.existsSync(this.tokensFilePath)) {
        const data = fs.readFileSync(this.tokensFilePath, 'utf-8')
        console.log(`[UserService] 读取令牌数据成功，长度: ${data.length}`)
        const tokensArray: any[] = JSON.parse(data)
        console.log(`[UserService] 解析令牌数据成功，数量: ${tokensArray.length}`)
        
        tokensArray.forEach(token => {
          console.log(`[UserService] 处理令牌，过期时间: ${new Date(token.expiresAt).toLocaleString()}`)
          if (token.expiresAt > Date.now()) {
            // 使用加密后的令牌作为 key，而不是解密后的令牌
            this.authTokens.set(token.token, {
              token: token.token,  // 保存加密后的令牌
              userId: token.userId,
              expiresAt: token.expiresAt,
              createdAt: token.createdAt
            })
            console.log(`[UserService] 令牌有效，已添加到内存`)
          } else {
            console.log(`[UserService] 令牌已过期，跳过`)
          }
        })
        
        console.log(`[UserService] 加载令牌完成，内存中令牌数量: ${this.authTokens.size}`)
      } else {
        console.log(`[UserService] 令牌文件不存在，将创建空文件`)
        // 创建空的 tokens.json 文件
        this.saveTokens()
      }
    } catch (error) {
      console.error('加载令牌失败:', error)
      // 如果加载失败，创建空文件
      this.saveTokens()
    }
  }

  private saveTokens() {
    try {
      const tokensArray = Array.from(this.authTokens.entries())
        .filter(([_, token]) => token.expiresAt > Date.now())
        .map(([encryptedKey, token]) => ({
          token: encryptedKey,  // 直接使用加密后的 key，不再加密
          userId: token.userId,
          expiresAt: token.expiresAt,
          createdAt: token.createdAt
        }))
      fs.writeFileSync(this.tokensFilePath, JSON.stringify(tokensArray, null, 2), { mode: 0o600 })
      console.log(`[UserService] 保存令牌成功，数量: ${tokensArray.length}`)
    } catch (error) {
      console.error('保存令牌失败:', error)
    }
  }
  
  // 加密令牌
  private encryptToken(token: string): string {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(token)
        return 'safe:' + encrypted.toString('base64')
      }
      
      // 确保fallbackKey已初始化
      const keyBuffer = this.getOrCreateFallbackKey()
      
      // 使用AES-256-CBC备用加密
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv)
      let encrypted = cipher.update(token, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      return 'fallback:' + iv.toString('hex') + ':' + encrypted
    } catch (error) {
      console.error('Failed to encrypt token:', error)
      throw new Error('令牌加密失败')
    }
  }
  
  // 解密令牌
  private decryptToken(encryptedToken: string): string {
    try {
      // 检查加密类型
      if (encryptedToken.startsWith('safe:')) {
        // 使用safeStorage解密
        const base64Token = encryptedToken.substring(5)
        const encrypted = Buffer.from(base64Token, 'base64')
        return safeStorage.decryptString(encrypted)
      } else if (encryptedToken.startsWith('fallback:')) {
        // 确保fallbackKey已初始化
        const keyBuffer = this.getOrCreateFallbackKey()
        
        // 使用AES-256-CBC解密
        const parts = encryptedToken.substring(9).split(':')
        if (parts.length === 2) {
          const iv = Buffer.from(parts[0], 'hex')
          const encrypted = parts[1]
          const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
          let decrypted = decipher.update(encrypted, 'hex', 'utf8')
          decrypted += decipher.final('utf8')
          return decrypted
        }
      }
      
      // 兼容旧的明文格式（但记录警告）
      console.warn('警告: 发现未加密的令牌，建议重新登录')
      return encryptedToken
    } catch (error) {
      console.error('Failed to decrypt token:', error)
      throw new Error('令牌解密失败')
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
    console.log(`[UserService] 尝试认证用户: ${username}`)
    console.log(`[UserService] 当前用户数量: ${this.users.size}`)
    console.log(`[UserService] 所有用户名:`, Array.from(this.users.values()).map(u => u.username))
    
    const user = Array.from(this.users.values()).find(
      u => u.username === username
    )
    
    console.log(`[UserService] 找到用户:`, user ? user.username : '未找到')

    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      console.log(`[UserService] 认证失败:`, !user ? '用户不存在' : '密码错误')
      return null
    }

    console.log(`[UserService] 密码验证成功`)

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

    // 先将令牌加密，然后使用加密后的令牌作为key存储
    const encryptedToken = this.encryptToken(token.token)
    this.authTokens.set(encryptedToken, token)
    this.saveTokens()
    console.log(`[UserService] 创建令牌成功: ${token.token.substring(0, 8)}... (加密后: ${encryptedToken.substring(0, 8)}...)`)
    return token
  }

  verifyToken(token: string): User | null {
    console.log(`[UserService] verifyToken 被调用，token: ${token.substring(0, 8)}...`)
    console.log(`[UserService] 当前authTokens数量: ${this.authTokens.size}`)
    console.log(`[UserService] 当前authTokens keys:`, Array.from(this.authTokens.keys()).map(k => k.substring(0, 8)))
    
    // 先加密令牌，然后查找
    const encryptedToken = this.encryptToken(token)
    console.log(`[UserService] 加密后的token: ${encryptedToken.substring(0, 8)}...`)
    
    const authToken = this.authTokens.get(encryptedToken)
    console.log(`[UserService] authToken查找结果:`, authToken ? '找到' : '未找到')
    
    if (!authToken || authToken.expiresAt < Date.now()) {
      if (authToken) {
        console.log(`[UserService] 令牌已过期或无效，删除令牌`)
        this.authTokens.delete(encryptedToken)
        this.saveTokens()
      }
      return null
    }

    const user = this.users.get(authToken.userId)
    console.log(`[UserService] 用户查找结果:`, user ? user.username : '未找到')
    return user || null
  }

  logout(token: string): boolean {
    const encryptedToken = this.encryptToken(token)
    const removed = this.authTokens.delete(encryptedToken)
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
    console.log(`[UserService] getUserByUsername: ${username}, 当前用户数量: ${this.users.size}`)
    const user = Array.from(this.users.values()).find(user => user.username === username) || null
    console.log(`[UserService] 查找结果:`, user ? `找到用户 ${user.username}` : '未找到')
    return user
  }

  getUserByEmail(email: string): User | null {
    return Array.from(this.users.values()).find(user => user.email === email) || null
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values())
  }

  restoreUser(user: User): User {
    this.users.set(user.id, user)
    this.saveUsers()
    return user
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
