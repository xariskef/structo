"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface SiteDetail {
  name: string;
  slug: string;
  status: string;
}

interface SiteOverviewProps {
  siteId: string;
}

export function SiteOverview({ siteId }: SiteOverviewProps) {
  const [site, setSite] = useState<SiteDetail>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    apiRequest<SiteDetail>(`/manage/sites/${siteId}`)
      .then(setSite)
      .catch((nextError: unknown) => {
        setError(
          nextError instanceof Error ? nextError.message : "Unable to load.",
        );
      });
  }, [siteId]);

  return (
    <>
      <p className="intro">
        {site
          ? `${site.name} (${site.slug}) - ${site.status.toLowerCase()}`
          : "Loading site..."}
      </p>
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}
