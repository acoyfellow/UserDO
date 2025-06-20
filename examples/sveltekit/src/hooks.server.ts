import type { Handle } from '@sveltejs/kit';
import { createUserDOWorker, createWebSocketHandler } from 'userdo';

const userDOWorker = createUserDOWorker('MY_APP_DO');
const wsHandler = createWebSocketHandler('MY_APP_DO');

export const handle: Handle = async ({ event, resolve }) => {
  if (event.request.headers.get('upgrade') === 'websocket') {
    return wsHandler.fetch(event.request, event.platform?.env as any);
  }

  if (event.url.pathname.startsWith('/api')) {
    return userDOWorker.fetch(event.request, event.platform?.env as any);
  }

  return resolve(event);
};
