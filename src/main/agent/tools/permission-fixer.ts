import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { app, dialog } from 'electron'
import { toolRegistry } from '../ToolRegistry'

/**
 * 权限修复工具
 * 用于检测和修复系统权限问题，特别是Desktop目录权限
 */

// 检查并修复权限问题
async function checkAndFixPermissions() {
  try {
    console.log('[PermissionFixer] 开始检查和修复权限问题...')
    
    const issues = []
    const fixes = []
    
    // 检查 Desktop 目录权限
    const desktopDir = path.join(os.homedir(), 'Desktop')
    const desktopPermission = await checkPathPermission(desktopDir)
    
    if (desktopPermission !== 'full') {
      issues.push({
        path: desktopDir,
        permission: desktopPermission,
        description: 'Desktop 目录权限不足',
        severity: 'medium'
      })
      
      // 尝试修复 Desktop 目录权限
      const desktopFix = await fixDesktopPermissions()
      if (desktopFix.success) {
        fixes.push({
          path: desktopDir,
          action: '修复权限',
          result: desktopFix.message
        })
      }
    }
    
    // 检查用户数据目录权限
    const userDataDir = app.getPath('userData')
    const userDataPermission = await checkPathPermission(userDataDir)
    
    if (userDataPermission !== 'full') {
      issues.push({
        path: userDataDir,
        permission: userDataPermission,
        description: '用户数据目录权限不足',
        severity: 'high'
      })
      
      // 尝试修复用户数据目录权限
      const userDataFix = await fixDirectoryPermissions(userDataDir)
      if (userDataFix.success) {
        fixes.push({
          path: userDataDir,
          action: '修复权限',
          result: userDataFix.message
        })
      }
    }
    
    // 检查临时目录权限
    const tempDir = os.tmpdir()
    const tempPermission = await checkPathPermission(tempDir)
    
    if (tempPermission !== 'full') {
      issues.push({
        path: tempDir,
        permission: tempPermission,
        description: '临时目录权限不足',
        severity: 'medium'
      })
    }
    
    // 检查项目目录权限
    const projectDir = process.cwd()
    const projectPermission = await checkPathPermission(projectDir)
    
    if (projectPermission !== 'full') {
      issues.push({
        path: projectDir,
        permission: projectPermission,
        description: '项目目录权限不足',
        severity: 'high'
      })
      
      // 尝试修复项目目录权限
      const projectFix = await fixDirectoryPermissions(projectDir)
      if (projectFix.success) {
        fixes.push({
          path: projectDir,
          action: '修复权限',
          result: projectFix.message
        })
      }
    }
    
    console.log(`[PermissionFixer] 发现 ${issues.length} 个权限问题，修复了 ${fixes.length} 个问题`)
    
    return {
      success: true,
      issues: issues,
      fixes: fixes,
      hasIssues: issues.length > 0,
      hasFixes: fixes.length > 0
    }
  } catch (error: any) {
    console.error('[PermissionFixer] 检查和修复权限失败:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

// 检查路径权限
async function checkPathPermission(checkPath: string): Promise<string> {
  try {
    if (!fs.existsSync(checkPath)) {
      return 'not_exists'
    }
    
    // 检查读权限
    fs.accessSync(checkPath, fs.constants.R_OK)
    
    // 检查写权限
    fs.accessSync(checkPath, fs.constants.W_OK)
    
    // 检查执行权限
    fs.accessSync(checkPath, fs.constants.X_OK)
    
    return 'full'
  } catch (error: any) {
    if (error.code === 'EACCES') {
      return 'no_access'
    }
    return 'error'
  }
}

// 修复 Desktop 目录权限
async function fixDesktopPermissions(): Promise<{ success: boolean; message: string }> {
  try {
    const desktopDir = path.join(os.homedir(), 'Desktop')
    
    // 弹出用户确认弹窗
    const userConfirmed = await showPermissionFixDialog('Desktop 目录权限', [
      `检测到 Desktop 目录权限不足，这可能会影响智能体创建文件夹的能力。`,
      ``,
      `当前权限状态: ${await checkPathPermission(desktopDir)}`,
      ``,
      `建议操作: 修复 Desktop 目录权限`,
      ``,
      `修复过程将:`,
      `1. 检查当前权限设置`,
      `2. 尝试使用 chmod 命令修复权限`,
      `3. 验证修复结果`
    ])
    
    if (!userConfirmed) {
      return {
        success: false,
        message: '用户取消了权限修复操作'
      }
    }
    
    // 尝试修复权限
    const result = await runCommand(`chmod`, [`755`, desktopDir])
    
    if (result.success) {
      // 验证修复结果
      const newPermission = await checkPathPermission(desktopDir)
      if (newPermission === 'full') {
        return {
          success: true,
          message: `成功修复 Desktop 目录权限，当前权限: ${newPermission}`
        }
      } else {
        return {
          success: false,
          message: `修复后权限仍不足: ${newPermission}`
        }
      }
    } else {
      return {
        success: false,
        message: `修复权限失败: ${result.error}`
      }
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message
    }
  }
}

// 修复目录权限
async function fixDirectoryPermissions(dirPath: string): Promise<{ success: boolean; message: string }> {
  try {
    // 弹出用户确认弹窗
    const userConfirmed = await showPermissionFixDialog('目录权限修复', [
      `检测到目录权限不足，这可能会影响智能体的正常运行。`,
      ``,
      `目录路径: ${dirPath}`,
      `当前权限状态: ${await checkPathPermission(dirPath)}`,
      ``,
      `建议操作: 修复目录权限`,
      ``,
      `修复过程将:`,
      `1. 检查当前权限设置`,
      `2. 尝试使用 chmod 命令修复权限`,
      `3. 验证修复结果`
    ])
    
    if (!userConfirmed) {
      return {
        success: false,
        message: '用户取消了权限修复操作'
      }
    }
    
    // 尝试修复权限
    const result = await runCommand(`chmod`, [`-R`, `755`, dirPath])
    
    if (result.success) {
      // 验证修复结果
      const newPermission = await checkPathPermission(dirPath)
      if (newPermission === 'full') {
        return {
          success: true,
          message: `成功修复目录权限，当前权限: ${newPermission}`
        }
      } else {
        return {
          success: false,
          message: `修复后权限仍不足: ${newPermission}`
        }
      }
    } else {
      return {
        success: false,
        message: `修复权限失败: ${result.error}`
      }
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message
    }
  }
}

// 显示权限修复确认弹窗
async function showPermissionFixDialog(title: string, messageLines: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const { dialog } = require('electron')
    const mainWindow = require('../../index').getMainWindow()
    
    const options = {
      type: 'warning' as const,
      title: `权限修复 - ${title}`,
      message: title,
      detail: messageLines.join('\n'),
      buttons: ['修复权限', '取消'],
      defaultId: 0,
      cancelId: 1,
      icon: path.join(__dirname, '../../../build/icon.png')
    }
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, options).then((response) => {
        resolve(response.response === 0)
      })
    } else {
      // 如果没有主窗口，使用无父窗口的弹窗
      dialog.showMessageBox(options).then((response) => {
        resolve(response.response === 0)
      })
    }
  })
}

// 运行命令
async function runCommand(command: string, args: string[]): Promise<{ success: boolean; output?: string; error?: string }> {
  return new Promise((resolve) => {
    const { exec } = require('child_process')
    const fullCommand = `${command} ${args.map(arg => `"${arg}"`).join(' ')}`
    
    console.log(`[PermissionFixer] 执行命令: ${fullCommand}`)
    
    exec(fullCommand, (error: any, stdout: string, stderr: string) => {
      if (error) {
        console.error(`[PermissionFixer] 命令执行失败: ${error.message}`)
        resolve({ success: false, error: error.message })
      } else {
        console.log(`[PermissionFixer] 命令执行成功: ${stdout.trim()}`)
        resolve({ success: true, output: stdout.trim() })
      }
    })
  })
}

// 注册权限检查和修复工具
toolRegistry.register({
  name: 'check_and_fix_permissions',
  description: '检查并修复系统权限问题，特别是Desktop目录权限',
  parameters: [],
  handler: async () => {
    try {
      const result = await checkAndFixPermissions()
      return {
        success: true,
        issues: result.issues,
        fixes: result.fixes,
        hasIssues: result.hasIssues,
        hasFixes: result.hasFixes,
        summary: `发现 ${result.issues.length} 个权限问题，修复了 ${result.fixes.length} 个问题`
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 注册修复Desktop权限工具
toolRegistry.register({
  name: 'fix_desktop_permissions',
  description: '修复Desktop目录权限问题',
  parameters: [],
  handler: async () => {
    try {
      const result = await fixDesktopPermissions()
      return result
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 注册检查权限状态工具
toolRegistry.register({
  name: 'check_permission_status',
  description: '检查系统关键目录的权限状态',
  parameters: [],
  handler: async () => {
    try {
      const desktopDir = path.join(os.homedir(), 'Desktop')
      const userDataDir = app.getPath('userData')
      const tempDir = os.tmpdir()
      const projectDir = process.cwd()
      
      return {
        success: true,
        permissions: {
          desktop: {
            path: desktopDir,
            status: await checkPathPermission(desktopDir)
          },
          userData: {
            path: userDataDir,
            status: await checkPathPermission(userDataDir)
          },
          temp: {
            path: tempDir,
            status: await checkPathPermission(tempDir)
          },
          project: {
            path: projectDir,
            status: await checkPathPermission(projectDir)
          }
        },
        recommendations: [
          '确保所有关键目录都有读写权限',
          '如果遇到权限问题，使用 fix_desktop_permissions 工具修复',
          '定期检查权限状态以确保系统正常运行'
        ]
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})
