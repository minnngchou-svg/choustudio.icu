import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response
    const { id } = await params

    try {
        const order = await prisma.accountOrder.findUnique({
            where: { id },
            include: {
                accountProduct: { select: { id: true, title: true, accountType: true } },
            },
        })
        if (!order) {
            return NextResponse.json({ error: "订单不存在" }, { status: 404 })
        }
        return NextResponse.json({
            ...order,
            amount: Number(order.amount),
            accountProduct: order.accountProduct,
        })
    } catch (e) {
        const message = e instanceof Error ? e.message : "查询失败"
        return NextResponse.json({ error: "查询失败", detail: message }, { status: 500 })
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response
    const { id } = await params

    try {
        const body = await request.json()
        const { status } = body

        const validStatuses = ["PENDING", "PAID", "CANCELLED", "REFUNDING", "REFUNDED"]
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: "无效的订单状态" }, { status: 400 })
        }

        const order = await prisma.accountOrder.update({
            where: { id },
            data: { status },
            include: {
                accountProduct: { select: { id: true, title: true, accountType: true } },
            },
        })

        return NextResponse.json({
            ...order,
            amount: Number(order.amount),
        })
    } catch (e) {
        const message = e instanceof Error ? e.message : "更新失败"
        return NextResponse.json({ error: "更新失败", detail: message }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response
    const { id } = await params

    try {
        await prisma.accountOrder.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (e) {
        const message = e instanceof Error ? e.message : "删除失败"
        return NextResponse.json({ error: "删除失败", detail: message }, { status: 500 })
    }
}
