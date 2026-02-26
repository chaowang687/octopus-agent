/**
 * 服务插件适配器
 * 将现有服务系统接入插件系统
 */

import { PluginInterface, ServiceMethod, ServicePlugin } from '../PluginInterface'

export class ServicePluginAdapter implements ServiceInterface {
  id: string
  name: string
  version: string
  description: string
  author: string
  enabled: boolean = true
  category: 'service' = 'service'
  serviceName: string
  serviceMethods: ServiceMethod[] = []
  private serviceInstance: any = null

  constructor(options: {
    id: string
    name: string
    version: string
    description: string
    author: string
    serviceName: string
    serviceMethods?: ServiceMethod[]
    serviceInstance?: any
  }) {
    this.id = options.id
    this.name = options.name
    this.version = options.version
    this.description = options.description
    this.author = options.author
    this.serviceName = options.serviceName
    this.serviceMethods = options.serviceMethods || []
    this.serviceInstance = options.serviceInstance || null
  }

  async initialize(): Promise<void> {
    console.log(`[ServicePluginAdapter] Initialized: ${this.name} (${this.serviceName})`)
  }

  async destroy(): Promise<void> {
    console.log(`[ServicePluginAdapter] Destroyed: ${this.name}`)
  }

  getService(): any {
    return this.serviceInstance
  }

  setService(instance: any): void {
    this.serviceInstance = instance
  }

  registerServiceMethods(methods: ServiceMethod[]): void {
    this.serviceMethods.push(...methods)
  }
}

interface ServiceInterface {
  id: string
  name: string
  version: string
  description: string
  author: string
  enabled: boolean
  category: 'service'
  serviceName: string
  serviceMethods: ServiceMethod[]
  initialize(): Promise<void>
  destroy(): Promise<void>
  getService(): any
}

export function createServicePlugin(
  id: string,
  name: string,
  version: string,
  description: string,
  author: string,
  serviceName: string,
  serviceInstance: any,
  methods: Array<{
    name: string
    description: string
    parameters: Record<string, any>
    returnType: string
  }>
): ServicePluginAdapter {
  const serviceMethods: ServiceMethod[] = methods.map(m => ({
    name: m.name,
    description: m.description,
    parameters: m.parameters,
    returnType: m.returnType
  }))

  return new ServicePluginAdapter({
    id,
    name,
    version,
    description,
    author,
    serviceName,
    serviceMethods,
    serviceInstance
  })
}
