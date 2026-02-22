import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function formatTodoDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todoDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (todoDate.getTime() === today.getTime()) {
    // 今天创建的任务，显示时间
    return format(date, 'HH:mm', { locale: zhCN });
  } else {
    // 其他日期创建的任务，显示日期
    return format(date, 'MM/dd', { locale: zhCN });
  }
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) {
    return '刚刚';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟前`;
  } else if (diffInMinutes < 24 * 60) {
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}小时前`;
  } else {
    return format(date, 'MM/dd HH:mm', { locale: zhCN });
  }
}