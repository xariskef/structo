import Link from "next/link";

interface SwitcherItem {
  href: string;
  label: string;
}

interface ContextSwitcherProps {
  label: string;
  items: SwitcherItem[];
}

export function ContextSwitcher({ label, items }: ContextSwitcherProps) {
  return (
    <nav className="context-switcher" aria-label={label}>
      <p>{label}</p>
      {items.length === 0 ? (
        <span className="empty-switcher">None yet</span>
      ) : (
        items.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))
      )}
    </nav>
  );
}
