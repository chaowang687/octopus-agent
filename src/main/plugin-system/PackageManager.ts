/**
 * 插件包管理器 - 负责插件的下载、更新和依赖管理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as zlib from 'zlib';
import * as tar from 'tar';
import * as stream from 'stream';
import { promisify } from 'util';
import { PluginManifest } from './PluginInterface';

const pipeline = promisify(stream.pipeline);

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloadCount?: number;
  lastUpdated?: string;
  dependencies?: Record<string, string>;
}

export class PackageManager {
  private registryUrl: string;
  private localCache: string = '';
  private pluginDir: string;

  constructor(pluginDir: string, registryUrl: string = 'https://registry.trae.ai') {
    this.registryUrl = registryUrl;
    this.pluginDir = pluginDir;
  }

  /**
   * 初始化包管理器
   */
  async initialize(): Promise<void> {
    const { app } = await import('electron');
    this.localCache = path.join(app.getPath('userData'), 'plugin-cache');
    this.ensureCacheDirExists();
  }

  /**
   * 确保缓存目录存在
   */
  private ensureCacheDirExists(): void {
    if (!fs.existsSync(this.localCache)) {
      fs.mkdirSync(this.localCache, { recursive: true });
    }
  }

  /**
   * 搜索插件
   */
  async search(query: string): Promise<PluginInfo[]> {
    try {
      // 模拟搜索API调用
      // 在实际实现中，这里会调用远程API
      const url = `${this.registryUrl}/search?q=${encodeURIComponent(query)}`;
      
      // 模拟返回结果
      return [
        {
          id: 'example-plugin',
          name: 'Example Plugin',
          version: '1.0.0',
          description: 'An example plugin',
          author: 'Developer',
          downloadCount: 1234,
          lastUpdated: '2024-01-01'
        }
      ];
    } catch (error) {
      console.error('Failed to search plugins:', error);
      return [];
    }
  }

  /**
   * 安装插件
   */
  async install(pluginId: string, version?: string): Promise<boolean> {
    try {
      console.log(`Installing plugin: ${pluginId}${version ? `@${version}` : ''}`);

      // 获取插件信息
      const pluginInfo = await this.getPluginInfo(pluginId, version);
      if (!pluginInfo) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      // 下载插件包
      const downloadUrl = await this.getDownloadUrl(pluginId, pluginInfo.version);
      const tarballPath = await this.downloadTarball(downloadUrl, pluginId, pluginInfo.version);

      // 解压插件
      const pluginPath = path.join(this.pluginDir, pluginId);
      await this.extractTarball(tarballPath, pluginPath);

      // 验证插件完整性
      if (!(await this.verifyPlugin(pluginPath))) {
        throw new Error(`Plugin verification failed for ${pluginId}`);
      }

      console.log(`Successfully installed plugin: ${pluginId}`);
      return true;
    } catch (error) {
      console.error(`Failed to install plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * 更新插件
   */
  async update(pluginId: string): Promise<boolean> {
    // 卸载当前版本
    const currentVersion = await this.getCurrentVersion(pluginId);
    if (!currentVersion) {
      console.error(`Plugin ${pluginId} is not installed`);
      return false;
    }

    // 安装最新版本
    return await this.install(pluginId);
  }

  /**
   * 获取已安装插件列表
   */
  async listInstalled(): Promise<PluginInfo[]> {
    const plugins: PluginInfo[] = [];
    
    if (!fs.existsSync(this.pluginDir)) {
      return plugins;
    }

    const pluginDirs = fs.readdirSync(this.pluginDir);
    
    for (const dir of pluginDirs) {
      const manifestPath = path.join(this.pluginDir, dir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          plugins.push({
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            author: manifest.author
          });
        } catch (error) {
          console.error(`Failed to read manifest for plugin ${dir}:`, error);
        }
      }
    }

    return plugins;
  }

  /**
   * 获取插件信息
   */
  private async getPluginInfo(pluginId: string, version?: string): Promise<PluginInfo | null> {
    try {
      // 在实际实现中，这会调用npm registry API或其他插件仓库API
      // 暂时返回模拟数据
      return {
        id: pluginId,
        name: pluginId,
        version: version || '1.0.0',
        description: `Plugin ${pluginId}`,
        author: 'Unknown',
        downloadCount: 0
      };
    } catch (error) {
      console.error(`Failed to get plugin info for ${pluginId}:`, error);
      return null;
    }
  }

  /**
   * 获取下载URL
   */
  private async getDownloadUrl(pluginId: string, version: string): Promise<string> {
    // 在实际实现中，这会查询真实的插件仓库获取下载链接
    // 暂时返回模拟URL
    return `https://registry.npmjs.org/${pluginId}/-/${pluginId}-${version}.tgz`;
  }

  /**
   * 下载tarball
   */
  private async downloadTarball(url: string, pluginId: string, version: string): Promise<string> {
    const filename = `${pluginId}-${version}.tgz`;
    const filepath = path.join(this.localCache, filename);

    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(filepath);
      
      const request = https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status code: ${response.statusCode}`));
          return;
        }

        // 如果响应是gzip压缩的，先解压
        let responseStream: NodeJS.ReadableStream = response;
        if (response.headers['content-encoding'] === 'gzip') {
          responseStream = response.pipe(zlib.createGunzip());
        }

        responseStream.pipe(fileStream);

        fileStream.on('finish', () => {
          resolve(filepath);
        });

        fileStream.on('error', (error) => {
          reject(error);
        });
      });

      request.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 解压tarball
   */
  private async extractTarball(tarballPath: string, extractPath: string): Promise<void> {
    // 确保提取目录存在
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    // 解压tarball
    await pipeline(
      fs.createReadStream(tarballPath),
      tar.extract({
        gzip: true,
        file: undefined, // 从流读取
        cwd: extractPath,
        strip: 1 // 移除顶层目录
      })
    );
  }

  /**
   * 验证插件
   */
  private async verifyPlugin(pluginPath: string): Promise<boolean> {
    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        console.error('Plugin manifest.json not found');
        return false;
      }

      const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      
      // 验证必需字段
      const requiredFields = ['id', 'name', 'version', 'main'];
      for (const field of requiredFields) {
        if (!manifest[field as keyof PluginManifest]) {
          console.error(`Plugin manifest missing required field: ${field}`);
          return false;
        }
      }

      // 验证入口文件是否存在
      const mainPath = path.join(pluginPath, manifest.main);
      if (!fs.existsSync(mainPath)) {
        console.error(`Plugin entry file does not exist: ${mainPath}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Plugin verification failed:', error);
      return false;
    }
  }

  /**
   * 获取当前安装的版本
   */
  private async getCurrentVersion(pluginId: string): Promise<string | null> {
    const manifestPath = path.join(this.pluginDir, pluginId, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    try {
      const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      return manifest.version;
    } catch (error) {
      return null;
    }
  }
}