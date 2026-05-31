import type { ReactNode } from "react";
import Link from "next/link";

import { DashboardNavigation } from "./dashboard-navigation";

interface DashboardShellProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
}

export function DashboardShell({
  children,
  eyebrow,
  title,
}: DashboardShellProps) {
  return (
    <main className="dashboard-layout">
      <aside>
        <Link className="brand" href="/">
          Structo CMS
        </Link>
        <DashboardNavigation />
      </aside>
      <section className="dashboard-content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
