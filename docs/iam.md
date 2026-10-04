# IAM Setup

## Overview

The IAM setup grants GitHub Actions the minimum permissions needed to deploy the CDK stack to AWS. It follows the principle of least privilege — only the actions required for deployment are allowed.

---

## Structure

```
StaticFrontendGithubActionsGroup (group)
    ├── StaticFrontendGithubActions (policy)         # deployment permissions
    └── StaticFrontendGithubActionsAssumeRole (policy) # permission to assume the role
         |
         └── StaticFrontendGithubActionsUser (user)  # access keys stored in GitHub secrets
                    |
                    └── assumes
                         |
                         ▼
              StaticFrontendGithubActionsRole (role)  # trusted principal: the user above
```

---

## Resources

### IAM User (`StaticFrontendGithubActionsUser`)
- Represents GitHub Actions in AWS
- Has access keys (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`) stored as GitHub repository secrets
- Has no direct permissions — inherits everything through the group

### IAM Group (`StaticFrontendGithubActionsGroup`)
- Groups permissions so they are managed in one place rather than per user
- Has two policies attached (see below)
- If more users need the same access in future, just add them to the group

### IAM Role (`StaticFrontendGithubActionsRole`)
- Contains the actual deployment permissions
- Trust policy allows only `StaticFrontendGithubActionsUser` to assume it
- Not assumed by the workflows at the moment: `cd.yaml` and `destroy.yaml` configure credentials with the access keys only and pass no `role-to-assume`, so deployments run with the permissions the user inherits from the group

### Why use a role instead of attaching permissions directly to the user?
- Roles provide temporary credentials (expire automatically after the session)
- Easier to audit — permissions are on the role, not scattered across users
- More secure — even if access keys are leaked, an attacker still needs to assume the role

---

## Policies

### `StaticFrontendGithubActions`
Attached to the group. Grants the deployment permissions needed by CDK.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetObject",
        "s3:GetBucketLocation"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:DeleteDistribution",
        "cloudfront:GetDistribution"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:GetTemplate",
        "cloudformation:CreateChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:DeleteChangeSet",
        "cloudformation:GetTemplateSummary"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/cdk-*",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "cloudformation.amazonaws.com"
        }
      }
    }
  ]
}
```

**Why each permission:**

| Permission | Why needed |
|---|---|
| `s3:*` | Upload static files to S3, CDK also uses S3 for asset staging |
| `cloudfront:*` | Create and update the CloudFront distribution, invalidate cache after deploy |
| `cloudformation:*` | CDK deploys via CloudFormation stacks and changesets |
| `ssm:GetParameter` | CDK reads bootstrap version from SSM Parameter Store before deploying |
| `iam:PassRole` | CDK passes bootstrap roles to CloudFormation to provision resources on its behalf. Scoped to `cdk-*` roles and only to CloudFormation via condition |

**Why `Resource: *` for most statements:**
CDK creates resources dynamically — bucket names, distribution IDs, and stack ARNs are not known before the first deploy. Restricting by resource ARN would require knowing these values in advance.

---

### `StaticFrontendGithubActionsAssumeRole`
Attached to the group. Grants permission to assume the role and CDK bootstrap roles.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": [
        "arn:aws:iam::ACCOUNT_ID:role/StaticFrontendGithubActionsRole",
        "arn:aws:iam::ACCOUNT_ID:role/cdk-*"
      ]
    }
  ]
}
```

**Why two resources:**
- `StaticFrontendGithubActionsRole` — the custom role with deployment permissions
- `cdk-*` — CDK bootstrap roles (`cdk-hnb659fds-deploy-role`, `cdk-hnb659fds-file-publishing-role`, etc.) that CDK tries to assume during deploy to publish assets and create CloudFormation changesets

---

## GitHub Secrets

The following secrets are stored in the GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_ROLE_ARN` | ARN of `StaticFrontendGithubActionsRole`. Stored, but not referenced by any workflow |
| `AWS_REGION` | AWS region (e.g. `eu-west-1`) |

---

## Authentication Flow

```
GitHub Actions workflow starts
         ↓
Authenticates as IAM user (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
         ↓
CDK deploy runs with the user's group permissions — internally assumes cdk-* bootstrap roles
         ↓
CloudFormation creates/updates the stack
```

---

## Future: Assume the Role

`StaticFrontendGithubActionsRole` and the `AWS_ROLE_ARN` secret are kept on purpose, although nothing uses them today. The workflows originally passed `role-to-assume`; it was removed, and they now deploy with the user's credentials directly.

The plan is to possibly switch back later:
- Add `role-to-assume: ${{ secrets.AWS_ROLE_ARN }}` to the credentials step in `cd.yaml` and `destroy.yaml`
- Move the `StaticFrontendGithubActions` deployment policy from the group to the role, so the access keys alone can only assume the role

Until then, don't delete the role or the secret, and don't treat them as dead configuration.
