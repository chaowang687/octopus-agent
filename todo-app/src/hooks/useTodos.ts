import { useState, useEffect, useCallback } from 'react';
import { Todo, TodoStats } from '../types/todo';
import { saveTodos, loadTodos, generateId } from '../utils/storage';

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 初始化加载数据
  useEffect(() => {
    const loadedTodos = loadTodos();
    setTodos(loadedTodos);
    setLoading(false);
  }, []);
  
  // 保存数据到 localStorage
  useEffect(() => {
    if (!loading) {
      saveTodos(todos);
    }
  }, [todos, loading]);
  
  const addTodo = useCallback((text: string) => {
    if (!text.trim()) return;
    
    const newTodo: Todo = {
      id: generateId(),
      text: text.trim(),
      completed: false,
      createdAt: new Date(),
    };
    
    setTodos(prev => [newTodo, ...prev]);
  }, []);
  
  const toggleTodo = useCallback((id: string) => {
    setTodos(prev => prev.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  }, []);
  
  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, []);
  
  const clearCompleted = useCallback(() => {
    setTodos(prev => prev.filter(todo => !todo.completed));
  }, []);
  
  const updateTodoText = useCallback((id: string, text: string) => {
    if (!text.trim()) return;
    
    setTodos(prev => prev.map(todo => 
      todo.id === id ? { ...todo, text: text.trim() } : todo
    ));
  }, []);
  
  const stats: TodoStats = {
    total: todos.length,
    completed: todos.filter(todo => todo.completed).length,
    active: todos.filter(todo => !todo.completed).length,
  };
  
  return {
    todos,
    loading,
    stats,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearCompleted,
    updateTodoText,
  };
}