export function primaryExtensionAction(ext) {
  const state =
    ext?.onboarding_state || ext?.activation_status || (ext?.active ? 'active' : 'installed');

  if (!ext?.package_ref || state === 'active' || state === 'ready') {
    return null;
  }

  if (state === 'auth_required' || state === 'setup_required' || state === 'failed') {
    return 'configure';
  }

  if (ext.kind === 'wasm_channel') {
    return null;
  }

  return 'activate';
}

export function setupReadyForActivation({ secrets = [], fields = [] } = {}) {
  if (fields.length > 0 || secrets.length === 0) {
    return false;
  }
  return secrets.every((secret) => secret.provided);
}

export function registryConnectButtonState(connectPhase = {}) {
  switch (connectPhase?.phase) {
    case 'installing':
    case 'authorizing':
      return { label: 'Connecting...', disabled: true, action: 'wait', variant: 'primary' };
    case 'waiting':
      return {
        label: 'Finish in your browser...',
        disabled: true,
        action: 'wait',
        variant: 'primary'
      };
    case 'activating':
      return { label: 'Turning on...', disabled: true, action: 'wait', variant: 'primary' };
    case 'connected':
      return { label: 'Connected', disabled: true, action: 'none', variant: 'secondary' };
    case 'needs-token':
      return { label: 'Open setup', disabled: false, action: 'manual_setup', variant: 'secondary' };
    case 'error':
      return { label: 'Retry connect', disabled: false, action: 'connect', variant: 'primary' };
    default:
      return { label: 'Connect', disabled: false, action: 'connect', variant: 'primary' };
  }
}
