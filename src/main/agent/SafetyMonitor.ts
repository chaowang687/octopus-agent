/**
 * Safety Monitor for Mini-Agent
 * Provides emergency stop functionality and safety checks
 */

import { globalShortcut, BrowserWindow } from 'electron';
import { SystemAutomationService } from './SystemAutomationService';

export interface SafetyConfig {
  emergencyHotkey: string; // Default: 'CommandOrControl+Shift+Escape'
  maxExecutionTime: number; // in milliseconds, default: 300000 (5 minutes)
  maxActionsPerMinute: number; // Default: 60
  enableSafetyChecks: boolean; // Whether to enable safety checks
}

export interface EmergencyStopReason {
  reason: 'timeout' | 'manual' | 'safety_violation' | 'user_request';
  details: string;
  timestamp: number;
}

export class SafetyMonitor {
  private static instance: SafetyMonitor;
  private config: SafetyConfig;
  private isMonitoring: boolean = false;
  private startTime: number | null = null;
  private actionCount: number = 0;
  private lastActionMinute: number = 0;
  private registeredHotkeys: string[] = [];
  private automationService: SystemAutomationService;
  private onStopCallback: (() => void) | null = null;
  private recentActions: Array<{timestamp: number, action: string}> = [];

  private constructor(config?: Partial<SafetyConfig>) {
    this.config = {
      emergencyHotkey: config?.emergencyHotkey || 'CommandOrControl+Shift+Escape',
      maxExecutionTime: config?.maxExecutionTime || 300000, // 5 minutes
      maxActionsPerMinute: config?.maxActionsPerMinute || 60,
      enableSafetyChecks: config?.enableSafetyChecks ?? true
    };
    
    this.automationService = new SystemAutomationService();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<SafetyConfig>): SafetyMonitor {
    if (!SafetyMonitor.instance) {
      SafetyMonitor.instance = new SafetyMonitor(config);
    }
    return SafetyMonitor.instance;
  }

  /**
   * Start monitoring safety
   */
  startMonitoring(onStop?: () => void): void {
    if (this.isMonitoring) {
      console.warn('Safety monitor already running');
      return;
    }

    this.onStopCallback = onStop || null;
    this.isMonitoring = true;
    this.startTime = Date.now();
    this.actionCount = 0;
    this.lastActionMinute = Math.floor(Date.now() / 60000);
    this.recentActions = [];

    // Register emergency hotkey
    try {
      const success = globalShortcut.register(this.config.emergencyHotkey, () => {
        console.log(`Emergency stop triggered by hotkey: ${this.config.emergencyHotkey}`);
        this.triggerEmergencyStop({
          reason: 'manual',
          details: `Emergency stop triggered by hotkey: ${this.config.emergencyHotkey}`,
          timestamp: Date.now()
        });
      });

      if (success) {
        this.registeredHotkeys.push(this.config.emergencyHotkey);
        console.log(`Registered emergency hotkey: ${this.config.emergencyHotkey}`);
      } else {
        console.error(`Failed to register emergency hotkey: ${this.config.emergencyHotkey}`);
      }
    } catch (error) {
      console.error('Error registering emergency hotkey:', error);
    }

    // Start periodic safety checks
    this.startPeriodicChecks();
  }

  /**
   * Stop monitoring safety
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    
    // Unregister all hotkeys
    this.unregisterAllHotkeys();
    
    this.startTime = null;
    this.onStopCallback = null;
  }

  /**
   * Register an action that was performed
   */
  registerAction(action: string): void {
    if (!this.config.enableSafetyChecks) {
      return;
    }

    const now = Date.now();
    this.recentActions.push({ timestamp: now, action });
    
    // Clean up old actions (older than 1 minute)
    this.recentActions = this.recentActions.filter(
      record => now - record.timestamp < 60000
    );

    // Check rate limiting
    if (this.recentActions.length > this.config.maxActionsPerMinute) {
      console.warn(`Rate limit exceeded: ${this.recentActions.length} actions in the last minute`);
      this.triggerEmergencyStop({
        reason: 'safety_violation',
        details: `Rate limit exceeded: ${this.recentActions.length} actions in the last minute (max: ${this.config.maxActionsPerMinute})`,
        timestamp: Date.now()
      });
      return;
    }

    // Additional safety checks can be added here
  }

  /**
   * Check if an action is safe to perform
   */
  isActionSafe(action: string, params?: any): boolean {
    if (!this.config.enableSafetyChecks) {
      return true;
    }

    // Basic safety checks
    // Check for potentially dangerous commands
    if (action === 'execute_command') {
      const command = params?.command?.toLowerCase() || '';
      const dangerousCommands = [
        'rm -rf', 'rmdir', 'del ', 'format', 'shutdown', 
        'reboot', 'kill -9', 'sudo rm', 'dd if=', 'mkfs.'
      ];
      
      if (dangerousCommands.some(dc => command.includes(dc))) {
        console.warn(`Potentially dangerous command detected: ${command}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Trigger emergency stop
   */
  triggerEmergencyStop(reason: EmergencyStopReason): void {
    console.log('Emergency stop triggered:', reason);
    
    // Stop all ongoing operations
    this.stopMonitoring();
    
    // Optionally, move mouse to a safe position (top-left corner)
    this.moveToSafePosition();
    
    // Notify callback if registered
    if (this.onStopCallback) {
      this.onStopCallback();
    }
  }

  /**
   * Check if monitoring is currently active
   */
  getIsMonitoring(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get current safety status
   */
  getStatus(): {
    isMonitoring: boolean;
    elapsedMs: number | null;
    remainingMs: number | null;
    actionCount: number;
    recentActions: number;
  } {
    const now = Date.now();
      const elapsed = this.startTime ? now - this.startTime : null;
      const remaining = this.startTime ? this.config.maxExecutionTime - (now - this.startTime) : null;
      
      const recent = this.recentActions.filter(
        record => now - record.timestamp < 60000
      ).length;

      return {
        isMonitoring: this.isMonitoring,
        elapsedMs: elapsed,
        remainingMs: remaining,
        actionCount: this.actionCount,
        recentActions: recent
      };
  }

  /**
   * Get safety configuration
   */
  getConfig(): SafetyConfig {
    return { ...this.config };
  }

  /**
   * Update safety configuration
   */
  updateConfig(newConfig: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Private method to start periodic safety checks
   */
  private startPeriodicChecks(): void {
    if (!this.isMonitoring) return;

    const checkInterval = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(checkInterval);
        return;
      }

      // Check execution time limit
      if (this.startTime && Date.now() - this.startTime > this.config.maxExecutionTime) {
        this.triggerEmergencyStop({
          reason: 'timeout',
          details: `Maximum execution time exceeded: ${this.config.maxExecutionTime}ms`,
          timestamp: Date.now()
        });
        clearInterval(checkInterval);
        return;
      }

      // Perform other periodic checks here if needed
    }, 1000); // Check every second
  }

  /**
   * Private method to unregister all hotkeys
   */
  private unregisterAllHotkeys(): void {
    for (const hotkey of this.registeredHotkeys) {
      globalShortcut.unregister(hotkey);
    }
    this.registeredHotkeys = [];
  }

  /**
   * Move mouse to a safe position (top-left corner)
   */
  private moveToSafePosition(): void {
    try {
      // Move mouse to top-left corner to prevent accidental clicks
      this.automationService.moveMouse(0, 0);
    } catch (error) {
      console.error('Failed to move mouse to safe position:', error);
    }
  }
}