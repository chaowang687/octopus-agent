import { ToolDefinition, toolRegistry } from '../ToolRegistry'
import { LLMService } from '../../services/LLMService'
import fs from 'fs'
import path from 'path'

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

// 架构师
const architectTool: ToolDefinition = {
  name: 'architect',
  description: '架构师：系统架构设计、技术选型、部署方案',
  parameters: [
    { name: 'prd', type: 'string', description: 'PRD文档', required: false },
    { name: 'requirements', type: 'string', description: '技术需求', required: false }
  ],
  handler: async (args: any) => {
    const { prd = '根据一般PRD文档', requirements } = args
    
    const prompt = `作为架构师，根据以下PRD生成系统架构设计：
    ${prd}
    ${requirements ? `技术需求：${requirements}` : ''}
    请生成：
    1. 系统架构图
    2. 技术选型建议
    3. 模块划分
    4. 数据库架构
    5. 部署方案
    6. 扩展性设计`
    
    const response = await llmService.chat('qwen3', [
      { role: 'system', content: '你是一位资深的系统架构师，擅长设计高可用、可扩展的系统架构' },
      { role: 'user', content: prompt }
    ], {})
    
    return response.success ? response.content : '架构设计生成失败'
  }
}

// 前端工程师
const frontendEngineerTool: ToolDefinition = {
  name: 'frontend_engineer',
  description: '前端工程师：UI组件开发、页面实现、交互逻辑',
  parameters: [
    { name: 'design', type: 'string', description: 'UI设计稿', required: false },
    { name: 'techStack', type: 'string', description: '前端技术栈', required: false }
  ],
  handler: async (args: any) => {
    const { design = '根据一般UI设计', techStack } = args
    
    const prompt = `作为前端工程师，根据以下设计稿生成前端实现方案：
    ${design}
    ${techStack ? `技术栈：${techStack}` : ''}
    请生成：
    1. 页面结构设计
    2. 组件设计
    3. 状态管理方案
    4. 路由设计
    5. 核心代码实现
    6. 性能优化建议`
    
    const response = await llmService.chat('qwen3', [
      { role: 'system', content: '你是一位资深的前端工程师，擅长创建优秀的用户界面和交互体验' },
      { role: 'user', content: prompt }
    ], {})
    
    return response.success ? response.content : '前端实现方案生成失败'
  }
}

// 后端工程师
const backendEngineerTool: ToolDefinition = {
  name: 'backend_engineer',
  description: '后端工程师：API开发、数据库设计、业务逻辑实现',
  parameters: [
    { name: 'architecture', type: 'string', description: '系统架构设计', required: false },
    { name: 'techStack', type: 'string', description: '后端技术栈', required: false }
  ],
  handler: async (args: any) => {
    const { architecture = '根据一般系统架构', techStack } = args
    
    const prompt = `作为后端工程师，根据以下架构设计生成后端实现方案：
    ${architecture}
    ${techStack ? `技术栈：${techStack}` : ''}
    请生成：
    1. API接口设计
    2. 数据库表结构
    3. 业务逻辑实现
    4. 中间件设计
    5. 核心代码示例
    6. 安全方案`
    
    const response = await llmService.chat('qwen3', [
      { role: 'system', content: '你是一位资深的后端工程师，擅长构建稳定高效的服务端系统' },
      { role: 'user', content: prompt }
    ], {})
    
    return response.success ? response.content : '后端实现方案生成失败'
  }
}

// 用户界面测试工程师
const uiTesterTool: ToolDefinition = {
  name: 'ui_tester',
  description: 'UI测试工程师：界面测试、交互测试、兼容性测试',
  parameters: [
    { name: 'design', type: 'string', description: 'UI设计稿', required: false },
    { name: 'uiCode', type: 'string', description: '前端代码', required: false }
  ],
  handler: async (args: any) => {
    const { design = '根据一般UI设计', uiCode } = args
    
    const prompt = `作为UI测试工程师，根据以下设计稿和代码生成UI测试方案：
    ${design}
    ${uiCode ? `前端代码：${uiCode}` : ''}
    请生成：
    1. 界面元素测试用例
    2. 交互流程测试用例
    3. 响应式布局测试
    4. 浏览器兼容性测试
    5. 视觉回归测试建议
    6. 可访问性测试清单`
    
    const response = await llmService.chat('qwen3', [
      { role: 'system', content: '你是一位资深的UI测试工程师，擅长发现界面和交互问题' },
      { role: 'user', content: prompt }
    ], {})
    
    return response.success ? response.content : 'UI测试方案生成失败'
  }
}

// 功能测试工程师
const functionalTesterTool: ToolDefinition = {
  name: 'functional_tester',
  description: '功能测试工程师：API测试、业务逻辑测试、集成测试',
  parameters: [
    { name: 'prd', type: 'string', description: 'PRD文档', required: false },
    { name: 'apiDocs', type: 'string', description: 'API文档', required: false }
  ],
  handler: async (args: any) => {
    const { prd = '根据一般PRD文档', apiDocs } = args
    
    const prompt = `作为功能测试工程师，根据以下PRD和API文档生成功能测试方案：
    ${prd}
    ${apiDocs ? `API文档：${apiDocs}` : ''}
    请生成：
    1. 功能测试用例（正常场景）
    2. 边界测试用例
    3. 异常测试用例
    4. API接口测试用例
    5. 集成测试用例
    6. 性能测试建议
    7. 安全测试清单`
    
    const response = await llmService.chat('qwen3', [
      { role: 'system', content: '你是一位资深的功能测试工程师，擅长设计全面的业务功能测试方案' },
      { role: 'user', content: prompt }
    ], {})
    
    return response.success ? response.content : '功能测试方案生成失败'
  }
}

// 框智能体（多端口专业文档生成器）
const boxNodeTool: ToolDefinition = {
  name: 'box_node',
  description: '框智能体：接收通用需求，智能生成UI设计师、架构师、前端工程师、后端工程师、测试工程师的五份专业文档',
  parameters: [
    { name: 'title', type: 'string', description: '容器标题', required: false },
    { name: 'processingRule', type: 'string', description: '内容物处理规则/指令', required: false },
    { name: 'inputFiles', type: 'array', description: '输入文件路径数组', required: false },
    { name: 'outputDir', type: 'string', description: '输出目录路径', required: false },
    { name: 'model', type: 'string', description: '使用的模型', required: false }
  ],
  handler: async (args: any) => {
    const { 
      title = '框智能体', 
      processingRule = '你是一个全栈产品技术专家，精通产品设计、UI/UX、系统架构、前后端开发、软件测试。请根据以下产品需求，分别生成给UI设计师、架构师、前端工程师、后端工程师、测试工程师的五份专业文档。', 
      inputFiles = [], 
      outputDir,
      model = 'qwen3'
    } = args
    
    let inputContents: string[] = []
    const generatedDocs: Record<string, string> = {}
    
    try {
      // 1. 读取所有输入文件
      for (const filePath of inputFiles) {
        if (filePath && fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8')
            inputContents.push(`=== 文件: ${path.basename(filePath)} ===\n${content}`)
          } catch (e) {
            console.error('读取文件失败:', filePath, e)
          }
        }
      }
      
      const inputText = inputContents.length > 0 ? inputContents.join('\n\n') : '请生成一份通用产品开发需求文档'
      const globalRulePrefix = `整体任务：${title}\n总体处理规则：${processingRule}\n\n`
      
      // 2. 定义各个角色的生成指令
      const rolePrompts = {
        uiDesigner: {
          name: 'UI设计师',
          system: '你是一位资深的UI/UX设计师，擅长创建美观、易用的界面设计',
          prompt: `${globalRulePrefix}请根据以下需求，生成UI设计师专用的设计文档：
${inputText}

请生成：
1. 产品定位与用户画像
2. 核心功能列表
3. 信息架构设计
4. 页面流程图
5. 关键页面线框图描述
6. 设计风格建议（配色、字体、图标等）
7. 交互设计原则
8. 响应式设计考虑
9. 可访问性设计要点`
        },
        architect: {
          name: '架构师',
          system: '你是一位资深的系统架构师，擅长设计高可用、可扩展的系统架构',
          prompt: `${globalRulePrefix}请根据以下需求，生成架构师专用的系统架构设计文档：
${inputText}

请生成：
1. 系统整体架构图（文字描述）
2. 技术选型建议（前端、后端、数据库、中间件等）
3. 模块划分与职责定义
4. 接口设计原则
5. 数据库表结构设计要点
6. 缓存策略
7. 消息队列使用场景
8. 部署架构
9. 扩展性设计
10. 安全考虑`
        },
        frontend: {
          name: '前端工程师',
          system: '你是一位资深的前端工程师，擅长创建优秀的用户界面和交互体验',
          prompt: `${globalRulePrefix}请根据以下需求，生成前端工程师专用的实现文档：
${inputText}

请生成：
1. 技术栈选型建议
2. 项目目录结构
3. 核心组件设计
4. 状态管理方案
5. 路由设计
6. API接口封装
7. 关键页面实现思路
8. 性能优化建议
9. 代码规范
10. 测试策略`
        },
        backend: {
          name: '后端工程师',
          system: '你是一位资深的后端工程师，擅长构建稳定高效的服务端系统',
          prompt: `${globalRulePrefix}请根据以下需求，生成后端工程师专用的实现文档：
${inputText}

请生成：
1. 技术栈选型建议
2. 项目目录结构
3. API接口设计（RESTful）
4. 数据库表结构设计
5. 核心业务逻辑实现思路
6. 中间件设计
7. 安全方案（认证、授权、加密等）
8. 异常处理策略
9. 日志设计
10. 测试策略`
        },
        qa: {
          name: '测试工程师',
          system: '你是一位资深的测试工程师，擅长设计全面的测试方案',
          prompt: `${globalRulePrefix}请根据以下需求，生成测试工程师专用的测试文档：
${inputText}

请生成：
1. 测试策略
2. 功能测试用例
3. 界面测试用例
4. 接口测试用例
5. 性能测试要点
6. 安全测试清单
7. 兼容性测试要点
8. 验收标准
9. 测试环境要求
10. 缺陷管理流程`
        }
      }
      
      // 3. 逐个生成各角色的文档
      const roles = Object.entries(rolePrompts)
      for (const [key, config] of roles) {
        console.log(`正在生成${config.name}文档...`)
        
        const response = await llmService.chat(model, [
          { role: 'system', content: config.system },
          { role: 'user', content: config.prompt }
        ], {})
        
        if (response.success && response.content) {
          generatedDocs[key] = response.content
          console.log(`${config.name}文档生成完成`)
        } else {
          generatedDocs[key] = `生成失败: ${response.error || '未知错误'}`
        }
      }
      
      // 4. 如果指定了输出目录，保存所有文档
      if (outputDir) {
        try {
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
          }
          
          for (const [key, content] of Object.entries(generatedDocs)) {
            const roleName = rolePrompts[key as keyof typeof rolePrompts].name
            const outputPath = path.join(outputDir, `${roleName}_${Date.now()}.md`)
            fs.writeFileSync(outputPath, content, 'utf-8')
            console.log(`已保存: ${outputPath}`)
          }
        } catch (e) {
          console.error('保存文件失败:', e)
        }
      }
      
      // 5. 返回结果
      return {
        success: true,
        message: `${title}处理完成`,
        uiDoc: generatedDocs.uiDesigner,
        architectDoc: generatedDocs.architect,
        frontendDoc: generatedDocs.frontend,
        backendDoc: generatedDocs.backend,
        qaDoc: generatedDocs.qa
      }
      
    } catch (error: any) {
      console.error('框智能体处理失败:', error)
      return {
        success: false,
        message: `框智能体处理失败: ${error.message}`,
        error: error.message
      }
    }
  }
}

// Prompt节点工具
const promptNodeTool: ToolDefinition = {
  name: 'prompt_node',
  description: 'Prompt节点：处理文本输入，调用大模型生成输出',
  parameters: [
    { name: 'input', type: 'string', description: '输入文本', required: false },
    { name: 'model', type: 'string', description: '使用的模型', required: false },
    { name: 'systemPrompt', type: 'string', description: '系统提示词', required: false }
  ],
  handler: async (args: any) => {
    const { 
      input = '', 
      model = 'qwen3',
      systemPrompt = '你是一个专业的AI助手，擅长回答各种问题并提供帮助'
    } = args
    
    try {
      console.log(`[prompt_node] 调用模型: ${model}，输入长度: ${input.length}`)
      
      const response = await llmService.chat(model, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input }
      ], {})
      
      if (response.success && response.content) {
        console.log(`[prompt_node] 生成完成，输出长度: ${response.content.length}`)
        return {
          success: true,
          output: response.content
        }
      } else {
        console.error(`[prompt_node] 生成失败:`, response.error)
        return {
          success: false,
          error: response.error || '生成失败'
        }
      }
    } catch (error: any) {
      console.error('[prompt_node] 处理失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

// 产品文档
const productDocTool: ToolDefinition = {
  name: 'product_doc',
  description: '产品文档：PRD、需求文档、功能规格说明',
  parameters: [
    { name: 'name', type: 'string', description: '文档名称', required: false },
    { name: 'path', type: 'string', description: '文件路径', required: false }
  ],
  handler: async (args: any) => {
    const { name = '产品文档', path } = args
    return `产品文档：${name}\n${path ? `路径：${path}` : ''}`
  }
}

// 设计文档
const designDocTool: ToolDefinition = {
  name: 'design_doc',
  description: '设计文档：设计规范、交互文档、视觉设计',
  parameters: [
    { name: 'name', type: 'string', description: '文档名称', required: false },
    { name: 'path', type: 'string', description: '文件路径', required: false }
  ],
  handler: async (args: any) => {
    const { name = '设计文档', path } = args
    return `设计文档：${name}\n${path ? `路径：${path}` : ''}`
  }
}

// UI界面
const uiInterfaceTool: ToolDefinition = {
  name: 'ui_interface',
  description: 'UI界面：原型图、设计稿、组件库',
  parameters: [
    { name: 'name', type: 'string', description: '界面名称', required: false },
    { name: 'path', type: 'string', description: '文件路径', required: false }
  ],
  handler: async (args: any) => {
    const { name = 'UI界面', path } = args
    return `UI界面：${name}\n${path ? `路径：${path}` : ''}`
  }
}

// 代码
const codeFileTool: ToolDefinition = {
  name: 'code_file',
  description: '代码：源代码文件、代码库、配置文件',
  parameters: [
    { name: 'name', type: 'string', description: '文件/项目名称', required: false },
    { name: 'path', type: 'string', description: '文件路径', required: false }
  ],
  handler: async (args: any) => {
    const { name = '代码文件', path } = args
    return `代码：${name}\n${path ? `路径：${path}` : ''}`
  }
}

// 项目规范
const projectSpecTool: ToolDefinition = {
  name: 'project_spec',
  description: '项目规范：编码规范、设计规范、测试规范',
  parameters: [
    { name: 'name', type: 'string', description: '规范名称', required: false },
    { name: 'path', type: 'string', description: '文件路径', required: false }
  ],
  handler: async (args: any) => {
    const { name = '项目规范', path } = args
    return `项目规范：${name}\n${path ? `路径：${path}` : ''}`
  }
}

// 注册所有工作流工具
export const registerWorkflowTools = () => {
  toolRegistry.register(marketResearchTool)
  toolRegistry.register(productManagerTool)
  toolRegistry.register(uiDesignerTool)
  toolRegistry.register(architectTool)
  toolRegistry.register(frontendEngineerTool)
  toolRegistry.register(backendEngineerTool)
  toolRegistry.register(uiTesterTool)
  toolRegistry.register(functionalTesterTool)
  toolRegistry.register(boxNodeTool)
  toolRegistry.register(promptNodeTool)
  toolRegistry.register(productDocTool)
  toolRegistry.register(designDocTool)
  toolRegistry.register(uiInterfaceTool)
  toolRegistry.register(codeFileTool)
  toolRegistry.register(projectSpecTool)
}

export const workflowTools = [
  marketResearchTool,
  productManagerTool,
  uiDesignerTool,
  architectTool,
  frontendEngineerTool,
  backendEngineerTool,
  uiTesterTool,
  functionalTesterTool,
  boxNodeTool,
  promptNodeTool,
  productDocTool,
  designDocTool,
  uiInterfaceTool,
  codeFileTool,
  projectSpecTool
]
