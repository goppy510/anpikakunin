// src/app/lib/env.ts
export const env = {
  NEXT_PUBLIC_OAUTH_REDIRECT_URI:
    process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ??
    (() => {
      throw new Error("NEXT_PUBLIC_OAUTH_REDIRECT_URI is not defined");
    })(),
};
