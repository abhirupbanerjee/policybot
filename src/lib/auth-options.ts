import { NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';

const ALLOWED_DOMAINS = ['abhirup.app', 'gov.gd'];

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
      tenantId: process.env.AZURE_AD_TENANT_ID || '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (process.env.AUTH_DISABLED === 'true') {
        return true;
      }

      const email = user.email || '';
      const domain = email.split('@')[1];

      if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
        return false;
      }

      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};
