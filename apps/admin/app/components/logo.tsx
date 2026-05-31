import { cn } from "@structo/ui/lib/utils";
import Link from "next/link";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  href?: string;
  className?: string;
}

function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="7" fill="#06163D" />
      {/* Top bar — left-anchored, blue */}
      <rect x="7" y="8" width="16" height="5" rx="2.5" fill="#245BFF" />
      {/* Middle bar — shifted right, light blue */}
      <rect x="9" y="13.5" width="16" height="5" rx="2.5" fill="#5B7CFF" />
      {/* Bottom bar — left-anchored, blue */}
      <rect x="7" y="19" width="16" height="5" rx="2.5" fill="#245BFF" />
    </svg>
  );
}

export function Logo({
  size = 28,
  showWordmark = true,
  href = "/",
  className,
}: LogoProps) {
  const content = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoIcon size={size} />
      {showWordmark && (
        <span className="text-sm font-semibold tracking-tight">Structo</span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center outline-none">
        {content}
      </Link>
    );
  }

  return content;
}

export { LogoIcon };
