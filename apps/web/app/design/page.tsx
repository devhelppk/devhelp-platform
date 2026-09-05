import type { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/breadcrumb";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@repo/ui/components/navigation-menu";
import { PageHeader } from "@repo/ui/components/page-header";
import { Progress } from "@repo/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Switch } from "@repo/ui/components/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/tabs";
import { Textarea } from "@repo/ui/components/textarea";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { OverlayDemos } from "./demos";
import { ShellDemo } from "./shell-demo";

export const metadata: Metadata = { title: "Design system" };

const SECTIONS = [
  ["colour", "Colour"],
  ["type", "Type"],
  ["buttons", "Buttons"],
  ["badges", "Badges"],
  ["forms", "Forms"],
  ["cards", "Cards"],
  ["shell", "Shell"],
  ["disclosure", "Disclosure"],
  ["navigation", "Navigation"],
  ["overlays", "Overlays"],
] as const;

const SWATCHES = [
  {
    name: "Ink",
    className: "bg-ink",
    hex: "#141831",
    note: "text, dark ground",
  },
  {
    name: "Indigo",
    className: "bg-brand-600",
    hex: "#313E8C",
    note: "primary",
  },
  {
    name: "Madder",
    className: "bg-madder-600",
    hex: "#B63132",
    note: "accent",
  },
  { name: "Paper", className: "bg-paper", hex: "#FEFDFC", note: "background" },
  {
    name: "Mist",
    className: "bg-muted",
    hex: "#F2F3F8",
    note: "muted surfaces",
  },
  { name: "Line", className: "bg-border", hex: "#DCDEE5", note: "borders" },
];

const RAMPS = [
  {
    name: "brand",
    steps: [
      "bg-brand-50",
      "bg-brand-100",
      "bg-brand-200",
      "bg-brand-300",
      "bg-brand-400",
      "bg-brand-500",
      "bg-brand-600",
      "bg-brand-700",
      "bg-brand-800",
      "bg-brand-900",
      "bg-brand-950",
    ],
  },
  {
    name: "madder",
    steps: [
      "bg-madder-50",
      "bg-madder-100",
      "bg-madder-200",
      "bg-madder-300",
      "bg-madder-400",
      "bg-madder-500",
      "bg-madder-600",
      "bg-madder-700",
      "bg-madder-800",
      "bg-madder-900",
      "bg-madder-950",
    ],
  },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex scroll-mt-6 flex-col gap-6 border-t py-12"
    >
      <div className="flex max-w-prose flex-col gap-1">
        <h2
          id={`${id}-heading`}
          className="font-display text-3xl font-semibold tracking-tight"
        >
          {title}
        </h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TypeSpecimen() {
  return (
    <div className="flex flex-col gap-6">
      <p className="font-display text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
        Learn it properly.
      </p>
      <p className="font-display text-4xl font-semibold tracking-tight">
        Page title, 39px Literata 600
      </p>
      <p className="font-display text-3xl font-semibold tracking-tight">
        Section title, 31px Literata 600
      </p>
      <p className="font-display text-2xl font-medium tracking-tight">
        Sub-section, 25px Literata 500
      </p>
      <p className="text-xl font-semibold">Card title, 20px Geist 600</p>
      <p className="max-w-prose text-lg text-muted-foreground">
        Lead paragraph, 18px Geist. Written so a second-year student in Lahore
        and a mid-level engineer in Karachi both know what to do next.
      </p>
      <p className="max-w-prose">
        Body, 16px Geist. Keep lines under about 70 characters. Meta reads as a
        sentence: 3 sections, 12 pages, about 4 hours.
      </p>
      <p className="text-sm text-muted-foreground">
        UI and meta text, 14px Geist, muted.
      </p>
      <div className="prose-lesson">
        <h2>Reading prose</h2>
        <p>
          Long-form bodies switch to Literata at 17px with generous leading, so
          an hour of reading on a phone is comfortable. Code stays in Geist
          Mono, like <code>const city = "Karachi"</code>, and never decorates a
          label.
        </p>
      </div>
    </div>
  );
}

function CardSamples() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-semibold">
            Your mentor
          </CardTitle>
          <CardDescription>Replies within two working days.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>HR</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <p className="font-medium">Hamza Raza</p>
            <p className="text-muted-foreground">Staff engineer, Karachi</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm">
            Send a message
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-semibold">
            This week
          </CardTitle>
          <CardDescription>Two items done, one to go.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground tabular-nums">2 of 3</span>
            </div>
            <Progress value={67} aria-label="Weekly progress" />
          </div>
          <Separator />
          <p>Write the project brief</p>
          <p>Review pull requests</p>
          <p className="text-muted-foreground">Prepare Friday demo</p>
        </CardContent>
      </Card>
      <Card aria-busy="true" aria-label="Loading">
        <CardHeader className="gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-6 w-3/4" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DesignPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <div className="pt-10 pb-4">
          <PageHeader
            title="The devhelp design system"
            description="Every component in @repo/ui with sample copy, in light and dark. Use the theme toggle in the header, or compare the dark panel in the Cards section."
            actions={
              <Button variant="outline" asChild>
                <a href="https://github.com/devhelp-pk/devhelp-platform/blob/main/packages/ui/DESIGN.md">
                  Read DESIGN.md
                </a>
              </Button>
            }
          />
        </div>
        <nav
          aria-label="Sections"
          className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 py-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex gap-1">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`#${id}`}>{label}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        <Section
          id="colour"
          title="Colour"
          description="Ajrak indigo and madder on paper. Indigo does the work; madder is spent on the wordmark and destructive actions only."
        >
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {SWATCHES.map((s) => (
              <li key={s.name} className="flex flex-col gap-2">
                <div className={`h-16 rounded-md border ${s.className}`} />
                <div className="text-sm">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-muted-foreground">
                    {s.hex}, {s.note}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="grid gap-4 sm:grid-cols-2">
            {RAMPS.map((ramp) => (
              <div key={ramp.name} className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  {ramp.name}-50 to {ramp.name}-950
                </p>
                <div className="flex overflow-hidden rounded-md border">
                  {ramp.steps.map((className) => (
                    <div
                      key={className}
                      className={`h-10 flex-1 ${className}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="type"
          title="Type"
          description="Literata for headings and reading prose, Geist Sans for the interface, Geist Mono for code. A major-third scale from 16px."
        >
          <TypeSpecimen />
        </Section>

        <Section
          id="buttons"
          title="Buttons"
          description="Buttons name the outcome. Primary is indigo; destructive is madder. One primary per view."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button>Save changes</Button>
            <Button variant="secondary">Continue</Button>
            <Button variant="outline">Save for later</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="link">Read the guide</Button>
            <Button variant="destructive">Delete draft</Button>
            <Button disabled>Saving</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">Get started</Button>
            <Button size="sm">Mark as done</Button>
            <Button size="xs">Copy link</Button>
          </div>
        </Section>

        <Section
          id="badges"
          title="Badges"
          description="Rectangular and quiet. Default is indigo, secondary is mist, outline is for neutral facts."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge>New</Badge>
            <Badge variant="secondary">Draft</Badge>
            <Badge variant="outline">Beginner</Badge>
            <Badge variant="outline">Intermediate</Badge>
            <Badge variant="destructive">Unpublished</Badge>
          </div>
        </Section>

        <Section
          id="forms"
          title="Forms"
          description="Labels above fields, help text below, errors that say what to change."
        >
          <form className="grid max-w-2xl gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Ayesha Khan" autoComplete="name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Select>
                <SelectTrigger id="city" className="w-full">
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="karachi">Karachi</SelectItem>
                  <SelectItem value="lahore">Lahore</SelectItem>
                  <SelectItem value="islamabad">Islamabad</SelectItem>
                  <SelectItem value="peshawar">Peshawar</SelectItem>
                  <SelectItem value="other">Somewhere else</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="goal">What do you want out of devhelp?</Label>
              <Textarea
                id="goal"
                placeholder="One or two sentences is plenty."
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                We read these when deciding what to write next.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email-err">Email</Label>
              <Input
                id="email-err"
                defaultValue="ayesha@nust"
                aria-invalid
                aria-describedby="email-err-msg"
              />
              <p id="email-err-msg" className="text-sm text-destructive">
                Add the part after the @, for example ayesha@nust.edu.pk.
              </p>
            </div>
            <div className="flex flex-col gap-4 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox id="weekly" defaultChecked />
                <Label htmlFor="weekly">Email me a weekly digest</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="urdu" />
                <Label htmlFor="urdu">Show Urdu subtitles</Label>
              </div>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <Button type="button">Save profile</Button>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </div>
          </form>
        </Section>

        <Section
          id="cards"
          title="Cards"
          description="Bordered and flat. Skeletons match the shape they replace. The same three cards again on the dark ground."
        >
          <CardSamples />
          <div className="dark rounded-lg bg-background p-4 text-foreground">
            <CardSamples />
          </div>
        </Section>

        <Section
          id="shell"
          title="Shell"
          description="The reading layout: a sidebar of grouped pages with a rail on the current one, a breadcrumb bar, the prose column, and an aside for the page outline. Below lg the sidebar moves behind the panel button."
        >
          <ShellDemo />
        </Section>

        <Section
          id="disclosure"
          title="Disclosure"
          description="Tabs for parallel views, an accordion for questions people ask."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <Tabs defaultValue="notes">
              <TabsList>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="discussion">Discussion</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>
              <TabsContent
                value="notes"
                className="text-sm text-muted-foreground"
              >
                Your notes are private; only you can see them.
              </TabsContent>
              <TabsContent
                value="discussion"
                className="text-sm text-muted-foreground"
              >
                12 people are talking about this page.
              </TabsContent>
              <TabsContent
                value="resources"
                className="text-sm text-muted-foreground"
              >
                Slides, starter repo, and further reading.
              </TabsContent>
            </Tabs>
            <Accordion type="single" collapsible defaultValue="q1">
              <AccordionItem value="q1">
                <AccordionTrigger>Is devhelp really free?</AccordionTrigger>
                <AccordionContent>
                  Yes. Everything on the platform is open source under MIT, with
                  no paywall and no upsell.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>Can I contribute?</AccordionTrigger>
                <AccordionContent>
                  Please do. Fixes, new material and translations all go through
                  pull requests on GitHub.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </Section>

        <Section
          id="navigation"
          title="Navigation"
          description="Breadcrumbs for depth, a navigation menu for the top level."
        >
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/design">Design system</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Navigation</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <NavigationMenu viewport={false}>
            <NavigationMenuList>
              {["Home", "Design", "Community", "About"].map((item) => (
                <NavigationMenuItem key={item}>
                  <NavigationMenuLink
                    asChild
                    className={navigationMenuTriggerStyle()}
                  >
                    <Link href="/design">{item}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </Section>

        <Section
          id="overlays"
          title="Overlays"
          description="The only surfaces that float and cast a shadow: dialog, sheet, menu, tooltip, toast."
        >
          <OverlayDemos />
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}
