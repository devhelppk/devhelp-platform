import Link from "next/link";
import { clientEnv } from "@repo/env/client";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { Button } from "@repo/ui/components/button";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";

const PILLARS = [
  {
    title: "Technical skills",
    body: "Modern web, backend, and AI engineering taught the way industry actually works in 2026.",
  },
  {
    title: "Career skills",
    body: "Communication, interviews, freelancing, and working with global teams from Pakistan.",
  },
  {
    title: "Free and open source",
    body: "Every course, every line of code. Built in public by the community, for the community.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <BrandLogo />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/design">Design</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="https://github.com/devhelppk">GitHub</a>
          </Button>
          <ThemeToggle />
          <Button size="sm" asChild>
            <a href={clientEnv.NEXT_PUBLIC_LMS_URL}>Start learning</a>
          </Button>
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-6 py-24">
        <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Close the gap between the classroom and the industry.
        </h1>
        <p className="max-w-prose text-lg text-pretty text-muted-foreground">
          devhelp is a free learning platform for software engineers and
          students in Pakistan. Learn the technical and non-technical skills
          that matter in an AI-driven engineering world.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <a href={clientEnv.NEXT_PUBLIC_LMS_URL}>Browse courses</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="https://github.com/devhelppk/devhelp-platform">
              Contribute
            </a>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 border-t py-16 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-semibold">{p.title}</h2>
            <p className="text-sm text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
