declare module "html-docx-js" {
  interface BlobOptions {
    orientation?: string
    margins?: Record<string, number>
  }
  const htmlDocx: {
    asBlob: (html: string, options?: BlobOptions) => Blob
  }
  export default htmlDocx
}
