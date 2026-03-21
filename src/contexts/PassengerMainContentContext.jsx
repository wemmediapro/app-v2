import React, { createContext, useContext } from 'react';

/** Données passées à MainContent (évite la prolifération de props au niveau racine). */
export const PassengerMainContentContext = createContext(null);

export function PassengerMainContentProvider({ value, children }) {
  return <PassengerMainContentContext.Provider value={value}>{children}</PassengerMainContentContext.Provider>;
}

/** @returns {Record<string, unknown> | null} */
export function usePassengerMainContentOptional() {
  return useContext(PassengerMainContentContext);
}
