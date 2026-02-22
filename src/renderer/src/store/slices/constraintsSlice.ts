import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Constraints } from '../../types/project.types';

interface ConstraintsState {
  constraints: Constraints;
  isLoading: boolean;
  error: string | null;
}

const initialState: ConstraintsState = {
  constraints: {
    totalBudget: 1000,
    totalPersonnel: 20,
    timePeriod: 6,
    minimumAllocation: 0.8,
    maximumAllocation: 1.2
  },
  isLoading: false,
  error: null
};

const constraintsSlice = createSlice({
  name: 'constraints',
  initialState,
  reducers: {
    // 更新约束条件
    updateConstraints: (state, action: PayloadAction<Partial<Constraints>>) => {
      state.constraints = {
        ...state.constraints,
        ...action.payload
      };
      state.error = null;
    },

    // 重置约束条件
    resetConstraints: (state) => {
      state.constraints = initialState.constraints;
      state.error = null;
    },

    // 设置加载状态
    setConstraintsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // 设置错误
    setConstraintsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    }
  }
});

export const { 
  updateConstraints, 
  resetConstraints, 
  setConstraintsLoading, 
  setConstraintsError 
} = constraintsSlice.actions;

export default constraintsSlice.reducer;
