import { Button } from "@repo/ui/components/button";

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
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-semibold tracking-tight">
          devhelp<span className="text-brand-600">.pk</span>
        </span>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <a href="https://github.com/devhelp-pk">GitHub</a>
          </Button>
          <Button asChild>
            <a href="http://localhost:3001">Start learning</a>
          </Button>
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-6 py-24">
        <p className="font-mono text-sm text-brand-600">
          Pakistan · open source · free forever
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
          Close the gap between the classroom and the industry.
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
          devhelp is a free learning platform for software engineers and
          students in Pakistan. Learn the technical and non-technical skills
          that matter in an AI-driven engineering world.
        </p>
        <div className="flex gap-3">
          <Button size="lg" asChild>
            <a href="http://localhost:3001">Browse courses</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="https://github.com/devhelp-pk/devhelp-platform">
              Contribute
            </a>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 border-t py-16 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="flex flex-col gap-2">
            <h2 className="font-semibold">{p.title}</h2>
            <p className="text-sm text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
