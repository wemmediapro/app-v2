/**
 * Application passagers (SPA principale).
 *
 * Séparation stricte : aucune logique métier ici — uniquement le branchement
 * `usePassengerAppModel` (données + effets) vers `AppPassengerLayout` (structure UI).
 * Pour modifier un flux métier, éditer le hook concerné sous `src/hooks/`.
 */
import React from 'react';
import { usePassengerAppModel } from '../hooks/usePassengerAppModel';
import { AppPassengerLayout } from '../components/AppPassengerLayout';

export default function PassengerApp() {
  const layoutProps = usePassengerAppModel();
  return <AppPassengerLayout {...layoutProps} />;
}

PassengerApp.displayName = 'PassengerApp';
