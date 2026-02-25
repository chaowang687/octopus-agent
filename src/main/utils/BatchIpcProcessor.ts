import { ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * 批量IPC请求处理器
 * 用于优化IPC通信性能，减少频繁的小请求
 */
export class BatchIpcProcessor {
  private static instance: BatchIpcProcessor;
  private requestQueue: Array<{
    id: string;
    channel: string;
    args: any[];
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private processing: boolean = false;
  private readonly batchSize: number = 10; // 每批最大请求数
  private readonly batchTimeout: number = 10; // 批处理超时时间(ms)

  private constructor() {
    this.registerHandlers();
  }

  public static getInstance(): BatchIpcProcessor {
    if (!BatchIpcProcessor.instance) {
      BatchIpcProcessor.instance = new BatchIpcProcessor();
    }
    return BatchIpcProcessor.instance;
  }

  /**
   * 注册批量处理相关的IPC处理器
   */
  private registerHandlers(): void {
    ipcMain.handle('batch-ipc-request', async (event: IpcMainInvokeEvent, requests: Array<{ channel: string; args: any[] }>) => {
      return this.processBatchRequest(event, requests);
    });
  }

  /**
   * 添加单个请求到队列
   */
  public addToQueue(channel: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        id: `${Date.now()}-${Math.random()}`,
        channel,
        args,
        resolve,
        reject
      });

      // 如果队列达到批次大小或尚未在处理，则触发处理
      if (this.requestQueue.length >= this.batchSize || !this.processing) {
        this.processQueue();
      } else {
        // 设置超时，即使未达到批次大小也处理请求
        setTimeout(() => {
          if (this.requestQueue.length > 0 && !this.processing) {
            this.processQueue();
          }
        }, this.batchTimeout);
      }
    });
  }

  /**
   * 处理请求队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;
    const batch = this.requestQueue.splice(0, this.batchSize);

    try {
      // 并行处理批次中的请求
      const results = await Promise.allSettled(
        batch.map(async (request) => {
          try {
            // 根据频道动态调用对应的处理器
            const result = await ipcMain.invoke(request.channel as any, null, ...request.args);
            return { success: true, result };
          } catch (error) {
            return { success: false, error: (error as Error).message };
          }
        })
      );

      // 解析每个请求的结果
      results.forEach((result, index) => {
        const request = batch[index];
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            request.resolve(result.value.result);
          } else {
            request.reject(new Error(result.value.error));
          }
        } else {
          request.reject(result.reason);
        }
      });
    } catch (error) {
      // 如果整个批次处理失败，拒绝所有请求
      batch.forEach(request => {
        request.reject(error);
      });
    } finally {
      this.processing = false;
      // 处理剩余的请求
      if (this.requestQueue.length > 0) {
        setTimeout(() => this.processQueue(), 0);
      }
    }
  }

  /**
   * 处理批量请求
   */
  private async processBatchRequest(
    event: IpcMainInvokeEvent,
    requests: Array<{ channel: string; args: any[] }>
  ): Promise<Array<{ success: boolean; result?: any; error?: string }>> {
    const results = await Promise.all(
      requests.map(async (request) => {
        try {
          const result = await ipcMain.invoke(request.channel as any, event, ...request.args);
          return { success: true, result };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      })
    );

    return results;
  }

  /**
   * 立即处理队列中的所有请求
   */
  public flushQueue(): Promise<void> {
    return new Promise((resolve) => {
      if (this.requestQueue.length === 0) {
        resolve();
        return;
      }

      // 等待当前处理完成，然后处理剩余请求
      const checkAndResolve = () => {
        if (!this.processing) {
          this.processQueue();
          resolve();
        } else {
          setTimeout(checkAndResolve, 10);
        }
      };

      checkAndResolve();
    });
  }
}