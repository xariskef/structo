import type { ReactNode } from "react";

import { OrgSidebarNav } from "../../../components/org-sidebar";

interface OrgLayoutProps {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { organizationId } = await params;

  return (
    <div className="flex h-screen bg-background">
      <OrgSidebarNav organizationId={organizationId} />
      <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
