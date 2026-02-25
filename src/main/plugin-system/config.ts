/**
 * 模块化工作台配置
 * 定义系统的模块化架构配置
 */

export interface ModuleConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  autoLoad: boolean;
  dependencies: string[];
  permissions: string[];
  entryPoint: string;
  uiComponent?: string;
  capabilityFile: string;
}

export interface WorkbenchConfig {
  kernel: {
    maxConcurrentTasks: number;
    taskTimeout: number;
    moduleLoadTimeout: number;
    securityLevel: 'strict' | 'standard' | 'permissive';
  };
  modules: {
    autoDiscovery: boolean;
    installationPath: string;
    trustedSources: string[];
    allowUnsigned: boolean;
  };
  agent: {
    enableOrchestration: boolean;
    maxPlanningDepth: number;
    enableLearning: boolean;
    contextWindowSize: number;
  };
  ui: {
    enableModuleGallery: boolean;
    enableMarketplace: boolean;
    defaultTheme: 'light' | 'dark' | 'auto';
  };
}

// 默认配置
export const DEFAULT_WORKBENCH_CONFIG: WorkbenchConfig = {
  kernel: {
    maxConcurrentTasks: 5,
    taskTimeout: 30000, // 30秒
    moduleLoadTimeout: 10000, // 10秒
    securityLevel: 'standard'
  },
  modules: {
    autoDiscovery: true,
    installationPath: './modules',
    trustedSources: ['https://registry.trae.ai', 'https://modules.example.com'],
    allowUnsigned: false
  },
  agent: {
    enableOrchestration: true,
    maxPlanningDepth: 10,
    enableLearning: true,
    contextWindowSize: 4096
  },
  ui: {
    enableModuleGallery: true,
    enableMarketplace: true,
    defaultTheme: 'auto'
  }
};

// 预定义模块配置
export const PREDEFINED_MODULES: ModuleConfig[] = [
  {
    id: 'core-agent',
    name: 'Core Agent Engine',
    version: '1.0.0',
    description: '核心智能体引擎，提供基础推理和规划能力',
    enabled: true,
    autoLoad: true,
    dependencies: [],
    permissions: ['execution', 'network'],
    entryPoint: './core-agent/index.js',
    capabilityFile: './core-agent/capabilities.json'
  },
  {
    id: 'ide-module',
    name: 'Integrated Development Environment',
    version: '1.0.0',
    description: '集成开发环境，提供代码编辑和项目管理功能',
    enabled: false,
    autoLoad: false,
    dependencies: ['core-agent'],
    permissions: ['file_system', 'read_write'],
    entryPoint: './ide-module/index.js',
    uiComponent: './ide-module/ui.js',
    capabilityFile: './ide-module/capabilities.json'
  },
  {
    id: 'workflow-module',
    name: 'Visual Workflow Designer',
    version: '1.0.0',
    description: '可视化工作流设计器，提供流程编排和执行功能',
    enabled: false,
    autoLoad: false,
    dependencies: ['core-agent'],
    permissions: ['execution', 'storage'],
    entryPoint: './workflow-module/index.js',
    uiComponent: './workflow-module/ui.js',
    capabilityFile: './workflow-module/capabilities.json'
  },
  {
    id: 'image-processing-module',
    name: 'Image Processing Tools',
    version: '1.0.0',
    description: '图像处理工具集，提供图像分析和生成能力',
    enabled: false,
    autoLoad: false,
    dependencies: ['core-agent'],
    permissions: ['media_access'],
    entryPoint: './image-processing-module/index.js',
    capabilityFile: './image-processing-module/capabilities.json'
  }
];