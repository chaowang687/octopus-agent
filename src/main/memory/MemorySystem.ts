import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

export enum MemoryScope {
  GLOBAL = 'global',
  PROJECT = 'project',
  SESSION = 'session'
}

export enum MemoryType {
  PREFERENCE = 'preference',
  COMMAND = 'command',
  ARCHITECTURE = 'architecture',
  DEBUG = 'debug',
  PATTERN = 'pattern',
  KNOWLEDGE = 'knowledge'
}

export interface Memory {
  id: string
  scope: MemoryScope
  type: MemoryType
  key: string
  value: any
  metadata?: {
    projectId?: string
    agentId?: string
    timestamp: number
    accessCount: number
    lastAccessed: number
    tags?: string[]
    confidence?: number
  }
}

export interface MemoryQuery {
  scope?: MemoryScope
  type?: MemoryType
  key?: string
  projectId?: string
  agentId?: string
  tags?: string[]
  limit?: number
}

export class MemorySystem {
  private memories: Map<string, Memory> = new Map()
  private memoryIndexPath: string
  private memoryDataPath: string

  constructor(basePath?: string) {
    const baseDir = basePath || path.join(process.cwd(), '.agent-memory')
    this.memoryIndexPath = path.join(baseDir, 'index.json')
    this.memoryDataPath = path.join(baseDir, 'data')
    
    this.initialize()
  }

  private initialize(): void {
    try {
      if (!fs.existsSync(this.memoryDataPath)) {
        fs.mkdirSync(this.memoryDataPath, { recursive: true })
      }
      this.loadMemories()
      console.log('[MemorySystem] 记忆系统初始化成功')
    } catch (error) {
      console.error('[MemorySystem] 记忆系统初始化失败:', error)
    }
  }

  private loadMemories(): void {
    try {
      if (fs.existsSync(this.memoryIndexPath)) {
        const content = fs.readFileSync(this.memoryIndexPath, 'utf-8')
        const data = JSON.parse(content)
        
        for (const memory of data.memories || []) {
          this.memories.set(memory.id, memory)
        }
        
        console.log(`[MemorySystem] 加载了 ${this.memories.size} 条记忆`)
      }
    } catch (error) {
      console.error('[MemorySystem] 加载记忆失败:', error)
    }
  }

  private saveMemories(): void {
    try {
      const data = {
        version: '1.0',
        memories: Array.from(this.memories.values()),
        lastUpdated: Date.now()
      }
      fs.writeFileSync(this.memoryIndexPath, JSON.stringify(data, null, 2))
      console.log('[MemorySystem] 保存记忆成功')
    } catch (error) {
      console.error('[MemorySystem] 保存记忆失败:', error)
    }
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex')
  }

  set(scope: MemoryScope, type: MemoryType, key: string, value: any, metadata?: Partial<Memory['metadata']>): string {
    const id = this.generateId()
    const memory: Memory = {
      id,
      scope,
      type,
      key,
      value,
      metadata: {
        timestamp: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
        ...metadata
      }
    }

    this.memories.set(id, memory)
    this.saveMemories()
    console.log(`[MemorySystem] 设置记忆: ${scope}/${type}/${key}`)
    return id
  }

  get(id: string): Memory | undefined {
    const memory = this.memories.get(id)
    if (memory) {
      memory.metadata!.accessCount++
      memory.metadata!.lastAccessed = Date.now()
      this.saveMemories()
    }
    return memory
  }

  query(query: MemoryQuery): Memory[] {
    let results = Array.from(this.memories.values())

    if (query.scope) {
      results = results.filter(m => m.scope === query.scope)
    }

    if (query.type) {
      results = results.filter(m => m.type === query.type)
    }

    if (query.key) {
      results = results.filter(m => m.key.includes(query.key!))
    }

    if (query.projectId) {
      results = results.filter(m => m.metadata?.projectId === query.projectId)
    }

    if (query.agentId) {
      results = results.filter(m => m.metadata?.agentId === query.agentId)
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(m =>
        query.tags!.some(tag => m.metadata?.tags?.includes(tag))
      )
    }

    results.sort((a, b) => {
      const aScore = a.metadata!.accessCount * 0.5 + 
                    (Date.now() - a.metadata!.lastAccessed) * -0.0001
      const bScore = b.metadata!.accessCount * 0.5 + 
                    (Date.now() - b.metadata!.lastAccessed) * -0.0001
      return bScore - aScore
    })

    if (query.limit) {
      results = results.slice(0, query.limit)
    }

    return results
  }

  update(id: string, updates: Partial<Memory>): boolean {
    const memory = this.memories.get(id)
    if (!memory) return false

    const updated = { ...memory, ...updates }
    this.memories.set(id, updated)
    this.saveMemories()
    console.log(`[MemorySystem] 更新记忆: ${id}`)
    return true
  }

  delete(id: string): boolean {
    const deleted = this.memories.delete(id)
    if (deleted) {
      this.saveMemories()
      console.log(`[MemorySystem] 删除记忆: ${id}`)
    }
    return deleted
  }

  clear(scope?: MemoryScope, projectId?: string): number {
    let count = 0
    const toDelete: string[] = []

    for (const [id, memory] of this.memories) {
      if (scope && memory.scope !== scope) continue
      if (projectId && memory.metadata?.projectId !== projectId) continue
      toDelete.push(id)
    }

    for (const id of toDelete) {
      this.memories.delete(id)
      count++
    }

    if (count > 0) {
      this.saveMemories()
      console.log(`[MemorySystem] 清理了 ${count} 条记忆`)
    }

    return count
  }

  setPreference(key: string, value: any): string {
    return this.set(MemoryScope.GLOBAL, MemoryType.PREFERENCE, key, value)
  }

  getPreference(key: string): any {
    const results = this.query({
      scope: MemoryScope.GLOBAL,
      type: MemoryType.PREFERENCE,
      key,
      limit: 1
    })
    return results.length > 0 ? results[0].value : undefined
  }

  setCommand(projectId: string, command: string, description: string): string {
    return this.set(
      MemoryScope.PROJECT,
      MemoryType.COMMAND,
      command,
      { description },
      { projectId }
    )
  }

  getCommands(projectId: string, limit: number = 10): Array<{ command: string; description: string }> {
    const results = this.query({
      scope: MemoryScope.PROJECT,
      type: MemoryType.COMMAND,
      projectId,
      limit
    })
    return results.map(m => ({
      command: m.key,
      description: m.value.description
    }))
  }

  setArchitecture(projectId: string, name: string, description: string): string {
    return this.set(
      MemoryScope.PROJECT,
      MemoryType.ARCHITECTURE,
      name,
      { description },
      { projectId }
    )
  }

  getArchitecture(projectId: string): Array<{ name: string; description: string }> {
    const results = this.query({
      scope: MemoryScope.PROJECT,
      type: MemoryType.ARCHITECTURE,
      projectId
    })
    return results.map(m => ({
      name: m.key,
      description: m.value.description
    }))
  }

  setDebug(projectId: string, issue: string, solution: string): string {
    return this.set(
      MemoryScope.PROJECT,
      MemoryType.DEBUG,
      issue,
      { solution },
      { projectId }
    )
  }

  getDebug(projectId: string, issue?: string): Array<{ issue: string; solution: string }> {
    const results = this.query({
      scope: MemoryScope.PROJECT,
      type: MemoryType.DEBUG,
      projectId,
      key: issue
    })
    return results.map(m => ({
      issue: m.key,
      solution: m.value.solution
    }))
  }

  setPattern(projectId: string, name: string, description: string, code?: string): string {
    return this.set(
      MemoryScope.PROJECT,
      MemoryType.PATTERN,
      name,
      { description, code },
      { projectId }
    )
  }

  getPatterns(projectId: string): Array<{ name: string; description: string; code?: string }> {
    const results = this.query({
      scope: MemoryScope.PROJECT,
      type: MemoryType.PATTERN,
      projectId
    })
    return results.map(m => ({
      name: m.key,
      description: m.value.description,
      code: m.value.code
    }))
  }

  setKnowledge(agentId: string, topic: string, content: string, confidence: number = 0.8): string {
    return this.set(
      MemoryScope.GLOBAL,
      MemoryType.KNOWLEDGE,
      topic,
      { content },
      { agentId, confidence }
    )
  }

  getKnowledge(agentId: string, topic?: string): Array<{ topic: string; content: string; confidence: number }> {
    const results = this.query({
      scope: MemoryScope.GLOBAL,
      type: MemoryType.KNOWLEDGE,
      agentId,
      key: topic
    })
    return results.map(m => ({
      topic: m.key,
      content: m.value.content,
      confidence: m.metadata!.confidence || 0.5
    }))
  }

  exportMemories(query?: MemoryQuery): string {
    const memories = query ? this.query(query) : Array.from(this.memories.values())
    return JSON.stringify(memories, null, 2)
  }

  importMemories(json: string): number {
    try {
      const memories = JSON.parse(json) as Memory[]
      let count = 0
      for (const memory of memories) {
        this.memories.set(memory.id, memory)
        count++
      }
      this.saveMemories()
      console.log(`[MemorySystem] 导入了 ${count} 条记忆`)
      return count
    } catch (error) {
      console.error('[MemorySystem] 导入记忆失败:', error)
      return 0
    }
  }

  getStatistics(): {
    total: number
    byScope: Record<MemoryScope, number>
    byType: Record<MemoryType, number>
    mostAccessed: Memory[]
  } {
    const byScope: Record<MemoryScope, number> = {
      [MemoryScope.GLOBAL]: 0,
      [MemoryScope.PROJECT]: 0,
      [MemoryScope.SESSION]: 0
    }
    const byType: Record<MemoryType, number> = {
      [MemoryType.PREFERENCE]: 0,
      [MemoryType.COMMAND]: 0,
      [MemoryType.ARCHITECTURE]: 0,
      [MemoryType.DEBUG]: 0,
      [MemoryType.PATTERN]: 0,
      [MemoryType.KNOWLEDGE]: 0
    }

    for (const memory of this.memories.values()) {
      byScope[memory.scope]++
      byType[memory.type]++
    }

    const mostAccessed = Array.from(this.memories.values())
      .sort((a, b) => b.metadata!.accessCount - a.metadata!.accessCount)
      .slice(0, 10)

    return {
      total: this.memories.size,
      byScope,
      byType,
      mostAccessed
    }
  }
}

export const memorySystem = new MemorySystem()
