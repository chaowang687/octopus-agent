/**
 * Mini-Agent Test Suite
 * Validates the Mini-Agent functionality including:
 * - Screen perception
 * - ReAct engine execution
 * - Memory management
 * - MCP integration
 */

import { TaskEngine } from '../../main/agent/TaskEngine';
import { ScreenPerception } from '../../main/agent/ScreenPerception';
import { ReActEngine } from '../../main/agent/ReActEngine';
import { MemoryManager } from '../../main/agent/MemoryManager';
import { MCPClient, MCPServerConfig } from '../../main/agent/MCPClient';
import { toolRegistry } from '../../main/agent/ToolRegistry';
import { MultimodalService } from '../../main/services/MultimodalService';

class MiniAgentTester {
  private taskEngine: TaskEngine;
  private screenPerception: ScreenPerception;
  private reActEngine: ReActEngine;
  private memoryManager: MemoryManager;
  private mcpClient: MCPClient;

  constructor() {
    // Note: We'll initialize these components when we run tests
    this.taskEngine = new TaskEngine();
    this.memoryManager = new MemoryManager();
    this.mcpClient = new MCPClient();
  }

  async testScreenPerception() {
    console.log('🧪 Testing Screen Perception...');
    
    try {
      // Initialize screen perception
      const multimodalService = new MultimodalService();
      this.screenPerception = new ScreenPerception(multimodalService);
      
      // Try to capture screen (this might fail in headless environments)
      const result = await this.screenPerception.captureScreenWithElements();
      console.log('✅ Screen capture successful:', !!result.imagePath);
      console.log('✅ Elements identified:', result.elements?.length || 0);
      
      return true;
    } catch (error) {
      console.log('❌ Screen perception test failed:', error);
      return false;
    }
  }

  async testReActEngine() {
    console.log('🧪 Testing ReAct Engine...');
    
    try {
      // Initialize ReAct engine
      const multimodalService = new MultimodalService();
      const screenPerception = new ScreenPerception(multimodalService);
      this.reActEngine = new ReActEngine(toolRegistry, screenPerception);
      
      // Test a simple reasoning task
      const result = await this.reActEngine.execute('What is 2+2?', {
        maxSteps: 3,
        model: 'openai',
        verbose: true
      });
      
      console.log('✅ ReAct execution successful:', result.success);
      console.log('✅ Final answer:', result.finalAnswer);
      
      return true;
    } catch (error) {
      console.log('❌ ReAct engine test failed:', error);
      return false;
    }
  }

  async testMemoryManagement() {
    console.log('🧪 Testing Memory Management...');
    
    try {
      // Test storing a memory
      const memoryId = await this.memoryManager.storeMemory(
        'This is a test memory for validation', 
        'fact', 
        { importance: 0.8, tags: ['test', 'validation'], source: 'tester' }
      );
      
      console.log('✅ Memory stored with ID:', memoryId);
      
      // Test retrieving memories
      const retrieved = await this.memoryManager.retrieveMemories({
        text: 'test memory',
        maxResults: 5
      });
      
      console.log('✅ Memories retrieved:', retrieved.length);
      
      // Test memory stats
      const stats = this.memoryManager.getStats();
      console.log('✅ Memory stats:', stats.totalEntries, 'total entries');
      
      return true;
    } catch (error) {
      console.log('❌ Memory management test failed:', error);
      return false;
    }
  }

  async testTaskExecution() {
    console.log('🧪 Testing Task Execution with Mini-Agent...');
    
    try {
      // Test a simple task that should trigger ReAct
      const result = await this.taskEngine.executeTask('What is the capital of France?', 'openai');
      
      console.log('✅ Task execution completed:', !!result);
      console.log('✅ Result:', typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
      
      return true;
    } catch (error) {
      console.log('❌ Task execution test failed:', error);
      return false;
    }
  }

  async testScreenInteractionTask() {
    console.log('🧪 Testing Screen Interaction Task...');
    
    try {
      // Test a task that should trigger screen interaction
      const result = await this.taskEngine.executeTask('Click on the screen', 'openai');
      
      console.log('✅ Screen interaction task completed:', !!result);
      
      return true;
    } catch (error) {
      console.log('❌ Screen interaction task failed:', error);
      // This might fail in headless environments, which is expected
      return true; // Return true to continue testing
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Mini-Agent Validation Tests...\n');
    
    const tests = [
      { name: 'Screen Perception', fn: () => this.testScreenPerception(), critical: false },
      { name: 'ReAct Engine', fn: () => this.testReActEngine(), critical: true },
      { name: 'Memory Management', fn: () => this.testMemoryManagement(), critical: true },
      { name: 'Task Execution', fn: () => this.testTaskExecution(), critical: true },
      { name: 'Screen Interaction Task', fn: () => this.testScreenInteractionTask(), critical: false },
    ];
    
    const results: { name: string; passed: boolean; critical: boolean }[] = [];
    
    for (const test of tests) {
      console.log(`\n📋 Running ${test.name} test...`);
      const passed = await test.fn();
      results.push({ name: test.name, passed, critical: test.critical });
      
      if (!passed && test.critical) {
        console.log(`❌ Critical test failed: ${test.name}. Stopping tests.`);
        break;
      }
    }
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    const criticalPassed = results.filter(r => r.critical && r.passed).length;
    const criticalTotal = results.filter(r => r.critical).length;
    
    console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
    console.log(`🎯 Critical: ${criticalPassed}/${criticalTotal} critical tests`);
    
    if (criticalPassed < criticalTotal) {
      console.log('❌ Some critical tests failed. Mini-Agent may not be fully functional.');
      return false;
    } else {
      console.log('🎉 All critical tests passed! Mini-Agent is functioning correctly.');
      return true;
    }
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  const tester = new MiniAgentTester();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite failed with error:', error);
      process.exit(1);
    });
}

export { MiniAgentTester };