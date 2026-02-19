/**
 * 增强图像生成引擎
 * 提供高级AI图像生成、编辑、修复和风格转换功能
 */

import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import axios from 'axios'
import sharp from 'sharp'

// ============================================
// 图像生成模型
// ============================================
export enum ImageGenerationModel {
  DALLE3 = 'dall-e-3',
  DALLE2 = 'dall-e-2',
  STABLE_DIFFUSION = 'stable-diffusion',
  MIDJOURNEY = 'midjourney',
  CUSTOM = 'custom'
}

// ============================================
// 图像生成选项
// ============================================
export interface ImageGenerationOptions {
  model?: ImageGenerationModel
  prompt: string
  negativePrompt?: string
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  n?: number
  seed?: number
  steps?: number
  guidanceScale?: number
  width?: number
  height?: number
  format?: 'png' | 'jpeg' | 'webp'
  imageQuality?: number
}

// ============================================
// 图像编辑选项
// ============================================
export interface ImageEditOptions {
  image: string
  mask?: string
  prompt: string
  n?: number
  size?: '256x256' | '512x512' | '1024x1024'
}

// ============================================
// 图像变体选项
// ============================================
export interface ImageVariationOptions {
  image: string
  n?: number
  size?: '256x256' | '512x512' | '1024x1024'
}

// ============================================
// 图像修复选项
// ============================================
export interface ImageInpaintingOptions {
  image: string
  mask: string
  prompt: string
  n?: number
  size?: '256x256' | '512x512' | '1024x1024'
}

// ============================================
// 图像扩展选项
// ============================================
export interface ImageOutpaintingOptions {
  image: string
  prompt?: string
  direction?: 'left' | 'right' | 'top' | 'bottom'
  pixels?: number
  n?: number
}

// ============================================
// 图像风格转换选项
// ============================================
export interface ImageStyleTransferOptions {
  contentImage: string
  styleImage: string
  strength?: number
  preserveColor?: boolean
}

// ============================================
// 图像生成结果
// ============================================
export interface ImageGenerationResult {
  success: boolean
  images: string[]
  model: ImageGenerationModel
  prompt: string
  metadata?: {
    width: number
    height: number
    format: string
    size: number
    seed?: number
    steps?: number
    guidanceScale?: number
  }
  error?: string
  durationMs: number
}

// ============================================
// 图像编辑结果
// ============================================
export interface ImageEditResult {
  success: boolean
  images: string[]
  originalImage: string
  operation: 'edit' | 'variation' | 'inpainting' | 'outpainting' | 'style_transfer'
  error?: string
  durationMs: number
}

// ============================================
// 提示词增强结果
// ============================================
export interface PromptEnhancementResult {
  success: boolean
  originalPrompt: string
  enhancedPrompt: string
  suggestions: string[]
  tags: string[]
  style: string
  mood: string
  error?: string
}

// ============================================
// 增强图像生成引擎类
// ============================================
export class EnhancedImageGenerator extends EventEmitter {
  private tempDir: string
  private apiKeys: Record<string, string> = {}
  private promptCache: Map<string, PromptEnhancementResult> = new Map()
  private generationHistory: ImageGenerationResult[] = []

  constructor() {
    super()
    this.tempDir = path.join(app.getPath('temp'), 'image_generation')
    this.ensureTempDir()
    this.loadApiKeys()
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  private loadApiKeys(): void {
    const keysPath = path.join(app.getPath('userData'), 'apiKeys.json')
    try {
      if (fs.existsSync(keysPath)) {
        this.apiKeys = JSON.parse(fs.readFileSync(keysPath, 'utf-8'))
      }
    } catch (e) {
      console.error('[ImageGenerator] Failed to load API keys:', e)
    }
  }

  // ============================================
  // 图像生成
  // ============================================

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const startTime = Date.now()

    if (!options.prompt || options.prompt.trim() === '') {
      return {
        success: false,
        images: [],
        model: options.model || ImageGenerationModel.DALLE3,
        prompt: options.prompt,
        error: 'Prompt is required',
        durationMs: Date.now() - startTime
      }
    }

    try {
      const model = options.model || ImageGenerationModel.DALLE3

      let result: ImageGenerationResult

      switch (model) {
        case ImageGenerationModel.DALLE3:
        case ImageGenerationModel.DALLE2:
          result = await this.generateWithDalle(options)
          break
        case ImageGenerationModel.STABLE_DIFFUSION:
          result = await this.generateWithStableDiffusion(options)
          break
        case ImageGenerationModel.MIDJOURNEY:
          result = await this.generateWithMidjourney(options)
          break
        case ImageGenerationModel.CUSTOM:
          result = await this.generateWithCustomModel(options)
          break
        default:
          throw new Error(`Unsupported model: ${model}`)
      }

      this.addToHistory(result)
      this.emit('generated', { options, result })

      return result
    } catch (error: any) {
      return {
        success: false,
        images: [],
        model: options.model || ImageGenerationModel.DALLE3,
        prompt: options.prompt,
        error: error.message,
        durationMs: Date.now() - startTime
      }
    }
  }

  // ============================================
  // DALL-E 生成
  // ============================================

  private async generateWithDalle(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const startTime = Date.now()
    const apiKey = this.apiKeys.openai || this.apiKeys.dalle

    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const model = options.model === ImageGenerationModel.DALLE2 ? 'dall-e-2' : 'dall-e-3'

    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model,
        prompt: options.prompt,
        n: options.n || 1,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        style: options.style || 'vivid'
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    )

    const images: string[] = []

    for (const img of response.data.data) {
      const imagePath = await this.downloadImage(img.url, model)
      if (imagePath) {
        images.push(imagePath)
      }
    }

    const stats = images.length > 0 ? fs.statSync(images[0]) : { size: 0 }
    const metadata = await sharp(images[0]).metadata()

    return {
      success: true,
      images,
      model: options.model || ImageGenerationModel.DALLE3,
      prompt: options.prompt,
      metadata: {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'png',
        size: stats.size,
        seed: options.seed,
        steps: options.steps,
        guidanceScale: options.guidanceScale
      },
      durationMs: Date.now() - startTime
    }
  }

  // ============================================
  // Stable Diffusion 生成
  // ============================================

  private async generateWithStableDiffusion(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const startTime = Date.now()
    const apiKey = this.apiKeys.stability || this.apiKeys['stable-diffusion']

    if (!apiKey) {
      throw new Error('Stability AI API key not configured')
    }

    const width = options.width || 1024
    const height = options.height || 1024

    const response = await axios.post(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        text_prompts: [
          { text: options.prompt, weight: 1.0 },
          ...(options.negativePrompt ? [{ text: options.negativePrompt, weight: -1.0 }] : [])
        ],
        cfg_scale: options.guidanceScale || 7.0,
        height,
        width,
        steps: options.steps || 30,
        samples: options.n || 1,
        seed: options.seed || 0
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 120000
      }
    )

    const images: string[] = []

    for (const artifact of response.data.artifacts) {
      const imagePath = await this.saveBase64Image(artifact.base64, 'stable-diffusion')
      if (imagePath) {
        images.push(imagePath)
      }
    }

    const stats = images.length > 0 ? fs.statSync(images[0]) : { size: 0 }
    const metadata = await sharp(images[0]).metadata()

    return {
      success: true,
      images,
      model: ImageGenerationModel.STABLE_DIFFUSION,
      prompt: options.prompt,
      metadata: {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'png',
        size: stats.size,
        seed: options.seed,
        steps: options.steps,
        guidanceScale: options.guidanceScale
      },
      durationMs: Date.now() - startTime
    }
  }

  // ============================================
  // Midjourney 生成
  // ============================================

  private async generateWithMidjourney(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const startTime = Date.now()
    const apiKey = this.apiKeys.midjourney

    if (!apiKey) {
      throw new Error('Midjourney API key not configured')
    }

    const response = await axios.post(
      'https://api.midjourney.com/v1/imagine',
      {
        prompt: options.prompt,
        aspect_ratio: options.size === '1024x1792' ? '9:16' : options.size === '1792x1024' ? '16:9' : '1:1',
        quality: options.quality || 'standard',
        style: options.style || 'vivid'
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000
      }
    )

    const images: string[] = []

    for (const url of response.data.images) {
      const imagePath = await this.downloadImage(url, 'midjourney')
      if (imagePath) {
        images.push(imagePath)
      }
    }

    const stats = images.length > 0 ? fs.statSync(images[0]) : { size: 0 }
    const metadata = await sharp(images[0]).metadata()

    return {
      success: true,
      images,
      model: ImageGenerationModel.MIDJOURNEY,
      prompt: options.prompt,
      metadata: {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'png',
        size: stats.size
      },
      durationMs: Date.now() - startTime
    }
  }

  // ============================================
  // 自定义模型生成
  // ============================================

  private async generateWithCustomModel(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const startTime = Date.now()
    const apiKey = this.apiKeys.custom || this.apiKeys.huggingface

    if (!apiKey) {
      throw new Error('Custom model API key not configured')
    }

    const response = await axios.post(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        inputs: options.prompt,
        parameters: {
          negative_prompt: options.negativePrompt,
          num_inference_steps: options.steps || 30,
          guidance_scale: options.guidanceScale || 7.0,
          width: options.width || 1024,
          height: options.height || 1024
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        responseType: 'arraybuffer',
        timeout: 120000
      }
    )

    const imagePath = await this.saveBase64Image(Buffer.from(response.data).toString('base64'), 'custom-model')
    const images = imagePath ? [imagePath] : []

    const stats = images.length > 0 ? fs.statSync(images[0]) : { size: 0 }
    const metadata = await sharp(images[0]).metadata()

    return {
      success: true,
      images,
      model: ImageGenerationModel.CUSTOM,
      prompt: options.prompt,
      metadata: {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'png',
        size: stats.size,
        seed: options.seed,
        steps: options.steps,
        guidanceScale: options.guidanceScale
      },
      durationMs: Date.now() - startTime
    }
  }

  // ============================================
  // 图像编辑
  // ============================================

  async editImage(options: ImageEditOptions): Promise<ImageEditResult> {
    const startTime = Date.now()

    if (!fs.existsSync(options.image)) {
      return {
        success: false,
        images: [],
        originalImage: options.image,
        operation: 'edit',
        error: 'Image file not found',
        durationMs: Date.now() - startTime
      }
    }

    try {
      const apiKey = this.apiKeys.openai || this.apiKeys.dalle

      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const formData = new FormData()
      formData.append('image', new Blob([fs.readFileSync(options.image)]), 'image.png')
      formData.append('prompt', options.prompt)
      formData.append('n', String(options.n || 1))
      formData.append('size', options.size || '1024x1024')

      if (options.mask && fs.existsSync(options.mask)) {
        formData.append('mask', new Blob([fs.readFileSync(options.mask)]), 'mask.png')
      }

      const response = await axios.post(
        'https://api.openai.com/v1/images/edits',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 120000
        }
      )

      const images: string[] = []

      for (const img of response.data.data) {
        const imagePath = await this.downloadImage(img.url, 'edit')
        if (imagePath) {
          images.push(imagePath)
        }
      }

      this.emit('edited', { options, images })

      return {
        success: true,
        images,
        originalImage: options.image,
        operation: 'edit',
        durationMs: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        images: [],
        originalImage: options.image,
        operation: 'edit',
        error: error.message,
        durationMs: Date.now() - startTime
      }
    }
  }

  // ============================================
  // 图像变体
  // ============================================

  async createVariations(options: ImageVariationOptions): Promise<ImageEditResult> {
    const startTime = Date.now()

    if (!fs.existsSync(options.image)) {
      return {
        success: false,
        images: [],
        originalImage: options.image,
        operation: 'variation',
        error: 'Image file not found',
        durationMs: Date.now() - startTime
      }
    }

    try {
      const apiKey = this.apiKeys.openai || this.apiKeys.dalle

      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const formData = new FormData()
      formData.append('image', new Blob([fs.readFileSync(options.image)]), 'image.png')
      formData.append('n', String(options.n || 1))
      formData.append('size', options.size || '1024x1024')

      const response = await axios.post(
        'https://api.openai.com/v1/images/variations',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 120000
        }
      )

      const images: string[] = []

      for (const img of response.data.data) {
        const imagePath = await this.downloadImage(img.url, 'variation')
        if (imagePath) {
          images.push(imagePath)
        }
      }

      this.emit('variationCreated', { options, images })

      return {
        success: true,
        images,
        originalImage: options.image,
        operation: 'variation',
        durationMs: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        images: [],
        originalImage: options.image,
        operation: 'variation',
        error: error.message,
        durationMs: Date.now() - startTime
      }
    }
  }

  // ============================================
  // 图像修复
  // ============================================

  async inpaintImage(options: ImageInpaintingOptions): Promise<ImageEditResult> {
    const startTime = Date.now()

    if (!fs.existsSync(options.image) || !fs.existsSync(options.mask)) {
      return {
        success: false,
        images: [],
        originalImage: options.image,
        operation: 'inpainting',
        error: 'Image or mask file not found',
        durationMs: Date.now() - startTime
      }
    }

    try {
      const apiKey = this.apiKeys.stability || this.apiKeys['stable-diffusion']

      if (!apiKey) {
        throw new Error('Stability AI API key not configured')
      }

      const imageBase64 = fs.readFileSync(options.image).toString('base64')
      const maskBase64 = fs.readFileSync(options.mask).toString('base64')

      const response = await axios.post(
        'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image/masking',
        {
          text_prompts: [{ text: options.prompt, weight: 1.0 }],
          init_image: imageBase64,
          mask_image: maskBase64,
          cfg_scale: 7.0,
          samples: options.n || 1,
          steps: 30
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000
        }
      )

      const images: string[] = []

      for (const artifact of response.data.artifacts) {
        const imagePath = await this.saveBase64Image(artifact.base64, 'inpainting')
        if (imagePath) {
          images.push(imagePath)
        }
      }

      this.emit('inpainted', { options, images })

      return {
        success: true,
        images,
        originalImage: options.image,
        operation: 'inpainting',
        durationMs: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        images: [],
        originalImage: options.image,
        operation: 'inpainting',
        error: error.message,
        durationMs: Date.now() - startTime
      }
    }
  }

  // ============================================
  // 图像扩展
  // ============================================

  async outpaintImage(options: ImageOutpaintingOptions): Promise<ImageEditResult> {
    const startTime = Date.now()

    if (!fs.existsSync(options.image)) {
      return {
        success: false,
        images: [],
        originalImage: options.image,
        operation: 'outpainting',
        error: 'Image file not found',
        durationMs: Date.now() - startTime
      }
    }

    try {
      const apiKey = this.apiKeys.openai || this.apiKeys.dalle

      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const metadata = await sharp(options.image).metadata()
      const width = metadata.width || 1024
      const height = metadata.height || 1024
      const pixels = options.pixels || 512

      const formData = new FormData()
      formData.append('image', new Blob([fs.readFileSync(options.image)]), 'image.png')
      formData.append('prompt', options.prompt || 'Continue the image')
      formData.append('n', String(options.n || 1))
      formData.append('size', `${width + pixels}x${height + pixels}`)

      const response = await axios.post(
        'https://api.openai.com/v1/images/edits',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 120000
        }
      )

      const images: string[] = []

      for (const img of response.data.data) {
        const imagePath = await this.downloadImage(img.url, 'outpainting')
        if (imagePath) {
          images.push(imagePath)
        }
      }

      this.emit('outpainted', { options, images })

      return {
        success: true,
        images,
        originalImage: options.image,
        operation: 'outpainting',
        durationMs: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        images: [],
        originalImage: options.image,
        operation: 'outpainting',
        error: error.message,
        durationMs: Date.now() - startTime
      }
    }
  }

  // ============================================
  // 提示词增强
  // ============================================

  async enhancePrompt(prompt: string): Promise<PromptEnhancementResult> {
    if (this.promptCache.has(prompt)) {
      return this.promptCache.get(prompt)!
    }

    try {
      const apiKey = this.apiKeys.openai || this.apiKeys.gpt4

      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating detailed, artistic image generation prompts. Enhance the user\'s prompt with artistic details, style, mood, and composition suggestions.'
            },
            {
              role: 'user',
              content: `Enhance this image generation prompt: "${prompt}"`
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )

      const content = response.data.choices[0]?.message?.content || ''
      const result = this.parseEnhancedPrompt(content, prompt)

      this.promptCache.set(prompt, result)
      this.emit('promptEnhanced', { original: prompt, enhanced: result })

      return result
    } catch (error: any) {
      return {
        success: false,
        originalPrompt: prompt,
        enhancedPrompt: prompt,
        suggestions: [],
        tags: [],
        style: '',
        mood: '',
        error: error.message
      }
    }
  }

  private parseEnhancedPrompt(content: string, original: string): PromptEnhancementResult {
    const suggestions: string[] = []
    const tags: string[] = []

    const lines = content.split('\n')
    let enhancedPrompt = original
    let style = ''
    let mood = ''

    for (const line of lines) {
      if (line.toLowerCase().includes('enhanced prompt:')) {
        enhancedPrompt = line.replace(/enhanced prompt:?/i, '').trim()
      } else if (line.toLowerCase().includes('style:')) {
        style = line.replace(/style:?/i, '').trim()
      } else if (line.toLowerCase().includes('mood:')) {
        mood = line.replace(/mood:?/i, '').trim()
      } else if (line.startsWith('-')) {
        suggestions.push(line.replace(/^-\s*/, '').trim())
      } else if (line.startsWith('#')) {
        tags.push(line.replace(/^#\s*/, '').trim())
      }
    }

    return {
      success: true,
      originalPrompt: original,
      enhancedPrompt,
      suggestions,
      tags,
      style,
      mood
    }
  }

  // ============================================
  // 批量生成
  // ============================================

  async batchGenerate(prompts: string[], options: Omit<ImageGenerationOptions, 'prompt'>): Promise<ImageGenerationResult[]> {
    const results: ImageGenerationResult[] = []

    for (const prompt of prompts) {
      const result = await this.generateImage({ ...options, prompt })
      results.push(result)
    }

    this.emit('batchGenerated', { prompts, options, results })
    return results
  }

  // ============================================
  // 工具方法
  // ============================================

  private async downloadImage(url: string, prefix: string): Promise<string | null> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 })
      const ext = this.getImageExtension(url)
      const outputPath = path.join(this.tempDir, `${prefix}_${Date.now()}${ext}`)
      fs.writeFileSync(outputPath, response.data)
      return outputPath
    } catch (error) {
      console.error('[ImageGenerator] Failed to download image:', error)
      return null
    }
  }

  private async saveBase64Image(base64: string, prefix: string): Promise<string | null> {
    try {
      const buffer = Buffer.from(base64, 'base64')
      const outputPath = path.join(this.tempDir, `${prefix}_${Date.now()}.png`)
      fs.writeFileSync(outputPath, buffer)
      return outputPath
    } catch (error) {
      console.error('[ImageGenerator] Failed to save base64 image:', error)
      return null
    }
  }

  private getImageExtension(url: string): string {
    const match = url.match(/\.(jpg|jpeg|png|webp|gif)/i)
    return match ? `.${match[1].toLowerCase()}` : '.png'
  }

  private addToHistory(result: ImageGenerationResult): void {
    this.generationHistory.push(result)
    if (this.generationHistory.length > 100) {
      this.generationHistory.shift()
    }
  }

  getHistory(): ImageGenerationResult[] {
    return [...this.generationHistory]
  }

  clearHistory(): void {
    this.generationHistory = []
  }

  clearPromptCache(): void {
    this.promptCache.clear()
  }

  getTempDir(): string {
    return this.tempDir
  }

  cleanup(olderThanMs?: number): number {
    const threshold = olderThanMs || 24 * 60 * 60 * 1000
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
      console.error('[ImageGenerator] Failed to cleanup:', e)
    }

    return cleaned
  }
}

export const enhancedImageGenerator = new EnhancedImageGenerator()
