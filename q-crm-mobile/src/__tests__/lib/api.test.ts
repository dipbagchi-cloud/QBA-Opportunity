/**
 * Unit tests for the API client (src/lib/api.ts).
 * Mocks global fetch; AsyncStorage is mocked in jest.setup.js.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiClient,
  api,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getAuthHeaders,
  setUnauthorizedHandler,
  API_URL,
} from '../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetchOk(body: unknown, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status,
    json: jest.fn().mockResolvedValue(body),
  });
}

function mockFetchError(status: number, body: unknown = {error: `HTTP ${status}`}) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: jest.fn().mockResolvedValue(body),
  });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

let originalFetch: typeof global.fetch;

beforeAll(() => {
  originalFetch = global.fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(async () => {
  jest.clearAllMocks();
  // Clear AsyncStorage between tests
  await AsyncStorage.clear();
  // Reset unauthorized handler
  setUnauthorizedHandler(() => {});
});

// ─── Token helpers ────────────────────────────────────────────────────────────

describe('token helpers', () => {
  it('getAuthToken returns null when no token stored', async () => {
    const token = await getAuthToken();
    expect(token).toBeNull();
  });

  it('setAuthToken stores a token', async () => {
    await setAuthToken('tok-123');
    const token = await getAuthToken();
    expect(token).toBe('tok-123');
  });

  it('removeAuthToken clears the stored token', async () => {
    await setAuthToken('tok-456');
    await removeAuthToken();
    const token = await getAuthToken();
    expect(token).toBeNull();
  });
});

// ─── getAuthHeaders ───────────────────────────────────────────────────────────

describe('getAuthHeaders', () => {
  it('returns Content-Type header without Authorization when no token', async () => {
    const headers = await getAuthHeaders();
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('returns Authorization header when token exists', async () => {
    await setAuthToken('bearer-token-xyz');
    const headers = await getAuthHeaders();
    expect(headers['Authorization']).toBe('Bearer bearer-token-xyz');
  });
});

// ─── apiClient – success paths ────────────────────────────────────────────────

describe('apiClient – successful requests', () => {
  it('makes a GET request to the correct URL', async () => {
    global.fetch = mockFetchOk({items: []});
    await apiClient('/api/test');
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_URL}/api/test`,
      expect.objectContaining({}),
    );
  });

  it('returns parsed JSON on success', async () => {
    const payload = {id: 1, name: 'Test'};
    global.fetch = mockFetchOk(payload);
    const result = await apiClient('/api/test');
    expect(result).toEqual(payload);
  });

  it('includes Authorization header when token is stored', async () => {
    await setAuthToken('my-jwt-token');
    global.fetch = mockFetchOk({});
    await apiClient('/api/protected');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('GET request has Content-Type header', async () => {
    global.fetch = mockFetchOk({});
    await apiClient('/api/test');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('POST request sends JSON body', async () => {
    global.fetch = mockFetchOk({created: true});
    await api.post('/api/items', {name: 'Widget'});

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({name: 'Widget'}));
  });

  it('PUT request includes method and body', async () => {
    global.fetch = mockFetchOk({updated: true});
    await api.put('/api/items/1', {name: 'Updated'});

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({name: 'Updated'}));
  });

  it('DELETE request uses DELETE method', async () => {
    global.fetch = mockFetchOk({deleted: true});
    await api.delete('/api/items/1');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('DELETE');
  });
});

// ─── apiClient – error paths ──────────────────────────────────────────────────

describe('apiClient – error handling', () => {
  it('throws "Authentication required" on 401 response', async () => {
    global.fetch = mockFetchError(401);
    await expect(apiClient('/api/protected')).rejects.toThrow(
      'Authentication required',
    );
  });

  it('calls the onUnauthorized handler on 401', async () => {
    global.fetch = mockFetchError(401);
    const handleUnauthorized = jest.fn();
    setUnauthorizedHandler(handleUnauthorized);

    await expect(apiClient('/api/protected')).rejects.toThrow();
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('removes stored token on 401 response', async () => {
    await setAuthToken('still-valid-token');
    global.fetch = mockFetchError(401);
    setUnauthorizedHandler(() => {});

    await expect(apiClient('/api/protected')).rejects.toThrow();
    expect(await getAuthToken()).toBeNull();
  });

  it('throws error with server message on non-OK response', async () => {
    global.fetch = mockFetchError(404, {error: 'Resource not found'});
    await expect(apiClient('/api/missing')).rejects.toThrow('Resource not found');
  });

  it('throws generic HTTP error when server returns no error field', async () => {
    global.fetch = mockFetchError(500, {});
    await expect(apiClient('/api/broken')).rejects.toThrow('HTTP 500');
  });

  it('throws on network error (fetch rejects)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));
    await expect(apiClient('/api/test')).rejects.toThrow('Network request failed');
  });
});

// ─── api convenience helpers ──────────────────────────────────────────────────

describe('api convenience helpers', () => {
  it('api.get calls apiClient with correct path', async () => {
    const payload = {data: []};
    global.fetch = mockFetchOk(payload);
    const result = await api.get('/api/opportunities');
    expect(result).toEqual(payload);

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_URL}/api/opportunities`);
  });

  it('api.patch calls apiClient with PATCH method', async () => {
    global.fetch = mockFetchOk({patched: true});
    await api.patch('/api/items/1', {status: 'Active'});

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({status: 'Active'}));
  });
});
