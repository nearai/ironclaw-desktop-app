import {
  filterDesktopVisibleLlmProviders,
  modelDisplayName
} from '../../settings/lib/llm-providers.js';

export function visibleLlmSnapshot(snapshot = {}) {
  const providers = filterDesktopVisibleLlmProviders(
    Array.isArray(snapshot.providers) ? snapshot.providers : []
  );
  const rawActive = snapshot.active || null;
  const active =
    rawActive && providers.some((provider) => provider.id === rawActive.provider_id)
      ? rawActive
      : null;
  return { providers, active };
}

export function providerSetupFailedMessage(failed) {
  if (failed) {
    return 'IronClaw cannot reach NEAR AI Cloud yet. Open setup or retry when the gateway is ready.';
  }
  return 'Connect NEAR AI Cloud before sending your first message.';
}

export function formatProviderLabel(providerId, providerName, fallbackId = 'nearai') {
  const raw = String(providerId || fallbackId || 'nearai').trim();
  const normalized = raw.toLowerCase().replace(/[\s]+/g, '').replace(/[_-]+/g, '_');

  if (normalized === 'nearai') return 'NEAR AI Cloud';
  if (providerName && providerName.trim()) return providerName.trim();
  if (!providerName) return 'External provider';

  const humanized = raw
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return humanized || 'NEAR.AI';
}

export function normalizeModelEntries(models) {
  if (!Array.isArray(models)) return [];
  return models
    .map((model) =>
      typeof model === 'string' ? model : model?.id || model?.model || model?.name || ''
    )
    .map((model) => String(model).trim())
    .filter(Boolean);
}

export function uniqueModelsByDisplayLabel(models) {
  const seen = new Set();
  return normalizeModelEntries(models).filter((model) => {
    const label = modelDisplayName(model).toLowerCase();
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

export function modelForProvider(provider, active) {
  if (!provider) return '';
  if (provider.id === active?.provider_id) return String(active?.model || 'auto');
  return String(provider.active_model || provider.default_model || provider.model || '').trim();
}
