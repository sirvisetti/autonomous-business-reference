const STANDARD = "https://abs.sirvisetti.com";

type Capability = {
  id: string;
  title: string;
  summary: string;
  kind: "command";
  businessObject: string;
  definition: string;
  inputSchema: string;
  preconditions: Record<string, string>;
  effects: Record<string, string>;
  referenceChecks: string[];
};

const capabilities: Capability[] = [
  {
    id: "procurement.purchase-order.submit",
    title: "Submit Purchase Order",
    summary: "Submit a purchase order into its applicable business review, approval, or receiving flow.",
    kind: "command",
    businessObject: "procurement.purchase-order",
    definition: `${STANDARD}/domains/procurement/capabilities/purchase-order/submit.yaml`,
    inputSchema: `${STANDARD}/schemas/objects/procurement/purchase-order.schema.json`,
    preconditions: { lifecycle: "draft" },
    effects: { approval: "pending" },
    referenceChecks: ["Required canonical fields are present", "At least one order line is present", "Lifecycle is draft", "Line quantities are positive"]
  },
  {
    id: "finance.journal-entry.post",
    title: "Post Journal Entry",
    summary: "Post a balanced journal entry to the applicable accounting records.",
    kind: "command",
    businessObject: "finance.journal-entry",
    definition: `${STANDARD}/domains/finance/capabilities/journal-entry/post.yaml`,
    inputSchema: `${STANDARD}/schemas/objects/finance/journal-entry.schema.json`,
    preconditions: { lifecycle: "draft" },
    effects: { lifecycle: "posted" },
    referenceChecks: ["Required canonical fields are present", "At least two journal lines are present", "Lifecycle is draft", "Debits and credits are non-negative", "Total debits equal total credits"]
  },
  {
    id: "hr.leave-request.submit",
    title: "Submit Leave Request",
    summary: "Submit a worker leave request for the applicable business review and approval.",
    kind: "command",
    businessObject: "hr.leave-request",
    definition: `${STANDARD}/domains/hr/capabilities/leave-request/submit.yaml`,
    inputSchema: `${STANDARD}/schemas/objects/hr/leave-request.schema.json`,
    preconditions: { lifecycle: "draft" },
    effects: { lifecycle: "submitted", approval: "pending" },
    referenceChecks: ["Required canonical fields are present", "Lifecycle is draft", "Start date is not after end date", "Duration is positive when supplied"]
  }
];

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function missing(payload: any, fields: string[]) {
  return fields.filter((field) => payload == null || payload[field] === undefined || payload[field] === null);
}

function error(code: string, message: string, details?: unknown) {
  return { code, message, ...(details === undefined ? {} : { details }) };
}

function amount(value: any): number {
  return typeof value?.amount === "number" && Number.isFinite(value.amount) ? value.amount : NaN;
}

function validate(id: string, payload: any) {
  const errors: any[] = [];

  if (id === "procurement.purchase-order.submit") {
    const absent = missing(payload, ["number", "buyer", "supplier", "orderDate", "currency", "lines", "status"]);
    if (absent.length) errors.push(error("CANONICAL_PAYLOAD_INVALID", `Missing required canonical fields: ${absent.join(", ")}`));
    if (absent.length) return errors;

    if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
      errors.push(error("CANONICAL_PAYLOAD_INVALID", "Purchase Order must contain at least one line."));
    }
    if (payload.status?.lifecycle !== "draft") {
      errors.push(error("BUSINESS_PRECONDITION_NOT_MET", "Purchase Order must be in draft lifecycle state before it can be submitted.", { expected: "draft", actual: payload.status?.lifecycle }));
    }
    if (Array.isArray(payload.lines)) {
      payload.lines.forEach((line: any, index: number) => {
        const quantity = line?.quantity?.value;
        if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
          errors.push(error("BUSINESS_RULE_VIOLATION", `Purchase Order line ${index + 1} must have a positive quantity.`));
        }
      });
    }
  }

  if (id === "finance.journal-entry.post") {
    const absent = missing(payload, ["number", "accountingDate", "currency", "lines", "status"]);
    if (absent.length) errors.push(error("CANONICAL_PAYLOAD_INVALID", `Missing required canonical fields: ${absent.join(", ")}`));
    if (absent.length) return errors;

    if (!Array.isArray(payload.lines) || payload.lines.length < 2) {
      errors.push(error("CANONICAL_PAYLOAD_INVALID", "Journal Entry must contain at least two lines."));
    }
    if (payload.status?.lifecycle !== "draft") {
      errors.push(error("BUSINESS_PRECONDITION_NOT_MET", "Journal Entry must be in draft lifecycle state before it can be posted.", { expected: "draft", actual: payload.status?.lifecycle }));
    }
    if (Array.isArray(payload.lines) && payload.lines.length) {
      let debitTotal = 0;
      let creditTotal = 0;
      let amountsValid = true;
      payload.lines.forEach((line: any, index: number) => {
        const debit = amount(line?.debit);
        const credit = amount(line?.credit);
        if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
          amountsValid = false;
          errors.push(error("BUSINESS_RULE_VIOLATION", `Journal Entry line ${index + 1} must contain non-negative debit and credit amounts.`));
          return;
        }
        debitTotal += debit;
        creditTotal += credit;
      });
      if (amountsValid) {
        const delta = Math.abs(debitTotal - creditTotal);
        if (debitTotal <= 0 || delta > 0.000001) {
          errors.push(error("BUSINESS_RULE_VIOLATION", "Journal Entry must be balanced before posting.", { debitTotal, creditTotal }));
        }
      }
    }
  }

  if (id === "hr.leave-request.submit") {
    const absent = missing(payload, ["number", "worker", "leaveType", "startDate", "endDate", "status"]);
    if (absent.length) errors.push(error("CANONICAL_PAYLOAD_INVALID", `Missing required canonical fields: ${absent.join(", ")}`));
    if (absent.length) return errors;

    if (payload.status?.lifecycle !== "draft") {
      errors.push(error("BUSINESS_PRECONDITION_NOT_MET", "Leave Request must be in draft lifecycle state before it can be submitted.", { expected: "draft", actual: payload.status?.lifecycle }));
    }
    if (String(payload.startDate) > String(payload.endDate)) {
      errors.push(error("BUSINESS_RULE_VIOLATION", "Leave Request start date must not be after the end date.", { startDate: payload.startDate, endDate: payload.endDate }));
    }
    if (payload.duration !== undefined) {
      const duration = payload.duration?.value;
      if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
        errors.push(error("BUSINESS_RULE_VIOLATION", "Leave Request duration must be positive when supplied."));
      }
    }
  }

  return errors;
}

function apply(id: string, payload: any) {
  const out = structuredClone(payload);
  const before = structuredClone(payload.status || {});
  if (id === "procurement.purchase-order.submit") out.status = { ...(out.status || {}), approval: "pending" };
  if (id === "finance.journal-entry.post") out.status = { ...(out.status || {}), lifecycle: "posted" };
  if (id === "hr.leave-request.submit") out.status = { ...(out.status || {}), lifecycle: "submitted", approval: "pending" };
  return { payload: out, transition: { before, after: structuredClone(out.status || {}) } };
}

export default async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const id = url.searchParams.get("id");
    if (!id) return json({ abcs: "0.2", reference: true, nonNormative: true, capabilities });
    const found = capabilities.find((capability) => capability.id === id);
    return found
      ? json({ abcs: "0.2", reference: true, nonNormative: true, ...found })
      : json({ abcs: "0.2", error: error("CAPABILITY_NOT_SUPPORTED", "Capability is not implemented by this reference surface.") }, 404);
  }

  if (req.method !== "POST") return json({ error: error("METHOD_NOT_ALLOWED", "Use GET or POST.") }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ abcs: "0.2", outcome: "rejected", errors: [error("INVALID_JSON", "Request body must be JSON.")] }, 400);
  }

  const { abcs, capability, requestId, payload } = body || {};
  if (abcs !== "0.2" || !capability || !requestId || payload === undefined) {
    return json({
      abcs: "0.2",
      capability: capability || "unknown",
      requestId: requestId || "unknown",
      outcome: "rejected",
      errors: [error("INVALID_ENVELOPE", "abcs, capability, requestId and payload are required.")]
    }, 400);
  }

  const found = capabilities.find((item) => item.id === capability);
  if (!found) {
    return json({ abcs: "0.2", capability, requestId, outcome: "rejected", errors: [error("CAPABILITY_NOT_SUPPORTED", "Capability is not implemented by this reference surface.")] }, 404);
  }

  const errors = validate(capability, payload);
  if (errors.length) {
    return json({
      abcs: "0.2",
      capability,
      requestId,
      outcome: "rejected",
      errors: errors.map((item) => item.details ? item : { ...item, details: { schema: found.inputSchema } }),
      reference: { nonNormative: true, definition: found.definition, schema: found.inputSchema }
    }, 422);
  }

  const applied = apply(capability, payload);
  return json({
    abcs: "0.2",
    capability,
    requestId,
    outcome: "completed",
    payload: applied.payload,
    reference: {
      nonNormative: true,
      definition: found.definition,
      schema: found.inputSchema,
      businessObject: found.businessObject,
      transition: applied.transition
    }
  });
};