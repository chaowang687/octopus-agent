import { Todo } from '../types/todo';

export const STORAGE_KEY = 'todo-master-todos';

export function saveTodos(todos: Todo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (error) {
    console.error('Failed to save todos:', error);
    // 在实际应用中，这里可以添加错误提示
  }
}

export function loadTodos(): Todo[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    // 确保日期对象被正确解析
    return parsed.map((todo: any) => ({
      ...todo,
      createdAt: new Date(todo.createdAt)
    }));
  } catch (error) {
    console.error('Failed to load todos:', error);
    return [];
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}