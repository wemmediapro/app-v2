import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import Login from './Login';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
  },
}));

function renderLogin(onLogin = vi.fn()) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <Login onLogin={onLogin} />
      </LanguageProvider>
    </MemoryRouter>
  );
}

async function fillAndSubmit(email = 'admin@test.com', password = 'secret') {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { name: 'email', value: email },
  });
  fireEvent.change(screen.getByLabelText('Mot de passe'), {
    target: { name: 'password', value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));
}

describe('Login (page)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bascule la visibilité du mot de passe', () => {
    renderLogin();
    const password = screen.getByLabelText('Mot de passe');
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(password).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('affiche l’état de chargement pendant la connexion', async () => {
    let resolveLogin;
    vi.mocked(authService.login).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { name: 'email', value: 'a@b.c' },
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { name: 'password', value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));

    await waitFor(() => {
      const busy = screen.getByRole('button', { name: /Connexion en cours/i });
      expect(busy).toBeDisabled();
      expect(busy).toHaveAttribute('aria-busy', 'true');
    });

    resolveLogin({
      data: { token: 't', user: { role: 'admin', id: '1' } },
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('traite « Network Error » dans le message comme erreur réseau', async () => {
    vi.mocked(authService.login).mockRejectedValue(new Error('Network Error'));

    renderLogin();
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Serveur inaccessible');
    });
  });

  it('efface l’alerte quand on modifie le formulaire après une erreur', async () => {
    vi.mocked(authService.login).mockRejectedValue({
      response: { status: 401, data: { message: 'Échec' } },
    });

    renderLogin();
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Échec');
    });

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { name: 'email', value: 'new@x.com' },
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('connecte un admin, appelle onLogin et redirige', async () => {
    const onLogin = vi.fn();
    vi.mocked(authService.login).mockResolvedValue({
      data: {
        token: 'jwt-test',
        user: { role: 'admin', id: 'u1', email: 'admin@test.com' },
      },
    });

    renderLogin(onLogin);
    await fillAndSubmit();

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('jwt-test', expect.objectContaining({ role: 'admin' }));
    });
    expect(toast.success).toHaveBeenCalledWith('Connexion réussie !');
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('refuse un utilisateur non admin', async () => {
    const onLogin = vi.fn();
    vi.mocked(authService.login).mockResolvedValue({
      data: {
        token: 'x',
        user: { role: 'guest', id: 'g1' },
      },
    });

    renderLogin(onLogin);
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Accès refusé. Privilèges administrateur requis.');
    });
    expect(toast.error).toHaveBeenCalledWith('Accès refusé. Privilèges administrateur requis.');
    expect(onLogin).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('affiche un message si le serveur est injoignable', async () => {
    const err = new Error('Network Error');
    err.code = 'ERR_NETWORK';
    vi.mocked(authService.login).mockRejectedValue(err);

    renderLogin();
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Serveur inaccessible');
    });
    expect(toast.error).toHaveBeenCalledWith(
      'Serveur inaccessible. Démarrez le backend (dans backend/ : npm run dev).'
    );
  });

  it('traite ECONNREFUSED comme erreur réseau', async () => {
    const err = new Error('connect ECONNREFUSED');
    err.code = 'ECONNREFUSED';
    vi.mocked(authService.login).mockRejectedValue(err);

    renderLogin();
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Serveur inaccessible');
    });
  });

  it('affiche le champ data.error quand message est absent', async () => {
    vi.mocked(authService.login).mockRejectedValue({
      response: { status: 400, data: { error: 'Identifiants invalides' } },
    });

    renderLogin();
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Identifiants invalides');
    });
    expect(toast.error).toHaveBeenCalledWith('Identifiants invalides');
  });

  it('affiche un message générique si l’API ne renvoie pas de détail', async () => {
    vi.mocked(authService.login).mockRejectedValue({
      response: { status: 401, data: {} },
    });

    renderLogin();
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent("Erreur de connexion. Vérifiez l'email et le mot de passe.");
    });
  });

  it('sur 503 avec message ADMIN_EMAIL, affiche l’alerte et le bloc config seulement en dev', async () => {
    vi.mocked(authService.login).mockRejectedValue({
      response: {
        status: 503,
        data: { message: 'Please set ADMIN_EMAIL in backend/config.env' },
      },
    });

    renderLogin();
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('ADMIN_EMAIL');
    });
    if (import.meta.env.DEV) {
      expect(screen.getByText('Configuration requise')).toBeInTheDocument();
      expect(screen.getByText(/ADMIN_EMAIL et ADMIN_PASSWORD/i)).toBeInTheDocument();
    }
  });
});
