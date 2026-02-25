/**
 * 插件系统 IPC 处理器
 * 提供渲染进程与插件系统的通信接口
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getPluginSystem } from '../../plugin-system';

export function registerPluginSystemHandlers(): void {
  // 获取插件系统实例
  const pluginSystem = getPluginSystem();

  // 获取可用模块列表
  ipcMain.handle('plugin:get-available-modules', async (): Promise<string[]> => {
    return pluginSystem.getAvailableModules();
  });

  // 获取活跃模块列表
  ipcMain.handle('plugin:get-active-modules', async (): Promise<string[]> => {
    return pluginSystem.getActiveModules();
  });

  // 检查模块是否活跃
  ipcMain.handle('plugin:is-module-active', async (_event: IpcMainInvokeEvent, moduleId: string): Promise<boolean> => {
    return pluginSystem.isModuleActive(moduleId);
  });

  // 加载模块
  ipcMain.handle('plugin:load-module', async (_event: IpcMainInvokeEvent, moduleId: string): Promise<boolean> => {
    return await pluginSystem.loadModule(moduleId);
  });

  // 卸载模块
  ipcMain.handle('plugin:unload-module', async (_event: IpcMainInvokeEvent, moduleId: string): Promise<boolean> => {
    return await pluginSystem.unloadModule(moduleId);
  });

  // 启用插件
  ipcMain.handle('plugin:enable', async (_event: IpcMainInvokeEvent, pluginId: string): Promise<boolean> => {
    return await pluginSystem.enablePlugin(pluginId);
  });

  // 禁用插件
  ipcMain.handle('plugin:disable', async (_event: IpcMainInvokeEvent, pluginId: string): Promise<boolean> => {
    return await pluginSystem.disablePlugin(pluginId);
  });

  // 执行模块函数
  ipcMain.handle(
    'plugin:execute-function', 
    async (
      _event: IpcMainInvokeEvent, 
      moduleId: string, 
      functionName: string, 
      ...args: any[]
    ): Promise<any> => {
      return await pluginSystem.executeModuleFunction(moduleId, functionName, ...args);
    }
  );

  // 安装插件
  ipcMain.handle(
    'plugin:install', 
    async (
      _event: IpcMainInvokeEvent, 
      pluginId: string, 
      source: string, 
      version?: string
    ): Promise<boolean> => {
      return await pluginSystem.installPlugin(pluginId, source, version);
    }
  );

  // 卸载插件
  ipcMain.handle(
    'plugin:uninstall', 
    async (_event: IpcMainInvokeEvent, pluginId: string): Promise<boolean> => {
      return await pluginSystem.uninstallPlugin(pluginId);
    }
  );

  console.log('Plugin system IPC handlers registered');
}