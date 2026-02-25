import React, { useState, useEffect, useRef } from 'react'

// webview type is already defined in electron types


interface Tab {
  id: string
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  homeState?: {
    searched: boolean
    results: any[]
    inputValue: string
  }
}

interface MainContentProps {
  theme?: 'dark' | 'light'
}

const MainContent: React.FC<MainContentProps> = ({ theme = 'light' }) => {
  // 从localStorage加载保存的Tab状态
  const loadSavedTabs = (): Tab[] => {
    try {
      const saved = localStorage.getItem('browser_tabs')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('[MainContent] Loaded saved tabs:', parsed.length)
          return parsed
        }
      }
    } catch (e) {
      console.error('[MainContent] Failed to load tabs:', e)
    }
    return [
      { 
        id: '1', 
        url: 'trae://home', 
        title: 'New Tab', 
        isLoading: false, 
        canGoBack: false, 
        canGoForward: false,
        homeState: { searched: false, results: [], inputValue: '' }
      }
    ]
  }

  // 保存Tab状态到localStorage
  const saveTabs = (tabsToSave: Tab[], activeId: string) => {
    try {
      // 只保存基本信息，不保存loading状态
      const tabsToStore = tabsToSave.map(t => ({
        id: t.id,
        url: t.url,
        title: t.title,
        canGoBack: t.canGoBack,
        canGoForward: t.canGoForward,
        homeState: t.homeState
      }))
      localStorage.setItem('browser_tabs', JSON.stringify(tabsToStore))
      localStorage.setItem('browser_active_tab', activeId)
    } catch (e) {
      console.error('[MainContent] Failed to save tabs:', e)
    }
  }

  const [tabs, setTabs] = useState<Tab[]>(loadSavedTabs)
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem('browser_active_tab') || '1'
  })
  const [urlInput, setUrlInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const webviewRefs = useRef<{ [key: string]: any }>({})
  const [greeting, setGreeting] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const lastNewWindowRef = useRef<{ url: string; time: number } | null>(null)
  const [crawling, setCrawling] = useState<string | null>(null)

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  // 根据主题获取颜色变量
  const getColor = (key: string) => {
    if (theme === 'dark') {
      switch(key) {
        case 'bg-primary': return 'var(--dark-background-primary)'
        case 'bg-secondary': return 'var(--dark-background-secondary)'
        case 'bg-tertiary': return 'var(--dark-background-tertiary)'
        case 'border-color': return 'var(--dark-border-primary)'
        case 'text-primary': return 'var(--dark-text-primary)'
        case 'text-secondary': return 'var(--dark-text-secondary)'
        case 'text-tertiary': return 'var(--dark-text-tertiary)'
        case 'surface-primary': return 'var(--dark-surface-primary)'
        default: return `var(--dark-${key})`
      }
    } else {
      return `var(--${key})`
    }
  }

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('上午好')
    else if (hour < 18) setGreeting('下午好')
    else setGreeting('晚上好')
  }, [])

  // 检查是否有待打开的URL（从Chat页面跳转过来时）
  useEffect(() => {
    const pendingUrl = sessionStorage.getItem('pendingOpenUrl')
    if (pendingUrl) {
      console.log('[MainContent] Opening pending URL:', pendingUrl)
      sessionStorage.removeItem('pendingOpenUrl')
      handleNewWindowUrl(pendingUrl)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (activeTab) {
      if (!showSuggestions) {
        if (activeTab.url === 'trae://home') {
           setUrlInput(activeTab.homeState?.inputValue || '')
        } else {
           setUrlInput(activeTab.url)
        }
      }
    }
  }, [activeTabId, activeTab?.url, activeTab?.homeState?.inputValue])

  // 保存Tab状态到localStorage
  useEffect(() => {
    saveTabs(tabs, activeTabId)
  }, [tabs, activeTabId])

  const handleAddTab = () => {
    const newId = Date.now().toString()
    const newTab: Tab = {
      id: newId,
      url: 'trae://home',
      title: 'New Tab',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      homeState: { searched: false, results: [], inputValue: '' }
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newId)
  }

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (tabs.length === 1) return 
    
    const newTabs = tabs.filter(t => t.id !== id)
    setTabs(newTabs)
    
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id)
    }
  }

  const handleTabSwitch = (id: string) => {
    setActiveTabId(id)
  }

  const updateTab = (id: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }
  
  const updateHomeState = (id: string, updates: Partial<NonNullable<Tab['homeState']>>) => {
      setTabs(prev => prev.map(t => {
          if (t.id !== id) return t
          return {
              ...t,
              homeState: {
                  ...t.homeState,
                  searched: false,
                  results: [],
                  inputValue: '',
                  ...updates
              }
          }
      }))
  }

  const performAISearch = async (query: string) => {
    updateTab(activeTabId, { isLoading: true, title: `AI Searching: ${query}...` })
    setShowSuggestions(false)
    
    try {
      // @ts-ignore
      const res = await window.electron.tools.executeToolCommand('search_web', 'handler', [{ query }])
      
      if (res.success && res.output && res.output.results) {
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${query} - AI Search</title>
            <style>
              body { font-family: var(--font-family-ui); max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: var(--text-primary); background-color: var(--background-primary); }
              h1 { border-bottom: 1px solid var(--border-primary); padding-bottom: 20px; color: var(--text-primary); }
              .ai-badge { background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500; vertical-align: middle; margin-left: 10px; display: inline-block; }
              .result-card { background: var(--surface-primary); border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); transition: transform 0.2s; border: 1px solid var(--border-primary); }
              .result-card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
              .result-title { margin: 0 0 8px 0; font-size: 18px; line-height: 1.4; }
              .result-title a { color: var(--primary-color); text-decoration: none; font-weight: 600; }
              .result-title a:hover { text-decoration: underline; }
              .result-url { color: var(--success-color); font-size: 13px; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
              .result-snippet { color: var(--text-secondary); font-size: 14px; }
              .no-results { text-align: center; color: var(--text-tertiary); margin-top: 40px; }
            </style>
          </head>
          <body>
            <h1>Search Results for "${query}" <span class="ai-badge">AI Powered</span></h1>
            ${res.output.results.length > 0 ? res.output.results.map((r: any) => `
              <div class="result-card">
                <h3 class="result-title"><a href="${r.url}">${r.title}</a></h3>
                <div class="result-url">${r.url}</div>
                <div class="result-snippet">${r.snippet}</div>
              </div>
            `).join('') : '<div class="no-results">No results found via AI search.</div>'}
          </body>
          </html>
        `
        
        if (webviewRefs.current[activeTabId]) {
          const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
          webviewRefs.current[activeTabId].loadURL(dataUrl)
        }
      } else {
        if (webviewRefs.current[activeTabId]) {
            webviewRefs.current[activeTabId].loadURL(`https://www.google.com/search?q=${encodeURIComponent(query)}`)
        }
      }
    } catch (e) {
      console.error(e)
      updateTab(activeTabId, { isLoading: false })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUrlInput(value)
    
    if (activeTab.url === 'trae://home') {
        updateHomeState(activeTabId, { inputValue: value })
    }
    
    if (value.trim()) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (type: 'google' | 'ai') => {
    if (type === 'google') {
      handleNavigate()
    } else {
      performAISearch(urlInput)
    }
    setShowSuggestions(false)
  }

  const handleNavigate = () => {
    let url = urlInput.trim()
    if (!url) return
    setShowSuggestions(false)

    // Check if it is a home navigation
    if (url === 'trae://home') {
        if (webviewRefs.current[activeTabId]) {
            updateTab(activeTabId, { url: 'trae://home', title: 'New Tab' })
        }
        return
    }

    // Simple URL validation/fixing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // If it looks like a domain, add https
        if (url.includes('.') && !url.includes(' ')) {
             url = 'https://' + url
        } else {
            url = `https://www.google.com/search?q=${encodeURIComponent(url)}`
        }
    }

    if (webviewRefs.current[activeTabId]) {
      webviewRefs.current[activeTabId].loadURL(url)
    }
  }

  const handleHomeSearch = async () => {
    const query = activeTab.homeState?.inputValue || urlInput
    if (!query.trim()) return
    
    setSearchLoading(true)
    updateHomeState(activeTabId, { searched: true, results: [] })
    
    try {
      // @ts-ignore
      const res = await window.electron.tools.executeToolCommand('search_web', 'handler', [{ query: query }])
      console.log('[MainContent] Search response:', res)
      if (res.success && res.output && res.output.results) {
        updateHomeState(activeTabId, { searched: true, results: res.output.results })
      } else {
        console.error('Search failed:', res)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleCrawl = async (url: string) => {
    setCrawling(url)
    try {
      // @ts-ignore
      const res = await window.electron.tools.executeToolCommand('fetch_webpage', 'handler', [{ url }])
      if (res.success && res.output && res.output.content) {
        // Simple visualization of success for now
        console.log('Crawled content:', res.output.content)
        alert(`已成功爬取页面内容！\n长度: ${res.output.content.length} 字符`)
      } else {
        alert('爬取失败，请重试。')
      }
    } catch (e) {
      console.error(e)
      alert('爬取发生错误')
    } finally {
      setCrawling(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => (prev < 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => (prev > -1 ? prev - 1 : prev))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && selectedSuggestionIndex === 1) {
        performAISearch(urlInput)
      } else {
        // Default to Google search (index 0) or just navigate
        handleNavigate()
      }
      setShowSuggestions(false)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleNewWindowUrl = (url: string) => {
    const now = Date.now()
    if (lastNewWindowRef.current && lastNewWindowRef.current.url === url && now - lastNewWindowRef.current.time < 500) {
      return
    }
    lastNewWindowRef.current = { url, time: now }
    const newId = Date.now().toString()
    const newTab: Tab = {
      id: newId,
      url,
      title: 'New Tab',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      homeState: { searched: false, results: [], inputValue: '' }
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newId)
  }

  const handleReload = () => {
    if (webviewRefs.current[activeTabId]) {
      webviewRefs.current[activeTabId].reload()
    }
  }

  const handleBack = () => {
    if (webviewRefs.current[activeTabId] && webviewRefs.current[activeTabId].canGoBack()) {
      webviewRefs.current[activeTabId].goBack()
    }
  }

  const handleForward = () => {
    if (webviewRefs.current[activeTabId] && webviewRefs.current[activeTabId].canGoForward()) {
      webviewRefs.current[activeTabId].goForward()
    }
  }

  useEffect(() => {
    const api = (window as any).electron
    if (!api || !api.events || !api.events.onWebviewNewWindow) {
      return
    }
    const unsubscribe = api.events.onWebviewNewWindow((details: { url: string }) => {
      if (details && details.url) {
        handleNewWindowUrl(details.url)
      }
    })

    const unsubscribeAgent = api.events.onAgentOpenPage((url: string) => {
      console.log('[Renderer] Received agent-open-page event:', url)
      if (url) {
        handleNewWindowUrl(url)
      }
    })

    // 监听webview-action事件（来自agent工具）
    const unsubscribeWebviewAction = api.events.onWebviewAction && api.events.onWebviewAction((data: { action: string; selector?: string; text?: string; scrollTop?: number; url?: string }) => {
      console.log('[Renderer] Received webview-action:', data)
      const webview = webviewRefs.current[activeTabId]
      if (!webview) {
        console.log('[Renderer] No webview found for active tab')
        return
      }

      if (data.action === 'click' && data.selector) {
        webview.executeJavaScript(`
          (function() {
            const el = document.querySelector('${data.selector}');
            if (el) { el.click(); return true; }
            return false;
          })()
        `).then((result: boolean) => {
          console.log('[Renderer] Click result:', result)
        })
      } else if (data.action === 'type' && data.selector && data.text) {
        webview.executeJavaScript(`
          (function() {
            const el = document.querySelector('${data.selector}');
            if (el) {
              el.value = '${data.text.replace(/'/g, "\\'")}';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          })()
        `).then((result: boolean) => {
          console.log('[Renderer] Type result:', result)
        })
      } else if (data.action === 'scroll' && data.scrollTop !== undefined) {
        webview.executeJavaScript(`
          window.scrollTo(0, ${data.scrollTop})
          true
        `).then((result: boolean) => {
          console.log('[Renderer] Scroll result:', result)
        })
      } else if (data.action === 'goto' && data.url) {
        // 导航到URL
        console.log('[Renderer] Goto URL:', data.url)
        webview.loadURL(data.url).then(() => {
          console.log('[Renderer] Navigation successful')
        }).catch((err: any) => {
          console.log('[Renderer] Navigation error:', err)
        })
      } else if (data.action === 'wait' && data.selector) {
        // 等待元素出现
        console.log('[Renderer] Waiting for selector:', data.selector)
        const checkElement = () => {
          return webview.executeJavaScript(`
            (function() {
              const el = document.querySelector('${data.selector}');
              if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  return { found: true };
                }
              }
              return { found: false };
            })()
          `)
        }
        
        const tryCheck = async () => {
          for (let i = 0; i < 20; i++) {
            const result = await checkElement()
            if (result.found) {
              console.log('[Renderer] Element found!')
              return
            }
            await new Promise(r => setTimeout(r, 500))
          }
          console.log('[Renderer] Element not found after timeout')
        }
        tryCheck()
      } else if (data.action === 'play') {
        // 播放视频 - 尝试多种方式
        console.log('[Renderer] Play video action')
        webview.executeJavaScript(`
          (function() {
            // 方式1: 查找video元素并播放
            const video = document.querySelector('video');
            if (video) {
              video.play().catch(() => {
                video.muted = true;
                video.play();
              });
              return { success: true, method: 'video' };
            }
            
            // 方式2: 查找播放按钮
            const playBtn = document.querySelector('.bpx-player-ctrl-play') || 
                           document.querySelector('.bilibili-player-video-clickarea') ||
                           document.querySelector('.player-ctrl-play');
            if (playBtn) {
              playBtn.click();
              return { success: true, method: 'button' };
            }
            
            // 方式3: 发送空格键（播放/暂停）
            document.body.focus();
            const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true });
            document.dispatchEvent(event);
            return { success: true, method: 'keyboard' };
          })()
        `).then((result: any) => {
          console.log('[Renderer] Play result:', result)
        })
      } else if (data.action === 'getUrl') {
        // 获取当前URL
        webview.getURL().then((url: string) => {
          console.log('[Renderer] Current URL:', url)
        })
      }
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
      if (unsubscribeAgent) {
        unsubscribeAgent()
      }
      if (unsubscribeWebviewAction) {
        unsubscribeWebviewAction()
      }
    }
  }, [activeTabId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: getColor('bg-primary'), fontFamily: 'var(--font-family-ui)' }}>
      {/* Tab Bar */}
      <div style={{ 
        display: 'flex', 
        height: '40px', 
        backgroundColor: getColor('bg-secondary'), 
        paddingTop: '8px', 
        paddingLeft: '8px',
        overflowX: 'auto',
        gap: '4px',
        borderBottom: `1px solid ${getColor('border-color')}`
      }}>
        {tabs.map(tab => (
          <div 
            key={tab.id}
            onClick={() => handleTabSwitch(tab.id)}
            style={{
              maxWidth: '200px',
              minWidth: '120px',
              height: '32px',
              backgroundColor: activeTabId === tab.id ? getColor('surface-primary') : 'transparent',
              borderRadius: '8px 8px 0 0',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              color: activeTabId === tab.id ? getColor('text-primary') : getColor('text-secondary'),
              boxShadow: activeTabId === tab.id ? '0 -1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'background-color 0.2s'
            }}
          >
            <div style={{ 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                {tab.isLoading && <span className="loading-spinner" style={{ fontSize: '10px' }}>↻</span>}
                {tab.title}
            </div>
            <div 
                onClick={(e) => handleCloseTab(e, tab.id)}
                style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '8px',
                    fontSize: '10px',
                    opacity: 0.6,
                    color: getColor('text-secondary')
                }}
                className="close-btn"
            >✕</div>
          </div>
        ))}
        <div 
            onClick={handleAddTab}
            style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                color: getColor('text-secondary')
            }}
        >+</div>
      </div>

      {/* Navigation Bar */}
      <div style={{ 
        height: '44px', 
        backgroundColor: getColor('surface-primary'), 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 8px', 
        gap: '8px',
        borderBottom: `1px solid ${getColor('border-color')}`
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={handleBack} disabled={!activeTab.canGoBack} style={{ border: 'none', background: 'transparent', cursor: activeTab.canGoBack ? 'pointer' : 'default', opacity: activeTab.canGoBack ? 1 : 0.3, padding: '4px', color: getColor('text-primary') }}>
                ◀
            </button>
            <button onClick={handleForward} disabled={!activeTab.canGoForward} style={{ border: 'none', background: 'transparent', cursor: activeTab.canGoForward ? 'pointer' : 'default', opacity: activeTab.canGoForward ? 1 : 0.3, padding: '4px', color: getColor('text-primary') }}>
                ▶
            </button>
            <button onClick={handleReload} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: getColor('text-primary') }}>
                ↻
            </button>
        </div>
        
        <div style={{ 
            flex: 1, 
            backgroundColor: getColor('bg-secondary'), 
            borderRadius: '20px', 
            height: '28px', 
            display: 'flex', 
            alignItems: 'center',
            padding: '0 12px',
            border: '1px solid transparent',
            position: 'relative'
        }}>
            <input 
                value={urlInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={(e) => {
                    e.target.select()
                    if (urlInput.trim()) setShowSuggestions(true)
                }}
                style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 'var(--font-size-md)',
                    color: getColor('text-primary'),
                    fontFamily: 'var(--font-family-ui)'
                }}
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions && urlInput.trim() && (
              <div 
                ref={suggestionsRef}
                style={{
                  position: 'absolute',
                  top: '36px',
                  left: '0',
                  right: '0',
                  backgroundColor: getColor('surface-primary'),
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  border: `1px solid ${getColor('border-color')}`,
                  zIndex: 100,
                  overflow: 'hidden'
                }}
              >
                <div 
                  onClick={() => handleSuggestionClick('google')}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: selectedSuggestionIndex === 0 ? getColor('bg-secondary') : getColor('surface-primary'),
                    borderBottom: `1px solid ${getColor('border-color')}`
                  }}
                  onMouseEnter={() => setSelectedSuggestionIndex(0)}
                >
                  <span style={{ fontSize: '16px' }}>🔍</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 'var(--font-size-md)', color: getColor('text-primary') }}>Google Search</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: getColor('text-secondary') }}>{urlInput}</span>
                  </div>
                </div>
                
                <div 
                  onClick={() => handleSuggestionClick('ai')}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: selectedSuggestionIndex === 1 ? getColor('bg-secondary') : getColor('surface-primary')
                  }}
                  onMouseEnter={() => setSelectedSuggestionIndex(1)}
                >
                  <span style={{ fontSize: '16px' }}>✨</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 'var(--font-size-md)', color: getColor('text-primary') }}>AI Deep Search</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: getColor('text-secondary') }}>Smart analysis & summary</span>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Content Area (Webviews or Home) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tabs.map(tab => {
            const isHome = tab.url === 'trae://home' || !tab.url
            const homeState = tab.homeState || { searched: false, results: [], inputValue: '' }
            
            return (
            <div 
                key={tab.id} 
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    display: activeTabId === tab.id ? 'block' : 'none',
                    backgroundColor: 'var(--surface-primary)',
                    overflowY: isHome ? 'auto' : 'hidden'
                }}
            >
                {isHome ? (
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: homeState.searched ? 'flex-start' : 'center', 
                        height: '100%', 
                        width: '100%',
                        padding: '20px',
                        backgroundColor: getColor('bg-primary'),
                        transition: 'all 0.3s ease'
                    }}>
                        <h1 style={{ 
                            fontSize: homeState.searched ? '24px' : '32px', 
                            fontWeight: 600, 
                            marginBottom: homeState.searched ? '20px' : '40px',
                            marginTop: homeState.searched ? '20px' : '0',
                            color: getColor('text-primary'),
                            letterSpacing: '-0.5px',
                            transition: 'all 0.3s ease',
                            fontFamily: 'var(--font-family-ui)'
                        }}>
                            {homeState.searched ? 'AI 智能搜索' : `${greeting}，和我一起探索网络世界！`}
                        </h1>

                        <div style={{ 
                            width: '100%', 
                            maxWidth: '680px', 
                            backgroundColor: getColor('bg-secondary'),
                            borderRadius: '16px',
                            padding: '16px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                            border: `1px solid ${getColor('border-color')}`,
                            position: 'relative',
                            marginBottom: homeState.searched ? '20px' : '0',
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>🔍</span>
                                <input 
                                    placeholder="输入关键词进行模糊搜索与爬取..."
                                    value={urlInput}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleHomeSearch()
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        height: '40px',
                                        border: 'none',
                                        outline: 'none',
                                        backgroundColor: 'transparent',
                                        fontSize: 'var(--font-size-lg)',
                                        color: getColor('text-primary'),
                                        fontFamily: 'var(--font-family-ui)'
                                    }}
                                />
                                {searchLoading && <span className="loading-spinner">↻</span>}
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'flex-end', 
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: `1px solid ${getColor('border-color')}`
                            }}>
                                <button 
                                    onClick={handleHomeSearch}
                                    disabled={searchLoading || !urlInput.trim()}
                                    style={{
                                        padding: '8px 24px',
                                        borderRadius: '20px',
                                        backgroundColor: 'var(--accent-color)',
                                        color: 'white',
                                        border: 'none',
                                        cursor: searchLoading ? 'not-allowed' : 'pointer',
                                        fontSize: 'var(--font-size-base)',
                                        fontWeight: 500,
                                        opacity: searchLoading ? 0.7 : 1,
                                        fontFamily: 'var(--font-family-ui)'
                                    }}>
                                    {searchLoading ? '搜索中...' : '搜索'}
                                </button>
                            </div>
                        </div>

                        {/* Search Results */}
                        {homeState.searched && (
                            <div style={{
                                width: '100%',
                                maxWidth: '680px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                                paddingBottom: '40px',
                                opacity: searchLoading ? 0.5 : 1,
                                transition: 'opacity 0.2s'
                            }}>
                                {homeState.results.length === 0 && !searchLoading && (
                                    <div style={{ textAlign: 'center', color: getColor('text-secondary'), padding: '40px', fontFamily: 'var(--font-family-ui)' }}>
                                        未找到相关结果
                                    </div>
                                )}
                                {homeState.results.map((result: any, idx: number) => (
                                    <div key={idx} style={{
                                        backgroundColor: getColor('bg-secondary'),
                                        borderRadius: '12px',
                                        padding: '16px',
                                        border: `1px solid ${getColor('border-color')}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <a 
                                                href={result.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    // Navigate current tab instead of external
                                                    updateTab(activeTabId, { url: result.url, title: result.title })
                                                }}
                                                style={{ 
                                                    fontSize: 'var(--font-size-lg)', 
                                                    fontWeight: 600, 
                                                    color: 'var(--accent-color)',
                                                    textDecoration: 'none',
                                                    lineHeight: '1.4',
                                                    flex: 1,
                                                    marginRight: '10px',
                                                    fontFamily: 'var(--font-family-ui)'
                                                }}
                                            >
                                                {result.title}
                                            </a>
                                            <button
                                                onClick={() => handleCrawl(result.url)}
                                                disabled={crawling === result.url}
                                                style={{
                                                    padding: '4px 12px',
                                                    fontSize: 'var(--font-size-sm)',
                                                    borderRadius: '12px',
                                                    border: `1px solid ${getColor('border-color')}`,
                                                    backgroundColor: getColor('bg-tertiary'),
                                                    color: getColor('text-primary'),
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    fontFamily: 'var(--font-family-ui)'
                                                }}
                                            >
                                                {crawling === result.url ? '爬取中...' : '爬取内容'}
                                            </button>
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--success-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-family-ui)' }}>
                                            {result.url}
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-md)', color: getColor('text-secondary'), lineHeight: '1.5', fontFamily: 'var(--font-family-ui)' }}>
                                            {result.snippet}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {!homeState.searched && (
                            <div style={{ 
                                display: 'flex', 
                                gap: '12px', 
                                marginTop: '32px',
                                flexWrap: 'wrap',
                                justifyContent: 'center'
                            }}>
                                {[
                                    { icon: '🔎', label: '深度搜索' },
                                    { icon: '🕷️', label: '批量爬虫' },
                                    { icon: '📊', label: '数据分析' },
                                    { icon: '📝', label: '自动摘要' }
                                ].map((item, idx) => (
                                    <div key={idx} style={{
                                        padding: '8px 16px',
                                        backgroundColor: getColor('bg-secondary'),
                                        border: `1px solid ${getColor('border-color')}`,
                                        borderRadius: '20px',
                                        fontSize: 'var(--font-size-sm)',
                                        color: getColor('text-secondary'),
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s ease',
                                        fontFamily: 'var(--font-family-ui)'
                                    }}
                                    onClick={() => {
                                        const newValue = item.label + " "
                                        setUrlInput(newValue);
                                        updateHomeState(activeTabId, { inputValue: newValue })
                                    }}
                                    >
                                        {item.icon && <span>{item.icon}</span>}
                                        <span>{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                <webview
                    src={tab.url === 'trae://home' ? 'about:blank' : tab.url}
                    ref={(el: any) => {
                        if (el) {
                            webviewRefs.current[tab.id] = el
                            
                            // Attach listeners only once
                            if (!el.dataset.listenersAttached) {
                                // 设置窗口打开处理程序
                                el.addEventListener('dom-ready', () => {
                                    console.log('[Webview] DOM ready for tab:', tab.id)
                                    
                                    // 注入脚本来拦截链接点击
                                    el.executeJavaScript(`
                                        (function() {
                                            document.addEventListener('click', function(e) {
                                                var target = e.target.closest('a');
                                                if (target && target.href && !target.href.startsWith('javascript:') && !target.href.startsWith('mailto:') && !target.href.startsWith('tel:')) {
                                                    e.preventDefault();
                                                    window.location.href = 'webview-click:' + target.href;
                                                }
                                            }, true);
                                        })();
                                    `)
                                })
                                
                                // 监听自定义的webview-click事件
                                el.addEventListener('will-navigate', (e: any) => {
                                    console.log('[Webview] Will navigate:', e.url)
                                    if (e.url && e.url.startsWith('webview-click:')) {
                                        e.preventDefault()
                                        const actualUrl = e.url.replace('webview-click:', '')
                                        handleNewWindowUrl(actualUrl)
                                    } else if (e.url && e.url.startsWith('http')) {
                                        updateTab(tab.id, { url: e.url })
                                    }
                                })
                                
                                el.addEventListener('did-start-loading', () => {
                                    console.log('[Webview] Start loading for tab:', tab.id)
                                    updateTab(tab.id, { isLoading: true })
                                })
                                el.addEventListener('did-stop-loading', () => {
                                    console.log('[Webview] Stop loading for tab:', tab.id)
                                    updateTab(tab.id, { isLoading: false })
                                    // Update back/forward capability
                                    updateTab(tab.id, { 
                                        canGoBack: el.canGoBack(), 
                                        canGoForward: el.canGoForward() 
                                    })
                                })
                                el.addEventListener('page-title-updated', (e: any) => {
                                    console.log('[Webview] Title updated:', e.title)
                                    updateTab(tab.id, { title: e.title })
                                })
                                el.addEventListener('did-navigate', (e: any) => {
                                    console.log('[Webview] Did navigate:', e.url)
                                    updateTab(tab.id, { url: e.url })
                                })
                                el.addEventListener('did-navigate-in-page', (e: any) => {
                                    console.log('[Webview] Did navigate in page:', e.url)
                                    updateTab(tab.id, { url: e.url })
                                })
                                el.addEventListener('new-window', (e: any) => {
                                    console.log('[Webview] New window:', e.url)
                                    e.preventDefault()
                                    if (e.url) {
                                      handleNewWindowUrl(e.url)
                                    }
                                })
                                // Media and popup handling
                                el.addEventListener('console-message', (e: any) => {
                                    if (e.level >= 2) console.log('Webview console:', e.message)
                                })
                                el.addEventListener('did-fail-load', (e: any) => {
                                    console.error('[Webview] Failed to load:', e.errorCode, e.errorDescription)
                                })
                                el.dataset.listenersAttached = 'true'
                            }
                        }
                    }}
                    style={{ width: '100%', height: '100%', display: 'flex' }}
                    partition="persist:main"
                    allowpopups
                    webpreferences="
                        contextIsolation=no,
                        nodeIntegration=no,
                        webSecurity=no,
                        allowRunningInsecureContent=yes,
                        enableWebSQL=yes,
                        spellcheck=yes,
                        allowFileAccessFromFiles=yes,
                        allowUniversalAccessFromFileURLs=yes
                    "
                />
                )}
            </div>
            )
        })}
      </div>

      <style>{`
        .loading-spinner {
          display: inline-block;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .close-btn:hover {
            background-color: rgba(0,0,0,0.1);
            opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}

export default MainContent
