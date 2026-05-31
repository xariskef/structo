import Link from "next/link";

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
    href: null,
  },
];

export default function HomePage() {
  return (
    <main className="home-main">
      <p className="eyebrow">Structo CMS</p>
      <h1>A clean foundation for structured content.</h1>
      <p className="intro">
        The administration shell is ready for identity, tenancy and site
        management.
      </p>

      <div className="home-grid" role="list">
        {areas.map((area) => (
          <div key={area.title} className="home-card" role="listitem">
            <h2>{area.title}</h2>
            <p>{area.description}</p>
            {area.href ? (
              <Link href={area.href}>Open →</Link>
            ) : (
              <span style={{ color: "#9db6ae", fontSize: "0.85rem" }}>
                Coming in a later milestone
              </span>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
