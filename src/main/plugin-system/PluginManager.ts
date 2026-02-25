/**
 * 插件管理器 - 负责插件的加载、卸载和生命周期管理
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { PluginInterface, PluginManifest, PluginConfig, PluginLoadResult } from './PluginInterface';
import { capabilityRegistry } from './CapabilityRegistry';

const safeCapabilityRegistry = capabilityRegistry || {
  registerCapability: () => {}
};

export class PluginManager {
  private plugins: Map<string, PluginInterface> = new Map();
  private pluginDir: string;
  private activePlugins: Set<string> = new Set();
  private pluginConfigs: Map<string, PluginConfig> = new Map();

  constructor(pluginDir?: string) {
    this.pluginDir = pluginDir || '';
    if (this.pluginDir) {
      this.ensurePluginDirExists();
    }
  }

  /**
   * 设置插件目录
   */
  setPluginDir(pluginDir: string): void {
    this.pluginDir = pluginDir;
    this.ensurePluginDirExists();
  }

  /**
   * 确保插件目录存在
   */
  private ensurePluginDirExists(): void {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }
  }

  /**
   * 获取插件目录
   */
  getPluginDir(): string {
    return this.pluginDir;
  }

  /**
   * 扫描并加载所有插件
   */
  async scanAndLoadPlugins(): Promise<void> {
    if (!fs.existsSync(this.pluginDir)) {
      return;
    }

    const pluginDirs = fs.readdirSync(this.pluginDir);
    
    for (const dir of pluginDirs) {
      const pluginPath = path.join(this.pluginDir, dir);
      if (fs.statSync(pluginPath).isDirectory()) {
        await this.loadPluginFromPath(pluginPath);
      }
    }
  }

  /**
   * 从路径加载插件
   */
  async loadPluginFromPath(pluginPath: string): Promise<PluginLoadResult> {
    try {
      // 检查插件清单文件
      const manifestPath = path.join(pluginPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        return { success: false, error: 'Plugin manifest.json not found' };
      }

      const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      
      // 检查入口文件
      const mainPath = path.join(pluginPath, manifest.main);
      if (!fs.existsSync(mainPath)) {
        return { success: false, error: `Plugin entry file ${mainPath} not found` };
      }

      // 使用 require 加载插件
      const require = createRequire(import.meta.url);
      const pluginModule = require(mainPath);
      
      // 获取插件类
      let pluginClass = pluginModule.default || pluginModule[manifest.id];
      if (!pluginClass) {
        // 尝试常见导出名
        pluginClass = pluginModule.Plugin || pluginModule[manifest.name.replace(/\s+/g, '')];
      }

      if (!pluginClass) {
        return { success: false, error: `No plugin class found in ${mainPath}` };
      }

      // 实例化插件
      const plugin: PluginInterface = new pluginClass();
      
      // 验证插件接口
      if (!this.validatePlugin(plugin, manifest)) {
        return { success: false, error: 'Plugin does not implement required interface' };
      }

      // 存储插件
      this.plugins.set(manifest.id, plugin);
      
      // 应用配置
      const config = this.pluginConfigs.get(manifest.id) || {};
      this.pluginConfigs.set(manifest.id, config);

      // 如果配置为自动启动，则初始化插件
      if (config.autoStart !== false) {
        await this.initializePlugin(manifest.id);
      }

      return { success: true, plugin };
    } catch (error: any) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 验证插件是否符合接口要求
   */
  private validatePlugin(plugin: PluginInterface, manifest: PluginManifest): boolean {
    return (
      typeof plugin.id === 'string' &&
      typeof plugin.name === 'string' &&
      typeof plugin.version === 'string' &&
      typeof plugin.initialize === 'function' &&
      typeof plugin.destroy === 'function'
    );
  }

  /**
   * 初始化插件
   */
  async initializePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.error(`Plugin ${pluginId} not found`);
      return false;
    }

    if (this.activePlugins.has(pluginId)) {
      console.warn(`Plugin ${pluginId} is already active`);
      return true;
    }

    try {
      await plugin.initialize();
      
      // 注册插件能力（如果有的话）
      if (typeof plugin.getCapabilities === 'function') {
        const capability = plugin.getCapabilities();
        if (capability) {
          safeCapabilityRegistry.registerCapability(pluginId, capability);
          console.log(`Registered capabilities for plugin: ${pluginId}`);
        }
      }
      
      this.activePlugins.add(pluginId);
      console.log(`Plugin ${pluginId} initialized successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to initialize plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * 销毁插件
   */
  async destroyPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.error(`Plugin ${pluginId} not found`);
      return false;
    }

    if (!this.activePlugins.has(pluginId)) {
      console.warn(`Plugin ${pluginId} is not active`);
      return true;
    }

    try {
      await plugin.destroy();
      this.activePlugins.delete(pluginId);
      console.log(`Plugin ${pluginId} destroyed successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to destroy plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * 安装插件（从远程或本地）
   */
  async installPlugin(pluginId: string, source: string, version?: string): Promise<boolean> {
    try {
      // 这里可以实现从不同源安装插件的逻辑
      // 例如：从npm包、GitHub仓库、本地文件等安装
      
      // 临时实现：假设source是本地路径
      const sourcePath = path.resolve(source);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source path does not exist: ${sourcePath}`);
      }

      // 复制插件到插件目录
      const targetPath = path.join(this.pluginDir, pluginId);
      if (fs.existsSync(targetPath)) {
        // 删除已存在的插件
        fs.rmSync(targetPath, { recursive: true, force: true });
      }

      // 复制插件文件
      this.copyRecursiveSync(sourcePath, targetPath);

      // 加载插件
      const result = await this.loadPluginFromPath(targetPath);
      return result.success;
    } catch (error) {
      console.error(`Failed to install plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    try {
      // 先销毁插件
      if (this.activePlugins.has(pluginId)) {
        await this.destroyPlugin(pluginId);
      }

      // 删除插件目录
      const pluginPath = path.join(this.pluginDir, pluginId);
      if (fs.existsSync(pluginPath)) {
        fs.rmSync(pluginPath, { recursive: true, force: true });
      }

      // 从内存中移除
      this.plugins.delete(pluginId);
      this.pluginConfigs.delete(pluginId);

      console.log(`Plugin ${pluginId} uninstalled successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * 启用插件
   */
  async enablePlugin(pluginId: string): Promise<boolean> {
    return await this.initializePlugin(pluginId);
  }

  /**
   * 禁用插件
   */
  async disablePlugin(pluginId: string): Promise<boolean> {
    return await this.destroyPlugin(pluginId);
  }

  /**
   * 获取插件信息
   */
  getPlugin(pluginId: string): PluginInterface | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 获取所有插件ID
   */
  getAllPluginIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * 获取活跃插件ID
   */
  getActivePluginIds(): string[] {
    return Array.from(this.activePlugins);
  }

  /**
   * 递归复制目录
   */
  private copyRecursiveSync(src: string, dest: string): void {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = stats && stats.isDirectory();

    if (isDirectory) {
      fs.mkdirSync(dest, { recursive: true });
      fs.readdirSync(src).forEach(childItemName => {
        this.copyRecursiveSync(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}