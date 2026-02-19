import { ipcMain } from 'electron'
import { llmService } from '../../services/LLMService'

// 代码相关的 IPC 处理器
export function registerCodeHandlers() {
  // 生成代码
  ipcMain.handle('code:generate', async (_, prompt: string, language: string, options?: any) => {
    try {
      // 构建系统提示
      const systemPrompt = `You are a professional ${language} developer. Generate clean, efficient, and well-documented code based on the following prompt.`
      
      // 构建用户提示
      const userPrompt = `Generate ${language} code for: ${prompt}\n\nPlease include:\n1. Proper comments\n2. Error handling\n3. Best practices\n4. Complete implementation`
      
      // 调用 LLM 服务
      const response = await llmService.chat('openai', [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000
      })
      
      if (response.success && response.content) {
        return { success: true, code: response.content }
      }
      return { success: false, error: 'Failed to generate code' }
    } catch (error: any) {
      console.error('生成代码失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 解释代码
  ipcMain.handle('code:explain', async (_, code: string, language: string, options?: any) => {
    try {
      // 构建系统提示
      const systemPrompt = `You are a professional ${language} developer. Explain the following code in detail, including its purpose, how it works, and any potential improvements.`
      
      // 构建用户提示
      const userPrompt = `Explain the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``
      
      // 调用 LLM 服务
      const response = await llmService.chat('openai', [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000
      })
      
      if (response.success && response.content) {
        return { success: true, explanation: response.content }
      }
      return { success: false, error: 'Failed to explain code' }
    } catch (error: any) {
      console.error('解释代码失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 重构代码
  ipcMain.handle('code:refactor', async (_, code: string, language: string, options?: any) => {
    try {
      // 构建系统提示
      const systemPrompt = `You are a professional ${language} developer. Refactor the following code to improve its readability, efficiency, and maintainability. Include an explanation of the changes made.`
      
      // 构建用户提示
      const userPrompt = `Refactor the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``
      
      // 调用 LLM 服务
      const response = await llmService.chat('openai', [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000
      })
      
      if (response.success && response.content) {
        // 提取重构后的代码和解释
        let refactoredCode = ''
        let explanation = ''
        
        const codeMatch = response.content.match(/```[\s\S]*?```/)
        if (codeMatch) {
          refactoredCode = codeMatch[0].replace(/```[\s\S]*?\n|```/g, '')
          explanation = response.content.replace(codeMatch[0], '').trim()
        } else {
          refactoredCode = response.content
          explanation = 'Refactored code based on best practices'
        }
        
        return {
          success: true,
          code: refactoredCode,
          explanation: explanation
        }
      }
      return { success: false, error: 'Failed to refactor code' }
    } catch (error: any) {
      console.error('重构代码失败:', error)
      return { success: false, error: error.message }
    }
  })
}