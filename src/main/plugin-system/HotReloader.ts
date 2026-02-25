/**
 * Hot Reloader
 * 实现模块热插拔机制
 */

import * as path from 'path';
import { ModuleLoader } from './ModuleLoader';
import { ModuleInstance } from './ModuleLoader';

// 临时模拟chokidar，实际使用时需要安装
const chokidar = {
  watch: (path: string, options: any) => ({
    on: (event: string, handler: any) => this,
    close: () => {}
  })
};

export interface HotReloadOptions {
  watchPath: string;
  debounceTime: number;
  ignorePatterns: string[];
}

export class HotReloader {
  private watcher: chokidar.FSWatcher | null = null;
  private moduleLoader: ModuleLoader;
  private options: HotReloadOptions;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(moduleLoader: ModuleLoader, options: HotReloadOptions) {
    this.moduleLoader = moduleLoader;
    this.options = options;
  }

  /**
   * Start hot reloading
   */
  start(): void {
    if (this.watcher) {
      return;
    }

    this.watcher = chokidar.watch(this.options.watchPath, {
      ignored: this.options.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath: string) => this.handleFileChange(filePath))
      .on('change', (filePath: string) => this.handleFileChange(filePath))
      .on('unlink', (filePath: string) => this.handleFileDelete(filePath))
      .on('error', (error: Error) => console.error('Hot reload error:', error));

    console.log('Hot reloading started');
  }

  /**
   * Stop hot reloading
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    console.log('Hot reloading stopped');
  }

  /**
   * Handle file change
   */
  private handleFileChange(filePath: string): void {
    const moduleId = this.getModuleIdFromPath(filePath);
    if (!moduleId) {
      return;
    }

    // Debounce to avoid multiple reloads
    if (this.debounceTimers.has(moduleId)) {
      clearTimeout(this.debounceTimers.get(moduleId)!);
    }

    const timer = setTimeout(async () => {
      await this.reloadModule(moduleId);
      this.debounceTimers.delete(moduleId);
    }, this.options.debounceTime);

    this.debounceTimers.set(moduleId, timer);
  }

  /**
   * Handle file delete
   */
  private handleFileDelete(filePath: string): void {
    const moduleId = this.getModuleIdFromPath(filePath);
    if (moduleId) {
      this.moduleLoader.unloadModule(moduleId);
    }
  }

  /**
   * Get module ID from file path
   */
  private getModuleIdFromPath(filePath: string): string | null {
    const relativePath = path.relative(this.options.watchPath, filePath);
    const parts = relativePath.split(path.sep);
    
    // 假设模块目录结构为 modules/<moduleId>/...
    if (parts.length > 0) {
      return parts[0];
    }

    return null;
  }

  /**
   * Reload module
   */
  private async reloadModule(moduleId: string): Promise<void> {
    try {
      console.log(`Reloading module ${moduleId}...`);
      
      // Unload existing module
      if (this.moduleLoader.isModuleLoaded(moduleId)) {
        await this.moduleLoader.unloadModule(moduleId);
      }

      // Load new module
      await this.moduleLoader.loadModule(moduleId);
      
      console.log(`Module ${moduleId} reloaded successfully`);
    } catch (error) {
      console.error(`Failed to reload module ${moduleId}:`, error);
    }
  }

  /**
   * Check if hot reloading is active
   */
  isActive(): boolean {
    return this.watcher !== null;
  }
}