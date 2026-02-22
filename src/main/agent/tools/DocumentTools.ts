import * as fs from 'fs'
import * as path from 'path'
import { DocumentManager, DocumentTemplate, DocumentMetadata } from './DocumentManager'
import { toolRegistry } from '../ToolRegistry'

export class DocumentTools extends DocumentManager {
  constructor(projectPath: string) {
    super(projectPath)
  }

  createRequirementsDoc(projectName: string, data: any, author: string = 'PM'): string {
    const template: DocumentTemplate = {
      name: '需求文档',
      description: '项目需求规格说明',
      filename: 'requirements.md',
      content: `# ${projectName} - 需求文档

## 项目概述
${data.overview || '待补充'}

## 功能需求
${(data.features || []).map((f: string) => `- ${f}`).join('\n')}

## 非功能需求
${(data.nonFunctional || []).map((f: string) => `- ${f}`).join('\n')}

## 验收标准
${(data.acceptanceCriteria || []).map((f: string) => `- ${f}`).join('\n')}

## 限制条件
${data.constraints || '待补充'}
`
    }
    return this.createDocument(template, { author })
  }

  createDesignDoc(projectName: string, data: any, author: string = 'UI'): string {
    const template: DocumentTemplate = {
      name: '设计文档',
      description: 'UI/UX设计规格说明',
      filename: 'design.md',
      content: `# ${projectName} - 设计文档

## 设计原则
${data.principles || '待补充'}

## 页面结构
${(data.pages || []).map((p: any) => `
### ${p.name}
- 描述: ${p.description || '待补充'}
- 组件: ${(p.components || []).join(', ')}
`).join('\n')}

## 视觉风格
${data.visualStyle || '待补充'}

## 交互流程
${data.interactionFlow || '待补充'}
`
    }
    return this.createDocument(template, { author })
  }

  createApiDoc(projectName: string, data: any, author: string = 'Dev'): string {
    const template: DocumentTemplate = {
      name: 'API文档',
      description: 'API接口规格说明',
      filename: 'api.md',
      content: `# ${projectName} - API文档

## 概述
${data.overview || '待补充'}

## 接口列表
${(data.endpoints || []).map((e: any) => `
### ${e.method} ${e.path}
- 描述: ${e.description || '待补充'}
- 请求参数: ${JSON.stringify(e.params || {})}
- 响应格式: ${JSON.stringify(e.response || {})}
`).join('\n')}

## 错误码
${(data.errorCodes || []).map((c: any) => `- ${c.code}: ${c.description}`).join('\n')}
`
    }
    return this.createDocument(template, { author })
  }

  createTestDoc(projectName: string, data: any, author: string = 'Test'): string {
    const template: DocumentTemplate = {
      name: '测试文档',
      description: '测试用例和测试结果',
      filename: 'test.md',
      content: `# ${projectName} - 测试文档

## 测试策略
${data.strategy || '待补充'}

## 测试用例
${(data.testCases || []).map((c: any) => `
### ${c.name}
- 描述: ${c.description || '待补充'}
- 步骤: ${(c.steps || []).join('\n  - ')}
- 预期结果: ${c.expected || '待补充'}
- 实际结果: ${c.actual || '待测试'}
- 状态: ${c.status || '待测试'}
`).join('\n')}

## 测试结果
- 总用例数: ${data.totalCases || 0}
- 通过数: ${data.passedCases || 0}
- 失败数: ${data.failedCases || 0}
- 覆盖率: ${data.coverage || '待计算'}
`
    }
    return this.createDocument(template, { author })
  }

  createReviewDoc(projectName: string, data: any, author: string = 'Review'): string {
    const template: DocumentTemplate = {
      name: '审查文档',
      description: '代码审查结果',
      filename: 'review.md',
      content: `# ${projectName} - 审查文档

## 审查概述
- 审查人: ${author}
- 审查时间: ${new Date().toISOString()}
- 审查范围: ${data.scope || '全部代码'}

## 审查结果
- 总体评分: ${data.score || '待评分'}
- 是否通过: ${data.passed ? '是' : '否'}

## 发现的问题
${(data.issues || []).map((i: any) => `
### ${i.severity || '中'}: ${i.title}
- 位置: ${i.location || '待补充'}
- 描述: ${i.description || '待补充'}
- 建议: ${i.suggestion || '待补充'}
`).join('\n')}

## 改进建议
${(data.suggestions || []).map((s: string) => `- ${s}`).join('\n')}

## 审查结论
${data.conclusion || '待补充'}
`
    }
    return this.createDocument(template, { author })
  }

  readDoc(filename: string): string {
    return this.readDocument(filename)
  }

  updateDoc(filename: string, content: string, author: string = 'System'): void {
    this.updateDocument(filename, content, author)
  }

  appendDoc(filename: string, content: string, author: string = 'System'): void {
    this.appendDocument(filename, content, author)
  }

  listDocs(): DocumentMetadata[] {
    return this.listDocuments()
  }

  searchDocs(keyword: string): DocumentMetadata[] {
    return this.searchDocuments(keyword)
  }

  deleteDoc(filename: string): void {
    this.deleteDocument(filename)
  }
}

toolRegistry.register({
  name: 'create_document',
  description: 'Create a document with template',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'template', type: 'string', description: 'Document template (requirements, design, api, test, review)', required: true },
    { name: 'data', type: 'object', description: 'Document data object', required: true },
    { name: 'author', type: 'string', description: 'Document author', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const template = params?.template
      const data = params?.data
      const author = params?.author || 'System'
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!template) return { error: 'Missing parameter: template' }
      if (!data) return { error: 'Missing parameter: data' }
      
      const documentTools = new DocumentTools(projectPath)
      let result = ''
      
      switch (template) {
        case 'requirements':
          result = documentTools.createRequirementsDoc(
            data.projectName || 'Project',
            data,
            author
          )
          break
        case 'design':
          result = documentTools.createDesignDoc(
            data.projectName || 'Project',
            data,
            author
          )
          break
        case 'api':
          result = documentTools.createApiDoc(
            data.projectName || 'Project',
            data,
            author
          )
          break
        case 'test':
          result = documentTools.createTestDoc(
            data.projectName || 'Project',
            data,
            author
          )
          break
        case 'review':
          result = documentTools.createReviewDoc(
            data.projectName || 'Project',
            data,
            author
          )
          break
        default:
          return { error: `Unknown template: ${template}` }
      }
      
      return {
        success: true,
        message: `Document created: ${template}.md`,
        path: result
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'read_document',
  description: 'Read a document from .docs directory',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'filename', type: 'string', description: 'Document filename (e.g., requirements.md)', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const filename = params?.filename
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!filename) return { error: 'Missing parameter: filename' }
      
      const documentTools = new DocumentTools(projectPath)
      const result = documentTools.readDoc(filename)
      
      return {
        success: true,
        message: `Document read: ${filename}`,
        content: result
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'update_document',
  description: 'Update a document in .docs directory',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'filename', type: 'string', description: 'Document filename (e.g., requirements.md)', required: true },
    { name: 'content', type: 'string', description: 'New content to write', required: true },
    { name: 'author', type: 'string', description: 'Update author', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const filename = params?.filename
      const content = params?.content
      const author = params?.author || 'System'
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!filename) return { error: 'Missing parameter: filename' }
      if (!content) return { error: 'Missing parameter: content' }
      
      const documentTools = new DocumentTools(projectPath)
      documentTools.updateDoc(filename, content, author)
      
      return {
        success: true,
        message: `Document updated: ${filename}`,
        path: documentTools.getDocumentPath(filename)
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'append_document',
  description: 'Append content to a document in .docs directory',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'filename', type: 'string', description: 'Document filename (e.g., requirements.md)', required: true },
    { name: 'content', type: 'string', description: 'Content to append', required: true },
    { name: 'author', type: 'string', description: 'Append author', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const filename = params?.filename
      const content = params?.content
      const author = params?.author || 'System'
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!filename) return { error: 'Missing parameter: filename' }
      if (!content) return { error: 'Missing parameter: content' }
      
      const documentTools = new DocumentTools(projectPath)
      documentTools.appendDoc(filename, content, author)
      
      return {
        success: true,
        message: `Content appended to: ${filename}`,
        path: documentTools.getDocumentPath(filename)
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'list_documents',
  description: 'List all documents in .docs directory',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const documentTools = new DocumentTools(projectPath)
      const result = documentTools.listDocs()
      
      return {
        success: true,
        message: `Found ${result.length} document(s)`,
        documents: result
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'search_documents',
  description: 'Search for documents by keyword',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'keyword', type: 'string', description: 'Search keyword', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const keyword = params?.keyword
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!keyword) return { error: 'Missing parameter: keyword' }
      
      const documentTools = new DocumentTools(projectPath)
      const result = documentTools.searchDocs(keyword)
      
      return {
        success: true,
        message: `Found ${result.length} matching document(s)`,
        documents: result
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'delete_document',
  description: 'Delete a document from .docs directory',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'filename', type: 'string', description: 'Document filename (e.g., requirements.md)', required: true }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const filename = params?.filename
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!filename) return { error: 'Missing parameter: filename' }
      
      const documentTools = new DocumentTools(projectPath)
      documentTools.deleteDoc(filename)
      
      return {
        success: true,
        message: `Document deleted: ${filename}`,
        path: documentTools.getDocumentPath(filename)
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_requirements_doc',
  description: 'Create a requirements document',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'projectName', type: 'string', description: 'Project name', required: true },
    { name: 'requirements', type: 'object', description: 'Requirements data object', required: true },
    { name: 'author', type: 'string', description: 'Document author', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const projectName = params?.projectName
      const requirements = params?.requirements
      const author = params?.author || 'PM'
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!projectName) return { error: 'Missing parameter: projectName' }
      if (!requirements) return { error: 'Missing parameter: requirements' }
      
      const documentTools = new DocumentTools(projectPath)
      const result = documentTools.createRequirementsDoc(projectName, requirements, author)
      
      return {
        success: true,
        message: 'Requirements document created',
        path: result
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_design_doc',
  description: 'Create a design document',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'projectName', type: 'string', description: 'Project name', required: true },
    { name: 'design', type: 'object', description: 'Design data object', required: true },
    { name: 'author', type: 'string', description: 'Document author', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const projectName = params?.projectName
      const design = params?.design
      const author = params?.author || 'UI'
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!projectName) return { error: 'Missing parameter: projectName' }
      if (!design) return { error: 'Missing parameter: design' }
      
      const documentTools = new DocumentTools(projectPath)
      const result = documentTools.createDesignDoc(projectName, design, author)
      
      return {
        success: true,
        message: 'Design document created',
        path: result
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_api_doc',
  description: 'Create an API documentation',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'projectName', type: 'string', description: 'Project name', required: true },
    { name: 'api', type: 'object', description: 'API data object', required: true },
    { name: 'author', type: 'string', description: 'Document author', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const projectName = params?.projectName
      const api = params?.api
      const author = params?.author || 'Dev'
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!projectName) return { error: 'Missing parameter: projectName' }
      if (!api) return { error: 'Missing parameter: api' }
      
      const documentTools = new DocumentTools(projectPath)
      const result = documentTools.createApiDoc(projectName, api, author)
      
      return {
        success: true,
        message: 'API documentation created',
        path: result
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_test_doc',
  description: 'Create a test document',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'projectName', type: 'string', description: 'Project name', required: true },
    { name: 'test', type: 'object', description: 'Test data object', required: true },
    { name: 'author', type: 'string', description: 'Document author', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const projectName = params?.projectName
      const test = params?.test
      const author = params?.author || 'Test'
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!projectName) return { error: 'Missing parameter: projectName' }
      if (!test) return { error: 'Missing parameter: test' }
      
      const documentTools = new DocumentTools(projectPath)
      const result = documentTools.createTestDoc(projectName, test, author)
      
      return {
        success: true,
        message: 'Test document created',
        path: result
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'create_review_doc',
  description: 'Create a review document',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'projectName', type: 'string', description: 'Project name', required: true },
    { name: 'review', type: 'object', description: 'Review data object', required: true },
    { name: 'author', type: 'string', description: 'Document author', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      const projectName = params?.projectName
      const review = params?.review
      const author = params?.author || 'Review'
      
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      if (!projectName) return { error: 'Missing parameter: projectName' }
      if (!review) return { error: 'Missing parameter: review' }
      
      const documentTools = new DocumentTools(projectPath)
      const result = documentTools.createReviewDoc(projectName, review, author)
      
      return {
        success: true,
        message: 'Review document created',
        path: result
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

console.log('[DevTools] Document management tools loaded')

