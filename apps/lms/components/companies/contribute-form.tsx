"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ResendVerification } from "@/components/account/resend-verification";
import { SALARY_LEVELS, type SalaryLevel } from "@repo/api/levels";
import { useTRPC } from "@/lib/trpc/client";

type Role = { id: string; slug: string; name: string };
type City = { id: string; slug: string; name: string };

const ROUND_TYPES = [
  "phone_screen",
  "technical",
  "system_design",
  "take_home",
  "pair_programming",
  "behavioural",
  "managerial",
  "hr",
  "other",
] as const;

const SUBSCORES = [
  ["learning", "Learning and mentorship"],
  ["management", "Management"],
  ["workLife", "Work / life balance"],
  ["compensation", "Compensation"],
  ["growth", "Growth"],
] as const;

/**
 * Write a review or add an interview experience. Both land pending; the page
 * says so plainly, because a contributor who does not see their words appear
 * assumes they were lost.
 */
export function ContributeForm({
  slug,
  companyName,
  emailVerified,
  roles,
  cities,
}: {
  slug: string;
  companyName: string;
  emailVerified: boolean;
  roles: Role[];
  cities: City[];
}) {
  const trpc = useTRPC();
  const [tab, setTab] = useState<"review" | "interview" | "salary">("review");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [rounds, setRounds] = useState([
    { type: "technical", description: "" },
  ]);
  const onError = (e: { message: string }) => setError(e.message);
  const onSuccess = () => {
    setError(null);
    setDone(true);
  };
  const review = useMutation(
    trpc.contributions.submitReview.mutationOptions({ onSuccess, onError }),
  );
  const interview = useMutation(
    trpc.contributions.submitInterview.mutationOptions({ onSuccess, onError }),
  );
  const salary = useMutation(
    trpc.contributions.submitSalary.mutationOptions({ onSuccess, onError }),
  );

  if (!emailVerified)
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm">
          Verify your email before contributing. It is the only thing standing
          between this directory and spam.
        </p>
        <ResendVerification />
      </div>
    );
  if (done)
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm">
          {tab === "salary"
            ? "Thank you. Your figure already counts towards this company's aggregates, and it will never be shown on its own: a role appears only once five or more people have reported it. An administrator checks it in due course."
            : "Thank you. An administrator reads every contribution before it is published, usually within a couple of days. Nothing you wrote is shown with your name."}
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/companies/${slug}` as Route}>
              Back to {companyName}
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/account/contributions">Your contributions</Link>
          </Button>
        </div>
      </div>
    );

  function submitReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    const n = (k: string) => {
      const v = str(k);
      return v ? Number(v) : undefined;
    };
    review.mutate({
      slug,
      rating: n("rating") ?? 3,
      learning: n("learning"),
      management: n("management"),
      workLife: n("workLife"),
      compensation: n("compensation"),
      growth: n("growth"),
      roleId: str("roleId"),
      roleText: roles.find((r) => r.id === str("roleId"))?.name,
      employmentStatus: (str("employmentStatus") ?? "current") as "current",
      tenure: str("tenure") as undefined,
      cityId: str("cityId"),
      pros: str("pros") ?? "",
      cons: str("cons") ?? "",
      advice: str("advice"),
      // Undefined, not false: an unanswered question must stay unanswered, or
      // it drags the "would recommend" percentage down for everyone.
      wouldRecommend: str("wouldRecommend")
        ? str("wouldRecommend") === "yes"
        : undefined,
    });
  }

  function submitInterview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    interview.mutate({
      slug,
      roleId: str("roleId"),
      roleText: roles.find((r) => r.id === str("roleId"))?.name,
      level: str("level"),
      yearMonth: str("yearMonth") ?? "",
      source: (str("source") ?? "direct") as "direct",
      rounds: rounds
        .filter((r) => r.description.trim().length >= 3)
        .map((r) => ({
          type: r.type as "technical",
          description: r.description.trim(),
        })),
      difficulty: Number(str("difficulty") ?? 3),
      durationDays: str("durationDays")
        ? Number(str("durationDays"))
        : undefined,
      outcome: (str("outcome") ?? "offer") as "offer",
      questions: str("questions"),
      advice: str("advice"),
    });
  }

  function submitSalary(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    salary.mutate({
      slug,
      roleId: str("roleId") ?? "",
      level: str("level") as SalaryLevel | undefined,
      yearsExperience: str("yearsExperience")
        ? Number(str("yearsExperience"))
        : undefined,
      cityId: str("cityId"),
      employmentType: (str("employmentType") ?? "full_time") as "full_time",
      amount: Number(str("amount") ?? 0),
      currency: (str("currency") ?? "PKR") as "PKR",
      period: (str("period") ?? "monthly") as "monthly",
      hasBonus: f.get("hasBonus") === "1",
      hasEquity: f.get("hasEquity") === "1",
      isRemote: f.get("isRemote") === "1",
      year: Number(str("year") ?? new Date().getFullYear()),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 rounded-lg border p-1" role="tablist">
        {(
          [
            ["review", "Write a review"],
            ["interview", "Add an interview"],
            ["salary", "Add your pay"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              setTab(value);
              setError(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === value
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "review" ? (
        <form onSubmit={submitReview} className="flex flex-col gap-4">
          <Scale name="rating" label="Overall" required />
          <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">
              Optional detail
            </legend>
            {SUBSCORES.map(([name, label]) => (
              <Scale key={name} name={name} label={label} />
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select name="roleId" label="Your role" options={roles} />
            <Select name="cityId" label="City" options={cities} />
            <Select
              name="employmentStatus"
              label="You are"
              required
              options={[
                { id: "current", name: "A current employee" },
                { id: "former", name: "A former employee" },
                { id: "intern", name: "An intern" },
              ]}
            />
            <Select
              name="tenure"
              label="How long"
              options={[
                { id: "under_1", name: "Under a year" },
                { id: "1_2", name: "1–2 years" },
                { id: "3_5", name: "3–5 years" },
                { id: "6_10", name: "6–10 years" },
                { id: "over_10", name: "Over 10 years" },
              ]}
            />
          </div>
          <Field
            name="pros"
            label="What is good here?"
            hint="At least 20 characters."
            required
          />
          <Field
            name="cons"
            label="What is not?"
            hint="At least 20 characters."
            required
          />
          <Field name="advice" label="Advice for someone joining" />
          <Select
            name="wouldRecommend"
            label="Would you recommend working here?"
            options={[
              { id: "yes", name: "Yes" },
              { id: "no", name: "No" },
            ]}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            disabled={review.isPending}
            className="self-start"
          >
            {review.isPending ? "Sending…" : "Submit review"}
          </Button>
        </form>
      ) : tab === "interview" ? (
        <form onSubmit={submitInterview} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              name="roleId"
              label="Role you interviewed for"
              options={roles}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="level">Level</Label>
              <Input
                id="level"
                name="level"
                placeholder="Junior, mid, senior"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="yearMonth">When</Label>
              <Input id="yearMonth" name="yearMonth" type="month" required />
            </div>
            <Select
              name="source"
              label="How you applied"
              required
              options={[
                { id: "referral", name: "Referral" },
                { id: "job_board", name: "Job board" },
                { id: "campus", name: "Campus drive" },
                { id: "direct", name: "Applied directly" },
                { id: "other", name: "Other" },
              ]}
            />
            <Scale
              name="difficulty"
              label="Difficulty"
              required
              low="Easy"
              high="Brutal"
            />
            <Select
              name="outcome"
              label="Outcome"
              required
              options={[
                { id: "offer", name: "Offer" },
                { id: "rejected", name: "Rejected" },
                { id: "withdrew", name: "I withdrew" },
                { id: "no_response", name: "No response" },
              ]}
            />
          </div>
          <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Rounds</legend>
            {rounds.map((round, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row">
                <select
                  aria-label={`Round ${i + 1} type`}
                  value={round.type}
                  onChange={(e) =>
                    setRounds((rs) =>
                      rs.map((r, n) =>
                        n === i ? { ...r, type: e.target.value } : r,
                      ),
                    )
                  }
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm capitalize shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-48"
                >
                  {ROUND_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label={`Round ${i + 1} description`}
                  value={round.description}
                  onChange={(e) =>
                    setRounds((rs) =>
                      rs.map((r, n) =>
                        n === i ? { ...r, description: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder="What happened in this round?"
                  required
                  minLength={3}
                  maxLength={1000}
                  className="flex-1"
                />
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={rounds.length >= 12}
                onClick={() =>
                  setRounds((rs) => [
                    ...rs,
                    { type: "technical", description: "" },
                  ])
                }
              >
                Add a round
              </Button>
              {rounds.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setRounds((rs) => rs.slice(0, -1))}
                >
                  Remove the last
                </Button>
              ) : null}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="durationDays">
              Days from first contact to a decision
            </Label>
            <Input
              id="durationDays"
              name="durationDays"
              type="number"
              min={0}
              max={730}
              className="max-w-32"
            />
          </div>
          <Field name="questions" label="Questions you were asked" />
          <Field name="advice" label="Advice for the next person" />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            disabled={interview.isPending}
            className="self-start"
          >
            {interview.isPending ? "Sending…" : "Submit experience"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitSalary} className="flex flex-col gap-4">
          <p className="max-w-prose rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Your figure is never shown on its own. A role appears on the company
            page only once five or more people have reported it, and then only
            as a median and a middle range.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select name="roleId" label="Your role" options={roles} required />
            <Select
              name="level"
              label="Level"
              options={SALARY_LEVELS.map((l) => ({ id: l, name: l }))}
            />
            <Select name="cityId" label="City" options={cities} />
            <Select
              name="employmentType"
              label="Employment"
              required
              defaultValue="full_time"
              options={[
                { id: "full_time", name: "Full time" },
                { id: "part_time", name: "Part time" },
                { id: "contract", name: "Contract" },
                { id: "internship", name: "Internship" },
              ]}
            />
          </div>
          <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
            <legend className="px-1 text-sm font-medium">Base pay</legend>
            <Select
              name="currency"
              label="Currency"
              required
              defaultValue="PKR"
              options={[
                { id: "PKR", name: "PKR" },
                { id: "USD", name: "USD" },
              ]}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">
                Amount<span className="text-destructive"> *</span>
              </Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={1}
                max={50000000}
                step={1}
                required
                placeholder="250000"
              />
            </div>
            <Select
              name="period"
              label="Per"
              required
              defaultValue="monthly"
              options={[
                { id: "monthly", name: "Month" },
                { id: "yearly", name: "Year" },
              ]}
            />
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="year">
                Year this was your pay
                <span className="text-destructive"> *</span>
              </Label>
              <Input
                id="year"
                name="year"
                type="number"
                min={2000}
                max={new Date().getFullYear()}
                defaultValue={new Date().getFullYear()}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="yearsExperience">Years of experience</Label>
              <Input
                id="yearsExperience"
                name="yearsExperience"
                type="number"
                min={0}
                max={50}
              />
            </div>
          </div>
          <fieldset className="flex flex-wrap gap-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Also</legend>
            {(
              [
                ["hasBonus", "A bonus on top"],
                ["hasEquity", "Equity or stock"],
                ["isRemote", "Remote"],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={name}
                  value="1"
                  className="size-4 rounded border-input accent-brand-600"
                />
                {label}
              </label>
            ))}
          </fieldset>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            disabled={salary.isPending}
            className="self-start"
          >
            {salary.isPending ? "Sending…" : "Submit pay"}
          </Button>
        </form>
      )}
    </div>
  );
}

/** A 1-5 radio group; radios rather than a slider so the choice is explicit. */
function Scale({
  name,
  label,
  required,
  low = "Poor",
  high = "Great",
}: {
  name: string;
  label: string;
  required?: boolean;
  low?: string;
  high?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-44 text-sm">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      <div className="flex items-center gap-1">
        <span className="pr-1 text-xs text-muted-foreground">{low}</span>
        {[1, 2, 3, 4, 5].map((v) => (
          <label
            key={v}
            className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-sm has-checked:border-brand-600 has-checked:bg-brand-600/10"
          >
            <input
              type="radio"
              name={name}
              value={v}
              required={required}
              className="sr-only"
            />
            {v}
          </label>
        ))}
        <span className="pl-1 text-xs text-muted-foreground">{high}</span>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  hint,
  required,
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Textarea
        id={name}
        name={name}
        rows={3}
        required={required}
        minLength={required ? 20 : undefined}
        maxLength={2000}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Select({
  name,
  label,
  options,
  required,
  defaultValue = "",
}: {
  name: string;
  label: string;
  options: { id: string; name: string }[];
  required?: boolean;
  /** Set where there is an obvious common case, so most people never touch it. */
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <option value="">
          {required ? "Choose one" : "Prefer not to say"}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
