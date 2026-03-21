import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../contexts/LanguageContext';
import { BoatConfigProvider } from '../contexts/BoatConfigContext';
import { useRestaurantsList } from '../hooks/useRestaurantsList';
import { useRestaurantForm } from '../hooks/useRestaurantForm';
import { buildRestaurantFormMock } from '../tests/buildRestaurantFormMock';
import { apiService } from '../services/apiService';
import toast from 'react-hot-toast';
import Restaurants from './Restaurants';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../hooks/useRestaurantsList');
vi.mock('../hooks/useRestaurantForm');

vi.mock('../contexts/BoatConfigContext', () => ({
  BoatConfigProvider: ({ children }) => children,
  useBoatConfig: () => ({
    boatConfig: { shipName: 'MS Page Test', shipCapacity: 500, shipInfo: '' },
    loading: false,
    refreshBoatConfig: vi.fn(),
  }),
}));

vi.mock('../services/apiService', () => ({
  apiService: {
    deleteRestaurant: vi.fn(),
    getRestaurant: vi.fn(),
    createRestaurant: vi.fn(),
  },
}));

function renderRestaurants() {
  return render(
    <LanguageProvider>
      <BoatConfigProvider>
        <Restaurants />
      </BoatConfigProvider>
    </LanguageProvider>
  );
}

function defaultFormMock() {
  return buildRestaurantFormMock({ shipName: 'MS Page Test' });
}

describe('Restaurants (page)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRestaurantForm).mockReturnValue({
      showAddModal: false,
      editingId: null,
      closeModal: vi.fn(),
      openNewRestaurantModal: vi.fn(),
      openEditRestaurantModal: vi.fn(),
      saveRestaurant: vi.fn(),
      form: defaultFormMock(),
    });
  });

  it('affiche le chargement quand la liste est en cours', () => {
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [],
      setRestaurants: vi.fn(),
      loading: true,
    });
    renderRestaurants();
    const loadingLabels = screen.getAllByText('Chargement...');
    expect(loadingLabels.length).toBeGreaterThanOrEqual(2);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('affiche l’état vide quand il n’y a aucun restaurant', async () => {
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [],
      setRestaurants: vi.fn(),
      loading: false,
    });
    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Restaurants' })).toBeInTheDocument();
    });
    expect(screen.getByText('Aucun restaurant enregistré')).toBeInTheDocument();
  });

  it('affiche une carte pour chaque restaurant', async () => {
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [
        {
          _id: 'r1',
          name: 'Brasserie Pont 5',
          type: 'Brasserie',
          location: 'Pont 5',
          priceRange: '€€',
          rating: 4,
          menu: [],
          promotions: [],
        },
      ],
      setRestaurants: vi.fn(),
      loading: false,
    });
    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Brasserie Pont 5' })).toBeInTheDocument();
    });
  });

  it('appelle openNewRestaurantModal au clic sur Ajouter', async () => {
    const openNewRestaurantModal = vi.fn();
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [],
      setRestaurants: vi.fn(),
      loading: false,
    });
    vi.mocked(useRestaurantForm).mockReturnValue({
      showAddModal: false,
      editingId: null,
      closeModal: vi.fn(),
      openNewRestaurantModal,
      openEditRestaurantModal: vi.fn(),
      saveRestaurant: vi.fn(),
      form: defaultFormMock(),
    });
    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ajouter un restaurant/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un restaurant/i }));
    expect(openNewRestaurantModal).toHaveBeenCalledTimes(1);
  });

  it('affiche le modal quand showAddModal est vrai', async () => {
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [],
      setRestaurants: vi.fn(),
      loading: false,
    });
    vi.mocked(useRestaurantForm).mockReturnValue({
      showAddModal: true,
      editingId: null,
      closeModal: vi.fn(),
      openNewRestaurantModal: vi.fn(),
      openEditRestaurantModal: vi.fn(),
      saveRestaurant: vi.fn(),
      form: defaultFormMock(),
    });
    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('supprime un restaurant après confirmation', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'd1',
      name: 'À effacer',
      type: 'Bistro',
      location: '',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(apiService.deleteRestaurant).mockResolvedValue({});

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'À effacer' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => {
      expect(apiService.deleteRestaurant).toHaveBeenCalledWith('d1');
    });
    expect(setRestaurants).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Restaurant supprimé');
    confirmSpy.mockRestore();
  });

  it('ne supprime pas si la confirmation est refusée', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'd2',
      name: 'Reste',
      type: 'Bistro',
      location: '',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Reste' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    expect(apiService.deleteRestaurant).not.toHaveBeenCalled();
    expect(setRestaurants).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('duplique un restaurant via l’API', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'orig',
      name: 'Original',
      type: 'Brasserie',
      location: 'P1',
      priceRange: '€€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    vi.mocked(apiService.getRestaurant).mockResolvedValue({
      data: {
        _id: 'orig',
        name: 'Original',
        description: 'Desc',
        type: 'Brasserie',
        category: 'french',
        menu: [],
        promotions: [],
        specialties: [],
      },
    });
    vi.mocked(apiService.createRestaurant).mockResolvedValue({
      data: { restaurant: { _id: 'copy-id', name: 'Original (copie)' } },
    });

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Original' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));

    await waitFor(() => {
      expect(apiService.getRestaurant).toHaveBeenCalledWith('orig');
      expect(apiService.createRestaurant).toHaveBeenCalled();
    });
    expect(setRestaurants).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Restaurant dupliqué');
  });

  it('duplique en fusionnant la copie locale si l’API ne renvoie que data._id', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'orig2',
      name: 'Sans payload restaurant',
      type: 'Grill',
      location: 'P2',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    vi.mocked(apiService.getRestaurant).mockResolvedValue({
      data: {
        _id: 'orig2',
        name: 'Sans payload restaurant',
        type: 'Grill',
        menu: [{ id: 1 }],
        promotions: [],
        specialties: ['fish'],
      },
    });
    vi.mocked(apiService.createRestaurant).mockResolvedValue({
      data: { _id: 'id-seul-api' },
    });

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sans payload restaurant' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));

    await waitFor(() => {
      expect(apiService.createRestaurant).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith('Restaurant dupliqué');
    expect(setRestaurants).toHaveBeenCalledTimes(1);
    const updater = setRestaurants.mock.calls[0][0];
    const next = updater([row]);
    expect(next).toHaveLength(2);
    expect(next[1]._id).toBe('id-seul-api');
    expect(next[1].name).toBe('Sans payload restaurant (copie)');
    expect(next[1].menu).toEqual([{ id: 1 }]);
    expect(next[1].specialties).toEqual(['fish']);
  });

  it('duplique en ajoutant (copie) au nom FR quand translations.fr est défini', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'tr-fr',
      name: 'Resto i18n',
      type: 'Bistro',
      location: '',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    vi.mocked(apiService.getRestaurant).mockResolvedValue({
      data: {
        _id: 'tr-fr',
        __v: 0,
        name: 'Resto i18n',
        type: 'Bistro',
        menu: [],
        promotions: [],
        specialties: [],
        translations: {
          fr: { name: 'Nom français', description: 'Desc FR' },
          en: { name: 'English name' },
        },
      },
    });
    vi.mocked(apiService.createRestaurant).mockResolvedValue({
      data: { restaurant: { _id: 'new-fr', name: 'Resto i18n (copie)' } },
    });

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Resto i18n' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));

    await waitFor(() => {
      expect(apiService.createRestaurant).toHaveBeenCalled();
    });
    const payload = vi.mocked(apiService.createRestaurant).mock.calls[0][0];
    expect(payload.name).toBe('Resto i18n (copie)');
    expect(payload.translations.fr.name).toBe('Nom français (copie)');
    expect(payload.translations.fr.description).toBe('Desc FR');
    expect(payload.translations.en.name).toBe('English name');
    expect(payload).not.toHaveProperty('_id');
    expect(payload).not.toHaveProperty('__v');
  });

  it('duplique : translations.fr sans nom réutilise le nom déjà suffixé (double « copie »)', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'tr-no-fr-name',
      name: 'Sans nom FR',
      type: 'Bistro',
      location: '',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    vi.mocked(apiService.getRestaurant).mockResolvedValue({
      data: {
        _id: 'tr-no-fr-name',
        name: 'Sans nom FR',
        type: 'Bistro',
        menu: [],
        promotions: [],
        specialties: [],
        translations: {
          fr: { description: 'Seulement description' },
        },
      },
    });
    vi.mocked(apiService.createRestaurant).mockResolvedValue({
      data: { restaurant: { _id: 'new-no-fr' } },
    });

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sans nom FR' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));

    await waitFor(() => {
      expect(apiService.createRestaurant).toHaveBeenCalled();
    });
    const payload = vi.mocked(apiService.createRestaurant).mock.calls[0][0];
    expect(payload.name).toBe('Sans nom FR (copie)');
    expect(payload.translations.fr.name).toBe('Sans nom FR (copie) (copie)');
    expect(payload.translations.fr.description).toBe('Seulement description');
  });

  it('duplique quand getRestaurant renvoie le corps directement (sans .data)', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'raw-body',
      name: 'Réponse plate',
      type: 'Bistro',
      location: '',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    vi.mocked(apiService.getRestaurant).mockResolvedValue({
      _id: 'raw-body',
      name: 'Réponse plate',
      menu: [],
      promotions: [],
      specialties: [],
    });
    vi.mocked(apiService.createRestaurant).mockResolvedValue({
      data: { restaurant: { _id: 'copy-raw' } },
    });

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Réponse plate' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));

    await waitFor(() => {
      expect(apiService.createRestaurant).toHaveBeenCalled();
    });
    expect(vi.mocked(apiService.createRestaurant).mock.calls[0][0].name).toBe('Réponse plate (copie)');
    expect(toast.success).toHaveBeenCalledWith('Restaurant dupliqué');
  });

  it('ouvre l’édition depuis la carte (Modifier)', async () => {
    const openEditRestaurantModal = vi.fn();
    vi.mocked(useRestaurantForm).mockReturnValue({
      showAddModal: false,
      editingId: null,
      closeModal: vi.fn(),
      openNewRestaurantModal: vi.fn(),
      openEditRestaurantModal,
      saveRestaurant: vi.fn(),
      form: defaultFormMock(),
    });
    const row = {
      _id: 'edit-1',
      name: 'Édition carte',
      type: 'Bistro',
      location: 'P2',
      priceRange: '€',
      rating: 4,
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants: vi.fn(),
      loading: false,
    });

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Édition carte' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(openEditRestaurantModal).toHaveBeenCalledWith(row);
  });

  it('ouvre l’édition depuis le bandeau promotions', async () => {
    const openEditRestaurantModal = vi.fn();
    vi.mocked(useRestaurantForm).mockReturnValue({
      showAddModal: false,
      editingId: null,
      closeModal: vi.fn(),
      openNewRestaurantModal: vi.fn(),
      openEditRestaurantModal,
      saveRestaurant: vi.fn(),
      form: defaultFormMock(),
    });
    const row = {
      _id: 'promo-r',
      name: 'Resto Promo',
      type: 'Grill',
      location: 'P3',
      priceRange: '€€',
      menu: [],
      promotions: [{ id: 99, title: 'Menu enfant', price: 7 }],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants: vi.fn(),
      loading: false,
    });

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByText('Menu enfant')).toBeInTheDocument();
    });
    const modifierButtons = screen.getAllByRole('button', { name: 'Modifier' });
    fireEvent.click(modifierButtons[0]);
    expect(openEditRestaurantModal).toHaveBeenCalledWith(row);
  });

  it('affiche une erreur si la suppression API échoue', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'fail-del',
      name: 'Erreur del',
      type: 'B',
      location: '',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(apiService.deleteRestaurant).mockRejectedValue({
      response: { data: { message: 'Suppression refusée' } },
    });

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Erreur del' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Suppression refusée');
    });
    expect(setRestaurants).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('affiche le message générique si la suppression échoue sans détail API', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'fail-del-generic',
      name: 'Del sans message',
      type: 'B',
      location: '',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(apiService.deleteRestaurant).mockRejectedValue(new Error('network'));

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Del sans message' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erreur lors de la suppression');
    });
    expect(setRestaurants).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('affiche une erreur si la duplication échoue', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'fail-dup',
      name: 'Erreur dup',
      type: 'B',
      location: '',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    vi.mocked(apiService.getRestaurant).mockRejectedValue({
      response: { data: { message: 'Lecture impossible' } },
    });

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Erreur dup' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Lecture impossible');
    });
    expect(setRestaurants).not.toHaveBeenCalled();
  });

  it('affiche une erreur si createRestaurant échoue après getRestaurant', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'fail-create',
      name: 'Création dup KO',
      type: 'B',
      location: '',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    vi.mocked(apiService.getRestaurant).mockResolvedValue({
      data: {
        _id: 'fail-create',
        name: 'Création dup KO',
        type: 'B',
        menu: [],
        promotions: [],
        specialties: [],
      },
    });
    vi.mocked(apiService.createRestaurant).mockRejectedValue({
      response: { data: { message: 'Création refusée' } },
    });

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Création dup KO' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));

    await waitFor(() => {
      expect(apiService.getRestaurant).toHaveBeenCalledWith('fail-create');
      expect(apiService.createRestaurant).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Création refusée');
    });
    expect(setRestaurants).not.toHaveBeenCalled();
  });

  it('affiche le message générique si createRestaurant échoue sans détail API', async () => {
    const setRestaurants = vi.fn();
    const row = {
      _id: 'fail-create-generic',
      name: 'Dup sans message',
      type: 'B',
      location: '',
      priceRange: '€',
      menu: [],
      promotions: [],
    };
    vi.mocked(useRestaurantsList).mockReturnValue({
      restaurants: [row],
      setRestaurants,
      loading: false,
    });
    vi.mocked(apiService.getRestaurant).mockResolvedValue({
      data: {
        _id: 'fail-create-generic',
        name: 'Dup sans message',
        menu: [],
        promotions: [],
        specialties: [],
      },
    });
    vi.mocked(apiService.createRestaurant).mockRejectedValue(new Error('network'));

    renderRestaurants();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dup sans message' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erreur lors de la duplication');
    });
    expect(setRestaurants).not.toHaveBeenCalled();
  });
});
