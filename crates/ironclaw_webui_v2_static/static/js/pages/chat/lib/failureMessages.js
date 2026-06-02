export function failureMessageForRunStatus({ status, failureCategory, failureSummary }) {
  if (typeof failureSummary === 'string' && failureSummary.trim()) {
    return failureSummary.trim();
  }
  const category = normalizedFailureCategory(failureCategory);
  if (isDriverUnavailable(category)) {
    return 'The selected model is configured, but its execution driver is unavailable. Check provider setup or choose a verified model before retrying.';
  }
  if (category === 'model_credentials_unavailable') {
    return 'Model credentials are unavailable. Sign in or update provider credentials before retrying.';
  }
  if (category === 'policy_denied') {
    return 'The selected model is not available for this account or provider plan. Choose a model this account can run, or update provider credentials.';
  }
  if (isModelUnavailable(category)) {
    return 'The selected model is configured, but the gateway says that model is unavailable. Choose a verified model or update the configured model before retrying.';
  }
  if (category) {
    return `The run failed: ${category.replaceAll('_', ' ')}.`;
  }
  return status === 'recovery_required'
    ? 'The run is awaiting recovery — backend reported `recovery_required`.'
    : 'The run failed before producing a reply.';
}

export function failureMessageForApiError(err) {
  const payload = err?.payload;
  const category =
    firstString(
      payload?.failure?.category,
      payload?.failure_category,
      payload?.error?.category,
      payload?.error_category,
      payload?.category,
      payload?.code,
      payload?.error_code,
      payload?.reason,
      err?.message
    ) || '';
  const summary =
    firstString(
      payload?.failure?.summary,
      payload?.failure_summary,
      payload?.summary,
      payload?.detail,
      payload?.message
    ) || '';

  if (isDriverUnavailable(normalizedFailureCategory(category))) {
    return failureMessageForRunStatus({
      status: 'failed',
      failureCategory: 'driver_unavailable',
      failureSummary: ''
    });
  }
  if (isModelUnavailable(normalizedFailureCategory(category))) {
    return failureMessageForRunStatus({
      status: 'failed',
      failureCategory: 'model_unavailable',
      failureSummary: ''
    });
  }
  if (
    ['model_credentials_unavailable', 'policy_denied'].includes(normalizedFailureCategory(category))
  ) {
    return failureMessageForRunStatus({
      status: 'failed',
      failureCategory: category,
      failureSummary: ''
    });
  }
  if (summary.trim()) return summary.trim();
  if (typeof err?.message === 'string' && err.message.trim()) return err.message.trim();
  return 'The run failed before producing a reply.';
}

function normalizedFailureCategory(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isDriverUnavailable(category) {
  return /(^|_)driver(_|$)/.test(category) && /unavailable|not_available|missing/.test(category);
}

function isModelUnavailable(category) {
  return /(^|_)model(_|$)/.test(category) && /unavailable|not_available|missing/.test(category);
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || '';
}
