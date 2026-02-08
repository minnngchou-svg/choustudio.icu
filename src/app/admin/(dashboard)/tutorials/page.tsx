"use client"
/** 视频教程管理：列表、筛选、拖拽排序、批量删除、编辑入口。 */
import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { AdminThumbnail } from "@/components/admin/AdminThumbnail"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DndSortProvider, SortableTableBody } from "@/components/admin/SortableTable"
import { useTableControls } from "@/hooks/useTableControls"
import { TableToolbar, type BatchAction } from "@/components/admin/TableToolbar"
import { TablePagination } from "@/components/admin/TablePagination"
import { SortableTableHead } from "@/components/admin/SortableTableHead"
import { ConfirmPopover } from "@/components/admin/ConfirmPopover"

type Tutorial = {
  id: string
  title: string
  slug: string
  thumbnail?: string | null
  videoUrl: string
  sortOrder: number
  createdAt: string
  category?: { name: string } | null
}

export default function TutorialsPage() {
  const router = useRouter()
  const [list, setList] = useState<Tutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [categories, setCategories] = useState<string[]>([])

  const tc = useTableControls<Tutorial>({
    data: list,
    searchFields: ["title"],
    defaultPageSize: 20,
  })

  const toolbarFilters = useMemo(() => {
    if (categories.length === 0) return []
    return [{
      key: "category.name",
      label: "分类",
      options: categories.map((c) => ({ label: c, value: c })),
    }]
  }, [categories])

  const batchActions: BatchAction[] = useMemo(() => [
    {
      label: "删除", icon: "ri-delete-bin-line", variant: "destructive" as const, onClick: handleBatchDelete,
      needConfirm: true, confirmTitle: `确定删除选中的 ${tc.selectedIds.size} 个教程？`, confirmDescription: "删除后不可恢复",
    },
  ], [tc.selectedIds])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/tutorials", { credentials: "include" })
      if (!res.ok) { router.push("/admin/login"); return }
      const data = await res.json()
      const items: Tutorial[] = Array.isArray(data) ? data : []
      setList(items)
      setCategories([...new Set(items.map((t) => t.category?.name).filter(Boolean))] as string[])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function saveSort(id: string, sortOrder: number) {
    try {
      const res = await fetch(`/api/tutorials/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ sortOrder }),
      })
      if (!res.ok) toast.error("排序保存失败")
    } catch { toast.error("网络错误") }
  }

  function handleReorder(reordered: Tutorial[]) {
    const prev = list
    setList(reordered)
    reordered.filter((item, idx) => {
      const old = prev.find((t) => t.id === item.id)
      return old && old.sortOrder !== idx
    }).forEach((item) => saveSort(item.id, item.sortOrder))
  }

  async function createDraft() {
    setCreating(true)
    try {
      const res = await fetch("/api/tutorials", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "无标题教程", slug: `draft-${Date.now()}`, videoUrl: "" }),
      })
      const data = await res.json()
      if (res.ok && data?.id) router.push(`/admin/tutorials/${data.id}/edit`)
      else toast.error(data?.error || "创建失败")
    } catch { toast.error("网络错误") }
    finally { setCreating(false) }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/tutorials/${id}`, { method: "DELETE", credentials: "include" })
      if (res.ok) setList((prev) => prev.filter((t) => t.id !== id))
      else { const err = await res.json().catch(() => ({})); toast.error(err.error || "删除失败") }
    } finally { setDeletingId(null) }
  }

  async function handleBatchDelete() {
    const ids = Array.from(tc.selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/tutorials/batch", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ids }),
      })
      if (res.ok) { setList((prev) => prev.filter((t) => !ids.includes(t.id))); tc.clearSelection(); toast.success(`已删除 ${ids.length} 个教程`) }
      else toast.error("批量删除失败")
    } catch { toast.error("网络错误") }
  }

  function formatDate(dateStr: string) {
    try { return new Date(dateStr).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) }
    catch { return dateStr }
  }

  function renderCells(item: Tutorial) {
    return (
      <>
        <TableCell>
          <div className="flex items-center gap-3">
            <AdminThumbnail src={item.thumbnail} fallbackIcon="ri-video-line" className="w-10 h-10" />
            <span className="font-medium truncate">{item.title}</span>
          </div>
        </TableCell>
        <TableCell>{item.category?.name ?? "-"}</TableCell>
        <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">
          {item.videoUrl || "-"}
        </TableCell>
        <TableCell>{formatDate(item.createdAt)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
              <Link href={`/admin/tutorials/${item.id}/edit`}><i className="ri-edit-line" /></Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
              <Link href={`/tutorials#${item.slug}`} target="_blank"><i className="ri-eye-line" /></Link>
            </Button>
            <ConfirmPopover
              title="确定删除该教程？"
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
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">视频教程</h1>
          <p className="text-muted-foreground mt-1">管理视频教程合集</p>
        </div>
        <Button onClick={createDraft} disabled={creating}>
          {creating ? "创建中…" : "添加教程"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
        <TableToolbar
          searchValue={tc.searchTerm}
          onSearchChange={tc.setSearchTerm}
          searchPlaceholder="搜索教程标题…"
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
                <SortableTableHead column="title" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Tutorial)}>标题</SortableTableHead>
                <TableHead>分类</TableHead>
                <TableHead>链接</TableHead>
                <SortableTableHead column="createdAt" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Tutorial)}>创建时间</SortableTableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tc.pagedData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">无匹配结果</TableCell></TableRow>
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
                  <TableHead>分类</TableHead>
                  <TableHead>链接</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <SortableTableBody items={list} columnCount={7} emptyText="暂无教程，点击「添加教程」添加">
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
