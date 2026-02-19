/**
 * 图像处理和生成功能测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { enhancedImageProcessor, ImageOperation } from '../../src/main/services/EnhancedImageProcessor'
import { enhancedImageGenerator, ImageGenerationModel } from '../../src/main/services/EnhancedImageGenerator'
import { multimodalReasoningEngine, MultimodalReasoningType } from '../../src/main/services/MultimodalReasoningEngine'
import { toolRegistry } from '../../src/main/agent/ToolRegistry'
import * as fs from 'fs'
import * as path from 'path'

describe('Enhanced Image Processing', () => {
  const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png')
  const outputDir = path.join(__dirname, 'output')

  beforeEach(() => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
  })

  describe('图像处理引擎', () => {
    it('应该初始化成功', () => {
      expect(enhancedImageProcessor).toBeDefined()
      expect(enhancedImageProcessor.getTempDir()).toBeDefined()
    })

    it('应该调整图像大小', async () => {
      if (!fs.existsSync(testImagePath)) {
        console.log('Test image not found, skipping resize test')
        return
      }

      const result = await enhancedImageProcessor.processImage(
        testImagePath,
        ImageOperation.RESIZE,
        {
          resize: {
            width: 512,
            height: 512,
            fit: 'cover'
          }
        }
      )

      expect(result.success).toBe(true)
      expect(result.outputPath).toBeDefined()
      expect(result.metadata?.width).toBe(512)
      expect(result.metadata?.height).toBe(512)

      if (result.outputPath && fs.existsSync(result.outputPath)) {
        fs.unlinkSync(result.outputPath)
      }
    })

    it('应该裁剪图像', async () => {
      if (!fs.existsSync(testImagePath)) {
        console.log('Test image not found, skipping crop test')
        return
      }

      const result = await enhancedImageProcessor.processImage(
        testImagePath,
        ImageOperation.CROP,
        {
          crop: {
            left: 100,
            top: 100,
            width: 200,
            height: 200
          }
        }
      )

      expect(result.success).toBe(true)
      expect(result.outputPath).toBeDefined()
      expect(result.metadata?.width).toBe(200)
      expect(result.metadata?.height).toBe(200)

      if (result.outputPath && fs.existsSync(result.outputPath)) {
        fs.unlinkSync(result.outputPath)
      }
    })

    it('应该旋转图像', async () => {
      if (!fs.existsSync(testImagePath)) {
        console.log('Test image not found, skipping rotate test')
        return
      }

      const result = await enhancedImageProcessor.processImage(
        testImagePath,
        ImageOperation.ROTATE,
        {
          rotate: {
            angle: 90,
            background: '#ffffff'
          }
        }
      )

      expect(result.success).toBe(true)
      expect(result.outputPath).toBeDefined()

      if (result.outputPath && fs.existsSync(result.outputPath)) {
        fs.unlinkSync(result.outputPath)
      }
    })

    it('应该应用滤镜', async () => {
      if (!fs.existsSync(testImagePath)) {
        console.log('Test image not found, skipping filter test')
        return
      }

      const result = await enhancedImageProcessor.processImage(
        testImagePath,
        ImageOperation.FILTER,
        {
          filter: 'grayscale'
        }
      )

      expect(result.success).toBe(true)
      expect(result.outputPath).toBeDefined()

      if (result.outputPath && fs.existsSync(result.outputPath)) {
        fs.unlinkSync(result.outputPath)
      }
    })

    it('应该压缩图像', async () => {
      if (!fs.existsSync(testImagePath)) {
        console.log('Test image not found, skipping compress test')
        return
      }

      const result = await enhancedImageProcessor.processImage(
        testImagePath,
        ImageOperation.COMPRESS,
        {
          compress: {
            quality: 50,
            format: 'jpeg'
          }
        }
      )

      expect(result.success).toBe(true)
      expect(result.outputPath).toBeDefined()
      expect(result.metadata?.format).toBe('jpeg')

      if (result.outputPath && fs.existsSync(result.outputPath)) {
        fs.unlinkSync(result.outputPath)
      }
    })

    it('应该分析图像', async () => {
      if (!fs.existsSync(testImagePath)) {
        console.log('Test image not found, skipping analysis test')
        return
      }

      const result = await enhancedImageProcessor.analyzeImage(testImagePath)

      expect(result.success).toBe(true)
      expect(result.metadata).toBeDefined()
      expect(result.metadata.width).toBeGreaterThan(0)
      expect(result.metadata.height).toBeGreaterThan(0)
      expect(result.metadata.dominantColors).toBeDefined()
      expect(result.metadata.brightness).toBeGreaterThanOrEqual(0)
      expect(result.metadata.contrast).toBeGreaterThanOrEqual(0)
      expect(result.metadata.sharpness).toBeGreaterThanOrEqual(0)
      expect(result.quality).toBeDefined()
      expect(result.quality.score).toBeGreaterThanOrEqual(0)
      expect(result.quality.score).toBeLessThanOrEqual(100)
    })
  })

  describe('图像生成引擎', () => {
    it('应该初始化成功', () => {
      expect(enhancedImageGenerator).toBeDefined()
      expect(enhancedImageGenerator.getTempDir()).toBeDefined()
    })

    it('应该增强提示词', async () => {
      const result = await enhancedImageGenerator.enhancePrompt('一只可爱的猫咪')

      expect(result).toBeDefined()
      expect(result.originalPrompt).toBe('一只可爱的猫咪')
      expect(result.enhancedPrompt).toBeDefined()
      expect(result.enhancedPrompt.length).toBeGreaterThan(result.originalPrompt.length)
    })

    it('应该处理无效提示词', async () => {
      const result = await enhancedImageGenerator.enhancePrompt('')

      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('多模态推理引擎', () => {
    it('应该初始化成功', () => {
      expect(multimodalReasoningEngine).toBeDefined()
      expect(multimodalReasoningEngine.getCapabilities()).toBeDefined()
    })

    it('应该获取历史记录', () => {
      const history = multimodalReasoningEngine.getHistory()
      expect(Array.isArray(history)).toBe(true)
    })

    it('应该清除历史记录', () => {
      multimodalReasoningEngine.clearHistory()
      const history = multimodalReasoningEngine.getHistory()
      expect(history.length).toBe(0)
    })
  })

  describe('图像处理工具', () => {
    it('应该注册所有图像处理工具', () => {
      const tools = [
        'image_resize',
        'image_crop',
        'image_rotate',
        'image_flip',
        'image_filter',
        'image_compress',
        'image_watermark',
        'image_enhance',
        'image_analyze',
        'image_generate',
        'image_edit',
        'image_variations',
        'image_enhance_prompt',
        'multimodal_understand',
        'multimodal_text_to_image',
        'multimodal_image_to_text',
        'multimodal_vqa',
        'multimodal_compare'
      ]

      for (const toolName of tools) {
        const tool = toolRegistry.getTool(toolName)
        expect(tool).toBeDefined()
        expect(tool?.name).toBe(toolName)
      }
    })
  })

  describe('批量处理', () => {
    it('应该批量处理多个图像', async () => {
      if (!fs.existsSync(testImagePath)) {
        console.log('Test image not found, skipping batch test')
        return
      }

      const inputPaths = [testImagePath, testImagePath]
      const results = await enhancedImageProcessor.batchProcess(
        inputPaths,
        ImageOperation.RESIZE,
        {
          resize: {
            width: 256,
            height: 256
          }
        }
      )

      expect(results.length).toBe(2)
      expect(results.every(r => r.success)).toBe(true)

      for (const result of results) {
        if (result.outputPath && fs.existsSync(result.outputPath)) {
          fs.unlinkSync(result.outputPath)
        }
      }
    })
  })

  describe('错误处理', () => {
    it('应该处理不存在的文件', async () => {
      const result = await enhancedImageProcessor.processImage(
        '/nonexistent/image.png',
        ImageOperation.RESIZE
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('not found')
    })

    it('应该处理无效参数', async () => {
      const result = await enhancedImageProcessor.processImage(
        testImagePath,
        ImageOperation.RESIZE,
        {
          resize: {
            width: -1,
            height: -1
          }
        }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('缓存管理', () => {
    it('应该清除分析缓存', () => {
      enhancedImageProcessor.clearCache()
      expect(enhancedImageProcessor['cache'].size).toBe(0)
    })

    it('应该清除生成历史', () => {
      enhancedImageGenerator.clearHistory()
      expect(enhancedImageGenerator.getHistory().length).toBe(0)
    })

    it('应该清除提示词缓存', () => {
      enhancedImageGenerator.clearPromptCache()
      expect(enhancedImageGenerator['promptCache'].size).toBe(0)
    })
  })

  describe('临时文件管理', () => {
    it('应该清理临时文件', () => {
      const cleaned = enhancedImageProcessor.cleanup(0)
      expect(typeof cleaned).toBe('number')
      expect(cleaned).toBeGreaterThanOrEqual(0)
    })

    it('应该获取临时目录', () => {
      const tempDir = enhancedImageProcessor.getTempDir()
      expect(tempDir).toBeDefined()
      expect(typeof tempDir).toBe('string')
      expect(fs.existsSync(tempDir)).toBe(true)
    })
  })
})

describe('集成测试', () => {
  it('应该完整执行图像处理流程', async () => {
    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png')

    if (!fs.existsSync(testImagePath)) {
      console.log('Test image not found, skipping integration test')
      return
    }

    const analysisResult = await enhancedImageProcessor.analyzeImage(testImagePath)
    expect(analysisResult.success).toBe(true)

    const resizeResult = await enhancedImageProcessor.processImage(
      testImagePath,
      ImageOperation.RESIZE,
      {
        resize: {
          width: 512,
          height: 512
        }
      }
    )
    expect(resizeResult.success).toBe(true)

    if (resizeResult.outputPath) {
      const filterResult = await enhancedImageProcessor.processImage(
        resizeResult.outputPath,
        ImageOperation.FILTER,
        {
          filter: 'grayscale'
        }
      )
      expect(filterResult.success).toBe(true)

      if (filterResult.outputPath && fs.existsSync(filterResult.outputPath)) {
        fs.unlinkSync(filterResult.outputPath)
      }
      if (resizeResult.outputPath && fs.existsSync(resizeResult.outputPath)) {
        fs.unlinkSync(resizeResult.outputPath)
      }
    }
  })

  it('应该完整执行多模态推理流程', async () => {
    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png')

    if (!fs.existsSync(testImagePath)) {
      console.log('Test image not found, skipping multimodal test')
      return
    }

    const result = await multimodalReasoningEngine.reason({
      type: MultimodalReasoningType.IMAGE_UNDERSTANDING,
      input: {
        images: [testImagePath],
        text: '描述这张图片'
      }
    })

    expect(result.success).toBe(true)
    expect(result.output).toBeDefined()
    expect(result.steps.length).toBeGreaterThan(0)
    expect(result.metadata).toBeDefined()
    expect(result.metadata?.durationMs).toBeGreaterThan(0)
  })
})
