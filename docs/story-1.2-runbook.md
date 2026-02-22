# Story 1.2 Runbook (Manual Infra + First Deploy)

This runbook executes Story 1.2 manually and captures proof for:
- MongoDB Atlas setup
- AWS SSM parameter setup
- Terraform init/apply
- Health and CORS verification

## 0) Preconditions

- AWS CLI authenticated (`aws sts get-caller-identity` works)
- Terraform Cloud account (or local backend strategy decided)
- MongoDB Atlas account
- Backend and infra folders exist in this repo

## 1) MongoDB Atlas (manual in UI)

1. Create M0 cluster
2. Create DB user with `readWrite` for DB used by app
3. Add network access rule (`0.0.0.0/0` for MVP, tighten later if needed)
4. Create database and collections:
   - `users`
   - `topics`
   - `audit_log`
5. Copy connection string as `MONGODB_URI`

## 2) Create SSM parameters

Set values first:

```bash
export AWS_REGION=us-east-1
export MONGODB_URI='mongodb+srv://...'
export JWT_SECRET='replace-with-random-secret'
export CORS_ORIGIN='https://<your-cloudflare-pages-domain>'
export EMAIL_FROM='no-reply@<your-verified-domain>'
export APP_BASE_URL='https://<your-cloudflare-pages-domain>'
```

Create/update parameters:

```bash
aws ssm put-parameter --name /lit/mongodb-uri --type SecureString --value "$MONGODB_URI" --overwrite --region "$AWS_REGION"
aws ssm put-parameter --name /lit/jwt-secret --type SecureString --value "$JWT_SECRET" --overwrite --region "$AWS_REGION"
aws ssm put-parameter --name /lit/cors-origin --type SecureString --value "$CORS_ORIGIN" --overwrite --region "$AWS_REGION"
aws ssm put-parameter --name /lit/email-from --type SecureString --value "$EMAIL_FROM" --overwrite --region "$AWS_REGION"
aws ssm put-parameter --name /lit/app-base-url --type SecureString --value "$APP_BASE_URL" --overwrite --region "$AWS_REGION"
```

Verify:

```bash
aws ssm get-parameter --name /lit/cors-origin --with-decryption --region "$AWS_REGION" --query 'Parameter.Value' --output text
```

## 3) Terraform login/init/apply

```bash
cd infra
terraform login
terraform init
terraform plan
terraform apply
```

Capture outputs:

```bash
terraform output
```

Expected: Lambda + API Gateway are created and API URL is available.

## 4) Validate deployment

Set API URL:

```bash
export API_URL='https://<api-id>.execute-api.<region>.amazonaws.com'
export CORS_ORIGIN='https://<your-cloudflare-pages-domain>'
```

Health:

```bash
curl -i "$API_URL/health"
```

Expected:
- HTTP `200`
- body contains `{"status":"ok"}`

CORS preflight:

```bash
curl -i -X OPTIONS "$API_URL/health" \
  -H "Origin: $CORS_ORIGIN" \
  -H "Access-Control-Request-Method: GET"
```

Expected headers include:
- `Access-Control-Allow-Origin: <CORS_ORIGIN>`
- `Access-Control-Allow-Credentials: true`

## 5) Save evidence into Story 1.2

Update:
- `_bmad-output/implementation-artifacts/1-2-external-services-and-first-deploy.md`

Record:
- commands used
- API URL
- Lambda ARN
- key outputs (health + CORS checks)
