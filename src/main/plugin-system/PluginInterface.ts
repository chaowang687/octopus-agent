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
  main: string;  // 入口文件
  dependencies?: Record<string, string>;
  permissions?: string[];  // 需要的系统权限
  category: 'service' | 'feature' | 'ui' | 'integration' | 'automation' | 'ide' | 'workflow';
  keywords?: string[];
  homepage?: string;
  repository?: string;
}

import { ModuleCapability } from './CapabilityRegistry';

export interface PluginInterface {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  
  // 生命周期方法
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  
  // 功能注册方法
  registerTools?(registry: any): void;
  registerUIComponents?(): any;
  registerEventHandlers?(): void;
  registerCommands?(): void;
  
  // 能力描述
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