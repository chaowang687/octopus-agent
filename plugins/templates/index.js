/**
 * 插件模板
 * 所有插件必须实现 PluginInterface 接口
 */

class PluginTemplate {
  id = 'plugin-template'
  name = 'Plugin Template'
  version = '1.0.0'
  description = 'A template for creating plugins'
  author = 'Your Name'
  enabled = false

  async initialize() {
    console.log(`[PluginTemplate] Initializing plugin: ${this.name}`)
    this.enabled = true
  }

  async destroy() {
    console.log(`[PluginTemplate] Destroying plugin: ${this.name}`)
    this.enabled = false
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.name,
      capabilities: [],
      version: this.version
    }
  }
}

module.exports = PluginTemplate
module.exports.default = PluginTemplate
