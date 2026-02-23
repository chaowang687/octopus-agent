export interface SecurityConfig {
  enableSandbox: boolean
  enableWebSecurity: boolean
  allowedPaths: string[]
  blockedCommands: string[]
  codeExecutionTimeout: number
  maxMemoryMB: number
}

export const defaultSecurityConfig: SecurityConfig = {
  enableSandbox: true,
  enableWebSecurity: true,
  allowedPaths: [],
  blockedCommands: [
    'rm -rf /',
    'sudo',
    'chmod 777',
    'mkfs',
    'dd if=',
    '> /dev/sda',
    'curl | bash',
    'wget | bash'
  ],
  codeExecutionTimeout: 30000,
  maxMemoryMB: 256
}

export class SecurityManager {
  private config: SecurityConfig
  private userAuthorizedPaths: Set<string> = new Set()
  
  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...defaultSecurityConfig, ...config }
  }
  
  addAuthorizedPath(path: string): void {
    this.userAuthorizedPaths.add(path)
  }
  
  removeAuthorizedPath(path: string): void {
    this.userAuthorizedPaths.delete(path)
  }
  
  isPathAllowed(filePath: string): boolean {
    const resolved = this.resolvePath(filePath)
    
    const allowedPaths = [
      ...this.config.allowedPaths,
      ...Array.from(this.userAuthorizedPaths)
    ]
    
    if (allowedPaths.length === 0) {
      return true
    }
    
    return allowedPaths.some(allowed => {
      const resolvedAllowed = this.resolvePath(allowed)
      return resolved.startsWith(resolvedAllowed)
    })
  }
  
  isCommandAllowed(command: string): boolean {
    const normalizedCmd = command.toLowerCase().trim()
    
    for (const blocked of this.config.blockedCommands) {
      if (normalizedCmd.includes(blocked.toLowerCase())) {
        console.warn(`[SecurityManager] 阻止危险命令: ${command}`)
        return false
      }
    }
    
    return true
  }
  
  private resolvePath(p: string): string {
    try {
      return path.resolve(p)
    } catch {
      return p
    }
  }
  
  getConfig(): SecurityConfig {
    return { ...this.config }
  }
  
  updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates }
  }
}

import * as path from 'path'

export const securityManager = new SecurityManager()
