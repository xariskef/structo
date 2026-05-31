const areas = [
  {
    title: "Create workspace",
    description:
      "Register as an owner and create your first organization automatically.",
    href: "/register",
  },
  {
    title: "Administration dashboard",
    description: "Log in to switch between your organizations and sites.",
    href: "/login",
  },
  {
    title: "Platform administration",
    description: "Monitor organizations, users, health and support operations.",
    href: "#",
  },
];

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Structo CMS</p>
      <h1>A clean foundation for structured content.</h1>
      <p className="intro">
        The administration shell is ready for identity, tenancy and site
        management work.
      </p>

      <section aria-label="Administration areas">
        {areas.map((area) => (
          <article key={area.title}>
            <h2>{area.title}</h2>
            <p>{area.description}</p>
            {area.href === "#" ? (
              <span>Added in a later milestone</span>
            ) : (
              <Link href={area.href}>Open area</Link>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
import Link from "next/link";
