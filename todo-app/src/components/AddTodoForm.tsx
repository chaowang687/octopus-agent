import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

type AddTodoFormProps = {
  onAddTodo: (text: string) => Promise<void>;
  className?: string;
};

export function AddTodoForm({ onAddTodo, className }: AddTodoFormProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      setError('任务内容不能为空');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      await onAddTodo(trimmedValue);
      setInputValue('');
    } catch (err) {
      setError('添加失败，请重试');
      console.error('添加任务失败:', err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  return (
    <div className={cn('max-w-3xl mx-auto px-4 sm:px-6 lg:px-8', className)}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="添加新任务..."
                className={cn(
                  'w-full px-4 py-3 text-base rounded-lg border transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  'placeholder:text-gray-400',
                  error 
                    ? 'border-red-300 bg-red-50 text-red-900'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
                )}
                disabled={isSubmitting}
                aria-label="新任务内容"
                aria-invalid={!!error}
                aria-describedby={error ? 'input-error' : undefined}
              />
              
              {error && (
                <div 
                  id="input-error"
                  className="mt-2 text-sm text-red-600 flex items-center gap-1"
                >
                  <span className="text-red-500">⚠</span>
                  {error}
                </div>
              )}
            </div>
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting || !inputValue.trim()}
            className={cn(
              'px-6 py-3 rounded-lg font-medium transition-all duration-200',
              'flex items-center justify-center gap-2',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              isSubmitting || !inputValue.trim()
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            )}
            aria-label="添加任务"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                添加中...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                添加任务
              </>
            )}
          </button>
        </div>
        
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span className="text-gray-400">💡</span>
          按 Enter 键快速添加
        </div>
      </form>
    </div>
  );
}