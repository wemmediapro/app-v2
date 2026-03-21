import { Globe, MapPin, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const DESTINATION_KEYS = {
  'Tanger - Gênes': 'tanger_genes',
  'Tanger - Barcelone': 'tanger_barcelone',
  'Tanger - Sète': 'tanger_sete',
  'Nador - Gênes': 'nador_genes',
  'Alger - Marseille': 'alger_marseille',
  'Tunis - Marseille': 'tunis_marseille',
  'Palerme - Tunis': 'palerme_tunis',
};

const FilterBar = ({ countryFilter, setCountryFilter, destinationFilter, setDestinationFilter }) => {
  const { t } = useLanguage();

  const availableCountries = [
    { name: 'Maroc', code: 'MA' },
    { name: 'Tunisie', code: 'TN' },
    { name: 'Algérie', code: 'DZ' },
    { name: 'Italie', code: 'IT' },
    { name: 'Espagne', code: 'ES' },
  ];

  const availableDestinations = [
    'Tanger - Gênes',
    'Tanger - Barcelone',
    'Tanger - Sète',
    'Nador - Gênes',
    'Alger - Marseille',
    'Tunis - Marseille',
    'Palerme - Tunis',
  ];

  const hasActiveFilters = countryFilter !== 'all' || destinationFilter !== 'all';

  const resetFilters = () => {
    setCountryFilter('all');
    setDestinationFilter('all');
  };

  const getDestinationLabel = (destination) => {
    const key = DESTINATION_KEYS[destination];
    return key ? t(`filters.destinations.${key}`) : destination;
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 sm:min-w-[150px]">
        <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
          <Globe size={12} />
          {t('filters.country')}
        </label>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">{t('filters.allCountries')}</option>
          {availableCountries.map((country) => (
            <option key={country.code} value={country.name}>
              {t(`filters.countries.${country.code}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 sm:min-w-[180px]">
        <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
          <MapPin size={12} />
          {t('filters.destination')}
        </label>
        <select
          value={destinationFilter}
          onChange={(e) => setDestinationFilter(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">{t('filters.allDestinations')}</option>
          {availableDestinations.map((destination) => (
            <option key={destination} value={destination}>
              {getDestinationLabel(destination)}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <div className="flex items-end">
          <button
            onClick={resetFilters}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300 flex items-center gap-2"
          >
            <X size={14} />
            {t('filters.reset')}
          </button>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
