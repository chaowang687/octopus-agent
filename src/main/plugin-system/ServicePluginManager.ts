/**
 * 服务插件管理器
 * 负责管理所有服务插件的注册和调用
 */

import { EventEmitter } from 'events'
import { ServicePlugin, ServiceMethod } from './PluginInterface'

export class ServicePluginManager extends EventEmitter {
  private services: Map<string, ServicePlugin> = new Map()
  private serviceInstances: Map<string, any> = new Map()

  constructor() {
    super()
  }

  async registerService(service: ServicePlugin): Promise<void> {
    await service.initialize()
    
    this.services.set(service.id, service)
    
    if (service.getService) {
      this.serviceInstances.set(service.serviceName, service.getService())
    }
    
    console.log(`[ServicePluginManager] Registered service plugin: ${service.name} (${service.serviceName})`)
    this.emit('service_registered', { pluginId: service.id, serviceName: service.serviceName })
  }

  async unregisterService(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId)
    if (service) {
      await service.destroy()
      
      this.serviceInstances.delete(service.serviceName)
      this.services.delete(serviceId)
      
      console.log(`[ServicePluginManager] Unregistered service plugin: ${serviceId}`)
      this.emit('service_unregistered', { pluginId: serviceId })
    }
  }

  getService(serviceName: string): any {
    return this.serviceInstances.get(serviceName)
  }

  callServiceMethod(serviceName: string, methodName: string, ...args: any[]): Promise<any> {
    const service = this.serviceInstances.get(serviceName)
    if (!service) {
      throw new Error(`Service ${serviceName} not found`)
    }

    const method = service[methodName]
    if (!method || typeof method !== 'function') {
      throw new Error(`Method ${methodName} not found on service ${serviceName}`)
    }

    try {
      const result = method.apply(service, args)
      this.emit('service_called', { serviceName, methodName, args })
      
      if (result && typeof result.then === 'function') {
        return result.then((res: any) => {
          this.emit('service_result', { serviceName, methodName, success: true })
          return res
        }).catch((error: any) => {
          this.emit('service_error', { serviceName, methodName, error: error.message })
          throw error
        })
      }
      
      return Promise.resolve(result)
    } catch (error: any) {
      this.emit('service_error', { serviceName, methodName, error: error.message })
      throw error
    }
  }

  getServiceMethods(serviceName: string): ServiceMethod[] {
    const service = this.services.get(serviceName)
    return service?.serviceMethods || []
  }

  getAllServices(): ServicePlugin[] {
    return Array.from(this.services.values())
  }

  getAllServiceNames(): string[] {
    return Array.from(this.serviceInstances.keys())
  }

  hasService(serviceName: string): boolean {
    return this.serviceInstances.has(serviceName)
  }

  getServiceCount(): number {
    return this.services.size
  }
}

export const servicePluginManager = new ServicePluginManager()
