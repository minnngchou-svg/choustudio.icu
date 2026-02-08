/** 图片压缩并转为 Data URL，用于头像等小图上传。 */

const MAX_SIZE = 512
const JPEG_QUALITY = 0.78

export function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      let width = w
      let height = h
      if (w > MAX_SIZE || h > MAX_SIZE) {
        if (w >= h) {
          width = MAX_SIZE
          height = Math.round((h * MAX_SIZE) / w)
        } else {
          height = MAX_SIZE
          width = Math.round((w * MAX_SIZE) / h)
        }
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("无法创建 canvas"))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY)
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("图片加载失败"))
    }
    img.src = url
  })
}
