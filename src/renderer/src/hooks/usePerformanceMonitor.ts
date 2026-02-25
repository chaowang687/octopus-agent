import { useEffect, useRef } from 'react';
import { PerformanceMonitor } from './PerformanceMonitor';

/**
 * React Hook 用于性能监控
 */
export const usePerformanceMonitor = (componentName: string) => {
  const monitor = PerformanceMonitor.getInstance();
  const renderCountRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  // 组件挂载时记录
  useEffect(() => {
    const mountTime = performance.now();
    monitor.recordMetric(`${componentName}_mount_time`, mountTime);
    
    return () => {
      // 组件卸载时记录
      const unmountTime = performance.now();
      monitor.recordMetric(`${componentName}_unmount_time`, unmountTime);
    };
  }, [componentName]);

  // 监控渲染性能
  useEffect(() => {
    renderCountRef.current += 1;
    monitor.recordMetric(`${componentName}_render_count`, renderCountRef.current);
    
    // 记录渲染开始时间
    startTimeRef.current = performance.now();
    
    // 使用 requestAnimationFrame 在下一帧记录渲染时间
    const rafId = requestAnimationFrame(() => {
      if (startTimeRef.current !== null) {
        const renderTime = performance.now() - startTimeRef.current;
        monitor.recordMetric(`${componentName}_render_time`, renderTime);
        startTimeRef.current = null;
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  });

  // 监控内存使用
  useEffect(() => {
    const interval = setInterval(() => {
      monitor.monitorMemory();
    }, 5000); // 每5秒监控一次内存

    return () => {
      clearInterval(interval);
    };
  }, []);

  return monitor;
};

/**
 * 高阶组件，用于包装组件以添加性能监控
 */
// export const withPerformanceMonitoring = (Component: React.ComponentType<any>, componentName: string) => {
//   return function MonitoredComponent(props: any) {
//     usePerformanceMonitor(componentName);
    
//     return <Component {...props} />;
//   };
// };