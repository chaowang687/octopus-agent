/**
 * Dependency Injection Container
 * 依赖注入容器 - 实现服务解耦
 */

import { EventEmitter } from 'events'

export interface ServiceDescriptor {
  name: string
  instance: any
  factory?: () => any
  singleton: boolean
}

export class DependencyInjectionContainer extends EventEmitter {
  private services: Map<string, ServiceDescriptor> = new Map()
  private singletons: Map<string, any> = new Map()

  /**
   * 注册服务
   */
  register(name: string, factory: () => any, singleton: boolean = true): void {
    this.services.set(name, {
      name,
      factory,
      singleton
    })
  }

  /**
   * 注册实例
   */
  registerInstance(name: string, instance: any): void {
    this.services.set(name, {
      name,
      instance,
      singleton: true
    })
    this.singletons.set(name, instance)
  }

  /**
   * 获取服务
   */
  get<T = any>(name: string): T | undefined {
    const descriptor = this.services.get(name)
    if (!descriptor) {
      return undefined
    }

    if (descriptor.singleton) {
      if (!this.singletons.has(name)) {
        if (descriptor.factory) {
          const instance = descriptor.factory()
          this.singletons.set(name, instance)
        }
      }
      return this.singletons.get(name)
    }

    if (descriptor.factory) {
      return descriptor.factory()
    }

    return descriptor.instance
  }

  /**
   * 检查服务是否存在
   */
  has(name: string): boolean {
    return this.services.has(name)
  }

  /**
   * 移除服务
   */
  unregister(name: string): boolean {
    this.singletons.delete(name)
    return this.services.delete(name)
  }

  /**
   * 清空所有服务
   */
  clear(): void {
    this.services.clear()
    this.singletons.clear()
  }

  /**
   * 获取所有服务名称
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys())
  }
}

// 全局容器实例
export const container = new DependencyInjectionContainer()

// 便捷装饰器
export function Injectable(target: any): any {
  return target
}

export function Inject(serviceName: string) {
  return function (target: any, propertyKey: string) {
    Object.defineProperty(target, propertyKey, {
      get: () => container.get(serviceName)
    })
  }
}