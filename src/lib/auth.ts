import { type NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { prisma } from './prisma'

// Escopos do Google: login + leitura de metadados do Drive (para vincular arquivos).
// access_type=offline + prompt=consent garantem o refresh_token (renovação do acesso).
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
].join(' ')

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:        GOOGLE_SCOPES,
          access_type:  'offline',
          prompt:       'consent',
        },
      },
    }),
    GitHubProvider({
      clientId:     process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  callbacks: {
    // Sessão database não atualiza os tokens em re-logins; persistimos manualmente
    // para manter o scope do Drive e o refresh_token sempre atuais.
    signIn: async ({ account }) => {
      if (account?.provider === 'google' && account.refresh_token) {
        await prisma.account.updateMany({
          where: { provider: 'google', providerAccountId: account.providerAccountId },
          data: {
            access_token:  account.access_token,
            refresh_token: account.refresh_token,
            expires_at:    account.expires_at,
            scope:         account.scope,
            token_type:    account.token_type,
            id_token:      account.id_token,
          },
        })
      }
      return true
    },
    session: async ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
}
