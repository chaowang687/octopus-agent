import { VM } from 'vm2'

export class SafeCodeExecutionService {
  private static instance: SafeCodeExecutionService
  
  static getInstance() {
    if (!SafeCodeExecutionService.instance) {
      SafeCodeExecutionService.instance = new SafeCodeExecutionService()
    }
    return SafeCodeExecutionService.instance
  }
  
  async executeCode(code: string, timeout: number = 5000): Promise<any> {
    const vm = new VM({
      timeout,
      sandbox: {
        console: {
          log: (...args: any[]) => console.log('[SANDBOX]', ...args),
          error: (...args: any[]) => console.error('[SANDBOX]', ...args),
          warn: (...args: any[]) => console.warn('[SANDBOX]', ...args),
          info: (...args: any[]) => console.info('[SANDBOX]', ...args)
        },
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        Date,
        Math,
        JSON,
        Object,
        Array,
        String,
        Number,
        Boolean,
        RegExp
      }
    })
    
    try {
      const result = vm.run(code)
      return result
    } catch (error: any) {
      throw new Error(`Code execution failed: ${error.message}`)
    }
  }
  
  async executeFunction(code: string, _args: any[] = [], timeout: number = 5000): Promise<any> {
    const wrappedCode = `
      (function() {
        ${code}
      })()
    `
    return this.executeCode(wrappedCode, timeout)
  }
  
  async evaluateExpression(expression: string, context: Record<string, any> = {}, timeout: number = 3000): Promise<any> {
    const vm = new VM({
      timeout,
      sandbox: {
        ...context,
        console: {
          log: (...args: any[]) => console.log('[SANDBOX]', ...args)
        }
      }
    })
    
    try {
      const result = vm.run(expression)
      return result
    } catch (error: any) {
      throw new Error(`Expression evaluation failed: ${error.message}`)
    }
  }
}

export const safeCodeExecutionService = SafeCodeExecutionService.getInstance()