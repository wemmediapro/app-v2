import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get,
      post,
      put,
      delete: del,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

const { apiService } = await import('./apiService');

describe('apiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getDashboardStats appelle GET /admin/dashboard', async () => {
    get.mockResolvedValue({ data: {} });
    await apiService.getDashboardStats();
    expect(get).toHaveBeenCalledWith('/admin/dashboard');
  });

  it('getUsers concatène la query string', async () => {
    get.mockResolvedValue({ data: [] });
    await apiService.getUsers('role=crew&search=a');
    expect(get).toHaveBeenCalledWith('/admin/users?role=crew&search=a');
  });

  it('deleteUser avec hard=true ajoute ?hard=true', async () => {
    del.mockResolvedValue({ data: {} });
    await apiService.deleteUser('u1', true);
    expect(del).toHaveBeenCalledWith('/admin/users/u1?hard=true');
  });

  it('deleteRestaurant supprime la ressource', async () => {
    del.mockResolvedValue({ data: {} });
    await apiService.deleteRestaurant('r9');
    expect(del).toHaveBeenCalledWith('/restaurants/r9');
  });

  it('createRestaurant poste le corps', async () => {
    post.mockResolvedValue({ data: {} });
    const body = { name: 'X' };
    await apiService.createRestaurant(body);
    expect(post).toHaveBeenCalledWith('/restaurants', body);
  });

  it('getAnalyticsOverview appelle la route analytics', async () => {
    get.mockResolvedValue({ data: {} });
    await apiService.getAnalyticsOverview();
    expect(get).toHaveBeenCalledWith('/analytics/overview');
  });
});
