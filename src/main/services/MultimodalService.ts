/**
 * 多模态服务
 * 提供图像理解、语音处理、视频分析等多模态能力
 */

import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { app, BrowserWindow } from 'electron'
import axios from 'axios'
import { getMainWindow } from '../index'

// 多模态能力类型
export enum MultimodalCapability {
  IMAGE_UNDERSTANDING = 'image_understanding',
  IMAGE_GENERATION = 'image_generation',
  VOICE_INPUT = 'voice_input',
  VOICE_OUTPUT = 'voice_output',
  VIDEO_UNDERSTANDING = 'video_understanding',
  SCREEN_CAPTURE = 'screen_capture'
}

// 图像理解结果
export interface ImageUnderstandingResult {
  description: string
  tags: string[]
  objects: Array<{ name: string; confidence: number; bbox?: number[] }>
  text?: string
  error?: string
}

// 语音识别结果
export interface SpeechRecognitionResult {
  text: string
  confidence: number
  language: string
  error?: string
}

// 语音合成选项
export interface VoiceSynthesisOptions {
  text: string
  voice?: string
  speed?: number
  pitch?: number
  outputPath?: string
}

// 屏幕捕获选项
export interface ScreenCaptureOptions {
  displayId?: number
  x?: number
  y?: number
  width?: number
  height?: number
  format?: 'png' | 'jpeg'
  quality?: number
}

// 多模态服务类
export class MultimodalService extends EventEmitter {
  private capabilities: Set<MultimodalCapability> = new Set()
  private apiKeys: Record<string, string> = {}
  private tempDir: string

  constructor() {
    super()
    this.tempDir = path.join(app.getPath('temp'), 'multimodal')
    this.ensureTempDir()
    this.initializeCapabilities()
    this.loadApiKeys()
  }

  /**
   * 初始化多模态能力
   */
  private initializeCapabilities(): void {
    // 默认支持的能力
    this.capabilities.add(MultimodalCapability.SCREEN_CAPTURE)
    this.capabilities.add(MultimodalCapability.IMAGE_UNDERSTANDING)
    
    // 检查可用的API密钥来启用更多能力
    this.checkCapabilities()
  }

  /**
   * 检查并更新可用能力
   */
  private checkCapabilities(): void {
    const keysPath = path.join(app.getPath('userData'), 'apiKeys.json')
    
    try {
      if (fs.existsSync(keysPath)) {
        const keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'))
        
        // OpenAI GPT-4V 图像理解
        if (keys.openai || keys['gpt-4v'] || keys['gpt-4o']) {
          this.capabilities.add(MultimodalCapability.IMAGE_UNDERSTANDING)
        }
        
        // DALL-E 图像生成
        if (keys.openai || keys.dalle || keys['dalle-3']) {
          this.capabilities.add(MultimodalCapability.IMAGE_GENERATION)
        }
        
        // 语音识别（可以使用OpenAI Whisper或其他服务）
        if (keys.openai || keys.whisper) {
          this.capabilities.add(MultimodalCapability.VOICE_INPUT)
        }
        
        // 语音合成
        if (keys.openai || keys.tts) {
          this.capabilities.add(MultimodalCapability.VOICE_OUTPUT)
        }
      }
    } catch (e) {
      console.error('[Multimodal] Failed to check capabilities:', e)
    }
  }

  /**
   * 加载API密钥
   */
  private loadApiKeys(): void {
    const keysPath = path.join(app.getPath('userData'), 'apiKeys.json')
    
    try {
      if (fs.existsSync(keysPath)) {
        this.apiKeys = JSON.parse(fs.readFileSync(keysPath, 'utf8'))
      }
    } catch (e) {
      console.error('[Multimodal] Failed to load API keys:', e)
    }
  }

  /**
   * 确保临时目录存在
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  /**
   * 检查能力是否可用
   */
  hasCapability(capability: MultimodalCapability): boolean {
    return this.capabilities.has(capability)
  }

  /**
   * 获取所有可用能力
   */
  getAvailableCapabilities(): MultimodalCapability[] {
    return Array.from(this.capabilities)
  }

  /**
   * 图像理解 - 使用AI分析图像内容
   */
  async understandImage(imagePath: string, prompt?: string): Promise<ImageUnderstandingResult> {
    if (!fs.existsSync(imagePath)) {
      return { description: '', tags: [], objects: [], error: 'Image file not found' }
    }

    // 尝试使用OpenAI GPT-4V
    const openaiKey = this.apiKeys.openai || this.apiKeys['gpt-4o']
    if (openaiKey) {
      try {
        return await this.understandWithGPT4V(openaiKey, imagePath, prompt)
      } catch (e: any) {
        console.error('[Multimodal] GPT-4V failed:', e)
      }
    }

    // 如果没有API密钥，返回基本信息
    const stats = fs.statSync(imagePath)
    return {
      description: `Image file: ${path.basename(imagePath)}`,
      tags: ['image', 'file'],
      objects: [],
      text: stats.size > 0 ? `File size: ${(stats.size / 1024).toFixed(2)} KB` : undefined
    }
  }

  /**
   * 使用GPT-4V进行图像理解
   */
  private async understandWithGPT4V(apiKey: string, imagePath: string, prompt?: string): Promise<ImageUnderstandingResult> {
    const imageData = fs.readFileSync(imagePath)
    const base64Image = imageData.toString('base64')
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt || 'Describe this image in detail. What do you see? Include any text that might be in the image.' },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    )

    const content = response.data.choices[0]?.message?.content || ''
    
    // 解析响应，提取标签和对象
    const tags = this.extractTags(content)
    const objects = this.extractObjects(content)
    const text = this.extractText(content)

    return {
      description: content,
      tags,
      objects,
      text
    }
  }

  /**
   * 从描述中提取标签
   */
  private extractTags(description: string): string[] {
    const commonTags = ['text', 'person', 'object', 'scene', 'color', 'animal', 'vehicle', 'building', 'nature', 'indoor', 'outdoor']
    const found = commonTags.filter(tag => description.toLowerCase().includes(tag))
    return found.length > 0 ? found : ['unknown']
  }

  /**
   * 从描述中提取对象
   */
  private extractObjects(description: string): Array<{ name: string; confidence: number }> {
    // 简单的对象提取，实际可以使用更复杂的NLP
    const objectPatterns = [
      /\b(\w+)\s+(?:in|on|at|with)\s+(?:the|a|an)\s+(\w+)/gi,
      /\bI\s+see\s+(?:a|an|the)?\s*(\w+)/gi,
      /\bthere\s+is\s+(?:a|an|the)?\s*(\w+)/gi
    ]

    const objects: Array<{ name: string; confidence: number }> = []
    const seen = new Set<string>()

    for (const pattern of objectPatterns) {
      const matches = description.matchAll(pattern)
      for (const match of matches) {
        const name = match[1] || match[2]
        if (name && !seen.has(name.toLowerCase()) && name.length > 2) {
          seen.add(name.toLowerCase())
          objects.push({ name, confidence: 0.8 })
        }
      }
    }

    return objects.slice(0, 10)
  }

  /**
   * 从描述中提取文本
   */
  private extractText(description: string): string | undefined {
    // 检查是否识别到文字
    if (description.toLowerCase().includes('text') || 
        description.toLowerCase().includes('writing') ||
        description.toLowerCase().includes('sign')) {
      const textMatch = description.match(/text[:\s]+([^.]+)/i)
      if (textMatch) {
        return textMatch[1].trim()
      }
      return 'Text detected in image'
    }
    return undefined
  }

  /**
   * 图像生成
   */
  async generateImage(prompt: string, options?: {
    model?: string
    size?: '1024x1024' | '1792x1024' | '1024x1792'
    quality?: 'standard' | 'hd'
    n?: number
  }): Promise<{ images: string[]; error?: string }> {
    const openaiKey = this.apiKeys.openai
    if (!openaiKey) {
      return { images: [], error: 'OpenAI API key not configured' }
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          model: options?.model || 'dall-e-3',
          prompt,
          n: options?.n || 1,
          size: options?.size || '1024x1024',
          quality: options?.quality || 'standard'
        },
        {
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000
        }
      )

      const images = response.data.data.map((img: any) => img.url)
      
      // 下载图像到本地
      const localPaths: string[] = []
      for (let i = 0; i < images.length; i++) {
        try {
          const imageResponse = await axios.get(images[i], { responseType: 'arraybuffer' })
          const localPath = path.join(this.tempDir, `generated_${Date.now()}_${i}.png`)
          fs.writeFileSync(localPath, imageResponse.data)
          localPaths.push(localPath)
        } catch (e) {
          console.error('[Multimodal] Failed to download image:', e)
        }
      }

      return { images: localPaths }
    } catch (e: any) {
      return { images: [], error: e.message }
    }
  }

  /**
   * 屏幕捕获
   */
  async captureScreen(options?: ScreenCaptureOptions): Promise<{ path: string; error?: string }> {
    const mainWin = getMainWindow()
    if (!mainWin || mainWin.isDestroyed()) {
      return { path: '', error: 'Main window not available' }
    }

    try {
      // 使用Electron的桌面捕获功能
      const sources = await import('electron').then(m => 
        (m as any).desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: options?.width && options?.height 
            ? { width: options.width, height: options.height }
            : { width: 1920, height: 1080 }
        })
      )

      if (sources.length === 0) {
        return { path: '', error: 'No display sources available' }
      }

      const source = options?.displayId !== undefined 
        ? sources[options.displayId] || sources[0]
        : sources[0]

      const thumbnail = source.thumbnail
      const format = options?.format || 'png'
      const quality = options?.quality || 100
      
      const outputPath = path.join(
        this.tempDir,
        `screen_capture_${Date.now()}.${format}`
      )

      // 保存截图
      if (format === 'jpeg') {
        fs.writeFileSync(outputPath, thumbnail.toJPEG(quality))
      } else {
        fs.writeFileSync(outputPath, thumbnail.toPNG())
      }

      this.emit('screenCaptured', { path: outputPath })
      
      return { path: outputPath }
    } catch (e: any) {
      return { path: '', error: e.message }
    }
  }

  /**
   * 区域截图
   */
  async captureRegion(x: number, y: number, width: number, height: number): Promise<{ path: string; error?: string }> {
    return this.captureScreen({ x, y, width, height })
  }

  /**
   * 语音识别（音频转文字）
   */
  async recognizeSpeech(
    audioPath: string,
    language?: string
  ): Promise<SpeechRecognitionResult> {
    if (!fs.existsSync(audioPath)) {
      return { text: '', confidence: 0, language: 'en', error: 'Audio file not found' }
    }

    // 尝试使用OpenAI Whisper
    const openaiKey = this.apiKeys.openai
    if (openaiKey) {
      try {
        const audioData = fs.readFileSync(audioPath)
        
        const formData = new FormData()
        formData.append('file', new Blob([audioData]), 'audio.wav')
        formData.append('model', 'whisper-1')
        if (language) {
          formData.append('language', language)
        }

        const response = await axios.post(
          'https://api.openai.com/v1/audio/transcriptions',
          formData,
          {
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              ...formData.getHeaders?.() || {}
            },
            timeout: 60000
          }
        )

        return {
          text: response.data.text,
          confidence: 0.9, // Whisper不直接返回置信度
          language: language || 'en'
        }
      } catch (e: any) {
        return { text: '', confidence: 0, language: 'en', error: e.message }
      }
    }

    return { 
      text: '', 
      confidence: 0, 
      language: language || 'en',
      error: 'Speech recognition API not configured' 
    }
  }

  /**
   * 语音合成（文字转语音）
   */
  async synthesizeSpeech(options: VoiceSynthesisOptions): Promise<{ path: string; error?: string }> {
    const openaiKey = this.apiKeys.openai
    if (!openaiKey) {
      return { path: '', error: 'TTS API not configured' }
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1',
          input: options.text,
          voice: options.voice || 'alloy',
          speed: options.speed || 1.0,
          response_format: 'mp3'
        },
        {
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      )

      const outputPath = options.outputPath || path.join(
        this.tempDir,
        `speech_${Date.now()}.mp3`
      )

      fs.writeFileSync(outputPath, response.data)
      
      this.emit('speechSynthesized', { path: outputPath })
      
      return { path: outputPath }
    } catch (e: any) {
      return { path: '', error: e.message }
    }
  }

  /**
   * 获取可用的语音列表
   */
  getAvailableVoices(): { id: string; name: string }[] {
    return [
      { id: 'alloy', name: 'Alloy' },
      { id: 'echo', name: 'Echo' },
      { id: 'fable', name: 'Fable' },
      { id: 'onyx', name: 'Onyx' },
      { id: 'nova', name: 'Nova' },
      { id: 'shimmer', name: 'Shimmer' }
    ]
  }

  /**
   * 视频理解 - 提取视频帧进行分析
   */
  async understandVideo(videoPath: string, options?: {
    frameInterval?: number  // 每隔多少帧取一帧
    maxFrames?: number     // 最大取帧数
  }): Promise<{ frames: ImageUnderstandingResult[]; error?: string }> {
    // 视频理解需要更复杂的处理，这里提供基础版本
    // 实际实现可以使用ffmpeg提取帧，然后对每帧进行图像理解
    
    const frameInterval = options?.frameInterval || 30
    const maxFrames = options?.maxFrames || 5

    if (!fs.existsSync(videoPath)) {
      return { frames: [], error: 'Video file not found' }
    }

    // 检查ffmpeg是否可用
    try {
      const { execSync } = require('child_process')
      execSync('ffmpeg -version', { encoding: 'utf8' })
    } catch {
      return { 
        frames: [], 
        error: 'Video processing requires ffmpeg to be installed' 
      }
    }

    // 使用ffmpeg提取帧
    const { execSync } = require('child_process')
    const frameDir = path.join(this.tempDir, `video_frames_${Date.now()}`)
    fs.mkdirSync(frameDir, { recursive: true })

    try {
      // 提取帧
      execSync(
        `ffmpeg -i "${videoPath}" -vf "fps=1/${frameInterval}" "${frameDir}/frame_%04d.png"`,
        { encoding: 'utf8', timeout: 120000 }
      )

      // 读取提取的帧
      const frameFiles = fs.readdirSync(frameDir)
        .filter(f => f.endsWith('.png'))
        .slice(0, maxFrames)

      const frames: ImageUnderstandingResult[] = []
      
      for (const frameFile of frameFiles) {
        const framePath = path.join(frameDir, frameFile)
        const result = await this.understandImage(framePath)
        frames.push(result)
      }

      return { frames }
    } catch (e: any) {
      return { frames: [], error: e.message }
    } finally {
      // 清理临时帧目录
      try {
        fs.rmSync(frameDir, { recursive: true, force: true })
      } catch {}
    }
  }

  /**
   * OCR - 从图像中提取文字
   */
  async extractTextFromImage(imagePath: string): Promise<{ text: string; error?: string }> {
    // 优先使用图像理解中的文字提取
    const result = await this.understandImage(imagePath, 'Extract all text visible in this image.')
    
    if (result.text) {
      return { text: result.text }
    }

    if (result.error) {
      return { text: '', error: result.error }
    }

    return { text: result.description }
  }

  /**
   * 截图并分析
   */
  async captureAndAnalyze(prompt?: string): Promise<ImageUnderstandingResult> {
    const captureResult = await this.captureScreen()
    
    if (captureResult.error) {
      return { description: '', tags: [], objects: [], error: captureResult.error }
    }

    return this.understandImage(captureResult.path, prompt)
  }

  /**
   * 获取临时目录路径
   */
  getTempDir(): string {
    return this.tempDir
  }

  /**
   * 清理临时文件
   */
  cleanupTempFiles(olderThanMs?: number): number {
    const threshold = olderThanMs || 24 * 60 * 60 * 1000 // 默认24小时
    const now = Date.now()
    let cleaned = 0

    try {
      const files = fs.readdirSync(this.tempDir)
      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        const stats = fs.statSync(filePath)
        
        if (now - stats.mtimeMs > threshold) {
          fs.unlinkSync(filePath)
          cleaned++
        }
      }
    } catch (e) {
      console.error('[Multimodal] Failed to cleanup temp files:', e)
    }

    return cleaned
  }
}

// 导出单例
export const multimodalService = new MultimodalService()
