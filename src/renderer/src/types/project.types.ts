// 项目类型定义
export interface Project {
  id: string;
  name: string;
  description: string;
  budget: number;
  personnel: number;
  return: number;
  risk: number;
  dependencies: string[];
  status: 'pending' | 'active' | 'completed' | 'failed';
}

// 资源分配接口
export interface ResourceAllocation {
  projectId: string;
  projectName: string;
  budgetAllocated: number;
  personnelAllocated: number;
  adjustedRisk: number;
  expectedReturn: number;
  successProbability: number;
  status: 'optimal' | 'feasible' | 'risky' | 'infeasible';
  constraintsSatisfied: boolean;
}

// 约束条件接口
export interface Constraints {
  totalBudget: number;
  totalPersonnel: number;
  timePeriod: number;
  minimumAllocation: number;
  maximumAllocation: number;
}

// 优化结果接口
export interface OptimizationResult {
  allocations: ResourceAllocation[];
  totalBudgetUsed: number;
  totalPersonnelUsed: number;
  totalExpectedReturn: number;
  totalRisk: number;
  optimizationTime: number;
  algorithm: string;
  status: 'success' | 'failed' | 'partial';
  message: string;
}

// 输入验证结果接口
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 项目优先级接口
export interface ProjectPriority {
  projectId: string;
  priority: number;
  reasoning: string;
}

// 优化配置接口
export interface OptimizationConfig {
  algorithm: 'linear' | 'heuristic' | 'genetic';
  objective: 'maximizeReturn' | 'minimizeRisk' | 'balanced';
  constraints: Constraints;
  maxIterations: number;
  tolerance: number;
  useParallel: boolean;
}

// 风险评估接口
export interface RiskAssessment {
  projectId: string;
  baseRisk: number;
  adjustedRisk: number;
  riskFactors: {
    budgetRisk: number;
    personnelRisk: number;
    timeRisk: number;
    dependencyRisk: number;
  };
  mitigationStrategies: string[];
}
