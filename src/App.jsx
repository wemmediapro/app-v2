/**
 * Point d’entrée app passagers — orchestration dans usePassengerAppModel, UI dans AppPassengerLayout.
 */
import React from 'react';
import { usePassengerAppModel } from './hooks/usePassengerAppModel';
import { AppPassengerLayout } from './components/AppPassengerLayout';

function App() {
  const layout = usePassengerAppModel();
  return <AppPassengerLayout {...layout} />;
}

export default App;
