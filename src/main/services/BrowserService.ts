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
}

export const browserService = new BrowserService()
