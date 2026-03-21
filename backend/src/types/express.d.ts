import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Corrélation logs / erreurs (server.js) */
      id?: string;
      /** Jeton double-submit CSRF (middleware csrf) */
      csrfToken?: string;
    }
  }
}

export {};
