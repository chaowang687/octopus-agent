/**
 * Module Marketplace API
 * 实现模块市场的API接口
 */

import axios from 'axios';

export interface Module {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  authorUrl: string;
  repository: string;
  license: string;
  downloads: number;
  rating: number;
  tags: string[];
  screenshots: string[];
  readme: string;
  changelog: string;
  compatibility: string[];
  dependencies: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleSearchResult {
  modules: Module[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ModuleUploadRequest {
  moduleId: string;
  version: string;
  manifest: any;
  zipFile: Buffer;
  readme: string;
  screenshots: string[];
}

export interface ModuleUploadResponse {
  success: boolean;
  moduleId: string;
  version: string;
  message: string;
}

export class ModuleMarketplaceAPI {
  private baseURL: string;
  private apiKey: string;

  constructor(baseURL: string = 'https://marketplace.trae.ai', apiKey?: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey || '';
  }

  /**
   * Search modules
   */
  async searchModules(
    query: string = '',
    page: number = 1,
    pageSize: number = 20,
    sortBy: string = 'downloads',
    sortOrder: string = 'desc'
  ): Promise<ModuleSearchResult> {
    const response = await axios.get('/api/modules/search', {
      params: { query, page, pageSize, sortBy, sortOrder },
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data;
  }

  /**
   * Get module details
   */
  async getModule(moduleId: string, version?: string): Promise<Module> {
    const response = await axios.get(`/api/modules/${moduleId}`, {
      params: { version },
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data;
  }

  /**
   * Download module
   */
  async downloadModule(moduleId: string, version?: string): Promise<Buffer> {
    const response = await axios.get(`/api/modules/${moduleId}/download`, {
      params: { version },
      headers: { 'X-API-Key': this.apiKey },
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  }

  /**
   * Upload module
   */
  async uploadModule(request: ModuleUploadRequest): Promise<ModuleUploadResponse> {
    const formData = new FormData();
    formData.append('moduleId', request.moduleId);
    formData.append('version', request.version);
    formData.append('manifest', JSON.stringify(request.manifest));
    formData.append('zipFile', new Blob([request.zipFile], { type: 'application/zip' }));
    formData.append('readme', request.readme);
    request.screenshots.forEach((screenshot, index) => {
      formData.append(`screenshot_${index}`, screenshot);
    });

    const response = await axios.post('/api/modules/upload', formData, {
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data;
  }

  /**
   * Update module
   */
  async updateModule(moduleId: string, version: string, updates: any): Promise<Module> {
    const response = await axios.put(`/api/modules/${moduleId}/versions/${version}`, updates, {
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data;
  }

  /**
   * Delete module
   */
  async deleteModule(moduleId: string, version?: string): Promise<boolean> {
    const response = await axios.delete(`/api/modules/${moduleId}`, {
      params: { version },
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data.success;
  }

  /**
   * Get module versions
   */
  async getModuleVersions(moduleId: string): Promise<string[]> {
    const response = await axios.get(`/api/modules/${moduleId}/versions`, {
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data.versions;
  }

  /**
   * Get module statistics
   */
  async getModuleStats(moduleId: string): Promise<any> {
    const response = await axios.get(`/api/modules/${moduleId}/stats`, {
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data;
  }

  /**
   * Get trending modules
   */
  async getTrendingModules(limit: number = 10): Promise<Module[]> {
    const response = await axios.get('/api/modules/trending', {
      params: { limit },
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data;
  }

  /**
   * Get featured modules
   */
  async getFeaturedModules(limit: number = 10): Promise<Module[]> {
    const response = await axios.get('/api/modules/featured', {
      params: { limit },
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data;
  }
}