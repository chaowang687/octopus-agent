import * as fs from 'fs'
import * as path from 'path'

export interface DocumentTemplate {
  name: string
  description: string
  content: string
  filename: string
}

export interface DocumentMetadata {
  id: string
  name: string
  type: string
  createdAt: Date
  updatedAt: Date
  author: string
  version: string
}

export class DocumentManager {
  private projectPath: string
  private docsPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.docsPath = path.join(projectPath, '.docs')
    this.ensureDocsDirectory()
  }

  private ensureDocsDirectory() {
    if (!fs.existsSync(this.docsPath)) {
      fs.mkdirSync(this.docsPath, { recursive: true })
    }
  }

  createDocument(template: DocumentTemplate, metadata: Partial<DocumentMetadata> = {}): string {
    const docPath = path.join(this.docsPath, template.filename)
    
    const fullMetadata: DocumentMetadata = {
      id: metadata.id || this.generateId(),
      name: template.name,
      type: this.detectDocumentType(template.filename),
      createdAt: new Date(),
      updatedAt: new Date(),
      author: metadata.author || 'System',
      version: metadata.version || '1.0.0',
      ...metadata
    }

    const content = this.addMetadataToContent(template.content, fullMetadata)
    fs.writeFileSync(docPath, content, 'utf-8')
    
    return docPath
  }

  readDocument(filename: string): string {
    const docPath = path.join(this.docsPath, filename)
    if (!fs.existsSync(docPath)) {
      throw new Error(`Document not found: ${filename}`)
    }
    return fs.readFileSync(docPath, 'utf-8')
  }

  updateDocument(filename: string, content: string, author: string = 'System'): void {
    const docPath = path.join(this.docsPath, filename)
    if (!fs.existsSync(docPath)) {
      throw new Error(`Document not found: ${filename}`)
    }

    const existingContent = fs.readFileSync(docPath, 'utf-8')
    const metadata = this.extractMetadata(existingContent)
    
    metadata.updatedAt = new Date()
    metadata.author = author

    const newContent = this.addMetadataToContent(content, metadata)
    fs.writeFileSync(docPath, newContent, 'utf-8')
  }

  appendDocument(filename: string, content: string, author: string = 'System'): void {
    const docPath = path.join(this.docsPath, filename)
    if (!fs.existsSync(docPath)) {
      throw new Error(`Document not found: ${filename}`)
    }

    const existingContent = fs.readFileSync(docPath, 'utf-8')
    const metadata = this.extractMetadata(existingContent)
    
    metadata.updatedAt = new Date()
    metadata.author = author

    const newContent = this.addMetadataToContent(
      existingContent + '\n\n' + content,
      metadata
    )
    fs.writeFileSync(docPath, newContent, 'utf-8')
  }

  listDocuments(): DocumentMetadata[] {
    if (!fs.existsSync(this.docsPath)) {
      return []
    }

    const files = fs.readdirSync(this.docsPath)
    const documents: DocumentMetadata[] = []

    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const content = this.readDocument(file)
          const metadata = this.extractMetadata(content)
          documents.push(metadata)
        } catch (error) {
          console.error(`Error reading document ${file}:`, error)
        }
      }
    }

    return documents.sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    )
  }

  searchDocuments(keyword: string): DocumentMetadata[] {
    const documents = this.listDocuments()
    return documents.filter(doc => 
      doc.name.toLowerCase().includes(keyword.toLowerCase()) ||
      doc.type.toLowerCase().includes(keyword.toLowerCase())
    )
  }

  deleteDocument(filename: string): void {
    const docPath = path.join(this.docsPath, filename)
    if (fs.existsSync(docPath)) {
      fs.unlinkSync(docPath)
    }
  }

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private detectDocumentType(filename: string): string {
    if (filename.includes('requirement')) return 'requirement'
    if (filename.includes('design')) return 'design'
    if (filename.includes('api')) return 'api'
    if (filename.includes('test')) return 'test'
    if (filename.includes('deployment')) return 'deployment'
    if (filename.includes('changelog')) return 'changelog'
    return 'general'
  }

  private extractMetadata(content: string): DocumentMetadata {
    const metadata: Partial<DocumentMetadata> = {}

    const lines = content.split('\n')
    let inMetadata = false

    for (const line of lines) {
      if (line.trim() === '<!-- DOCUMENT_METADATA -->') {
        inMetadata = true
        continue
      }
      if (line.trim() === '<!-- END_METADATA -->') {
        break
      }
      if (inMetadata) {
        const match = line.match(/^<!--\s*(\w+):\s*(.+?)\s*-->$/)
        if (match) {
          const [, key, value] = match
          if (key === 'createdAt' || key === 'updatedAt') {
            (metadata as any)[key] = new Date(value)
          } else {
            (metadata as any)[key] = value
          }
        }
      }
    }

    return {
      id: metadata.id || this.generateId(),
      name: metadata.name || 'Untitled',
      type: metadata.type || 'general',
      createdAt: metadata.createdAt || new Date(),
      updatedAt: metadata.updatedAt || new Date(),
      author: metadata.author || 'Unknown',
      version: metadata.version || '1.0.0'
    } as DocumentMetadata
  }

  private addMetadataToContent(content: string, metadata: DocumentMetadata): string {
    const metadataBlock = `<!-- DOCUMENT_METADATA -->
<!-- id: ${metadata.id} -->
<!-- name: ${metadata.name} -->
<!-- type: ${metadata.type} -->
<!-- createdAt: ${metadata.createdAt.toISOString()} -->
<!-- updatedAt: ${metadata.updatedAt.toISOString()} -->
<!-- author: ${metadata.author} -->
<!-- version: ${metadata.version} -->
<!-- END_METADATA -->

`
    return metadataBlock + content
  }

  getDocumentPath(filename: string): string {
    return path.join(this.docsPath, filename)
  }

  getDocsPath(): string {
    return this.docsPath
  }
}
