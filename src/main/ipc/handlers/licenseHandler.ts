import { ipcMain } from 'electron'
import { licenseService, LicenseConfig } from '../../services/LicenseService'

export function registerLicenseHandlers() {
  console.log('[LicenseHandler] 注册许可证处理器...')

  ipcMain.handle('license:activate', async (_event, licenseKey: string, userId?: string, organization?: string) => {
    try {
      const result = await licenseService.activateLicense(licenseKey, userId, organization)
      return { success: result.valid, result }
    } catch (error: any) {
      console.error('激活许可证失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:validate', async () => {
    try {
      const result = await licenseService.validateLicense()
      return { success: result.valid, result }
    } catch (error: any) {
      console.error('验证许可证失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:get-current', async () => {
    try {
      const license = licenseService.getLicenseInfo()
      return { success: true, license }
    } catch (error: any) {
      console.error('获取当前许可证失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:get-info', async () => {
    try {
      const info = licenseService.getLicenseInfo()
      return { success: true, info }
    } catch (error: any) {
      console.error('获取许可证信息失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:has-feature', async (_event, feature: string) => {
    try {
      const hasFeature = licenseService.checkFeatureAccess(feature)
      return { success: true, hasFeature }
    } catch (error: any) {
      console.error('检查功能权限失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:can-create-project', async (_event, currentProjects: number) => {
    try {
      const info = licenseService.getLicenseInfo()
      const maxProjects = info?.restrictions?.maxProjects
      const canCreate = typeof maxProjects === 'number' ? currentProjects < maxProjects : true
      return { success: true, canCreate }
    } catch (error: any) {
      console.error('检查项目创建权限失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:can-add-user', async (_event, currentUsers: number) => {
    try {
      const info = licenseService.getLicenseInfo()
      const maxUsers = info?.restrictions?.maxUsers
      const canAdd = typeof maxUsers === 'number' ? currentUsers < maxUsers : true
      return { success: true, canAdd }
    } catch (error: any) {
      console.error('检查用户添加权限失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:assign-seat', async (_event, userId: string, username: string, email: string) => {
    try {
      const assignment = licenseService.assignSeat(userId, username || email || userId)
      return { success: !!assignment, assignment }
    } catch (error: any) {
      console.error('分配席位失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:release-seat', async (_event, seatId: string) => {
    try {
      const released = licenseService.revokeSeat(seatId)
      return { success: released }
    } catch (error: any) {
      console.error('释放席位失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:get-seat-assignments', async (_event, _licenseId?: string) => {
    try {
      const assignments = licenseService.getSeatAssignments()
      return { success: true, assignments }
    } catch (error: any) {
      console.error('获取席位分配失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:deactivate', async () => {
    try {
      licenseService.deactivateLicense()
      return { success: true }
    } catch (error: any) {
      console.error('停用许可证失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:get-config', async () => {
    try {
      const config = licenseService.getConfig()
      return { success: true, config }
    } catch (error: any) {
      console.error('获取许可证配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:update-config', async (_event, newConfig: Partial<LicenseConfig>) => {
    try {
      licenseService.updateConfig(newConfig)
      const config = licenseService.getConfig()
      return { success: true, config }
    } catch (error: any) {
      console.error('更新许可证配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('license:check-features', async (_event, features: string[]) => {
    try {
      const results = features.map(feature => ({
        feature,
        allowed: licenseService.checkFeatureAccess(feature)
      }))
      return { success: true, results }
    } catch (error: any) {
      console.error('检查功能权限失败:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[LicenseHandler] 许可证处理器注册完成')
}
