const UNVERIFIED = {
  verified: false,
  sendBlocked: false,
  tone: 'warning',
  label: 'Configured, unverified',
  buttonPrefix: 'Configured',
  description:
    'This model has not completed a live run yet. Send a message to verify execution; provider failures will appear in the thread.',
  sendBlockReason: ''
};

const BLOCKED = {
  verified: false,
  sendBlocked: true,
  tone: 'warning',
  label: 'Model setup required',
  buttonPrefix: 'Setup required',
  description: 'The configured model cannot run until provider setup is fixed.',
  sendBlockReason: 'The configured model cannot run until provider setup is fixed.'
};

const VERIFIED = {
  verified: true,
  sendBlocked: false,
  tone: 'positive',
  label: 'Execution verified',
  buttonPrefix: 'Verified',
  description: 'Gateway reports this model is execution-ready.',
  sendBlockReason: ''
};

export function modelExecutionReadiness(gatewayStatus) {
  if (isModelExecutionVerified(gatewayStatus)) return VERIFIED;
  const reason = modelExecutionBlockReason(gatewayStatus);
  if (!reason) return UNVERIFIED;
  return {
    ...BLOCKED,
    description: reason,
    sendBlockReason: reason
  };
}

export function isModelExecutionVerified(gatewayStatus) {
  if (!gatewayStatus || typeof gatewayStatus !== 'object') return false;
  if (gatewayStatus.model_execution_verified === true) return true;
  if (gatewayStatus.modelExecutionVerified === true) return true;

  return [
    gatewayStatus.model_execution_readiness,
    gatewayStatus.modelExecutionReadiness,
    gatewayStatus.model_readiness,
    gatewayStatus.modelReadiness,
    gatewayStatus.llm_model_readiness,
    gatewayStatus.llmModelReadiness,
    gatewayStatus.llm_readiness,
    gatewayStatus.llmReadiness,
    gatewayStatus.execution_readiness,
    gatewayStatus.executionReadiness,
    gatewayStatus.readiness
  ].some(isGreenReadiness);
}

function isGreenReadiness(value) {
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'green';
  }
  if (!value || typeof value !== 'object') return false;
  return [
    value.status,
    value.phase,
    value.model_execution,
    value.modelExecution,
    value.model_execution_readiness,
    value.modelExecutionReadiness,
    value.model,
    value.llm_model,
    value.llmModel,
    value.llm,
    value.execution
  ].some(isGreenReadiness);
}

function modelExecutionBlockReason(gatewayStatus) {
  if (!gatewayStatus || typeof gatewayStatus !== 'object') return '';
  const readinessValues = [
    gatewayStatus.model_execution_readiness,
    gatewayStatus.modelExecutionReadiness,
    gatewayStatus.model_readiness,
    gatewayStatus.modelReadiness,
    gatewayStatus.llm_model_readiness,
    gatewayStatus.llmModelReadiness,
    gatewayStatus.llm_readiness,
    gatewayStatus.llmReadiness,
    gatewayStatus.execution_readiness,
    gatewayStatus.executionReadiness,
    gatewayStatus.readiness
  ];
  const category =
    [
      gatewayStatus.model_execution_failure_category,
      gatewayStatus.modelExecutionFailureCategory,
      ...readinessValues
    ]
      .map(blockingToken)
      .find((value) => value.length > 0) || '';
  const reason =
    [
      gatewayStatus.model_readiness_reason,
      gatewayStatus.modelReadinessReason,
      gatewayStatus.model_execution_failure_summary,
      gatewayStatus.modelExecutionFailureSummary
    ]
      .map(stringValue)
      .find(isBlockingText) || '';

  if (reason) return reason;
  if (category) return category.replaceAll('_', ' ');
  return '';
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function blockingToken(value) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return isBlockingText(normalized) ? normalized : '';
  }
  if (!value || typeof value !== 'object') return '';
  return (
    [
      value.status,
      value.phase,
      value.category,
      value.reason,
      value.model_execution_failure_category,
      value.modelExecutionFailureCategory,
      value.model_execution_readiness,
      value.modelExecutionReadiness,
      value.model_readiness,
      value.modelReadiness,
      value.execution
    ]
      .map(blockingToken)
      .find((token) => token.length > 0) || ''
  );
}

function isBlockingText(value) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'unverified' || normalized === 'configured') return false;
  if (normalized.includes('policy_denied')) return true;
  if (/(credential|token|api[_ -]?key|session[_ -]?token|auth)/.test(normalized)) {
    return /(missing|required|unavailable|not[_ -]?configured|no |sign in|authenticate|vaulted)/.test(
      normalized
    );
  }
  if (/(driver|provider|model).*(unavailable|missing|not[_ -]?available)/.test(normalized)) {
    return true;
  }
  return false;
}
