import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildPassengerSocketIoOptions } from '../lib/socketIoClientOptions';

describe('buildPassengerSocketIoOptions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('défaut : reconnexion, path /socket.io, websocket only', () => {
    vi.stubEnv('VITE_SOCKET_RECONNECTION', undefined);
    vi.stubEnv('VITE_SOCKET_RECONNECTION_ATTEMPTS', undefined);
    vi.stubEnv('VITE_SOCKET_TIMEOUT_MS', undefined);
    const o = buildPassengerSocketIoOptions('tok');
    expect(o.path).toBe('/socket.io');
    expect(o.transports).toEqual(['websocket']);
    expect(o.reconnection).toBe(true);
    expect(o.reconnectionAttempts).toBe(10);
    expect(o.auth.token).toBe('tok');
  });

  it('VITE_SOCKET_RECONNECTION=0 désactive la reconnexion', () => {
    vi.stubEnv('VITE_SOCKET_RECONNECTION', '0');
    const o = buildPassengerSocketIoOptions('');
    expect(o.reconnection).toBe(false);
    expect(o.reconnectionDelay).toBeUndefined();
  });
});
