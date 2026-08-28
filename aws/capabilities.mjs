const STANDARD = 'https://abs.sirvisetti.com';

const capabilities = [
  {
    id: 'procurement.purchase-order.submit',
    title: 'Submit Purchase Order',
    summary: 'Submit a purchase order into its applicable business review, approval, or receiving flow.',
    kind: 'command',
    businessObject: 'procurement.purchase-order',
    definition: `${STANDARD}/domains/procurement/capabilities/purchase-order/submit.yaml`,
    inputSchema: `${STANDARD}/schemas/objects/procurement/purchase-order.schema.json`,
    preconditions: { lifecycle: 'draft' },
    effects: { approval: 'pending' },
    referenceChecks: ['Required canonical fields are present', 'At least one order line is present', 'Lifecycle is draft', 'Line quantities are positive']
  },
  {
    id: 'finance.journal-entry.post',
    title: 'Post Journal Entry',
    summary: 'Post a balanced journal entry to the applicable accounting records.',
    kind: 'command',
    businessObject: 'finance.journal-entry',
    definition: `${STANDARD}/domains/finance/capabilities/journal-entry/post.yaml`,
    inputSchema: `${STANDARD}/schemas/objects/finance/journal-entry.schema.json`,
    preconditions: { lifecycle: 'draft' },
    effects: { lifecycle: 'posted' },
    referenceChecks: ['Required canonical fields are present', 'At least two journal lines are present', 'Lifecycle is draft', 'Debits and credits are non-negative', 'Total debits equal total credits']
  },
  {
    id: 'hr.leave-request.submit',
    title: 'Submit Leave Request',
    summary: 'Submit a worker leave request for the applicable business review and approval.',
    kind: 'command',
    businessObject: 'hr.leave-request',
    definition: `${STANDARD}/domains/hr/capabilities/leave-request/submit.yaml`,
    inputSchema: `${STANDARD}/schemas/objects/hr/leave-request.schema.json`,
    preconditions: { lifecycle: 'draft' },
    effects: { lifecycle: 'submitted', approval: 'pending' },
    referenceChecks: ['Required canonical fields are present', 'Lifecycle is draft', 'Start date is not after end date', 'Duration is positive when supplied']
  }
];

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

function response(statusCode, value) {
  return { statusCode, headers, body: JSON.stringify(value, null, 2) };
}

function failure(code, message, details) {
  return { code, message, ...(details === undefined ? {} : { details }) };
}

function missing(payload, fields) {
  return fields.filter((field) => payload == null || payload[field] === undefined || payload[field] === null);
}

function amount(value) {
  return typeof value?.amount === 'number' && Number.isFinite(value.amount) ? value.amount : NaN;
}

function validate(id, payload) {
  const errors = [];

  if (id === 'procurement.purchase-order.submit') {
    const absent = missing(payload, ['number', 'buyer', 'supplier', 'orderDate', 'currency', 'lines', 'status']);
    if (absent.length) return [failure('CANONICAL_PAYLOAD_INVALID', `Missing required canonical fields: ${absent.join(', ')}`)];
    if (!Array.isArray(payload.lines) || payload.lines.length === 0) errors.push(failure('CANONICAL_PAYLOAD_INVALID', 'Purchase Order must contain at least one line.'));
    if (payload.status?.lifecycle !== 'draft') errors.push(failure('BUSINESS_PRECONDITION_NOT_MET', 'Purchase Order must be in draft lifecycle state before it can be submitted.', { expected: 'draft', actual: payload.status?.lifecycle }));
    if (Array.isArray(payload.lines)) payload.lines.forEach((line, index) => {
      const quantity = line?.quantity?.value;
      if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) errors.push(failure('BUSINESS_RULE_VIOLATION', `Purchase Order line ${index + 1} must have a positive quantity.`));
    });
  }

  if (id === 'finance.journal-entry.post') {
    const absent = missing(payload, ['number', 'accountingDate', 'currency', 'lines', 'status']);
    if (absent.length) return [failure('CANONICAL_PAYLOAD_INVALID', `Missing required canonical fields: ${absent.join(', ')}`)];
    if (!Array.isArray(payload.lines) || payload.lines.length < 2) errors.push(failure('CANONICAL_PAYLOAD_INVALID', 'Journal Entry must contain at least two lines.'));
    if (payload.status?.lifecycle !== 'draft') errors.push(failure('BUSINESS_PRECONDITION_NOT_MET', 'Journal Entry must be in draft lifecycle state before it can be posted.', { expected: 'draft', actual: payload.status?.lifecycle }));
    if (Array.isArray(payload.lines) && payload.lines.length) {
      let debitTotal = 0;
      let creditTotal = 0;
      let amountsValid = true;
      payload.lines.forEach((line, index) => {
        const debit = amount(line?.debit);
        const credit = amount(line?.credit);
        if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
          amountsValid = false;
          errors.push(failure('BUSINESS_RULE_VIOLATION', `Journal Entry line ${index + 1} must contain non-negative debit and credit amounts.`));
          return;
        }
        debitTotal += debit;
        creditTotal += credit;
      });
      if (amountsValid && (debitTotal <= 0 || Math.abs(debitTotal - creditTotal) > 0.000001)) errors.push(failure('BUSINESS_RULE_VIOLATION', 'Journal Entry must be balanced before posting.', { debitTotal, creditTotal }));
    }
  }

  if (id === 'hr.leave-request.submit') {
    const absent = missing(payload, ['number', 'worker', 'leaveType', 'startDate', 'endDate', 'status']);
    if (absent.length) return [failure('CANONICAL_PAYLOAD_INVALID', `Missing required canonical fields: ${absent.join(', ')}`)];
    if (payload.status?.lifecycle !== 'draft') errors.push(failure('BUSINESS_PRECONDITION_NOT_MET', 'Leave Request must be in draft lifecycle state before it can be submitted.', { expected: 'draft', actual: payload.status?.lifecycle }));
    if (String(payload.startDate) > String(payload.endDate)) errors.push(failure('BUSINESS_RULE_VIOLATION', 'Leave Request start date must not be after the end date.', { startDate: payload.startDate, endDate: payload.endDate }));
    if (payload.duration !== undefined) {
      const duration = payload.duration?.value;
      if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) errors.push(failure('BUSINESS_RULE_VIOLATION', 'Leave Request duration must be positive when supplied.'));
    }
  }

  return errors;
}

function apply(id, payload) {
  const out = structuredClone(payload);
  const before = structuredClone(payload.status || {});
  if (id === 'procurement.purchase-order.submit') out.status = { ...(out.status || {}), approval: 'pending' };
  if (id === 'finance.journal-entry.post') out.status = { ...(out.status || {}), lifecycle: 'posted' };
  if (id === 'hr.leave-request.submit') out.status = { ...(out.status || {}), lifecycle: 'submitted', approval: 'pending' };
  return { payload: out, transition: { before, after: structuredClone(out.status || {}) } };
}

function capabilityFromPath(event) {
  if (event.pathParameters?.capability) return decodeURIComponent(event.pathParameters.capability);
  const path = event.rawPath || event.path || '';
  const match = path.match(/^\/capabilities\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function parseBody(event) {
  if (!event.body) return null;
  const text = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  return JSON.parse(text);
}

export async function handler(event = {}) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  if (method === 'GET') {
    const id = capabilityFromPath(event) || event.queryStringParameters?.id || null;
    if (!id) return response(200, { abcs: '0.2', reference: true, nonNormative: true, capabilities });
    const found = capabilities.find((capability) => capability.id === id);
    return found
      ? response(200, { abcs: '0.2', reference: true, nonNormative: true, ...found })
      : response(404, { abcs: '0.2', error: failure('CAPABILITY_NOT_SUPPORTED', 'Capability is not implemented by this reference surface.') });
  }

  if (method !== 'POST') return response(405, { error: failure('METHOD_NOT_ALLOWED', 'Use GET or POST.') });

  let body;
  try {
    body = parseBody(event);
  } catch {
    return response(400, { abcs: '0.2', outcome: 'rejected', errors: [failure('INVALID_JSON', 'Request body must be JSON.')] });
  }

  const { abcs, capability, requestId, payload } = body || {};
  if (abcs !== '0.2' || !capability || !requestId || payload === undefined) {
    return response(400, {
      abcs: '0.2', capability: capability || 'unknown', requestId: requestId || 'unknown', outcome: 'rejected',
      errors: [failure('INVALID_ENVELOPE', 'abcs, capability, requestId and payload are required.')]
    });
  }

  const found = capabilities.find((item) => item.id === capability);
  if (!found) return response(404, { abcs: '0.2', capability, requestId, outcome: 'rejected', errors: [failure('CAPABILITY_NOT_SUPPORTED', 'Capability is not implemented by this reference surface.')] });

  const errors = validate(capability, payload);
  if (errors.length) {
    return response(422, {
      abcs: '0.2', capability, requestId, outcome: 'rejected',
      errors: errors.map((item) => item.details ? item : { ...item, details: { schema: found.inputSchema } }),
      reference: { nonNormative: true, definition: found.definition, schema: found.inputSchema }
    });
  }

  const applied = apply(capability, payload);
  return response(200, {
    abcs: '0.2', capability, requestId, outcome: 'completed', payload: applied.payload,
    reference: {
      nonNormative: true,
      definition: found.definition,
      schema: found.inputSchema,
      businessObject: found.businessObject,
      transition: applied.transition
    }
  });
}
