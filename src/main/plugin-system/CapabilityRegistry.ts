/**
 * 模块能力描述系统
 * 定义模块向MiniAgent暴露的能力
 */

export interface ModuleCapability {
  namespace: string;
  version: string;
  tools: ModuleTool[];
  permissions: string[];
}

export interface ModuleTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, ToolParameter>;
    required: string[];
  };
  ui_trigger?: string;
}

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  default?: any;
}

export class CapabilityRegistry {
  private capabilities: Map<string, ModuleCapability> = new Map();

  /**
   * 注册模块能力
   */
  registerCapability(namespace: string, capability: ModuleCapability): void {
    this.capabilities.set(namespace, capability);
  }

  /**
   * 获取模块的所有工具
   */
  getModuleTools(namespace: string): ModuleTool[] {
    const capability = this.capabilities.get(namespace);
    return capability ? capability.tools : [];
  }

  /**
   * 获取所有可用工具
   */
  getAllTools(): ModuleTool[] {
    const allTools: ModuleTool[] = [];
    for (const capability of this.capabilities.values()) {
      allTools.push(...capability.tools);
    }
    return allTools;
  }

  /**
   * 获取模块信息
   */
  getModuleInfo(namespace: string): ModuleCapability | undefined {
    return this.capabilities.get(namespace);
  }

  /**
   * 获取所有模块信息
   */
  getAllModuleInfo(): ModuleCapability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * 检查权限
   */
  hasPermission(namespace: string, permission: string): boolean {
    const capability = this.capabilities.get(namespace);
    if (!capability) return false;
    return capability.permissions.includes(permission);
  }
}

// 全局能力注册表实例
export const capabilityRegistry = new CapabilityRegistry();

// 确保 capabilityRegistry 在全局范围内可用
if (typeof global !== 'undefined') {
  (global as any).capabilityRegistry = capabilityRegistry;
}

// 确保 capabilityRegistry 在模块系统中可用
if (typeof module !== 'undefined' && module.exports) {
  module.exports.capabilityRegistry = capabilityRegistry;
  module.exports.default = capabilityRegistry;
  module.exports = Object.assign(module.exports, {
    CapabilityRegistry,
    capabilityRegistry
  });
}

// 确保默认导出
export default capabilityRegistry;