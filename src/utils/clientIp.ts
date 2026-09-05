/**
 * MIRRORED MODULE — keep byte-identical with the copy in the sibling service:
 *   CloudyMessageRelay/src/utils/clientIp.ts
 *   CloudyArtistAdminPage/API/src/utils/clientIp.ts
 *
 * These are separate repositories, so the file is duplicated rather than
 * shared. It resolves the address that rate limiting keys on, which is a
 * security control: a fix applied to one copy must be applied to the other.
 * `diff` the two files before changing either. Both are covered by an identical
 * test suite, so a behavioural drift shows up as a test failure on one side.
 */
import net from 'node:net';

/**
 * Resolving the real client address is only safe if you first know whether the
 * thing that connected to you is allowed to speak for someone else. Forwarding
 * headers (`CF-Connecting-IP`, `X-Forwarded-For`) are just request text: anyone
 * who can reach this process can set them.
 *
 * So the rule here is a single one, applied before any header is read:
 *
 *   Trust headers only when the socket peer is a configured trusted proxy.
 *   Otherwise the peer *is* the client, and every header is ignored.
 *
 * That holds in every topology — Cloudflare Tunnel, a same-host reverse proxy,
 * direct exposure with no proxy at all, or local development — without the app
 * needing to know which one it is running in.
 */

export type ClientIpSource = 'auto' | 'cloudflare' | 'xff' | 'socket';

/** Strip the `::ffff:` wrapper so a dual-stack socket and a v4 header agree. */
export function normalizeIp(address: string | undefined): string {
  if (!address) return '';
  const trimmed = address.trim();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed);
  return (mapped ? mapped[1] : trimmed).toLowerCase();
}

export function isValidIp(address: string): boolean {
  return net.isIP(address) !== 0;
}

const PRIVATE_V4: Array<[string, number]> = [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['169.254.0.0', 16],
];

/**
 * Build the set of peers permitted to assert a client address on someone's
 * behalf. Accepts `loopback`, `private`, bare IPs, and CIDR blocks.
 */
export function buildTrustedPeers(spec: string): net.BlockList {
  const list = new net.BlockList();

  for (const raw of spec.split(',').map((part) => part.trim()).filter(Boolean)) {
    const entry = raw.toLowerCase();

    if (entry === 'loopback') {
      list.addSubnet('127.0.0.0', 8, 'ipv4');
      list.addAddress('::1', 'ipv6');
      continue;
    }

    if (entry === 'private') {
      for (const [addr, prefix] of PRIVATE_V4) list.addSubnet(addr, prefix, 'ipv4');
      list.addSubnet('fc00::', 7, 'ipv6');
      continue;
    }

    if (entry.includes('/')) {
      const [addr, prefixText] = entry.split('/');
      const normalized = normalizeIp(addr);
      const prefix = Number.parseInt(prefixText, 10);
      if (isValidIp(normalized) && Number.isFinite(prefix)) {
        list.addSubnet(normalized, prefix, net.isIPv6(normalized) ? 'ipv6' : 'ipv4');
      }
      continue;
    }

    const normalized = normalizeIp(entry);
    if (isValidIp(normalized)) {
      list.addAddress(normalized, net.isIPv6(normalized) ? 'ipv6' : 'ipv4');
    }
  }

  return list;
}

export function isTrustedPeer(peers: net.BlockList, address: string): boolean {
  if (!isValidIp(address)) return false;
  try {
    return peers.check(address, net.isIPv6(address) ? 'ipv6' : 'ipv4');
  } catch {
    return false;
  }
}

/**
 * A single IPv6 user is typically handed an entire /64, so limiting per exact
 * address is bypassed by rotating within it. Bucket v6 by prefix; v4 is used
 * whole.
 */
export function toRateLimitKey(address: string): string {
  if (!net.isIPv6(address)) return address;

  const [head, tail = ''] = address.split('::');
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = 8 - headParts.length - tailParts.length;
  const full = [
    ...headParts,
    ...Array.from({ length: Math.max(0, missing) }, () => '0'),
    ...tailParts,
  ];

  return `${full.slice(0, 4).map((h) => h.padStart(4, '0')).join(':')}::/64`;
}

export type ResolverOptions = {
  source: ClientIpSource;
  trustedPeers: net.BlockList;
};

type MinimalRequest = {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string | undefined };
  ip?: string | undefined;
};

function headerValue(req: MinimalRequest, name: string): string | undefined {
  const raw = req.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Resolve the address to attribute this request to.
 *
 * `peerTrusted` gates everything: when the connection did not come from a known
 * proxy, the peer is the client and no header can override that.
 */
export function resolveClientIp(req: MinimalRequest, options: ResolverOptions): string {
  const peer = normalizeIp(req.socket.remoteAddress);
  const peerTrusted = isTrustedPeer(options.trustedPeers, peer);

  if (!peerTrusted || options.source === 'socket') {
    return isValidIp(peer) ? peer : 'unknown';
  }

  if (options.source === 'auto' || options.source === 'cloudflare') {
    const candidate = normalizeIp(headerValue(req, 'cf-connecting-ip'));
    if (isValidIp(candidate)) return candidate;
    if (options.source === 'cloudflare') {
      return isValidIp(peer) ? peer : 'unknown';
    }
  }

  // Express derives req.ip from X-Forwarded-For using the app's `trust proxy`
  // setting, so hop handling stays in one place.
  const forwarded = normalizeIp(req.ip);
  if (isValidIp(forwarded)) return forwarded;

  return isValidIp(peer) ? peer : 'unknown';
}
