"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@structo/ui/lib/utils";

interface NavLinkProps extends ComponentPropsWithoutRef<typeof Link> {
  exact?: boolean;
}

export function NavLink({
  href,
  exact = false,
  className,
  children,
  ...props
}: NavLinkProps) {
  const pathname = usePathname();
  const hrefStr = href.toString();
  const isActive = exact
    ? pathname === hrefStr
    : pathname === hrefStr || pathname.startsWith(hrefStr + "/");

  return (
    <Link
      href={href}
      data-active={isActive}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        isActive && "bg-sidebar-accent text-sidebar-foreground font-medium",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
