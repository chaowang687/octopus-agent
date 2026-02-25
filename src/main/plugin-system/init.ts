/**
 * 插件系统初始化脚本
 * 用于在应用启动时初始化插件系统
 */

import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { getPluginSystem } from './plugin-system';

export async function initializePluginSystem(): Promise<void> {
  console.log('Starting plugin system initialization...');
  
  try {
    // 获取插件系统实例
    const pluginSystem = getPluginSystem();
    
    // 初始化插件系统
    await pluginSystem.initialize();
    
    console.log('Plugin system initialized successfully');
    console.log(`Available modules: ${pluginSystem.getAvailableModules().length}`);
    console.log(`Active modules: ${pluginSystem.getActiveModules().length}`);
    
    // 检查并安装默认插件
    await setupDefaultPlugins(pluginSystem);
    
  } catch (error) {
    console.error('Failed to initialize plugin system:', error);
    throw error;
  }
}

async function setupDefaultPlugins(pluginSystem: any): Promise<void> {
  // 检查是否需要安装默认插件
  const defaultPlugins = [
    { id: 'ide-module', source: path.join(__dirname, '..', '..', 'plugins', 'ide-module') },
    { id: 'workflow-module', source: path.join(__dirname, '..', '..', 'plugins', 'workflow-module') }
  ];
  
  for (const plugin of defaultPlugins) {
    try {
      if (!pluginSystem.getAvailableModules().includes(plugin.id)) {
        console.log(`Installing default plugin: ${plugin.id}`);
        await pluginSystem.installPlugin(plugin.id, plugin.source);
      }
    } catch (error) {
      console.error(`Failed to install default plugin ${plugin.id}:`, error);
    }
  }
}

// 导出初始化函数
export { getPluginSystem };