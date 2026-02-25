/**
 * Humanized Mouse
 * 实现人性化的鼠标操作
 */

export interface MouseMoveOptions {
  duration?: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';
  randomOffset?: number;
  randomDelay?: number;
}

export interface MouseClickOptions {
  button?: 'left' | 'right' | 'middle';
  doubleClick?: boolean;
  delay?: number;
  randomDelay?: number;
  randomOffset?: number;
}

export class HumanizedMouse {
  private automationService: any;

  constructor(automationService: any) {
    this.automationService = automationService;
  }

  /**
   * 人性化鼠标移动
   */
  async moveMouse(
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number, 
    options: MouseMoveOptions = {}
  ): Promise<void> {
    const duration = options.duration || 0.5;
    const easing = options.easing || 'ease-out';
    const randomOffset = options.randomOffset || 3;
    const randomDelay = options.randomDelay || 50;

    // 添加随机偏移
    const targetX = endX + (Math.random() - 0.5) * randomOffset;
    const targetY = endY + (Math.random() - 0.5) * randomOffset;

    const steps = Math.max(1, Math.floor(duration * 60)); // 60fps
    
    for (let step = 0; step <= steps; step++) {
      const progress = step / steps;
      const easedProgress = this.ease(progress, easing);
      
      const currentX = startX + (targetX - startX) * easedProgress;
      const currentY = startY + (targetY - startY) * easedProgress;
      
      // 实际移动鼠标
      await this.automationService.moveMouse(currentX, currentY);
      
      await new Promise(resolve => setTimeout(resolve, 1000 / 60)); // ~60fps
    }

    // 添加随机延迟
    if (randomDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * randomDelay));
    }
  }

  /**
   * 人性化点击
   */
  async clickAt(x: number, y: number, options: MouseClickOptions = {}): Promise<void> {
    const button = options.button || 'left';
    const doubleClick = options.doubleClick || false;
    const delay = options.delay || 0;
    const randomDelay = options.randomDelay || 50;
    const randomOffset = options.randomOffset || 3;

    // 添加随机偏移
    const targetX = x + (Math.random() - 0.5) * randomOffset;
    const targetY = y + (Math.random() - 0.5) * randomOffset;

    // 添加随机延迟
    if (randomDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * randomDelay));
    }

    // 移动到目标位置
    await this.automationService.moveMouse(targetX, targetY);

    // 点击
    if (doubleClick) {
      await this.automationService.doubleClick(button);
    } else {
      await this.automationService.click(button);
    }

    // 添加延迟
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * 缓动函数
   */
  private ease(progress: number, type: string): number {
    switch (type) {
      case 'ease-in':
        return Math.pow(progress, 3);
      case 'ease-out':
        return 1 - Math.pow(1 - progress, 3);
      case 'ease-in-out':
        return progress < 0.5 
          ? 4 * Math.pow(progress, 3) 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      case 'bezier':
        // 使用贝塞尔曲线
        return this.bezierEase(progress);
      default:
        return progress;
    }
  }

  /**
   * 贝塞尔缓动
   */
  private bezierEase(t: number): number {
    // 简化的贝塞尔曲线
    const p0 = 0;
    const p1 = 0.2;
    const p2 = 0.8;
    const p3 = 1;

    const t2 = t * t;
    const t3 = t2 * t;
    
    return p0 * (1 - t) * (1 - t) * (1 - t) +
           p1 * 3 * t * (1 - t) * (1 - t) +
           p2 * 3 * t2 * (1 - t) +
           p3 * t3;
  }

  /**
   * 滚轮滚动
   */
  async scroll(direction: 'up' | 'down', amount: number): Promise<void> {
    // 简化实现
    await this.automationService.scroll(direction, amount);
  }
}