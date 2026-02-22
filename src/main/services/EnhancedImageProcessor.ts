/**
 * 增强图像处理引擎
 * 提供高级图像分析、编辑、转换和优化功能
 */

import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import sharp from 'sharp'
import axios from 'axios'

// ============================================
// 图像处理操作类型
// ============================================
export enum ImageOperation {
  RESIZE = 'resize',
  CROP = 'crop',
  ROTATE = 'rotate',
  FLIP = 'flip',
  FILTER = 'filter',
  COMPRESS = 'compress',
  CONVERT = 'convert',
  WATERMARK = 'watermark',
  BLUR = 'blur',
  SHARPEN = 'sharpen',
  BRIGHTNESS = 'brightness',
  CONTRAST = 'contrast',
  SATURATION = 'saturation',
  GRAYSCALE = 'grayscale',
  REMOVE_BACKGROUND = 'remove_background',
  ENHANCE = 'enhance',
  DETECT_EDGES = 'detect_edges',
  DETECT_FACES = 'detect_faces',
  DETECT_OBJECTS = 'detect_objects',
  EXTRACT_TEXT = 'extract_text',
  GENERATE_CAPTION = 'generate_caption'
}

// ============================================
// 图像处理选项
// ============================================
export interface ImageProcessingOptions {
  resize?: {
    width?: number
    height?: number
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
    withoutEnlargement?: boolean
  }
  crop?: {
    left: number
    top: number
    width: number
    height: number
  }
  rotate?: {
    angle: number
    background?: string
  }
  flip?: {
    horizontal?: boolean
    vertical?: boolean
  }
  filter?: 'blur' | 'sharpen' | 'emboss' | 'sobel' | 'grayscale' | 'sepia' | 'invert'
  compress?: {
    quality?: number
    format?: 'jpeg' | 'png' | 'webp' | 'avif'
  }
  watermark?: {
    text?: string
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
    opacity?: number
    fontSize?: number
    color?: string
    imagePath?: string
  }
  enhance?: {
    brightness?: number
    contrast?: number
    saturation?: number
  }
  ai?: {
    removeBackground?: boolean
    detectFaces?: boolean
    detectObjects?: boolean
    extractText?: boolean
    generateCaption?: boolean
  }
}

// ============================================
// 图像处理结果
// ============================================
export interface ImageProcessingResult {
  success: boolean
  outputPath?: string
  originalPath: string
  operation: ImageOperation
  metadata?: {
    width: number
    height: number
    format: string
    size: number
    colorSpace?: string
    hasAlpha?: boolean
  }
  aiResults?: {
    faces?: Array<{ bbox: number[]; confidence: number; landmarks?: number[] }>
    objects?: Array<{ name: string; confidence: number; bbox: number[] }>
    text?: string
    caption?: string
    backgroundRemoved?: boolean
  }
  error?: string
  durationMs: number
}

// ============================================
// 图像分析结果
// ============================================
export interface ImageAnalysisResult {
  success: boolean
  path: string
  metadata: {
    width: number
    height: number
    format: string
    size: number
    colorSpace: string
    hasAlpha: boolean
    dominantColors: string[]
    brightness: number
    contrast: number
    sharpness: number
  }
  content: {
    description?: string
    tags?: string[]
    objects?: Array<{ name: string; confidence: number; bbox: number[] }>
    faces?: Array<{ bbox: number[]; confidence: number }>
    text?: string
    caption?: string
  }
  quality: {
    score: number
    issues: string[]
    recommendations: string[]
  }
  error?: string
}

// ============================================
// 增强图像处理引擎类
// ============================================
export class EnhancedImageProcessor extends EventEmitter {
  private tempDir: string
  private apiKeys: Record<string, string> = {}
  private cache: Map<string, ImageAnalysisResult> = new Map()

  constructor() {
    super()
    this.tempDir = path.join(app.getPath('temp'), 'image_processing')
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
      console.error('[ImageProcessor] Failed to load API keys:', e)
    }
  }

  // ============================================
  // 基础图像处理
  // ============================================

  async processImage(
    inputPath: string,
    operation: ImageOperation,
    options: ImageProcessingOptions = {}
  ): Promise<ImageProcessingResult> {
    const startTime = Date.now()

    if (!fs.existsSync(inputPath)) {
      return {
        success: false,
        originalPath: inputPath,
        operation,
        error: 'Input image not found',
        durationMs: Date.now() - startTime
      }
    }

    try {
      let image = sharp(inputPath)

      let outputPath = this.generateOutputPath(inputPath, operation)

      switch (operation) {
        case ImageOperation.RESIZE:
          image = this.applyResize(image, options.resize)
          break

        case ImageOperation.CROP:
          image = this.applyCrop(image, options.crop)
          break

        case ImageOperation.ROTATE:
          image = this.applyRotate(image, options.rotate)
          break

        case ImageOperation.FLIP:
          image = this.applyFlip(image, options.flip)
          break

        case ImageOperation.FILTER:
          image = this.applyFilter(image, options.filter)
          break

        case ImageOperation.COMPRESS:
          image = this.applyCompress(image, outputPath, options.compress)
          break

        case ImageOperation.WATERMARK:
          image = await this.applyWatermark(image, options.watermark)
          break

        case ImageOperation.BLUR:
          image = image.blur(3)
          break

        case ImageOperation.SHARPEN:
          image = image.sharpen()
          break

        case ImageOperation.BRIGHTNESS:
        case ImageOperation.CONTRAST:
        case ImageOperation.SATURATION:
          image = this.applyEnhancement(image, options.enhance)
          break

        case ImageOperation.GRAYSCALE:
          image = image.grayscale()
          break

        case ImageOperation.REMOVE_BACKGROUND:
          return await this.removeBackground(inputPath, options.ai?.removeBackground)

        case ImageOperation.DETECT_FACES:
        case ImageOperation.DETECT_OBJECTS:
        case ImageOperation.EXTRACT_TEXT:
        case ImageOperation.GENERATE_CAPTION:
          return await this.processWithAI(inputPath, operation)

        default:
          throw new Error(`Unsupported operation: ${operation}`)
      }

      if (operation !== ImageOperation.COMPRESS) {
        await image.toFile(outputPath)
      }

      const resultMetadata = await sharp(outputPath).metadata()
      const stats = fs.statSync(outputPath)

      this.emit('processed', { inputPath, outputPath, operation })

      return {
        success: true,
        outputPath,
        originalPath: inputPath,
        operation,
        metadata: {
          width: resultMetadata.width || 0,
          height: resultMetadata.height || 0,
          format: resultMetadata.format || 'unknown',
          size: stats.size,
          colorSpace: resultMetadata.space || 'srgb',
          hasAlpha: resultMetadata.hasAlpha || false
        },
        durationMs: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        originalPath: inputPath,
        operation,
        error: error.message,
        durationMs: Date.now() - startTime
      }
    }
  }

  // ============================================
  // 图像处理方法
  // ============================================

  private applyResize(image: sharp.Sharp, options?: ImageProcessingOptions['resize']): sharp.Sharp {
    if (!options) return image

    const { width, height, fit = 'cover', withoutEnlargement = false } = options

    const resizeOptions: any = { fit }
    if (width) resizeOptions.width = width
    if (height) resizeOptions.height = height
    if (withoutEnlargement) resizeOptions.withoutEnlargement = true

    return image.resize(resizeOptions)
  }

  private applyCrop(image: sharp.Sharp, options?: ImageProcessingOptions['crop']): sharp.Sharp {
    if (!options) return image

    const { left, top, width, height } = options
    return image.extract({ left, top, width, height })
  }

  private applyRotate(image: sharp.Sharp, options?: ImageProcessingOptions['rotate']): sharp.Sharp {
    if (!options) return image

    const { angle = 0, background = '#ffffff' } = options
    return image.rotate(angle, { background })
  }

  private applyFlip(image: sharp.Sharp, options?: ImageProcessingOptions['flip']): sharp.Sharp {
    if (!options) return image

    const { horizontal = false, vertical = false } = options

    if (horizontal) image = image.flop()
    if (vertical) image = image.flip()

    return image
  }

  private applyFilter(image: sharp.Sharp, filter?: string): sharp.Sharp {
    if (!filter) return image

    switch (filter) {
      case 'blur':
        return image.blur(5)
      case 'sharpen':
        return image.sharpen()
      case 'grayscale':
        return image.grayscale()
      case 'sepia':
        return image.modulate({ saturation: 0.5 }).tint({ r: 255, g: 240, b: 196 })
      case 'invert':
        return image.negate()
      default:
        return image
    }
  }

  private applyCompress(
    image: sharp.Sharp,
    outputPath: string,
    options?: ImageProcessingOptions['compress']
  ): sharp.Sharp {
    if (!options) return image

    const { quality = 80, format = 'jpeg' } = options
    const ext = path.extname(outputPath)

    switch (format) {
      case 'jpeg':
        return image.jpeg({ quality })
      case 'png':
        return image.png({ quality: Math.round(quality / 10) })
      case 'webp':
        return image.webp({ quality })
      case 'avif':
        return image.avif({ quality })
      default:
        return ext === '.png' ? image.png() : image.jpeg()
    }
  }

  private async applyWatermark(
    image: sharp.Sharp,
    options?: ImageProcessingOptions['watermark']
  ): Promise<sharp.Sharp> {
    if (!options) return image

    const { text, position = 'bottom-right', opacity = 0.5, fontSize = 24, color = '#ffffff', imagePath: watermarkPath } = options

    const metadata = await image.metadata()
    const imgWidth = metadata.width || 0
    const imgHeight = metadata.height || 0

    if (text) {
      const svgText = `
        <svg width="${imgWidth}" height="${imgHeight}">
          <text x="50%" y="50%" 
                dominant-baseline="middle" 
                text-anchor="middle" 
                font-size="${fontSize}" 
                fill="${color}" 
                fill-opacity="${opacity}">
            ${text}
          </text>
        </svg>
      `
      const svgBuffer = Buffer.from(svgText)
      return image.composite([{ input: svgBuffer, gravity: 'center' }])
    }

    if (watermarkPath && fs.existsSync(watermarkPath)) {
      const watermark = sharp(watermarkPath).resize(Math.floor(imgWidth * 0.2))
      const gravity = this.getGravity(position)
      return image.composite([{ input: await watermark.toBuffer(), gravity }])
    }

    return image
  }

  private applyEnhancement(image: sharp.Sharp, options?: ImageProcessingOptions['enhance']): sharp.Sharp {
    if (!options) return image

    const { brightness, contrast, saturation } = options
    const modulate: any = {}

    if (brightness !== undefined) modulate.brightness = brightness
    if (contrast !== undefined) modulate.contrast = contrast
    if (saturation !== undefined) modulate.saturation = saturation

    return Object.keys(modulate).length > 0 ? image.modulate(modulate) : image
  }

  private getGravity(position: string): string {
    const gravityMap: Record<string, string> = {
      'top-left': 'northwest',
      'top-right': 'northeast',
      'bottom-left': 'southwest',
      'bottom-right': 'southeast',
      'center': 'center'
    }
    return gravityMap[position] || 'southeast'
  }

  // ============================================
  // AI图像处理
  // ============================================

  private async removeBackground(
    inputPath: string,
    enabled?: boolean
  ): Promise<ImageProcessingResult> {
    if (!enabled) {
      return {
        success: false,
        originalPath: inputPath,
        operation: ImageOperation.REMOVE_BACKGROUND,
        error: 'Background removal not enabled',
        durationMs: 0
      }
    }

    try {
      const apiKey = this.apiKeys.removebg || this.apiKeys['remove-background']
      if (!apiKey) {
        return {
          success: false,
          originalPath: inputPath,
          operation: ImageOperation.REMOVE_BACKGROUND,
          error: 'Remove.bg API key not configured',
          durationMs: 0
        }
      }

      const formData = new FormData()
      formData.append('image_file', new Blob([fs.readFileSync(inputPath)]), 'image.png')
      formData.append('size', 'auto')

      const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
        headers: {
          'X-Api-Key': apiKey
        },
        responseType: 'arraybuffer',
        timeout: 60000
      })

      const outputPath = this.generateOutputPath(inputPath, ImageOperation.REMOVE_BACKGROUND)
      fs.writeFileSync(outputPath, response.data)

      return {
        success: true,
        outputPath,
        originalPath: inputPath,
        operation: ImageOperation.REMOVE_BACKGROUND,
        aiResults: {
          backgroundRemoved: true
        },
        durationMs: 0
      }
    } catch (error: any) {
      return {
        success: false,
        originalPath: inputPath,
        operation: ImageOperation.REMOVE_BACKGROUND,
        error: error.message,
        durationMs: 0
      }
    }
  }

  private async processWithAI(
    inputPath: string,
    operation: ImageOperation
  ): Promise<ImageProcessingResult> {
    const startTime = Date.now()

    try {
      const apiKey = this.apiKeys.openai || this.apiKeys.gpt4
      if (!apiKey) {
        return {
          success: false,
          originalPath: inputPath,
          operation,
          error: 'OpenAI API key not configured',
          durationMs: Date.now() - startTime
        }
      }

      const imageData = fs.readFileSync(inputPath)
      const base64Image = imageData.toString('base64')

      let prompt = ''
      switch (operation) {
        case ImageOperation.DETECT_FACES:
          prompt = 'Detect all faces in this image. Return bounding boxes and confidence scores.'
          break
        case ImageOperation.DETECT_OBJECTS:
          prompt = 'Identify all objects in this image. Return object names, bounding boxes, and confidence scores.'
          break
        case ImageOperation.EXTRACT_TEXT:
          prompt = 'Extract all text visible in this image. Return the exact text content.'
          break
        case ImageOperation.GENERATE_CAPTION:
          prompt = 'Describe this image in detail. Include main subjects, colors, composition, and mood.'
          break
      }

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
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
      const aiResults = this.parseAIResponse(content, operation)

      return {
        success: true,
        originalPath: inputPath,
        operation,
        aiResults,
        durationMs: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        originalPath: inputPath,
        operation,
        error: error.message,
        durationMs: Date.now() - startTime
      }
    }
  }

  private parseAIResponse(content: string, operation: ImageOperation): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      switch (operation) {
        case ImageOperation.DETECT_FACES:
          return { faces: this.extractBoundingBoxes(content, 'face') }
        case ImageOperation.DETECT_OBJECTS:
          return { objects: this.extractObjects(content) }
        case ImageOperation.EXTRACT_TEXT:
          return { text: this.extractText(content) }
        case ImageOperation.GENERATE_CAPTION:
          return { caption: content }
        default:
          return {}
      }
    } catch {
      return {}
    }
  }

  private extractBoundingBoxes(content: string, type: string): Array<{ bbox: number[]; confidence: number }> {
    const pattern = new RegExp(`${type}\\s*[:\\s]*\\[(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\]`, 'gi')
    const matches = Array.from(content.matchAll(pattern))
    return matches.map((m: RegExpExecArray) => ({
      bbox: [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), parseInt(m[4])],
      confidence: 0.85
    }))
  }

  private extractObjects(content: string): Array<{ name: string; confidence: number; bbox: number[] }> {
    const objects: any[] = []
    const lines = content.split('\n')
    
    for (const line of lines) {
      const match = line.match(/-\\s*(\\w+)\\s*\\[(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\]/i)
      if (match) {
        objects.push({
          name: match[1],
          bbox: [parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5])],
          confidence: 0.8
        })
      }
    }
    
    return objects
  }

  private extractText(content: string): string {
    const textMatch = content.match(/text[:\\s]+([^.]+)/i)
    return textMatch ? textMatch[1].trim() : content
  }

  // ============================================
  // 图像分析
  // ============================================

  async analyzeImage(inputPath: string): Promise<ImageAnalysisResult> {
    const cacheKey = `${inputPath}_${fs.statSync(inputPath).mtimeMs}`

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    if (!fs.existsSync(inputPath)) {
      return {
        success: false,
        path: inputPath,
        metadata: { width: 0, height: 0, format: '', size: 0, colorSpace: '', hasAlpha: false, dominantColors: [], brightness: 0, contrast: 0, sharpness: 0 },
        content: {},
        quality: { score: 0, issues: [], recommendations: [] },
        error: 'Image file not found'
      }
    }

    try {
      const image = sharp(inputPath)
      const metadata = await image.metadata()
      const stats = fs.statSync(inputPath)

      const dominantColors = await this.extractDominantColors(image)
      const brightness = await this.calculateBrightness(image)
      const contrast = await this.calculateContrast(image)
      const sharpness = await this.calculateSharpness(image)

      const qualityAssessment = this.assessImageQuality({
        brightness,
        contrast,
        sharpness,
        size: stats.size,
        format: metadata.format || ''
      })

      const aiContent = await this.getAIContent(inputPath)

      const result: ImageAnalysisResult = {
        success: true,
        path: inputPath,
        metadata: {
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: metadata.format || 'unknown',
          size: stats.size,
          colorSpace: metadata.space || 'srgb',
          hasAlpha: metadata.hasAlpha || false,
          dominantColors,
          brightness,
          contrast,
          sharpness
        },
        content: aiContent,
        quality: qualityAssessment
      }

      this.cache.set(cacheKey, result)
      this.emit('analyzed', { path: inputPath, result })

      return result
    } catch (error: any) {
      return {
        success: false,
        path: inputPath,
        metadata: { width: 0, height: 0, format: '', size: 0, colorSpace: '', hasAlpha: false, dominantColors: [], brightness: 0, contrast: 0, sharpness: 0 },
        content: {},
        quality: { score: 0, issues: [], recommendations: [] },
        error: error.message
      }
    }
  }

  private async extractDominantColors(image: sharp.Sharp): Promise<string[]> {
    const { dominant } = await image.stats()
    return Object.entries(dominant)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([color]) => `#${color}`)
  }

  private async calculateBrightness(image: sharp.Sharp): Promise<number> {
    const { channels } = await image.stats()
    return channels.reduce((sum, ch) => sum + ch.mean, 0) / channels.length
  }

  private async calculateContrast(image: sharp.Sharp): Promise<number> {
    const { channels } = await image.stats()
    const stdDevs = channels.map(ch => ch.stdev)
    return stdDevs.reduce((sum, sd) => sum + sd, 0) / stdDevs.length
  }

  private async calculateSharpness(image: sharp.Sharp): Promise<number> {
    const resized = await image.resize(100, 100, { fit: 'cover' }).toBuffer()
    const { channels } = await sharp(resized).stats()
    const sum = channels.reduce((acc: number, ch: any) => acc + ch.stdev, 0)
    return sum / channels.length
  }

  private assessImageQuality(metrics: any): { score: number; issues: string[]; recommendations: string[] } {
    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    if (metrics.brightness < 50) {
      issues.push('Image is too dark')
      recommendations.push('Increase brightness')
      score -= 15
    } else if (metrics.brightness > 200) {
      issues.push('Image is too bright')
      recommendations.push('Decrease brightness')
      score -= 15
    }

    if (metrics.contrast < 30) {
      issues.push('Low contrast')
      recommendations.push('Apply contrast enhancement')
      score -= 10
    }

    if (metrics.sharpness < 20) {
      issues.push('Image is blurry')
      recommendations.push('Apply sharpening')
      score -= 15
    }

    if (metrics.size > 5 * 1024 * 1024) {
      issues.push('Large file size')
      recommendations.push('Consider compression')
      score -= 10
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations
    }
  }

  private async getAIContent(inputPath: string): Promise<any> {
    const apiKey = this.apiKeys.openai || this.apiKeys.gpt4
    if (!apiKey) {
      return {}
    }

    try {
      const imageData = fs.readFileSync(inputPath)
      const base64Image = imageData.toString('base64')

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analyze this image. Describe the main subjects, objects, colors, composition, and any text visible. Also provide relevant tags.' },
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
      return this.parseAIContent(content)
    } catch {
      return {}
    }
  }

  private parseAIContent(content: string): any {
    const tags = this.extractTags(content)
    const objects = this.extractObjects(content)
    const text = this.extractText(content)

    return {
      description: content,
      tags,
      objects,
      text: text || undefined,
      caption: content
    }
  }

  private extractTags(content: string): string[] {
    const commonTags = ['person', 'animal', 'vehicle', 'building', 'nature', 'indoor', 'outdoor', 'text', 'document', 'screen', 'code', 'interface']
    const found = commonTags.filter(tag => content.toLowerCase().includes(tag))
    return found.length > 0 ? found : ['image']
  }

  // ============================================
  // 批量处理
  // ============================================

  async batchProcess(
    inputPaths: string[],
    operation: ImageOperation,
    options: ImageProcessingOptions = {}
  ): Promise<ImageProcessingResult[]> {
    const results: ImageProcessingResult[] = []

    for (const inputPath of inputPaths) {
      const result = await this.processImage(inputPath, operation, options)
      results.push(result)
    }

    this.emit('batchProcessed', { operation, results })
    return results
  }

  // ============================================
  // 工具方法
  // ============================================

  private generateOutputPath(inputPath: string, operation: ImageOperation): string {
    const timestamp = Date.now()
    const ext = path.extname(inputPath)
    const basename = path.basename(inputPath, ext)
    return path.join(this.tempDir, `${basename}_${operation}_${timestamp}${ext}`)
  }

  getTempDir(): string {
    return this.tempDir
  }

  clearCache(): void {
    this.cache.clear()
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
      console.error('[ImageProcessor] Failed to cleanup:', e)
    }

    return cleaned
  }
}

export const enhancedImageProcessor = new EnhancedImageProcessor()
