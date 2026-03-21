import { describe, it, expect, beforeEach } from 'vitest';
import { DASHBOARD_MODULES, getDefaultAccess, getAccessByRole } from './Settings';

describe('Settings — droits par défaut et modules', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('liste chaque module avec id et clés i18n', () => {
    expect(DASHBOARD_MODULES.length).toBeGreaterThan(0);
    const ids = DASHBOARD_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    DASHBOARD_MODULES.forEach((m) => {
      expect(m.id).toBeTruthy();
      expect(m.labelKey).toMatch(/\./);
      expect(m.groupKey).toMatch(/\./);
    });
  });

  it('admin a accès à tous les modules', () => {
    const { admin } = getDefaultAccess();
    DASHBOARD_MODULES.forEach((m) => {
      expect(admin[m.id]).toBe(true);
    });
  });

  it('passenger n’a aucun accès module', () => {
    const { passenger } = getDefaultAccess();
    DASHBOARD_MODULES.forEach((m) => {
      expect(passenger[m.id]).toBe(false);
    });
  });

  it('crew a les médias et services courants mais pas ads / users / settings', () => {
    const { crew } = getDefaultAccess();
    expect(crew.restaurants).toBe(true);
    expect(crew.ads).toBe(false);
    expect(crew.users).toBe(false);
    expect(crew.settings).toBe(false);
    expect(crew['settings-connection']).toBe(true);
  });

  it('getAccessByRole sans localStorage équivaut aux défauts', () => {
    expect(getAccessByRole()).toEqual(getDefaultAccess());
  });

  it('fusionne le localStorage avec les défauts', () => {
    localStorage.setItem(
      'dashboardAccessByRole',
      JSON.stringify({
        admin: { ads: false },
        crew: { restaurants: false },
        passenger: {},
      })
    );
    const access = getAccessByRole();
    expect(access.admin.ads).toBe(false);
    expect(access.admin.dashboard).toBe(true);
    expect(access.crew.restaurants).toBe(false);
    expect(access.crew.dashboard).toBe(true);
    expect(access.passenger.dashboard).toBe(false);
  });
});
