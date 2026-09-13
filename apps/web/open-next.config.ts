import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

/**
 * OpenNext for AWS, deployed as a single Lambda function behind a function URL
 * (S22) — not through `sst.aws.Nextjs`, which always creates a CloudFront
 * distribution this AWS account cannot create yet.
 *
 * - `aws-lambda-streaming` + `aws-apigw-v2`: the function URL invokes with the
 *   v2 payload and streams the response (`streaming: true` in sst.config.ts),
 *   which React Server Components and Suspense rely on.
 * - `dummy` incremental cache, tag cache and queue: no S3 cache bucket,
 *   DynamoDB table or SQS revalidation queue to create or pay for. The pages
 *   that matter read fresh (company pages are `force-dynamic` by design, S10a),
 *   and `revalidate` on the few pages that set it degrades to rendering on
 *   request, which is correct if not cached.
 */
const config = {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
      converter: "aws-apigw-v2",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
  dangerous: {
    disableIncrementalCache: true,
    disableTagCache: true,
  },
} satisfies OpenNextConfig;

export default config;
