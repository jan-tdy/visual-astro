import { Helmet } from "react-helmet-async";

const SITE_URL = "https://japysoft.bombol.space";

interface SeoProps {
  /** Page-specific title, without the brand suffix. */
  title: string;
  description: string;
  /** Route path, e.g. "/tools". Used for canonical and og:url. */
  path: string;
  noindex?: boolean;
}

/**
 * Per-route head metadata. The static tags in index.html stay as the
 * fallback for social crawlers that do not execute JavaScript.
 */
export function Seo({ title, description, path, noindex }: SeoProps) {
  const fullTitle = `${title} — Visual Astro`;
  const url = `${SITE_URL}${path}`;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {noindex && <meta name="robots" content="noindex, follow" />}
    </Helmet>
  );
}
