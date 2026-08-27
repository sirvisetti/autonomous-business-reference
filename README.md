# Autonomous Business Reference

A lightweight, non-normative reference implementation of the **Autonomous Business Capability Specification (ABCS)**, part of the **Autonomous Business Standard (ABS)** project.

> **Non-normative.** This repository demonstrates one way to implement ABCS. Conformance is defined by the ABCS specification and canonical contracts in `sirvisetti/autonomous-business-standard`, not by this code.

## Goals

- Make ABCS understandable in minutes.
- Demonstrate Discover, Describe, Invoke, and canonical response semantics.
- Validate and exercise representative canonical business payloads.
- Stay small enough to read, fork, and deploy without infrastructure.
- Run on Netlify using static files and one lightweight serverless function.

## What it is not

This is not Sirvisetti Autonomy and is not a production platform. It intentionally excludes ERP adapters, workflow engines, message brokers, identity products, databases, agents, schedulers, and other runtime infrastructure.

## Local development

Use Netlify CLI:

```bash
netlify dev
```

Then open the local URL and try the Playground.

## Standard

ABS site: https://abs.sirvisetti.com

Normative specification: Autonomous Business Capability Specification (ABCS) Draft 0.2.

## License

Reference implementation source is provided under Apache License 2.0 unless otherwise noted.
