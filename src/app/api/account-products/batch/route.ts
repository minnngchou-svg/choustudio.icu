import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** DELETE: 批量删除 */
export async function DELETE(request: NextRequest) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response

    try {
        const { ids } = await request.json()
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "缺少 ids" }, { status: 400 })
        }
        await prisma.accountProduct.deleteMany({ where: { id: { in: ids } } })
        return NextResponse.json({ success: true, deleted: ids.length })
    } catch (e) {
        const message = e instanceof Error ? e.message : "批量删除失败"
        return NextResponse.json({ error: "批量删除失败", detail: message }, { status: 500 })
    }
}

/** PATCH: 批量排序 */
export async function PATCH(request: NextRequest) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response

    try {
        const { items } = await request.json()
        if (!Array.isArray(items)) {
            return NextResponse.json({ error: "缺少 items" }, { status: 400 })
        }
        await prisma.$transaction(
            items.map((item: { id: string; sortOrder: number }) =>
                prisma.accountProduct.update({
                    where: { id: item.id },
                    data: { sortOrder: item.sortOrder },
                }),
            ),
        )
        return NextResponse.json({ success: true })
    } catch (e) {
        const message = e instanceof Error ? e.message : "排序失败"
        return NextResponse.json({ error: "排序失败", detail: message }, { status: 500 })
    }
}
