"use client";

import type { AppRouter, inferRouterOutputs } from "@repo/api";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Search, X } from "lucide-react";
import { debounce, parseAsString, useQueryState } from "nuqs";
import type { Route } from "next";
import Link from "next/link";
import { useMemo } from "react";
import {
  companyDetailParams,
  companyTabs,
  type CompanyTab,
} from "@/lib/search-params";
import { Affiliation, Month, Rating, ScoreBar } from "./bits";
import { ClaimDialog } from "./claim-dialog";
import { CompanyReply } from "./company-reply";
import { Distribution } from "./distribution";
import { FlagForm } from "./flag-form";
import { Pay } from "./pay";

/** Sub-scores are withheld below this many reviews (see the page comment). */
const SCORE_BREAKDOWN_MIN = 5;
/** Radix needs a non-empty value, so "any" gets a sentinel rather than "". */
const ANY = "__any";
/** Below this, a filter row is more interface than content. */
const FILTER_MIN = 6;

const outcomeLabels = {
  offer: "Offer",
  rejected: "Rejected",
  withdrew: "Withdrew",
  no_response: "No response",
} as const;
const employmentLabels = {
  current: "Current employee",
  former: "Former employee",
  intern: "Intern",
} as const;
const tenureLabels = {
  under_1: "Under a year",
  "1_2": "1–2 years",
  "3_5": "3–5 years",
  "6_10": "6–10 years",
  over_10: "Over 10 years",
} as const;

type Outputs = inferRouterOutputs<AppRouter>["companies"];
type Review = Outputs["reviews"]["items"][number];
type Interview = Outputs["interviews"]["items"][number];

export type PanelsProps = {
  slug: string;
  signedIn: boolean;
  emailVerified: boolean;
  company: {
    name: string;
    description: string | null;
    website: string | null;
    stack: string[];
    hiresJuniors: boolean | null;
    careersUrl: string | null;
    reviewCount: number;
    interviewCount: number;
    ratingAvg: number | null;
    recommendPct: number | null;
    difficultyAvg: number | null;
    learningAvg: number | null;
    managementAvg: number | null;
    workLifeAvg: number | null;
    compensationAvg: number | null;
    growthAvg: number | null;
  };
  facts: [string, string][];
  reviews: Review[];
  interviews: Interview[];
  salaries: Outputs["salaries"];
  responses: Outputs["responses"];
};

const tabLabels: Record<CompanyTab, string> = {
  overview: "Overview",
  reviews: "Reviews",
  interviews: "Interviews",
  pay: "Pay",
  about: "About",
};

export function CompanyPanels(props: PanelsProps) {
  return <Panels {...props} />;
}

function Panels({
  slug,
  signedIn,
  emailVerified,
  company,
  facts,
  reviews,
  interviews,
  salaries,
  responses,
}: PanelsProps) {
  // The tab is `shallow: false`: the server owns which panel is rendered, so a
  // crawler (and a cold load of a shared link) gets the real panel in the HTML
  // rather than an empty shell that fills in after hydration.
  const [tab, setTab] = useQueryState(
    "tab",
    companyDetailParams.tab.withOptions({ shallow: false }),
  );
  // Filters are `shallow: true`: every review and interview on this page is
  // already loaded, so filtering is a local array operation. Going to the server
  // for it would be a round trip to render data the browser is holding.
  const [role, setRole] = useQueryState(
    "role",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: true, limitUrlUpdates: debounce(300) }),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("").withOptions({ shallow: true }),
  );
  const [outcome, setOutcome] = useQueryState(
    "outcome",
    parseAsString.withDefault("").withOptions({ shallow: true }),
  );

  const replyTo = (type: string, id: string) =>
    responses.find((r) => r.subjectType === type && r.subjectId === id);

  const roleMatch = (text: string | null) =>
    !role || (text ?? "").toLowerCase().includes(role.toLowerCase());
  const shownReviews = useMemo(
    () =>
      reviews.filter(
        (r) =>
          roleMatch(r.roleText) && (!status || r.employmentStatus === status),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviews, role, status],
  );
  const shownInterviews = useMemo(
    () =>
      interviews.filter(
        (i) => roleMatch(i.roleText) && (!outcome || i.outcome === outcome),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interviews, role, outcome],
  );

  const counts: Record<CompanyTab, number | null> = {
    overview: null,
    reviews: company.reviewCount,
    interviews: company.interviewCount,
    pay: salaries.roles.length,
    about: null,
  };

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Company sections"
        className="sticky top-[57px] z-30 -mx-4 [scrollbar-width:none] overflow-x-auto border-b bg-background/85 px-4 backdrop-blur sm:-mx-6 sm:px-6"
      >
        <ul className="flex min-w-max gap-1">
          {companyTabs.map((t) => {
            const active = tab === t;
            return (
              <li key={t}>
                {/* A real href so this is crawlable and middle-clickable; the
                    click is intercepted so switching panels does not cost a
                    full navigation. */}
                <a
                  href={`?tab=${t}`}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)
                      return;
                    e.preventDefault();
                    void setTab(t);
                  }}
                  className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                    active
                      ? "border-brand-600 font-medium dark:border-brand-400"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tabLabels[t]}
                  {counts[t] !== null ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {counts[t]}
                    </span>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "overview" ? (
        <Overview
          company={company}
          reviews={reviews}
          interviews={interviews}
          onOpen={setTab}
        />
      ) : null}

      {tab === "reviews" ? (
        <section className="flex flex-col gap-4">
          {company.reviewCount >= SCORE_BREAKDOWN_MIN ? (
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <ScoreBar label="Learning" value={company.learningAvg} />
              <ScoreBar label="Management" value={company.managementAvg} />
              <ScoreBar label="Work / life" value={company.workLifeAvg} />
              <ScoreBar label="Compensation" value={company.compensationAvg} />
              <ScoreBar label="Growth" value={company.growthAvg} />
            </div>
          ) : company.reviewCount > 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Scores for learning, management, work/life, pay and growth appear
              once {SCORE_BREAKDOWN_MIN} people have reviewed {company.name}.
              With {company.reviewCount}, a single review would move each one
              too far to mean anything.
            </p>
          ) : null}
          {reviews.length >= FILTER_MIN ? (
            <Filters
              role={role}
              setRole={setRole}
              choice={{
                value: status,
                set: setStatus,
                label: "Status",
                options: Object.entries(employmentLabels),
              }}
              shown={shownReviews.length}
              total={reviews.length}
              noun="review"
              onClear={() => void Promise.all([setRole(""), setStatus("")])}
            />
          ) : null}
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody has reviewed {company.name} yet. If you have worked here,{" "}
              <Link
                href={`/companies/${slug}/contribute` as Route}
                className="underline underline-offset-4"
              >
                you can be the first
              </Link>
              .
            </p>
          ) : shownReviews.length === 0 ? (
            <Empty
              onClear={() => void Promise.all([setRole(""), setStatus("")])}
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {shownReviews.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Rating value={r.rating} />
                    <Badge variant="outline" className="text-xs">
                      {employmentLabels[r.employmentStatus]}
                    </Badge>
                    {r.roleText ? (
                      <span className="text-sm text-muted-foreground">
                        {r.roleText}
                      </span>
                    ) : null}
                    {r.tenure ? (
                      <span className="text-xs text-muted-foreground">
                        {tenureLabels[r.tenure]}
                      </span>
                    ) : null}
                    <Affiliation value={r.affiliation} />
                    <span className="w-full sm:ml-auto sm:w-auto">
                      <Month value={r.createdMonth} />
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Pros" value={r.pros} />
                    <Field label="Cons" value={r.cons} />
                  </div>
                  {r.advice ? <Field label="Advice" value={r.advice} /> : null}
                  <CompanyReply
                    reply={replyTo("company_review", r.id)}
                    companyName={company.name}
                  />
                  <FlagForm
                    subjectType="company_review"
                    subjectId={r.id}
                    slug={slug}
                    signedIn={signedIn}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "interviews" ? (
        <section className="flex flex-col gap-4">
          {interviews.length >= FILTER_MIN ? (
            <Filters
              role={role}
              setRole={setRole}
              choice={{
                value: outcome,
                set: setOutcome,
                label: "Outcome",
                options: Object.entries(outcomeLabels),
              }}
              shown={shownInterviews.length}
              total={interviews.length}
              noun="interview"
              onClear={() => void Promise.all([setRole(""), setOutcome("")])}
            />
          ) : null}
          {interviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No interview experiences yet.
            </p>
          ) : shownInterviews.length === 0 ? (
            <Empty
              onClear={() => void Promise.all([setRole(""), setOutcome("")])}
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {shownInterviews.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-col gap-2 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">
                      {i.roleText ?? "Interview"}
                      {i.level ? ` · ${i.level}` : ""}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {outcomeLabels[i.outcome]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Difficulty {i.difficulty}/5
                    </span>
                    <Affiliation value={i.affiliation} />
                    <span className="w-full sm:ml-auto sm:w-auto">
                      <Month value={i.yearMonth} />
                    </span>
                  </div>
                  <ol className="flex flex-col gap-1 text-sm">
                    {i.rounds.map((round, n) => (
                      <li key={n} className="flex gap-2">
                        <span className="text-muted-foreground tabular-nums">
                          {n + 1}.
                        </span>
                        <span>
                          <span className="capitalize">
                            {round.type.replace(/_/g, " ")}
                          </span>
                          {" — "}
                          {round.description}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {i.questions ? (
                    <Field label="Questions asked" value={i.questions} />
                  ) : null}
                  {i.advice ? <Field label="Advice" value={i.advice} /> : null}
                  <CompanyReply
                    reply={replyTo("interview_experience", i.id)}
                    companyName={company.name}
                  />
                  <FlagForm
                    subjectType="interview_experience"
                    subjectId={i.id}
                    slug={slug}
                    signedIn={signedIn}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "pay" ? (
        <Pay
          roles={salaries.roles}
          detail={salaries.detail}
          fx={salaries.fx}
          companyName={company.name}
          slug={slug}
          signedIn={signedIn}
        />
      ) : null}

      {tab === "about" ? (
        <About
          company={company}
          facts={facts}
          slug={slug}
          signedIn={signedIn}
          emailVerified={emailVerified}
        />
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function Empty({ onClear }: { onClear: () => void }) {
  return (
    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      Nothing matches those filters.{" "}
      <button
        type="button"
        onClick={onClear}
        className="underline underline-offset-4"
      >
        Clear them
      </button>
      .
    </p>
  );
}

function Filters({
  role,
  setRole,
  choice,
  shown,
  total,
  noun,
  onClear,
}: {
  role: string;
  setRole: (v: string) => void;
  choice: {
    value: string;
    set: (v: string) => void;
    label: string;
    options: [string, string][];
  };
  shown: number;
  total: number;
  noun: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          defaultValue={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Filter by role"
          aria-label="Filter by role"
          className="h-9 w-full rounded-md border bg-transparent pr-3 pl-8 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      {/* Radix, not a native `<select>`: the OS draws a native option list and
          does not theme it, which in dark mode put light text on a white popup. */}
      <UiSelect
        value={choice.value || ANY}
        onValueChange={(v) => choice.set(v === ANY ? "" : v)}
      >
        <SelectTrigger aria-label={choice.label}>
          <SelectValue placeholder={`${choice.label}: any`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{choice.label}: any</SelectItem>
          {choice.options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </UiSelect>
      <span className="text-xs text-muted-foreground tabular-nums">
        {shown} of {total} {noun}
        {total === 1 ? "" : "s"}
      </span>
      {/* Icon-only, and only once there is something to clear: a permanent
          "Clear filters" button is a word of chrome for a state most readers
          are never in. */}
      {role || choice.value ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          aria-label="Clear filters"
          title="Clear filters"
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

/** Below this, a distribution is noise: five bars drawn from two data points. */
const DISTRIBUTION_MIN = 5;

function Overview({
  company,
  reviews,
  interviews,
  onOpen,
}: {
  company: PanelsProps["company"];
  reviews: Review[];
  interviews: Interview[];
  onOpen: (t: CompanyTab) => void;
}) {
  // Distributions are computed from the rows on the page, so they are honest
  // only when the page holds every row — above the page size they would
  // describe the first page rather than the company. And below a handful of
  // rows they are not worth drawing at all: five bars off two reviews is a
  // picture of nothing. Same judgement as withholding the sub-scores.
  const showRatings =
    reviews.length === company.reviewCount &&
    company.reviewCount >= DISTRIBUTION_MIN;
  const showDifficulty =
    interviews.length === company.interviewCount &&
    company.interviewCount >= DISTRIBUTION_MIN;
  const latestReview = reviews[0];
  const latestInterview = interviews[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showRatings ? (
        <Distribution
          title="How reviews rate it"
          caption={`${company.reviewCount} reviews`}
          bins={[5, 4, 3, 2, 1].map((star) => ({
            label: `${star}★`,
            value: reviews.filter((r) => Math.round(r.rating) === star).length,
          }))}
          onOpen={() => onOpen("reviews")}
          openLabel="Read the reviews"
        />
      ) : latestReview ? (
        <Preview
          title="Latest review"
          caption={`${latestReview.roleText ?? "Anonymous"} · ${latestReview.createdMonth}`}
          rating={latestReview.rating}
          body={latestReview.pros}
          onOpen={() => onOpen("reviews")}
          openLabel={
            company.reviewCount === 1
              ? "Read it in full"
              : `Read all ${company.reviewCount} reviews`
          }
        />
      ) : null}
      {showDifficulty ? (
        <Distribution
          title="Interview difficulty"
          caption={
            company.difficultyAvg !== null
              ? `${company.difficultyAvg.toFixed(1)} out of 5 on average`
              : undefined
          }
          bins={[1, 2, 3, 4, 5].map((d) => ({
            label: `${d}`,
            value: interviews.filter((i) => i.difficulty === d).length,
          }))}
          onOpen={() => onOpen("interviews")}
          openLabel="Read the interviews"
        />
      ) : latestInterview ? (
        <Preview
          title="Latest interview"
          caption={`${latestInterview.roleText ?? "Interview"} · difficulty ${latestInterview.difficulty}/5 · ${latestInterview.yearMonth}`}
          body={
            latestInterview.rounds[0]?.description ??
            latestInterview.advice ??
            ""
          }
          onOpen={() => onOpen("interviews")}
          openLabel={
            company.interviewCount === 1
              ? "Read it in full"
              : `Read all ${company.interviewCount} interviews`
          }
        />
      ) : null}
      {company.description ? (
        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:col-span-2">
          <p className="max-w-prose text-sm">{company.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {company.hiresJuniors ? (
              <Badge variant="secondary">Hires juniors</Badge>
            ) : null}
            {company.stack.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** What a distribution is replaced by when there is not enough to plot. */
function Preview({
  title,
  caption,
  rating,
  body,
  onOpen,
  openLabel,
}: {
  title: string;
  caption: string;
  rating?: number;
  body: string;
  onOpen: () => void;
  openLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{caption}</span>
      </div>
      {rating !== undefined ? <Rating value={rating} /> : null}
      <p className="line-clamp-3 text-sm text-muted-foreground">{body}</p>
      <button
        type="button"
        onClick={onOpen}
        className="self-start text-xs underline underline-offset-4 hover:no-underline"
      >
        {openLabel}
      </button>
    </div>
  );
}

function About({
  company,
  facts,
  slug,
  signedIn,
  emailVerified,
}: {
  company: PanelsProps["company"];
  facts: [string, string][];
  slug: string;
  signedIn: boolean;
  emailVerified: boolean;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-4 rounded-lg border p-4 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {company.website ? (
        <a
          href={company.website}
          rel="nofollow noopener"
          target="_blank"
          className="break-all underline underline-offset-4"
        >
          {company.website.replace(/^https?:\/\//, "")}
        </a>
      ) : null}
      {company.careersUrl ? (
        <a
          href={company.careersUrl}
          rel="nofollow noopener"
          target="_blank"
          className="break-all underline underline-offset-4"
        >
          Careers at {company.name}
        </a>
      ) : null}
      {/* The claim flow (S13) is for someone who works at the company, which is
          a tiny fraction of this page's readers. It belongs here, as a sentence,
          not as a third button beside the one action a learner came to take. */}
      <p className="text-xs text-muted-foreground">
        Work at {company.name}?{" "}
        <ClaimDialog
          slug={slug}
          companyName={company.name}
          signedIn={signedIn}
          emailVerified={emailVerified}
        />{" "}
        to reply to what is written here.
      </p>
      <p className="text-xs text-muted-foreground">
        Facts are checked by the devhelp team against public sources. Reviews
        and interviews are contributed by learners and published after review.
        Nothing here identifies its author.
      </p>
    </div>
  );
}
