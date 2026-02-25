// 测试文件，用于逐步导入模块以确定错误来源

console.log('开始测试导入模块...');

try {
  console.log('导入 electron...');
  const electron = require('electron');
  console.log('✓ electron 导入成功');
} catch (error) {
  console.error('✗ electron 导入失败:', error);
}

try {
  console.log('导入 path...');
  const path = require('path');
  console.log('✓ path 导入成功');
} catch (error) {
  console.error('✗ path 导入失败:', error);
}

try {
  console.log('导入 fs...');
  const fs = require('fs');
  console.log('✓ fs 导入成功');
} catch (error) {
  console.error('✗ fs 导入失败:', error);
}

try {
  console.log('导入 @electron-toolkit/utils...');
  const { electronApp, optimizer, is } = require('@electron-toolkit/utils');
  console.log('✓ @electron-toolkit/utils 导入成功');
} catch (error) {
  console.error('✗ @electron-toolkit/utils 导入失败:', error);
}

try {
  console.log('导入 electron-updater...');
  const { autoUpdater } = require('electron-updater');
  console.log('✓ electron-updater 导入成功');
} catch (error) {
  console.error('✗ electron-updater 导入失败:', error);
}

try {
  console.log('导入 security/ElectronSecurity...');
  const { configureSecurity, getRecommendedSecurityOptions } = require('./src/main/security/ElectronSecurity');
  console.log('✓ security/ElectronSecurity 导入成功');
} catch (error) {
  console.error('✗ security/ElectronSecurity 导入失败:', error);
}

try {
  console.log('导入 security/SecurityManager...');
  const { securityManager } = require('./src/main/security/SecurityManager');
  console.log('✓ security/SecurityManager 导入成功');
} catch (error) {
  console.error('✗ security/SecurityManager 导入失败:', error);
}

try {
  console.log('导入 agent/TaskStateManager...');
  const { TaskStateManager, createTaskStateManager } = require('./src/main/agent/TaskStateManager');
  console.log('✓ agent/TaskStateManager 导入成功');
} catch (error) {
  console.error('✗ agent/TaskStateManager 导入失败:', error);
}

try {
  console.log('导入 services/FloatingCapsuleService...');
  const { FloatingCapsuleService } = require('./src/main/services/FloatingCapsuleService');
  console.log('✓ services/FloatingCapsuleService 导入成功');
} catch (error) {
  console.error('✗ services/FloatingCapsuleService 导入失败:', error);
}

try {
  console.log('导入 services/TrayService...');
  const { TrayService } = require('./src/main/services/TrayService');
  console.log('✓ services/TrayService 导入成功');
} catch (error) {
  console.error('✗ services/TrayService 导入失败:', error);
}

try {
  console.log('导入 agent/TaskEngine...');
  const { taskEngine } = require('./src/main/agent/TaskEngine');
  console.log('✓ agent/TaskEngine 导入成功');
} catch (error) {
  console.error('✗ agent/TaskEngine 导入失败:', error);
}

try {
  console.log('导入 agent/ToolRegistry...');
  const { toolRegistry } = require('./src/main/agent/ToolRegistry');
  console.log('✓ agent/ToolRegistry 导入成功');
} catch (error) {
  console.error('✗ agent/ToolRegistry 导入失败:', error);
}

try {
  console.log('导入 services/GalleryService...');
  const { galleryService } = require('./src/main/services/GalleryService');
  console.log('✓ services/GalleryService 导入成功');
} catch (error) {
  console.error('✗ services/GalleryService 导入失败:', error);
}

try {
  console.log('导入 services/SafeCodeExecutionService...');
  const { safeCodeExecutionService } = require('./src/main/services/SafeCodeExecutionService');
  console.log('✓ services/SafeCodeExecutionService 导入成功');
} catch (error) {
  console.error('✗ services/SafeCodeExecutionService 导入失败:', error);
}

try {
  console.log('导入 services/UpdateService...');
  const { updateService } = require('./src/main/services/UpdateService');
  console.log('✓ services/UpdateService 导入成功');
} catch (error) {
  console.error('✗ services/UpdateService 导入失败:', error);
}

try {
  console.log('导入 services/BackupService...');
  const { backupService } = require('./src/main/services/BackupService');
  console.log('✓ services/BackupService 导入成功');
} catch (error) {
  console.error('✗ services/BackupService 导入失败:', error);
}

try {
  console.log('导入 services/AnalyticsService...');
  const { analyticsService } = require('./src/main/services/AnalyticsService');
  console.log('✓ services/AnalyticsService 导入成功');
} catch (error) {
  console.error('✗ services/AnalyticsService 导入失败:', error);
}

try {
  console.log('导入 services/LicenseService...');
  const { licenseService } = require('./src/main/services/LicenseService');
  console.log('✓ services/LicenseService 导入成功');
} catch (error) {
  console.error('✗ services/LicenseService 导入失败:', error);
}

try {
  console.log('导入 ipc...');
  const { registerAllHandlers } = require('./src/main/ipc');
  console.log('✓ ipc 导入成功');
} catch (error) {
  console.error('✗ ipc 导入失败:', error);
}

try {
  console.log('导入 ipc/handlers/collaborationHandler...');
  const { collaborationManager } = require('./src/main/ipc/handlers/collaborationHandler');
  console.log('✓ ipc/handlers/collaborationHandler 导入成功');
} catch (error) {
  console.error('✗ ipc/handlers/collaborationHandler 导入失败:', error);
}

try {
  console.log('导入 services/UserService...');
  const { userService } = require('./src/main/services/UserService');
  console.log('✓ services/UserService 导入成功');
} catch (error) {
  console.error('✗ services/UserService 导入失败:', error);
}

try {
  console.log('导入 services/WindowDockService...');
  const { initWindowDockService } = require('./src/main/services/WindowDockService');
  console.log('✓ services/WindowDockService 导入成功');
} catch (error) {
  console.error('✗ services/WindowDockService 导入失败:', error);
}

try {
  console.log('导入 plugin-system...');
  const { getPluginSystem } = require('./src/main/plugin-system');
  console.log('✓ plugin-system 导入成功');
} catch (error) {
  console.error('✗ plugin-system 导入失败:', error);
}

console.log('测试完成');
