/**
 * The cross-tab session handoff. Each `loadTabModule()` call gives a fresh copy
 * of lib/auth-channel with its own tab id, which is how one jsdom document can
 * stand in for two browser tabs.
 */

type AuthChannelModule = typeof import('../../lib/auth-channel');

function loadTabModule(): AuthChannelModule {
  let mod!: AuthChannelModule;
  jest.isolateModules(() => {
    mod = require('../../lib/auth-channel');
  });
  return mod;
}

// jsdom does not implement BroadcastChannel; Node's is spec-compatible for the
// same-origin, same-process case these tests exercise.
beforeAll(() => {
  if (typeof (globalThis as any).BroadcastChannel === 'undefined') {
    (globalThis as any).BroadcastChannel = require('worker_threads').BroadcastChannel;
  }
});

describe('cross-tab session handoff', () => {
  it('hands the token from an authenticated tab to a new one', async () => {
    const openTab = loadTabModule();
    const newTab = loadTabModule();

    const stop = openTab.startAuthChannel({
      getToken: () => 'jwt-from-the-open-tab',
      onRemoteLogout: () => { /* not exercised here */ },
    });

    await expect(newTab.requestTokenFromOpenTabs(500)).resolves.toBe('jwt-from-the-open-tab');
    stop();
  });

  it('resolves null when no other tab is open, so the caller still redirects to login', async () => {
    const newTab = loadTabModule();
    await expect(newTab.requestTokenFromOpenTabs(80)).resolves.toBeNull();
  });

  it('stays silent when the other tab is not authenticated', async () => {
    const openTab = loadTabModule();
    const newTab = loadTabModule();

    const stop = openTab.startAuthChannel({
      getToken: () => null,
      onRemoteLogout: () => { /* not exercised here */ },
    });

    await expect(newTab.requestTokenFromOpenTabs(120)).resolves.toBeNull();
    stop();
  });

  it('does not answer its own request', async () => {
    // A tab runs both halves; the serving half must ignore its own broadcast,
    // otherwise a tab could "hand" itself a token it does not have.
    const tab = loadTabModule();
    const getToken = jest.fn(() => 'jwt');
    const stop = tab.startAuthChannel({ getToken, onRemoteLogout: () => {} });

    await tab.requestTokenFromOpenTabs(120);
    expect(getToken).not.toHaveBeenCalled();
    stop();
  });

  it('propagates sign-out to the other tabs', async () => {
    const tabA = loadTabModule();
    const tabB = loadTabModule();

    const onRemoteLogout = jest.fn();
    const stop = tabB.startAuthChannel({ getToken: () => 'jwt', onRemoteLogout });

    tabA.broadcastLogout();
    await new Promise((r) => setTimeout(r, 100));

    expect(onRemoteLogout).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stops serving other tabs once unsubscribed', async () => {
    const openTab = loadTabModule();
    const newTab = loadTabModule();

    const stop = openTab.startAuthChannel({ getToken: () => 'jwt', onRemoteLogout: () => {} });
    stop();

    await expect(newTab.requestTokenFromOpenTabs(120)).resolves.toBeNull();
  });
});
