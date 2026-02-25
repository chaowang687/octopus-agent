/**
 * Module Publisher
 * 实现模块发布和分享功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { ModuleMarketplaceAPI } from './ModuleMarketplaceAPI';

// 临时模拟archiver，实际使用时需要安装
const archiver = {
  create: (format: string, options: any) => ({
    pipe: (output: any) => {},
    directory: (dir: string, dest: any) => {},
    finalize: () => {}
  })
};

export interface ModulePublishOptions {
  moduleId: string;
  version: string;
  manifestPath: string;
  sourcePath: string;
  readmePath: string;
  screenshotPaths: string[];
  apiKey: string;
}

export interface ModulePublishResult {
  success: boolean;
  moduleId: string;
  version: string;
  message: string;
}

export class ModulePublisher {
  private marketplaceAPI: ModuleMarketplaceAPI;

  constructor(apiKey: string) {
    this.marketplaceAPI = new ModuleMarketplaceAPI('https://marketplace.trae.ai', apiKey);
  }

  /**
   * Publish a module
   */
  async publishModule(options: ModulePublishOptions): Promise<ModulePublishResult> {
    try {
      console.log(`Publishing module ${options.moduleId} version ${options.version}...`);

      // Validate module
      await this.validateModule(options);

      // Read manifest
      const manifest = JSON.parse(fs.readFileSync(options.manifestPath, 'utf-8'));

      // Read readme
      const readme = fs.readFileSync(options.readmePath, 'utf-8');

      // Create zip file
      const zipFile = await this.createModuleZip(options.sourcePath);

      // Upload to marketplace
      const response = await this.marketplaceAPI.uploadModule({
        moduleId: options.moduleId,
        version: options.version,
        manifest,
        zipFile,
        readme,
        screenshots: options.screenshotPaths
      });

      console.log(`Module ${options.moduleId} published successfully`);

      return {
        success: true,
        moduleId: options.moduleId,
        version: options.version,
        message: 'Module published successfully'
      };
    } catch (error: any) {
      console.error(`Failed to publish module: ${error.message}`);

      return {
        success: false,
        moduleId: options.moduleId,
        version: options.version,
        message: error.message
      };
    }
  }

  /**
   * Validate module
   */
  private async validateModule(options: ModulePublishOptions): Promise<void> {
    // Check if manifest exists
    if (!fs.existsSync(options.manifestPath)) {
      throw new Error(`Manifest file not found: ${options.manifestPath}`);
    }

    // Check if source path exists
    if (!fs.existsSync(options.sourcePath)) {
      throw new Error(`Source path not found: ${options.sourcePath}`);
    }

    // Check if readme exists
    if (!fs.existsSync(options.readmePath)) {
      throw new Error(`Readme file not found: ${options.readmePath}`);
    }

    // Validate manifest format
    const manifest = JSON.parse(fs.readFileSync(options.manifestPath, 'utf-8'));
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error('Invalid manifest: missing required fields');
    }

    // Validate module structure
    if (!fs.existsSync(path.join(options.sourcePath, manifest.entryPoint))) {
      throw new Error(`Entry point not found: ${manifest.entryPoint}`);
    }
  }

  /**
   * Create module zip file
   */
  private async createModuleZip(sourcePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream('module.zip');
      const archive = archiver('zip', {
        zlib: { level: 9 } // Compression level
      });

      output.on('close', () => {
        const zipBuffer = fs.readFileSync('module.zip');
        fs.unlinkSync('module.zip'); // Clean up
        resolve(zipBuffer);
      });

      archive.on('error', (err: Error) => {
        reject(err);
      });

      archive.pipe(output);

      // Add all files from source path
      archive.directory(sourcePath, false);

      archive.finalize();
    });
  }

  /**
   * Share module
   */
  async shareModule(moduleId: string, version: string, recipients: string[]): Promise<boolean> {
    try {
      // 简化实现，实际应该发送分享邀请
      console.log(`Sharing module ${moduleId} version ${version} with ${recipients.join(', ')}`);
      return true;
    } catch (error: any) {
      console.error(`Failed to share module: ${error.message}`);
      return false;
    }
  }

  /**
   * Get module share link
   */
  getModuleShareLink(moduleId: string, version: string): string {
    return `https://marketplace.trae.ai/modules/${moduleId}/versions/${version}/share`;
  }
}