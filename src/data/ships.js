// Liste complète des navires GNV - Synchronisée avec le dashboard
export const gnvShipsList = [
  { id: 1, name: 'GNV Excelsior', route: 'Sète - Nador' },
  { id: 2, name: 'GNV Rhapsody', route: 'Gênes - Barcelone' },
  { id: 3, name: 'GNV Allegra', route: 'Livourne - Olbia' },
  { id: 4, name: 'GNV Polaris', route: 'Gênes - Palerme' },
  { id: 5, name: 'GNV La Suprema', route: 'Barcelone - Tanger' },
  { id: 6, name: 'GNV La Superba', route: 'Gênes - Tunis' },
  { id: 7, name: 'GNV Excellent', route: 'Gênes - Palerme' },
  { id: 8, name: 'GNV Fantastic', route: 'Gênes - Porto Torres' },
  { id: 9, name: 'GNV Splendid', route: 'Livourne - Olbia' },
  { id: 10, name: 'GNV Majestic', route: 'Gênes - Bastia' },
  { id: 11, name: 'GNV Sirio', route: 'Gênes - Palerme' },
  { id: 12, name: 'GNV Atlas', route: 'Sète - Tanger' },
  { id: 13, name: 'GNV Azzurra', route: 'Gênes - Barcelone' },
  { id: 14, name: 'GNV Cristal', route: 'Livourne - Olbia' },
  { id: 15, name: 'GNV Aries', route: 'Gênes - Tunis' }
];

// Navire actuel par défaut (pour l'affichage dans l'application)
export const currentShip = gnvShipsList[0]; // GNV Excelsior
