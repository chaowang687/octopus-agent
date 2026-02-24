import { ToolDefinition, toolRegistry } from '../ToolRegistry'
import { LLMService } from '../../services/LLMService'

const llmService = new LLMService()

// 市场调研智能体
const marketResearchTool: ToolDefinition = {
  name: 'market_research',
  description: '市场调研专家：爬取竞品信息、分析用户评论、生成SWOT分析',
  parameters: [
    { name: 'product', type: 'string', description: '产品方向关键词', required: false },
    { name: 'competitors', type: 'array', description: '竞品列表', required: false }
  ],
  handler: async (args: any) => {
    const { product = '智能应用', competitors } = args
    
    const prompt = `作为市场调研专家，分析关于${product}的市场情况。
    ${competitors ? `竞品包括：${competitors.join(', ')}` : ''}
    请生成一份详细的市场分析报告，包括：
    1. 市场规模和增长趋势
    2. 用户痛点和需求
    3. 竞品分析（优势、劣势）
    4. SWOT分析
    5. 市场机会和挑战`
    
    const response = await llmService.chat('qwen3', [
      { role: 'system', content: '你是一位资深的市场调研专家，擅长分析市场趋势和用户需求' },
      { role: 'user', content: prompt }
    ], {})
    
    return response.success ? response.content : '市场调研失败'
  }
}

// 产品经理助理
const productManagerTool: ToolDefinition = {
  name: 'product_manager',
  description: '产品经理助理：根据调研生成PRD、用户故事、验收标准',
  parameters: [
    { name: 'marketAnalysis', type: 'string', description: '市场分析报告', required: false },
    { name: 'features', type: 'array', description: '核心功能列表', required: false }
  ],
  handler: async (args: any) => {
    const { marketAnalysis = '根据一般市场调研', features } = args
    
    const prompt = `作为产品经理助理，根据以下市场分析报告生成PRD文档：
    ${marketAnalysis}
    ${features ? `核心功能：${features.join(', ')}` : ''}
    请生成：
    1. 产品定位和目标
    2. 用户故事
    3. 功能需求
    4. 非功能需求
    5. 验收标准`
    
    const response = await llmService.chat('qwen3', [
      { role: 'system', content: '你是一位资深的产品经理，擅长撰写PRD文档' },
      { role: 'user', content: prompt }
    ], {})
    
    return response.success ? response.content : 'PRD生成失败'
  }
}

// UI设计助理
const uiDesignerTool: ToolDefinition = {
  name: 'ui_designer',
  description: 'UI设计助理：根据PRD生成线框图、组件库建议、设计稿',
  parameters: [
    { name: 'prd', type: 'string', description: 'PRD文档', required: false },
    { name: 'style', type: 'string', description: '设计风格', required: false }
  ],
  handler: async (args: any) => {
    const { prd = '根据一般PRD文档', style } = args
    
    const prompt = `作为UI设计助理，根据以下PRD生成设计方案：
    ${prd}
    ${style ? `设计风格：${style}` : ''}
    请生成：
    1. 线框图设计
    2. 组件库建议
    3. 配色方案
    4. 交互设计原则`
    
    const response = await llmService.chat('qwen3', [
      { role: 'system', content: '你是一位资深的UI设计师，擅长创建美观实用的界面设计' },
      { role: 'user', content: prompt }
    ], {})
    
    return response.success ? response.content : '设计方案生成失败'
  }
}

// 开发助理
const developerTool: ToolDefinition = {
  name: 'developer',
  description: '开发助理：生成代码框架、API文档、数据库设计',
  parameters: [
    { name: 'prd', type: 'string', description: 'PRD文档', required: false },
    { name: 'techStack', type: 'string', description: '技术栈', required: false }
  ],
  handler: async (args: any) => {
    const { prd = '根据一般PRD文档', techStack } = args
    
    const prompt = `作为开发助理，根据以下PRD生成开发方案：
    ${prd}
    ${techStack ? `技术栈：${techStack}` : ''}
    请生成：
    1. 代码框架
    2. API文档
    3. 数据库设计
    4. 部署建议`
    
    const response = await llmService.chat('qwen3', [
      { role: 'system', content: '你是一位资深的全栈开发工程师，擅长设计高效的技术架构' },
      { role: 'user', content: prompt }
    ], {})
    
    return response.success ? response.content : '开发方案生成失败'
  }
}

// QA工程师
const qaTesterTool: ToolDefinition = {
  name: 'qa_tester',
  description: 'QA工程师：生成测试用例、执行自动化测试、报告Bug',
  parameters: [
    { name: 'prd', type: 'string', description: 'PRD文档', required: false },
    { name: 'code', type: 'string', description: '代码实现', required: false }
  ],
  handler: async (args: any) => {
    const { prd = '根据一般PRD文档', code } = args
    
    const prompt = `作为QA工程师，根据以下PRD和代码生成测试方案：
    ${prd}
    ${code ? `代码：${code}` : ''}
    请生成：
    1. 测试用例
    2. 自动化测试脚本
    3. 性能测试方案
    4. Bug报告模板`
    
    const response = await llmService.chat('qwen3', [
      { role: 'system', content: '你是一位资深的QA工程师，擅长设计全面的测试方案' },
      { role: 'user', content: prompt }
    ], {})
    
    return response.success ? response.content : '测试方案生成失败'
  }
}

// 注册所有工作流工具
export const registerWorkflowTools = () => {
  toolRegistry.register(marketResearchTool)
  toolRegistry.register(productManagerTool)
  toolRegistry.register(uiDesignerTool)
  toolRegistry.register(developerTool)
  toolRegistry.register(qaTesterTool)
}

export const workflowTools = [
  marketResearchTool,
  productManagerTool,
  uiDesignerTool,
  developerTool,
  qaTesterTool
]