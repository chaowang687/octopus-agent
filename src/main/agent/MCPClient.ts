/**
 * Model Context Protocol (MCP) Client for Mini-Agent
 * Enables connection to external tools and services via MCP
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import axios from 'axios';

// MCP interfaces
export interface MCPServerConfig {
  name: string;
  type: 'stdio' | 'http';
  command?: string;  // For stdio servers
  url?: string;      // For http servers
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: any;
  experimental_no_auth?: boolean;
}

export interface MCPResource {
  name: string;
  description: string;
  mimeType?: string;
  experimental_no_auth?: boolean;
}

export interface MCPrompt {
  name: string;
  description: string;
  inputSchema?: any;
  experimental_no_auth?: boolean;
}

export interface MCPManifest {
  version: string;
  tools?: MCPTool[];
  resources?: MCPResource[];
  prompts?: MCPrompt[];
  experimental_capabilities?: {
    [key: string]: any;
  };
}

export interface MCPToolCall {
  name: string;
  arguments?: any;
}

export interface MCPResponse {
  success: boolean;
  result?: any;
  error?: string;
}

// MCP Client Class
export class MCPClient extends EventEmitter {
  private servers: Map<string, ChildProcess | null> = new Map();
  private manifests: Map<string, MCPManifest> = new Map();
  private serverConfigs: Map<string, MCPServerConfig> = new Map();

  constructor() {
    super();
  }

  /**
   * Register an MCP server configuration
   */
  registerServer(config: MCPServerConfig): void {
    this.serverConfigs.set(config.name, config);
  }

  /**
   * Discover available tools from registered servers
   */
  async discoverTools(): Promise<MCPTool[]> {
    const allTools: MCPTool[] = [];

    for (const [serverName, _config] of this.serverConfigs) {
      try {
        const manifest = await this.getManifest(serverName);
        if (manifest.tools) {
          allTools.push(...manifest.tools);
        }
      } catch (error) {
        console.error(`Failed to discover tools from ${serverName}:`, error);
      }
    }

    return allTools;
  }

  /**
   * Get server manifest
   */
  async getManifest(serverName: string): Promise<MCPManifest> {
    if (this.manifests.has(serverName)) {
      return this.manifests.get(serverName)!;
    }

    const config = this.serverConfigs.get(serverName);
    if (!config) {
      throw new Error(`Server configuration not found: ${serverName}`);
    }

    let manifest: MCPManifest;

    if (config.type === 'stdio') {
      manifest = await this.getStdioManifest(config);
    } else if (config.type === 'http') {
      manifest = await this.getHttpManifest(config);
    } else {
      throw new Error(`Unsupported server type: ${config.type}`);
    }

    this.manifests.set(serverName, manifest);
    return manifest;
  }

  /**
   * Get manifest from stdio server
   */
  private async getStdioManifest(config: MCPServerConfig): Promise<MCPManifest> {
    if (!config.command) {
      throw new Error('Command is required for stdio servers');
    }

    return new Promise((resolve, reject) => {
      const child = spawn(config.command!, config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...config.env }
      });

      // Send initialization message
      const initMsg = {
        method: 'initialize',
        params: {
          protocolVersion: '2.0',
          capabilities: {}
        },
        id: 1
      };

      child.stdin?.write(JSON.stringify(initMsg) + '\n');

      let responseBuffer = '';
      let timeout: NodeJS.Timeout;

      const cleanup = () => {
        clearTimeout(timeout);
        child.kill();
        this.servers.delete(config.name);
      };

      timeout = setTimeout(() => {
        cleanup();
        reject(new Error('MCP server initialization timeout'));
      }, 10000);

      child.stdout?.on('data', (data) => {
        responseBuffer += data.toString();

        // Look for complete JSON responses
        const lines = responseBuffer.split('\n');
        responseBuffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line.trim());
              
              if (response.method === 'initialize') {
                // Server is ready, request manifest
                const manifestMsg = {
                  method: 'experimental/manifest/get',
                  id: 2
                };
                child.stdin?.write(JSON.stringify(manifestMsg) + '\n');
              } else if (response.id === 2 && response.result) {
                // Got manifest
                clearTimeout(timeout);
                cleanup();
                resolve(response.result as MCPManifest);
                return;
              }
            } catch (e) {
              console.error('Error parsing MCP response:', e);
            }
          }
        }
      });

      child.stderr?.on('data', (data) => {
        console.error('MCP server error:', data.toString());
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        cleanup();
        reject(err);
      });
    });
  }

  /**
   * Get manifest from HTTP server
   */
  private async getHttpManifest(config: MCPServerConfig): Promise<MCPManifest> {
    if (!config.url) {
      throw new Error('URL is required for HTTP servers');
    }

    try {
      const response = await axios.get(`${config.url}/manifest`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch manifest from ${config.url}: ${error}`);
    }
  }

  /**
   * Invoke an MCP tool
   */
  async invokeTool(serverName: string, toolName: string, args?: any): Promise<MCPResponse> {
    const config = this.serverConfigs.get(serverName);
    if (!config) {
      return { success: false, error: `Server configuration not found: ${serverName}` };
    }

    try {
      if (config.type === 'stdio') {
        return await this.invokeStdioTool(config, toolName, args);
      } else if (config.type === 'http') {
        return await this.invokeHttpTool(config, toolName, args);
      } else {
        return { success: false, error: `Unsupported server type: ${config.type}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Invoke a tool on a stdio server
   */
  private async invokeStdioTool(config: MCPServerConfig, toolName: string, args?: any): Promise<MCPResponse> {
    if (!config.command) {
      return { success: false, error: 'Command is required for stdio servers' };
    }

    return new Promise((resolve, reject) => {
      const child = this.servers.get(config.name) || spawn(config.command!, config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...config.env }
      });

      // If this is a new process, store it
      if (!this.servers.get(config.name)) {
        this.servers.set(config.name, child);
      }

      const callId = Date.now();
      const toolCallMsg = {
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args || {}
        },
        id: callId
      };

      child.stdin?.write(JSON.stringify(toolCallMsg) + '\n');

      let responseBuffer = '';
      let timeout: NodeJS.Timeout;

      timeout = setTimeout(() => {
        // Don't kill the process as it might be reused
        reject(new Error('Tool call timeout'));
      }, 30000);

      child.stdout?.on('data', (data) => {
        responseBuffer += data.toString();

        // Look for complete JSON responses
        const lines = responseBuffer.split('\n');
        responseBuffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line.trim());
              
              if (response.id === callId) {
                // Got response for our call
                clearTimeout(timeout);
                
                if (response.result) {
                  resolve({ success: true, result: response.result });
                } else if (response.error) {
                  resolve({ success: false, error: response.error.message || 'Unknown error' });
                }
                return;
              }
            } catch (e) {
              console.error('Error parsing MCP tool response:', e);
            }
          }
        }
      });

      child.stderr?.on('data', (data) => {
        console.error('MCP tool error:', data.toString());
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Invoke a tool on an HTTP server
   */
  private async invokeHttpTool(config: MCPServerConfig, toolName: string, args?: any): Promise<MCPResponse> {
    if (!config.url) {
      return { success: false, error: 'URL is required for HTTP servers' };
    }

    try {
      const response = await axios.post(`${config.url}/tools/${toolName}/call`, {
        arguments: args || {}
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return { success: true, result: response.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  }

  /**
   * Close all MCP connections
   */
  closeAll(): void {
    for (const [_name, server] of this.servers) {
      if (server) {
        server.kill();
      }
    }
    this.servers.clear();
    this.manifests.clear();
    this.serverConfigs.clear();
  }

  /**
   * Get available servers
   */
  getAvailableServers(): string[] {
    return Array.from(this.serverConfigs.keys());
  }

  /**
   * Get tools by server
   */
  async getToolsByServer(serverName: string): Promise<MCPTool[]> {
    const manifest = await this.getManifest(serverName);
    return manifest.tools || [];
  }
}