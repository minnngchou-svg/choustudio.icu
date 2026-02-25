/** NextAuth 配置：Credentials 邮箱+密码，与 User 表校验。 */
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "./prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string)?.trim?.()
        const password = (credentials?.password as string)?.trim?.()
        if (!email || !password) {
          return null
        }
        let user
        try {
          user = await prisma.user.findUnique({
            where: { email },
          })
        } catch (e) {
          console.error("[auth] DB 查询失败:", e)
          return null
        }
        if (!user) {
          return null
        }
        const isPasswordValid = await bcrypt.compare(password, user.password)
        if (!isPasswordValid) {
          return null
        }
        if (user.disabled) {
          console.error("[auth] 账号已被禁用:", user.id)
          throw new Error("账号已被禁用")
        }
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
        } catch {
          // Ignore update error
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
          nickname: user.nickname,
        }
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        const userRole = (user as { role?: string }).role
        if (!userRole) {
          console.error("[auth] 用户角色缺失，拒绝登录:", user.id)
          return null
        }
        token.role = userRole
        token.nickname = (user as { nickname?: string }).nickname
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as { role?: string }).role = token.role as string
        ;(session.user as { nickname?: string }).nickname = token.nickname as string | undefined
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
  },
})
