/**
 * Automation Tools for Mini-Agent
 * Provides UI automation capabilities through SystemAutomationService
 */

import { ToolRegistry } from './ToolRegistry';
import { SystemAutomationService } from './SystemAutomationService';

// Create a singleton automation service for the tools
const automationService = new SystemAutomationService();

// Register automation tools with the registry
export function registerAutomationTools(registry: ToolRegistry) {
  // Tool for clicking elements on the screen
  registry.register({
    name: 'click_element',
    description: 'Click on a specific element on the screen identified by coordinates or element ID',
    parameters: [
      {
        name: 'elementId',
        type: 'string',
        description: 'Identifier for the element to click (can be coordinates "x,y" or element identifier)',
        required: true
      },
      {
        name: 'button',
        type: 'string',
        description: 'Mouse button to click: "left", "right", or "middle"',
        required: false
      },
      {
        name: 'doubleClick',
        type: 'boolean',
        description: 'Whether to perform a double-click',
        required: false
      }
    ],
    handler: async (args: any) => {
      const { elementId, button, doubleClick } = args;
      
      if (!elementId) {
        throw new Error('elementId is required for click_element tool');
      }
      
      // The elementId could be in format "x,y" for coordinates or an element identifier
      // In a real implementation, we would map element identifiers to screen coordinates
      // For now, we'll support both coordinate strings and attempt to parse them
      let result;
      
      if (typeof elementId === 'string' && elementId.includes(',')) {
        // Parse coordinates from "x,y" format
        const [x, y] = elementId.split(',').map(Number);
        if (isNaN(x) || isNaN(y)) {
          throw new Error(`Invalid coordinate format: ${elementId}. Expected "x,y" format with numeric values.`);
        }
        
        result = await automationService.clickAt(x, y, {
          button,
          doubleClick,
          delay: 100
        });
      } else {
        // Assume it's an element ID that needs to be mapped to coordinates
        // In a real implementation, this would look up the element in the last captured screen
        result = await automationService.clickElement(elementId);
      }
      
      if (!result.success) {
        throw new Error(`Failed to click element: ${result.error}`);
      }
      
      return result;
    }
  });

  // Tool for typing text
  registry.register({
    name: 'type_text',
    description: 'Type text at the current cursor position or at a specific element',
    parameters: [
      {
        name: 'text',
        type: 'string',
        description: 'The text to type',
        required: true
      },
      {
        name: 'elementId',
        type: 'string',
        description: 'Optional element ID or coordinates "x,y" to click before typing',
        required: false
      }
    ],
    handler: async (args: any) => {
      const { text, elementId } = args;
      
      if (!text) {
        throw new Error('text is required for type_text tool');
      }
      
      let coords = undefined;
      
      if (elementId) {
        // If elementId is coordinates "x,y", parse them
        if (typeof elementId === 'string' && elementId.includes(',')) {
          const [x, y] = elementId.split(',').map(Number);
          if (!isNaN(x) && !isNaN(y)) {
            coords = { x, y };
          }
        }
        // Otherwise, in a real implementation, we would map elementId to coordinates
        // This would require keeping track of the last captured screen elements
      }
      
      const result = await automationService.typeText(text, coords);
      
      if (!result.success) {
        throw new Error(`Failed to type text: ${result.error}`);
      }
      
      return result;
    }
  });

  // Tool for pressing keys
  registry.register({
    name: 'press_key',
    description: 'Press a specific key or key combination',
    parameters: [
      {
        name: 'key',
        type: 'string',
        description: 'The key to press (e.g., "enter", "tab", "a", "f1", etc.)',
        required: true
      },
      {
        name: 'modifiers',
        type: 'array',
        description: 'Modifier keys to hold while pressing the main key (e.g., ["ctrl"], ["ctrl", "shift"])',
        required: false
      }
    ],
    handler: async (args: any) => {
      const { key, modifiers } = args;
      
      if (!key) {
        throw new Error('key is required for press_key tool');
      }
      
      const result = await automationService.pressKey(key, modifiers);
      
      if (!result.success) {
        throw new Error(`Failed to press key: ${result.error}`);
      }
      
      return result;
    }
  });

  // Tool for moving mouse to position
  registry.register({
    name: 'move_mouse',
    description: 'Move mouse cursor to specific coordinates',
    parameters: [
      {
        name: 'x',
        type: 'number',
        description: 'X coordinate to move to',
        required: true
      },
      {
        name: 'y',
        type: 'number',
        description: 'Y coordinate to move to',
        required: true
      }
    ],
    handler: async (args: any) => {
      const { x, y } = args;
      
      if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error('x and y coordinates are required for move_mouse tool');
      }
      
      const result = await automationService.moveMouse(x, y);
      
      if (!result.success) {
        throw new Error(`Failed to move mouse: ${result.error}`);
      }
      
      return result;
    }
  });

  // Tool for scrolling
  registry.register({
    name: 'scroll',
    description: 'Scroll the mouse wheel in a specific direction',
    parameters: [
      {
        name: 'direction',
        type: 'string',
        description: 'Direction to scroll: "up", "down", "left", or "right"',
        required: true
      },
      {
        name: 'amount',
        type: 'number',
        description: 'Amount to scroll (default: 1)',
        required: false
      }
    ],
    handler: async (args: any) => {
      const { direction, amount = 1 } = args;
      
      if (!['up', 'down', 'left', 'right'].includes(direction)) {
        throw new Error('direction must be one of: "up", "down", "left", "right"');
      }
      
      if (typeof amount !== 'number') {
        throw new Error('amount must be a number');
      }
      
      const result = await automationService.scroll(direction as 'up' | 'down' | 'left' | 'right', amount);
      
      if (!result.success) {
        throw new Error(`Failed to scroll: ${result.error}`);
      }
      
      return result;
    }
  });
}

// Export the service instance for direct use if needed
export { automationService };