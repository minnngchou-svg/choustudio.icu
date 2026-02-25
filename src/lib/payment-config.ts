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
  alipayAppId?: string
  alipayPrivateKey?: string
  alipayPublicKey?: string
  alipayNotifyUrl?: string
  alipayReturnUrl?: string
}

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

  let alipayPrivateKey = process.env.ALIPAY_PRIVATE_KEY || ""
  let alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY || ""
  const alipayPrivateKeyPath = process.env.ALIPAY_PRIVATE_KEY_PATH?.trim()
  const alipayPublicKeyPath = process.env.ALIPAY_PUBLIC_KEY_PATH?.trim()
  if (!alipayPrivateKey && alipayPrivateKeyPath) {
    alipayPrivateKey = await readPemFromPath(alipayPrivateKeyPath)
  }
  if (!alipayPublicKey && alipayPublicKeyPath) {
    alipayPublicKey = await readPemFromPath(alipayPublicKeyPath)
  }

  return {
    wechatAppId: process.env.WECHAT_APP_ID || "",
    wechatMchId: process.env.WECHAT_PAY_MCH_ID || "",
    wechatApiKey: process.env.WECHAT_PAY_API_KEY || "",
    wechatSerialNo: process.env.WECHAT_PAY_SERIAL_NO || "",
    wechatPrivateKey,
    wechatCert,
    wechatNotifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || "",
    alipayAppId: process.env.ALIPAY_APP_ID || "",
    alipayPrivateKey,
    alipayPublicKey,
    alipayNotifyUrl: process.env.ALIPAY_NOTIFY_URL || "",
    alipayReturnUrl: process.env.ALIPAY_RETURN_URL || "",
  }
}
