const areas = [
  {
    title: "Organization dashboard",
    description:
      "Manage sites, members, activity logs and aggregated insights.",
  },
  {
    title: "Site dashboard",
    description: "Manage settings, content types, entries and delivery access.",
  },
  {
    title: "Platform administration",
    description: "Monitor organizations, users, health and support operations.",
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
          </article>
        ))}
      </section>
    </main>
  );
}
