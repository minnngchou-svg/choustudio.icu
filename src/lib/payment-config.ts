import { readFile } from "fs/promises"
import path from "path"

export type PaymentConfig = {
  wechatAppId?: string
  wechatMchId?: string
  wechatApiKey?: string
  wechatSerialNo?: string
  wechatPrivateKey?: string
  wechatCert?: string
  wechatNotifyUrl?: string
}

/** 从项目根相对路径读取 PEM 文件内容，失败返回 ""。 */
async function readPemFromPath(filePath: string): Promise<string> {
  if (!filePath?.trim()) return ""
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath)
    const content = await readFile(absolutePath, "utf8")
    return content?.trim() ?? ""
  } catch {
    return ""
  }
}

/** 从环境变量及可选证书路径读取支付配置。 */
export async function getPaymentConfig(): Promise<PaymentConfig> {
  let wechatPrivateKey = process.env.WECHAT_PAY_PRIVATE_KEY || ""
  let wechatCert = process.env.WECHAT_PAY_CERT || ""
  const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH?.trim()
  const certPath = process.env.WECHAT_PAY_CERT_PATH?.trim()
  if (!wechatPrivateKey && privateKeyPath) {
    wechatPrivateKey = await readPemFromPath(privateKeyPath)
  }
  if (!wechatCert && certPath) {
    wechatCert = await readPemFromPath(certPath)
  }

  return {
    wechatAppId: process.env.WECHAT_APP_ID || "",
    wechatMchId: process.env.WECHAT_PAY_MCH_ID || "",
    wechatApiKey: process.env.WECHAT_PAY_API_KEY || "",
    wechatSerialNo: process.env.WECHAT_PAY_SERIAL_NO || "",
    wechatPrivateKey,
    wechatCert,
    wechatNotifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || "",
  }
}
