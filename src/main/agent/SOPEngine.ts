/**
 * SOP (Standard Operating Procedure) Engine
 * 实现标准作业程序引擎
 */

export interface SOPStep {
  step_id: string;
  action: string;
  target: string;
  parameters?: Record<string, any>;
  validation?: string;
  next_success?: string;
  next_fail?: string;
  output?: string;
}

export interface SOP {
  id: string;
  name: string;
  description: string;
  steps: SOPStep[];
  variables: Record<string, any>;
}

export interface SOPExecutionContext {
  currentStepId: string;
  variables: Record<string, any>;
  executionLog: string[];
  status: 'running' | 'paused' | 'completed' | 'error';
  error?: string;
}

export class SOPEngine {
  private sop: SOP;
  private context: SOPExecutionContext;

  constructor(sop: SOP) {
    this.sop = sop;
    this.context = {
      currentStepId: '',
      variables: { ...sop.variables },
      executionLog: [],
      status: 'running'
    };
  }

  /**
   * 执行 SOP
   */
  async execute(): Promise<SOPExecutionContext> {
    try {
      // 找到第一个步骤
      const firstStep = this.sop.steps.find(step => !step.next_success || step.next_success === '');
      if (!firstStep) {
        throw new Error('No start step found in SOP');
      }

      this.context.currentStepId = firstStep.step_id;
      await this.executeStep(firstStep);

      return this.context;
    } catch (error) {
      this.context.status = 'error';
      this.context.error = error instanceof Error ? error.message : 'Unknown error';
      return this.context;
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: SOPStep): Promise<void> {
    this.context.executionLog.push(`Executing step: ${step.step_id}`);

    try {
      // 执行动作
      const result = await this.executeAction(step.action, step.target, step.parameters);

      // 验证结果
      if (step.validation && !await this.validateResult(step.validation, result)) {
        throw new Error(`Validation failed for step: ${step.step_id}`);
      }

      // 保存输出
      if (step.output) {
        this.context.variables[step.output] = result;
      }

      // 执行下一步
      if (step.next_success) {
        const nextStep = this.sop.steps.find(s => s.step_id === step.next_success);
        if (nextStep) {
          await this.executeStep(nextStep);
        }
      } else {
        // 完成
        this.context.status = 'completed';
      }
    } catch (error) {
      this.context.executionLog.push(`Error in step ${step.step_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // 处理失败分支
      if (step.next_fail) {
        const failStep = this.sop.steps.find(s => s.step_id === step.next_fail);
        if (failStep) {
          await this.executeStep(failStep);
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * 执行动作
   */
  private async executeAction(action: string, target: string, parameters?: Record<string, any>): Promise<any> {
    // 简化实现，实际应该调用对应的动作执行器
    this.context.executionLog.push(`Executing action: ${action} on ${target}`);
    return { success: true };
  }

  /**
   * 验证结果
   */
  private async validateResult(validation: string, result: any): Promise<boolean> {
    // 简化实现，实际应该执行验证逻辑
    return true;
  }

  /**
   * 暂停执行
   */
  pause(): void {
    this.context.status = 'paused';
  }

  /**
   * 恢复执行
   */
  resume(): void {
    this.context.status = 'running';
  }

  /**
   * 获取执行上下文
   */
  getContext(): SOPExecutionContext {
    return { ...this.context };
  }
}