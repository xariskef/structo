import type { ReactNode } from "react";

import { SiteSidebarNav } from "../../../components/site-sidebar";

interface SiteLayoutProps {
  children: ReactNode;
  params: Promise<{ siteId: string }>;
}

export default async function SiteLayout({ children, params }: SiteLayoutProps) {
  const { siteId } = await params;

  return (
    <div className="flex h-screen bg-background">
      <SiteSidebarNav siteId={siteId} />
      <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
