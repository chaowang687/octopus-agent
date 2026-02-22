import React, { useState } from 'react';
import { optimizationEngine } from '../services/OptimizationEngine';
import { Project, Constraints, OptimizationConfig, OptimizationResult, ResourceAllocation as Allocation } from '../types/project.types';

// 资源分配优化页面
const ResourceAllocation: React.FC = () => {
  // 本地状态
  const [constraints, setConstraints] = useState<Constraints>({
    totalBudget: 1000,
    totalPersonnel: 20,
    timePeriod: 6,
    minimumAllocation: 0.8,
    maximumAllocation: 1.2
  });

  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      name: '人工智能项目',
      description: '开发先进的人工智能算法和模型',
      budget: 400,
      personnel: 8,
      return: 1.8,
      risk: 0.3,
      dependencies: [],
      status: 'pending'
    },
    {
      id: '2',
      name: '区块链项目',
      description: '构建安全的区块链基础设施',
      budget: 300,
      personnel: 6,
      return: 2.2,
      risk: 0.45,
      dependencies: [],
      status: 'pending'
    },
    {
      id: '3',
      name: '量子计算项目',
      description: '研究量子计算技术和应用',
      budget: 500,
      personnel: 10,
      return: 3.0,
      risk: 0.6,
      dependencies: [],
      status: 'pending'
    }
  ]);

  const [config, setConfig] = useState<OptimizationConfig>({
    algorithm: 'linear',
    objective: 'balanced',
    constraints: constraints,
    maxIterations: 1000,
    tolerance: 0.001,
    useParallel: false
  });

  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newProject, setNewProject] = useState<Omit<Project, 'id' | 'status' | 'dependencies'>>({
    name: '',
    description: '',
    budget: 0,
    personnel: 0,
    return: 0,
    risk: 0
  });

  // 执行优化
  const handleOptimize = async () => {
    try {
      setIsOptimizing(true);
      setError(null);
      
      // 设置项目和约束条件
      optimizationEngine.setProjects(projects);
      optimizationEngine.setConstraints(constraints);
      
      // 执行优化
      const result = optimizationEngine.optimize(config);
      
      setOptimizationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '优化失败');
    } finally {
      setIsOptimizing(false);
    }
  };

  // 添加项目
  const handleAddProject = () => {
    if (newProject.name && newProject.budget > 0 && newProject.personnel > 0) {
      const newProjectWithId: Project = {
        id: (projects.length + 1).toString(),
        ...newProject,
        status: 'pending',
        dependencies: []
      };
      setProjects([...projects, newProjectWithId]);
      
      // 重置表单
      setNewProject({
        name: '',
        description: '',
        budget: 0,
        personnel: 0,
        return: 0,
        risk: 0
      });
    }
  };

  // 删除项目
  const handleDeleteProject = (id: string) => {
    setProjects(projects.filter(project => project.id !== id));
  };

  // 重置所有数据
  const handleReset = () => {
    setProjects([
      {
        id: '1',
        name: '人工智能项目',
        description: '开发先进的人工智能算法和模型',
        budget: 400,
        personnel: 8,
        return: 1.8,
        risk: 0.3,
        dependencies: [],
        status: 'pending'
      },
      {
        id: '2',
        name: '区块链项目',
        description: '构建安全的区块链基础设施',
        budget: 300,
        personnel: 6,
        return: 2.2,
        risk: 0.45,
        dependencies: [],
        status: 'pending'
      },
      {
        id: '3',
        name: '量子计算项目',
        description: '研究量子计算技术和应用',
        budget: 500,
        personnel: 10,
        return: 3.0,
        risk: 0.6,
        dependencies: [],
        status: 'pending'
      }
    ]);
    
    setConstraints({
      totalBudget: 1000,
      totalPersonnel: 20,
      timePeriod: 6,
      minimumAllocation: 0.8,
      maximumAllocation: 1.2
    });
    
    setConfig({
      algorithm: 'linear',
      objective: 'balanced',
      constraints: constraints,
      maxIterations: 1000,
      tolerance: 0.001,
      useParallel: false
    });
    
    setOptimizationResult(null);
    setError(null);
  };

  return (
    <div className="resource-allocation">
      <div className="container">
        <h1>资源分配优化系统</h1>
        
        {/* 错误提示 */}
        {error && (
          <div className="error-message">
            <strong>错误:</strong> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：项目管理 */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2>项目管理</h2>
              
              {/* 项目列表 */}
              <div className="project-list">
                <h3>现有项目</h3>
                {projects.map((project) => (
                  <div key={project.id} className="project-item">
                    <div className="project-info">
                      <h4>{project.name}</h4>
                      <p>{project.description}</p>
                      <div className="project-metrics">
                        <span>预算: {project.budget}</span>
                        <span>人员: {project.personnel}</span>
                        <span>回报: {project.return}x</span>
                        <span>风险: {project.risk}</span>
                      </div>
                    </div>
                    <button 
                      className="delete-button"
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>

              {/* 添加新项目 */}
              <div className="add-project">
                <h3>添加新项目</h3>
                <div className="form-group">
                  <label>项目名称</label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    placeholder="输入项目名称"
                  />
                </div>
                <div className="form-group">
                  <label>项目描述</label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="输入项目描述"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>预算</label>
                    <input
                      type="number"
                      value={newProject.budget}
                      onChange={(e) => setNewProject({ ...newProject, budget: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="10"
                    />
                  </div>
                  <div className="form-group">
                    <label>人员</label>
                    <input
                      type="number"
                      value={newProject.personnel}
                      onChange={(e) => setNewProject({ ...newProject, personnel: parseInt(e.target.value) || 0 })}
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>预期回报</label>
                    <input
                      type="number"
                      value={newProject.return}
                      onChange={(e) => setNewProject({ ...newProject, return: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div className="form-group">
                    <label>风险</label>
                    <input
                      type="number"
                      value={newProject.risk}
                      onChange={(e) => setNewProject({ ...newProject, risk: parseFloat(e.target.value) || 0 })}
                      min="0"
                      max="1"
                      step="0.01"
                    />
                  </div>
                </div>
                <button 
                  className="add-button"
                  onClick={handleAddProject}
                >
                  添加项目
                </button>
              </div>
            </div>
          </div>

          {/* 中间：约束条件和配置 */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2>约束条件</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>总预算</label>
                  <input
                    type="number"
                    value={constraints.totalBudget}
                    onChange={(e) => setConstraints({ ...constraints, totalBudget: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="100"
                  />
                </div>
                <div className="form-group">
                  <label>总人员</label>
                  <input
                    type="number"
                    value={constraints.totalPersonnel}
                    onChange={(e) => setConstraints({ ...constraints, totalPersonnel: parseInt(e.target.value) || 0 })}
                    min="0"
                    step="1"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>时间周期 (月)</label>
                  <input
                    type="number"
                    value={constraints.timePeriod}
                    onChange={(e) => setConstraints({ ...constraints, timePeriod: parseInt(e.target.value) || 0 })}
                    min="1"
                    step="1"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>最小分配比例</label>
                  <input
                    type="number"
                    value={constraints.minimumAllocation}
                    onChange={(e) => setConstraints({ ...constraints, minimumAllocation: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="1"
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label>最大分配比例</label>
                  <input
                    type="number"
                    value={constraints.maximumAllocation}
                    onChange={(e) => setConstraints({ ...constraints, maximumAllocation: parseFloat(e.target.value) || 0 })}
                    min="1"
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2>优化配置</h2>
              <div className="form-group">
                <label>优化算法</label>
                <select
                  value={config.algorithm}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    algorithm: e.target.value as OptimizationConfig['algorithm'] 
                  })}
                >
                  <option value="linear">线性规划</option>
                  <option value="heuristic">启发式算法</option>
                  <option value="genetic">遗传算法</option>
                </select>
              </div>
              <div className="form-group">
                <label>优化目标</label>
                <select
                  value={config.objective}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    objective: e.target.value as OptimizationConfig['objective'] 
                  })}
                >
                  <option value="maximizeReturn">最大化回报</option>
                  <option value="minimizeRisk">最小化风险</option>
                  <option value="balanced">平衡策略</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>最大迭代次数</label>
                  <input
                    type="number"
                    value={config.maxIterations}
                    onChange={(e) => setConfig({ ...config, maxIterations: parseInt(e.target.value) || 0 })}
                    min="100"
                    step="100"
                  />
                </div>
                <div className="form-group">
                  <label>容差</label>
                  <input
                    type="number"
                    value={config.tolerance}
                    onChange={(e) => setConfig({ ...config, tolerance: parseFloat(e.target.value) || 0 })}
                    min="0.0001"
                    step="0.0001"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config.useParallel}
                    onChange={(e) => setConfig({ ...config, useParallel: e.target.checked })}
                  />
                  使用并行计算
                </label>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="action-buttons">
              <button 
                className="primary-button"
                onClick={handleOptimize}
                disabled={isOptimizing}
              >
                {isOptimizing ? '优化中...' : '执行优化'}
              </button>
              <button 
                className="secondary-button"
                onClick={handleReset}
              >
                重置所有数据
              </button>
            </div>
          </div>

          {/* 右侧：优化结果 */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2>优化结果</h2>
              
              {optimizationResult ? (
                <div className="optimization-result">
                  {/* 总计信息 */}
                  <div className="result-summary">
                    <h3>优化总结</h3>
                    <div className="summary-metrics">
                      <div className="metric">
                        <label>总预算使用</label>
                        <span>{optimizationResult.totalBudgetUsed.toFixed(2)}</span>
                      </div>
                      <div className="metric">
                        <label>总人员使用</label>
                        <span>{optimizationResult.totalPersonnelUsed}</span>
                      </div>
                      <div className="metric">
                        <label>总预期回报</label>
                        <span>{optimizationResult.totalExpectedReturn.toFixed(2)}x</span>
                      </div>
                      <div className="metric">
                        <label>平均风险</label>
                        <span>{optimizationResult.totalRisk.toFixed(2)}</span>
                      </div>
                      <div className="metric">
                        <label>优化时间</label>
                        <span>{optimizationResult.optimizationTime.toFixed(2)}ms</span>
                      </div>
                      <div className="metric">
                        <label>算法</label>
                        <span>{optimizationResult.algorithm}</span>
                      </div>
                    </div>
                  </div>

                  {/* 详细分配 */}
                  <div className="allocation-details">
                    <h3>详细分配</h3>
                    {optimizationResult.allocations.map((allocation: Allocation) => (
                      <div key={allocation.projectId} className="allocation-item">
                        <div className="allocation-header">
                          <h4>{allocation.projectName}</h4>
                          <span className={`status ${allocation.status}`}>
                            {allocation.status === 'optimal' && '最优'}
                            {allocation.status === 'feasible' && '可行'}
                            {allocation.status === 'risky' && '风险'}
                            {allocation.status === 'infeasible' && '不可行'}
                          </span>
                        </div>
                        <div className="allocation-metrics">
                          <span>预算: {allocation.budgetAllocated.toFixed(2)}</span>
                          <span>人员: {allocation.personnelAllocated.toFixed(2)}</span>
                          <span>预期回报: {allocation.expectedReturn.toFixed(2)}x</span>
                          <span>调整风险: {allocation.adjustedRisk.toFixed(2)}</span>
                          <span>成功概率: {(allocation.successProbability * 100).toFixed(2)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 建议 */}
                  <div className="recommendations">
                    <h3>项目建议</h3>
                    <ul>
                      {optimizationEngine.generateProjectRecommendations(optimizationResult.allocations).map((recommendation, index) => (
                        <li key={index}>{recommendation}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="empty-result">
                  <p>点击"执行优化"按钮开始优化资源分配</p>
                  <p>系统将根据您的项目数据和约束条件，生成最优的资源分配方案</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceAllocation;
