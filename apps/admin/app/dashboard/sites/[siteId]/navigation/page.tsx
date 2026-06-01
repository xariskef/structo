import { MenuBuilder } from "../../../../components/menu-builder";

interface NavigationPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function NavigationPage({ params }: NavigationPageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Content
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Menus</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build navigation menus from pages, collections and custom links.
        </p>
      </div>
      <MenuBuilder siteId={siteId} />
    </div>
  );
}
