import React, { useState, useEffect } from 'react';
import { cloudStorageService } from '../services/CloudStorageService';

const CloudStorageConfig: React.FC = () => {
  const [config, setConfig] = useState({
    region: '',
    accessKeyId: '',
    accessKeySecret: '',
    bucket: ''
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

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

  return (
    <div className="cloud-storage-config">
      <h2>云存储配置</h2>
      
      {status && (
        <div className={`status ${status.includes('成功') ? 'success' : 'error'}`}>
          {status}
        </div>
      )}

      <div className="config-form">
        <div className="form-group">
          <label htmlFor="region">区域</label>
          <input
            type="text"
            id="region"
            name="region"
            value={config.region}
            onChange={handleChange}
            placeholder="例如: oss-cn-hangzhou"
          />
        </div>

        <div className="form-group">
          <label htmlFor="accessKeyId">AccessKey ID</label>
          <input
            type="text"
            id="accessKeyId"
            name="accessKeyId"
            value={config.accessKeyId}
            onChange={handleChange}
            placeholder="输入AccessKey ID"
          />
        </div>

        <div className="form-group">
          <label htmlFor="accessKeySecret">AccessKey Secret</label>
          <input
            type="password"
            id="accessKeySecret"
            name="accessKeySecret"
            value={config.accessKeySecret}
            onChange={handleChange}
            placeholder="输入AccessKey Secret"
          />
        </div>

        <div className="form-group">
          <label htmlFor="bucket">存储桶名称</label>
          <input
            type="text"
            id="bucket"
            name="bucket"
            value={config.bucket}
            onChange={handleChange}
            placeholder="输入存储桶名称"
          />
        </div>

        <div className="form-actions">
          <button 
            onClick={handleSave} 
            className="save-button"
            disabled={!config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket}
          >
            保存配置
          </button>
          <button 
            onClick={handleTestConnection} 
            className="test-button"
            disabled={!config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket || isTesting}
          >
            {isTesting ? '测试中...' : '测试连接'}
          </button>
        </div>

        {isInitialized && (
          <div className="status success">
            云存储服务已初始化
          </div>
        )}
      </div>

      <div className="config-help">
        <h3>配置说明</h3>
        <ul>
          <li>区域：阿里云OSS存储桶所在的区域，如 oss-cn-hangzhou</li>
          <li>AccessKey ID 和 AccessKey Secret：阿里云账号的访问密钥</li>
          <li>存储桶名称：在阿里云OSS控制台创建的存储桶名称</li>
          <li>确保存储桶权限设置为公共读或私有（使用签名URL访问）</li>
        </ul>
      </div>

      <style jsx>{`
        .cloud-storage-config {
          padding: 24px;
          max-width: 600px;
          margin: 0 auto;
        }

        h2 {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 24px;
        }

        h3 {
          font-size: 16px;
          font-weight: 600;
          color: #475569;
          margin-top: 24px;
          margin-bottom: 12px;
        }

        .status {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .status.success {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        .status.error {
          background-color: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .config-form {
          background-color: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .form-group {
          margin-bottom: 20px;
        }

        label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #475569;
          margin-bottom: 8px;
        }

        input {
          width: 100%;
          padding: 10px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          color: #1e293b;
          transition: all 0.2s ease;
        }

        input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        button {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .save-button {
          background-color: #2563eb;
          color: white;
          flex: 1;
        }

        .save-button:hover:not(:disabled) {
          background-color: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .test-button {
          background-color: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .test-button:hover:not(:disabled) {
          background-color: #e2e8f0;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .config-help {
          margin-top: 32px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
        }

        ul {
          list-style-type: disc;
          padding-left: 24px;
          margin: 0;
          font-size: 14px;
          color: #64748b;
        }

        li {
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
};

export default CloudStorageConfig;