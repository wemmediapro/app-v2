import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Globe, Plus, Edit, Trash2, Search, Flag, Ship, Calendar, Image, FileText, Film, Radio, BookOpen, UtensilsCrossed, ShoppingBag, X, Save } from 'lucide-react';
import { apiService } from '../services/apiService';
import toast from 'react-hot-toast';
import { LANG_LIST, emptyTranslations } from '../utils/i18n';
import { useLanguage } from '../contexts/LanguageContext';

const Destinations = () => {
  const { t } = useLanguage();
  const [destinations, setDestinations] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, content, routes
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDestination, setEditingDestination] = useState(null);
  const [activeLang, setActiveLang] = useState('fr');
  const [editActiveLang, setEditActiveLang] = useState('fr');
  const [newDestination, setNewDestination] = useState({
    name: '',
    country: '',
    countryCode: '',
    type: 'Port',
    description: '',
    image: '',
    coordinates: { lat: '', lng: '' },
    facilities: [],
    routes: [],
    content: {
      articles: 0,
      movies: 0,
      restaurants: 0,
      shops: 0,
      radio: 0
    },
    translations: emptyTranslations()
  });
  const [newFacility, setNewFacility] = useState('');
  const [editFacility, setEditFacility] = useState('');

  // Données par défaut des destinations GNV par pays
  const defaultDestinations = [
    // Maroc
    {
      id: 1,
      name: 'Tanger',
      country: 'Maroc',
      countryCode: 'MA',
      type: 'Port',
      description: 'Port de Tanger, porte d\'entrée du Maroc vers l\'Europe',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&h=600&fit=crop',
      coordinates: { lat: 35.7595, lng: -5.8339 },
      facilities: ['Terminal passagers', 'Parking', 'Wi-Fi', 'Boutiques', 'Douanes', 'Restaurants'],
      routes: [
        { to: 'Barcelone', ship: 'GNV Excelsior', duration: '8h', frequency: 'Quotidien' },
        { to: 'Gênes', ship: 'GNV Rhapsody', duration: '24h', frequency: 'Quotidien' }
      ],
      content: {
        articles: 15,
        movies: 10,
        restaurants: 4,
        shops: 6,
        radio: 3
      }
    },
    {
      id: 2,
      name: 'Nador',
      country: 'Maroc',
      countryCode: 'MA',
      type: 'Port',
      description: 'Port de Nador, destination principale du Maroc',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&h=600&fit=crop',
      coordinates: { lat: 35.1681, lng: -2.9336 },
      facilities: ['Terminal passagers', 'Parking', 'Wi-Fi', 'Boutiques', 'Douanes'],
      routes: [
        { to: 'Barcelone', ship: 'GNV Excelsior', duration: '24h', frequency: 'Quotidien' }
      ],
      content: {
        articles: 12,
        movies: 8,
        restaurants: 3,
        shops: 5,
        radio: 2
      }
    },
    // Tunisie
    {
      id: 3,
      name: 'Tunis',
      country: 'Tunisie',
      countryCode: 'TN',
      type: 'Port',
      description: 'Port de Tunis, capitale de la Tunisie',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&h=600&fit=crop',
      coordinates: { lat: 36.8065, lng: 10.1815 },
      facilities: ['Terminal passagers', 'Parking', 'Wi-Fi', 'Boutiques', 'Restaurants'],
      routes: [
        { to: 'Gênes', ship: 'GNV Allegra', duration: '20h', frequency: 'Quotidien' },
        { to: 'Barcelone', ship: 'GNV Rhapsody', duration: '22h', frequency: 'Quotidien' }
      ],
      content: {
        articles: 18,
        movies: 12,
        restaurants: 5,
        shops: 7,
        radio: 2
      }
    },
    {
      id: 4,
      name: 'Sfax',
      country: 'Tunisie',
      countryCode: 'TN',
      type: 'Port',
      description: 'Port de Sfax, deuxième ville de Tunisie',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&h=600&fit=crop',
      coordinates: { lat: 34.7406, lng: 10.7603 },
      facilities: ['Terminal passagers', 'Parking', 'Wi-Fi', 'Boutiques'],
      routes: [
        { to: 'Gênes', ship: 'GNV Allegra', duration: '18h', frequency: 'Hebdomadaire' }
      ],
      content: {
        articles: 10,
        movies: 6,
        restaurants: 2,
        shops: 4,
        radio: 1
      }
    },
    // Algérie
    {
      id: 5,
      name: 'Alger',
      country: 'Algérie',
      countryCode: 'DZ',
      type: 'Port',
      description: 'Port d\'Alger, capitale de l\'Algérie',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&h=600&fit=crop',
      coordinates: { lat: 36.7538, lng: 3.0588 },
      facilities: ['Terminal passagers', 'Parking', 'Wi-Fi', 'Boutiques', 'Restaurants', 'Douanes'],
      routes: [
        { to: 'Barcelone', ship: 'GNV Excelsior', duration: '26h', frequency: 'Quotidien' },
        { to: 'Marseille', ship: 'GNV Rhapsody', duration: '20h', frequency: 'Quotidien' }
      ],
      content: {
        articles: 20,
        movies: 15,
        restaurants: 6,
        shops: 8,
        radio: 3
      }
    },
    {
      id: 6,
      name: 'Oran',
      country: 'Algérie',
      countryCode: 'DZ',
      type: 'Port',
      description: 'Port d\'Oran, deuxième ville d\'Algérie',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&h=600&fit=crop',
      coordinates: { lat: 35.6971, lng: -0.6337 },
      facilities: ['Terminal passagers', 'Parking', 'Wi-Fi', 'Boutiques'],
      routes: [
        { to: 'Barcelone', ship: 'GNV Allegra', duration: '24h', frequency: 'Hebdomadaire' }
      ],
      content: {
        articles: 14,
        movies: 9,
        restaurants: 3,
        shops: 5,
        radio: 2
      }
    },
    // Italie
    {
      id: 7,
      name: 'Gênes',
      country: 'Italie',
      countryCode: 'IT',
      type: 'Port',
      description: 'Port de Gênes, capitale maritime de l\'Italie',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&h=600&fit=crop',
      coordinates: { lat: 44.4056, lng: 8.9463 },
      facilities: ['Terminal passagers', 'Parking', 'Wi-Fi', 'Boutiques', 'Restaurants'],
      routes: [
        { to: 'Tanger', ship: 'GNV Rhapsody', duration: '24h', frequency: 'Quotidien' },
        { to: 'Tunis', ship: 'GNV Allegra', duration: '20h', frequency: 'Quotidien' },
        { to: 'Barcelone', ship: 'GNV Excelsior', duration: '20h', frequency: 'Quotidien' }
      ],
      content: {
        articles: 22,
        movies: 16,
        restaurants: 7,
        shops: 9,
        radio: 4
      }
    },
    {
      id: 8,
      name: 'Palerme',
      country: 'Italie',
      countryCode: 'IT',
      type: 'Port',
      description: 'Port de Palerme, capitale de la Sicile',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&h=600&fit=crop',
      coordinates: { lat: 38.1157, lng: 13.3613 },
      facilities: ['Terminal passagers', 'Parking', 'Wi-Fi', 'Boutiques', 'Restaurants'],
      routes: [
        { to: 'Tunis', ship: 'GNV Allegra', duration: '10h', frequency: 'Quotidien' }
      ],
      content: {
        articles: 16,
        movies: 11,
        restaurants: 4,
        shops: 6,
        radio: 2
      }
    },
    // Espagne
    {
      id: 9,
      name: 'Barcelone',
      country: 'Espagne',
      countryCode: 'ES',
      type: 'Port',
      description: 'Port de Barcelone, capitale de la Catalogne',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&h=600&fit=crop',
      coordinates: { lat: 41.3851, lng: 2.1734 },
      facilities: ['Terminal passagers', 'Parking', 'Wi-Fi', 'Boutiques', 'Restaurants', 'Hôtel'],
      routes: [
        { to: 'Tanger', ship: 'GNV Excelsior', duration: '8h', frequency: 'Quotidien' },
        { to: 'Nador', ship: 'GNV Excelsior', duration: '24h', frequency: 'Quotidien' },
        { to: 'Alger', ship: 'GNV Excelsior', duration: '26h', frequency: 'Quotidien' },
        { to: 'Gênes', ship: 'GNV Rhapsody', duration: '20h', frequency: 'Quotidien' },
        { to: 'Tunis', ship: 'GNV Rhapsody', duration: '22h', frequency: 'Quotidien' }
      ],
      content: {
        articles: 25,
        movies: 18,
        restaurants: 8,
        shops: 10,
        radio: 4
      }
    },
    {
      id: 10,
      name: 'Valence',
      country: 'Espagne',
      countryCode: 'ES',
      type: 'Port',
      description: 'Port de Valence, troisième ville d\'Espagne',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&h=600&fit=crop',
      coordinates: { lat: 39.4699, lng: -0.3763 },
      facilities: ['Terminal passagers', 'Parking', 'Wi-Fi', 'Boutiques'],
      routes: [
        { to: 'Oran', ship: 'GNV Allegra', duration: '22h', frequency: 'Hebdomadaire' }
      ],
      content: {
        articles: 12,
        movies: 8,
        restaurants: 3,
        shops: 5,
        radio: 2
      }
    }
  ];

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    try {
      setLoading(true);
      // TODO: Appel API pour récupérer les destinations
      // const response = await apiService.get('/destinations');
      // setDestinations(response.data || defaultDestinations);
      setDestinations(defaultDestinations);
      if (defaultDestinations.length > 0) {
        setSelectedDestination(defaultDestinations[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des destinations:', error);
      setDestinations(defaultDestinations);
      if (defaultDestinations.length > 0) {
        setSelectedDestination(defaultDestinations[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Grouper les destinations par pays
  const destinationsByCountry = destinations.reduce((acc, dest) => {
    if (!acc[dest.country]) {
      acc[dest.country] = [];
    }
    acc[dest.country].push(dest);
    return acc;
  }, {});

  const countries = Object.keys(destinationsByCountry).sort();

  // Pays disponibles avec codes
  const availableCountries = [
    { name: 'Maroc', code: 'MA' },
    { name: 'Tunisie', code: 'TN' },
    { name: 'Algérie', code: 'DZ' },
    { name: 'Italie', code: 'IT' },
    { name: 'Espagne', code: 'ES' }
  ];

  const handleAddDestination = async () => {
    // Validation
    if (!newDestination.name || !newDestination.country) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const translations = { fr: { name: newDestination.name, description: newDestination.description || '' } };
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') return;
        const t = newDestination.translations?.[code];
        if (t && (t.name || t.description)) {
          translations[code] = { name: t.name || '', description: t.description || '' };
        }
      });
      const destination = {
        ...newDestination,
        id: destinations.length + 1,
        coordinates: {
          lat: parseFloat(newDestination.coordinates.lat) || 0,
          lng: parseFloat(newDestination.coordinates.lng) || 0
        },
        translations
      };

      // TODO: Appel API pour créer la destination
      // await apiService.post('/destinations', destination);
      
      setDestinations([...destinations, destination]);
      setSelectedDestination(destination);
      setShowAddModal(false);
      toast.success('Destination ajoutée avec succès');
      if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
      
      // Réinitialiser le formulaire
      setNewDestination({
        name: '',
        country: '',
        countryCode: '',
        type: 'Port',
        description: '',
        image: '',
        coordinates: { lat: '', lng: '' },
        facilities: [],
        routes: [],
        content: {
          articles: 0,
          movies: 0,
          restaurants: 0,
          shops: 0,
          radio: 0
        },
        translations: emptyTranslations()
      });
      setActiveLang('fr');
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la destination:', error);
      toast.error('Erreur lors de l\'ajout de la destination');
    }
  };

  const addFacility = () => {
    if (newFacility.trim()) {
      setNewDestination({
        ...newDestination,
        facilities: [...newDestination.facilities, newFacility.trim()]
      });
      setNewFacility('');
    }
  };

  const removeFacility = (index) => {
    setNewDestination({
      ...newDestination,
      facilities: newDestination.facilities.filter((_, i) => i !== index)
    });
  };

  const handleEditDestination = (destination) => {
    setEditingDestination(destination);
    const trans = destination.translations && typeof destination.translations === 'object'
      ? { ...emptyTranslations(), ...destination.translations }
      : emptyTranslations();
    setNewDestination({
      name: destination.name || '',
      country: destination.country || '',
      countryCode: destination.countryCode || '',
      type: destination.type || 'Port',
      description: destination.description || '',
      image: destination.image || '',
      coordinates: {
        lat: destination.coordinates?.lat?.toString() || '',
        lng: destination.coordinates?.lng?.toString() || ''
      },
      facilities: destination.facilities || [],
      routes: destination.routes || [],
      content: destination.content || {
        articles: 0,
        movies: 0,
        restaurants: 0,
        shops: 0,
        radio: 0
      },
      translations: trans
    });
    setEditActiveLang('fr');
    setShowEditModal(true);
  };

  const handleUpdateDestination = async () => {
    // Validation
    if (!newDestination.name || !newDestination.country) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const translations = { fr: { name: newDestination.name, description: newDestination.description || '' } };
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') return;
        const t = newDestination.translations?.[code];
        if (t && (t.name || t.description)) {
          translations[code] = { name: t.name || '', description: t.description || '' };
        }
      });
      const updatedDestination = {
        ...editingDestination,
        ...newDestination,
        coordinates: {
          lat: parseFloat(newDestination.coordinates.lat) || 0,
          lng: parseFloat(newDestination.coordinates.lng) || 0
        },
        translations
      };

      // TODO: Appel API pour mettre à jour la destination
      // await apiService.put(`/destinations/${editingDestination.id}`, updatedDestination);
      
      setDestinations(destinations.map(dest => 
        dest.id === editingDestination.id ? updatedDestination : dest
      ));
      
      if (selectedDestination?.id === editingDestination.id) {
        setSelectedDestination(updatedDestination);
      }
      
      setShowEditModal(false);
      setEditingDestination(null);
      toast.success('Destination modifiée avec succès');
      if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
      
      // Réinitialiser le formulaire
      setNewDestination({
        name: '',
        country: '',
        countryCode: '',
        type: 'Port',
        description: '',
        image: '',
        coordinates: { lat: '', lng: '' },
        facilities: [],
        routes: [],
        content: {
          articles: 0,
          movies: 0,
          restaurants: 0,
          shops: 0,
          radio: 0
        },
        translations: emptyTranslations()
      });
      setEditActiveLang('fr');
    } catch (error) {
      console.error('Erreur lors de la modification de la destination:', error);
      toast.error('Erreur lors de la modification de la destination');
    }
  };

  const addEditFacility = () => {
    if (editFacility.trim()) {
      setNewDestination({
        ...newDestination,
        facilities: [...newDestination.facilities, editFacility.trim()]
      });
      setEditFacility('');
    }
  };

  const removeEditFacility = (index) => {
    setNewDestination({
      ...newDestination,
      facilities: newDestination.facilities.filter((_, i) => i !== index)
    });
  };

  // Filtrer les destinations
  const filteredDestinations = destinations.filter(dest => {
    const matchesSearch = dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCountry = selectedCountry === 'all' || dest.country === selectedCountry;
    return matchesSearch && matchesCountry;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Destinations GNV</h1>
          <p className="text-gray-600 mt-2">Gestion des destinations et contenu par pays</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setActiveLang('fr');
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Ajouter une destination
        </motion.button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <Globe size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
          >
            <option value="all">Tous les pays</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des destinations par pays */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Destinations ({filteredDestinations.length})
          </h2>
          <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            {selectedCountry === 'all' ? (
              // Vue par pays
              countries.map((country) => (
                <div key={country} className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                    <Flag size={16} className="text-gray-600" />
                    <h3 className="font-semibold text-gray-900">{country}</h3>
                    <span className="ml-auto text-sm text-gray-500">
                      {destinationsByCountry[country].length}
                    </span>
                  </div>
                  <div className="space-y-2 pl-4">
                    {destinationsByCountry[country]
                      .filter(dest => 
                        dest.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((dest) => (
                        <motion.div
                          key={dest.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-3 rounded-xl border-2 transition-all ${
                            selectedDestination?.id === dest.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => setSelectedDestination(dest)}
                            >
                              <MapPin size={18} className="text-blue-600 flex-shrink-0 mt-0.5 inline-block mr-2" />
                              <h4 className="font-semibold text-gray-900 text-sm inline">{dest.name}</h4>
                              <p className="text-xs text-gray-600 mt-0.5">{dest.type}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditDestination(dest);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Edit size={16} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                </div>
              ))
            ) : (
              // Vue filtrée
              filteredDestinations.map((dest) => (
                <motion.div
                  key={dest.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            selectedDestination?.id === dest.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div 
                              className="flex-1 min-w-0"
                              onClick={() => setSelectedDestination(dest)}
                            >
                              <h4 className="font-semibold text-gray-900 text-sm">{dest.name}</h4>
                              <p className="text-xs text-gray-600 mt-0.5">{dest.country} • {dest.type}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditDestination(dest);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Edit size={16} />
                            </button>
                          </div>
                        </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Détails de la destination sélectionnée */}
        {selectedDestination && (
          <div className="lg:col-span-2 space-y-6">
            {/* Image et info principale */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="relative h-48 bg-gradient-to-r from-blue-600 to-cyan-500">
                <img
                  src={selectedDestination.image}
                  alt={selectedDestination.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Flag size={20} className="text-white" />
                    <span className="text-white/90 text-sm">{selectedDestination.country}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{selectedDestination.name}</h2>
                  <p className="text-blue-100">{selectedDestination.description}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex space-x-1 px-4">
                  {[
                    { id: 'overview', label: 'Vue d\'ensemble', icon: MapPin },
                    { id: 'content', label: 'Contenu', icon: FileText },
                    { id: 'routes', label: 'Lignes', icon: Ship }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Icon size={18} />
                        <span className="text-sm font-medium">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <FileText size={18} />
                          <span className="text-sm">Articles</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{selectedDestination.content.articles}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <Film size={18} />
                          <span className="text-sm">Films</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{selectedDestination.content.movies}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <UtensilsCrossed size={18} />
                          <span className="text-sm">Restaurants</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{selectedDestination.content.restaurants}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <ShoppingBag size={18} />
                          <span className="text-sm">Boutiques</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{selectedDestination.content.shops}</p>
                      </div>
                    </div>

                    {/* Facilities */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Équipements du port</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedDestination.facilities.map((facility, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                          >
                            {facility}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Coordinates */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Coordonnées</h3>
                      <p className="text-sm text-gray-600">
                        Latitude: {selectedDestination.coordinates.lat}°<br />
                        Longitude: {selectedDestination.coordinates.lng}°
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'content' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Contenu affecté à {selectedDestination.name}</h3>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        <Plus size={16} />
                        Affecter du contenu
                      </motion.button>
                    </div>

                    {/* Content by type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { type: 'Articles', icon: BookOpen, count: selectedDestination.content.articles, bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
                        { type: 'Films & Séries', icon: Film, count: selectedDestination.content.movies, bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
                        { type: 'Restaurants', icon: UtensilsCrossed, count: selectedDestination.content.restaurants, bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
                        { type: 'Boutiques', icon: ShoppingBag, count: selectedDestination.content.shops, bgColor: 'bg-green-100', textColor: 'text-green-600' },
                        { type: 'Radio', icon: Radio, count: selectedDestination.content.radio, bgColor: 'bg-red-100', textColor: 'text-red-600' }
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <motion.div
                            key={item.type}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                                  <Icon size={20} className={item.textColor} />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900">{item.type}</h4>
                                  <p className="text-sm text-gray-500">{item.count} éléments</p>
                                </div>
                              </div>
                              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Edit size={16} className="text-gray-600" />
                              </button>
                            </div>
                            <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
                              Gérer le contenu →
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'routes' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Lignes maritimes</h3>
                    <div className="space-y-3">
                      {selectedDestination.routes.map((route, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Ship size={20} className="text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {selectedDestination.name} → {route.to}
                                </p>
                                <p className="text-sm text-gray-600">{route.ship}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">{route.duration}</p>
                              <p className="text-xs text-gray-500">{route.frequency}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Ajouter Destination */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Ajouter une destination</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Informations de base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom de la destination *
                  </label>
                  <input
                    type="text"
                    value={newDestination.name}
                    onChange={(e) => setNewDestination({ ...newDestination, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Marseille"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={newDestination.type}
                    onChange={(e) => setNewDestination({ ...newDestination, type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Port">Port</option>
                    <option value="Terminal">Terminal</option>
                    <option value="Gare maritime">Gare maritime</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pays *
                  </label>
                  <select
                    value={newDestination.country}
                    onChange={(e) => {
                      const selected = availableCountries.find(c => c.name === e.target.value);
                      setNewDestination({
                        ...newDestination,
                        country: e.target.value,
                        countryCode: selected?.code || ''
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un pays</option>
                    {availableCountries.map((country) => (
                      <option key={country.code} value={country.name}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code pays
                  </label>
                  <input
                    type="text"
                    value={newDestination.countryCode}
                    onChange={(e) => setNewDestination({ ...newDestination, countryCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: FR"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newDestination.description}
                  onChange={(e) => setNewDestination({ ...newDestination, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Description de la destination..."
                />
              </div>

              {/* Contenu par langue — Modal Ajouter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contenu par langue</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LANG_LIST.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setActiveLang(code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeLang === code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {activeLang === 'fr' ? (
                  <div className="space-y-4 text-sm text-gray-600 bg-blue-50/50 rounded-lg p-4">
                    <p>Les champs « Nom de la destination » et « Description » ci-dessus correspondent au français.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Nom ({LANG_LIST.find(l => l.code === activeLang)?.label})</label>
                      <input
                        type="text"
                        value={newDestination.translations?.[activeLang]?.name ?? ''}
                        onChange={(e) => setNewDestination({
                          ...newDestination,
                          translations: {
                            ...newDestination.translations,
                            [activeLang]: { ...newDestination.translations?.[activeLang], name: e.target.value, description: newDestination.translations?.[activeLang]?.description ?? '' }
                          }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nom dans cette langue"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Description ({LANG_LIST.find(l => l.code === activeLang)?.label})</label>
                      <textarea
                        value={newDestination.translations?.[activeLang]?.description ?? ''}
                        onChange={(e) => setNewDestination({
                          ...newDestination,
                          translations: {
                            ...newDestination.translations,
                            [activeLang]: { ...newDestination.translations?.[activeLang], name: newDestination.translations?.[activeLang]?.name ?? '', description: e.target.value }
                          }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Description dans cette langue"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL de l'image
                </label>
                <input
                  type="url"
                  value={newDestination.image}
                  onChange={(e) => setNewDestination({ ...newDestination, image: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>

              {/* Coordonnées */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newDestination.coordinates.lat}
                    onChange={(e) => setNewDestination({
                      ...newDestination,
                      coordinates: { ...newDestination.coordinates, lat: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 43.4036"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newDestination.coordinates.lng}
                    onChange={(e) => setNewDestination({
                      ...newDestination,
                      coordinates: { ...newDestination.coordinates, lng: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 3.6964"
                  />
                </div>
              </div>

              {/* Équipements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Équipements
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newFacility}
                    onChange={(e) => setNewFacility(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addFacility()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ajouter un équipement..."
                  />
                  <button
                    onClick={addFacility}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newDestination.facilities.map((facility, index) => (
                    <span
                      key={index}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {facility}
                      <button
                        onClick={() => removeFacility(index)}
                        className="hover:text-red-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAddDestination}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save size={18} />
                Enregistrer
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Modifier Destination */}
      {showEditModal && editingDestination && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Modifier la destination</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingDestination(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Informations de base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom de la destination *
                  </label>
                  <input
                    type="text"
                    value={newDestination.name}
                    onChange={(e) => setNewDestination({ ...newDestination, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Tanger"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={newDestination.type}
                    onChange={(e) => setNewDestination({ ...newDestination, type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Port">Port</option>
                    <option value="Terminal">Terminal</option>
                    <option value="Gare maritime">Gare maritime</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pays *
                  </label>
                  <select
                    value={newDestination.country}
                    onChange={(e) => {
                      const selected = availableCountries.find(c => c.name === e.target.value);
                      setNewDestination({
                        ...newDestination,
                        country: e.target.value,
                        countryCode: selected?.code || ''
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un pays</option>
                    {availableCountries.map((country) => (
                      <option key={country.code} value={country.name}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code pays
                  </label>
                  <input
                    type="text"
                    value={newDestination.countryCode}
                    onChange={(e) => setNewDestination({ ...newDestination, countryCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: MA"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newDestination.description}
                  onChange={(e) => setNewDestination({ ...newDestination, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Description de la destination..."
                />
              </div>

              {/* Contenu par langue — Modal Modifier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contenu par langue</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LANG_LIST.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setEditActiveLang(code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editActiveLang === code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {editActiveLang === 'fr' ? (
                  <div className="space-y-4 text-sm text-gray-600 bg-blue-50/50 rounded-lg p-4">
                    <p>Les champs « Nom de la destination » et « Description » ci-dessus correspondent au français.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Nom ({LANG_LIST.find(l => l.code === editActiveLang)?.label})</label>
                      <input
                        type="text"
                        value={newDestination.translations?.[editActiveLang]?.name ?? ''}
                        onChange={(e) => setNewDestination({
                          ...newDestination,
                          translations: {
                            ...newDestination.translations,
                            [editActiveLang]: { ...newDestination.translations?.[editActiveLang], name: e.target.value, description: newDestination.translations?.[editActiveLang]?.description ?? '' }
                          }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nom dans cette langue"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Description ({LANG_LIST.find(l => l.code === editActiveLang)?.label})</label>
                      <textarea
                        value={newDestination.translations?.[editActiveLang]?.description ?? ''}
                        onChange={(e) => setNewDestination({
                          ...newDestination,
                          translations: {
                            ...newDestination.translations,
                            [editActiveLang]: { ...newDestination.translations?.[editActiveLang], name: newDestination.translations?.[editActiveLang]?.name ?? '', description: e.target.value }
                          }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Description dans cette langue"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL de l'image
                </label>
                <input
                  type="url"
                  value={newDestination.image}
                  onChange={(e) => setNewDestination({ ...newDestination, image: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>

              {/* Coordonnées */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newDestination.coordinates.lat}
                    onChange={(e) => setNewDestination({
                      ...newDestination,
                      coordinates: { ...newDestination.coordinates, lat: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 35.7595"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newDestination.coordinates.lng}
                    onChange={(e) => setNewDestination({
                      ...newDestination,
                      coordinates: { ...newDestination.coordinates, lng: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: -5.8339"
                  />
                </div>
              </div>

              {/* Équipements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Équipements
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={editFacility}
                    onChange={(e) => setEditFacility(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addEditFacility()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ajouter un équipement..."
                  />
                  <button
                    onClick={addEditFacility}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newDestination.facilities.map((facility, index) => (
                    <span
                      key={index}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {facility}
                      <button
                        onClick={() => removeEditFacility(index)}
                        className="hover:text-red-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingDestination(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleUpdateDestination}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save size={18} />
                Enregistrer les modifications
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Destinations;

