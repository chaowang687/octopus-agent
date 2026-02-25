/**
 * Service Locator Pattern
 * 实现服务定位器以解耦模块依赖
 */

import { DependencyContainer } from './DependencyContainer';

export interface ServiceLocator {
  register<T>(name: string, service: T): void;
  resolve<T>(name: string): T;
  has(name: string): boolean;
  remove(name: string): void;
}

export class DefaultServiceLocator implements ServiceLocator {
  private container: DependencyContainer;

  constructor() {
    this.container = new DependencyContainer();
  }

  /**
   * Register a service
   */
  register<T>(name: string, service: T): void {
    this.container.register(name, service);
  }

  /**
   * Register a service factory
   */
  registerFactory<T>(name: string, factory: () => T): void {
    this.container.registerFactory(name, factory);
  }

  /**
   * Resolve a service
   */
  resolve<T>(name: string): T {
    return this.container.resolve(name);
  }

  /**
   * Check if a service exists
   */
  has(name: string): boolean {
    return this.container.has(name);
  }

  /**
   * Remove a service
   */
  remove(name: string): void {
    this.container.remove(name);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.container.clear();
  }

  /**
   * Get all service names
   */
  getServiceNames(): string[] {
    return this.container.getServiceNames();
  }
}

// 全局服务定位器实例
export const serviceLocator = new DefaultServiceLocator();