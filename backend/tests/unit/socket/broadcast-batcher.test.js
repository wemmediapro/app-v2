/**
 * Batching : messageManager — rafales même socket → un emit avec __batch si activé.
 */
describe('broadcast-batcher / messageManager', () => {
  const OLD_MS = process.env.SOCKET_BROADCAST_BATCH_MS;
  const OLD_SIZE = process.env.SOCKET_BROADCAST_BATCH_SIZE;
  const OLD_COMPACT = process.env.SOCKET_MESSAGE_COMPACT;

  afterEach(() => {
    if (OLD_MS === undefined) delete process.env.SOCKET_BROADCAST_BATCH_MS;
    else process.env.SOCKET_BROADCAST_BATCH_MS = OLD_MS;
    if (OLD_SIZE === undefined) delete process.env.SOCKET_BROADCAST_BATCH_SIZE;
    else process.env.SOCKET_BROADCAST_BATCH_SIZE = OLD_SIZE;
    if (OLD_COMPACT === undefined) delete process.env.SOCKET_MESSAGE_COMPACT;
    else process.env.SOCKET_MESSAGE_COMPACT = OLD_COMPACT;
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

  it('flush immédiat quand SOCKET_BROADCAST_BATCH_SIZE atteint', () => {
    process.env.SOCKET_BROADCAST_BATCH_MS = '5000';
    process.env.SOCKET_BROADCAST_BATCH_SIZE = '2';
    const { createMessageBroadcaster } = require('../../../src/socket/messageManager');
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
    expect(toCalls).toHaveLength(1);
    expect(toCalls[0].payload.__batch).toBe(true);
    expect(toCalls[0].payload.messages).toEqual([{ x: 1 }, { x: 2 }]);
    b.shutdown();
  });

  it('mode compact : batch avec __compact et clés courtes', () => {
    jest.useFakeTimers();
    process.env.SOCKET_BROADCAST_BATCH_MS = '50';
    process.env.SOCKET_MESSAGE_COMPACT = '1';
    const { createMessageBroadcaster } = require('../../../src/socket/messageManager');
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
    const p1 = {
      room: 'room:a',
      content: 'hi',
      text: 'hi',
      senderId: 'u1',
      sender: 'u1',
      timestamp: new Date(1e12),
    };
    b.emitChatMessage(socket, 'room:a', p1);
    b.emitChatMessage(socket, 'room:a', { ...p1, content: 'yo', text: 'yo' });
    jest.advanceTimersByTime(60);
    expect(toCalls).toHaveLength(1);
    expect(toCalls[0].payload.__compact).toBe(true);
    expect(toCalls[0].payload.messages[0]).toMatchObject({
      r: 'room:a',
      c: 'hi',
      u: 'u1',
      ts: 1e12,
    });
    b.shutdown();
    jest.useRealTimers();
  });
});
