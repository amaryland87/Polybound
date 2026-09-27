// Peer-to-peer connection for online games, using PeerJS and its free public signalling server.
// Nothing about the game goes through a server: once connected, moves travel directly between browsers.
import type { DataConnection, Peer, PeerOptions } from 'peerjs';
import { NetMessage, parseMessage, PROTOCOL_VERSION } from './netProtocol';

const ID_PREFIX = 'polybound-v1-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I/L
export const CODE_LENGTH = 5;

// Optional self-hosted PeerServer, e.g. VITE_PEER_SERVER=https://peer.example.com/polybound at build time
function peerOptions(): PeerOptions {
  const server = import.meta.env.VITE_PEER_SERVER as string | undefined;
  if (!server) return { debug: 0 };
  const url = new URL(server);
  const secure = url.protocol === 'https:';
  return { host: url.hostname, port: Number(url.port) || (secure ? 443 : 80), path: url.pathname, secure, debug: 0 };
}

export const makeCode = () =>
  Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

export interface Link {
  send: (msg: NetMessage) => void;
}

export interface LinkEvents {
  onCode?: (code: string) => void; // host only: the room code is ready to share
  onOpen: (link: Link) => void;
  onMessage: (msg: NetMessage) => void;
  onClose: () => void;
  onError: (text: string) => void;
}

function describe(err: { type?: string; message?: string }): string {
  switch (err.type) {
    case 'peer-unavailable': return 'No game found with that code.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed': return "Couldn't reach the matchmaking server. Check your connection and try again.";
    case 'browser-incompatible': return "This browser doesn't support online play.";
    default: return err.message || 'Connection failed.';
  }
}

// Opens a connection as host (code omitted) or guest. Returns a function that closes everything.
export function connect(events: LinkEvents, joinCode?: string): () => void {
  let peer: Peer | null = null;
  let conn: DataConnection | null = null;
  let closed = false;
  let opened = false;

  let helloTimer = 0;
  const stopHello = () => window.clearInterval(helloTimer);

  const wire = (c: DataConnection) => {
    conn = c;
    const hello = () => { if (c.open) c.send({ t: 'hello', v: PROTOCOL_VERSION }); };
    c.on('open', () => {
      if (closed) return;
      opened = true;
      events.onOpen({ send: msg => { if (c.open) c.send(msg); } });
      hello();
      // Messages sent the instant a channel opens can be lost, so the guest repeats its hello until the host answers
      if (joinCode) helloTimer = window.setInterval(hello, 700);
    });
    c.on('data', data => {
      const msg = parseMessage(data);
      if (!msg || closed) return;
      if (msg.t !== 'hello') stopHello();
      if (msg.t === 'hello' && msg.v !== PROTOCOL_VERSION) {
        events.onError('Your opponent is running a different version of the game. Both of you should reload the page.');
        return;
      }
      events.onMessage(msg);
    });
    c.on('close', () => {
      stopHello();
      if (!closed) events.onClose();
    });
    c.on('error', err => { if (!closed) events.onError(describe(err)); });
  };

  const start = async (attempt: number) => {
    let PeerCtor: typeof Peer;
    try {
      PeerCtor = (await import('peerjs')).Peer;
    } catch {
      events.onError("Couldn't load online play. Check your connection and try again.");
      return;
    }
    if (closed) return;
    const code = joinCode ? null : makeCode();
    const p = code ? new PeerCtor(ID_PREFIX + code, peerOptions()) : new PeerCtor(peerOptions());
    peer = p;
    p.on('open', () => {
      if (closed) return;
      if (code) events.onCode?.(code);
      else wire(p.connect(ID_PREFIX + normalizeCode(joinCode!), { reliable: true }));
    });
    p.on('connection', c => {
      // One opponent per room
      if (conn || closed) { c.close(); return; }
      wire(c);
    });
    p.on('error', err => {
      if (closed) return;
      if (err.type === 'unavailable-id' && attempt < 3) {
        p.destroy();
        void start(attempt + 1);
        return;
      }
      // Losing the signalling server after connecting doesn't affect the direct link
      if (opened && (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-closed')) return;
      events.onError(describe(err));
    });
  };
  void start(0);

  return () => {
    closed = true;
    stopHello();
    conn?.close();
    peer?.destroy();
  };
}
