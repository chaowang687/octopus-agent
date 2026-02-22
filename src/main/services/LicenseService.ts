import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import * as crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

export interface LicenseConfig {
  enabled: boolean
  validationServer: string
  gracePeriodDays: number
  offlineMode: boolean
  maxOfflineDays: number
  checkInterval: number // 毫秒
}

export interface License {
  id: string
  type: 'trial' | 'personal' | 'team' | 'enterprise'
  edition: 'basic' | 'standard' | 'professional' | 'premium'
  version: string
  productId: string
  userId?: string
  organization?: string
  seats: number
  activeSeats: number
  features: string[]
  restrictions: {
    maxUsers?: number
    maxProjects?: number
    maxStorageGB?: number
    allowedFeatures?: string[]
    forbiddenFeatures?: string[]
  }
  validity: {
    issuedAt: number
    expiresAt: number
    renewable: boolean
    gracePeriodEndsAt?: number
  }
  status: 'active' | 'expired' | 'suspended' | 'revoked' | 'pending'
  signature: string
  metadata: Record<string, any>
}

export interface LicenseValidationResult {
  valid: boolean
  license: License | null
  errors: string[]
  warnings: string[]
  lastChecked: number
  remainingDays?: number
}

export interface SeatAssignment {
  id: string
  licenseId: string
  userId: string
  userName: string
  assignedAt: number
  expiresAt: number
  status: 'active' | 'inactive' | 'expired'
  metadata: Record<string, any>
}

export class LicenseService {
  private config: LicenseConfig
  private licenseDir: string
  private currentLicense: License | null = null
  private licenseCheckTimer?: NodeJS.Timeout
  private seatAssignments: SeatAssignment[] = []
  private initialized: boolean = false

  constructor(config?: Partial<LicenseConfig>) {
    this.licenseDir = path.join(process.cwd(), 'licenses')
    this.config = {
      enabled: true,
      validationServer: '',
      gracePeriodDays: 15,
      offlineMode: true,
      maxOfflineDays: 30,
      checkInterval: 24 * 60 * 60 * 1000, // 24小时
      ...config
    }
  }

  initialize() {
    if (this.initialized) return
    
    try {
      this.initializeLicenseDirectory()
      this.loadLicense()
      this.loadSeatAssignments()
      this.startLicenseCheck()
      this.initialized = true
      console.log('[LicenseService] 服务初始化完成')
    } catch (error) {
      console.error('[LicenseService] 初始化失败:', error)
    }
  }

  private initializeLicenseDirectory(): void {
    try {
      if (!fs.existsSync(this.licenseDir)) {
        fs.mkdirSync(this.licenseDir, { recursive: true, mode: 0o755 })
        console.log('[LicenseService] 创建许可证目录:', this.licenseDir)
      } else {
        console.log('[LicenseService] 许可证目录已存在:', this.licenseDir)
      }
    } catch (error: any) {
      console.error('[LicenseService] 创建许可证目录失败:', error)
      // 使用备用目录
      this.licenseDir = path.join(process.cwd(), 'licenses')
      try {
        if (!fs.existsSync(this.licenseDir)) {
          fs.mkdirSync(this.licenseDir, { recursive: true, mode: 0o755 })
          console.log('[LicenseService] 使用备用许可证目录:', this.licenseDir)
        }
      } catch (licenseError) {
        console.error('[LicenseService] 备用目录也失败:', licenseError)
      }
    }
  }

  private loadLicense(): void {
    try {
      const licensePath = path.join(this.licenseDir, 'current-license.json')
      if (fs.existsSync(licensePath)) {
        const data = fs.readFileSync(licensePath, 'utf-8')
        this.currentLicense = JSON.parse(data)
        console.log('[LicenseService] 加载许可证:', this.currentLicense.id)
        this.validateLicense()
      }
    } catch (error) {
      console.error('[LicenseService] 加载许可证失败:', error)
    }
  }

  private loadSeatAssignments(): void {
    try {
      const seatsPath = path.join(this.licenseDir, 'seat-assignments.json')
      if (fs.existsSync(seatsPath)) {
        const data = fs.readFileSync(seatsPath, 'utf-8')
        this.seatAssignments = JSON.parse(data)
        console.log('[LicenseService] 加载座位分配:', this.seatAssignments.length, '个座位')
      }
    } catch (error) {
      console.error('[LicenseService] 加载座位分配失败:', error)
    }
  }

  private saveLicense(license: License): void {
    if (!this.initialized) return

    try {
      const licensePath = path.join(this.licenseDir, 'current-license.json')
      fs.writeFileSync(licensePath, JSON.stringify(license, null, 2))
      this.currentLicense = license
      console.log('[LicenseService] 许可证已保存:', license.id)
    } catch (error) {
      console.error('[LicenseService] 保存许可证失败:', error)
    }
  }

  private saveSeatAssignments(): void {
    if (!this.initialized) return

    try {
      const seatsPath = path.join(this.licenseDir, 'seat-assignments.json')
      fs.writeFileSync(seatsPath, JSON.stringify(this.seatAssignments, null, 2))
      console.log('[LicenseService] 座位分配已保存')
    } catch (error) {
      console.error('[LicenseService] 保存座位分配失败:', error)
    }
  }

  private startLicenseCheck(): void {
    if (this.config.checkInterval > 0) {
      this.licenseCheckTimer = setInterval(() => {
        this.validateLicense()
      }, this.config.checkInterval)
      console.log('[LicenseService] 许可证检查定时器已启动，间隔:', this.config.checkInterval / 1000 / 60, '分钟')
    }
  }

  private stopLicenseCheck(): void {
    if (this.licenseCheckTimer) {
      clearInterval(this.licenseCheckTimer)
      this.licenseCheckTimer = undefined
      console.log('[LicenseService] 许可证检查定时器已停止')
    }
  }

  async activateLicense(licenseKey: string, userId?: string, organization?: string): Promise<LicenseValidationResult> {
    if (!this.initialized) {
      this.initialize()
    }

    console.log('[LicenseService] 开始激活许可证:', licenseKey)

    const result: LicenseValidationResult = {
      valid: false,
      license: null,
      errors: [],
      warnings: [],
      lastChecked: Date.now()
    }

    try {
      const license = await this.generateTrialLicense(userId, organization)
      const validation = this.validateLicense(license)

      if (validation.valid) {
        this.saveLicense(validation.license!)
        result.valid = true
        result.license = validation.license
        result.warnings = validation.warnings
        console.log('[LicenseService] 许可证激活成功:', license.id)
      } else {
        result.errors = validation.errors
        result.warnings = validation.warnings
        console.error('[LicenseService] 许可证激活失败:', validation.errors)
      }

    } catch (error: any) {
      console.error('[LicenseService] 激活许可证时出错:', error)
      result.errors.push(`激活失败: ${error.message}`)
    }

    return result
  }

  private async generateTrialLicense(userId?: string, organization?: string): Promise<License> {
    const now = Date.now()
    const thirtyDaysLater = now + 30 * 24 * 60 * 60 * 1000

    const license: License = {
      id: `trial_${uuidv4()}`,
      type: 'trial',
      edition: 'professional',
      version: app.getVersion(),
      productId: 'localized-agent-coder',
      userId,
      organization,
      seats: 1,
      activeSeats: 1,
      features: [
        'backup',
        'sync',
        'analytics',
        'collaboration',
        'ai-models',
        'code-execution'
      ],
      restrictions: {
        maxProjects: 10,
        maxStorageGB: 5
      },
      validity: {
        issuedAt: now,
        expiresAt: thirtyDaysLater,
        renewable: false,
        gracePeriodEndsAt: thirtyDaysLater + this.config.gracePeriodDays * 24 * 60 * 60 * 1000
      },
      status: 'active',
      signature: this.signLicense('trial-key'),
      metadata: {
        generatedBy: 'local-license-service',
        trial: true,
        activationDate: new Date(now).toISOString()
      }
    }

    return license
  }

  private signLicense(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  validateLicense(license?: License): LicenseValidationResult {
    const targetLicense = license || this.currentLicense
    const result: LicenseValidationResult = {
      valid: false,
      license: targetLicense,
      errors: [],
      warnings: [],
      lastChecked: Date.now()
    }

    if (!targetLicense) {
      result.errors.push('未找到许可证')
      return result
    }

    const now = Date.now()

    if (targetLicense.status === 'revoked') {
      result.errors.push('许可证已被吊销')
    } else if (targetLicense.status === 'suspended') {
      result.errors.push('许可证已被暂停')
    } else if (targetLicense.validity.expiresAt < now) {
      result.errors.push('许可证已过期')
      targetLicense.status = 'expired'
    } else if (targetLicense.validity.expiresAt < now + 7 * 24 * 60 * 60 * 1000) {
      result.warnings.push('许可证将在7天内过期')
    }

    if (targetLicense.activeSeats > targetLicense.seats) {
      result.warnings.push('活跃座位数超过许可证允许的数量')
    }

    result.valid = result.errors.length === 0
    result.remainingDays = Math.ceil((targetLicense.validity.expiresAt - now) / (24 * 60 * 60 * 1000))

    if (this.currentLicense) {
      this.currentLicense.status = result.valid ? 'active' : 'expired'
      this.saveLicense(this.currentLicense)
    }

    console.log('[LicenseService] 许可证验证结果:', {
      valid: result.valid,
      errors: result.errors.length,
      warnings: result.warnings.length,
      remainingDays: result.remainingDays
    })

    return result
  }

  async deactivateLicense(): Promise<boolean> {
    if (!this.initialized) {
      this.initialize()
    }

    try {
      const licensePath = path.join(this.licenseDir, 'current-license.json')
      if (fs.existsSync(licensePath)) {
        fs.unlinkSync(licensePath)
      }

      this.currentLicense = null
      this.seatAssignments = []
      this.saveSeatAssignments()

      console.log('[LicenseService] 许可证已停用')
      return true
    } catch (error) {
      console.error('[LicenseService] 停用许可证失败:', error)
      return false
    }
  }

  assignSeat(userId: string, userName: string): SeatAssignment {
    if (!this.initialized) {
      this.initialize()
    }

    if (!this.currentLicense) {
      throw new Error('没有激活的许可证')
    }

    if (this.currentLicense.activeSeats >= this.currentLicense.seats) {
      throw new Error('没有可用的座位')
    }

    const assignment: SeatAssignment = {
      id: uuidv4(),
      licenseId: this.currentLicense.id,
      userId,
      userName,
      assignedAt: Date.now(),
      expiresAt: this.currentLicense.validity.expiresAt,
      status: 'active',
      metadata: {
        assignedBy: 'system',
        assignmentDate: new Date().toISOString()
      }
    }

    this.seatAssignments.push(assignment)
    this.currentLicense.activeSeats++
    this.saveLicense(this.currentLicense)
    this.saveSeatAssignments()

    console.log('[LicenseService] 座位已分配:', userId, userName)
    return assignment
  }

  revokeSeat(seatId: string): boolean {
    if (!this.initialized) {
      this.initialize()
    }

    const assignment = this.seatAssignments.find(s => s.id === seatId)
    if (!assignment) {
      return false
    }

    assignment.status = 'inactive'

    if (this.currentLicense && this.currentLicense.activeSeats > 0) {
      this.currentLicense.activeSeats--
      this.saveLicense(this.currentLicense)
    }

    this.saveSeatAssignments()
    console.log('[LicenseService] 座位已撤销:', seatId)
    return true
  }

  getSeatAssignments(): SeatAssignment[] {
    if (!this.initialized) {
      this.initialize()
    }
    return this.seatAssignments.filter(s => s.status === 'active')
  }

  getLicenseInfo(): License | null {
    if (!this.initialized) {
      this.initialize()
    }
    return this.currentLicense
  }

  checkFeatureAccess(feature: string): boolean {
    if (!this.initialized) {
      this.initialize()
    }

    if (!this.currentLicense) {
      return false
    }

    if (this.currentLicense.restrictions.forbiddenFeatures?.includes(feature)) {
      return false
    }

    if (this.currentLicense.restrictions.allowedFeatures) {
      return this.currentLicense.restrictions.allowedFeatures.includes(feature)
    }

    return this.currentLicense.features.includes(feature)
  }

  getRemainingDays(): number {
    if (!this.initialized) {
      this.initialize()
    }

    if (!this.currentLicense) {
      return 0
    }

    const now = Date.now()
    return Math.max(0, Math.ceil((this.currentLicense.validity.expiresAt - now) / (24 * 60 * 60 * 1000)))
  }

  isExpired(): boolean {
    if (!this.initialized) {
      this.initialize()
    }

    if (!this.currentLicense) {
      return true
    }

    return this.currentLicense.status === 'expired' || this.currentLicense.validity.expiresAt < Date.now()
  }

  isTrial(): boolean {
    if (!this.initialized) {
      this.initialize()
    }

    return this.currentLicense?.type === 'trial'
  }

  updateConfig(newConfig: Partial<LicenseConfig>): void {
    this.config = { ...this.config, ...newConfig }

    if (newConfig.checkInterval !== undefined) {
      this.stopLicenseCheck()
      if (this.initialized) {
        this.startLicenseCheck()
      }
    }

    console.log('[LicenseService] 配置已更新:', this.config)
  }

  getConfig(): LicenseConfig {
    return { ...this.config }
  }

  async refreshLicense(): Promise<LicenseValidationResult> {
    if (!this.initialized) {
      this.initialize()
    }

    console.log('[LicenseService] 刷新许可证...')
    return this.validateLicense()
  }

  generateLicenseReport(): any {
    if (!this.initialized) {
      this.initialize()
    }

    return {
      license: this.currentLicense,
      seatAssignments: this.seatAssignments,
      validation: this.validateLicense(),
      generatedAt: Date.now()
    }
  }

  destroy(): void {
    this.stopLicenseCheck()
    console.log('[LicenseService] 服务已销毁')
  }
}

export const licenseService = new LicenseService()
