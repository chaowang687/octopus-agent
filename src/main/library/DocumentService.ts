import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

export enum DocumentType {
  REQUIREMENT = 'requirement',
  PLAN = 'plan',
  DECISION = 'decision',
  SKILL = 'skill',
  CONTEXT = 'context',
  LOG = 'log'
}

export enum DocumentStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export interface DocumentMetadata {
  status: DocumentStatus
  projectId?: string
  parentId?: string
  tags: string[]
  createdBy: string
  createdAt: number
  updatedAt: number
  version: number
}

export interface DocumentRelations {
  dependencies: string[]
  related: string[]
  decisions: string[]
}

export interface Document {
  id: string
  type: DocumentType
  title: string
  content: string
  metadata: DocumentMetadata
  relations: DocumentRelations
}

export interface DocumentQuery {
  type?: DocumentType
  status?: DocumentStatus
  projectId?: string
  parentId?: string
  tags?: string[]
  createdBy?: string
  search?: string
  limit?: number
  offset?: number
}

export class DocumentService {
  private documents: Map<string, Document> = new Map()
  private versions: Map<string, Document[]> = new Map()
  private dataPath: string

  constructor(dataPath?: string) {
    this.dataPath = dataPath || path.join(process.cwd(), '.library', 'documents')
    this.initialize()
  }

  private initialize(): void {
    try {
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true })
      }
      this.loadDocuments()
      console.log('[DocumentService] 文档服务初始化成功')
    } catch (error) {
      console.error('[DocumentService] 文档服务初始化失败:', error)
    }
  }

  private loadDocuments(): void {
    try {
      const files = fs.readdirSync(this.dataPath)
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.dataPath, file)
          const content = fs.readFileSync(filePath, 'utf-8')
          const doc = JSON.parse(content) as Document
          this.documents.set(doc.id, doc)
          
          if (!this.versions.has(doc.id)) {
            this.versions.set(doc.id, [])
          }
          this.versions.get(doc.id)!.push(doc)
        }
      }
      console.log(`[DocumentService] 加载了 ${this.documents.size} 个文档`)
    } catch (error) {
      console.error('[DocumentService] 加载文档失败:', error)
    }
  }

  private saveDocument(doc: Document): void {
    try {
      const filePath = path.join(this.dataPath, `${doc.id}.json`)
      fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf-8')
    } catch (error) {
      console.error('[DocumentService] 保存文档失败:', error)
    }
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex')
  }

  async createDocument(doc: Partial<Document>): Promise<Document> {
    const now = Date.now()
    const id = doc.id || this.generateId()

    const newDoc: Document = {
      id,
      type: doc.type || DocumentType.CONTEXT,
      title: doc.title || 'Untitled',
      content: doc.content || '',
      metadata: {
        status: doc.metadata?.status || DocumentStatus.DRAFT,
        projectId: doc.metadata?.projectId,
        parentId: doc.metadata?.parentId,
        tags: doc.metadata?.tags || [],
        createdBy: doc.metadata?.createdBy || 'user',
        createdAt: now,
        updatedAt: now,
        version: 1
      },
      relations: doc.relations || {
        dependencies: [],
        related: [],
        decisions: []
      }
    }

    this.documents.set(id, newDoc)
    this.versions.set(id, [newDoc])
    this.saveDocument(newDoc)

    console.log(`[DocumentService] 创建文档: ${id} (${newDoc.type})`)
    return newDoc
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id)
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    const doc = this.documents.get(id)
    if (!doc) {
      throw new Error(`文档不存在: ${id}`)
    }

    const updatedDoc: Document = {
      ...doc,
      ...updates,
      id: doc.id,
      metadata: {
        ...doc.metadata,
        ...updates.metadata,
        updatedAt: Date.now(),
        version: doc.metadata.version + 1
      }
    }

    this.documents.set(id, updatedDoc)
    this.versions.get(id)!.push(updatedDoc)
    this.saveDocument(updatedDoc)

    console.log(`[DocumentService] 更新文档: ${id} (v${updatedDoc.metadata.version})`)
    return updatedDoc
  }

  async deleteDocument(id: string): Promise<void> {
    const doc = this.documents.get(id)
    if (!doc) {
      throw new Error(`文档不存在: ${id}`)
    }

    this.documents.delete(id)
    this.versions.delete(id)

    const filePath = path.join(this.dataPath, `${id}.json`)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    console.log(`[DocumentService] 删除文档: ${id}`)
  }

  async searchDocuments(query: DocumentQuery): Promise<Document[]> {
    let results = Array.from(this.documents.values())

    if (query.type) {
      results = results.filter(doc => doc.type === query.type)
    }

    if (query.status) {
      results = results.filter(doc => doc.metadata.status === query.status)
    }

    if (query.projectId) {
      results = results.filter(doc => doc.metadata.projectId === query.projectId)
    }

    if (query.parentId) {
      results = results.filter(doc => doc.metadata.parentId === query.parentId)
    }

    if (query.createdBy) {
      results = results.filter(doc => doc.metadata.createdBy === query.createdBy)
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(doc =>
        query.tags!.some(tag => doc.metadata.tags.includes(tag))
      )
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase()
      results = results.filter(doc =>
        doc.title.toLowerCase().includes(searchLower) ||
        doc.content.toLowerCase().includes(searchLower)
      )
    }

    results.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt)

    if (query.offset) {
      results = results.slice(query.offset)
    }

    if (query.limit) {
      results = results.slice(0, query.limit)
    }

    return results
  }

  async getDocumentHistory(id: string): Promise<Document[]> {
    return this.versions.get(id) || []
  }

  async restoreVersion(id: string, version: number): Promise<Document> {
    const versions = this.versions.get(id)
    if (!versions || versions.length < version) {
      throw new Error(`版本不存在: ${version}`)
    }

    const restoredDoc = versions[version - 1]
    restoredDoc.metadata.version = versions.length + 1
    restoredDoc.metadata.updatedAt = Date.now()

    this.documents.set(id, restoredDoc)
    this.versions.get(id)!.push(restoredDoc)
    this.saveDocument(restoredDoc)

    console.log(`[DocumentService] 恢复文档版本: ${id} (v${version} -> v${restoredDoc.metadata.version})`)
    return restoredDoc
  }

  async addRelation(id: string, relationType: keyof DocumentRelations, targetId: string): Promise<void> {
    const doc = this.documents.get(id)
    if (!doc) {
      throw new Error(`文档不存在: ${id}`)
    }

    if (!doc.relations[relationType].includes(targetId)) {
      doc.relations[relationType].push(targetId)
      this.saveDocument(doc)
    }
  }

  async removeRelation(id: string, relationType: keyof DocumentRelations, targetId: string): Promise<void> {
    const doc = this.documents.get(id)
    if (!doc) {
      throw new Error(`文档不存在: ${id}`)
    }

    doc.relations[relationType] = doc.relations[relationType].filter(id => id !== targetId)
    this.saveDocument(doc)
  }

  async getRelatedDocuments(id: string): Promise<Document[]> {
    const doc = this.documents.get(id)
    if (!doc) {
      return []
    }

    const relatedIds = [
      ...doc.relations.dependencies,
      ...doc.relations.related,
      ...doc.relations.decisions
    ]

    const relatedDocs: Document[] = []
    for (const relatedId of relatedIds) {
      const relatedDoc = this.documents.get(relatedId)
      if (relatedDoc) {
        relatedDocs.push(relatedDoc)
      }
    }

    return relatedDocs
  }

  getStatistics(): {
    total: number
    byType: Record<DocumentType, number>
    byStatus: Record<DocumentStatus, number>
  } {
    const byType: Record<DocumentType, number> = {
      [DocumentType.REQUIREMENT]: 0,
      [DocumentType.PLAN]: 0,
      [DocumentType.DECISION]: 0,
      [DocumentType.SKILL]: 0,
      [DocumentType.CONTEXT]: 0,
      [DocumentType.LOG]: 0
    }

    const byStatus: Record<DocumentStatus, number> = {
      [DocumentStatus.DRAFT]: 0,
      [DocumentStatus.ACTIVE]: 0,
      [DocumentStatus.COMPLETED]: 0,
      [DocumentStatus.ARCHIVED]: 0
    }

    for (const doc of this.documents.values()) {
      byType[doc.type]++
      byStatus[doc.metadata.status]++
    }

    return {
      total: this.documents.size,
      byType,
      byStatus
    }
  }
}

export const documentService = new DocumentService()
