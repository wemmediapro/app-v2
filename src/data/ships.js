// Source centralisée : data/ships.json (référencé aussi par le dashboard)
import gnvShipsListData from '../../data/ships.json';

export const gnvShipsList = gnvShipsListData;

export const currentShip = gnvShipsList[0] ?? null; // GNV Excelsior par défaut
