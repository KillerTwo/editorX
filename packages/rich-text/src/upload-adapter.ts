export function createUploadAdapter(
  file: Promise<File | null>,
  upload: (file: File, onProgress?: (percent: number) => void) => Promise<{ url: string }>,
) {
  return {
    async upload() {
      const resolved = await file
      if (!resolved) throw new Error('没有文件')
      const { url } = await upload(resolved)
      return { default: url }
    },
    abort() {},
  }
}
