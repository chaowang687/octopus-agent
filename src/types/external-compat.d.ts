declare module '@langchain/core/tools' {
  export abstract class Tool {
    name: string
    description: string
    schema?: any
    protected abstract _call(input: any): Promise<string>
  }
}

declare module 'zod' {
  export const z: any
}
