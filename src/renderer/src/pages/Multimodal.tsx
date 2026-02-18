import React, { useState, useEffect } from 'react'

// 多模态能力
type MultimodalCapability = 
  | 'image_understanding' 
  | 'image_generation' 
  | 'voice_input' 
  | 'voice_output' 
  | 'video_understanding' 
  | 'screen_capture'

// 工具卡片接口
interface ToolCard {
  id: MultimodalCapability
  name: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
  enabled: boolean
}

// 工具卡片配置
const toolCards: ToolCard[] = [
  {
    id: 'image_understanding',
    name: '图像理解',
    description: '使用AI分析图像内容，识别物体、文字和场景',
    color: '#3b82f6',
    bgColor: '#3b82f620',
    enabled: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    )
  },
  {
    id: 'image_generation',
    name: '图像生成',
    description: '使用DALL-E生成创意图像',
    color: '#8b5cf6',
    bgColor: '#8b5cf620',
    enabled: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
      </svg>
    )
  },
  {
    id: 'voice_input',
    name: '语音输入',
    description: '语音转文字，支持多语言识别',
    color: '#22c55e',
    bgColor: '#22c55e20',
    enabled: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
    )
  },
  {
    id: 'voice_output',
    name: '语音输出',
    description: '文字转语音，支持多种声音风格',
    color: '#f59e0b',
    bgColor: '#f59e0b20',
    enabled: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
    )
  },
  {
    id: 'screen_capture',
    name: '屏幕捕获',
    description: '截取屏幕或窗口图像',
    color: '#ec4899',
    bgColor: '#ec489920',
    enabled: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
    )
  },
  {
    id: 'video_understanding',
    name: '视频理解',
    description: '分析视频内容，提取关键帧',
    color: '#ef4444',
    bgColor: '#ef444420',
    enabled: false,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="23 7 16 12 23 17 23 7"></polygon>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
      </svg>
    )
  }
]

const MultimodalPage: React.FC = () => {
  const [activeTool, setActiveTool] = useState<MultimodalCapability | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  
  // 图像理解状态
  const [imagePrompt, setImagePrompt] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  
  // 图像生成状态
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  
  // 语音合成状态
  const [synthText, setSynthText] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('alloy')
  
  const voices = [
    { id: 'alloy', name: 'Alloy' },
    { id: 'echo', name: 'Echo' },
    { id: 'fable', name: 'Fable' },
    { id: 'onyx', name: 'Onyx' },
    { id: 'nova', name: 'Nova' },
    { id: 'shimmer', name: 'Shimmer' }
  ]

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAnalyzeImage = async () => {
    if (!selectedImage) return
    setIsProcessing(true)
    setResult(null)
    
    try {
      // 模拟调用
      await new Promise(resolve => setTimeout(resolve, 2000))
      setResult({
        description: '分析完成 - 这是一张包含代码的屏幕截图',
        tags: ['code', 'programming', 'screen'],
        objects: [
          { name: '代码编辑器', confidence: 0.95 },
          { name: '终端', confidence: 0.88 }
        ]
      })
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleGenerateImage = async () => {
    if (!generationPrompt) return
    setIsProcessing(true)
    setResult(null)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 3000))
      // 模拟生成
      setGeneratedImages(prev => [
        `https://picsum.photos/512/512?random=${Date.now()}`,
        ...prev
      ])
      setResult({ success: true, message: '图像生成完成' })
    } catch (error) {
      console.error('Generation failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSynthesize = async () => {
    if (!synthText) return
    setIsProcessing(true)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      setResult({ success: true, message: '语音合成完成', audioUrl: '#' })
    } catch (error) {
      console.error('Synthesis failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCaptureScreen = async () => {
    setIsProcessing(true)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSelectedImage(`https://picsum.photos/800/600?random=${Date.now()}`)
      setResult({ success: true, message: '屏幕捕获完成' })
    } catch (error) {
      console.error('Capture failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="multimodal-page" style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="4"></circle>
            <line x1="21.17" y1="8" x2="12" y2="8"></line>
            <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
            <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
          </svg>
          多模态工具
        </h1>
        <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
          图像理解、生成、语音处理等AI能力
        </p>
      </div>

      {/* Tool Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        {toolCards.map(tool => (
          <div
            key={tool.id}
            onClick={() => tool.enabled && setActiveTool(tool.id)}
            style={{
              backgroundColor: tool.enabled ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
              borderRadius: '12px',
              padding: '20px',
              border: `1px solid ${activeTool === tool.id ? tool.color : 'var(--border-color)'}`,
              cursor: tool.enabled ? 'pointer' : 'not-allowed',
              opacity: tool.enabled ? 1 : 0.5,
              transition: 'all 0.2s'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: tool.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tool.color
              }}>
                {tool.icon}
              </div>
              {!tool.enabled && (
                <span style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  即将上线
                </span>
              )}
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>{tool.name}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {tool.description}
            </p>
          </div>
        ))}
      </div>

      {/* Active Tool Panel */}
      {activeTool && (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '20px' 
          }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
              {toolCards.find(t => t.id === activeTool)?.name}
            </h2>
            <button
              onClick={() => setActiveTool(null)}
              style={{
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Image Understanding */}
          {activeTool === 'image_understanding' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  上传图像
                </label>
                <div style={{ 
                  display: 'flex', 
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  <label style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    border: '1px dashed var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    选择文件
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button
                    onClick={handleCaptureScreen}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    截取屏幕
                  </button>
                </div>
              </div>

              {selectedImage && (
                <div style={{ marginBottom: '16px' }}>
                  <img 
                    src={selectedImage} 
                    alt="Selected" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '300px', 
                      borderRadius: '8px',
                      objectFit: 'contain'
                    }} 
                  />
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  分析提示
                </label>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="描述你想要分析的内容..."
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <button
                onClick={handleAnalyzeImage}
                disabled={!selectedImage || isProcessing}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: selectedImage && !isProcessing ? '#3b82f6' : 'var(--bg-tertiary)',
                  color: selectedImage && !isProcessing ? '#fff' : 'var(--text-secondary)',
                  cursor: selectedImage && !isProcessing ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isProcessing ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    处理中...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    开始分析
                  </>
                )}
              </button>

              {result && (
                <div style={{ 
                  marginTop: '20px', 
                  padding: '16px', 
                  backgroundColor: 'var(--bg-primary)', 
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>分析结果</h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: 1.6 }}>
                    {result.description}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {result.tags?.map((tag: string) => (
                      <span key={tag} style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: '4px'
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Image Generation */}
          {activeTool === 'image_generation' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  描述你想要生成的图像
                </label>
                <textarea
                  value={generationPrompt}
                  onChange={(e) => setGenerationPrompt(e.target.value)}
                  placeholder="例如：一只可爱的猫咪坐在窗台上，窗外是夕阳..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <button
                onClick={handleGenerateImage}
                disabled={!generationPrompt || isProcessing}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: generationPrompt && !isProcessing ? '#8b5cf6' : 'var(--bg-tertiary)',
                  color: generationPrompt && !isProcessing ? '#fff' : 'var(--text-secondary)',
                  cursor: generationPrompt && !isProcessing ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isProcessing ? '生成中...' : '生成图像'}
              </button>

              {generatedImages.length > 0 && (
                <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {generatedImages.map((img, i) => (
                    <img 
                      key={i}
                      src={img} 
                      alt={`Generated ${i}`}
                      style={{ 
                        width: '100%', 
                        aspectRatio: '1',
                        borderRadius: '8px',
                        objectFit: 'cover'
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Voice Synthesis */}
          {activeTool === 'voice_output' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  选择声音
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {voices.map(voice => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: selectedVoice === voice.id ? '#f59e0b20' : 'var(--bg-primary)',
                        color: selectedVoice === voice.id ? '#f59e0b' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {voice.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  输入文本
                </label>
                <textarea
                  value={synthText}
                  onChange={(e) => setSynthText(e.target.value)}
                  placeholder="输入要转换为语音的文本..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <button
                onClick={handleSynthesize}
                disabled={!synthText || isProcessing}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: synthText && !isProcessing ? '#f59e0b' : 'var(--bg-tertiary)',
                  color: synthText && !isProcessing ? '#fff' : 'var(--text-secondary)',
                  cursor: synthText && !isProcessing ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                {isProcessing ? '合成中...' : '合成语音'}
              </button>
            </div>
          )}

          {/* Screen Capture */}
          {activeTool === 'screen_capture' && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <button
                onClick={handleCaptureScreen}
                disabled={isProcessing}
                style={{
                  padding: '16px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: isProcessing ? 'var(--bg-tertiary)' : '#ec4899',
                  color: isProcessing ? 'var(--text-secondary)' : '#fff',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  margin: '0 auto'
                }}
              >
                {isProcessing ? (
                  <>捕获中...</>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    截取屏幕
                  </>
                )}
              </button>
              <p style={{ margin: '16px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                点击按钮截取当前屏幕
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default MultimodalPage
