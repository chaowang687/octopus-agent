/**
 * MiniAgent 调度器
 * 作为系统调度核心，协调各个模块的执行
 */

import { WorkbenchKernel } from './WorkbenchKernel';
import { ToolDefinition } from '../agent/ToolRegistry';
import { capabilityRegistry } from './CapabilityRegistry';

const safeCapabilityRegistry = capabilityRegistry || {
  getAllModuleInfo: () => [],
  getModuleInfo: () => undefined
};

export interface TaskRequest {
  taskId: string;
  instruction: string;
  requiredCapabilities?: string[];
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
}

export interface TaskResponse {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  executedByModule?: string;
  executionTime: number;
}

export class MiniAgentOrchestrator {
  private workbenchKernel: WorkbenchKernel;
  private activeTasks: Map<string, TaskRequest> = new Map();
  private taskQueue: TaskRequest[] = [];

  constructor(workbenchKernel: WorkbenchKernel) {
    this.workbenchKernel = workbenchKernel;
  }

  /**
   * 解析用户指令并确定需要的模块
   */
  async parseInstruction(instruction: string): Promise<{ 
    requiredModules: string[]; 
    suggestedTools: ToolDefinition[]; 
  }> {
    // 这里可以集成NLP模型来分析指令
    // 临时实现：简单的关键词匹配
    const availableTools = this.workbenchKernel.getAllAvailableTools();
    const matchedTools: ToolDefinition[] = [];
    const requiredModules: Set<string> = new Set();

    for (const tool of availableTools) {
      // 简单的关键词匹配
      if (this.matchesInstruction(instruction, tool.description)) {
        matchedTools.push(this.convertToToolDefinition(tool));
        // 从capability registry获取模块ID
        // 实际实现中，我们会跟踪哪个工具属于哪个模块
        requiredModules.add(tool.name.split('_')[0]); // 简化的模块ID推断
      }
    }

    return {
      requiredModules: Array.from(requiredModules),
      suggestedTools: matchedTools
    };
  }

  /**
   * 匹配指令和工具描述
   */
  private matchesInstruction(instruction: string, description: string): boolean {
    const lowerInstruction = instruction.toLowerCase();
    const lowerDescription = description.toLowerCase();
    
    // 简单的文本匹配
    return lowerInstruction.includes(lowerDescription.split(' ')[0]) || 
           lowerDescription.includes(lowerInstruction.split(' ')[0]);
  }

  /**
   * 将模块工具转换为内部工具定义
   */
  private convertToToolDefinition(tool: any): ToolDefinition {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters.properties,
      handler: async (args: any) => {
        // 查找对应的模块并执行
        const moduleName = this.findModuleByTool(tool.name);
        if (!moduleName) {
          throw new Error(`Module for tool ${tool.name} not found`);
        }
        
        return await this.workbenchKernel.callModule(
          moduleName, 
          tool.name, 
          args
        );
      }
    };
  }

  /**
   * 根据工具名称查找模块
   */
  private findModuleByTool(toolName: string): string | null {
    // 实际实现中，我们会维护工具到模块的映射
    // 这里简化处理，根据命名约定推断
    const allModules = safeCapabilityRegistry.getAllModuleInfo();
    
    for (const module of allModules) {
      const hasTool = module.tools.some(t => t.name === toolName);
      if (hasTool) {
        return module.namespace;
      }
    }
    
    return null;
  }

  /**
   * 执行任务
   */
  async executeTask(task: TaskRequest): Promise<TaskResponse> {
    const startTime = Date.now();
    this.activeTasks.set(task.taskId, task);

    try {
      // 解析指令
      const parsed = await this.parseInstruction(task.instruction);
      
      // 如果指定了特定能力要求，优先使用这些模块
      if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
        for (const capability of task.requiredCapabilities) {
          // 找到对应模块并执行
          const result = await this.executeWithSpecificModule(capability, task.instruction);
          if (result.success) {
            return {
              taskId: task.taskId,
              success: true,
              result: result,
              executedByModule: capability,
              executionTime: Date.now() - startTime
            };
          }
        }
      }

      // 否则使用解析出的工具执行
      for (const tool of parsed.suggestedTools) {
        const moduleName = this.findModuleByTool(tool.name);
        if (moduleName) {
          const result = await this.workbenchKernel.callModule(
            moduleName,
            tool.name,
            this.extractArguments(task.instruction, tool.parameters)
          );
          
          return {
            taskId: task.taskId,
            success: true,
            result,
            executedByModule: moduleName,
            executionTime: Date.now() - startTime
          };
        }
      }

      return {
        taskId: task.taskId,
        success: false,
        error: 'No suitable module found to handle the request',
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        taskId: task.taskId,
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    } finally {
      this.activeTasks.delete(task.taskId);
    }
  }

  /**
   * 使用特定模块执行任务
   */
  private async executeWithSpecificModule(moduleName: string, instruction: string): Promise<any> {
    // 这里会根据指令调用特定模块的功能
    // 临时实现：尝试调用模块的通用执行方法
    try {
      // 获取模块的能力信息
      const moduleInfo = safeCapabilityRegistry.getModuleInfo(moduleName);
      if (!moduleInfo) {
        throw new Error(`Module ${moduleName} not found`);
      }

      // 这里可以实现更复杂的指令解析和参数提取
      // 临时返回模拟结果
      return { success: true, message: `Executed with ${moduleName}` };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 从指令中提取参数
   */
  private extractArguments(instruction: string, parameters: any): any {
    // 这里可以实现自然语言到参数的转换
    // 临时返回空对象
    return {};
  }

  /**
   * 获取活动任务
   */
  getActiveTasks(): string[] {
    return Array.from(this.activeTasks.keys());
  }

  /**
   * 获取任务队列长度
   */
  getQueueLength(): number {
    return this.taskQueue.length;
  }

  /**
   * 中断任务
   */
  interruptTask(taskId: string): boolean {
    if (this.activeTasks.has(taskId)) {
      // 实际实现中，这里会中断正在执行的任务
      this.activeTasks.delete(taskId);
      return true;
    }
    return false;
  }
}