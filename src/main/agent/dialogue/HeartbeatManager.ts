export class HeartbeatManager {
  private heartbeats: Map<string, number> = new Map()
  private timeouts: Map<string, NodeJS.Timeout> = new Map()
  private timeoutMs: number
  private emitCallback: (agentId: string, inactiveTime: number) => void
  
  constructor(timeoutMs: number, emitCallback: (agentId: string, inactiveTime: number) => void) {
    this.timeoutMs = timeoutMs
    this.emitCallback = emitCallback
  }
  
  update(agentId: string): void {
    if (this.timeouts.has(agentId)) {
      clearTimeout(this.timeouts.get(agentId)!)
      this.timeouts.delete(agentId)
    }
    
    this.heartbeats.set(agentId, Date.now())
    
    const timeout = setTimeout(() => {
      this.checkTimeout(agentId)
    }, this.timeoutMs)
    this.timeouts.set(agentId, timeout)
  }
  
  private checkTimeout(agentId: string): void {
    const now = Date.now()
    const lastHeartbeat = this.heartbeats.get(agentId)
    
    if (lastHeartbeat) {
      const inactiveTime = now - lastHeartbeat
      if (inactiveTime > this.timeoutMs) {
        this.emitCallback(agentId, inactiveTime)
        this.heartbeats.delete(agentId)
      }
    }
    
    this.timeouts.delete(agentId)
  }
  
  remove(agentId: string): void {
    if (this.timeouts.has(agentId)) {
      clearTimeout(this.timeouts.get(agentId)!)
      this.timeouts.delete(agentId)
    }
    this.heartbeats.delete(agentId)
  }
  
  clear(): void {
    this.timeouts.forEach(timeout => clearTimeout(timeout))
    this.timeouts.clear()
    this.heartbeats.clear()
  }
  
  getLastHeartbeat(agentId: string): number | undefined {
    return this.heartbeats.get(agentId)
  }
  
  getActiveAgents(): string[] {
    return Array.from(this.heartbeats.keys())
  }
}
