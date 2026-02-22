import { configureStore } from '@reduxjs/toolkit';
import constraintsReducer from './slices/constraintsSlice';
import projectsReducer from './slices/projectsSlice';
import solutionsReducer from './slices/solutionsSlice';

export const store = configureStore({
  reducer: {
    constraints: constraintsReducer,
    projects: projectsReducer,
    solutions: solutionsReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
