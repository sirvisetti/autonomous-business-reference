# Autonomous Business Reference (ABR)

A lightweight, non-normative reference implementation of the **Autonomous Business Capability Specification (ABCS)**, part of the **Autonomous Business Standard (ABS)** project.

**Public site:** https://abr.sirvisetti.com  
**ABS / ABCS:** https://abs.sirvisetti.com

> **Non-normative.** This repository demonstrates one way to implement ABCS. Conformance is defined by the ABCS specification and canonical contracts in `sirvisetti/autonomous-business-standard`, not by this code.

## Goals

- Make ABCS understandable in minutes.
- Demonstrate Discover, Describe, Invoke, and canonical response semantics.
- Validate and exercise representative canonical business payloads.
- Stay small enough to read, fork, and deploy with minimal infrastructure.
- Keep hosting and runtime technology separate from the ABCS business contract.

## Architecture

ABR intentionally stays tiny:

- Static HTML, CSS and JavaScript hosted with AWS Amplify Hosting.
- One lightweight AWS Lambda function behind Amazon API Gateway for the `/capabilities` reference API.
- AWS SAM infrastructure definition in `aws/template.yaml`.
- OpenAPI description of the optional HTTP binding.
- No database, workflow engine, message broker, agent framework or ERP adapter.

The browser and OpenAPI contract use the stable public paths:

```text
GET  /capabilities
GET  /capabilities/{capability}
POST /capabilities
```

## What it is not

This is not Sirvisetti Autonomy and is not a production platform. It intentionally excludes ERP adapters, workflow engines, message brokers, identity products, databases, agents, schedulers, and other runtime infrastructure.

## Build and local checks

The website build has no third-party dependencies:

```bash
npm run check
npm run build
```

The generated static site is written to `dist/`.

To exercise the API locally with AWS SAM:

```bash
sam build --template-file aws/template.yaml
sam local start-api --template-file .aws-sam/build/template.yaml
```

See `DEPLOYMENT.md` for the AWS deployment and Amplify reverse-proxy configuration.

## Standard

ABS site: https://abs.sirvisetti.com

Normative specification: **Autonomous Business Capability Specification (ABCS) Draft 0.2**.

ABR depends on ABCS. ABCS does not depend on ABR.

## License

Reference implementation source is provided under Apache License 2.0 unless otherwise noted.
