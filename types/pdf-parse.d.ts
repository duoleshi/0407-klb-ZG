// PDF 解析相关类型定义

declare module "pdf-parse" {
  interface PDFData {
    numpages: number
    numrender: number
    info: Record<string, unknown>
    metadata: Record<string, unknown> | null
    text: string
    version: string
  }

  interface PDFOptions {
    pagerender?: (pageData: any) => Promise<string>
    max?: number
    version?: string
    fontExtraMo?: boolean
  }

  function pdfParse(buffer: Buffer, options?: PDFOptions): Promise<PDFData>
  export default pdfParse
}
