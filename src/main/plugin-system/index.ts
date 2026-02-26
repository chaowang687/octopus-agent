/**
 * 插件系统主入口
 * 提供插件系统的统一访问接口
 */

import { app } from 'electron';
import * as path from 'path';
import { ToolPluginManager } from './ToolPluginManager';
import { ServicePluginManager } from './ServicePluginManager';
import { MemoryPluginManager } from './MemoryPluginManager';
import { ToolPluginAdapter, ServicePluginAdapter, MemoryPluginAdapter } from './adapters';

class PluginSystemClass {
  private pluginManager: any = null;
  private packageManager: any = null;
  private moduleDispatcher: any = null;
  private workbenchKernel: any = null;
  private orchestrator: any = null;
  private pluginDir: string = '';
  private initialized: boolean = false;

  private toolPluginManager: ToolPluginManager | null = null;
  private servicePluginManager: ServicePluginManager | null = null;
  private memoryPluginManager: MemoryPluginManager | null = null;

  constructor() {
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    const { PluginManager } = await import('./PluginManager');
    const { PackageManager: PkgManager } = await import('./PackageManager');
    const { ModuleDispatcher } = await import('./ModuleDispatcher');
    const { WorkbenchKernel } = await import('./WorkbenchKernel');
    const { MiniAgentOrchestrator } = await import('./MiniAgentOrchestrator');

    const { app: electronApp } = await import('electron');
    const pathModule = await import('path');
    this.pluginDir = pathModule.join(electronApp.getPath('userData'), 'plugins');
    
    this.pluginManager = new PluginManager();
    this.pluginManager.setPluginDir(this.pluginDir);
    this.packageManager = new PkgManager(this.pluginDir);
    this.moduleDispatcher = new ModuleDispatcher(this.pluginManager);
    
    this.workbenchKernel = new WorkbenchKernel();
    this.orchestrator = new MiniAgentOrchestrator(this.workbenchKernel);
    
    this.toolPluginManager = new ToolPluginManager();
    this.servicePluginManager = new ServicePluginManager();
    this.memoryPluginManager = new MemoryPluginManager();
    
    console.log('[PluginSystem] Initializing plugin system...');
    console.log('[PluginSystem] Tool Plugin Manager ready');
    console.log('[PluginSystem] Service Plugin Manager ready');
    console.log('[PluginSystem] Memory Plugin Manager ready');
    
    this.initialized = true;
  }

  getPluginManager() {
    if (!this.pluginManager) {
      throw new Error('Plugin system not initialized');
    }
    return this.pluginManager;
  }

  getPackageManager() {
    if (!this.packageManager) {
      throw new Error('Plugin system not initialized');
    }
    return this.packageManager;
  }

  getModuleDispatcher() {
    if (!this.moduleDispatcher) {
      throw new Error('Plugin system not initialized');
    }
    return this.moduleDispatcher;
  }

  getToolPluginManager(): ToolPluginManager {
    if (!this.toolPluginManager) {
      throw new Error('Plugin system not initialized');
    }
    return this.toolPluginManager;
  }

  getServicePluginManager(): ServicePluginManager {
    if (!this.servicePluginManager) {
      throw new Error('Plugin system not initialized');
    }
    return this.servicePluginManager;
  }

  getMemoryPluginManager(): MemoryPluginManager {
    if (!this.memoryPluginManager) {
      throw new Error('Plugin system not initialized');
    }
    return this.memoryPluginManager;
  }

  async installPlugin(pluginId: string, source: string, version?: string): Promise<boolean> {
    const success = await this.pluginManager.installPlugin(pluginId, source, version);
    if (success) {
      await this.pluginManager.loadPluginFromPath(path.join(this.pluginDir, pluginId));
    }
    return success;
  }

  async uninstallPlugin(pluginId: string): Promise<boolean> {
    return await this.pluginManager.uninstallPlugin(pluginId);
  }

  async enablePlugin(pluginId: string): Promise<boolean> {
    return await this.pluginManager.enablePlugin(pluginId);
  }

  async disablePlugin(pluginId: string): Promise<boolean> {
    return await this.pluginManager.disablePlugin(pluginId);
  }

  async executeModuleFunction(moduleId: string, functionName: string, ...args: any[]): Promise<any> {
    return await this.moduleDispatcher.executeModuleFunction({
      moduleId,
      functionName,
      args
    });
  }

  async loadModule(moduleId: string): Promise<boolean> {
    return await this.moduleDispatcher.loadModule(moduleId);
  }

  async unloadModule(moduleId: string): Promise<boolean> {
    return await this.moduleDispatcher.unloadModule(moduleId);
  }

  getAvailableModules(): string[] {
    return this.moduleDispatcher.getAvailableModules();
  }

  getActiveModules(): string[] {
    return this.moduleDispatcher.getActiveModules();
  }

  isModuleActive(moduleId: string): boolean {
    return this.moduleDispatcher.isModuleActive(moduleId);
  }

  getWorkbenchKernel() {
    if (!this.workbenchKernel) {
      throw new Error('Plugin system not initialized');
    }
    return this.workbenchKernel;
  }

  getOrchestrator() {
    if (!this.orchestrator) {
      throw new Error('Plugin system not initialized');
    }
    return this.orchestrator;
  }

  async executeTask(instruction: string, requiredCapabilities?: string[]): Promise<any> {
    if (!this.orchestrator) {
      throw new Error('Plugin system not initialized');
    }
    
    const task = {
      taskId: `task_${Date.now()}`,
      instruction,
      requiredCapabilities
    };
    
    return await this.orchestrator.executeTask(task);
  }

  async parseInstruction(instruction: string) {
    if (!this.orchestrator) {
      throw new Error('Plugin system not initialized');
    }
    
    return await this.orchestrator.parseInstruction(instruction);
  }
}

let pluginSystem: PluginSystemClass | null = null;

export function getPluginSystem(): PluginSystemClass {
  if (!pluginSystem) {
    pluginSystem = new PluginSystemClass();
  }
  return pluginSystem;
}

export { PluginSystemClass as PluginSystem };

export { ToolPluginManager } from './ToolPluginManager';
export { ServicePluginManager } from './ServicePluginManager';
export { MemoryPluginManager } from './MemoryPluginManager';

export { ToolPluginAdapter } from './adapters/ToolPluginAdapter';
export { ServicePluginAdapter } from './adapters/ServicePluginAdapter';
export { MemoryPluginAdapter } from './adapters/MemoryPluginAdapter';
export { PluginInstaller, pluginInstaller } from './PluginInstaller';

export default {
  getPluginSystem,
  PluginSystem: PluginSystemClass
}
