"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { oauth2 } from "@/app/api/Oauth2Service";

export default function OauthPage() {
  const [status, setStatus] = useState<string>("Processing...");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
          setStatus(`OAuth Error: ${error}`);
          return;
        }

        if (!code || !state) {
          setStatus("Missing authorization code or state");
          return;
        }

        setStatus("Exchanging code for tokens...");
        await oauth2().exchangeCodeForToken(code, state);
        
        setStatus("Authentication successful! Redirecting...");
        
        setTimeout(() => {
          router.push("/");
        }, 2000);
        
      } catch (error) {
        console.error("OAuth callback error:", error);
        setStatus(`Failed to process OAuth callback: ${error}`);
      }
    };

    handleOAuthCallback();
  }, [searchParams, router]);

  return (
    <div>
      <h1>OAuth Callback</h1>
      <p>{status}</p>
    </div>
  );
}