"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
}

interface SiteSummary {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationOverviewProps {
  organizationId: string;
}

export function OrganizationOverview({
  organizationId,
}: OrganizationOverviewProps) {
  const [organization, setOrganization] = useState<OrganizationDetail>();
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let isActive = true;

    Promise.all([
      apiRequest<OrganizationDetail>(`/manage/organizations/${organizationId}`),
      apiRequest<SiteSummary[]>(
        `/manage/organizations/${organizationId}/sites`,
      ),
    ])
      .then(([nextOrganization, nextSites]) => {
        if (!isActive) {
          return;
        }

        setOrganization(nextOrganization);
        setSites(nextSites);
        setError(undefined);
      })
      .catch((nextError: unknown) => {
        if (isActive) {
          setError(
            nextError instanceof Error ? nextError.message : "Unable to load.",
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [organizationId]);

  async function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const site = await apiRequest<SiteSummary>(
        `/manage/organizations/${organizationId}/sites`,
        {
          method: "POST",
          body: JSON.stringify({
            name: formData.get("name"),
            slug: formData.get("slug"),
          }),
        },
      );

      form.reset();
      setSites((currentSites) =>
        [...currentSites, site].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      setError(undefined);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to create site.",
      );
    }
  }

  return (
    <>
      <p className="intro">
        {organization
          ? `${organization.name} (${organization.slug})`
          : "Loading organization..."}
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <section aria-label="Organization sites">
        {sites.map((site) => (
          <article key={site.id}>
            <h2>{site.name}</h2>
            <p>{site.slug}</p>
            <Link href={`/dashboard/sites/${site.id}`}>Open site</Link>
          </article>
        ))}
      </section>
      <form className="inline-form" onSubmit={createSite}>
        <h2>Create site</h2>
        <label>
          Site name
          <input name="name" required />
        </label>
        <label>
          Site slug
          <input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
        </label>
        <button type="submit">Create site</button>
      </form>
    </>
  );
}
