import { type NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import EmailProvider from 'next-auth/providers/email'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(process.env.GITHUB_CLIENT_ID
      ? [GitHubProvider({
          clientId:     process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        })]
      : []),
    ...(process.env.EMAIL_SERVER
      ? [EmailProvider({
          server:   process.env.EMAIL_SERVER,
          from:     process.env.EMAIL_FROM ?? 'noreply@astrolog.app',
        })]
      : []),
  ],
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  callbacks: {
    session: async ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
}
