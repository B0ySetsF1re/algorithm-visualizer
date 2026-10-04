# CDK Infrastructure

## Overview

The infrastructure is defined using AWS CDK (Cloud Development Kit) in TypeScript. It provisions a static website hosting setup using S3 and CloudFront.

The CDK code lives in the `cdk/` directory at the project root.

---

## Directory Structure

```
cdk/
  app.ts          # CDK app entry point
  stack.ts        # Stack definition (all AWS resources)
  tsconfig.json   # CDK-specific TypeScript config (separate from Next.js)
cdk.json          # CDK app configuration
```

---

## Why a Separate tsconfig?

The root `tsconfig.json` is configured for Next.js and is incompatible with CDK:

| Setting | Next.js | CDK |
|---|---|---|
| `module` | `esnext` | `commonjs` |
| `noEmit` | `true` | `false` |
| `moduleResolution` | `bundler` | `node` |

CDK uses `ts-node` to run TypeScript directly in Node.js which requires CommonJS modules.

---

## Stack Resources

### S3 Bucket (`StaticSiteBucket`)
- Stores the static Next.js build output (`out/` directory)
- All public access blocked — only accessible via CloudFront
- `removalPolicy: DESTROY` + `autoDeleteObjects: true` — bucket and all its contents are deleted when running `cdk destroy`

### CloudFront Distribution (`Distribution`)
- Serves the static site globally via CDN
- Forces HTTPS via `REDIRECT_TO_HTTPS`
- `defaultRootObject: index.html` — serves index.html at the root
- Error responses: 403 and 404 from S3 → `/404.html` with 404 status. S3 returns 403 for a missing object when the bucket is private, so both codes are mapped to the static 404 page that Next.js exports
- Connected to S3 via Origin Access Control (OAC) — only CloudFront can read from the bucket

### BucketDeployment (`DeployStaticSite`)
- Copies the Next.js static output (`out/` directory) to the S3 bucket on every `cdk deploy`
- Automatically invalidates the CloudFront cache (`/*`) after upload so changes go live immediately
- Uses `path.join(__dirname, '../out')` to resolve the path relative to the compiled CDK file, not the working directory

### CfnOutput (`DistributionUrl`)
- Outputs the CloudFront URL after deployment (e.g. `https://dXXXXXXXXXXXXX.cloudfront.net`)

---

## CDK Internals (Auto-generated Resources)

CDK automatically creates these resources — you don't define them explicitly:

| Resource | Why it exists |
|---|---|
| `AwsCliLayer` Lambda layer | BucketDeployment uses AWS CLI internally to sync files to S3 |
| `CDKBucketDeployment` Lambda | Executes the actual file sync from CDK assets bucket to your S3 bucket |
| `S3AutoDeleteObjects` Lambda | Empties the S3 bucket before deletion when running `cdk destroy` |
| IAM roles/policies | Execution permissions for the above Lambda functions |

These are all part of `AlgorithmVisualizerStack`, not `CDKToolkit`.

---

## Bootstrap

CDK requires a one-time bootstrap per AWS account/region before the first deploy:

```bash
npx cdk bootstrap aws://ACCOUNT_ID/REGION
```

This creates the `CDKToolkit` CloudFormation stack which contains:
- An S3 bucket for CDK assets
- IAM roles CDK uses internally (`cdk-hnb659fds-*`)
- An SSM parameter (`/cdk-bootstrap/hnb659fds/version`) CDK checks before deploying

Bootstrap is shared across all CDK stacks in the same account/region.

---

## Deployment

CDK is deployed via the GitHub Actions `CD` workflow, which is started manually (`workflow_dispatch`) on a chosen branch. A run on `main` deploys the `prod` environment; a run on any other branch deploys `dev`. The environment is passed to CDK through the `ENVIRONMENT` variable and becomes part of the stack name (`AlgorithmVisualizerStack-<environment>`) and the bucket name (`algorithm-visualizer-<environment>`).

On `main` a release job runs first (changelog, version bump, GitHub release) unless the `SKIP_RELEASE` repository variable is `true`.

The deploy sequence is:
1. `npm ci` — install dependencies
2. `npm run build` — generate the `out/` directory (Next.js static export)
3. `npx cdk deploy --require-approval never` — deploy infrastructure and sync files to S3 (skipped when the `SKIP_DEPLOY` repository variable is `true`)

`--require-approval never` skips the manual approval prompt for security group changes, required for non-interactive CI environments.

The `Destroy` workflow, also manual, runs `npx cdk destroy --force` for the environment that matches the branch.

---

## Static Export

Next.js is configured with `output: 'export'` in `next.config.ts` which generates a fully static `out/` directory on `npm run build`. This is required for S3 hosting since S3 can only serve static files.

---

## Future: Custom Domain (Phase 2)

The following will be added to the stack when a domain is purchased:
- `aws-cdk-lib/aws-route53` — hosted zone + A record alias pointing to CloudFront
- `aws-cdk-lib/aws-certificatemanager` — ACM SSL certificate (must be in `us-east-1` for CloudFront)
- CloudFront custom domain configuration
