import type * as React from "react";
import { Badge } from "@repo/ui/components/badge";
import { Card } from "@repo/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Frame } from "./frame";

/*
 * Everything below is invented for this illustration. "Meridian Systems" is
 * not a company in the bank, and the review is not anyone's contribution.
 */
const ROLES = ["Associate engineer", "Software engineer", "QA engineer"];

/** The company bank in miniature: facts, withheld pay, one review. */
export function BankFrame({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Frame>, "children">) {
  return (
    <Frame
      path="learn.devhelp.pk/companies/meridian-systems"
      className={className}
      {...props}
    >
      <div className="flex h-full flex-col gap-3 p-3 @md:gap-4 @md:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary font-display text-sm font-semibold text-primary-foreground">
            M
          </span>
          <div className="flex min-w-0 flex-col">
            <p className="truncate font-display font-semibold">
              Meridian Systems
            </p>
            <p className="truncate text-xs text-muted-foreground">Lahore</p>
          </div>
          <Badge variant="secondary" className="ml-auto">
            Hires juniors
          </Badge>
        </div>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="h-7 px-0">Role</TableHead>
              <TableHead className="h-7 px-0">Monthly pay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROLES.map((role) => (
              <TableRow key={role}>
                <TableCell className="px-0 py-1.5">{role}</TableCell>
                <TableCell className="px-0 py-1.5 text-muted-foreground">
                  Fewer than five reports
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Card className="gap-1 px-3 py-3">
          <p className="text-xs font-medium">Software engineer, a year there</p>
          <p className="text-xs text-pretty text-muted-foreground">
            Code review was patient and specific. Deadlines slipped when a
            client changed their mind.
          </p>
        </Card>
      </div>
    </Frame>
  );
}
