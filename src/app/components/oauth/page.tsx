"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function OauthPageContent() {
  const [status, setStatus] = useState<string>("Processing...");
  const searchParams = useSearchParams();

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

        // TODO: Exchange code for tokens using your OAuth2Service
        setStatus("OAuth callback received successfully!");
        console.log("Authorization code:", code);
        console.log("State:", state);
        
      } catch (error) {
        console.error("OAuth callback error:", error);
        setStatus("Failed to process OAuth callback");
      }
    };

    handleOAuthCallback();
  }, [searchParams]);

  return (
    <div>
      <h1>OAuth Callback</h1>
      <p>{status}</p>
    </div>
  );
}

export default function OauthPage() {
  return (
    <Suspense fallback={<div>Loading OAuth callback...</div>}>
      <OauthPageContent />
    </Suspense>
  );
}
