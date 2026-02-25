import { app } from 'electron'

export interface ElectronSecurityOptions {
  enableGpu: boolean
  enableSandbox: boolean
  enableWebSecurity: boolean
}

const defaultOptions: ElectronSecurityOptions = {
  enableGpu: false,
  enableSandbox: true,
  enableWebSecurity: true
}

export function configureSecurity(options: Partial<ElectronSecurityOptions> = {}): void {
  const config = { ...defaultOptions, ...options }
  
  if (!config.enableGpu) {
    app.commandLine.appendSwitch('disable-gpu')
    app.commandLine.appendSwitch('disable-gpu-compositing')
    app.commandLine.appendSwitch('disable-software-rasterizer')
    app.commandLine.appendSwitch('disable-gpu-process')
    app.commandLine.appendSwitch('disable-gpu-watchdog')
  }
  
  if (!config.enableSandbox) {
    console.warn('[Security] 沙箱已禁用 - 仅建议在开发环境使用')
    app.commandLine.appendSwitch('no-sandbox')
    app.commandLine.appendSwitch('disable-sandbox')
    app.commandLine.appendSwitch('disable-gpu-sandbox')
  }
  
  if (!config.enableWebSecurity) {
    console.warn('[Security] Web安全已禁用 - 仅建议在开发环境使用')
    app.commandLine.appendSwitch('disable-web-security')
    app.commandLine.appendSwitch('disable-features', 'CrossSiteDocumentBlockingIfIsolating')
  }
  
  app.commandLine.appendSwitch('enable-webview')
  app.commandLine.appendSwitch('allow-file-access-from-files')
  app.commandLine.appendSwitch('allow-universal-access-from-file-urls')
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
}

export function getRecommendedSecurityOptions(): ElectronSecurityOptions {
  // 使用环境变量来检测开发模式
  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1'
  
  return {
    enableGpu: false,
    enableSandbox: !isDev,
    enableWebSecurity: !isDev
  }
}
