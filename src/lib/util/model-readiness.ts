export type ModelExecutionReadiness = {
  verified: boolean;
  sendBlocked: boolean;
  tone: 'positive' | 'warning';
  label: string;
  buttonPrefix: string;
  description: string;
  sendBlockReason: string;
};

const UNVERIFIED: ModelExecutionReadiness = {
  verified: false,
  sendBlocked: true,
  tone: 'warning',
  label: 'Configured, unverified',
  buttonPrefix: 'Configured (unverified)',
  description: 'Gateway has not verified this model can execute yet.',
  sendBlockReason:
    'The selected model has not passed an execution test. Choose a verified model before sending.'
};

const VERIFIED: ModelExecutionReadiness = {
  verified: true,
  sendBlocked: false,
  tone: 'positive',
  label: 'Execution verified',
  buttonPrefix: 'Verified',
  description: 'Gateway reports this model is execution-ready.',
  sendBlockReason: ''
};

export function modelExecutionReadiness(gatewayStatus: unknown): ModelExecutionReadiness {
  if (isModelExecutionVerified(gatewayStatus)) return VERIFIED;
  const reason = modelExecutionBlockReason(gatewayStatus);
  if (!reason) return UNVERIFIED;
  return {
    ...UNVERIFIED,
    description: reason,
    sendBlockReason: `The selected model has not passed an execution test. ${reason}`
  };
}

export function isModelExecutionVerified(gatewayStatus: unknown): boolean {
  if (!gatewayStatus || typeof gatewayStatus !== 'object') return false;
  const record = gatewayStatus as Record<string, unknown>;
  if (record.model_execution_verified === true) return true;
  if (record.modelExecutionVerified === true) return true;

  return [
    record.model_execution_readiness,
    record.modelExecutionReadiness,
    record.model_readiness,
    record.modelReadiness,
    record.llm_model_readiness,
    record.llmModelReadiness,
    record.llm_readiness,
    record.llmReadiness,
    record.execution_readiness,
    record.executionReadiness,
    record.readiness
  ].some(isGreenReadiness);
}

function isGreenReadiness(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().toLowerCase() === 'green';
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return [
    record.status,
    record.phase,
    record.model_execution,
    record.modelExecution,
    record.model_execution_readiness,
    record.modelExecutionReadiness,
    record.model,
    record.llm_model,
    record.llmModel,
    record.llm,
    record.execution
  ].some(isGreenReadiness);
}

function modelExecutionBlockReason(gatewayStatus: unknown): string {
  if (!gatewayStatus || typeof gatewayStatus !== 'object') return '';
  const record = gatewayStatus as Record<string, unknown>;
  return (
    [
      record.model_readiness_reason,
      record.modelReadinessReason,
      record.model_execution_failure_summary,
      record.modelExecutionFailureSummary,
      record.model_execution_failure_category,
      record.modelExecutionFailureCategory
    ]
      .map(stringValue)
      .find((value) => value.length > 0) ?? ''
  );
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
