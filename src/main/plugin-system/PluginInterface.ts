/**
 * 插件系统核心接口定义
 */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  main: string;
  dependencies?: Record<string, string>;
  permissions?: string[];
  category: PluginCategory;
  keywords?: string[];
  homepage?: string;
  repository?: string;
}

export type PluginCategory = 
  | 'service' 
  | 'feature' 
  | 'ui' 
  | 'integration' 
  | 'automation' 
  | 'ide' 
  | 'workflow'
  | 'tool'
  | 'memory'
  | 'reasoning'
  | 'agent';

import { ModuleCapability } from './CapabilityRegistry';

export interface PluginInterface {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  
  registerTools?(registry: any): void;
  registerUIComponents?(): any;
  registerEventHandlers?(): void;
  registerCommands?(): void;
  
  getCapabilities?(): ModuleCapability;
}

export interface PluginConfig {
  autoStart?: boolean;
  permissions?: string[];
  sandboxed?: boolean;
}

export interface PluginLoadResult {
  success: boolean;
  error?: string;
  plugin?: PluginInterface;
}

export interface ToolPlugin extends PluginInterface {
  category: 'tool';
  toolDefinitions: ToolDefinition[];
  executeTool(name: string, params: Record<string, any>): Promise<ToolResult>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: string;
}

export interface ToolResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface ServicePlugin extends PluginInterface {
  category: 'service';
  serviceName: string;
  serviceMethods: ServiceMethod[];
  getService(): any;
}

export interface ServiceMethod {
  name: string;
  description: string;
  parameters: Record<string, any>;
  returnType: string;
}

export interface MemoryPlugin extends PluginInterface {
  category: 'memory';
  memoryType: 'short' | 'medium' | 'long';
  store(key: string, value: any): Promise<void>;
  retrieve(key: string): Promise<any>;
  query(query: MemoryQuery): Promise<any[]>;
  clear(): Promise<void>;
}

export interface MemoryQuery {
  keywords?: string[];
  type?: 'short' | 'medium' | 'long' | 'all';
  limit?: number;
  since?: number;
}

export interface ReasoningPlugin extends PluginInterface {
  category: 'reasoning';
  reasoningMode: string;
  reason(input: string, options?: ReasoningOptions): Promise<ReasoningResult>;
}

export interface ReasoningOptions {
  mode?: string;
  enableDeepReflection?: boolean;
  maxIterations?: number;
}

export interface ReasoningResult {
  success: boolean;
  answer: string;
  reasoning?: string;
  trace?: any;
}
