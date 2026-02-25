/**
 * Memory Optimizer
 * 实现内存管理和优化机制
 */

export interface MemoryUsage {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

export interface MemoryStats {
  peakUsage: number;
  averageUsage: number;
  garbageCollectionCount: number;
  memoryLeaks: string[];
}

export class MemoryOptimizer {
  private memoryThreshold: number; // Percentage threshold before triggering cleanup
  private cleanupInterval: number; // Interval in milliseconds for periodic cleanup
  private cleanupTimer: NodeJS.Timeout | null = null;
  private memoryHistory: number[] = [];
  private gcCount: number = 0;

  constructor(threshold: number = 80, interval: number = 60000) {
    this.memoryThreshold = threshold;
    this.cleanupInterval = interval;
    this.startPeriodicCleanup();
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): MemoryUsage {
    const memUsage = process.memoryUsage();
    const totalMem = this.getTotalMemory();
    const usedMem = memUsage.heapUsed / 1024 / 1024; // MB
    
    return {
      total: totalMem,
      used: usedMem,
      free: totalMem - usedMem,
      usagePercent: (usedMem / totalMem) * 100
    };
  }

  /**
   * Get total system memory
   */
  private getTotalMemory(): number {
    // 简化实现，实际应该根据平台获取
    return 8192; // 假设8GB内存
  }

  /**
   * Check if memory usage exceeds threshold
   */
  isMemoryThresholdExceeded(): boolean {
    const usage = this.getMemoryUsage();
    return usage.usagePercent > this.memoryThreshold;
  }

  /**
   * Trigger garbage collection
   */
  triggerGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      this.gcCount++;
    }
  }

  /**
   * Clean up memory
   */
  cleanupMemory(): void {
    // 清理缓存
    this.clearCaches();
    
    // 触发GC
    this.triggerGarbageCollection();
    
    // 记录内存使用情况
    this.recordMemoryUsage();
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    // 清除模块缓存
    Object.keys(require.cache).forEach(key => {
      delete require.cache[key];
    });
    
    // 清除其他缓存（如果有的话）
    if (typeof window !== 'undefined' && window.caches) {
      window.caches.keys().then(keys => {
        keys.forEach(key => window.caches.delete(key));
      });
    }
  }

  /**
   * Record memory usage
   */
  private recordMemoryUsage(): void {
    const usage = this.getMemoryUsage();
    this.memoryHistory.push(usage.used);
    
    // 保持历史记录不超过100条
    if (this.memoryHistory.length > 100) {
      this.memoryHistory.shift();
    }
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): MemoryStats {
    const peakUsage = Math.max(...this.memoryHistory);
    const averageUsage = this.memoryHistory.reduce((sum, usage) => sum + usage, 0) / this.memoryHistory.length || 0;
    
    return {
      peakUsage,
      averageUsage,
      garbageCollectionCount: this.gcCount,
      memoryLeaks: [] // 简化实现
    };
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      if (this.isMemoryThresholdExceeded()) {
        this.cleanupMemory();
      }
    }, this.cleanupInterval);
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Check for memory leaks
   */
  checkForMemoryLeaks(): string[] {
    // 简化实现，实际应该使用更复杂的检测逻辑
    return [];
  }
}