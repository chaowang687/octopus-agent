import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OptimizationResult, ResourceAllocation, OptimizationConfig } from '../../types/project.types';

interface SolutionsState {
  optimizationResult: OptimizationResult | null;
  config: OptimizationConfig;
  isOptimizing: boolean;
  error: string | null;
  history: OptimizationResult[];
}

const initialState: SolutionsState = {
  optimizationResult: null,
  config: {
    algorithm: 'linear',
    objective: 'balanced',
    constraints: {
      totalBudget: 1000,
      totalPersonnel: 20,
      timePeriod: 6,
      minimumAllocation: 0.8,
      maximumAllocation: 1.2
    },
    maxIterations: 1000,
    tolerance: 0.001,
    useParallel: false
  },
  isOptimizing: false,
  error: null,
  history: []
};

const solutionsSlice = createSlice({
  name: 'solutions',
  initialState,
  reducers: {
    // 设置优化配置
    setOptimizationConfig: (state, action: PayloadAction<Partial<OptimizationConfig>>) => {
      state.config = {
        ...state.config,
        ...action.payload
      };
      state.error = null;
    },

    // 开始优化
    startOptimization: (state) => {
      state.isOptimizing = true;
      state.error = null;
    },

    // 优化成功
    optimizationSuccess: (state, action: PayloadAction<OptimizationResult>) => {
      state.optimizationResult = action.payload;
      state.history.push(action.payload);
      state.isOptimizing = false;
      state.error = null;
    },

    // 优化失败
    optimizationFailure: (state, action: PayloadAction<string>) => {
      state.isOptimizing = false;
      state.error = action.payload;
    },

    // 重置优化结果
    resetOptimization: (state) => {
      state.optimizationResult = null;
      state.error = null;
    },

    // 清除历史记录
    clearHistory: (state) => {
      state.history = [];
    },

    // 从历史记录加载结果
    loadFromHistory: (state, action: PayloadAction<number>) => {
      const index = action.payload;
      if (index >= 0 && index < state.history.length) {
        state.optimizationResult = state.history[index];
        state.error = null;
      }
    }
  }
});

export const { 
  setOptimizationConfig, 
  startOptimization, 
  optimizationSuccess, 
  optimizationFailure, 
  resetOptimization, 
  clearHistory, 
  loadFromHistory 
} = solutionsSlice.actions;

export default solutionsSlice.reducer;
