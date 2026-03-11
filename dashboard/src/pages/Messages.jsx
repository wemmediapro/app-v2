import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Search, 
  User,
  Clock,
  Send,
  MoreVertical,
  Lock,
  Unlock,
  Filter,
  Globe,
  MapPin,
  Ship
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { availableShips } from '../data/ships';
import toast from 'react-hot-toast';

const getMessageContent = (msg) => msg?.content || '';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');
  const [shipFilter, setShipFilter] = useState('all');

  // Pays disponibles
  const availableCountries = [
    { name: 'Maroc', code: 'MA' },
    { name: 'Tunisie', code: 'TN' },
    { name: 'Algérie', code: 'DZ' },
    { name: 'Italie', code: 'IT' },
    { name: 'Espagne', code: 'ES' }
  ];

  // Destinations disponibles (exemples)
  const availableDestinations = [
    'Tanger - Gênes',
    'Tanger - Barcelone',
    'Tanger - Sète',
    'Nador - Gênes',
    'Alger - Marseille',
    'Tunis - Marseille',
    'Palerme - Tunis'
  ];


  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await apiService.getConversations();
      setConversations(response.data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Erreur lors du chargement des conversations');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const response = await apiService.getMessages(userId);
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Erreur lors du chargement des messages');
      setMessages([]);
    }
  };

  const handleConversationSelect = (conversation) => {
    setSelectedConversation(conversation);
    const userId = conversation?.user?._id || conversation?.user?.id;
    if (userId) fetchMessages(userId);
    else setMessages([]);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffTime = Math.abs(now - messageDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Aujourd\'hui';
    if (diffDays === 2) return 'Hier';
    return messageDate.toLocaleDateString('fr-FR');
  };

  const decryptedMessages = useMemo(() => {
    return messages.map(msg => ({
      ...msg,
      content: getMessageContent(msg)
    }));
  }, [messages]);

  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // Filtre par recherche textuelle
    if (searchQuery) {
      filtered = filtered.filter(conv => 
        conv.user?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.user?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtre par pays
    if (countryFilter !== 'all') {
      filtered = filtered.filter(conv => {
        const userCountry = conv.user?.country || conv.user?.nationality || '';
        return userCountry === countryFilter || userCountry.toLowerCase().includes(countryFilter.toLowerCase());
      });
    }

    // Filtre par destination
    if (destinationFilter !== 'all') {
      filtered = filtered.filter(conv => {
        const userDestination = conv.user?.destination || conv.destination || '';
        return userDestination === destinationFilter || userDestination.toLowerCase().includes(destinationFilter.toLowerCase());
      });
    }

    // Filtre par bateau
    if (shipFilter !== 'all') {
      filtered = filtered.filter(conv => {
        const userShipId = conv.user?.shipId || conv.user?.shipName || '';
        const shipIdStr = shipFilter.toString();
        return userShipId.toString() === shipIdStr || 
               (conv.user?.shipName && conv.user.shipName.toLowerCase().includes(availableShips.find(s => s.id.toString() === shipIdStr)?.name?.toLowerCase() || ''));
      });
    }

    return filtered;
  }, [conversations, searchQuery, countryFilter, destinationFilter, shipFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-600 mt-2">Gestion des conversations utilisateurs</p>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher une conversation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Filtre par pays */}
            <div className="flex-1 sm:min-w-[150px]">
              <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
                <Globe size={12} />
                Pays
              </label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les pays</option>
                {availableCountries.map((country) => (
                  <option key={country.code} value={country.name}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre par destination */}
            <div className="flex-1 sm:min-w-[180px]">
              <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
                <MapPin size={12} />
                Destination
              </label>
              <select
                value={destinationFilter}
                onChange={(e) => setDestinationFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Toutes les destinations</option>
                {availableDestinations.map((destination) => (
                  <option key={destination} value={destination}>
                    {destination}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre par bateau */}
            <div className="flex-1 sm:min-w-[150px]">
              <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
                <Ship size={12} />
                Bateau
              </label>
              <select
                value={shipFilter}
                onChange={(e) => setShipFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les bateaux</option>
                {availableShips.map((ship) => (
                  <option key={ship.id} value={ship.id}>
                    {ship.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Bouton réinitialiser */}
            {(countryFilter !== 'all' || destinationFilter !== 'all' || shipFilter !== 'all') && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setCountryFilter('all');
                    setDestinationFilter('all');
                    setShipFilter('all');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300"
                >
                  Réinitialiser
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[400px] lg:min-h-[calc(100vh-300px)] lg:h-[calc(100vh-300px)]">
        {/* Conversations List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
          </div>

          <div className="overflow-y-auto h-[calc(100%-60px)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="p-4 border-b border-gray-100 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              filteredConversations.map((conversation, index) => (
                <motion.div
                  key={conversation._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleConversationSelect(conversation)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConversation?._id === conversation._id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500">
                      <User size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {conversation.user?.firstName} {conversation.user?.lastName}
                        </h3>
                        {conversation.unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {conversation.lastMessage?.encrypted 
                          ? getMessageContent(conversation.lastMessage)
                          : conversation.lastMessage?.content}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(conversation.lastMessage?.createdAt || conversation.lastMessage?.timestamp)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Messages Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500">
                      <User size={16} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {selectedConversation.user?.firstName} {selectedConversation.user?.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {selectedConversation.user?.email}
                        {selectedConversation.user?.cabinNumber && (
                          <span className="ml-2 text-gray-400">({selectedConversation.user.cabinNumber})</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">
                      <Unlock size={12} />
                      <span>Décrypté</span>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(100%-140px)]">
                {decryptedMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageSquare size={48} className="text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Aucun message dans cette conversation</p>
                    </div>
                  </div>
                ) : (
                  decryptedMessages.map((message, index) => (
                    <motion.div
                      key={message._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex ${message.sender._id === selectedConversation.user._id ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative ${
                        message.sender._id === selectedConversation.user._id
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-blue-600 text-white'
                      }`}>
                        {message.encrypted && (
                          <div className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 bg-green-500 rounded-full">
                            <Unlock size={10} className="text-white" />
                          </div>
                        )}
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.sender._id === selectedConversation.user._id
                            ? 'text-gray-500'
                            : 'text-blue-100'
                        }`}>
                          {formatTime(message.createdAt || message.timestamp)}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Tapez votre message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Send size={18} />
                  </motion.button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare size={48} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sélectionnez une conversation</h3>
                <p className="text-gray-500">Choisissez une conversation pour voir les messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;


