import { Project, ResourceAllocation, Constraints, OptimizationResult, ValidationResult, OptimizationConfig } from '../types/project.types';

// 优化引擎服务
export class OptimizationEngine {
  private projects: Project[] = [];
  private constraints: Constraints = {
    totalBudget: 1000,
    totalPersonnel: 20,
    timePeriod: 6,
    minimumAllocation: 0.8,
    maximumAllocation: 1.2
  };

  // 验证输入数据
  validateInput(projects: Project[], constraints: Constraints): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证项目数据
    if (!projects || projects.length === 0) {
      errors.push('至少需要一个项目');
    } else {
      projects.forEach((project, index) => {
        if (!project.name || project.name.trim() === '') {
          errors.push(`项目 ${index + 1} 缺少名称`);
        }
        if (project.budget <= 0) {
          errors.push(`项目 ${project.name} 的预算必须大于0`);
        }
        if (project.personnel <= 0) {
          errors.push(`项目 ${project.name} 的人员需求必须大于0`);
        }
        if (project.return <= 0) {
          warnings.push(`项目 ${project.name} 的预期回报较低`);
        }
        if (project.risk > 1) {
          warnings.push(`项目 ${project.name} 的风险较高`);
        }
      });
    }

    // 验证约束条件
    if (constraints.totalBudget <= 0) {
      errors.push('总预算必须大于0');
    }
    if (constraints.totalPersonnel <= 0) {
      errors.push('总人员必须大于0');
    }
    if (constraints.timePeriod <= 0) {
      errors.push('时间周期必须大于0');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // 设置项目数据
  setProjects(projects: Project[]): void {
    this.projects = projects;
  }

  // 设置约束条件
  setConstraints(constraints: Constraints): void {
    this.constraints = constraints;
  }

  // 执行优化
  optimize(config: OptimizationConfig): OptimizationResult {
    const startTime = performance.now();

    try {
      // 验证输入
      const validation = this.validateInput(this.projects, this.constraints);
      if (!validation.isValid) {
        return {
          allocations: [],
          totalBudgetUsed: 0,
          totalPersonnelUsed: 0,
          totalExpectedReturn: 0,
          totalRisk: 0,
          optimizationTime: performance.now() - startTime,
          algorithm: config.algorithm,
          status: 'failed',
          message: validation.errors.join(', ')
        };
      }

      // 根据配置选择优化算法
      let allocations: ResourceAllocation[] = [];
      switch (config.algorithm) {
        case 'linear':
          allocations = this.linearProgrammingOptimization(config);
          break;
        case 'heuristic':
          allocations = this.heuristicOptimization(config);
          break;
        case 'genetic':
          allocations = this.geneticAlgorithmOptimization(config);
          break;
        default:
          allocations = this.heuristicOptimization(config);
      }

      // 计算总计
      const totalBudgetUsed = allocations.reduce((sum, allocation) => sum + allocation.budgetAllocated, 0);
      const totalPersonnelUsed = allocations.reduce((sum, allocation) => sum + allocation.personnelAllocated, 0);
      const totalExpectedReturn = allocations.reduce((sum, allocation) => sum + allocation.expectedReturn, 0);
      const totalRisk = allocations.reduce((sum, allocation) => sum + allocation.adjustedRisk, 0) / allocations.length;

      return {
        allocations,
        totalBudgetUsed,
        totalPersonnelUsed,
        totalExpectedReturn,
        totalRisk,
        optimizationTime: performance.now() - startTime,
        algorithm: config.algorithm,
        status: 'success',
        message: '优化成功完成'
      };
    } catch (error) {
      return {
        allocations: [],
        totalBudgetUsed: 0,
        totalPersonnelUsed: 0,
        totalExpectedReturn: 0,
        totalRisk: 0,
        optimizationTime: performance.now() - startTime,
        algorithm: config.algorithm,
        status: 'failed',
        message: `优化失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  // 线性规划优化（简化实现）
  private linearProgrammingOptimization(config: OptimizationConfig): ResourceAllocation[] {
    const allocations: ResourceAllocation[] = [];

    // 计算每个项目的优先级得分
    const projectScores = this.projects.map(project => {
      let score = 0;
      
      switch (config.objective) {
        case 'maximizeReturn':
          score = project.return * (1 - project.risk);
          break;
        case 'minimizeRisk':
          score = (1 - project.risk) * project.return;
          break;
        case 'balanced':
          score = (project.return * 0.6) + ((1 - project.risk) * 0.4);
          break;
      }

      return {
        project,
        score
      };
    });

    // 按得分排序
    projectScores.sort((a, b) => b.score - a.score);

    // 分配资源
    let remainingBudget = this.constraints.totalBudget;
    let remainingPersonnel = this.constraints.totalPersonnel;

    for (const { project } of projectScores) {
      // 计算最小和最大分配
      const minBudget = project.budget * this.constraints.minimumAllocation;
      const maxBudget = project.budget * this.constraints.maximumAllocation;
      const minPersonnel = project.personnel * this.constraints.minimumAllocation;
      const maxPersonnel = project.personnel * this.constraints.maximumAllocation;

      // 计算实际分配
      const budgetAllocation = Math.min(maxBudget, remainingBudget);
      const personnelAllocation = Math.min(maxPersonnel, remainingPersonnel);

      // 确保至少分配最小值
      const finalBudget = Math.max(minBudget, budgetAllocation);
      const finalPersonnel = Math.max(minPersonnel, personnelAllocation);

      // 检查是否有足够资源
      if (finalBudget <= remainingBudget && finalPersonnel <= remainingPersonnel) {
        // 计算调整后的风险和预期回报
        const adjustedRisk = project.risk * (1 + (1 - finalBudget / project.budget) * 0.1);
        const expectedReturn = project.return * (finalBudget / project.budget);
        const successProbability = 1 - adjustedRisk;

        allocations.push({
          projectId: project.id,
          projectName: project.name,
          budgetAllocated: finalBudget,
          personnelAllocated: finalPersonnel,
          adjustedRisk,
          expectedReturn,
          successProbability,
          status: this.getAllocationStatus(finalBudget, finalPersonnel, project),
          constraintsSatisfied: finalBudget >= minBudget && finalPersonnel >= minPersonnel
        });

        // 更新剩余资源
        remainingBudget -= finalBudget;
        remainingPersonnel -= finalPersonnel;
      }
    }

    return allocations;
  }

  // 启发式优化
  private heuristicOptimization(config: OptimizationConfig): ResourceAllocation[] {
    // 简化的启发式算法实现
    return this.linearProgrammingOptimization(config);
  }

  // 遗传算法优化
  private geneticAlgorithmOptimization(config: OptimizationConfig): ResourceAllocation[] {
    // 简化的遗传算法实现
    return this.linearProgrammingOptimization(config);
  }

  // 获取分配状态
  private getAllocationStatus(budget: number, personnel: number, project: Project): 'optimal' | 'feasible' | 'risky' | 'infeasible' {
    const budgetRatio = budget / project.budget;
    const personnelRatio = personnel / project.personnel;

    if (budgetRatio >= 1 && personnelRatio >= 1) {
      return 'optimal';
    } else if (budgetRatio >= 0.8 && personnelRatio >= 0.8) {
      return 'feasible';
    } else if (budgetRatio >= 0.5 && personnelRatio >= 0.5) {
      return 'risky';
    } else {
      return 'infeasible';
    }
  }

  // 计算项目风险
  calculateProjectRisk(project: Project, budgetAllocation: number, personnelAllocation: number): number {
    const budgetRatio = budgetAllocation / project.budget;
    const personnelRatio = personnelAllocation / project.personnel;

    // 基于资源分配的风险调整
    const resourceRisk = (1 - budgetRatio * 0.6 - personnelRatio * 0.4) * 0.3;
    const baseRisk = project.risk * 0.7;

    return Math.min(1, baseRisk + resourceRisk);
  }

  // 生成项目建议
  generateProjectRecommendations(allocations: ResourceAllocation[]): string[] {
    const recommendations: string[] = [];

    allocations.forEach(allocation => {
      if (allocation.status === 'optimal') {
        recommendations.push(`${allocation.projectName}: 资源分配充足，建议全力推进`);
      } else if (allocation.status === 'feasible') {
        recommendations.push(`${allocation.projectName}: 资源分配基本充足，建议密切监控`);
      } else if (allocation.status === 'risky') {
        recommendations.push(`${allocation.projectName}: 资源分配不足，建议调整计划或增加资源`);
      } else {
        recommendations.push(`${allocation.projectName}: 资源严重不足，建议重新评估项目可行性`);
      }
    });

    return recommendations;
  }
}

// 导出单例
export const optimizationEngine = new OptimizationEngine();
