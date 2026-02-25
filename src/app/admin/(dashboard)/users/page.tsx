"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type User = {
  id: string
  email: string
  name: string | null
  nickname: string | null
  avatar: string | null
  role: string
  memberLevel: number
  disabled: boolean
  lastLoginAt: string | null
  createdAt: string
  _count: {
    orders: number
    accountOrders: number
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    name: "",
    nickname: "",
    role: "USER",
  })
  const [creating, setCreating] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        ...(roleFilter !== "all" && { role: roleFilter }),
        ...(search && { search }),
      })
      const res = await fetch(`/api/admin/users?${params}`, {
        credentials: "include",
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setTotalPages(data.totalPages)
      }
    } finally {
      setLoading(false)
    }
  }, [page, roleFilter, search])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function handleCreate() {
    if (!createForm.email || !createForm.password) {
      toast.error("邮箱和密码必填")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("创建成功")
        setShowCreateForm(false)
        setCreateForm({
          email: "",
          password: "",
          name: "",
          nickname: "",
          role: "USER",
        })
        loadUsers()
      } else {
        toast.error(data.error || "创建失败")
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleDisabled(user: User) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ disabled: !user.disabled }),
      })
      if (res.ok) {
        toast.success(user.disabled ? "已启用" : "已禁用")
        loadUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || "操作失败")
      }
    } catch {
      toast.error("操作失败")
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`确定要删除用户 ${user.email} 吗？此操作不可恢复。`)) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (res.ok) {
        toast.success("删除成功")
        loadUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || "删除失败")
      }
    } catch {
      toast.error("删除失败")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">用户管理</h1>
          <p className="text-muted-foreground mt-1">查看和管理所有用户</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "取消" : "添加用户"}
        </Button>
      </div>

      {showCreateForm && (
        <div className="p-4 border rounded-lg bg-card space-y-4">
          <h2 className="font-semibold">创建新用户</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>邮箱 *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label>密码 *</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm({ ...createForm, password: e.target.value })
                }
                placeholder="至少6位"
              />
            </div>
            <div>
              <Label>姓名</Label>
              <Input
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="真实姓名"
              />
            </div>
            <div>
              <Label>昵称</Label>
              <Input
                value={createForm.nickname}
                onChange={(e) =>
                  setCreateForm({ ...createForm, nickname: e.target.value })
                }
                placeholder="显示昵称"
              />
            </div>
            <div>
              <Label>角色</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) =>
                  setCreateForm({ ...createForm, role: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">普通用户</SelectItem>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                  <SelectItem value="VIEWER">访客</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "创建中..." : "创建用户"}
          </Button>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
        <div className="flex gap-4 mb-4">
          <Input
            placeholder="搜索邮箱、姓名、昵称..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="max-w-xs"
          />
          <Select
            value={roleFilter}
            onValueChange={(v) => {
              setRoleFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部角色</SelectItem>
              <SelectItem value="USER">普通用户</SelectItem>
              <SelectItem value="ADMIN">管理员</SelectItem>
              <SelectItem value="VIEWER">访客</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">暂无用户</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>邮箱</TableHead>
                  <TableHead>昵称/姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>订单</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.nickname || user.name || "-"}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          user.role === "ADMIN"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : user.role === "VIEWER"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {user.role === "ADMIN"
                          ? "管理员"
                          : user.role === "VIEWER"
                          ? "访客"
                          : "用户"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user._count.orders + user._count.accountOrders}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          user.disabled
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {user.disabled ? "已禁用" : "正常"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString("zh-CN")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleDisabled(user)}
                        >
                          {user.disabled ? "启用" : "禁用"}
                        </Button>
                        {user.role !== "ADMIN" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(user)}
                          >
                            删除
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </Button>
                <span className="py-2 px-3 text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
