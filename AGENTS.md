# Project

Sorting-algorithm visualizer. Infrastructure (CI/CD, CDK, S3 + CloudFront) is done; application code under `app/` is still the create-next-app template.

## Commands

- `npm run dev` — dev server
- `npm run lint` — ESLint
- `npm run build` — static export to `out/`
- `npx tsc --noEmit` — typecheck (covers `app/` and `cdk/`)

CI runs lint, `npm audit --audit-level=high --omit=dev` and build. There is no test runner and no formatter yet; don't invent commands for them.

## Static export

`next.config.ts` sets `output: 'export'`: the site is plain files on S3 behind CloudFront, with no Node.js server. Don't use Server Actions, cookies, request-dependent route handlers, redirects/rewrites/headers, proxy, ISR, or `next/image` with the default loader.

## TypeScript

Two projects: the root `tsconfig.json` (bundler resolution, `@/*` maps to the repo root) and `cdk/tsconfig.json` (CommonJS, run through ts-node by `cdk.json`). Code in `cdk/` must not import from `app/` or use the `@/` alias.

## Git and releases

- Commits and PR titles follow Conventional Commits (`fix: ...`, `chore(workflows/cd): ...`). PR titles are validated in CI, and the changelog and version are generated from commit messages.
- Branches: `dev` and `main`. The `CD` workflow is started manually; a run on `main` deploys prod, a run on any other branch deploys the dev environment.
- Don't edit `CHANGELOG.md` or the `version` in `package.json`; the CD workflow writes them.

## Deployment

Deploys and teardowns happen only through the `CD` and `Destroy` GitHub workflows. Never run `cdk deploy` or `cdk destroy` locally.

## Infrastructure docs

- `docs/cdk.md` covers the CDK stack (S3 bucket, CloudFront, BucketDeployment), bootstrap and deployment. Read it before working in `cdk/`.
- `docs/iam.md` covers the GitHub Actions IAM user, group, role, policies and the GitHub secrets. Read it before working on IAM or workflow credentials.
