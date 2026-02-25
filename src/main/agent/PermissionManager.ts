/**
 * Permission Manager for Mini-Agent
 * Handles system-level permissions required for desktop automation
 */

import { systemService } from '../services/SystemService';
import { dialog, shell } from 'electron';
import * as os from 'os';

export interface PermissionStatus {
  screenCapture: boolean;
  accessibility: boolean;
  notifications: boolean;
  camera: boolean;
  microphone: boolean;
}

export class PermissionManager {
  /**
   * Check if the app has screen capture permission
   */
  async checkScreenCapturePermission(): Promise<boolean> {
    if (process.platform === 'darwin') { // macOS
      // On macOS, we need to check if we have screen recording permission
      try {
        const hasPermission = await this.checkScreenRecordingPermission_macOS();
        return hasPermission;
      } catch (error) {
        console.warn('Could not check screen capture permission:', error);
        return false;
      }
    } else if (process.platform === 'win32') { // Windows
      // On Windows, we generally don't need explicit screen capture permission
      // but we might want to check for elevated privileges in some cases
      return true;
    } else { // Linux and others
      // On Linux, it depends on the desktop environment
      return true;
    }
  }

  /**
   * Check if the app has accessibility permission (needed for automation)
   */
  async checkAccessibilityPermission(): Promise<boolean> {
    if (process.platform === 'darwin') { // macOS
      try {
        const hasPermission = await this.checkAccessibilityPermission_macOS();
        return hasPermission;
      } catch (error) {
        console.warn('Could not check accessibility permission:', error);
        return false;
      }
    } else if (process.platform === 'win32') { // Windows
      // On Windows, accessibility features might require elevated privileges
      // but no explicit permission dialog like macOS
      return true;
    } else { // Linux and others
      return true;
    }
  }

  /**
   * Request screen capture permission
   */
  async requestScreenCapturePermission(): Promise<boolean> {
    if (process.platform === 'darwin') { // macOS
      try {
        // On macOS, we need to guide the user to enable screen recording permission
        // This is typically done through System Preferences
        const granted = await this.requestScreenRecordingPermission_macOS();
        return granted;
      } catch (error) {
        console.error('Error requesting screen capture permission:', error);
        return false;
      }
    } else {
      // On other platforms, screen capture is typically available by default
      return true;
    }
  }

  /**
   * Request accessibility permission
   */
  async requestAccessibilityPermission(): Promise<boolean> {
    if (process.platform === 'darwin') { // macOS
      try {
        const granted = await this.requestAccessibilityPermission_macOS();
        return granted;
      } catch (error) {
        console.error('Error requesting accessibility permission:', error);
        return false;
      }
    } else {
      // On other platforms, accessibility permissions are handled differently
      return true;
    }
  }

  /**
   * Get comprehensive permission status
   */
  async getPermissionStatus(): Promise<PermissionStatus> {
    return {
      screenCapture: await this.checkScreenCapturePermission(),
      accessibility: await this.checkAccessibilityPermission(),
      notifications: true, // Assume true for now, implement if needed
      camera: true,        // Assume true for now, implement if needed
      microphone: true     // Assume true for now, implement if needed
    };
  }

  /**
   * Ensure required permissions are granted
   * If not, guide the user to grant them
   */
  async ensurePermissions(requiredPermissions: (keyof PermissionStatus)[] = ['screenCapture', 'accessibility']): Promise<boolean> {
    const status = await this.getPermissionStatus();
    
    for (const perm of requiredPermissions) {
      if (!status[perm]) {
        console.log(`Permission ${perm} is not granted, attempting to request...`);
        
        if (perm === 'screenCapture') {
          const granted = await this.requestScreenCapturePermission();
          if (!granted) {
            // Show a dialog to guide the user
            await this.showPermissionGuideDialog(perm);
            return false;
          }
        } else if (perm === 'accessibility') {
          const granted = await this.requestAccessibilityPermission();
          if (!granted) {
            // Show a dialog to guide the user
            await this.showPermissionGuideDialog(perm);
            return false;
          }
        }
      }
    }
    
    return true;
  }

  /**
   * macOS specific: Check screen recording permission
   */
  private async checkScreenRecordingPermission_macOS(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // On macOS, we need to try accessing the screen to see if we have permission
        // This is a simple test that doesn't actually capture anything
        const { desktopCapturer } = require('electron');
        
        if (!desktopCapturer || !desktopCapturer.getSources) {
          resolve(false);
          return;
        }
        
        // Try to get sources to check permission
        desktopCapturer.getSources({ types: ['screen'] }).then((sources: any[]) => {
          // If we get sources without error, we likely have permission
          resolve(sources.length > 0);
        }).catch(() => {
          // If we get an error, we likely don't have permission
          resolve(false);
        });
      } catch (error) {
        // If there's any error, return false
        resolve(false);
      }
    });
  }

  /**
   * macOS specific: Check accessibility permission
   */
  private async checkAccessibilityPermission_macOS(): Promise<boolean> {
    try {
      // On macOS, we can check accessibility permissions using system tools
      // This is a simplified check - in practice, you might need more sophisticated checking
      const { execSync } = require('child_process');
      
      // Check if our app is in the accessibility allowed list
      const result = execSync('tccutil list screen_capture', { encoding: 'utf8' });
      const appId = require('electron').app ? require('electron').app.getName() : 'com.trae.desktop-agent';
      
      return result.includes(appId) || result.includes(process.execPath);
    } catch (error) {
      console.warn('Could not check accessibility permission:', error);
      return false;
    }
  }

  /**
   * macOS specific: Request screen recording permission
   */
  private async requestScreenRecordingPermission_macOS(): Promise<boolean> {
    // On macOS, we can't programmatically request screen recording permission
    // We need to guide the user to System Preferences
    const result = await dialog.showMessageBox({
      type: 'info',
      title: '屏幕录制权限',
      message: '需要屏幕录制权限才能捕捉屏幕内容',
      detail: '请前往 系统偏好设置 > 安全性与隐私 > 隐私 > 屏幕录制，将此应用添加到允许列表中。',
      buttons: ['打开系统偏好设置', '稍后再说']
    });

    if (result.response === 0) {
      // Open System Preferences to the correct pane
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      return false; // We return false because the user needs to manually enable it
    }

    return false;
  }

  /**
   * macOS specific: Request accessibility permission
   */
  private async requestAccessibilityPermission_macOS(): Promise<boolean> {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: '辅助功能权限',
      message: '需要辅助功能权限才能执行自动化操作',
      detail: '请前往 系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能，将此应用添加到允许列表中。\n\n这是为了允许程序模拟鼠标点击和键盘输入。',
      buttons: ['打开系统偏好设置', '稍后再说']
    });

    if (result.response === 0) {
      // Open System Preferences to the correct pane
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
      return false; // We return false because the user needs to manually enable it
    }

    return false;
  }

  /**
   * Show a permission guide dialog to help user enable permissions
   */
  private async showPermissionGuideDialog(permissionType: keyof PermissionStatus): Promise<void> {
    let title, message, detail;
    
    switch (permissionType) {
      case 'screenCapture':
        title = '屏幕录制权限';
        message = '需要屏幕录制权限才能捕捉屏幕内容';
        detail = '请前往 系统偏好设置 > 安全性与隐私 > 隐私 > 屏幕录制，将此应用添加到允许列表中。';
        break;
      case 'accessibility':
        title = '辅助功能权限';
        message = '需要辅助功能权限才能执行自动化操作';
        detail = '请前往 系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能，将此应用添加到允许列表中。\n\n这是为了允许程序模拟鼠标点击和键盘输入。';
        break;
      default:
        title = '权限需求';
        message = `需要 ${permissionType} 权限`;
        detail = '请在系统设置中为此应用启用相应权限。';
    }
    
    const result = await dialog.showMessageBox({
      type: 'warning',
      title,
      message,
      detail,
      buttons: ['打开设置', '稍后再说'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      if (process.platform === 'darwin') {
        if (permissionType === 'screenCapture') {
          await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
        } else if (permissionType === 'accessibility') {
          await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
        }
      } else if (process.platform === 'win32') {
        // On Windows, open settings app
        await shell.openExternal('ms-settings:appsfeatures-app');
      }
    }
  }

  /**
   * Check if running on a platform that requires special permissions
   */
  isPlatformRequiringSpecialPermissions(): boolean {
    return process.platform === 'darwin'; // macOS requires special permissions
  }

  /**
   * Get platform-specific permission requirements
   */
  getPlatformPermissionRequirements(): string[] {
    if (process.platform === 'darwin') {
      return [
        'Screen Recording: Required for capturing screen content',
        'Accessibility: Required for simulating mouse clicks and keyboard input',
        'Full Disk Access: May be required for certain system operations (optional)'
      ];
    } else if (process.platform === 'win32') {
      return [
        'User Account Control (UAC): May require elevated privileges for some system operations',
        'Privacy Settings: Check if app has necessary permissions in Windows Privacy settings'
      ];
    } else {
      return [
        'Desktop Environment Permissions: Check your desktop environment settings for screen capture and input simulation permissions'
      ];
    }
  }
}