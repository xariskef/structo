"use client";

import { Button } from "@structo/ui/components/button";
import { Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { apiRequest } from "../lib/api";
import { PlatformSidebarNav } from "./platform-sidebar";

type Access = "loading" | "granted" | "denied";

/**
 * Client guard for the operator console. Platform access is verified against
 * the API; tenant users are shown an access-denied screen. The API still
 * enforces access on every /platform request — this is presentation only.
 */
export function PlatformShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [access, setAccess] = useState<Access>("loading");

  useEffect(() => {
    void apiRequest<{ platformOperator: { role: string } | null }>(
      "/manage/auth/me",
    )
      .then((me) => setAccess(me.platformOperator ? "granted" : "denied"))
      .catch(() => setAccess("denied"));
  }, []);

  if (access === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-muted/40 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Operator access required</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            The platform operator console is restricted to Structo platform
            operators.
          </p>
        </div>
        <Button type="button" onClick={() => router.push("/dashboard")}>
          Back to your dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <PlatformSidebarNav />
      <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
