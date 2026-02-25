/**
 * Simple Dependency Injection Container
 * 实现依赖注入以解耦模块依赖
 */

export type Factory<T> = () => T;

export class DependencyContainer {
  private services: Map<string, any> = new Map();
  private factories: Map<string, Factory<any>> = new Map();

  /**
   * Register a service instance
   */
  register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  /**
   * Register a service factory
   */
  registerFactory<T>(name: string, factory: Factory<T>): void {
    this.factories.set(name, factory);
  }

  /**
   * Resolve a service
   */
  resolve<T>(name: string): T {
    // Check if instance exists
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    // Check if factory exists
    if (this.factories.has(name)) {
      const factory = this.factories.get(name);
      if (factory) {
        const instance = factory();
        this.services.set(name, instance); // Cache the instance
        return instance as T;
      }
    }

    throw new Error(`Service ${name} not found`);
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }

  /**
   * Remove a service
   */
  remove(name: string): void {
    this.services.delete(name);
    this.factories.delete(name);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(new Set([...this.services.keys(), ...this.factories.keys()]));
  }
}