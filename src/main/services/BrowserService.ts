import { BrowserWindow } from 'electron'

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface ImageSearchResult {
  url: string
  title?: string
}

// 浏览器自动化操作选项
export interface BrowserAutomationOptions {
  url?: string
  selector?: string  // CSS选择器
  x?: number        // X坐标（用于点击）
  y?: number        // Y坐标（用于点击）
  text?: string     // 输入文本
  scrollTop?: number  // 滚动距离
  wait?: number     // 等待毫秒数
}

// 创建一个可复用的浏览器窗口的辅助函数
function createBrowserWindow(show: boolean = false): BrowserWindow {
  return new BrowserWindow({
    show,
    width: 1280,
    height: 800,
    webPreferences: {
      offscreen: !show,
      sandbox: false,
      webSecurity: false
    }
  })
}

export class BrowserService {
  async fetchPageContent(url: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
          offscreen: false,
          sandbox: false,
          webSecurity: false
        }
      })

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout fetching page'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        if (!win.isDestroyed()) win.destroy()
        clearTimeout(timeout)
        if (signal) signal.removeEventListener('abort', onAbort)
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          const content = await win.webContents.executeJavaScript(`
            (function() {
              // Remove scripts, styles, etc.
              const clone = document.body.cloneNode(true);
              const elementsToRemove = clone.querySelectorAll('script, style, noscript, iframe, svg');
              elementsToRemove.forEach(el => el.remove());
              return clone.innerText;
            })()
          `)
          
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(content)
        } catch (e: any) {
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(e)
        }
      })
    })
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
          sandbox: false
        }
      })

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout searching'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`

      win.loadURL(searchUrl, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          const results = await win.webContents.executeJavaScript(`
            (function() {
              const items = [];
              // Baidu result containers usually have class 'result c-container'
              const containers = document.querySelectorAll('.c-container');
              
              containers.forEach(container => {
                try {
                  const titleEl = container.querySelector('h3 a');
                  const link = titleEl ? titleEl.href : '';
                  const title = titleEl ? titleEl.innerText : '';
                  // Summary often in .c-abstract or similar
                  const summaryEl = container.querySelector('.c-abstract') || container.querySelector('.content-right_8Zs40');
                  const snippet = summaryEl ? summaryEl.innerText : '';
                  
                  if (title && link) {
                    items.push({ title, url: link, snippet });
                  }
                } catch(err) {}
              });
              return items;
            })()
          `)

          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(results)
        } catch (e: any) {
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(e)
        }
      })
    })
  }

  async searchImages(query: string, count: number = 10, signal?: AbortSignal): Promise<ImageSearchResult[]> {
    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
          sandbox: false
        }
      })

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout searching images'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      const searchUrl = `https://image.baidu.com/search/index?tn=baiduimage&word=${encodeURIComponent(query)}`

      win.loadURL(searchUrl, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          const results = await win.webContents.executeJavaScript(`
            (function() {
              function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
              return sleep(1500).then(async () => {
                const seen = new Set();
                const items = [];
                // Try to find image containers first for better metadata
                const imgContainers = document.querySelectorAll('.imgitem');
                
                if (imgContainers.length > 0) {
                   for (const container of imgContainers) {
                      const img = container.querySelector('img');
                      if (!img) continue;
                      const src = img.getAttribute('data-imgurl') || img.getAttribute('data-objurl') || img.getAttribute('data-src') || '';
                      if (!src || !src.startsWith('http') || seen.has(src)) continue;
                      
                      // Try to get title from container
                      const titleEl = container.querySelector('.imgitem-title');
                      const title = titleEl ? titleEl.innerText : (img.getAttribute('alt') || '');
                      
                      seen.add(src);
                      items.push({ url: src, title: title.trim() });
                      if (items.length >= ${Math.max(1, Math.min(50, count))}) break;
                   }
                }
                
                // Fallback to raw img tags if containers not found or not enough
                if (items.length < ${Math.max(1, Math.min(50, count))}) {
                    const imgs = Array.from(document.querySelectorAll('img'));
                    for (const img of imgs) {
                      // IMPORTANT: do NOT use plain src here; it often captures UI icons/logos and ads.
                      const src = img.getAttribute('data-imgurl') || img.getAttribute('data-objurl') || img.getAttribute('data-src') || '';
                      if (!src || !src.startsWith('http') || seen.has(src)) continue;
                      
                      seen.add(src);
                      const alt = img.getAttribute('alt') || '';
                      items.push({ url: src, title: alt.trim() });
                      if (items.length >= ${Math.max(1, Math.min(50, count))}) break;
                    }
                }
                
                return items;
              });
            })()
          `)

          clearTimeout(timeout)
          if (signal) signal.removeEventListener('abort', onAbort)
          if (!win.isDestroyed()) win.close()
          resolve(results)
        } catch (e: any) {
          clearTimeout(timeout)
          if (signal) signal.removeEventListener('abort', onAbort)
          if (!win.isDestroyed()) win.close()
          reject(e)
        }
      })
    })
  }

  // ========== 浏览器自动化功能 ==========

  // 点击网页元素
  async clickElement(url: string, selector: string, signal?: AbortSignal): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const win = this.createBrowserWindow(true)

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout clicking element'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          const result = await win.webContents.executeJavaScript(`
            (function() {
              const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
              if (!el) return { success: false, message: 'Element not found: ' + '${selector}' };
              
              // 检查元素是否可见
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) {
                return { success: false, message: 'Element is not visible' };
              }
              
              // 尝试点击
              el.click();
              return { success: true, message: 'Clicked element: ${selector}' };
            })()
          `)

          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(result)
        } catch (e: any) {
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(e)
        }
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })
    })
  }

  // 在输入框中输入文字
  async typeText(url: string, selector: string, text: string, signal?: AbortSignal): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const win = this.createBrowserWindow(true)

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout typing text'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          // 转义文本中的特殊字符
          const escapedText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
          
          const result = await win.webContents.executeJavaScript(`
            (function() {
              const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
              if (!el) return { success: false, message: 'Element not found: ' + '${selector}' };
              
              // 检查是否是输入元素
              const tagName = el.tagName.toLowerCase();
              if (tagName !== 'input' && tagName !== 'textarea' && !el.isContentEditable) {
                return { success: false, message: 'Element is not an input field' };
              }
              
              // 设置值
              if (el.isContentEditable) {
                el.innerText = '${escapedText}';
              } else {
                el.value = '${escapedText}';
              }
              
              // 触发input事件
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              
              return { success: true, message: 'Typed text into: ${selector}' };
            })()
          `)

          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(result)
        } catch (e: any) {
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(e)
        }
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })
    })
  }

  // 滚动页面
  async scrollPage(url: string, scrollTop: number, signal?: AbortSignal): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const win = this.createBrowserWindow(true)

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout scrolling page'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          const result = await win.webContents.executeJavaScript(`
            (function() {
              window.scrollTo(0, ${scrollTop});
              return { success: true, message: 'Scrolled to position: ${scrollTop}', currentScroll: window.scrollY };
            })()
          `)

          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(result)
        } catch (e: any) {
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(e)
        }
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })
    })
  }

  // 截图
  async takeScreenshot(url: string, signal?: AbortSignal): Promise<{ success: boolean; dataUrl?: string; message: string }> {
    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
          offscreen: true,
          sandbox: false,
          webSecurity: false
        }
      })

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout taking screenshot'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          // 等待页面渲染
          await new Promise(r => setTimeout(r, 1000))
          
          const dataUrl = await win.webContents.capturePage()
          const base64 = dataUrl.toDataURL()

          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          
          resolve({
            success: true,
            dataUrl: base64,
            message: 'Screenshot taken'
          })
        } catch (e: any) {
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(e)
        }
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })
    })
  }

  // 获取页面元素信息
  async getPageElements(url: string, signal?: AbortSignal): Promise<{ success: boolean; elements: any[]; message: string }> {
    return new Promise((resolve, reject) => {
      const win = this.createBrowserWindow(true)

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout getting page elements'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          // 等待页面渲染
          await new Promise(r => setTimeout(r, 1000))
          
          const result = await win.webContents.executeJavaScript(`
            (function() {
              const elements = [];
              const tags = document.querySelectorAll('a, button, input, select, textarea');
              
              tags.forEach((el, index) => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  elements.push({
                    index: index,
                    tag: el.tagName.toLowerCase(),
                    id: el.id || '',
                    className: el.className || '',
                    text: (el.innerText || '').substring(0, 50),
                    name: el.getAttribute('name') || '',
                    type: el.getAttribute('type') || '',
                    placeholder: el.getAttribute('placeholder') || '',
                    href: el.href || '',
                    selector: ''
                  });
                }
              });
              
              // 生成CSS选择器
              elements.forEach(el => {
                if (el.id) {
                  el.selector = '#' + el.id;
                } else if (el.className) {
                  const className = el.className.split(' ')[0];
                  el.selector = el.tag + '.' + className;
                } else {
                  el.selector = el.tag + ':nth-of-type(' + (elements.filter(e => e.tag === el.tag).indexOf(el) + 1) + ')';
                }
              });
              
              return { success: true, elements: elements.slice(0, 50), message: 'Found ' + elements.length + ' elements' };
            })()
          `)

          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(result)
        } catch (e: any) {
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(e)
        }
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })
    })
  }

  // 执行JavaScript代码
  async executeScript(url: string, script: string, signal?: AbortSignal): Promise<{ success: boolean; result: any; message: string }> {
    return new Promise((resolve, reject) => {
      const win = this.createBrowserWindow(true)

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout executing script'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          const result = await win.webContents.executeJavaScript(`
            (function() {
              try {
                ${script};
                return { success: true, result: String(result), message: 'Script executed successfully' };
              } catch (e) {
                return { success: false, result: null, message: 'Script error: ' + e.message };
              }
            })()
          `)

          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(result)
        } catch (e: any) {
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(e)
        }
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })
    })
  }

  // 导航到指定URL (返回可复用的窗口用于后续操作)
  private activeWindow: BrowserWindow | null = null
  
  async goto(url: string, signal?: AbortSignal): Promise<{ success: boolean; windowId: number; message: string }> {
    return new Promise((resolve, reject) => {
      // 如果有已存在的活动窗口，先关闭
      if (this.activeWindow && !this.activeWindow.isDestroyed()) {
        this.activeWindow.close()
      }
      
      const win = createBrowserWindow(true)
      this.activeWindow = win

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout navigating to URL'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        clearTimeout(timeout)
        if (signal) signal.removeEventListener('abort', onAbort)
        resolve({
          success: true,
          windowId: win.id,
          message: `Navigated to ${url}`
        })
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })
    })
  }

  // 等待元素出现
  async waitForSelector(url: string, selector: string, timeout: number = 10000, signal?: AbortSignal): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const win = createBrowserWindow(true)
      this.activeWindow = win

      const startTime = Date.now()
      const checkTimeout = setTimeout(() => {
        if (!win.isDestroyed()) win.close()
        reject(new Error('Timeout waiting for element'))
      }, timeout + 5000)

      const onAbort = () => {
        clearTimeout(checkTimeout)
        if (!win.isDestroyed()) win.close()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      // 轮询检查元素
      const checkElement = async () => {
        try {
          const result = await win.webContents.executeJavaScript(`
            (function() {
              const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
              if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  return { found: true };
                }
              }
              return { found: false };
            })()
          `)
          
          if (result.found) {
            clearTimeout(checkTimeout)
            if (signal) signal.removeEventListener('abort', onAbort)
            resolve({ success: true, message: `Element ${selector} found` })
            return
          }
          
          // 检查超时
          if (Date.now() - startTime > timeout) {
            clearTimeout(checkTimeout)
            if (!win.isDestroyed()) win.close()
            resolve({ success: false, message: `Element ${selector} not found after ${timeout}ms` })
            return
          }
          
          // 继续轮询
          setTimeout(checkElement, 500)
        } catch (e) {
          setTimeout(checkElement, 500)
        }
      }

      win.webContents.on('did-finish-load', () => {
        checkElement()
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(checkTimeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })
    })
  }

  // 获取所有窗口/Tab信息
  async getTabs(): Promise<{ success: boolean; tabs: any[]; message: string }> {
    try {
      const windows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed())
      const tabs = await Promise.all(windows.map(async (win) => {
        let title = ''
        let url = ''
        try {
          title = win.getTitle() || ''
          url = win.webContents.getURL() || ''
        } catch (e) {}
        return {
          id: win.id,
          title: title.substring(0, 100),
          url: url,
          isVisible: win.isVisible()
        }
      }))
      return { success: true, tabs, message: `Found ${tabs.length} tabs` }
    } catch (error: any) {
      return { success: false, tabs: [], error: error.message }
    }
  }

  // 切换到指定窗口/Tab
  async switchTab(windowId: number): Promise<{ success: boolean; message: string }> {
    try {
      const windows = BrowserWindow.getAllWindows()
      const targetWindow = windows.find(w => w.id === windowId)
      if (!targetWindow) {
        return { success: false, message: `Window ${windowId} not found` }
      }
      targetWindow.focus()
      this.activeWindow = targetWindow
      return { success: true, message: `Switched to window ${windowId}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // 播放视频（专门处理视频播放）
  async playVideo(url: string, signal?: AbortSignal): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const win = createBrowserWindow(true)
      this.activeWindow = win

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout playing video'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          // 等待页面加载完成后尝试播放
          await new Promise(r => setTimeout(r, 2000))
          
          const result = await win.webContents.executeJavaScript(`
            (function() {
              // 查找视频元素
              const video = document.querySelector('video');
              if (!video) {
                // 尝试查找播放按钮
                const playBtn = document.querySelector('.bpx-player-ctrl-play');
                if (playBtn) {
                  playBtn.click();
                  return { success: true, method: 'playButton', message: 'Clicked play button' };
                }
                return { success: false, message: 'No video element found' };
              }
              
              // 尝试播放
              const playPromise = video.play();
              if (playPromise !== undefined) {
                playPromise.then(() => {
                  // 播放成功
                }).catch(e => {
                  // 可能需要先取消静音
                  video.muted = true;
                  video.play().catch(err => {});
                });
              }
              
              return { success: true, method: 'videoPlay', message: 'Video playing' };
            })()
          `)

          clearTimeout(timeout)
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(result)
        } catch (e: any) {
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(e)
        }
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })
    })
  }

  // 获取当前活动窗口的URL
  async getCurrentUrl(): Promise<{ success: boolean; url?: string; message: string }> {
    if (!this.activeWindow || this.activeWindow.isDestroyed()) {
      return { success: false, message: 'No active window' }
    }
    try {
      const url = this.activeWindow.webContents.getURL()
      return { success: true, url, message: 'Current URL retrieved' }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  }

  // 模拟按键
  async pressKey(url: string, key: string, selector?: string, signal?: AbortSignal): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      const win = createBrowserWindow(true)
      this.activeWindow = win

      const timeout = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Timeout pressing key'))
      }, 30000)

      const onAbort = () => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error('Task cancelled'))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      win.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      win.webContents.on('did-finish-load', async () => {
        try {
          // 先聚焦元素（如果指定了selector）
          let focusCode = ''
          if (selector) {
            focusCode = `
              const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
              if (el) el.focus();
            `
          }

          // 映射按键名称
          const keyMap: Record<string, string> = {
            'Enter': 'Enter',
            'Tab': 'Tab',
            'Escape': 'Escape',
            'Esc': 'Escape',
            'Backspace': 'Backspace',
            'Delete': 'Delete',
            'ArrowUp': 'ArrowUp',
            'ArrowDown': 'ArrowDown',
            'ArrowLeft': 'ArrowLeft',
            'ArrowRight': 'ArrowRight',
            'Space': ' ',
            ' ': ' ',
            'Home': 'Home',
            'End': 'End',
            'PageUp': 'PageUp',
            'PageDown': 'PageDown'
          }
          
          const keyCode = keyMap[key] || key
          
          const result = await win.webContents.executeJavaScript(`
            (function() {
              ${focusCode}
              
              // 创建键盘事件
              const event = new KeyboardEvent('keydown', {
                key: '${keyCode}',
                code: 'Key${keyCode.charAt(0).toUpperCase() + keyCode.slice(1)}',
                keyCode: ${key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : 0},
                which: ${key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : 0},
                bubbles: true,
                cancelable: true
              });
              
              document.activeElement?.dispatchEvent(event);
              
              return { success: true, message: 'Pressed key: ${key}' };
            })()
          `)

          clearTimeout(timeout)
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(result)
        } catch (e: any) {
          clearTimeout(timeout)
          if (!win.isDestroyed()) win.close()
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(e)
        }
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
        reject(new Error(`Failed to load: ${errorDescription} (${errorCode})`))
      })
    })
  }

  // 下载文件/图片
  async downloadResource(url: string, savePath: string, referer?: string, signal?: AbortSignal): Promise<{ success: boolean; path?: string; message: string }> {
    try {
      // 处理base64图片
      if (url.startsWith('data:')) {
        const base64Data = url.split(',')[1]
        if (!base64Data) {
          return { success: false, message: 'Invalid base64 data' }
        }
        const buffer = Buffer.from(base64Data, 'base64')
        const fs = require('fs')
        const dir = require('path').dirname(savePath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(savePath, buffer)
        return { success: true, path: savePath, message: `Saved to ${savePath}` }
      }

      // 下载网络资源
      const axios = require('axios')
      const fs = require('fs')
      const path = require('path')
      
      const dir = path.dirname(savePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
      if (referer) {
        headers.Referer = referer
      }

      const response = await axios.get(url, {
        headers,
        responseType: 'arraybuffer',
        timeout: 60000,
        signal
      })

      fs.writeFileSync(savePath, Buffer.from(response.data))
      return { success: true, path: savePath, message: `Downloaded to ${savePath}` }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  }

  // 获取Cookie
  async getCookies(url: string): Promise<{ success: boolean; cookies: any[]; message: string }> {
    try {
      // 使用活动窗口获取cookie
      if (!this.activeWindow || this.activeWindow.isDestroyed()) {
        // 如果没有活动窗口，创建一个临时窗口
        const win = createBrowserWindow(false)
        await win.loadURL(url)
        const cookies = await win.session.cookies.get({ url })
        win.close()
        return { success: true, cookies, message: `Got ${cookies.length} cookies` }
      }
      
      const cookies = await this.activeWindow.session.cookies.get({ url })
      return { success: true, cookies, message: `Got ${cookies.length} cookies` }
    } catch (error: any) {
      return { success: false, cookies: [], message: error.message }
    }
  }

  // 设置Cookie
  async setCookies(url: string, cookies: Array<{ name: string; value: string; domain?: string; path?: string }>): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.activeWindow || this.activeWindow.isDestroyed()) {
        const win = createBrowserWindow(false)
        await win.loadURL(url)
        
        for (const cookie of cookies) {
          await win.session.cookies.set({
            url,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/'
          })
        }
        win.close()
        return { success: true, message: `Set ${cookies.length} cookies` }
      }

      for (const cookie of cookies) {
        await this.activeWindow.session.cookies.set({
          url,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/'
        })
      }
      return { success: true, message: `Set ${cookies.length} cookies` }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  }

  // 清除Cookie
  async clearCookies(url?: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.activeWindow || this.activeWindow.isDestroyed()) {
        return { success: false, message: 'No active window' }
      }

      if (url) {
        const cookies = await this.activeWindow.session.cookies.get({ url })
        for (const cookie of cookies) {
          await this.activeWindow.session.cookies.remove(url, cookie.name)
        }
        return { success: true, message: `Cleared cookies for ${url}` }
      } else {
        // 清除所有cookie
        const cookies = await this.activeWindow.session.cookies.get({})
        for (const cookie of cookies) {
          await this.activeWindow.session.cookies.remove(cookie.domain || url, cookie.name)
        }
        return { success: true, message: 'Cleared all cookies' }
      }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  }
}

export const browserService = new BrowserService()
