import { createSvelteKitClient } from '../../../../../src/client';

// Singleton client to prevent double instantiation
let _client: ReturnType<typeof createSvelteKitClient> | null = null;

function getClient() {
  if (!_client) {
    console.log('🏗️ Creating UserDO client singleton');
    _client = createSvelteKitClient();
  }
  return _client;
}

// Export the singleton client
export const client = getClient();

// For server-side usage - use the same singleton
export const serverClient = client; 