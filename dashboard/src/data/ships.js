// Source centralisée : data/ships.json (à la racine du repo, partagé avec l'app tablette)
import shipsData from '../../../data/ships.json';

export const availableShips = shipsData.map(({ id, name }) => ({ id, name }));
