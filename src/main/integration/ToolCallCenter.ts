import { VscodeIntegration } from './VscodeIntegration'
import { ToolIntegration, ToolType, ToolOptions, ToolStatus } from './ToolTypes'

export class ToolCallCenter {
  private integrations: Map<ToolType, ToolIntegration>
  private toolStatuses: Map<ToolType, ToolStatus>

  constructor() {
    this.integrations = new Map()
    this.toolStatuses = new Map()
    this.initializeIntegrations()
  }

  private initializeIntegrations(): void {
    const vscodeIntegration = new VscodeIntegration()
    this.registerIntegration('vscode', vscodeIntegration)
  }

  registerIntegration(tool: ToolType, integration: ToolIntegration): void {
    this.integrations.set(tool, integration)
    this.updateToolStatus(tool)
  }

  async openTool(tool: ToolType, options?: ToolOptions): Promise<void> {
    const integration = this.integrations.get(tool)
    if (!integration) {
      throw new Error(`Tool ${tool} is not registered`)
    }

    if (!integration.isAvailable()) {
      throw new Error(`Tool ${tool} is not available`)
    }

    await integration.startInstance(options)
  }

  async openPath(tool: ToolType, filePath: string, options?: ToolOptions): Promise<void> {
    const integration = this.integrations.get(tool)
    if (!integration) {
      throw new Error(`Tool ${tool} is not registered`)
    }

    if (!integration.isAvailable()) {
      throw new Error(`Tool ${tool} is not available`)
    }

    await integration.openPath(filePath, options)
  }

  async executeCommand(tool: ToolType, command: string, ...args: any[]): Promise<any> {
    const integration = this.integrations.get(tool)
    if (!integration) {
      throw new Error(`Tool ${tool} is not registered`)
    }

    if (!integration.isAvailable()) {
      throw new Error(`Tool ${tool} is not available`)
    }

    return await integration.executeCommand(command, ...args)
  }

  async getToolStatus(tool: ToolType): Promise<ToolStatus> {
    await this.updateToolStatus(tool)
    return this.toolStatuses.get(tool) || {
      available: false,
      version: null,
      path: null,
      lastChecked: new Date()
    }
  }

  async getAllToolStatuses(): Promise<Map<ToolType, ToolStatus>> {
    for (const tool of this.integrations.keys()) {
      await this.updateToolStatus(tool)
    }
    return new Map(this.toolStatuses)
  }

  listAvailableTools(): ToolType[] {
    const available: ToolType[] = []
    for (const [tool, integration] of this.integrations) {
      if (integration.isAvailable()) {
        available.push(tool)
      }
    }
    return available
  }

  isToolAvailable(tool: ToolType): boolean {
    const integration = this.integrations.get(tool)
    return integration ? integration.isAvailable() : false
  }

  async closeToolInstance(tool: ToolType, instanceId: string): Promise<void> {
    const integration = this.integrations.get(tool)
    if (!integration) {
      throw new Error(`Tool ${tool} is not registered`)
    }

    await integration.closeInstance(instanceId)
  }

  private async updateToolStatus(tool: ToolType): Promise<void> {
    const integration = this.integrations.get(tool)
    if (integration) {
      const status = await integration.getStatus()
      this.toolStatuses.set(tool, status)
    }
  }

  async autoSelectTool(task: string, context?: any): Promise<ToolType> {
    const taskLower = task.toLowerCase()

    if (taskLower.includes('vscode') || taskLower.includes('visual studio code') || taskLower.includes('code')) {
      return 'vscode'
    }

    if (taskLower.includes('unity') || taskLower.includes('game') || taskLower.includes('3d')) {
      return 'unity'
    }

    if (taskLower.includes('source') || taskLower.includes('mod') || taskLower.includes('valve')) {
      return 'source'
    }

    const availableTools = this.listAvailableTools()
    if (availableTools.length > 0) {
      return availableTools[0]
    }

    throw new Error('No available tools found')
  }
}

export const toolCallCenter = new ToolCallCenter()