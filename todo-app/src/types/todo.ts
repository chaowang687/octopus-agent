export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

export type FilterType = 'all' | 'active' | 'completed';

export interface TodoStats {
  total: number;
  completed: number;
  active: number;
}