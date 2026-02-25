/**
 * 模块调度器 - 负责调度和管理插件模块
 */

import { PluginManager } from './PluginManager';
import { PluginInterface } from './PluginInterface';

export interface ModuleCallRequest {
  moduleId: string;
  functionName: string;
  args: any[];
}

export interface ModuleCallResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class ModuleDispatcher {
  private pluginManager: PluginManager;
  private activeModules: Map<string, PluginInterface> = new Map();

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager;
  }

  /**
   * 加载模块
   */
  async loadModule(moduleId: string): Promise<boolean> {
    try {
      // 检查模块是否已在内存中
      if (this.activeModules.has(moduleId)) {
        return true;
      }

      // 检查插件管理器中是否有该模块
      const plugin = this.pluginManager.getPlugin(moduleId);
      if (!plugin) {
        // 尝试从磁盘加载插件
        const result = await this.pluginManager.scanAndLoadPlugins();
        const reloadedPlugin = this.pluginManager.getPlugin(moduleId);
        if (!reloadedPlugin) {
          throw new Error(`Module ${moduleId} not found`);
        }
      }

      // 初始化模块
      const success = await this.pluginManager.enablePlugin(moduleId);
      if (success) {
        const plugin = this.pluginManager.getPlugin(moduleId)!;
        this.activeModules.set(moduleId, plugin);
      }

      return success;
    } catch (error) {
      console.error(`Failed to load module ${moduleId}:`, error);
      return false;
    }
  }

  /**
   * 卸载模块
   */
  async unloadModule(moduleId: string): Promise<boolean> {
    try {
      // 检查模块是否正在使用
      const plugin = this.activeModules.get(moduleId);
      if (!plugin) {
        return true; // 模块未加载，视为成功
      }

      // 销毁模块
      const success = await this.pluginManager.disablePlugin(moduleId);
      if (success) {
        this.activeModules.delete(moduleId);
      }

      return success;
    } catch (error) {
      console.error(`Failed to unload module ${moduleId}:`, error);
      return false;
    }
  }

  /**
   * 执行模块函数
   */
  async executeModuleFunction(request: ModuleCallRequest): Promise<ModuleCallResult> {
    try {
      // 确保模块已加载
      const isLoaded = await this.loadModule(request.moduleId);
      if (!isLoaded) {
        return {
          success: false,
          error: `Failed to load module ${request.moduleId}`
        };
      }

      const module = this.activeModules.get(request.moduleId);
      if (!module) {
        return {
          success: false,
          error: `Module ${request.moduleId} is not available`
        };
      }

      // 查找函数
      const func = (module as any)[request.functionName];
      if (typeof func !== 'function') {
        return {
          success: false,
          error: `Function ${request.functionName} not found in module ${request.moduleId}`
        };
      }

      // 执行函数
      const result = await func.apply(module, request.args);
      
      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取模块列表
   */
  getAvailableModules(): string[] {
    return this.pluginManager.getAllPluginIds();
  }

  /**
   * 获取活跃模块列表
   */
  getActiveModules(): string[] {
    return Array.from(this.activeModules.keys());
  }

  /**
   * 检查模块是否活跃
   */
  isModuleActive(moduleId: string): boolean {
    return this.activeModules.has(moduleId);
  }
}