import { VscodeIntegration } from '../../src/main/integration/VscodeIntegration'
import { ToolCallCenter } from '../../src/main/integration/ToolCallCenter'

describe('VscodeIntegration', () => {
  let vscodeIntegration: VscodeIntegration

  beforeEach(() => {
    vscodeIntegration = new VscodeIntegration()
  })

  describe('isAvailable', () => {
    it('should check if VS Code is available', () => {
      const isAvailable = vscodeIntegration.isAvailable()
      expect(typeof isAvailable).toBe('boolean')
    })
  })

  describe('getStatus', () => {
    it('should return tool status', async () => {
      const status = await vscodeIntegration.getStatus()
      expect(status).toHaveProperty('available')
      expect(status).toHaveProperty('version')
      expect(status).toHaveProperty('path')
      expect(status).toHaveProperty('lastChecked')
    })
  })

  describe('startInstance', () => {
    it('should start VS Code instance', async () => {
      if (!vscodeIntegration.isAvailable()) {
        console.warn('VS Code not available, skipping test')
        return
      }

      const instance = await vscodeIntegration.startInstance()
      expect(instance).toHaveProperty('id')
      expect(instance).toHaveProperty('startTime')
      expect(instance).toHaveProperty('options')

      await vscodeIntegration.closeInstance(instance.id)
    })
  })

  describe('openPath', () => {
    it('should open a path in VS Code', async () => {
      if (!vscodeIntegration.isAvailable()) {
        console.warn('VS Code not available, skipping test')
        return
      }

      await expect(vscodeIntegration.openPath('/tmp')).resolves.not.toThrow()
    })
  })

  describe('executeCommand', () => {
    it('should execute VS Code command', async () => {
      if (!vscodeIntegration.isAvailable()) {
        console.warn('VS Code not available, skipping test')
        return
      }

      const result = await vscodeIntegration.executeCommand('--version')
      expect(result).toBeDefined()
    })
  })
})

describe('ToolCallCenter', () => {
  let toolCallCenter: ToolCallCenter

  beforeEach(() => {
    toolCallCenter = new ToolCallCenter()
  })

  describe('listAvailableTools', () => {
    it('should list all available tools', () => {
      const tools = toolCallCenter.listAvailableTools()
      expect(Array.isArray(tools)).toBe(true)
    })
  })

  describe('getToolStatus', () => {
    it('should get status of a specific tool', async () => {
      const status = await toolCallCenter.getToolStatus('vscode')
      expect(status).toHaveProperty('available')
      expect(status).toHaveProperty('version')
      expect(status).toHaveProperty('path')
    })
  })

  describe('getAllToolStatuses', () => {
    it('should get status of all tools', async () => {
      const statuses = await toolCallCenter.getAllToolStatuses()
      expect(statuses).toBeInstanceOf(Map)
    })
  })

  describe('openTool', () => {
    it('should open a tool', async () => {
      if (!toolCallCenter.isToolAvailable('vscode')) {
        console.warn('VS Code not available, skipping test')
        return
      }

      await expect(toolCallCenter.openTool('vscode')).resolves.not.toThrow()
    })
  })

  describe('openPath', () => {
    it('should open a path with a tool', async () => {
      if (!toolCallCenter.isToolAvailable('vscode')) {
        console.warn('VS Code not available, skipping test')
        return
      }

      await expect(toolCallCenter.openPath('vscode', '/tmp')).resolves.not.toThrow()
    })
  })

  describe('autoSelectTool', () => {
    it('should auto-select VS Code for code tasks', async () => {
      const tool = await toolCallCenter.autoSelectTool('write some code')
      expect(tool).toBe('vscode')
    })

    it('should auto-select Unity for game tasks', async () => {
      const tool = await toolCallCenter.autoSelectTool('create a Unity game')
      expect(tool).toBe('unity')
    })

    it('should auto-select Source for mod tasks', async () => {
      const tool = await toolCallCenter.autoSelectTool('create a Source mod')
      expect(tool).toBe('source')
    })
  })
})