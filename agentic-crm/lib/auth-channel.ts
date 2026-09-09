/**
 * Cross-tab session handoff.
 *
 * The JWT deliberately lives in `sessionStorage`, never `localStorage`: it is
 * scoped to one tab, is not written to disk, and disappears when the browsing
 * session ends, so a token is never left behind on a shared machine. The cost
 * of that choice was the UX complaint this module fixes — opening a link in a
 * NEW TAB started with an empty `sessionStorage` and bounced the user back to
 * the login screen mid-review.
 *
 * The storage model is unchanged. Instead, a tab that has no token asks the
 * tabs that do, over a `BroadcastChannel`:
 *
 *   - `BroadcastChannel` is same-origin by specification. No other site, frame
 *     or extension page on a different origin can join the channel, and nothing
 *     crosses the network.
 *   - Any script able to listen on this channel is already running on our
 *     origin and could read `sessionStorage` directly, so this adds no attack
 *     surface that an XSS would not already have.
 *   - The handed-over value is still only a token: the receiving tab renders
 *     nothing until the backend has verified it (`/api/auth/me` — signature,
 *     expiry and SERVER_BOOT_ID).
 *   - The session still ends when the last tab closes; nothing survives a
 *     browser restart. A tab that finds no other tab open falls through to the
 *     normal login redirect.
 *
 * Sign-out is propagated on the same channel, which tightens the previous
 * behaviour: logging out of one tab now clears every other tab of this origin
 * instead of leaving them authenticated.
 */

const CHANNEL_NAME = 'qcrm-auth';

// Identifies this tab so a request is never answered by the tab that asked
// (a BroadcastChannel delivers to every other channel object of the origin,
// including sibling objects inside the same document).
const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type AuthMessage =
    | { type: 'token:request'; from: string }
    | { type: 'token:offer'; to: string; token: string }
    | { type: 'session:logout'; from: string };

function openChannel(): BroadcastChannel | null {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
    try {
        return new BroadcastChannel(CHANNEL_NAME);
    } catch {
        // Storage/channel access can be blocked (hardened privacy settings).
        // Callers degrade to the pre-existing login redirect.
        return null;
    }
}

/**
 * Serve the other tabs of this origin: hand this tab's token to a tab that is
 * starting up without one, and follow a sign-out broadcast from any tab.
 * Returns an unsubscribe function.
 */
export function startAuthChannel(opts: {
    getToken: () => string | null;
    onRemoteLogout: () => void;
}): () => void {
    const channel = openChannel();
    if (!channel) return () => { /* nothing to tear down */ };

    const onMessage = (event: MessageEvent<AuthMessage>) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'token:request' && msg.from !== TAB_ID) {
            const token = opts.getToken();
            // Only an authenticated tab answers; silence is a valid answer and
            // leaves the asking tab to redirect to login as before.
            if (token) {
                const offer: AuthMessage = { type: 'token:offer', to: msg.from, token };
                try { channel.postMessage(offer); } catch { /* channel closed */ }
            }
            return;
        }

        if (msg.type === 'session:logout' && msg.from !== TAB_ID) {
            opts.onRemoteLogout();
        }
    };

    channel.addEventListener('message', onMessage);
    return () => {
        channel.removeEventListener('message', onMessage);
        try { channel.close(); } catch { /* already closed */ }
    };
}

/**
 * Ask the already-open tabs for the current session token. Resolves with the
 * token, or `null` when no other tab answers inside `timeoutMs` (no tab open,
 * none authenticated, or BroadcastChannel unavailable) — in which case the
 * caller must fall back to the login redirect.
 */
export function requestTokenFromOpenTabs(timeoutMs = 600): Promise<string | null> {
    const channel = openChannel();
    if (!channel) return Promise.resolve(null);

    return new Promise<string | null>((resolve) => {
        let settled = false;

        const finish = (token: string | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            channel.removeEventListener('message', onMessage);
            try { channel.close(); } catch { /* already closed */ }
            resolve(token);
        };

        const onMessage = (event: MessageEvent<AuthMessage>) => {
            const msg = event.data;
            if (!msg || typeof msg !== 'object') return;
            if (msg.type === 'token:offer' && msg.to === TAB_ID && typeof msg.token === 'string' && msg.token) {
                finish(msg.token);
            }
        };

        const timer = setTimeout(() => finish(null), timeoutMs);
        channel.addEventListener('message', onMessage);

        const request: AuthMessage = { type: 'token:request', from: TAB_ID };
        try {
            channel.postMessage(request);
        } catch {
            finish(null);
        }
    });
}

/** Tell every other tab of this origin that the session has been signed out. */
export function broadcastLogout(): void {
    const channel = openChannel();
    if (!channel) return;
    const msg: AuthMessage = { type: 'session:logout', from: TAB_ID };
    try {
        channel.postMessage(msg);
    } catch {
        /* nothing to do — the local sign-out has already happened */
    }
    // Let the message drain before dropping the channel.
    setTimeout(() => { try { channel.close(); } catch { /* already closed */ } }, 0);
}
