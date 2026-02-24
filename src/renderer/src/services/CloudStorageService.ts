import OSS from 'ali-oss';

// 云存储配置接口
interface CloudStorageConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
}

// 云存储服务类
export class CloudStorageService {
  private client: OSS | null = null;
  private config: CloudStorageConfig | null = null;

  // 初始化云存储服务
  initialize(config: CloudStorageConfig): void {
    this.config = config;
    this.client = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket
    });
  }

  // 检查是否已初始化
  isInitialized(): boolean {
    return this.client !== null;
  }

  // 上传文件
  async uploadFile(file: File, key: string): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: '云存储服务未初始化' };
    }

    try {
      const result = await this.client.put(key, file);
      return { success: true, url: result.url };
    } catch (error: any) {
      console.error('文件上传失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 下载文件
  async downloadFile(key: string): Promise<{ success: boolean; data?: Blob; error?: string }> {
    if (!this.client) {
      return { success: false, error: '云存储服务未初始化' };
    }

    try {
      const result = await this.client.get(key);
      const blob = new Blob([result.content]);
      return { success: true, data: blob };
    } catch (error: any) {
      console.error('文件下载失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 删除文件
  async deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: '云存储服务未初始化' };
    }

    try {
      await this.client.delete(key);
      return { success: true };
    } catch (error: any) {
      console.error('文件删除失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取文件URL（带签名）
  async getFileUrl(key: string, expires: number = 3600): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: '云存储服务未初始化' };
    }

    try {
      const url = this.client.signatureUrl(key, { expires });
      return { success: true, url };
    } catch (error: any) {
      console.error('获取文件URL失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 列出文件
  async listFiles(prefix: string = ''): Promise<{ success: boolean; files?: Array<{ name: string; size: number; lastModified: Date }>; error?: string }> {
    if (!this.client) {
      return { success: false, error: '云存储服务未初始化' };
    }

    try {
      const result = await this.client.list({
        prefix,
        maxKeys: 100
      });

      const files = result.objects.map(obj => ({
        name: obj.name,
        size: obj.size,
        lastModified: new Date(obj.lastModified)
      }));

      return { success: true, files };
    } catch (error: any) {
      console.error('列出文件失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 上传文档
  async uploadDocument(documentId: string, document: any): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: '云存储服务未初始化' };
    }

    try {
      const key = `documents/${documentId}.json`;
      const content = JSON.stringify(document);
      const buffer = Buffer.from(content, 'utf-8');
      
      const result = await this.client.put(key, buffer);
      return { success: true, url: result.url };
    } catch (error: any) {
      console.error('文档上传失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 下载文档
  async downloadDocument(documentId: string): Promise<{ success: boolean; document?: any; error?: string }> {
    if (!this.client) {
      return { success: false, error: '云存储服务未初始化' };
    }

    try {
      const key = `documents/${documentId}.json`;
      const result = await this.client.get(key);
      const content = result.content.toString('utf-8');
      const document = JSON.parse(content);
      
      return { success: true, document };
    } catch (error: any) {
      console.error('文档下载失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 上传代码文件
  async uploadCodeFile(fileId: string, codeFile: any): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: '云存储服务未初始化' };
    }

    try {
      const key = `code-files/${fileId}.json`;
      const content = JSON.stringify(codeFile);
      const buffer = Buffer.from(content, 'utf-8');
      
      const result = await this.client.put(key, buffer);
      return { success: true, url: result.url };
    } catch (error: any) {
      console.error('代码文件上传失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 下载代码文件
  async downloadCodeFile(fileId: string): Promise<{ success: boolean; codeFile?: any; error?: string }> {
    if (!this.client) {
      return { success: false, error: '云存储服务未初始化' };
    }

    try {
      const key = `code-files/${fileId}.json`;
      const result = await this.client.get(key);
      const content = result.content.toString('utf-8');
      const codeFile = JSON.parse(content);
      
      return { success: true, codeFile };
    } catch (error: any) {
      console.error('代码文件下载失败:', error);
      return { success: false, error: error.message };
    }
  }
}

// 导出单例
export const cloudStorageService = new CloudStorageService();