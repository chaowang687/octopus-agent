/**
 * 工作台内核 (Workbench Kernel)
 * 负责模块加载、状态管理和事件通信
 */

import { PluginManager } from './PluginManager';
import { ModuleDispatcher } from './ModuleDispatcher';
import { getPluginSystem } from './index';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { capabilityRegistry } from './CapabilityRegistry';

const safeCapabilityRegistry = capabilityRegistry || {
  getModuleInfo: () => undefined,
  getAllTools: () => []
};

export interface WorkbenchConfig {
  autoLoadModules?: boolean;
  maxConcurrentTasks?: number;
  moduleTimeout?: number;
}

export class WorkbenchKernel {
  private pluginManager: PluginManager | null = null;
  private moduleDispatcher: ModuleDispatcher | null = null;
  private config: WorkbenchConfig;
  private eventBus: EventBus;
  private globalState: Map<string, any> = new Map();

  constructor(config: WorkbenchConfig = {}) {
    this.config = {
      autoLoadModules: true,
      maxConcurrentTasks: 5,
      moduleTimeout: 30000,
      ...config
    };
    
    this.eventBus = new EventBus();
  }

  /**
   * 初始化工作台内核
   */
  async initialize(): Promise<void> {
    console.log('Initializing Workbench Kernel...');
    
    // 获取插件系统实例
    const pluginSystem = getPluginSystem();
    this.pluginManager = pluginSystem.getPluginManager();
    this.moduleDispatcher = pluginSystem.getModuleDispatcher();
    
    // 初始化插件系统
    await this.pluginManager.scanAndLoadPlugins();
    
    // 如果配置为自动加载模块，则加载所有可用模块
    if (this.config.autoLoadModules) {
      const availableModules = this.pluginManager.getAllPluginIds();
      for (const moduleId of availableModules) {
        try {
          await this.moduleDispatcher.loadModule(moduleId);
          console.log(`Auto-loaded module: ${moduleId}`);
        } catch (error) {
          console.error(`Failed to auto-load module ${moduleId}:`, error);
        }
      }
    }
    
    console.log('Workbench Kernel initialized successfully');
  }

  /**
   * 获取模块能力
   */
  getModuleCapabilities(moduleId: string) {
    return safeCapabilityRegistry.getModuleInfo(moduleId);
  }

  /**
   * 获取所有可用工具
   */
  getAllAvailableTools() {
    return safeCapabilityRegistry.getAllTools();
  }

  /**
   * 调用模块功能
   */
  async callModule(moduleId: string, functionName: string, ...args: any[]) {
    return await this.moduleDispatcher.executeModuleFunction({
      moduleId,
      functionName,
      args
    });
  }

  /**
   * 发布事件
   */
  publish(event: string, data: any) {
    this.eventBus.emit(event, data);
  }

  /**
   * 订阅事件
   */
  subscribe(event: string, listener: (data: any) => void) {
    this.eventBus.on(event, listener);
  }

  /**
   * 取消订阅事件
   */
  unsubscribe(event: string, listener: (data: any) => void) {
    this.eventBus.off(event, listener);
  }

  /**
   * 获取全局状态
   */
  getGlobalState<T>(key: string): T | undefined {
    return this.globalState.get(key);
  }

  /**
   * 设置全局状态
   */
  setGlobalState<T>(key: string, value: T) {
    this.globalState.set(key, value);
  }

  /**
   * 获取工作台配置
   */
  getConfig(): WorkbenchConfig {
    return { ...this.config };
  }

  /**
   * 更新工作台配置
   */
  updateConfig(newConfig: Partial<WorkbenchConfig>) {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * 简单的事件总线实现
 */
class EventBus {
  private listeners: Map<string, Array<(data: any) => void>> = new Map();

  on(event: string, listener: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: (data: any) => void) {
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event)!;
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, data: any) {
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event)!;
      for (const listener of listeners) {
        listener(data);
      }
    }
  }
}