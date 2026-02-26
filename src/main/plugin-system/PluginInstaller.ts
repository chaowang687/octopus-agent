/**
 * 插件安装器
 * 负责插件的安装、卸载、打包等操作
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { PluginManifest, PluginInterface } from './PluginInterface'

export interface PluginPackage {
  manifest: PluginManifest
  files: Map<string, string>
}

export interface InstallResult {
  success: boolean
  message: string
  pluginId?: string
  error?: string
}

export interface UninstallResult {
  success: boolean
  message: string
  error?: string
}

export class PluginInstaller {
  private pluginDir: string

  constructor(pluginDir?: string) {
    this.pluginDir = pluginDir || path.join(app.getPath('userData'), 'plugins')
    this.ensurePluginDir()
  }

  private ensurePluginDir(): void {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true })
    }
  }

  async installFromPath(sourcePath: string): Promise<InstallResult> {
    try {
      const manifestPath = path.join(sourcePath, 'manifest.json')
      if (!fs.existsSync(manifestPath)) {
        return { success: false, message: 'manifest.json not found', error: 'PLUGIN_MANIFEST_NOT_FOUND' }
      }

      const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      
      if (!manifest.id || !manifest.name || !manifest.version || !manifest.main) {
        return { success: false, message: 'Invalid manifest.json', error: 'INVALID_MANIFEST' }
      }

      const targetPath = path.join(this.pluginDir, manifest.id)
      
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true })
      }

      this.copyDirectory(sourcePath, targetPath)

      console.log(`[PluginInstaller] Plugin ${manifest.id} installed successfully`)
      return { success: true, message: `Plugin ${manifest.id} installed`, pluginId: manifest.id }
    } catch (error: any) {
      console.error('[PluginInstaller] Install failed:', error)
      return { success: false, message: error.message, error: 'INSTALL_FAILED' }
    }
  }

  async installFromNpm(packageName: string, version?: string): Promise<InstallResult> {
    try {
      const targetPath = path.join(this.pluginDir, packageName)
      
      const { execSync } = await import('child_process')
      const npmCommand = version 
        ? `npm pack ${packageName}@${version} --pack-destination=${this.pluginDir}`
        : `npm pack ${packageName} --pack-destination=${this.pluginDir}`
      
      execSync(npmCommand, { stdio: 'pipe' })
      
      const tgzFiles = fs.readdirSync(this.pluginDir).filter(f => f.startsWith(packageName) && f.endsWith('.tgz'))
      if (tgzFiles.length === 0) {
        return { success: false, message: 'Failed to download package', error: 'NPM_PACK_FAILED' }
      }

      const tgzPath = path.join(this.pluginDir, tgzFiles[0])
      execSync(`tar -xzf "${tgzPath}" -C "${this.pluginDir}"`, { stdio: 'pipe' })
      fs.unlinkSync(tgzPath)

      const extractedDir = path.join(this.pluginDir, 'package')
      if (fs.existsSync(extractedDir)) {
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true })
        }
        fs.renameSync(extractedDir, targetPath)
      }

      console.log(`[PluginInstaller] Plugin ${packageName} installed from npm`)
      return { success: true, message: `Plugin ${packageName} installed from npm`, pluginId: packageName }
    } catch (error: any) {
      console.error('[PluginInstaller] NPM install failed:', error)
      return { success: false, message: error.message, error: 'NPM_INSTALL_FAILED' }
    }
  }

  async installFromUrl(url: string): Promise<InstallResult> {
    try {
      const https = await import('https')
      const http = await import('http')
      const client = url.startsWith('https') ? https : http

      const tempPath = path.join(this.pluginDir, `temp_${Date.now()}.zip`)
      
      await new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(tempPath)
        client.get(url, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectUrl = response.headers.location
            if (redirectUrl) {
              file.close()
              fs.unlinkSync(tempPath)
              this.installFromUrl(redirectUrl).then(resolve).catch(reject)
              return
            }
          }
          response.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
        }).on('error', (err) => {
          fs.unlinkSync(tempPath)
          reject(err)
        })
      })

      const result = await this.installFromArchive(tempPath)
      fs.unlinkSync(tempPath)
      return result
    } catch (error: any) {
      console.error('[PluginInstaller] URL install failed:', error)
      return { success: false, message: error.message, error: 'URL_INSTALL_FAILED' }
    }
  }

  async installFromArchive(archivePath: string): Promise<InstallResult> {
    try {
      const { execSync } = await import('child_process')
      const extractDir = path.join(this.pluginDir, `extract_${Date.now()}`)
      
      fs.mkdirSync(extractDir, { recursive: true })
      
      if (archivePath.endsWith('.zip')) {
        execSync(`unzip -o "${archivePath}" -d "${extractDir}"`, { stdio: 'pipe' })
      } else if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
        execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { stdio: 'pipe' })
      } else {
        return { success: false, message: 'Unsupported archive format', error: 'UNSUPPORTED_FORMAT' }
      }

      const subDirs = fs.readdirSync(extractDir).filter(f => 
        fs.statSync(path.join(extractDir, f)).isDirectory()
      )
      
      const pluginDir = subDirs.length === 1 
        ? path.join(extractDir, subDirs[0])
        : extractDir

      const result = await this.installFromPath(pluginDir)
      
      fs.rmSync(extractDir, { recursive: true, force: true })
      return result
    } catch (error: any) {
      console.error('[PluginInstaller] Archive install failed:', error)
      return { success: false, message: error.message, error: 'ARCHIVE_INSTALL_FAILED' }
    }
  }

  async uninstall(pluginId: string): Promise<UninstallResult> {
    try {
      const pluginPath = path.join(this.pluginDir, pluginId)
      
      if (!fs.existsSync(pluginPath)) {
        return { success: false, message: `Plugin ${pluginId} not found`, error: 'PLUGIN_NOT_FOUND' }
      }

      fs.rmSync(pluginPath, { recursive: true, force: true })
      
      console.log(`[PluginInstaller] Plugin ${pluginId} uninstalled`)
      return { success: true, message: `Plugin ${pluginId} uninstalled` }
    } catch (error: any) {
      console.error('[PluginInstaller] Uninstall failed:', error)
      return { success: false, message: error.message, error: 'UNINSTALL_FAILED' }
    }
  }

  async packPlugin(sourcePath: string, outputPath?: string): Promise<string> {
    try {
      const manifestPath = path.join(sourcePath, 'manifest.json')
      if (!fs.existsSync(manifestPath)) {
        throw new Error('manifest.json not found')
      }

      const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      const packageName = `${manifest.id}-${manifest.version}.zip`
      const targetPath = outputPath || path.join(this.pluginDir, packageName)

      const { execSync } = await import('child_process')
      execSync(`cd "${sourcePath}" && zip -r "${targetPath}" .`, { stdio: 'pipe' })

      console.log(`[PluginInstaller] Plugin packed to ${targetPath}`)
      return targetPath
    } catch (error: any) {
      console.error('[PluginInstaller] Pack failed:', error)
      throw error
    }
  }

  listInstalled(): string[] {
    if (!fs.existsSync(this.pluginDir)) {
      return []
    }
    return fs.readdirSync(this.pluginDir).filter(f => {
      const pluginPath = path.join(this.pluginDir, f)
      return fs.statSync(pluginPath).isDirectory() && 
             fs.existsSync(path.join(pluginPath, 'manifest.json'))
    })
  }

  getPluginInfo(pluginId: string): PluginManifest | null {
    const manifestPath = path.join(this.pluginDir, pluginId, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
      return null
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  }

  private copyDirectory(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true })
    
    const entries = fs.readdirSync(src, { withFileTypes: true })
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath)
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

export const pluginInstaller = new PluginInstaller()
