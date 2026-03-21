/**
 * Contexte React pour les props de `MainContent`.
 *
 * Pourquoi : `usePassengerAppModel` construit un objet `mainContentProps` volumineux ; le fournir
 * via contexte évite de le recopier à chaque rendu du layout et permet à `MainContent` de fonctionner
 * aussi **sans** provider en tests (props explicites) grâce à `usePassengerMainContentOptional`.
 */
import React, { createContext, useContext } from 'react';

/** Valeur courante : typiquement l’objet `mainContentProps` du hook passager. */
export const PassengerMainContentContext = createContext(null);

/** Enveloppe le bloc central (carousel + MainContent) pour descendre `mainContentProps` sans prop drilling. */
export function PassengerMainContentProvider({ value, children }) {
  return <PassengerMainContentContext.Provider value={value}>{children}</PassengerMainContentContext.Provider>;
}

/**
 * Retourne le contexte ou `null` si aucun provider (ex. tests unitaires qui passent des props à `MainContent`).
 * @returns {Record<string, unknown> | null}
 */
export function usePassengerMainContentOptional() {
  return useContext(PassengerMainContentContext);
}
