/**
 * Screen Perception Module for Mini-Agent
 * Provides screen capture, element detection, and interaction capabilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { MultimodalService } from '../services/MultimodalService';
import { llmService } from '../services/LLMService';

// Element interface for screen elements
export interface ScreenElement {
  id: number;
  type: 'button' | 'input' | 'text' | 'image' | 'link' | 'dropdown' | 'checkbox' | 'radio' | 'slider' | 'canvas' | 'other';
  boundingBox: { x: number; y: number; width: number; height: number };
  text?: string;
  accessibilityLabel?: string;
  isClickable: boolean;
  isVisible: boolean;
  description: string;
}

// Screenshot result interface
export interface ScreenshotResult {
  imagePath: string;
  elements: ScreenElement[];
  timestamp: number;
}

// Screen perception service
export class ScreenPerception {
  private multimodalService: MultimodalService;
  private tempDir: string = '';
  private isInitialized: boolean = false;

  constructor(multimodalService: MultimodalService) {
    this.multimodalService = multimodalService;
  }
  
  /**
   * 初始化屏幕感知服务
   */
  initialize(): void {
    if (!this.isInitialized && app) {
      this.tempDir = path.join(app.getPath('temp'), 'screen_perception');
      this.ensureTempDir();
      this.isInitialized = true;
    }
  }
  
  /**
   * 检查是否已初始化
   */
  private checkInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ScreenPerception not initialized. Call initialize() first.');
    }
  }

  /**
   * Ensure temporary directory exists
   */
  private ensureTempDir(): void {
    this.checkInitialized();
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Capture screen and identify interactive elements (Set-of-Mark approach)
   */
  async captureScreenWithElements(): Promise<ScreenshotResult> {
    try {
      // Capture the screen
      const captureResult = await this.multimodalService.captureScreen();
      
      if (captureResult.error) {
        throw new Error(`Screen capture failed: ${captureResult.error}`);
      }

      // Analyze the captured image to identify elements
      const elements = await this.identifyElements(captureResult.path);
      
      return {
        imagePath: captureResult.path,
        elements,
        timestamp: Date.now()
      };
    } catch (error: any) {
      console.error('Screen capture with elements failed:', error);
      throw new Error(`Failed to capture screen with elements: ${error.message}`);
    }
  }

  /**
   * Identify interactive elements on the screen using vision model
   */
  private async identifyElements(imagePath: string): Promise<ScreenElement[]> {
    try {
      // Use a vision model to identify elements in the image
      // This simulates the Set-of-Mark (SoM) approach
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Prepare the prompt for element identification
      const prompt = `Please analyze this screenshot and identify all interactive elements. For each element, provide:
      1. A unique numeric ID
      2. The element type (button, input, text, image, link, dropdown, checkbox, radio, slider, canvas, other)
      3. The bounding box coordinates (x, y, width, height)
      4. Any visible text on the element
      5. Whether the element appears clickable
      6. Whether the element appears visible
      7. A brief description of the element's likely function

      Return the results in JSON format as an array of elements with the following structure:
      [
        {
          "id": number,
          "type": string,
          "boundingBox": { "x": number, "y": number, "width": number, "height": number },
          "text": string,
          "accessibilityLabel": string,
          "isClickable": boolean,
          "isVisible": boolean,
          "description": string
        }
      ]`;

      // Call the vision model to analyze the image using multimodal chat
      const response = await llmService.chatMultimodal(
        'doubao-pro-32k', // Use a model that supports vision
        [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: `data:image/png;base64,${base64Image}` }
            ]
          }
        ],
        {}
      );

      if (!response.success || !response.content) {
        console.warn('Vision model analysis failed, returning empty elements array');
        return [];
      }

      // Parse the response to extract elements
      try {
        // Extract JSON from the response (may be wrapped in markdown)
        const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```|```([\s\S]*?)```|(\[[\s\S]*\])/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[2] || jsonMatch[3]) : response.content;
        
        const elements: ScreenElement[] = JSON.parse(jsonStr.trim());
        
        // Validate and clean up elements
        return elements.map((element, index) => ({
          id: element.id ?? index + 1,
          type: element.type ?? 'other',
          boundingBox: element.boundingBox ?? { x: 0, y: 0, width: 0, height: 0 },
          text: element.text ?? '',
          accessibilityLabel: element.accessibilityLabel ?? '',
          isClickable: element.isClickable ?? false,
          isVisible: element.isVisible ?? true,
          description: element.description ?? 'Unknown element'
        }));
      } catch (parseError) {
        console.error('Failed to parse vision model response:', parseError);
        console.warn('Returning empty elements array');
        return [];
      }
    } catch (error: any) {
      console.error('Element identification failed:', error);
      // Return an empty array as fallback
      return [];
    }
  }

  /**
   * Find an element by its ID
   */
  async findElementById(screenshotResult: ScreenshotResult, elementId: number): Promise<ScreenElement | null> {
    const element = screenshotResult.elements.find(el => el.id === elementId);
    return element || null;
  }

  /**
   * Find elements by type
   */
  async findElementsOfType(screenshotResult: ScreenshotResult, type: ScreenElement['type']): Promise<ScreenElement[]> {
    return screenshotResult.elements.filter(el => el.type === type);
  }

  /**
   * Find elements by text content
   */
  async findElementsByText(screenshotResult: ScreenshotResult, text: string): Promise<ScreenElement[]> {
    const lowerText = text.toLowerCase();
    return screenshotResult.elements.filter(el => 
      el.text?.toLowerCase().includes(lowerText) || 
      el.description.toLowerCase().includes(lowerText) ||
      el.accessibilityLabel?.toLowerCase().includes(lowerText)
    );
  }

  /**
   * Get a detailed description of the screen
   */
  async describeScreen(screenshotResult: ScreenshotResult): Promise<string> {
    const elements = screenshotResult.elements;
    const clickableElements = elements.filter(el => el.isClickable);
    const inputElements = elements.filter(el => ['input', 'textarea', 'dropdown'].includes(el.type));
    
    const description = `
Screen Description:
- Total elements detected: ${elements.length}
- Clickable elements: ${clickableElements.length}
- Input fields: ${inputElements.length}

Clickable Elements:
${clickableElements.map(el => `  ${el.id}. ${el.type}: "${el.text || el.description}"`).join('\n')}

Input Fields:
${inputElements.map(el => `  ${el.id}. ${el.type}: "${el.text || el.description}"`).join('\n')}
    `.trim();

    return description;
  }

  /**
   * Generate Set-of-Mark (SoM) annotation for the screen
   */
  async generateSetOfMarkAnnotation(screenshotResult: ScreenshotResult): Promise<any> {
    const elements = screenshotResult.elements.sort((a, b) => a.id - b.id);
    
    // Create a mapping from element IDs to coordinates for easy lookup
    const elementCoordinatesMap: Record<string, { x: number; y: number; width: number; height: number }> = {};
    elements.forEach(el => {
      elementCoordinatesMap[el.id.toString()] = {
        x: el.boundingBox.x,
        y: el.boundingBox.y,
        width: el.boundingBox.width,
        height: el.boundingBox.height
      };
    });
    
    const annotation = {
      description: "SCREEN ANNOTATION (Set-of-Mark):\nEach interactive element is marked with a number in the corner for identification.",
      elements: elements.map(el => ({
        id: el.id.toString(),
        type: el.type.toUpperCase(),
        text: el.text || el.description,
        position: {
          x: el.boundingBox.x,
          y: el.boundingBox.y,
          width: el.boundingBox.width,
          height: el.boundingBox.height
        },
        center: {
          x: el.boundingBox.x + el.boundingBox.width / 2,
          y: el.boundingBox.y + el.boundingBox.height / 2
        }
      })),
      elementCoordinatesMap,
      instructions: [
        "To click an element: Use the element ID in your action",
        "Example: 'Click element 5' or 'Click the Submit button 3'",
        "To type in an input: Identify the input field by ID and provide text",
        "Example: 'Type hello into input 7'"
      ]
    };

    return annotation;
  }

  /**
   * Cleanup temporary files older than specified hours
   */
  cleanupTempFiles(hoursOld: number = 24): void {
    const cutoffTime = Date.now() - (hoursOld * 60 * 60 * 1000);
    
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      
      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.warn(`Failed to delete temp file: ${filePath}`, err);
          }
        }
      });
    }
  }
}