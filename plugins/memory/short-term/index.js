/**
 * 短期记忆插件
 * 提供当前会话的短期记忆存储
 */

class ShortTermMemoryPlugin {
  id = 'memory-short'
  name = 'Short-Term Memory'
  version = '1.0.0'
  description = 'Short-term memory storage for current session context'
  author = 'Octopus Agent'
  enabled = false
  category = 'memory'
  memoryType = 'short'

  private storage = new Map()
  private maxSize = 100
  private ttl = 3600000 // 1 hour

  async initialize() {
    console.log(`[ShortTermMemoryPlugin] Initializing...`)
    this.enabled = true
    this.startCleanupTimer()
  }

  async destroy() {
    console.log(`[ShortTermMemoryPlugin] Destroying...`)
    this.enabled = false
    this.storage.clear()
  }

  async store(key, value, metadata = {}) {
    if (this.storage.size >= this.maxSize) {
      this.evictOldest()
    }

    this.storage.set(key, {
      value,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.ttl,
      metadata
    })

    return { success: true, key }
  }

  async retrieve(key) {
    const entry = this.storage.get(key)
    
    if (!entry) {
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.storage.delete(key)
      return undefined
    }

    return entry.value
  }

  async query(queryParams) {
    let results = []

    for (const [key, entry] of this.storage.entries()) {
      if (Date.now() > entry.expiresAt) {
        this.storage.delete(key)
        continue
      }

      if (queryParams.keywords && queryParams.keywords.length > 0) {
        const valueStr = JSON.stringify(entry.value).toLowerCase()
        const hasKeyword = queryParams.keywords.some(kw => 
          valueStr.includes(kw.toLowerCase()) || 
          key.toLowerCase().includes(kw.toLowerCase())
        )
        if (!hasKeyword) continue
      }

      if (queryParams.since && entry.timestamp < queryParams.since) {
        continue
      }

      results.push({
        key,
        value: entry.value,
        timestamp: entry.timestamp,
        metadata: entry.metadata
      })
    }

    results.sort((a, b) => b.timestamp - a.timestamp)
    return results.slice(0, queryParams.limit || 100)
  }

  async clear() {
    this.storage.clear()
    return { success: true, message: 'Short-term memory cleared' }
  }

  private evictOldest() {
    let oldestKey = null
    let oldestTime = Infinity

    for (const [key, entry] of this.storage.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.storage.delete(oldestKey)
    }
  }

  private startCleanupTimer() {
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.storage.entries()) {
        if (now > entry.expiresAt) {
          this.storage.delete(key)
        }
      }
    }, 60000) // Clean every minute
  }

  getStats() {
    return {
      type: 'short',
      size: this.storage.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    }
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.name,
      capabilities: [{
        name: 'short-term-memory',
        description: 'Short-term memory storage with TTL',
        parameters: {
          maxSize: this.maxSize,
          ttl: this.ttl
        }
      }],
      version: this.version
    }
  }
}

module.exports = ShortTermMemoryPlugin
module.exports.default = ShortTermMemoryPlugin
