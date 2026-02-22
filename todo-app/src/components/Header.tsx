import React from 'react';
import { Calendar, CheckSquare } from 'lucide-react';
import { cn } from '../utils/cn';

type HeaderProps = {
  className?: string;
};

export function Header({ className }: HeaderProps) {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('zh-CN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  return (
    <header className={cn(
      'sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100',
      className
    )}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <CheckSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">今日待办</h1>
              <p className="text-sm text-gray-500 mt-1">专注当下，高效完成</p>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>
    </header>
  );
}