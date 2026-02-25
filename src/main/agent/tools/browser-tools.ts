/**
 * Browser Tools
 * 浏览器操作工具集
 */

import axios from 'axios'
import { toolRegistry } from '../ToolRegistry'

export function registerBrowserTools(): void {
  // 获取网页内容
  toolRegistry.register({
    name: 'fetch_webpage',
    description: 'Fetch content from a URL',
    parameters: [
      { name: 'url', type: 'string', description: 'URL to fetch', required: true }
    ],
    handler: async (params: any) => {
      try {
        const url = params?.url
        if (!url) return { error: 'Missing parameter: url' }

        const response = await axios.get(url, {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        })

        return {
          content: response.data,
          status: response.status,
          headers: response.headers
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 打开页面
  toolRegistry.register({
    name: 'open_page',
    description: 'Open a URL in the default browser',
    parameters: [
      { name: 'url', type: 'string', description: 'URL to open', required: true }
    ],
    handler: async (params: any) => {
      try {
        const url = params?.url
        if (!url) return { error: 'Missing parameter: url' }

        const { shell } = require('electron')
        await shell.openExternal(url)

        return { success: true, url }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 搜索网页
  toolRegistry.register({
    name: 'search_web',
    description: 'Search the web for information',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true }
    ],
    handler: async (params: any) => {
      try {
        const query = params?.query
        if (!query) return { error: 'Missing parameter: query' }

        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        
        const response = await axios.get(searchUrl, {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        })

        return {
          url: searchUrl,
          content: response.data.substring(0, 5000),
          status: response.status
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 搜索图片
  toolRegistry.register({
    name: 'search_images',
    description: 'Search for images online',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true },
      { name: 'count', type: 'number', description: 'Max number of images', required: false }
    ],
    handler: async (params: any) => {
      try {
        const query = params?.query
        const count = params?.count || 10
        
        if (!query) return { error: 'Missing parameter: query' }

        // 简化实现
        return {
          query,
          count,
          images: [],
          message: 'Image search not fully implemented in modular version'
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 批量下载图片
  toolRegistry.register({
    name: 'batch_download_images',
    description: 'Download multiple images from search results',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true },
      { name: 'count', type: 'number', description: 'Number of images to download', required: false },
      { name: 'dir', type: 'string', description: 'Directory to save images', required: false }
    ],
    handler: async (params: any) => {
      try {
        const query = params?.query
        const count = params?.count || 9
        const dir = params?.dir
        
        if (!query) return { error: 'Missing parameter: query' }

        return {
          query,
          count,
          dir,
          downloaded: 0,
          message: 'Batch download not fully implemented'
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })

  // 下载图片
  toolRegistry.register({
    name: 'download_image',
    description: 'Download an image from URL',
    parameters: [
      { name: 'url', type: 'string', description: 'Image URL', required: true },
      { name: 'filename', type: 'string', description: 'Optional filename', required: false },
      { name: 'dir', type: 'string', description: 'Optional directory', required: false }
    ],
    handler: async (params: any) => {
      try {
        const url = params?.url
        const filename = params?.filename
        const dir = params?.dir
        
        if (!url) return { error: 'Missing parameter: url' }

        return {
          url,
          filename,
          dir,
          success: true,
          message: 'Image download not fully implemented'
        }
      } catch (error: any) {
        return { error: error.message }
      }
    }
  })
}

registerBrowserTools()