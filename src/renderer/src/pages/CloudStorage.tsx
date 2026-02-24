import React, { useState, useEffect } from 'react';
import { cloudStorageService } from '../services/CloudStorageService';

// 云存储功能卡片接口
interface StorageFeature {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  enabled: boolean;
}

// 云存储功能卡片配置
const storageFeatures: StorageFeature[] = [
  {
    id: 'config',
    name: '存储配置',
    description: '配置阿里云OSS存储服务参数',
    color: '#3b82f6',
    bgColor: '#3b82f620',
    enabled: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    )
  },
  {
    id: 'documents',
    name: '文档同步',
    description: '将文档自动同步到云端存储',
    color: '#22c55e',
    bgColor: '#22c55e20',
    enabled: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    )
  },
  {
    id: 'code',
    name: '代码同步',
    description: '将代码文件同步到云端存储',
    color: '#f59e0b',
    bgColor: '#f59e0b20',
    enabled: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
    )
  },
  {
    id: 'backup',
    name: '数据备份',
    description: '定期备份数据到云端',
    color: '#8b5cf6',
    bgColor: '#8b5cf620',
    enabled: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
    )
  },
  {
    id: 'sync',
    name: '自动同步',
    description: '设置自动同步规则',
    color: '#ec4899',
    bgColor: '#ec489920',
    enabled: false,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        <polyline points="21 3 12 12 9 10"></polyline>
      </svg>
    )
  },
  {
    id: 'analytics',
    name: '存储分析',
    description: '分析存储使用情况',
    color: '#ef4444',
    bgColor: '#ef444420',
    enabled: false,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18"></path>
        <path d="M19 9H5"></path>
        <path d="M16 14H5"></path>
        <path d="M12 19H5"></path>
      </svg>
    )
  }
];

const CloudStorage: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [config, setConfig] = useState({
    region: '',
    accessKeyId: '',
    accessKeySecret: '',
    bucket: ''
  });
  const [status, setStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ [key: string]: 'syncing' | 'synced' | 'error' }>({});

  useEffect(() => {
    // 从本地存储加载配置
    const savedConfig = localStorage.getItem('cloudStorageConfig');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig(parsedConfig);
        // 尝试初始化云存储服务
        cloudStorageService.initialize(parsedConfig);
        setIsInitialized(true);
      } catch (error) {
        console.error('加载云存储配置失败:', error);
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      // 保存配置到本地存储
      localStorage.setItem('cloudStorageConfig', JSON.stringify(config));
      // 初始化云存储服务
      cloudStorageService.initialize(config);
      setIsInitialized(true);
      setStatus('配置保存成功');
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error('保存配置失败:', error);
      setStatus('配置保存失败');
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setStatus('测试连接中...');
      
      // 临时初始化服务进行测试
      cloudStorageService.initialize(config);
      
      // 尝试列出文件来测试连接
      const result = await cloudStorageService.listFiles();
      
      if (result.success) {
        setStatus('连接测试成功');
      } else {
        setStatus(`连接测试失败: ${result.error}`);
      }
    } catch (error: any) {
      console.error('测试连接失败:', error);
      setStatus(`连接测试失败: ${error.message}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleSyncDocuments = async () => {
    setSyncStatus(prev => ({ ...prev, documents: 'syncing' }));
    try {
      // 模拟文档同步
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSyncStatus(prev => ({ ...prev, documents: 'synced' }));
      setTimeout(() => {
        setSyncStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus.documents;
          return newStatus;
        });
      }, 3000);
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, documents: 'error' }));
      console.error('文档同步失败:', error);
    }
  };

  const handleSyncCode = async () => {
    setSyncStatus(prev => ({ ...prev, code: 'syncing' }));
    try {
      // 模拟代码同步
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSyncStatus(prev => ({ ...prev, code: 'synced' }));
      setTimeout(() => {
        setSyncStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus.code;
          return newStatus;
        });
      }, 3000);
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, code: 'error' }));
      console.error('代码同步失败:', error);
    }
  };

  const handleBackup = async () => {
    setSyncStatus(prev => ({ ...prev, backup: 'syncing' }));
    try {
      // 模拟备份
      await new Promise(resolve => setTimeout(resolve, 2500));
      setSyncStatus(prev => ({ ...prev, backup: 'synced' }));
      setTimeout(() => {
        setSyncStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus.backup;
          return newStatus;
        });
      }, 3000);
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, backup: 'error' }));
      console.error('备份失败:', error);
    }
  };

  return (
    <div className="cloud-storage-page" style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
          </svg>
          云存储管理
        </h1>
        <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
          配置阿里云OSS云存储服务，实现文件的云端存储和同步
        </p>
      </div>

      {/* Feature Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        {storageFeatures.map(feature => (
          <div
            key={feature.id}
            onClick={() => feature.enabled && setActiveFeature(feature.id)}
            style={{
              backgroundColor: feature.enabled ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
              borderRadius: '12px',
              padding: '20px',
              border: `1px solid ${activeFeature === feature.id ? feature.color : 'var(--border-color)'}`,
              cursor: feature.enabled ? 'pointer' : 'not-allowed',
              opacity: feature.enabled ? 1 : 0.5,
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
                backgroundColor: feature.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: feature.color
              }}>
                {feature.icon}
              </div>
              {!feature.enabled && (
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
              {syncStatus[feature.id] && (
                <span className={`sync-status ${syncStatus[feature.id]}`} style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: syncStatus[feature.id] === 'syncing' ? '#fef3c7' : syncStatus[feature.id] === 'synced' ? '#d1fae5' : '#fee2e2',
                  color: syncStatus[feature.id] === 'syncing' ? '#92400e' : syncStatus[feature.id] === 'synced' ? '#065f46' : '#b91c1c'
                }}>
                  {syncStatus[feature.id] === 'syncing' && '同步中...'}
                  {syncStatus[feature.id] === 'synced' && '已同步'}
                  {syncStatus[feature.id] === 'error' && '同步失败'}
                </span>
              )}
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>{feature.name}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Active Feature Panel */}
      {activeFeature && (
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
              {storageFeatures.find(f => f.id === activeFeature)?.name}
            </h2>
            <button
              onClick={() => setActiveFeature(null)}
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

          {/* 存储配置 */}
          {activeFeature === 'config' && (
            <div>
              {status && (
                <div className={`status ${status.includes('成功') ? 'success' : 'error'}`} style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '14px',
                  backgroundColor: status.includes('成功') ? '#d1fae5' : '#fee2e2',
                  color: status.includes('成功') ? '#065f46' : '#b91c1c',
                  border: `1px solid ${status.includes('成功') ? '#a7f3d0' : '#fecaca'}`
                }}>
                  {status}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  区域
                </label>
                <input
                  type="text"
                  name="region"
                  value={config.region}
                  onChange={handleChange}
                  placeholder="例如: oss-cn-hangzhou"
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  AccessKey ID
                </label>
                <input
                  type="text"
                  name="accessKeyId"
                  value={config.accessKeyId}
                  onChange={handleChange}
                  placeholder="输入AccessKey ID"
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  AccessKey Secret
                </label>
                <input
                  type="password"
                  name="accessKeySecret"
                  value={config.accessKeySecret}
                  onChange={handleChange}
                  placeholder="输入AccessKey Secret"
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  存储桶名称
                </label>
                <input
                  type="text"
                  name="bucket"
                  value={config.bucket}
                  onChange={handleChange}
                  placeholder="输入存储桶名称"
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={handleSave} 
                  disabled={!config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: !config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket ? 'var(--bg-tertiary)' : '#3b82f6',
                    color: !config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket ? 'var(--text-secondary)' : '#fff',
                    cursor: !config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    flex: 1
                  }}
                >
                  保存配置
                </button>
                <button 
                  onClick={handleTestConnection} 
                  disabled={!config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket || isTesting}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    cursor: !config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket || isTesting ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </button>
              </div>

              {isInitialized && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#d1fae5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  fontSize: '14px'
                }}>
                  云存储服务已初始化
                </div>
              )}
            </div>
          )}

          {/* 文档同步 */}
          {activeFeature === 'documents' && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                backgroundColor: '#22c55e20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22c55e',
                margin: '0 auto 24px'
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>文档同步</h3>
              <p style={{ margin: '0 0 32px 0', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                将您的文档自动同步到阿里云OSS云存储，确保数据安全备份
              </p>
              <button
                onClick={handleSyncDocuments}
                disabled={!isInitialized || syncStatus.documents === 'syncing'}
                style={{
                  padding: '16px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: !isInitialized || syncStatus.documents === 'syncing' ? 'var(--bg-tertiary)' : '#22c55e',
                  color: !isInitialized || syncStatus.documents === 'syncing' ? 'var(--text-secondary)' : '#fff',
                  cursor: !isInitialized || syncStatus.documents === 'syncing' ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  margin: '0 auto'
                }}
              >
                {syncStatus.documents === 'syncing' ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    同步中...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                      <polyline points="21 3 12 12 9 10"></polyline>
                    </svg>
                    立即同步文档
                  </>
                )}
              </button>
              {!isInitialized && (
                <p style={{ margin: '16px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  请先配置云存储服务
                </p>
              )}
            </div>
          )}

          {/* 代码同步 */}
          {activeFeature === 'code' && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                backgroundColor: '#f59e0b20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
                margin: '0 auto 24px'
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>代码同步</h3>
              <p style={{ margin: '0 0 32px 0', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                将您的代码文件同步到阿里云OSS云存储，确保代码安全备份
              </p>
              <button
                onClick={handleSyncCode}
                disabled={!isInitialized || syncStatus.code === 'syncing'}
                style={{
                  padding: '16px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: !isInitialized || syncStatus.code === 'syncing' ? 'var(--bg-tertiary)' : '#f59e0b',
                  color: !isInitialized || syncStatus.code === 'syncing' ? 'var(--text-secondary)' : '#fff',
                  cursor: !isInitialized || syncStatus.code === 'syncing' ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  margin: '0 auto'
                }}
              >
                {syncStatus.code === 'syncing' ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    同步中...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                      <polyline points="21 3 12 12 9 10"></polyline>
                    </svg>
                    立即同步代码
                  </>
                )}
              </button>
              {!isInitialized && (
                <p style={{ margin: '16px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  请先配置云存储服务
                </p>
              )}
            </div>
          )}

          {/* 数据备份 */}
          {activeFeature === 'backup' && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                backgroundColor: '#8b5cf620',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8b5cf6',
                margin: '0 auto 24px'
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>数据备份</h3>
              <p style={{ margin: '0 0 32px 0', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                定期备份所有数据到阿里云OSS云存储，确保数据安全
              </p>
              <button
                onClick={handleBackup}
                disabled={!isInitialized || syncStatus.backup === 'syncing'}
                style={{
                  padding: '16px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: !isInitialized || syncStatus.backup === 'syncing' ? 'var(--bg-tertiary)' : '#8b5cf6',
                  color: !isInitialized || syncStatus.backup === 'syncing' ? 'var(--text-secondary)' : '#fff',
                  cursor: !isInitialized || syncStatus.backup === 'syncing' ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  margin: '0 auto'
                }}
              >
                {syncStatus.backup === 'syncing' ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    备份中...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    立即备份数据
                  </>
                )}
              </button>
              {!isInitialized && (
                <p style={{ margin: '16px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  请先配置云存储服务
                </p>
              )}
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
  );
};

export default CloudStorage;