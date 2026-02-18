export interface ToolOptions {
  instanceName?: string
  workingDirectory?: string
  args?: string[]
  [key: string]: any
}

export interface VscodeOptions extends ToolOptions {
  extensionFolder?: string
  configFile?: string
  debugMode?: boolean
}

export interface UnityOptions extends ToolOptions {
  projectPath?: string
  buildTarget?: string
  editorArgs?: string[]
}

export interface SourceOptions extends ToolOptions {
  sdkPath?: string
  gamePath?: string
  compileTarget?: string
}

export interface ToolInstance {
  id: string
  process?: any
  options?: ToolOptions
  startTime: Date
}

export interface VscodeInstance extends ToolInstance {
  options: VscodeOptions
}

export interface UnityInstance extends ToolInstance {
  options: UnityOptions
}

export interface SourceInstance extends ToolInstance {
  options: SourceOptions
}

export interface ToolStatus {
  available: boolean
  version: string | null
  path: string | null
  lastChecked: Date
}

export type ToolType = 'vscode' | 'unity' | 'source' | 'terminal' | 'browser'

export interface ToolIntegration {
  startInstance(options?: ToolOptions): Promise<ToolInstance>
  openPath(path: string, options?: ToolOptions): Promise<void>
  executeCommand(command: string, ...args: any[]): Promise<any>
  isAvailable(): boolean
  getStatus(): Promise<ToolStatus>
  closeInstance(instanceId: string): Promise<void>
}