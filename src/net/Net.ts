import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import type { MatchSetup } from '../data/types';

// ---------------------------------------------------------------------------
// Online play: two browsers talk directly (WebRTC data channel via PeerJS).
// The free PeerJS cloud server only introduces the two players; game data goes
// peer to peer. One player creates a room (a 5-digit code), the other joins it.
// ---------------------------------------------------------------------------

export type NetMsg =
  | { t: 'hello'; v: string }
  | { t: 'cursor'; i: number }
  | { t: 'lock'; id: string }
  | { t: 'unlock' }
  | { t: 'start'; setup: MatchSetup }
  /** the host's arena picker moved */
  | { t: 'arena'; i: number }
  | { t: 'in'; m: number; f: number; k: number }
  | { t: 'sum'; m: number; f: number; h: number }
  | { t: 'rematch' }
  | { t: 'select' }
  | { t: 'bye' }
  /** this player's made fighters (CREATE FIGHTER), sent once on connect */
  | { t: 'customs'; list: unknown[] };

type Handler = (msg: NetMsg) => void;

const ID_PREFIX = 'trenches-kombat-v1-';
export const BUILD_ID: string = __BUILD_ID__;

/** PeerJS options; ?peer=host:port points at a self-hosted server (used by the tests) */
function peerOptions(): PeerOptions {
  const opts: PeerOptions = {
    debug: 0,
    config: {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }],
    },
  };
  const custom = new URLSearchParams(location.search).get('peer');
  if (custom) {
    const [host, port] = custom.split(':');
    Object.assign(opts, { host, port: Number(port) || 9000, path: '/', secure: false });
  }
  return opts;
}

function randomCode() {
  return String(10000 + Math.floor(Math.random() * 90000));
}

class NetLink {
  role: 'host' | 'guest' | null = null;
  code = '';
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private handlers = new Set<Handler>();
  private closeHandlers = new Set<() => void>();
  /** remote inputs and checksums per match, buffered until the fight scene reads them */
  readonly inputs = new Map<number, Map<number, number>>();
  readonly sums = new Map<number, Map<number, number>>();

  get connected() {
    return !!this.conn && this.conn.open;
  }

  /** which fighter this player controls */
  get localSide(): 0 | 1 {
    return this.role === 'guest' ? 1 : 0;
  }

  /** create a room; resolves with the code once the room exists */
  host(onGuest: () => void): Promise<string> {
    this.leave();
    this.role = 'host';
    return new Promise((resolve, reject) => {
      const tryCode = (attempt: number) => {
        const code = randomCode();
        const peer = new Peer(ID_PREFIX + code, peerOptions());
        this.peer = peer;
        peer.on('open', () => {
          this.code = code;
          resolve(code);
        });
        peer.on('connection', (c) => {
          if (this.conn) {
            c.on('open', () => c.close());
            return;
          }
          this.attach(c);
          c.on('open', onGuest);
        });
        peer.on('error', (e: { type?: string }) => {
          if (e.type === 'unavailable-id' && attempt < 5) {
            peer.destroy();
            tryCode(attempt + 1);
          } else if (!this.code) reject(new Error(describe(e.type)));
        });
        peer.on('disconnected', () => {
          // lost the matchmaking server; an open match keeps working peer to peer
          if (!this.conn) peer.reconnect();
        });
      };
      tryCode(0);
    });
  }

  /** join a room by code */
  join(code: string): Promise<void> {
    this.leave();
    this.role = 'guest';
    this.code = code;
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerOptions());
      this.peer = peer;
      const timer = setTimeout(() => reject(new Error("Couldn't connect. Your network may block direct connections; try another Wi-Fi or mobile data.")), 20000);
      peer.on('open', () => {
        const c = peer.connect(ID_PREFIX + code, { reliable: true });
        this.attach(c);
        c.on('open', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      peer.on('error', (e: { type?: string }) => {
        clearTimeout(timer);
        reject(new Error(describe(e.type)));
      });
    });
  }

  private attach(c: DataConnection) {
    this.conn = c;
    c.on('data', (d) => this.receive(d as NetMsg));
    c.on('close', () => this.lost());
    c.on('error', () => this.lost());
  }

  private receive(msg: NetMsg) {
    if (msg.t === 'in') {
      let m = this.inputs.get(msg.m);
      if (!m) this.inputs.set(msg.m, (m = new Map()));
      m.set(msg.f, msg.k);
      return;
    }
    if (msg.t === 'sum') {
      let m = this.sums.get(msg.m);
      if (!m) this.sums.set(msg.m, (m = new Map()));
      m.set(msg.f, msg.h);
      return;
    }
    if (msg.t === 'bye') {
      this.lost();
      return;
    }
    // between screens nobody is listening: keep it for the next screen (e.g. a quick
    // "rematch" while this player is still watching the fatality)
    if (!this.handlers.size) {
      this.pending.push(msg);
      if (this.pending.length > 50) this.pending.shift();
      return;
    }
    for (const h of [...this.handlers]) h(msg);
  }
  private pending: NetMsg[] = [];

  private lost() {
    if (!this.conn) return;
    this.conn = null;
    for (const h of [...this.closeHandlers]) h();
    this.peer?.destroy();
    this.peer = null;
    this.role = null;
  }

  send(msg: NetMsg) {
    if (this.conn?.open) this.conn.send(msg);
  }

  /** listen for messages while a scene is running; removed when the scene shuts down */
  listen(scene: Phaser.Scene, fn: Handler) {
    this.handlers.add(fn);
    scene.events.once('shutdown', () => this.handlers.delete(fn));
    const queued = this.pending.splice(0);
    if (queued.length) scene.time.delayedCall(0, () => queued.forEach(fn));
  }

  /** called once if the other player leaves or the connection drops */
  onClose(scene: Phaser.Scene, fn: () => void) {
    this.closeHandlers.add(fn);
    scene.events.once('shutdown', () => this.closeHandlers.delete(fn));
  }

  private matchNo = 0;

  /** host: number and seed for the next match */
  newMatch(): { match: number; seed: number } {
    this.matchNo++;
    return { match: this.matchNo, seed: Math.floor(Math.random() * 2 ** 32) };
  }

  /** forget buffered data of older matches */
  startMatch(match: number) {
    for (const k of [...this.inputs.keys()]) if (k < match) this.inputs.delete(k);
    for (const k of [...this.sums.keys()]) if (k < match) this.sums.delete(k);
  }

  leave() {
    if (this.conn?.open) {
      try {
        this.conn.send({ t: 'bye' });
      } catch {
        /* closing anyway */
      }
    }
    const c = this.conn;
    this.conn = null;
    setTimeout(() => c?.close(), 100);
    this.peer?.destroy();
    this.peer = null;
    this.role = null;
    this.code = '';
    this.matchNo = 0;
    this.pending = [];
    this.inputs.clear();
    this.sums.clear();
  }
}

function describe(type?: string) {
  switch (type) {
    case 'peer-unavailable':
      return 'Room not found. Check the code, and make sure your friend is still on the room screen.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return "Couldn't reach the online server. Check your internet and try again.";
    case 'browser-incompatible':
      return "This browser can't play online. Try Chrome, Safari or Firefox.";
    default:
      return 'Connection failed. Try again.';
  }
}

export const net = new NetLink();
