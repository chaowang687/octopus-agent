import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { toolRegistry } from '../ToolRegistry'

toolRegistry.register({
  name: 'format_code',
  description: 'Format code using Prettier or other formatters',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'formatter', type: 'string', description: 'Formatter to use (prettier, eslint, auto)', required: false },
    { name: 'files', type: 'array', description: 'Specific files to format (optional)', required: false },
    { name: 'check', type: 'boolean', description: 'Only check formatting without modifying files', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const formatter = params?.formatter || 'auto'
      const files = params?.files
      const isCheck = params?.check || false
      
      let command = ''
      
      if (formatter === 'prettier' || formatter === 'auto') {
        const prettierPath = path.join(projectPath, 'node_modules', '.bin', 'prettier')
        if (fs.existsSync(prettierPath)) {
          if (files && Array.isArray(files) && files.length > 0) {
            command = `npx prettier ${files.join(' ')}`
          } else {
            command = 'npx prettier --write .'
          }
          if (isCheck) {
            command = command.replace('--write', '--check')
          }
        }
      }
      
      if (formatter === 'eslint') {
        const eslintPath = path.join(projectPath, 'node_modules', '.bin', 'eslint')
        if (fs.existsSync(eslintPath)) {
          if (files && Array.isArray(files) && files.length > 0) {
            command = `npx eslint ${files.join(' ')} --fix`
          } else {
            command = 'npx eslint . --fix'
          }
        }
      }
      
      if (!command) {
        return { error: `Formatter '${formatter}' not found in project. Please install it first.` }
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000
      })
      
      return { 
        success: true, 
        message: isCheck ? 'Code formatting checked' : 'Code formatted successfully',
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'lint_code',
  description: 'Run linter to check code quality',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'linter', type: 'string', description: 'Linter to use (eslint, flake8, auto)', required: false },
    { name: 'fix', type: 'boolean', description: 'Auto-fix linting issues', required: false },
    { name: 'files', type: 'array', description: 'Specific files to lint (optional)', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const linter = params?.linter || 'auto'
      const shouldFix = params?.fix || false
      const files = params?.files
      
      let command = ''
      
      if (linter === 'eslint' || linter === 'auto') {
        const eslintPath = path.join(projectPath, 'node_modules', '.bin', 'eslint')
        if (fs.existsSync(eslintPath)) {
          if (files && Array.isArray(files) && files.length > 0) {
            command = `npx eslint ${files.join(' ')}`
          } else {
            command = 'npx eslint .'
          }
          if (shouldFix) {
            command += ' --fix'
          }
        }
      }
      
      if (linter === 'flake8') {
        const flake8Path = path.join(projectPath, 'venv', 'bin', 'flake8')
        if (fs.existsSync(flake8Path)) {
          if (files && Array.isArray(files) && files.length > 0) {
            command = `flake8 ${files.join(' ')}`
          } else {
            command = 'flake8 .'
          }
        }
      }
      
      if (!command) {
        return { error: `Linter '${linter}' not found in project. Please install it first.` }
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000
      })
      
      return { 
        success: true, 
        message: shouldFix ? 'Linting completed with auto-fix' : 'Linting completed',
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'check_types',
  description: 'Run TypeScript type checking',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'watch', type: 'boolean', description: 'Run in watch mode', required: false },
    { name: 'noEmit', type: 'boolean', description: 'Only check types without emitting files', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const isWatch = params?.watch || false
      const noEmit = params?.noEmit !== false
      
      let command = 'npx tsc --noEmit'
      
      if (isWatch) {
        command = 'npx tsc --watch'
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000
      })
      
      return { 
        success: true, 
        message: 'Type checking completed',
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'run_unit_tests',
  description: 'Run unit tests',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'testFramework', type: 'string', description: 'Test framework (jest, vitest, pytest, auto)', required: false },
    { name: 'watch', type: 'boolean', description: 'Run in watch mode', required: false },
    { name: 'coverage', type: 'boolean', description: 'Generate coverage report', required: false },
    { name: 'pattern', type: 'string', description: 'Test file pattern', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const testFramework = params?.testFramework || 'auto'
      const isWatch = params?.watch || false
      const isCoverage = params?.coverage || false
      const pattern = params?.pattern
      
      let command = ''
      
      if (testFramework === 'jest' || testFramework === 'auto') {
        const jestPath = path.join(projectPath, 'node_modules', '.bin', 'jest')
        if (fs.existsSync(jestPath)) {
          command = 'npx jest'
          if (isWatch) command += ' --watch'
          if (isCoverage) command += ' --coverage'
          if (pattern) command += ` ${pattern}`
        }
      }
      
      if (testFramework === 'vitest') {
        const vitestPath = path.join(projectPath, 'node_modules', '.bin', 'vitest')
        if (fs.existsSync(vitestPath)) {
          command = 'npx vitest'
          if (isWatch) command += ' --watch'
          if (isCoverage) command += ' --coverage'
          if (pattern) command += ` ${pattern}`
        }
      }
      
      if (testFramework === 'pytest') {
        const pytestPath = path.join(projectPath, 'venv', 'bin', 'pytest')
        if (fs.existsSync(pytestPath)) {
          command = 'pytest'
          if (isCoverage) command += ' --cov'
          if (pattern) command += ` ${pattern}`
        }
      }
      
      if (!command) {
        return { error: `Test framework '${testFramework}' not found in project. Please install it first.` }
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000
      })
      
      return { 
        success: true, 
        message: 'Unit tests completed',
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

toolRegistry.register({
  name: 'run_integration_tests',
  description: 'Run integration tests',
  parameters: [
    { name: 'projectPath', type: 'string', description: 'Project directory path', required: true },
    { name: 'testFramework', type: 'string', description: 'Test framework (jest, cypress, playwright, auto)', required: false },
    { name: 'headless', type: 'boolean', description: 'Run tests in headless mode', required: false }
  ],
  handler: async (params: any) => {
    try {
      const projectPath = params?.projectPath
      if (!projectPath) return { error: 'Missing parameter: projectPath' }
      
      const testFramework = params?.testFramework || 'auto'
      const isHeadless = params?.headless !== false
      
      let command = ''
      
      if (testFramework === 'cypress' || testFramework === 'auto') {
        const cypressPath = path.join(projectPath, 'node_modules', '.bin', 'cypress')
        if (fs.existsSync(cypressPath)) {
          command = 'npx cypress run'
          if (isHeadless) command += ' --headless'
        }
      }
      
      if (testFramework === 'playwright') {
        const playwrightPath = path.join(projectPath, 'node_modules', '.bin', 'playwright')
        if (fs.existsSync(playwrightPath)) {
          command = 'npx playwright test'
          if (isHeadless) command += ' --headed=false'
        }
      }
      
      if (!command) {
        return { error: `Test framework '${testFramework}' not found in project. Please install it first.` }
      }
      
      const result = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000
      })
      
      return { 
        success: true, 
        message: 'Integration tests completed',
        output: result 
      }
    } catch (error: any) {
      return { error: error.message }
    }
  }
})

console.log('[DevTools] Code quality tools loaded')
