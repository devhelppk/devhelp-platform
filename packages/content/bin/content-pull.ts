#!/usr/bin/env tsx
import { pullContent } from "../src/pull";

const force = process.argv.includes("--force");
pullContent({ force })
  .then((r) => {
    console.log(
      r.skipped
        ? `content already at ${r.sha.slice(0, 7)} in ${r.dest}`
        : `pulled ${r.sha.slice(0, 7)} into ${r.dest}`,
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
