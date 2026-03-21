/**
 * Batching : rafales même socket → un emit avec __batch si activé.
 */
describe('broadcast-batcher', () => {
  const OLD = process.env.SOCKET_BROADCAST_BATCH_MS;

  afterEach(() => {
    if (OLD === undefined) delete process.env.SOCKET_BROADCAST_BATCH_MS;
    else process.env.SOCKET_BROADCAST_BATCH_MS = OLD;
    jest.resetModules();
  });

  it('sans batch : un emit par message', () => {
    delete process.env.SOCKET_BROADCAST_BATCH_MS;
    const { createMessageBroadcaster } = require('../../../src/socket/broadcast-batcher');
    const toCalls = [];
    const socket = {
      id: 's1',
      to(room) {
        return {
          emit(ev, payload) {
            toCalls.push({ room, ev, payload });
          },
        };
      },
    };
    const b = createMessageBroadcaster({});
    b.emitChatMessage(socket, 'room:a', { x: 1 });
    b.emitChatMessage(socket, 'room:a', { x: 2 });
    expect(toCalls).toHaveLength(2);
    expect(toCalls[0].payload.x).toBe(1);
    expect(toCalls[1].payload.x).toBe(2);
  });

  it('avec batch : fusionne deux messages même socket/room', async () => {
    jest.useFakeTimers();
    process.env.SOCKET_BROADCAST_BATCH_MS = '50';
    const { createMessageBroadcaster } = require('../../../src/socket/broadcast-batcher');
    const toCalls = [];
    const socket = {
      id: 's1',
      to(room) {
        return {
          emit(ev, payload) {
            toCalls.push({ room, ev, payload });
          },
        };
      },
    };
    const b = createMessageBroadcaster({});
    b.emitChatMessage(socket, 'room:a', { x: 1 });
    b.emitChatMessage(socket, 'room:a', { x: 2 });
    jest.advanceTimersByTime(60);
    expect(toCalls).toHaveLength(1);
    expect(toCalls[0].ev).toBe('new-message');
    expect(toCalls[0].payload.__batch).toBe(true);
    expect(toCalls[0].payload.messages).toEqual([{ x: 1 }, { x: 2 }]);
    b.shutdown();
    jest.useRealTimers();
  });
});
