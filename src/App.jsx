/**
 * Point d’entrée racine monté par `main.jsx` (une seule responsabilité : ré-exporter l’app passager).
 *
 * Variante **web** dédiée : `src/web/AppWeb.jsx` (si utilisée par un autre point d’entrée Vite).
 * Toute évolution du parcours passager standard passe par `app/PassengerApp.jsx` et ses hooks.
 */
export { default } from './app/PassengerApp.jsx';
