import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Project } from '../../types/project.types';
import { v4 as uuidv4 } from 'uuid';

interface ProjectsState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ProjectsState = {
  projects: [
    {
      id: uuidv4(),
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
      id: uuidv4(),
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
      id: uuidv4(),
      name: '量子计算项目',
      description: '研究量子计算技术和应用',
      budget: 500,
      personnel: 10,
      return: 3.0,
      risk: 0.6,
      dependencies: [],
      status: 'pending'
    }
  ],
  selectedProjectId: null,
  isLoading: false,
  error: null
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    // 添加项目
    addProject: (state, action: PayloadAction<Omit<Project, 'id' | 'status' | 'dependencies'>>) => {
      const newProject: Project = {
        id: uuidv4(),
        ...action.payload,
        status: 'pending',
        dependencies: []
      };
      state.projects.push(newProject);
      state.error = null;
    },

    // 更新项目
    updateProject: (state, action: PayloadAction<{ id: string; updates: Partial<Project> }>) => {
      const { id, updates } = action.payload;
      const projectIndex = state.projects.findIndex(project => project.id === id);
      if (projectIndex !== -1) {
        state.projects[projectIndex] = {
          ...state.projects[projectIndex],
          ...updates
        };
        state.error = null;
      }
    },

    // 删除项目
    deleteProject: (state, action: PayloadAction<string>) => {
      state.projects = state.projects.filter(project => project.id !== action.payload);
      if (state.selectedProjectId === action.payload) {
        state.selectedProjectId = null;
      }
      state.error = null;
    },

    // 选择项目
    selectProject: (state, action: PayloadAction<string | null>) => {
      state.selectedProjectId = action.payload;
    },

    // 设置项目状态
    setProjectStatus: (state, action: PayloadAction<{ id: string; status: Project['status'] }>) => {
      const { id, status } = action.payload;
      const projectIndex = state.projects.findIndex(project => project.id === id);
      if (projectIndex !== -1) {
        state.projects[projectIndex].status = status;
      }
    },

    // 批量添加项目
    addProjects: (state, action: PayloadAction<Project[]>) => {
      state.projects = [...state.projects, ...action.payload];
      state.error = null;
    },

    // 重置项目
    resetProjects: (state) => {
      state.projects = initialState.projects;
      state.selectedProjectId = null;
      state.error = null;
    },

    // 设置加载状态
    setProjectsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // 设置错误
    setProjectsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    }
  }
});

export const { 
  addProject, 
  updateProject, 
  deleteProject, 
  selectProject, 
  setProjectStatus, 
  addProjects, 
  resetProjects, 
  setProjectsLoading, 
  setProjectsError 
} = projectsSlice.actions;

export default projectsSlice.reducer;
