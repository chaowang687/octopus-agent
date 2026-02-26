/**
 * 插件处理器
 * 处理插件的安装、卸载、启用、禁用等IPC请求
 */

import { ipcMain, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { getPluginSystem } from '../../plugin-system'
import { pluginInstaller } from '../../plugin-system/PluginInstaller'

interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  author: string
  category: string
  enabled: boolean
  path?: string
}

interface InstallOptions {
  source: string
  version?: string
  type?: 'path' | 'npm' | 'url' | 'archive'
}

export function registerPluginHandlers() {
  console.log('[Plugin IPC] 注册插件处理器...')
  const pluginSystem = getPluginSystem()

  // 获取插件列表
  ipcMain.handle('plugin:list', async () => {
    try {
      const pluginManager = pluginSystem.getPluginManager()
      const pluginIds = pluginManager.getAllPluginIds()
      const activeIds = pluginManager.getActivePluginIds()
      
      const plugins: PluginInfo[] = pluginIds.map((id: string) => {
        const plugin = pluginManager.getPlugin(id)
        return {
          id,
          name: plugin?.name || id,
          version: plugin?.version || '1.0.0',
          description: plugin?.description || '',
          author: plugin?.author || 'Unknown',
          category: 'plugin',
          enabled: activeIds.includes(id)
        }
      })

      return { success: true, plugins }
    } catch (error: any) {
      console.error('[Plugin IPC] 获取插件列表失败:', error)
      return { success: false, error: error.message, plugins: [] }
    }
  })

  // 安装插件
  ipcMain.handle('plugin:install', async (_event, pluginId: string, options: InstallOptions) => {
    try {
      console.log(`[Plugin IPC] 安装插件: ${pluginId}`, options)
      
      let result
      const type = options.type || 'path'
      
      switch (type) {
        case 'npm':
          result = await pluginInstaller.installFromNpm(options.source, options.version)
          break
        case 'url':
          result = await pluginInstaller.installFromUrl(options.source)
          break
        case 'archive':
          result = await pluginInstaller.installFromArchive(options.source)
          break
        default:
          result = await pluginInstaller.installFromPath(options.source)
      }
      
      if (result.success) {
        const pluginManager = pluginSystem.getPluginManager()
        const pluginPath = path.join(pluginManager.getPluginDir(), result.pluginId || pluginId)
        await pluginManager.loadPluginFromPath(pluginPath)
        return { success: true, message: result.message, pluginId: result.pluginId }
      } else {
        return { success: false, error: result.message }
      }
    } catch (error: any) {
      console.error('[Plugin IPC] 安装插件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 卸载插件
  ipcMain.handle('plugin:uninstall', async (_event, pluginId: string) => {
    try {
      console.log(`[Plugin IPC] 卸载插件: ${pluginId}`)
      
      const pluginManager = pluginSystem.getPluginManager()
      
      if (pluginManager.getActivePluginIds().includes(pluginId)) {
        await pluginManager.destroyPlugin(pluginId)
      }
      
      const result = await pluginInstaller.uninstall(pluginId)
      
      if (result.success) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: result.message }
      }
    } catch (error: any) {
      console.error('[Plugin IPC] 卸载插件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 启用插件
  ipcMain.handle('plugin:enable', async (_event, pluginId: string) => {
    try {
      console.log(`[Plugin IPC] 启用插件: ${pluginId}`)
      const pluginManager = pluginSystem.getPluginManager()
      const success = await pluginManager.initializePlugin(pluginId)
      
      if (success) {
        return { success: true, message: `插件 ${pluginId} 启用成功` }
      } else {
        return { success: false, error: `插件 ${pluginId} 启用失败` }
      }
    } catch (error: any) {
      console.error('[Plugin IPC] 启用插件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 禁用插件
  ipcMain.handle('plugin:disable', async (_event, pluginId: string) => {
    try {
      console.log(`[Plugin IPC] 禁用插件: ${pluginId}`)
      const pluginManager = pluginSystem.getPluginManager()
      const success = await pluginManager.destroyPlugin(pluginId)
      
      if (success) {
        return { success: true, message: `插件 ${pluginId} 禁用成功` }
      } else {
        return { success: false, error: `插件 ${pluginId} 禁用失败` }
      }
    } catch (error: any) {
      console.error('[Plugin IPC] 禁用插件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取插件详情
  ipcMain.handle('plugin:get', async (_event, pluginId: string) => {
    try {
      const pluginManager = pluginSystem.getPluginManager()
      const plugin = pluginManager.getPlugin(pluginId)
      
      if (plugin) {
        const activeIds = pluginManager.getActivePluginIds()
        return {
          success: true,
          plugin: {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            description: plugin.description,
            author: plugin.author,
            category: 'plugin',
            enabled: activeIds.includes(pluginId)
          }
        }
      } else {
        return { success: false, error: '插件不存在' }
      }
    } catch (error: any) {
      console.error('[Plugin IPC] 获取插件详情失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取插件目录
  ipcMain.handle('plugin:getPluginDir', async () => {
    try {
      const pluginManager = pluginSystem.getPluginManager()
      return { success: true, path: pluginManager.getPluginDir() }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 扫描本地插件
  ipcMain.handle('plugin:scan', async () => {
    try {
      const pluginManager = pluginSystem.getPluginManager()
      await pluginManager.scanAndLoadPlugins()
      
      const pluginIds = pluginManager.getAllPluginIds()
      return { success: true, count: pluginIds.length, pluginIds }
    } catch (error: any) {
      console.error('[Plugin IPC] 扫描插件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取已安装插件列表
  ipcMain.handle('plugin:installed', async () => {
    try {
      const installed = pluginInstaller.listInstalled()
      const plugins = installed.map(id => {
        const info = pluginInstaller.getPluginInfo(id)
        return {
          id,
          name: info?.name || id,
          version: info?.version || '1.0.0',
          description: info?.description || '',
          author: info?.author || 'Unknown',
          category: info?.category || 'plugin',
          enabled: false
        }
      })
      return { success: true, plugins }
    } catch (error: any) {
      console.error('[Plugin IPC] 获取已安装插件失败:', error)
      return { success: false, error: error.message, plugins: [] }
    }
  })

  // 打包插件
  ipcMain.handle('plugin:pack', async (_event, pluginId: string, outputPath?: string) => {
    try {
      const pluginManager = pluginSystem.getPluginManager()
      const pluginPath = path.join(pluginManager.getPluginDir(), pluginId)
      const packedPath = await pluginInstaller.packPlugin(pluginPath, outputPath)
      return { success: true, path: packedPath }
    } catch (error: any) {
      console.error('[Plugin IPC] 打包插件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取工具插件列表
  ipcMain.handle('plugin:tool:list', async () => {
    try {
      const toolPluginManager = pluginSystem.getToolPluginManager()
      const tools = toolPluginManager.getAllToolDefinitions()
      return { success: true, tools }
    } catch (error: any) {
      console.error('[Plugin IPC] 获取工具列表失败:', error)
      return { success: false, error: error.message, tools: [] }
    }
  })

  // 执行工具插件
  ipcMain.handle('plugin:tool:execute', async (_event, toolName: string, params: Record<string, any>) => {
    try {
      const toolPluginManager = pluginSystem.getToolPluginManager()
      const result = await toolPluginManager.executeTool(toolName, params)
      return result
    } catch (error: any) {
      console.error('[Plugin IPC] 执行工具失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取服务插件列表
  ipcMain.handle('plugin:service:list', async () => {
    try {
      const servicePluginManager = pluginSystem.getServicePluginManager()
      const services = servicePluginManager.getAllServices()
      return { 
        success: true, 
        services: services.map(s => ({
          id: s.id,
          name: s.name,
          serviceName: s.serviceName,
          version: s.version,
          description: s.description
        }))
      }
    } catch (error: any) {
      console.error('[Plugin IPC] 获取服务列表失败:', error)
      return { success: false, error: error.message, services: [] }
    }
  })

  // 调用服务方法
  ipcMain.handle('plugin:service:call', async (_event, serviceName: string, methodName: string, ...args: any[]) => {
    try {
      const servicePluginManager = pluginSystem.getServicePluginManager()
      const result = await servicePluginManager.callServiceMethod(serviceName, methodName, ...args)
      return { success: true, result }
    } catch (error: any) {
      console.error('[Plugin IPC] 调用服务方法失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取记忆插件列表
  ipcMain.handle('plugin:memory:list', async () => {
    try {
      const memoryPluginManager = pluginSystem.getMemoryPluginManager()
      const plugins = memoryPluginManager.getAllPlugins()
      return { 
        success: true, 
        plugins: plugins.map(p => ({
          id: p.id,
          name: p.name,
          memoryType: p.memoryType,
          version: p.version,
          description: p.description
        }))
      }
    } catch (error: any) {
      console.error('[Plugin IPC] 获取记忆列表失败:', error)
      return { success: false, error: error.message, plugins: [] }
    }
  })

  // 存储记忆
  ipcMain.handle('plugin:memory:store', async (_event, key: string, value: any, type?: 'short' | 'medium' | 'long') => {
    try {
      const memoryPluginManager = pluginSystem.getMemoryPluginManager()
      await memoryPluginManager.store(key, value, type)
      return { success: true }
    } catch (error: any) {
      console.error('[Plugin IPC] 存储记忆失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 检索记忆
  ipcMain.handle('plugin:memory:query', async (_event, query: { keywords?: string[], type?: 'short' | 'medium' | 'long' | 'all', limit?: number }) => {
    try {
      const memoryPluginManager = pluginSystem.getMemoryPluginManager()
      const results = await memoryPluginManager.query(query)
      return { success: true, results }
    } catch (error: any) {
      console.error('[Plugin IPC] 检索记忆失败:', error)
      return { success: false, error: error.message, results: [] }
    }
  })

  // 清除记忆
  ipcMain.handle('plugin:memory:clear', async (_event, type?: 'short' | 'medium' | 'long') => {
    try {
      const memoryPluginManager = pluginSystem.getMemoryPluginManager()
      await memoryPluginManager.clear(type)
      return { success: true }
    } catch (error: any) {
      console.error('[Plugin IPC] 清除记忆失败:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[Plugin IPC] 插件处理器注册完成!')
}
