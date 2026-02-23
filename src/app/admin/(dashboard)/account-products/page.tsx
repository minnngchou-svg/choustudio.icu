"use client"
/** AI 服务商品管理：列表、筛选、拖拽排序、批量删除、编辑入口。 */
import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
import { DndSortProvider, SortableTableBody } from "@/components/admin/SortableTable"
import { AdminThumbnail } from "@/components/admin/AdminThumbnail"
import { useTableControls } from "@/hooks/useTableControls"
import { TableToolbar, type BatchAction } from "@/components/admin/TableToolbar"
import { TablePagination } from "@/components/admin/TablePagination"
import { SortableTableHead } from "@/components/admin/SortableTableHead"
import { ConfirmPopover } from "@/components/admin/ConfirmPopover"

type AccountProduct = {
    id: string
    title: string
    slug: string
    coverImage?: string | null
    accountType: string
    price: number
    originalPrice?: number | null
    stock: number
    status: string
    sortOrder: number
    createdAt: string
    category?: { name: string } | null
}

const statusLabels: Record<string, string> = {
    DRAFT: "草稿",
    PUBLISHED: "已上架",
    PRIVATE: "私密",
    SOLD_OUT: "售罄",
}

export default function AccountProductsPage() {
    const router = useRouter()
    const [list, setList] = useState<AccountProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)

    const tc = useTableControls<AccountProduct>({
        data: list,
        searchFields: ["title"],
        defaultPageSize: 20,
    })

    const toolbarFilters = useMemo(() => {
        const types = [...new Set(list.map((i) => i.accountType))].sort()
        const statuses = [...new Set(list.map((i) => i.status))]
        const filters = []
        if (types.length > 0) {
            filters.push({
                key: "accountType",
                label: "类型",
                options: types.map((t) => ({ label: t, value: t })),
            })
        }
        if (statuses.length > 0) {
            filters.push({
                key: "status",
                label: "状态",
                options: statuses.map((s) => ({ label: statusLabels[s] || s, value: s })),
            })
        }
        return filters
    }, [list])

    const batchActions: BatchAction[] = useMemo(() => [
        {
            label: "删除", icon: "ri-delete-bin-line", variant: "destructive" as const, onClick: handleBatchDelete,
            needConfirm: true, confirmTitle: `确定删除选中的 ${tc.selectedIds.size} 个商品？`, confirmDescription: "删除后不可恢复",
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [tc.selectedIds.size])

    async function load() {
        setLoading(true)
        try {
            const res = await fetch("/api/account-products?all=1", { credentials: "include" })
            if (res.status === 401 || res.status === 403) { router.push("/admin/login"); return }
            if (!res.ok) { toast.error("加载失败"); return }
            const data = await res.json()
            setList(Array.isArray(data) ? data : [])
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    async function saveSort(id: string, sortOrder: number) {
        try {
            await fetch("/api/account-products/batch", {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                credentials: "include", body: JSON.stringify({ items: [{ id, sortOrder }] }),
            })
        } catch { toast.error("排序保存失败") }
    }

    function handleReorder(reordered: AccountProduct[]) {
        setList(reordered)
        reordered.forEach((item, idx) => {
            if (item.sortOrder !== idx) saveSort(item.id, idx)
        })
    }

    async function createDraft() {
        setCreating(true)
        try {
            const ts = Date.now().toString(36)
            const res = await fetch("/api/account-products", {
                method: "POST", headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ title: `新 AI 服务 ${ts}`, slug: `ai-${ts}`, accountType: "chatgpt", price: 0 }),
            })
            const data = await res.json()
            if (res.ok && data?.id) router.push(`/admin/account-products/${data.id}/edit`)
            else toast.error(data?.error || "创建失败")
        } catch { toast.error("网络错误") }
        finally { setCreating(false) }
    }

    async function handleDelete(id: string) {
        setDeletingId(id)
        try {
            const res = await fetch(`/api/account-products/${id}`, { method: "DELETE", credentials: "include" })
            if (res.ok) setList((prev) => prev.filter((t) => t.id !== id))
            else { const err = await res.json().catch(() => ({})); toast.error(err.error || "删除失败") }
        } finally { setDeletingId(null) }
    }

    async function handleBatchDelete() {
        const ids = Array.from(tc.selectedIds)
        if (ids.length === 0) return
        try {
            const res = await fetch("/api/account-products/batch", {
                method: "DELETE", headers: { "Content-Type": "application/json" },
                credentials: "include", body: JSON.stringify({ ids }),
            })
            if (res.ok) { setList((prev) => prev.filter((t) => !ids.includes(t.id))); tc.clearSelection(); toast.success(`已删除 ${ids.length} 个商品`) }
            else toast.error("批量删除失败")
        } catch { toast.error("网络错误") }
    }

    function formatDate(dateStr: string) {
        try { return new Date(dateStr).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) }
        catch { return dateStr }
    }

    function renderCells(item: AccountProduct) {
        return (
            <>
                <TableCell>
                    <div className="flex items-center gap-3">
                        <AdminThumbnail src={item.coverImage} fallbackIcon="ri-robot-line" className="w-10 h-10" />
                        <div className="min-w-0">
                            <span className="font-medium truncate block">{item.title}</span>
                            <span className="text-xs text-muted-foreground truncate block">{item.slug}</span>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="capitalize">{item.accountType}</TableCell>
                <TableCell className="font-medium">¥{item.price}</TableCell>
                <TableCell className="text-center">{item.stock}</TableCell>
                <TableCell>
                    <Badge variant={item.status === "PUBLISHED" ? "default" : item.status === "SOLD_OUT" ? "destructive" : "secondary"}>
                        {statusLabels[item.status] || item.status}
                    </Badge>
                </TableCell>
                <TableCell>{formatDate(item.createdAt)}</TableCell>
                <TableCell>
                    <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                            <Link href={`/admin/account-products/${item.id}/edit`}><i className="ri-edit-line" /></Link>
                        </Button>
                        <ConfirmPopover
                            title="确定删除该商品？"
                            description="删除后不可恢复"
                            confirmText="删除"
                            onConfirm={() => handleDelete(item.id)}
                            align="end"
                        >
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0" disabled={deletingId === item.id}>
                                <i className={deletingId === item.id ? "ri-loader-4-line animate-spin" : "ri-delete-bin-line"} />
                            </Button>
                        </ConfirmPopover>
                    </div>
                </TableCell>
            </>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">AI 服务</h1>
                    <p className="text-muted-foreground mt-1">管理 AI 服务商品</p>
                </div>
                <Button onClick={createDraft} disabled={creating}>
                    {creating ? "创建中…" : "添加商品"}
                </Button>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
                <TableToolbar
                    searchValue={tc.searchTerm}
                    onSearchChange={tc.setSearchTerm}
                    searchPlaceholder="搜索商品标题…"
                    filters={toolbarFilters}
                    filterValues={tc.filters}
                    onFilterChange={tc.setFilter}
                    selectedCount={tc.selectedIds.size}
                    batchActions={batchActions}
                    onClearSelection={tc.clearSelection}
                />

                {tc.isFiltering && (
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-muted-foreground"><i className="ri-filter-line mr-1" />筛选模式 · 拖拽排序已暂停</span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={tc.resetFilters}>清除筛选</Button>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">加载中…</div>
                ) : tc.isFiltering ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">
                                    <Checkbox checked={tc.isAllSelected} onCheckedChange={() => tc.toggleSelectAll()} />
                                </TableHead>
                                <SortableTableHead column="title" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof AccountProduct)}>标题</SortableTableHead>
                                <TableHead>类型</TableHead>
                                <SortableTableHead column="price" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof AccountProduct)}>价格</SortableTableHead>
                                <TableHead className="text-center">库存</TableHead>
                                <TableHead>状态</TableHead>
                                <SortableTableHead column="createdAt" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof AccountProduct)}>创建时间</SortableTableHead>
                                <TableHead className="w-[100px]">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tc.pagedData.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">无匹配结果</TableCell></TableRow>
                            ) : tc.pagedData.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="w-[40px]"><Checkbox checked={tc.selectedIds.has(item.id)} onCheckedChange={() => tc.toggleSelect(item.id)} /></TableCell>
                                    {renderCells(item)}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <DndSortProvider items={list} onReorder={handleReorder}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]"></TableHead>
                                    <TableHead className="w-[40px]">
                                        <Checkbox checked={tc.isAllSelected} onCheckedChange={() => tc.toggleSelectAll()} />
                                    </TableHead>
                                    <TableHead>标题</TableHead>
                                    <TableHead>类型</TableHead>
                                    <TableHead>价格</TableHead>
                                    <TableHead className="text-center">库存</TableHead>
                                    <TableHead>状态</TableHead>
                                    <TableHead>创建时间</TableHead>
                                    <TableHead className="w-[100px]">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <SortableTableBody items={list} columnCount={9} emptyText="暂无商品，点击「添加商品」创建">
                                {(item) => (
                                    <>
                                        <TableCell className="w-[40px]">
                                            <Checkbox checked={tc.selectedIds.has(item.id)} onCheckedChange={() => tc.toggleSelect(item.id)} />
                                        </TableCell>
                                        {renderCells(item)}
                                    </>
                                )}
                            </SortableTableBody>
                        </Table>
                    </DndSortProvider>
                )}

                {tc.totalItems > 0 && (
                    <TablePagination page={tc.page} pageSize={tc.pageSize} totalItems={tc.totalItems} totalPages={tc.totalPages} onPageChange={tc.setPage} onPageSizeChange={tc.setPageSize} />
                )}
            </div>
        </div>
    )
}
