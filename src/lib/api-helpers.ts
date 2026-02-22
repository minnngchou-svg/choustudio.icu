/**
 * API 路由共享工具：统一错误响应、状态校验、角色检查。
 * 消除各 route.ts 中的重复模式。
 */
import { NextResponse } from "next/server"

/* ------------------------------------------------------------------ */
/*  统一 API 响应                                                       */
/* ------------------------------------------------------------------ */

/** 标准错误响应。 */
export function apiError(
    message: string,
    status: number,
    detail?: string,
): NextResponse {
    return NextResponse.json(
        { error: message, ...(detail ? { detail } : {}) },
        { status },
    )
}

/** 标准成功响应（仅在需要额外 headers 时使用）。 */
export function apiSuccess<T>(
    data: T,
    headers?: Record<string, string>,
): NextResponse {
    return NextResponse.json(data, headers ? { headers } : undefined)
}

/* ------------------------------------------------------------------ */
/*  状态校验                                                            */
/* ------------------------------------------------------------------ */

type ValidStatus = "DRAFT" | "PUBLISHED" | "PRIVATE"

/** 将自由字符串归一化为合法的 PostStatus / WorkStatus 枚举值。 */
export function normalizeStatus(s?: string): ValidStatus {
    if (s === "PUBLISHED") return "PUBLISHED"
    if (s === "PRIVATE") return "PRIVATE"
    return "DRAFT"
}

/* ------------------------------------------------------------------ */
/*  角色检查                                                            */
/* ------------------------------------------------------------------ */

type SessionLike = { user?: { role?: string } } | null | undefined

/** 判断当前 session 是否为 ADMIN。 */
export function isAdminSession(session: SessionLike): boolean {
    return (session?.user as { role?: string })?.role === "ADMIN"
}
