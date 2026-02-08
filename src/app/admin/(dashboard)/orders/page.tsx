"use client"
/** 订单管理：列表、筛选、批量更新状态、查看详情。 */
import { useState, useEffect, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTableControls } from "@/hooks/useTableControls"
import { TableToolbar, type ToolbarFilter, type BatchAction } from "@/components/admin/TableToolbar"
import { TablePagination } from "@/components/admin/TablePagination"
import { SortableTableHead } from "@/components/admin/SortableTableHead"

type OrderItem = {
  id: string
  orderNo: string
  workTitle: string
  workId: string
  buyerEmail: string
  buyerName: string | null
  amount: number
  status: string
  paidAt: string | null
  createdAt: string
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "待支付", variant: "outline" },
  PAID: { label: "已支付", variant: "default" },
  CANCELLED: { label: "已取消", variant: "destructive" },
  REFUNDED: { label: "已退款", variant: "destructive" },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    orderId: string
    orderNo: string
    action: "CANCELLED" | "REFUNDED" | "DELETE"
  } | null>(null)

  const tc = useTableControls<OrderItem>({
    data: orders,
    searchFields: ["orderNo", "buyerEmail", "workTitle"],
    defaultPageSize: 20,
  })

  const toolbarFilters: ToolbarFilter[] = useMemo(() => [
    {
      key: "status",
      label: "状态",
      options: [
        { label: "待支付", value: "PENDING" },
        { label: "已支付", value: "PAID" },
        { label: "已取消", value: "CANCELLED" },
        { label: "已退款", value: "REFUNDED" },
      ],
    },
  ], [])

  const batchActions: BatchAction[] = useMemo(() => {
    const ids = Array.from(tc.selectedIds)
    const selectedOrders = orders.filter((o) => ids.includes(o.id))
    const allPending = selectedOrders.every((o) => o.status === "PENDING")
    const actions: BatchAction[] = []
    if (allPending && selectedOrders.length > 0) {
      actions.push(
        {
          label: "标记已支付", icon: "ri-checkbox-circle-line", onClick: () => handleBatchStatus("PAID"),
          needConfirm: true, confirmTitle: `确定将 ${selectedOrders.length} 个订单标记为已支付？`,
        },
        {
          label: "取消订单", icon: "ri-close-circle-line", variant: "destructive", onClick: () => handleBatchStatus("CANCELLED"),
          needConfirm: true, confirmTitle: `确定取消选中的 ${selectedOrders.length} 个订单？`, confirmDescription: "取消后不可撤回",
        },
      )
    }
    if (selectedOrders.length > 0) {
      actions.push({
        label: "删除选中订单",
        icon: "ri-delete-bin-line",
        variant: "destructive",
        onClick: () => handleBatchDelete(),
        needConfirm: true,
        confirmTitle: `确定删除选中的 ${selectedOrders.length} 个订单？`,
        confirmDescription: "删除后不可恢复",
      })
    }
    return actions
  }, [tc.selectedIds, orders])

  function fetchOrders() {
    setLoading(true)
    fetch("/api/orders?all=1", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrders() }, [])

  async function updateStatus(orderId: string, newStatus: string) {
    setActionLoading(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) fetchOrders()
    } finally { setActionLoading(null) }
  }

  async function handleBatchStatus(status: string) {
    const ids = Array.from(tc.selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/orders/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids, status }),
      })
      if (res.ok) { tc.clearSelection(); fetchOrders() }
    } catch { /* ignore */ }
  }

  async function handleBatchDelete() {
    const ids = Array.from(tc.selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/orders/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      })
      if (res.ok) { tc.clearSelection(); fetchOrders() }
    } catch { /* ignore */ }
  }

  async function deleteOrder(orderId: string) {
    setActionLoading(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE", credentials: "include" })
      if (res.ok) fetchOrders()
    } finally { setActionLoading(null) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">订单管理</h1>
        <p className="text-muted-foreground mt-1">查看和管理所有订单</p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
        <TableToolbar
          searchValue={tc.searchTerm}
          onSearchChange={tc.setSearchTerm}
          searchPlaceholder="搜索订单号、邮箱或商品…"
          filters={toolbarFilters}
          filterValues={tc.filters}
          onFilterChange={tc.setFilter}
          selectedCount={tc.selectedIds.size}
          batchActions={batchActions}
          onClearSelection={tc.clearSelection}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox checked={tc.isAllSelected} onCheckedChange={() => tc.toggleSelectAll()} />
              </TableHead>
              <SortableTableHead column="orderNo" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof OrderItem)}>订单号</SortableTableHead>
              <TableHead>商品</TableHead>
              <TableHead>买家</TableHead>
              <SortableTableHead column="amount" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof OrderItem)}>金额</SortableTableHead>
              <SortableTableHead column="status" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof OrderItem)}>状态</SortableTableHead>
              <SortableTableHead column="createdAt" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof OrderItem)}>时间</SortableTableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">加载中…</TableCell></TableRow>
            ) : tc.pagedData.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">暂无订单</TableCell></TableRow>
            ) : (
              tc.pagedData.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="w-[40px]">
                    <Checkbox checked={tc.selectedIds.has(order.id)} onCheckedChange={() => tc.toggleSelect(order.id)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{order.orderNo}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{order.workTitle}</TableCell>
                  <TableCell>
                    <div className="text-sm">{order.buyerEmail}</div>
                    {order.buyerName && <div className="text-xs text-muted-foreground">{order.buyerName}</div>}
                  </TableCell>
                  <TableCell>{order.amount > 0 ? `¥${order.amount}` : "开源"}</TableCell>
                  <TableCell>
                    <Badge variant={statusMap[order.status]?.variant || "default"}>
                      {statusMap[order.status]?.label || order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleDateString("zh-CN")}{" "}
                    {new Date(order.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={actionLoading === order.id}>
                          {actionLoading === order.id ? "…" : "•••"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {order.status === "PENDING" && (
                          <DropdownMenuItem onClick={() => updateStatus(order.id, "PAID")}>
                            <i className="ri-checkbox-circle-line mr-2" />标记已支付
                          </DropdownMenuItem>
                        )}
                        {order.status === "PENDING" && <DropdownMenuSeparator />}
                        {order.status === "PENDING" && (
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ orderId: order.id, orderNo: order.orderNo, action: "CANCELLED" })}>
                            <i className="ri-close-circle-line mr-2" />取消订单
                          </DropdownMenuItem>
                        )}
                        {order.status === "PAID" && (
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ orderId: order.id, orderNo: order.orderNo, action: "REFUNDED" })}>
                            <i className="ri-refund-2-line mr-2" />退款
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ orderId: order.id, orderNo: order.orderNo, action: "DELETE" })}>
                          <i className="ri-delete-bin-line mr-2" />删除订单
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {tc.totalItems > 0 && (
          <TablePagination page={tc.page} pageSize={tc.pageSize} totalItems={tc.totalItems} totalPages={tc.totalPages} onPageChange={tc.setPage} onPageSizeChange={tc.setPageSize} />
        )}
      </div>

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl border p-6 shadow-lg max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold">
              {confirmAction.action === "DELETE"
                ? "确认删除订单"
                : confirmAction.action === "CANCELLED"
                  ? "确认取消订单"
                  : "确认退款"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {confirmAction.action === "DELETE"
                ? `确定要删除订单 ${confirmAction.orderNo} 吗？删除后不可恢复。`
                : confirmAction.action === "CANCELLED"
                  ? `确定要取消订单 ${confirmAction.orderNo} 吗？此操作不可撤销。`
                  : `确定要对订单 ${confirmAction.orderNo} 执行退款吗？此操作不可撤销。`}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>取消</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={actionLoading === confirmAction.orderId}
                onClick={async () => {
                  if (confirmAction.action === "DELETE") {
                    await deleteOrder(confirmAction.orderId)
                  } else {
                    await updateStatus(confirmAction.orderId, confirmAction.action)
                  }
                  setConfirmAction(null)
                }}
              >
                {actionLoading === confirmAction.orderId
                  ? "处理中…"
                  : confirmAction.action === "DELETE"
                    ? "确认删除"
                    : confirmAction.action === "CANCELLED"
                      ? "确认取消"
                      : "确认退款"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
