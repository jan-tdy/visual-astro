import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { JdConverter } from "@/components/tools/JdConverter";
import { Seo } from "@/components/app/Seo";

/**
 * Public landing page for the Julian Date converter. Deliberately outside
 * the authenticated app shell so it can be crawled and indexed.
 */
export default function JulianDateConverterPage() {
  const faq = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Julian Date Converter",
    applicationCategory: "Astronomy",
    operatingSystem: "Any (web browser)",
    url: "https://japysoft.bombol.space/julian-date-converter",
    description:
      "Free online Julian Date converter: convert a calendar date and UT time to Julian Date (JD) and convert JD back to a calendar date.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Julian Date Converter — JD to calendar date"
        description="Free Julian Date converter for astronomers: turn a calendar date and UT time into a Julian Date (JD), or convert a JD back to a calendar date and UT."
        path="/julian-date-converter"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faq)}</script>
      </Helmet>

      <header className="border-b border-border">
        <div className="container mx-auto px-4 max-w-3xl py-4 flex items-center justify-between gap-4">
          <Link to="/info" className="font-semibold text-primary">
            Visual Astro
          </Link>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/info">About Visual Astro</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-3xl py-10 space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Julian Date converter
          </h1>
          <p className="text-muted-foreground">
            Convert a calendar date and UT time to a Julian Date (JD), or convert a JD back
            to a calendar date and UT. Julian Dates are the standard continuous day count
            used in astronomy for timing variable-star estimates, eclipse minima and other
            observations.
          </p>
        </div>

        <JdConverter />

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What is a Julian Date?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A Julian Date is the number of days elapsed since noon UT on 1 January 4713 BC in
            the Julian proleptic calendar. Because it is a single continuous number, it makes
            time differences between observations trivial to compute — no months, leap years
            or time zones to account for. Astronomers usually quote JD to four or five decimal
            places, where 0.00001 day is about one second.
          </p>
          <h2 className="text-xl font-semibold">Using JD in an observing log</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Visual Astro computes the Julian Date for every visual estimate you record and
            includes it in VSNET and AAVSO exports, so your observations are timed the way
            variable-star databases expect.
          </p>
          <Button asChild className="rounded-full">
            <Link to="/info">See the full observing logbook</Link>
          </Button>
        </section>
      </main>
    </div>
  );
}
