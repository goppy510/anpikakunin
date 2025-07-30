// src/app/lib/env.ts
export const env = {
  NEXT_PUBLIC_OAUTH_REDIRECT_URI:
    process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ?? "http://localhost:3000/oauth",
};
