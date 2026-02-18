import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder as any
global.TextDecoder = TextDecoder as any

process.env.NODE_ENV = 'test'

beforeAll(() => {
  jest.mock('electron', () => ({
    app: {
      getPath: jest.fn((name: string) => {
        const paths: Record<string, string> = {
          userData: '/tmp/test-app-data',
          home: '/tmp/test-home'
        }
        return paths[name] || '/tmp/test'
      })
    }
  }))
})

beforeEach(() => {
  jest.clearAllMocks()
})
