import React, { useState } from 'react';
import { Check, Clock, Trash2, Undo } from 'lucide-react';
import { cn } from '../utils/cn';

type TodoItemProps = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export function TodoItem({ 
  id, 
  text, 
  completed, 
  createdAt, 
  onToggle, 
  onDelete 
}: TodoItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const handleDeleteClick = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    
    setIsAnimating(true);
    setTimeout(() => {
      onDelete(id);
    }, 300);
  };
  
  const handleCancelDelete = () => {
    setShowConfirm(false);
  };
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  };
  
  return (
    <div 
      className={cn(
        'group relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8',
        isAnimating && 'opacity-0 translate-x-[-20px] transition-all duration-300'
      )}
    >
      <div className={cn(
        'flex items-start gap-4 p-4 rounded-lg border transition-all duration-200',
        'hover:shadow-sm hover:border-gray-300',
        completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100',
        showConfirm && 'border-red-200 bg-red-50'
      )}>
        {/* 完成状态复选框 */}
        <button
          onClick={() => onToggle(id)}
          className={cn(
            'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
            completed 
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
          )}
          aria-label={completed ? '标记为未完成' : '标记为完成'}
        >
          {completed && <Check className="w-3 h-3" />}
        </button>
        
        {/* 任务内容区域 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className={cn(
                'text-base leading-relaxed break-words',
                completed 
                  ? 'text-gray-500 line-through decoration-gray-400'
                  : 'text-gray-900'
              )}>
                {text}
              </p>
              
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{formatTime(createdAt)}</span>
              </div>
            </div>
            
            {/* 删除按钮 */}
            <div className="flex items-center gap-2">
              {showConfirm ? (
                <>
                  <button
                    onClick={handleCancelDelete}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                    aria-label="取消删除"
                  >
                    <Undo className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded transition-all duration-200',
                      'flex items-center gap-1.5',
                      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
                      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
                    )}
                    aria-label="确认删除"
                  >
                    <Trash2 className="w-3 h-3" />
                    确认删除
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDeleteClick}
                  className={cn(
                    'p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-200',
                    'opacity-0 group-hover:opacity-100 focus:opacity-100',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
                  )}
                  aria-label="删除任务"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {showConfirm && (
        <div className="mt-2 text-sm text-red-600 flex items-center gap-1 animate-pulse">
          <span className="text-red-500">⚠</span>
          确认要删除这个任务吗？
        </div>
      )}
    </div>
  );
}