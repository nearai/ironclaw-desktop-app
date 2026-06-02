const UNVERIFIED = {
  verified: false,
  sendBlocked: true,
  tone: 'warning',
  label: 'Configured, unverified',
  buttonPrefix: 'Configured (unverified)',
  description: 'Gateway has not verified this model can execute yet.',
  sendBlockReason:
    'The selected model has not passed an execution test. Choose a verified model before sending.'
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
  return isModelExecutionVerified(gatewayStatus) ? VERIFIED : UNVERIFIED;
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
