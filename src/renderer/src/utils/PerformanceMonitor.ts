/**
 * 性能监控工具
 * 用于监测应用的关键性能指标
 */

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private maxDataPoints: number = 100; // 每个指标最多保存100个数据点
  private observers: Array<(metric: string, value: number) => void> = [];

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 记录性能指标
   */
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // 只保留最新的数据点
    if (values.length > this.maxDataPoints) {
      values.shift();
    }

    // 通知观察者
    this.observers.forEach(observer => observer(name, value));
  }

  /**
   * 计算指标的平均值
   */
  getAverage(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * 获取指标的最新值
   */
  getLastValue(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    
    return values[values.length - 1];
  }

  /**
   * 获取指标的峰值
   */
  getMaxValue(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    
    return Math.max(...values);
  }

  /**
   * 获取指标的最小值
   */
  getMinValue(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    
    return Math.min(...values);
  }

  /**
   * 获取所有指标名称
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * 计算渲染帧率
   */
  measureFrameRate(callback: () => void): void {
    const startTime = performance.now();
    
    requestAnimationFrame(() => {
      const endTime = performance.now();
      const frameTime = endTime - startTime;
      const fps = 1000 / frameTime;
      
      this.recordMetric('fps', fps);
      callback();
    });
  }

  /**
   * 测量函数执行时间
   */
  async measureFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const end = performance.now();
      const duration = end - start;
      
      this.recordMetric(`${name}_execution_time`, duration);
      return result;
    } catch (error) {
      const end = performance.now();
      const duration = end - start;
      
      this.recordMetric(`${name}_execution_time`, duration);
      throw error;
    }
  }

  /**
   * 测量同步函数执行时间
   */
  measureSyncFunction<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      const end = performance.now();
      const duration = end - start;
      
      this.recordMetric(`${name}_execution_time`, duration);
      return result;
    } catch (error) {
      const end = performance.now();
      const duration = end - start;
      
      this.recordMetric(`${name}_execution_time`, duration);
      throw error;
    }
  }

  /**
   * 监控内存使用情况（如果可用）
   */
  monitorMemory(): void {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      this.recordMetric('memory_used', memory.usedJSHeapSize);
      this.recordMetric('memory_total', memory.totalJSHeapSize);
      this.recordMetric('memory_limit', memory.jsHeapSizeLimit);
    }
  }

  /**
   * 添加指标观察者
   */
  addObserver(observer: (metric: string, value: number) => void): void {
    this.observers.push(observer);
  }

  /**
   * 移除指标观察者
   */
  removeObserver(observer: (metric: string, value: number) => void): void {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
    }
  }

  /**
   * 重置所有指标数据
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * 获取性能报告
   */
  getReport(): Record<string, { average: number; min: number; max: number; last: number; count: number }> {
    const report: Record<string, { average: number; min: number; max: number; last: number; count: number }> = {};
    
    for (const [name, values] of this.metrics) {
      if (values.length > 0) {
        const sum = values.reduce((acc, val) => acc + val, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const last = values[values.length - 1];
        
        report[name] = {
          average: avg,
          min: min,
          max: max,
          last: last,
          count: values.length
        };
      }
    }
    
    return report;
  }

  /**
   * 打印性能报告到控制台
   */
  printReport(): void {
    const report = this.getReport();
    console.group('📊 性能监控报告');
    
    for (const [name, data] of Object.entries(report)) {
      console.log(`${name}:`);
      console.log(`  平均值: ${data.average.toFixed(2)}`);
      console.log(`  最小值: ${data.min.toFixed(2)}`);
      console.log(`  最大值: ${data.max.toFixed(2)}`);
      console.log(`  最新值: ${data.last.toFixed(2)}`);
      console.log(`  数据点数: ${data.count}`);
      console.log('');
    }
    
    console.groupEnd();
  }
}