/**
 * 图像处理和生成工具
 * 集成到工具系统中
 */

import { toolRegistry } from './ToolRegistry'
import { enhancedImageProcessor, ImageOperation, ImageProcessingOptions } from '../services/EnhancedImageProcessor'
import { enhancedImageGenerator, ImageGenerationModel, ImageGenerationOptions } from '../services/EnhancedImageGenerator'
import { multimodalReasoningEngine, MultimodalReasoningType } from '../services/MultimodalReasoningEngine'

// ============================================
// 图像处理工具
// ============================================

// 调整图像大小
toolRegistry.register({
  name: 'image_resize',
  description: 'Resize an image to specified dimensions',
  parameters: [
    { name: 'path', type: 'string', description: 'Path to the input image', required: true },
    { name: 'width', type: 'number', description: 'Target width in pixels', required: false },
    { name: 'height', type: 'number', description: 'Target height in pixels', required: false },
    { name: 'fit', type: 'string', description: 'Fit method: cover, contain, fill, inside, outside', required: false },
    { name: 'outputPath', type: 'string', description: 'Optional output path (auto-generated if not provided)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const path = params?.path
      if (!path) return { error: 'Missing parameter: path' }

      const options: ImageProcessingOptions = {
        resize: {
          width: params?.width,
          height: params?.height,
          fit: params?.fit || 'cover',
          withoutEnlargement: false
        }
      }

      const result = await enhancedImageProcessor.processImage(path, ImageOperation.RESIZE, options)

      if (result.success) {
        return {
          success: true,
          outputPath: result.outputPath,
          metadata: result.metadata
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 裁剪图像
toolRegistry.register({
  name: 'image_crop',
  description: 'Crop an image to a specific region',
  parameters: [
    { name: 'path', type: 'string', description: 'Path to the input image', required: true },
    { name: 'left', type: 'number', description: 'Left coordinate in pixels', required: true },
    { name: 'top', type: 'number', description: 'Top coordinate in pixels', required: true },
    { name: 'width', type: 'number', description: 'Width of the crop region', required: true },
    { name: 'height', type: 'number', description: 'Height of the crop region', required: true }
  ],
  handler: async (params: any) => {
    try {
      const path = params?.path
      if (!path) return { error: 'Missing parameter: path' }

      const options: ImageProcessingOptions = {
        crop: {
          left: params?.left,
          top: params?.top,
          width: params?.width,
          height: params?.height
        }
      }

      const result = await enhancedImageProcessor.processImage(path, ImageOperation.CROP, options)

      if (result.success) {
        return {
          success: true,
          outputPath: result.outputPath,
          metadata: result.metadata
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 旋转图像
toolRegistry.register({
  name: 'image_rotate',
  description: 'Rotate an image by specified angle',
  parameters: [
    { name: 'path', type: 'string', description: 'Path to the input image', required: true },
    { name: 'angle', type: 'number', description: 'Rotation angle in degrees', required: true },
    { name: 'background', type: 'string', description: 'Background color for empty areas (hex code)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const path = params?.path
      if (!path) return { error: 'Missing parameter: path' }

      const options: ImageProcessingOptions = {
        rotate: {
          angle: params?.angle || 0,
          background: params?.background || '#ffffff'
        }
      }

      const result = await enhancedImageProcessor.processImage(path, ImageOperation.ROTATE, options)

      if (result.success) {
        return {
          success: true,
          outputPath: result.outputPath,
          metadata: result.metadata
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 翻转图像
toolRegistry.register({
  name: 'image_flip',
  description: 'Flip an image horizontally or vertically',
  parameters: [
    { name: 'path', type: 'string', description: 'Path to the input image', required: true },
    { name: 'horizontal', type: 'boolean', description: 'Flip horizontally', required: false },
    { name: 'vertical', type: 'boolean', description: 'Flip vertically', required: false }
  ],
  handler: async (params: any) => {
    try {
      const path = params?.path
      if (!path) return { error: 'Missing parameter: path' }

      const options: ImageProcessingOptions = {
        flip: {
          horizontal: params?.horizontal || false,
          vertical: params?.vertical || false
        }
      }

      const result = await enhancedImageProcessor.processImage(path, ImageOperation.FLIP, options)

      if (result.success) {
        return {
          success: true,
          outputPath: result.outputPath,
          metadata: result.metadata
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 应用滤镜
toolRegistry.register({
  name: 'image_filter',
  description: 'Apply a filter to an image (blur, sharpen, grayscale, sepia, invert)',
  parameters: [
    { name: 'path', type: 'string', description: 'Path to the input image', required: true },
    { name: 'filter', type: 'string', description: 'Filter type: blur, sharpen, grayscale, sepia, invert', required: true }
  ],
  handler: async (params: any) => {
    try {
      const path = params?.path
      const filter = params?.filter
      if (!path) return { error: 'Missing parameter: path' }
      if (!filter) return { error: 'Missing parameter: filter' }

      const options: ImageProcessingOptions = {
        filter: filter as any
      }

      const result = await enhancedImageProcessor.processImage(path, ImageOperation.FILTER, options)

      if (result.success) {
        return {
          success: true,
          outputPath: result.outputPath,
          metadata: result.metadata
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 压缩图像
toolRegistry.register({
  name: 'image_compress',
  description: 'Compress an image to reduce file size',
  parameters: [
    { name: 'path', type: 'string', description: 'Path to the input image', required: true },
    { name: 'quality', type: 'number', description: 'Quality (1-100)', required: false },
    { name: 'format', type: 'string', description: 'Output format: jpeg, png, webp, avif', required: false }
  ],
  handler: async (params: any) => {
    try {
      const path = params?.path
      if (!path) return { error: 'Missing parameter: path' }

      const options: ImageProcessingOptions = {
        compress: {
          quality: params?.quality || 80,
          format: params?.format || 'jpeg'
        }
      }

      const result = await enhancedImageProcessor.processImage(path, ImageOperation.COMPRESS, options)

      if (result.success) {
        return {
          success: true,
          outputPath: result.outputPath,
          metadata: result.metadata
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 添加水印
toolRegistry.register({
  name: 'image_watermark',
  description: 'Add a text or image watermark to an image',
  parameters: [
    { name: 'path', type: 'string', description: 'Path to the input image', required: true },
    { name: 'text', type: 'string', description: 'Watermark text', required: false },
    { name: 'imagePath', type: 'string', description: 'Path to watermark image', required: false },
    { name: 'position', type: 'string', description: 'Position: top-left, top-right, bottom-left, bottom-right, center', required: false },
    { name: 'opacity', type: 'number', description: 'Opacity (0-1)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const path = params?.path
      if (!path) return { error: 'Missing parameter: path' }

      const options: ImageProcessingOptions = {
        watermark: {
          text: params?.text,
          imagePath: params?.imagePath,
          position: params?.position || 'bottom-right',
          opacity: params?.opacity || 0.5
        }
      }

      const result = await enhancedImageProcessor.processImage(path, ImageOperation.WATERMARK, options)

      if (result.success) {
        return {
          success: true,
          outputPath: result.outputPath,
          metadata: result.metadata
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 增强图像
toolRegistry.register({
  name: 'image_enhance',
  description: 'Enhance image brightness, contrast, and saturation',
  parameters: [
    { name: 'path', type: 'string', description: 'Path to the input image', required: true },
    { name: 'brightness', type: 'number', description: 'Brightness multiplier (0.5-2.0)', required: false },
    { name: 'contrast', type: 'number', description: 'Contrast multiplier (0.5-2.0)', required: false },
    { name: 'saturation', type: 'number', description: 'Saturation multiplier (0.0-2.0)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const path = params?.path
      if (!path) return { error: 'Missing parameter: path' }

      const options: ImageProcessingOptions = {
        enhance: {
          brightness: params?.brightness,
          contrast: params?.contrast,
          saturation: params?.saturation
        }
      }

      const result = await enhancedImageProcessor.processImage(path, ImageOperation.BRIGHTNESS, options)

      if (result.success) {
        return {
          success: true,
          outputPath: result.outputPath,
          metadata: result.metadata
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 分析图像
toolRegistry.register({
  name: 'image_analyze',
  description: 'Analyze an image to extract metadata, colors, quality, and content',
  parameters: [
    { name: 'path', type: 'string', description: 'Path to the image', required: true }
  ],
  handler: async (params: any) => {
    try {
      const path = params?.path
      if (!path) return { error: 'Missing parameter: path' }

      const result = await enhancedImageProcessor.analyzeImage(path)

      if (result.success) {
        return {
          success: true,
          metadata: result.metadata,
          content: result.content,
          quality: result.quality
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// ============================================
// 图像生成工具
// ============================================

// 生成图像
toolRegistry.register({
  name: 'image_generate',
  description: 'Generate an image from text description using AI',
  parameters: [
    { name: 'prompt', type: 'string', description: 'Text description of the image to generate', required: true },
    { name: 'model', type: 'string', description: 'Model: dall-e-3, dall-e-2, stable-diffusion, midjourney, custom', required: false },
    { name: 'size', type: 'string', description: 'Image size: 256x256, 512x512, 1024x1024, 1792x1024, 1024x1792', required: false },
    { name: 'quality', type: 'string', description: 'Quality: standard, hd', required: false },
    { name: 'style', type: 'string', description: 'Style: vivid, natural', required: false },
    { name: 'n', type: 'number', description: 'Number of images to generate (1-10)', required: false },
    { name: 'negativePrompt', type: 'string', description: 'Things to avoid in the image', required: false }
  ],
  handler: async (params: any) => {
    try {
      const prompt = params?.prompt
      if (!prompt) return { error: 'Missing parameter: prompt' }

      const options: ImageGenerationOptions = {
        prompt,
        model: params?.model || ImageGenerationModel.DALLE3,
        size: params?.size || '1024x1024',
        quality: params?.quality || 'standard',
        style: params?.style || 'vivid',
        n: params?.n || 1,
        negativePrompt: params?.negativePrompt
      }

      const result = await enhancedImageGenerator.generateImage(options)

      if (result.success) {
        return {
          success: true,
          images: result.images,
          metadata: result.metadata,
          model: result.model
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 编辑图像
toolRegistry.register({
  name: 'image_edit',
  description: 'Edit an image based on text description',
  parameters: [
    { name: 'image', type: 'string', description: 'Path to the input image', required: true },
    { name: 'prompt', type: 'string', description: 'Text description of the edit to make', required: true },
    { name: 'mask', type: 'string', description: 'Optional path to mask image', required: false },
    { name: 'n', type: 'number', description: 'Number of variations (1-10)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const image = params?.image
      const prompt = params?.prompt
      if (!image) return { error: 'Missing parameter: image' }
      if (!prompt) return { error: 'Missing parameter: prompt' }

      const result = await enhancedImageGenerator.editImage({
        image,
        prompt,
        mask: params?.mask,
        n: params?.n || 1
      })

      if (result.success) {
        return {
          success: true,
          images: result.images,
          originalImage: result.originalImage
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 创建变体
toolRegistry.register({
  name: 'image_variations',
  description: 'Create variations of an image',
  parameters: [
    { name: 'image', type: 'string', description: 'Path to the input image', required: true },
    { name: 'n', type: 'number', description: 'Number of variations (1-10)', required: false },
    { name: 'size', type: 'string', description: 'Image size: 256x256, 512x512, 1024x1024', required: false }
  ],
  handler: async (params: any) => {
    try {
      const image = params?.image
      if (!image) return { error: 'Missing parameter: image' }

      const result = await enhancedImageGenerator.createVariations({
        image,
        n: params?.n || 1,
        size: params?.size || '1024x1024'
      })

      if (result.success) {
        return {
          success: true,
          images: result.images,
          originalImage: result.originalImage
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 增强提示词
toolRegistry.register({
  name: 'image_enhance_prompt',
  description: 'Enhance an image generation prompt with artistic details and style',
  parameters: [
    { name: 'prompt', type: 'string', description: 'Original prompt to enhance', required: true }
  ],
  handler: async (params: any) => {
    try {
      const prompt = params?.prompt
      if (!prompt) return { error: 'Missing parameter: prompt' }

      const result = await enhancedImageGenerator.enhancePrompt(prompt)

      if (result.success) {
        return {
          success: true,
          originalPrompt: result.originalPrompt,
          enhancedPrompt: result.enhancedPrompt,
          suggestions: result.suggestions,
          tags: result.tags,
          style: result.style,
          mood: result.mood
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// ============================================
// 多模态推理工具
// ============================================

// 图像理解
toolRegistry.register({
  name: 'multimodal_understand',
  description: 'Understand and describe an image in detail',
  parameters: [
    { name: 'image', type: 'string', description: 'Path to the image', required: true },
    { name: 'prompt', type: 'string', description: 'Optional specific question or focus area', required: false }
  ],
  handler: async (params: any) => {
    try {
      const image = params?.image
      if (!image) return { error: 'Missing parameter: image' }

      const result = await multimodalReasoningEngine.reason({
        type: MultimodalReasoningType.IMAGE_UNDERSTANDING,
        input: {
          images: [image],
          text: params?.prompt
        }
      })

      if (result.success) {
        return {
          success: true,
          understanding: result.output
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 文本到图像
toolRegistry.register({
  name: 'multimodal_text_to_image',
  description: 'Convert text description to image with optional prompt enhancement',
  parameters: [
    { name: 'text', type: 'string', description: 'Text description', required: true },
    { name: 'enhancePrompt', type: 'boolean', description: 'Whether to enhance the prompt', required: false },
    { name: 'model', type: 'string', description: 'Model to use', required: false }
  ],
  handler: async (params: any) => {
    try {
      const text = params?.text
      if (!text) return { error: 'Missing parameter: text' }

      const result = await multimodalReasoningEngine.reason({
        type: MultimodalReasoningType.TEXT_TO_IMAGE,
        input: {
          text
        },
        processing: {
          enablePromptEnhancement: params?.enhancePrompt || false
        },
        generation: {
          prompt: text,
          model: params?.model || ImageGenerationModel.DALLE3
        }
      })

      if (result.success) {
        return {
          success: true,
          images: result.output.images,
          enhancedPrompt: result.output.enhancedPrompt
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 图像到文本
toolRegistry.register({
  name: 'multimodal_image_to_text',
  description: 'Extract text and description from an image',
  parameters: [
    { name: 'image', type: 'string', description: 'Path to the image', required: true }
  ],
  handler: async (params: any) => {
    try {
      const image = params?.image
      if (!image) return { error: 'Missing parameter: image' }

      const result = await multimodalReasoningEngine.reason({
        type: MultimodalReasoningType.IMAGE_TO_TEXT,
        input: {
          images: [image]
        }
      })

      if (result.success) {
        return {
          success: true,
          description: result.output.description,
          text: result.output.text,
          caption: result.output.caption
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 视觉问答
toolRegistry.register({
  name: 'multimodal_vqa',
  description: 'Ask questions about an image and get answers',
  parameters: [
    { name: 'image', type: 'string', description: 'Path to the image', required: true },
    { name: 'question', type: 'string', description: 'Question about the image', required: true }
  ],
  handler: async (params: any) => {
    try {
      const image = params?.image
      const question = params?.question
      if (!image) return { error: 'Missing parameter: image' }
      if (!question) return { error: 'Missing parameter: question' }

      const result = await multimodalReasoningEngine.reason({
        type: MultimodalReasoningType.VISUAL_QUESTION_ANSWERING,
        input: {
          images: [image],
          text: question
        }
      })

      if (result.success) {
        return {
          success: true,
          question: result.output.question,
          answer: result.output.answer,
          confidence: result.output.confidence,
          reasoning: result.output.reasoning
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

// 图像比较
toolRegistry.register({
  name: 'multimodal_compare',
  description: 'Compare two images and find similarities and differences',
  parameters: [
    { name: 'image1', type: 'string', description: 'Path to first image', required: true },
    { name: 'image2', type: 'string', description: 'Path to second image', required: true }
  ],
  handler: async (params: any) => {
    try {
      const image1 = params?.image1
      const image2 = params?.image2
      if (!image1) return { error: 'Missing parameter: image1' }
      if (!image2) return { error: 'Missing parameter: image2' }

      const result = await multimodalReasoningEngine.reason({
        type: MultimodalReasoningType.IMAGE_COMPARISON,
        input: {
          images: [image1, image2]
        }
      })

      if (result.success) {
        return {
          success: true,
          similarity: result.output.similarity,
          differences: result.output.differences,
          commonalities: result.output.commonalities,
          recommendation: result.output.recommendation
        }
      }

      return { error: result.error }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

console.log('[ImageTools] Image processing and generation tools loaded')
