/**
 * Module Loader
 * 实现模块的动态加载和卸载
 */

import * as fs from 'fs';
import * as path from 'path';
import { ModuleConfig } from './config';

export interface ModuleInstance {
  config: ModuleConfig;
  instance: any;
  context: any;
  loadedAt: number;
}

export class ModuleLoader {
  private modules: Map<string, ModuleInstance> = new Map();
  private modulePath: string;

  constructor(modulePath: string = './modules') {
    this.modulePath = modulePath;
    this.ensureModulePathExists();
  }

  /**
   * 确保模块目录存在
   */
  private ensureModulePathExists(): void {
    if (!fs.existsSync(this.modulePath)) {
      fs.mkdirSync(this.modulePath, { recursive: true });
    }
  }

  /**
   * 加载模块
   */
  async loadModule(moduleId: string): Promise<ModuleInstance> {
    if (this.modules.has(moduleId)) {
      return this.modules.get(moduleId)!;
    }

    const moduleDir = path.join(this.modulePath, moduleId);
    if (!fs.existsSync(moduleDir)) {
      throw new Error(`Module ${moduleId} not found`);
    }

    // 读取模块配置
    const configPath = path.join(moduleDir, 'manifest.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Manifest not found for module ${moduleId}`);
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config: ModuleConfig = JSON.parse(configContent);

    // 加载模块入口
    const entryPath = path.join(moduleDir, config.entryPoint);
    if (!fs.existsSync(entryPath)) {
      throw new Error(`Entry point not found for module ${moduleId}`);
    }

    // 使用动态导入加载模块
    const module = await import(entryPath);
    const instance = module.default || module;

    // 初始化模块
    if (typeof instance.initialize === 'function') {
      await instance.initialize();
    }

    const moduleInstance: ModuleInstance = {
      config,
      instance,
      context: {},
      loadedAt: Date.now()
    };

    this.modules.set(moduleId, moduleInstance);
    return moduleInstance;
  }

  /**
   * 卸载模块
   */
  async unloadModule(moduleId: string): Promise<void> {
    const module = this.modules.get(moduleId);
    if (!module) {
      return;
    }

    // 清理模块
    if (typeof module.instance.destroy === 'function') {
      await module.instance.destroy();
    }

    // 从缓存中移除
    this.modules.delete(moduleId);

    // 清理模块上下文
    module.context = null;
  }

  /**
   * 检查模块是否已加载
   */
  isModuleLoaded(moduleId: string): boolean {
    return this.modules.has(moduleId);
  }

  /**
   * 获取已加载的模块
   */
  getLoadedModules(): ModuleInstance[] {
    return Array.from(this.modules.values());
  }

  /**
   * 获取模块实例
   */
  getModule(moduleId: string): ModuleInstance | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * 扫描可用模块
   */
  scanAvailableModules(): string[] {
    if (!fs.existsSync(this.modulePath)) {
      return [];
    }

    return fs.readdirSync(this.modulePath)
      .filter(file => fs.statSync(path.join(this.modulePath, file)).isDirectory())
      .filter(dir => fs.existsSync(path.join(this.modulePath, dir, 'manifest.json')));
  }
}