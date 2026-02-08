"use client"
/** 后台作品列表：设计/开发分页、拖拽排序、批量操作、编辑入口。 */
import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { TableToolbar, type ToolbarFilter, type BatchAction } from "@/components/admin/TableToolbar"
import { TablePagination } from "@/components/admin/TablePagination"
import { SortableTableHead } from "@/components/admin/SortableTableHead"
import { ConfirmPopover } from "@/components/admin/ConfirmPopover"

type Work = {
  id: string
  title: string
  slug: string
  coverImage?: string | null
  price: number | null
  isFree: boolean
  status: string
  sortOrder: number
  createdAt: string
  category?: { name: string } | null
}

type WorksListClientProps = {
  workType: "design" | "development"
  title: string
  description: string
}

export function WorksListClient({ workType, title, description }: WorksListClientProps) {
  const router = useRouter()
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [categories, setCategories] = useState<string[]>([])

  const tc = useTableControls<Work>({
    data: works,
    searchFields: ["title"],
    defaultPageSize: 20,
  })

  const toolbarFilters: ToolbarFilter[] = useMemo(() => {
    const filters: ToolbarFilter[] = [
      {
        key: "status",
        label: "状态",
        options: [
          { label: "已发布", value: "PUBLISHED" },
          { label: "草稿", value: "DRAFT" },
        ],
      },
    ]
    if (workType === "design") {
      filters.push({
        key: "isFree",
        label: "定价",
        options: [
          { label: "开源", value: "true" },
          { label: "付费", value: "false" },
        ],
      })
    }
    if (categories.length > 0) {
      filters.push({
        key: "category.name",
        label: "分类",
        options: categories.map((c) => ({ label: c, value: c })),
      })
    }
    return filters
  }, [categories])

  const batchActions: BatchAction[] = useMemo(() => [
    { label: "发布", icon: "ri-check-line", onClick: () => handleBatchStatus("PUBLISHED") },
    { label: "转草稿", icon: "ri-draft-line", onClick: () => handleBatchStatus("DRAFT") },
    {
      label: "删除", icon: "ri-delete-bin-line", variant: "destructive" as const, onClick: handleBatchDelete,
      needConfirm: true, confirmTitle: `确定删除选中的 ${tc.selectedIds.size} 个作品？`, confirmDescription: "删除后不可恢复",
    },
  ], [tc.selectedIds])

  async function loadWorks() {
    setLoading(true)
    try {
      const res = await fetch(`/api/works?all=1&type=${workType}`, { credentials: "include" })
      if (!res.ok) { router.push("/admin/login"); return }
      const data = await res.json()
      const list: Work[] = Array.isArray(data) ? data : []
      setWorks(list)
      setCategories([...new Set(list.map((w) => w.category?.name).filter(Boolean))] as string[])
    } finally { setLoading(false) }
  }

  useEffect(() => { loadWorks() }, [workType])

  async function saveSort(id: string, sortOrder: number) {
    try {
      const res = await fetch(`/api/works/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ sortOrder }),
      })
      if (!res.ok) toast.error("排序保存失败")
    } catch { toast.error("网络错误") }
  }

  function handleReorder(reordered: Work[]) {
    const prev = works
    setWorks(reordered)
    reordered.filter((item, idx) => {
      const old = prev.find((w) => w.id === item.id)
      return old && old.sortOrder !== idx
    }).forEach((item) => saveSort(item.id, item.sortOrder))
  }

  async function createDraft() {
    setCreating(true)
    try {
      const res = await fetch("/api/works", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "无标题作品", slug: `draft-${Date.now()}`, workType: workType === "development" ? "DEVELOPMENT" : "DESIGN" }),
      })
      const data = await res.json()
      if (res.ok && data?.id) router.push(`/admin/works/${data.id}/edit`)
      else toast.error(data?.error || "创建失败")
    } catch { toast.error("网络错误") }
    finally { setCreating(false) }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/works/${id}`, { method: "DELETE", credentials: "include" })
      if (res.ok) setWorks((prev) => prev.filter((w) => w.id !== id))
      else { const err = await res.json().catch(() => ({})); toast.error(err.error || "删除失败") }
    } finally { setDeletingId(null) }
  }

  async function handleBatchDelete() {
    const ids = Array.from(tc.selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/works/batch", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (data.partial) {
        const deletedIds = ids.filter((id) => !data.blocked.some((b: { id: string }) => b.id === id))
        if (deletedIds.length > 0) setWorks((prev) => prev.filter((w) => !deletedIds.includes(w.id)))
        tc.clearSelection()
        const blockedNames = (data.blocked as { id: string; title: string }[]).map((b) => b.title)
        toast.warning(`${data.blocked.length} 个作品因有关联订单无法删除`, {
          duration: 8000,
          description: (
            <div className="mt-1 space-y-1">
              {data.deleted > 0 && <p className="text-muted-foreground">已成功删除 {data.deleted} 个作品</p>}
              <p>无法删除：{blockedNames.map((name: string, i: number) => (
                <span key={i}>{i > 0 && "、"}<strong className="font-semibold">{name}</strong></span>
              ))}</p>
            </div>
          ),
        })
      } else if (res.ok) {
        setWorks((prev) => prev.filter((w) => !ids.includes(w.id)))
        tc.clearSelection()
        toast.success(`已删除 ${ids.length} 个作品`)
      } else {
        toast.error(data.error || "批量删除失败")
      }
    } catch { toast.error("网络错误") }
  }

  async function handleBatchStatus(status: string) {
    const ids = Array.from(tc.selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/works/batch", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ids, status }),
      })
      if (res.ok) { setWorks((prev) => prev.map((w) => ids.includes(w.id) ? { ...w, status } : w)); tc.clearSelection(); toast.success(`已更新 ${ids.length} 个作品状态`) }
      else toast.error("批量更新失败")
    } catch { toast.error("网络错误") }
  }

  function formatDate(dateStr: string) {
    try { return new Date(dateStr).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) }
    catch { return dateStr }
  }

  function renderCells(work: Work) {
    return (
      <>
        <TableCell>
          <div className="flex items-center gap-3">
            <AdminThumbnail src={work.coverImage} fallbackIcon={workType === "development" ? "ri-code-s-slash-line" : "ri-palette-line"} className="w-10 h-10" />
            <span className="font-medium truncate">{work.title}</span>
          </div>
        </TableCell>
        <TableCell>{work.category?.name ?? "-"}</TableCell>
        {workType === "design" && (
          <TableCell>
            {work.isFree ? <Badge variant="secondary">开源</Badge> : (work.price != null && work.price > 0 ? `¥${work.price}` : "-")}
          </TableCell>
        )}
        <TableCell>
          <Badge variant={work.status === "PUBLISHED" ? "default" : "secondary"}>
            {work.status === "PUBLISHED" ? "已发布" : "草稿"}
          </Badge>
        </TableCell>
        <TableCell>{formatDate(work.createdAt)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
              <Link href={`/admin/works/${work.id}/edit`}><i className="ri-edit-line" /></Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
              <Link href={`/works/${work.slug}`} target="_blank"><i className="ri-eye-line" /></Link>
            </Button>
            <ConfirmPopover
              title="确定删除该作品？"
              description="删除后不可恢复"
              confirmText="删除"
              onConfirm={() => handleDelete(work.id)}
              align="end"
            >
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0" disabled={deletingId === work.id}>
                <i className={deletingId === work.id ? "ri-loader-4-line animate-spin" : "ri-delete-bin-line"} />
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
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        <Button onClick={createDraft} disabled={creating}>
          {creating ? "创建中…" : "上传作品"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
        <TableToolbar
          searchValue={tc.searchTerm}
          onSearchChange={tc.setSearchTerm}
          searchPlaceholder="搜索作品标题…"
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
                <SortableTableHead column="title" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Work)}>作品</SortableTableHead>
                <SortableTableHead column="category.name" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Work)}>分类</SortableTableHead>
                {workType === "design" && (
                  <SortableTableHead column="price" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Work)}>价格</SortableTableHead>
                )}
                <SortableTableHead column="status" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Work)}>状态</SortableTableHead>
                <SortableTableHead column="createdAt" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Work)}>创建时间</SortableTableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tc.pagedData.length === 0 ? (
                <TableRow><TableCell colSpan={workType === "design" ? 7 : 6} className="text-center text-muted-foreground py-8">无匹配结果</TableCell></TableRow>
              ) : tc.pagedData.map((work) => (
                <TableRow key={work.id}>
                  <TableCell className="w-[40px]"><Checkbox checked={tc.selectedIds.has(work.id)} onCheckedChange={() => tc.toggleSelect(work.id)} /></TableCell>
                  {renderCells(work)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <DndSortProvider items={works} onReorder={handleReorder}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={tc.isAllSelected} onCheckedChange={() => tc.toggleSelectAll()} />
                  </TableHead>
                  <TableHead>作品</TableHead>
                  <TableHead>分类</TableHead>
                  {workType === "design" && <TableHead>价格</TableHead>}
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <SortableTableBody items={works} columnCount={workType === "design" ? 8 : 7} emptyText="暂无作品，点击「上传作品」添加">
                {(work) => (
                  <>
                    <TableCell className="w-[40px]">
                      <Checkbox checked={tc.selectedIds.has(work.id)} onCheckedChange={() => tc.toggleSelect(work.id)} />
                    </TableCell>
                    {renderCells(work)}
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
