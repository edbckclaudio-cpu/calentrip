import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const providers: Array<ReturnType<typeof Google> | ReturnType<typeof Credentials>> = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

providers.push(
  Credentials({
    name: "Credenciais",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    authorize: async (credentials) => {
      const email = credentials?.email as string | undefined;
      const password = credentials?.password as string | undefined;
      if (email && password && password.length >= 4) {
        return { id: email, name: email, email };
      }
      return null;
    },
  })
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET ?? "dev-secret",
  pages: { signIn: "/login" },
});
