import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
const get = vi.fn();
const put = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post,
      get,
      put,
    })),
  },
}));

const { authService } = await import('./authService');

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('authToken');
  });

  it('login envoie email et mot de passe sur /auth/login', async () => {
    const payload = { data: { token: 't', user: { role: 'admin' } } };
    post.mockResolvedValue(payload);
    const credentials = { email: 'a@b.c', password: 'secret' };

    const res = await authService.login(credentials);

    expect(post).toHaveBeenCalledWith('/auth/login', credentials);
    expect(res).toBe(payload);
  });

  it('register poste sur /auth/register', async () => {
    post.mockResolvedValue({ data: { id: '1' } });
    const userData = { email: 'x@y.z', password: 'p' };

    await authService.register(userData);

    expect(post).toHaveBeenCalledWith('/auth/register', userData);
  });

  it('getProfile appelle GET /auth/me', async () => {
    get.mockResolvedValue({ data: { email: 'me@test.com' } });

    const res = await authService.getProfile();

    expect(get).toHaveBeenCalledWith('/auth/me');
    expect(res.data.email).toBe('me@test.com');
  });

  it('updateProfile envoie PUT /auth/profile', async () => {
    put.mockResolvedValue({ data: {} });
    const profile = { firstName: 'A' };

    await authService.updateProfile(profile);

    expect(put).toHaveBeenCalledWith('/auth/profile', profile);
  });

  it('logout tente POST /auth/logout et supprime authToken du localStorage', async () => {
    post.mockResolvedValue({});
    localStorage.setItem('authToken', 'legacy-token');

    await authService.logout();

    expect(post).toHaveBeenCalledWith('/auth/logout');
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  it('logout ignore une erreur API', async () => {
    post.mockRejectedValue(new Error('network'));
    localStorage.setItem('authToken', 'x');

    await expect(authService.logout()).resolves.toBeUndefined();

    expect(localStorage.getItem('authToken')).toBeNull();
  });
});
