import * as os from 'os'
import * as path from 'path'

export interface PathsConfig {
  USER_HOME: string
  PROJECT_ROOT: string
  DESKTOP: string
  DOCUMENTS: string
  DOWNLOADS: string
  TEMP: string
  APP_DATA: string
  CACHE: string
  UNITY_HUB: string
  UNITY: string
  VSCODE: string
  getWorkspacePath(projectName: string): string
  getProjectPath(projectName: string): string
}

export const PATHS: PathsConfig = {
  USER_HOME: process.env.HOME || os.homedir(),
  PROJECT_ROOT: process.env.PROJECT_ROOT || path.join(os.homedir(), 'Desktop', '本地化TRAE'),
  DESKTOP: path.join(os.homedir(), 'Desktop'),
  DOCUMENTS: path.join(os.homedir(), 'Documents'),
  DOWNLOADS: path.join(os.homedir(), 'Downloads'),
  TEMP: process.env.TEMP || os.tmpdir(),
  APP_DATA: process.env.APPDATA || path.join(os.homedir(), 'Library', 'Application Support'),
  CACHE: path.join(os.homedir(), 'Library', 'Caches'),
  UNITY_HUB: path.join(os.homedir(), 'Applications', 'Unity', 'Hub', 'Hub.app'),
  UNITY: path.join(os.homedir(), 'Applications', 'Unity', 'Unity.app'),
  VSCODE: path.join(os.homedir(), 'Applications', 'Visual Studio Code.app'),
  
  getWorkspacePath(projectName: string): string {
    return path.join(this.DESKTOP, projectName)
  },
  
  getProjectPath(projectName: string): string {
    return path.join(this.DESKTOP, projectName)
  }
}

export default PATHS