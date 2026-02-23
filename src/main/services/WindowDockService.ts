import { BrowserWindow, screen, ipcMain } from 'electron'

let ipcHandlersRegistered = false

export class WindowDockService {
  private window: BrowserWindow
  private isDocked: boolean = false
  private dockedEdge: 'top' | null = null
  private originalBounds: any = null
  private isExpanded: boolean = false
  private checkInterval: NodeJS.Timeout | null = null
  private dockThreshold: number = 100
  private collapseDelay: number = 3000
  private collapseTimer: NodeJS.Timeout | null = null
  private animationInterval: NodeJS.Timeout | null = null
  private animationDuration: number = 200
  private animationFrames: number = 30
  private userDefinedHeight: number | null = null
  private userDefinedWidth: number | null = null
  private resizeListener: (() => void) | null = null
  private dockAlignment: 'left' | 'center' | 'right' = 'center'

  constructor(window: BrowserWindow) {
    this.window = window
    this.setupEventListeners()
    this.setupIPC()
  }

  private setupEventListeners() {
    this.window.on('move', () => this.checkDockPosition())
    this.window.on('moved', () => this.checkDockPosition())
    
    this.window.on('close', () => {
      this.cleanup()
    })
  }

  private setupIPC() {
    if (!ipcHandlersRegistered) {
      ipcMain.handle('window:toggle-dock', () => {
        if (windowDockService) {
          windowDockService.toggleDock()
        }
      })

      ipcMain.handle('window:is-docked', () => {
        return windowDockService?.isDocked || false
      })
      ipcHandlersRegistered = true
    }
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
  }

  private animateBounds(from: any, to: any, callback?: () => void) {
    if (this.animationInterval) {
      clearInterval(this.animationInterval)
      this.animationInterval = null
    }

    let frame = 0
    const totalFrames = this.animationFrames
    const frameDuration = this.animationDuration / totalFrames

    this.animationInterval = setInterval(() => {
      if (frame >= totalFrames) {
        if (this.animationInterval) {
          clearInterval(this.animationInterval)
          this.animationInterval = null
        }
        this.window.setBounds(to)
        if (callback) callback()
        return
      }

      const progress = this.easeOutCubic(frame / totalFrames)
      const currentBounds = {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        width: from.width + (to.width - from.width) * progress,
        height: from.height + (to.height - from.height) * progress
      }

      this.window.setBounds(currentBounds)
      frame++
    }, frameDuration)
  }

  private checkDockPosition() {
    if (!this.window || this.window.isDestroyed()) return

    const bounds = this.window.getBounds()
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workArea

    const isNearTop = bounds.y <= workArea.y + this.dockThreshold

    if (isNearTop && !this.isDocked) {
      const windowCenterX = bounds.x + bounds.width / 2
      const workAreaCenterX = workArea.x + workArea.width / 2
      const thirdWidth = workArea.width / 3
      
      if (windowCenterX < workArea.x + thirdWidth) {
        this.dockAlignment = 'left'
      } else if (windowCenterX > workArea.x + 2 * thirdWidth) {
        this.dockAlignment = 'right'
      } else {
        this.dockAlignment = 'center'
      }
      
      this.dockToTop()
    } else if (!isNearTop && this.isDocked && !this.isExpanded) {
      this.undock()
    }
  }

  private getDockX(workArea: any, width: number): number {
    switch (this.dockAlignment) {
      case 'left':
        return workArea.x
      case 'right':
        return workArea.x + workArea.width - width
      case 'center':
      default:
        return workArea.x + (workArea.width - width) / 2
    }
  }

  private dockToTop() {
    if (!this.window || this.window.isDestroyed()) return

    if (!this.originalBounds) {
      this.originalBounds = { ...this.window.getBounds() }
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workArea

    this.isDocked = true
    this.dockedEdge = 'top'
    this.isExpanded = false

    const expandedWidth = this.userDefinedWidth || workArea.width
    const currentBounds = this.window.getBounds()
    const collapsedBounds = {
      x: this.getDockX(workArea, expandedWidth),
      y: workArea.y,
      width: expandedWidth,
      height: 8
    }

    this.animateBounds(currentBounds, collapsedBounds, () => {
      this.window.setAlwaysOnTop(true)
      this.window.setResizable(false)
      this.startMouseTracking()
    })
  }

  private undock() {
    if (!this.window || this.window.isDestroyed()) return

    this.isDocked = false
    this.dockedEdge = null
    this.isExpanded = false
    
    this.stopResizeTracking()
    
    if (this.originalBounds) {
      const currentBounds = this.window.getBounds()
      this.animateBounds(currentBounds, this.originalBounds, () => {
        this.window.setAlwaysOnTop(false)
        this.window.setResizable(true)
        this.stopMouseTracking()
      })
    }
  }

  private startMouseTracking() {
    this.checkInterval = setInterval(() => {
      this.checkMousePosition()
    }, 50)
  }

  private stopMouseTracking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer)
      this.collapseTimer = null
    }
    if (this.animationInterval) {
      clearInterval(this.animationInterval)
      this.animationInterval = null
    }
  }

  private startResizeTracking() {
    this.stopResizeTracking()
    this.resizeListener = () => {
      if (this.isDocked && this.isExpanded) {
        const bounds = this.window.getBounds()
        const primaryDisplay = screen.getPrimaryDisplay()
        const workArea = primaryDisplay.workArea
        const maxHeight = workArea.height * 0.8
        const minWidth = Math.min(800, workArea.width * 0.4)
        const maxWidth = workArea.width
        
        if (bounds.height <= maxHeight && bounds.height >= 200) {
          this.userDefinedHeight = bounds.height
        }
        if (bounds.width <= maxWidth && bounds.width >= minWidth) {
          this.userDefinedWidth = bounds.width
        }
      }
    }
    this.window.on('resize', this.resizeListener)
  }

  private stopResizeTracking() {
    if (this.resizeListener) {
      this.window.off('resize', this.resizeListener)
      this.resizeListener = null
    }
  }

  private checkMousePosition() {
    if (!this.window || this.window.isDestroyed() || !this.isDocked) return

    const mousePos = screen.getCursorScreenPoint()
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workArea
    
    const expandedWidth = this.userDefinedWidth || workArea.width
    const expandedHeight = this.userDefinedHeight || 600
    const windowLeft = this.getDockX(workArea, expandedWidth)
    const windowRight = windowLeft + expandedWidth
    const dockY = workArea.y
    
    const isInHorizontalRange = mousePos.x >= windowLeft - 10 && mousePos.x <= windowRight + 10
    const triggerHeight = this.isExpanded ? expandedHeight + 10 : 30
    const isNearTop = mousePos.y <= dockY + triggerHeight && mousePos.y >= dockY - 10

    if (isNearTop && isInHorizontalRange && !this.isExpanded) {
      this.expand()
    } else if ((!isNearTop || !isInHorizontalRange) && this.isExpanded) {
      this.scheduleCollapse()
    }
  }

  private expand() {
    if (!this.window || this.window.isDestroyed()) return

    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer)
      this.collapseTimer = null
    }

    if (this.isExpanded) return

    this.isExpanded = true

    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workArea

    const defaultHeight = Math.min(this.originalBounds?.height || 600, workArea.height * 0.6)
    const expandedHeight = this.userDefinedHeight || defaultHeight
    const expandedWidth = this.userDefinedWidth || workArea.width
    const currentBounds = this.window.getBounds()

    const expandedBounds = {
      x: this.getDockX(workArea, expandedWidth),
      y: workArea.y,
      width: expandedWidth,
      height: expandedHeight
    }

    this.animateBounds(currentBounds, expandedBounds, () => {
      this.window.setResizable(true)
      this.startResizeTracking()
    })
  }

  private scheduleCollapse() {
    if (this.collapseTimer) return

    this.collapseTimer = setTimeout(() => {
      this.collapse()
    }, this.collapseDelay)
  }

  private collapse() {
    if (!this.window || this.window.isDestroyed()) return

    if (!this.isExpanded) return

    this.stopResizeTracking()
    this.isExpanded = false

    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workArea

    const expandedWidth = this.userDefinedWidth || workArea.width
    const currentBounds = this.window.getBounds()
    const collapsedBounds = {
      x: this.getDockX(workArea, expandedWidth),
      y: workArea.y,
      width: expandedWidth,
      height: 8
    }

    this.animateBounds(currentBounds, collapsedBounds, () => {
      this.window.setResizable(false)
    })
  }

  public toggleDock() {
    if (this.isDocked) {
      this.undock()
    } else {
      this.dockToTop()
    }
  }

  public cleanup() {
    this.stopResizeTracking()
    this.stopMouseTracking()
  }
}

let windowDockService: WindowDockService | null = null

export function initWindowDockService(window: BrowserWindow) {
  if (windowDockService) {
    windowDockService.cleanup()
  }
  windowDockService = new WindowDockService(window)
  return windowDockService
}

export function getWindowDockService(): WindowDockService | null {
  return windowDockService
}
