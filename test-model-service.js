// 测试模型服务功能
const { llmService } = require('./dist/main/services/LLMService');

async function testModelService() {
  console.log('开始测试模型服务...');
  
  try {
    // 测试获取API密钥
    const deepseekKey = llmService.getApiKey('deepseek');
    console.log('DeepSeek API密钥状态:', deepseekKey ? '已配置' : '未配置');
    
    // 测试模型调用
    if (deepseekKey) {
      console.log('测试DeepSeek模型调用...');
      const response = await llmService.chat('deepseek', [
        { role: 'user', content: 'Hello, can you test the model service?' }
      ]);
      
      console.log('模型调用结果:', response);
      if (response.success) {
        console.log('✅ 模型调用成功');
        console.log('响应内容:', response.content);
      } else {
        console.log('❌ 模型调用失败:', response.error);
      }
    }
    
    // 测试其他模型
    const openaiKey = llmService.getApiKey('openai');
    console.log('OpenAI API密钥状态:', openaiKey ? '已配置' : '未配置');
    
    const claudeKey = llmService.getApiKey('claude');
    console.log('Claude API密钥状态:', claudeKey ? '已配置' : '未配置');
    
    const minimaxKey = llmService.getApiKey('minimax');
    console.log('MiniMax API密钥状态:', minimaxKey ? '已配置' : '未配置');
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

testModelService();
