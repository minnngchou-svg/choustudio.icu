/** 订单/交付邮件发送（Resend）。未配置 RESEND_API_KEY 时静默跳过。 */
import { Resend } from "resend"

let resendClient: Resend | null = null

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  if (!resendClient) {
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

const FROM_ADDRESS = process.env.EMAIL_FROM || "onboarding@resend.dev"

interface OrderEmailParams {
  to: string
  siteName: string
  workTitle: string
  orderNo: string
  isFree: boolean
  amount?: number
  figmaUrl?: string | null
  deliveryUrl?: string | null
  currentVersion?: string | null
  wechat?: string | null
}

/** 解析 data URL 为 Buffer 与 contentType。 */
function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const match = dataUrl.match(/^data:(image\/(\w+));base64,(.+)$/)
  if (!match) return null
  return {
    contentType: match[1],
    ext: match[2] === "jpeg" ? "jpg" : match[2],
    buffer: Buffer.from(match[3], "base64"),
  }
}

/** 发送订单确认/交付邮件。 */
export async function sendOrderEmail(params: OrderEmailParams) {
  const resend = getResend()
  if (!resend) {
    console.log("[Email] RESEND_API_KEY 未配置，跳过发送邮件")
    return
  }

  const {
    to,
    siteName,
    workTitle,
    orderNo,
    isFree,
    amount,
    figmaUrl,
    deliveryUrl,
    currentVersion,
    wechat,
  } = params

  const subject = isFree
    ? `🎁 ${workTitle} - 资源已就绪`
    : `✅ ${workTitle} - 购买成功`

  const deliverySection = buildDeliverySection(figmaUrl, deliveryUrl)
  const versionText = currentVersion ? ` V${currentVersion}` : ""

  // 处理微信：判断是文字（微信号）还是图片（二维码）
  const isWechatImage = wechat?.startsWith("data:image")
  const wechatSection = buildWechatSection(wechat, isWechatImage)

  // 构建附件列表（Resend 通过 contentId 支持内联图片）
  const attachments: { filename: string; content: Buffer; content_type: string; contentId: string }[] = []
  if (wechat && isWechatImage) {
    const parsed = parseDataUrl(wechat)
    if (parsed) {
      attachments.push({
        filename: `wechat-qr.${parsed.ext}`,
        content: parsed.buffer,
        content_type: parsed.contentType,
        contentId: "wechat-qr",
      })
    }
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0; padding:0; background-color:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#171717; border-radius:16px; border:1px solid #262626; overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0; font-size:13px; color:#737373;">${siteName}</p>
            </td>
          </tr>

          <!-- Icon + Title -->
          <tr>
            <td align="center" style="padding:32px 32px 16px;">
              <div style="width:56px; height:56px; border-radius:50%; background-color:#1a2e1a; display:inline-flex; align-items:center; justify-content:center; font-size:28px; line-height:56px;">
                ${isFree ? "🎁" : "💚"}
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 8px;">
              <h1 style="margin:0; font-size:20px; font-weight:700; color:#fafafa;">
                ${isFree ? "资源已就绪" : "感谢您的支持"}
              </h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 24px;">
              <p style="margin:0; font-size:14px; color:#a3a3a3;">
                ${workTitle}${versionText}
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px; background-color:#262626;"></div>
            </td>
          </tr>

          <!-- Order Info (paid only) -->
          ${!isFree ? `
          <tr>
            <td style="padding:20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px; color:#737373; padding-bottom:8px;">订单号</td>
                  <td align="right" style="font-size:13px; color:#d4d4d4; padding-bottom:8px; font-family:monospace;">${orderNo}</td>
                </tr>
                <tr>
                  <td style="font-size:13px; color:#737373;">支付金额</td>
                  <td align="right" style="font-size:13px; color:#d4d4d4;">¥${amount ?? 0}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px; background-color:#262626;"></div>
            </td>
          </tr>
          ` : ""}

          <!-- Delivery Links -->
          ${deliverySection}

          <!-- WeChat Contact -->
          ${wechatSection}

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 32px 32px;">
              <p style="margin:0; font-size:12px; color:#525252; line-height:1.6;">
                ${isFree ? "此邮件确认您已成功获取开源资源。" : "此邮件确认您的购买已完成，请妥善保管。"}
                ${!wechat ? "<br />如有问题，请回复此邮件联系我们。" : ""}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const result = await resend.emails.send({
      from: `${siteName} <${FROM_ADDRESS}>`,
      to,
      subject,
      html,
      ...(attachments.length > 0 && { attachments }),
    })
    console.log("[Email] 邮件已发送:", result)
  } catch (err) {
    console.error("[Email] 发送失败:", err)
  }
}

function buildDeliverySection(
  figmaUrl?: string | null,
  deliveryUrl?: string | null,
): string {
  if (!figmaUrl && !deliveryUrl) return ""

  let buttons = ""

  if (figmaUrl) {
    buttons += `
      <tr>
        <td style="padding:0 0 12px;">
          <a href="${figmaUrl}" target="_blank" style="display:block; padding:14px; border-radius:12px; background-color:#fafafa; color:#0a0a0a; text-decoration:none; text-align:center; font-size:14px; font-weight:600;">
            🔗 直接在 Figma 中打开
          </a>
        </td>
      </tr>`
  }

  if (deliveryUrl) {
    buttons += `
      <tr>
        <td style="padding:0 0 12px;">
          <a href="${deliveryUrl}" target="_blank" style="display:block; padding:14px; border-radius:12px; background-color:#262626; color:#fafafa; text-decoration:none; text-align:center; font-size:14px; font-weight:500; border:1px solid #404040;">
            📦 获取源文件
          </a>
        </td>
      </tr>`
  }

  return `
  <tr>
    <td style="padding:20px 32px 8px;">
      <p style="margin:0 0 12px; font-size:13px; color:#737373;">获取您的资源</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${buttons}
      </table>
    </td>
  </tr>`
}

function buildWechatSection(
  wechat?: string | null,
  isImage?: boolean,
): string {
  if (!wechat) return ""

  if (isImage) {
    // 二维码图片：附件会以 wechat-qr.jpg 附上，这里用文字提示
    return `
    <tr>
      <td style="padding:0 32px;">
        <div style="height:1px; background-color:#262626;"></div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 0;">
        <p style="margin:0 0 12px; font-size:13px; color:#737373;">需要帮助？扫码添加微信</p>
        <div style="background-color:#ffffff; border-radius:12px; padding:12px; display:inline-block;">
          <img src="cid:wechat-qr" alt="微信二维码" style="width:140px; height:140px; border-radius:8px; display:block;" />
        </div>
        <p style="margin:10px 0 0; font-size:12px; color:#525252;">长按或截图扫码添加</p>
      </td>
    </tr>`
  }

  // 纯文字微信号
  return `
  <tr>
    <td style="padding:0 32px;">
      <div style="height:1px; background-color:#262626;"></div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <p style="margin:0; font-size:13px; color:#737373;">需要帮助？添加微信联系我</p>
            <p style="margin:6px 0 0; font-size:15px; color:#fafafa; font-weight:600; letter-spacing:0.5px;">${wechat}</p>
          </td>
          <td width="36" style="vertical-align:middle; text-align:right;">
            <div style="width:32px; height:32px; border-radius:8px; background-color:#07C160; display:inline-block; text-align:center; line-height:32px; font-size:18px; color:#fff;">💬</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}
