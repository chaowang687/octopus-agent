/**
 * System Automation Service for Mini-Agent
 * Provides mouse, keyboard, and screen automation capabilities using Nut.js
 */

import { 
  mouse, 
  straightTo, 
  leftButton, 
  rightButton, 
  keyboard, 
  Key, 
  Button,
  screen,
  Point,
  Region,
  imageResource
} from "@nut-tree/nut-js";
import { clipboard } from "electron";
import * as fs from "fs";
import * as path from "path";

// Define types for automation operations
export interface MousePosition {
  x: number;
  y: number;
}

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  doubleClick?: boolean;
  delay?: number;
}

export interface KeyboardOptions {
  delay?: number;
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];
}

export interface AutomationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export class SystemAutomationService {
  constructor() {
    // Configure nut.js to be less aggressive with delays
    mouse.config.autoDelayMs = 100;
    keyboard.config.autoDelayMs = 50;
  }

  /**
   * Move mouse to specific coordinates
   */
  async moveMouse(x: number, y: number): Promise<AutomationResult> {
    try {
      const targetPoint = new Point(x, y);
      await mouse.move(straightTo(targetPoint));
      
      return {
        success: true,
        message: `Mouse moved to (${x}, ${y})`,
        data: { x, y }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to move mouse to (${x}, ${y})`,
        error: error.message
      };
    }
  }

  /**
   * Perform a click at specific coordinates
   */
  async clickAt(x: number, y: number, options: ClickOptions = {}): Promise<AutomationResult> {
    try {
      // Move to position first
      await this.moveMouse(x, y);
      
      const button = options.button === 'right' ? rightButton : 
                    options.button === 'middle' ? Button.MIDDLE : 
                    leftButton;
      
      if (options.doubleClick) {
        await mouse.click(button);
        await new Promise(resolve => setTimeout(resolve, options.delay || 100));
        await mouse.click(button);
      } else {
        await mouse.click(button);
      }
      
      return {
        success: true,
        message: `Clicked at (${x}, ${y}) with ${options.button || 'left'} button`,
        data: { x, y, button: options.button || 'left', doubleClick: options.doubleClick }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to click at (${x}, ${y})`,
        error: error.message
      };
    }
  }

  /**
   * Click on a specific element by its ID or coordinates
   */
  async clickElement(elementIdOrCoords: string | { x: number; y: number }): Promise<AutomationResult> {
    try {
      let x: number, y: number;
      
      if (typeof elementIdOrCoords === 'string') {
        // In a real implementation, we would map element IDs to coordinates
        // For now, this is a placeholder that assumes elementId is coordinates in "x,y" format
        const coords = elementIdOrCoords.split(',').map(Number);
        if (coords.length === 2) {
          [x, y] = coords;
        } else {
          return {
            success: false,
            message: `Invalid element ID format: ${elementIdOrCoords}. Expected "x,y" format.`,
            error: 'Invalid element ID format'
          };
        }
      } else {
        ({ x, y } = elementIdOrCoords);
      }
      
      return await this.clickAt(x, y);
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to click element: ${elementIdOrCoords}`,
        error: error.message
      };
    }
  }

  /**
   * Type text at current cursor position or at specific coordinates
   */
  async typeText(text: string, coords?: { x: number; y: number }): Promise<AutomationResult> {
    try {
      // If coordinates provided, move mouse there first and click
      if (coords) {
        await this.clickAt(coords.x, coords.y);
      }
      
      await keyboard.type(text);
      
      return {
        success: true,
        message: `Typed text: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to type text: "${text}"`,
        error: error.message
      };
    }
  }

  /**
   * Press a specific key or key combination
   */
  async pressKey(key: string, modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[]): Promise<AutomationResult> {
    try {
      const nutKeys: Key[] = [];
      
      // Add modifiers first
      if (modifiers) {
        for (const mod of modifiers) {
          switch (mod) {
            case 'ctrl':
              nutKeys.push(Key.LeftControl);
              break;
            case 'shift':
              nutKeys.push(Key.LeftShift);
              break;
            case 'alt':
              nutKeys.push(Key.LeftAlt);
              break;
            case 'meta':
              nutKeys.push(Key.LeftSuper); // Command key on Mac, Windows key on PC
              break;
          }
        }
      }
      
      // Add the main key
      const mainKey = this.mapStringToKey(key);
      if (mainKey) {
        nutKeys.push(mainKey);
      }
      
      if (nutKeys.length > 0) {
        await keyboard.pressKey(...nutKeys);
        // Release keys in reverse order
        for (let i = nutKeys.length - 1; i >= 0; i--) {
          await keyboard.releaseKey(nutKeys[i]);
        }
      }
      
      return {
        success: true,
        message: `Pressed key${modifiers ? ' with modifiers' : ''}: ${key}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to press key: ${key}`,
        error: error.message
      };
    }
  }

  /**
   * Take a screenshot of the entire screen or a specific region
   */
  async takeScreenshot(region?: { x: number; y: number; width: number; height: number }): Promise<AutomationResult> {
    try {
      let imagePath: string;
      
      if (region) {
        const screenRegion = new Region(region.x, region.y, region.width, region.height);
        const screenshot = await screen.grabScreenRegion(screenRegion);
        imagePath = path.join(require('os').tmpdir(), `screenshot_${Date.now()}.png`);
        await screenshot.toFile(imagePath);
      } else {
        const screenshot = await screen.grabScreen();
        imagePath = path.join(require('os').tmpdir(), `fullscreen_${Date.now()}.png`);
        await screenshot.toFile(imagePath);
      }
      
      return {
        success: true,
        message: 'Screenshot taken successfully',
        data: { imagePath }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to take screenshot',
        error: error.message
      };
    }
  }

  /**
   * Get current mouse position
   */
  async getMousePosition(): Promise<AutomationResult> {
    try {
      const pos = await mouse.getPosition();
      
      return {
        success: true,
        message: 'Mouse position retrieved',
        data: { x: pos.x, y: pos.y }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to get mouse position',
        error: error.message
      };
    }
  }

  /**
   * Scroll mouse wheel
   */
  async scroll(direction: 'up' | 'down' | 'left' | 'right', amount: number = 1): Promise<AutomationResult> {
    try {
      switch (direction) {
        case 'up':
          await mouse.scroll(0, -amount);
          break;
        case 'down':
          await mouse.scroll(0, amount);
          break;
        case 'left':
          await mouse.scroll(-amount, 0);
          break;
        case 'right':
          await mouse.scroll(amount, 0);
          break;
      }
      
      return {
        success: true,
        message: `Scrolled ${direction} by ${amount} units`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to scroll ${direction}`,
        error: error.message
      };
    }
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string): Promise<AutomationResult> {
    try {
      // In Electron main process, we can use the clipboard module
      clipboard.writeText(text);
      
      return {
        success: true,
        message: 'Text copied to clipboard'
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to copy text to clipboard',
        error: error.message
      };
    }
  }

  /**
   * Paste from clipboard
   */
  async pasteFromClipboard(): Promise<AutomationResult> {
    try {
      // Simulate Ctrl+V (Cmd+V on Mac) to paste
      const isMac = process.platform === 'darwin';
      const modifierKey = isMac ? Key.LeftSuper : Key.LeftControl;
      
      await keyboard.pressKey(modifierKey, Key.V);
      await keyboard.releaseKey(Key.V);
      await keyboard.releaseKey(modifierKey);
      
      return {
        success: true,
        message: 'Paste operation simulated'
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to simulate paste operation',
        error: error.message
      };
    }
  }

  /**
   * Get screen dimensions
   */
  async getScreenDimensions(): Promise<AutomationResult> {
    try {
      const screenSize = await screen.size();
      
      return {
        success: true,
        message: 'Screen dimensions retrieved',
        data: { width: screenSize.width, height: screenSize.height }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to get screen dimensions',
        error: error.message
      };
    }
  }

  /**
   * Helper method to map string keys to Nut.js Key enum
   */
  private mapStringToKey(keyString: string): Key | null {
    const keyMap: { [key: string]: Key } = {
      'enter': Key.Enter,
      'return': Key.Enter,
      'tab': Key.Tab,
      'backspace': Key.Backspace,
      'delete': Key.Delete,
      'del': Key.Delete,
      'escape': Key.Escape,
      'esc': Key.Escape,
      'space': Key.Space,
      'up': Key.Up,
      'down': Key.Down,
      'left': Key.Left,
      'right': Key.Right,
      'home': Key.Home,
      'end': Key.End,
      'pageup': Key.PageUp,
      'pagedown': Key.PageDown,
      'f1': Key.F1,
      'f2': Key.F2,
      'f3': Key.F3,
      'f4': Key.F4,
      'f5': Key.F5,
      'f6': Key.F6,
      'f7': Key.F7,
      'f8': Key.F8,
      'f9': Key.F9,
      'f10': Key.F10,
      'f11': Key.F11,
      'f12': Key.F12,
      'a': Key.A,
      'b': Key.B,
      'c': Key.C,
      'd': Key.D,
      'e': Key.E,
      'f': Key.F,
      'g': Key.G,
      'h': Key.H,
      'i': Key.I,
      'j': Key.J,
      'k': Key.K,
      'l': Key.L,
      'm': Key.M,
      'n': Key.N,
      'o': Key.O,
      'p': Key.P,
      'q': Key.Q,
      'r': Key.R,
      's': Key.S,
      't': Key.T,
      'u': Key.U,
      'v': Key.V,
      'w': Key.W,
      'x': Key.X,
      'y': Key.Y,
      'z': Key.Z,
      '0': Key.Num0,
      '1': Key.Num1,
      '2': Key.Num2,
      '3': Key.Num3,
      '4': Key.Num4,
      '5': Key.Num5,
      '6': Key.Num6,
      '7': Key.Num7,
      '8': Key.Num8,
      '9': Key.Num9,
    };

    return keyMap[keyString.toLowerCase()] || null;
  }

  /**
   * Wait for a specified amount of time
   */
  async waitFor(milliseconds: number): Promise<AutomationResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: `Waited for ${milliseconds}ms`
        });
      }, milliseconds);
    });
  }
}