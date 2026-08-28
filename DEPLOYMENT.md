# ABR deployment on AWS

ABR uses two small AWS surfaces:

- **AWS Amplify Hosting** for the static website in `dist/`.
- **Amazon API Gateway + AWS Lambda** for the non-normative `/capabilities` reference API.

The public contract remains on `https://abr.sirvisetti.com`; the hosting and serverless implementation are deployment details and are not part of ABCS conformance.

## 1. Deploy the reference API

The backend is defined with AWS SAM in `aws/template.yaml` and has no third-party runtime dependencies.

```bash
sam build --template-file aws/template.yaml
sam deploy --guided
```

Recommended stack name:

```text
abr-reference-api
```

After deployment, record the `ReferenceApiUrl` stack output. It will look like:

```text
https://<api-id>.execute-api.<region>.amazonaws.com
```

Verify the API directly before connecting the website:

```bash
curl https://<api-id>.execute-api.<region>.amazonaws.com/capabilities
```

## 2. Deploy the static site with Amplify Hosting

Create an Amplify app from:

```text
sirvisetti/autonomous-business-reference
```

Use the `main` branch. The repository-level `amplify.yml` runs `npm run build` and publishes `dist/`.

## 3. Preserve the public ABR API paths

In Amplify Hosting, open **Hosting → Rewrites and redirects** and add the following two `200` reverse-proxy rewrites, replacing `<API_BASE>` with the `ReferenceApiUrl` value from the SAM stack:

```json
[
  {
    "source": "/capabilities",
    "target": "<API_BASE>/capabilities",
    "status": "200",
    "condition": null
  },
  {
    "source": "/capabilities/<*>",
    "target": "<API_BASE>/capabilities/<*>",
    "status": "200",
    "condition": null
  }
]
```

Keep these API rules above any broad catch-all rule.

This preserves:

```text
GET  /capabilities
GET  /capabilities/{capability}
POST /capabilities
```

while the browser and OpenAPI document continue to use `https://abr.sirvisetti.com` as the public reference surface.

## 4. Validate before moving the domain

Verify the Amplify preview URL first:

1. Home page loads.
2. HTTP binding page loads.
3. Playground discovers the three reference capabilities.
4. A valid invocation returns `outcome: completed`.
5. An invalid canonical payload returns a governed rejection.
6. `GET /capabilities/{capability}` returns the capability description.

Only after those checks pass should `abr.sirvisetti.com` be attached to the Amplify app.
