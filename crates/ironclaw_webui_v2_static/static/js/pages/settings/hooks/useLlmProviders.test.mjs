import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveProviderSnapshot } from './useLlmProviders.js';

test('deriveProviderSnapshot does not treat gateway diagnostics as active provider state', () => {
  const state = deriveProviderSnapshot({
    providers: [
      {
        id: 'nearai',
        description: 'multi-model access via NEAR account',
        adapter: 'nearai',
        default_model: 'auto',
        builtin: true,
        api_key_required: false,
        accepts_api_key: true,
        api_key_set: false
      }
    ],
    active: null
  });

  assert.equal(state.hasActiveProvider, false);
  assert.equal(state.activeProviderId, '');
  assert.equal(state.selectedModel, '');
  assert.equal(state.allProviders[0].name, 'multi-model access via NEAR account');
});

test('deriveProviderSnapshot uses only the Reborn active provider snapshot', () => {
  const state = deriveProviderSnapshot({
    providers: [
      {
        id: 'nearai',
        description: 'multi-model access via NEAR account',
        adapter: 'nearai',
        default_model: 'auto',
        builtin: true,
        api_key_set: false
      },
      {
        id: 'openrouter',
        description: 'OpenRouter',
        adapter: 'open_router',
        default_model: 'z-ai/glm-4.5',
        builtin: true,
        api_key_set: true
      }
    ],
    active: {
      provider_id: 'openrouter',
      model: 'z-ai/glm-4.5'
    }
  });

  assert.equal(state.hasActiveProvider, true);
  assert.equal(state.activeProviderId, 'openrouter');
  assert.equal(state.selectedModel, 'z-ai/glm-4.5');
  assert.equal(
    state.allProviders.find((provider) => provider.id === 'openrouter').has_api_key,
    true
  );
});
