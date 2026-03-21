import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Ship,
  Map,
  UtensilsCrossed,
  Users,
  Calendar,
  Navigation,
  Coffee,
  Search,
  Plus,
  Info,
  MapPin,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Image as ImageIcon,
  Clock3,
} from 'lucide-react';
import { apiService } from '../services/apiService';

const Bateaux = () => {
  const [ships, setShips] = useState([]);
  const [selectedShip, setSelectedShip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview'); // overview, plan, restaurants, info
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  // Données par défaut des navires GNV - Inspirées de www.gnv.fr
  const defaultShips = [
    {
      id: 1,
      name: 'GNV Excelsior',
      type: 'Ferry',
      capacity: 2500,
      passengers: 1850,
      crew: 150,
      length: '186 m',
      width: '28 m',
      speed: '24 nœuds',
      year: 2011,
      status: 'En service',
      route: 'Sète - Nador',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvexcelsior.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvexcelsior.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/corridoio-aree-ristorazione.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-bar-centrale.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-cabina-4-letti-esterna.jpg',
      ],
      description:
        'Le GNV Excelsior est un ferry moderne offrant un confort optimal pour les traversées entre la France et le Maroc. Équipé des dernières technologies, il garantit une traversée agréable et sécurisée.',
      facilities: [
        'Wi-Fi',
        'Restaurants',
        'Boutiques',
        'Cabines',
        'Espace enfants',
        'Bar',
        'Terrasse',
        'Piscine',
        'Cinéma',
        'Casino',
      ],
      decks: [
        {
          id: 1,
          name: 'Pont 7 - Pont supérieur',
          facilities: ['Bar panoramique', 'Terrasse extérieure', 'Cabines de luxe'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 6 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Espace enfants'],
          restaurants: ['Restaurant Self-Service', 'Restaurant à la carte'],
        },
        {
          id: 3,
          name: 'Pont 5 - Pont véhicules',
          facilities: ['Garage véhicules', 'Accès cabines'],
          restaurants: [],
        },
        {
          id: 4,
          name: 'Pont 4 - Pont inférieur',
          facilities: ['Garage véhicules', 'Cabines'],
          restaurants: [],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 6',
          type: 'Self-service',
          capacity: 200,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
        {
          id: 2,
          name: 'Restaurant à la carte',
          deck: 'Pont 6',
          type: 'Service à table',
          capacity: 80,
          openingHours: '19:00 - 23:00',
          cuisine: 'Française',
          image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop',
        },
        {
          id: 3,
          name: 'Bar panoramique',
          deck: 'Pont 7',
          type: 'Bar',
          capacity: 120,
          openingHours: '08:00 - 02:00',
          cuisine: 'Snacks et boissons',
          image: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '32,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '37,600 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Sète', to: 'Nador', duration: '24h', frequency: 'Quotidien' },
        { from: 'Nador', to: 'Sète', duration: '24h', frequency: 'Quotidien' },
      ],
    },
    {
      id: 2,
      name: 'GNV Rhapsody',
      type: 'Ferry',
      capacity: 2000,
      passengers: 1450,
      crew: 120,
      length: '175 m',
      width: '26 m',
      speed: '22 nœuds',
      year: 2009,
      status: 'En service',
      route: 'Gênes - Barcelone',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvrhapsody.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvrhapsody.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-lounge-bar.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-reception.jpg',
      ],
      description:
        "Le GNV Rhapsody offre des traversées confortables entre l'Italie et l'Espagne. Navire élégant avec des espaces spacieux et des services de qualité.",
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Espace enfants', 'Bar', 'Terrasse'],
      decks: [
        {
          id: 1,
          name: 'Pont 6 - Pont supérieur',
          facilities: ['Bar', 'Terrasse', 'Cabines'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 5 - Pont principal',
          facilities: ['Restaurants', 'Boutiques'],
          restaurants: ['Restaurant Self-Service'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 5',
          type: 'Self-service',
          capacity: 150,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '28,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '32,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [{ from: 'Gênes', to: 'Barcelone', duration: '20h', frequency: 'Quotidien' }],
    },
    {
      id: 3,
      name: 'GNV Allegra',
      type: 'Ferry',
      capacity: 1800,
      passengers: 1300,
      crew: 100,
      length: '168 m',
      width: '25 m',
      speed: '21 nœuds',
      year: 2007,
      status: 'En service',
      route: 'Livourne - Olbia',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvallegra.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvallegra.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-bar-centrale.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-cabina-4-letti-esterna.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-lounge-bar.jpg',
      ],
      description:
        "Le GNV Allegra assure les liaisons entre l'Italie continentale et la Sardaigne. Navire compact et efficace, idéal pour les traversées courtes.",
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Bar', 'Espace enfants'],
      decks: [
        {
          id: 1,
          name: 'Pont 5 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Bar'],
          restaurants: ['Restaurant Self-Service'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 5',
          type: 'Self-service',
          capacity: 120,
          openingHours: '06:00 - 22:00',
          cuisine: 'Italienne',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '25,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '28,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [{ from: 'Livourne', to: 'Olbia', duration: '8h', frequency: 'Quotidien' }],
    },
    {
      id: 4,
      name: 'GNV Polaris',
      type: 'Ferry Nouvelle Génération',
      capacity: 3000,
      passengers: 2200,
      crew: 180,
      length: '210 m',
      width: '30 m',
      speed: '26 nœuds',
      year: 2024,
      status: 'En service',
      route: 'Gênes - Palerme',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvpolaris.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvpolaris.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-ristorante.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-suite-presidenziale.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-steak-house.jpg',
      ],
      description:
        'Le GNV Polaris est le premier navire de nouvelle génération de la flotte GNV. Propulsé au GNL, il respecte les normes environnementales les plus strictes tout en offrant un confort exceptionnel.',
      facilities: [
        'Wi-Fi',
        'Restaurants',
        'Boutiques',
        'Cabines Premium',
        'Espace enfants',
        'Bar',
        'Terrasse',
        'Piscine',
        'Cinéma',
        'Spa',
        'Gym',
      ],
      decks: [
        {
          id: 1,
          name: 'Pont 8 - Pont supérieur',
          facilities: ['Bar panoramique', 'Terrasse extérieure', 'Suites de luxe', 'Spa'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 7 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Espace enfants', 'Cinéma'],
          restaurants: ['Restaurant Self-Service', 'Restaurant à la carte', 'Sushi Bar'],
        },
        {
          id: 3,
          name: 'Pont 6 - Pont véhicules',
          facilities: ['Garage véhicules', 'Accès cabines'],
          restaurants: [],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 7',
          type: 'Self-service',
          capacity: 250,
          openingHours: '06:00 - 23:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
        {
          id: 2,
          name: 'Restaurant à la carte',
          deck: 'Pont 7',
          type: 'Service à table',
          capacity: 100,
          openingHours: '19:00 - 23:30',
          cuisine: 'Méditerranéenne',
          image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop',
        },
        {
          id: 3,
          name: 'Sushi Bar',
          deck: 'Pont 7',
          type: 'Service à table',
          capacity: 40,
          openingHours: '12:00 - 22:00',
          cuisine: 'Japonaise',
          image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '45,000 GT',
        engines: '4 x Wärtsilä 12V46DF (GNL)',
        power: '48,000 kW',
        fuel: 'GNL (Gaz Naturel Liquéfié)',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
        emissions: 'Réduction CO2 de 30%',
        certification: 'Green Ship',
      },
      routes: [
        { from: 'Gênes', to: 'Palerme', duration: '12h', frequency: 'Quotidien' },
        { from: 'Palerme', to: 'Gênes', duration: '12h', frequency: 'Quotidien' },
      ],
    },
    {
      id: 5,
      name: 'GNV La Suprema',
      type: 'Ferry',
      capacity: 2200,
      passengers: 1650,
      crew: 140,
      length: '195 m',
      width: '29 m',
      speed: '25 nœuds',
      year: 2015,
      status: 'En service',
      route: 'Barcelone - Tanger',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvlasuprema.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvlasuprema.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-bar-disco.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-sala-poltrone.jpg',
      ],
      description:
        "Le GNV La Suprema assure les liaisons entre l'Espagne et le Maroc. Navire spacieux avec de nombreux équipements pour une traversée agréable.",
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Espace enfants', 'Bar', 'Terrasse', 'Piscine'],
      decks: [
        {
          id: 1,
          name: 'Pont 7 - Pont supérieur',
          facilities: ['Bar panoramique', 'Terrasse extérieure', 'Piscine', 'Cabines'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 6 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Espace enfants'],
          restaurants: ['Restaurant Self-Service', 'Restaurant à la carte'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 6',
          type: 'Self-service',
          capacity: 180,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
        {
          id: 2,
          name: 'Restaurant à la carte',
          deck: 'Pont 6',
          type: 'Service à table',
          capacity: 90,
          openingHours: '19:00 - 23:00',
          cuisine: 'Espagnole',
          image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '38,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '40,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Barcelone', to: 'Tanger', duration: '8h', frequency: 'Quotidien' },
        { from: 'Tanger', to: 'Barcelone', duration: '8h', frequency: 'Quotidien' },
      ],
    },
    {
      id: 6,
      name: 'GNV La Superba',
      type: 'Ferry',
      capacity: 2100,
      passengers: 1580,
      crew: 135,
      length: '192 m',
      width: '28.5 m',
      speed: '24 nœuds',
      year: 2013,
      status: 'En service',
      route: 'Gênes - Tunis',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvlasuperba.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvlasuperba.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-self-service.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-shop.jpg',
      ],
      description:
        "Le GNV La Superba connecte l'Italie à la Tunisie. Navire moderne avec des services de qualité pour une traversée confortable.",
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Espace enfants', 'Bar', 'Terrasse'],
      decks: [
        {
          id: 1,
          name: 'Pont 7 - Pont supérieur',
          facilities: ['Bar', 'Terrasse', 'Cabines'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 6 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Espace enfants'],
          restaurants: ['Restaurant Self-Service', 'Pizzeria'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 6',
          type: 'Self-service',
          capacity: 170,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
        {
          id: 2,
          name: 'Pizzeria',
          deck: 'Pont 6',
          type: 'Service rapide',
          capacity: 60,
          openingHours: '11:00 - 23:00',
          cuisine: 'Italienne',
          image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '36,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '38,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Gênes', to: 'Tunis', duration: '22h', frequency: 'Quotidien' },
        { from: 'Tunis', to: 'Gênes', duration: '22h', frequency: 'Quotidien' },
      ],
    },
    {
      id: 7,
      name: 'GNV Excellent',
      type: 'Cruise-Ferry',
      capacity: 2400,
      passengers: 1750,
      crew: 145,
      length: '188 m',
      width: '28 m',
      speed: '23 nœuds',
      year: 1998,
      status: 'En service',
      route: 'Gênes - Palerme',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvexcellent.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvexcellent.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-cabina-2-letti-esterna.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-sala-bambini.jpg',
      ],
      description:
        'Le GNV Excellent est un cruise-ferry de la classe Excellence, offrant des traversées confortables vers la Sicile.',
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Espace enfants', 'Bar', 'Terrasse', 'Piscine'],
      decks: [
        {
          id: 1,
          name: 'Pont 7 - Pont supérieur',
          facilities: ['Bar panoramique', 'Terrasse', 'Cabines'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 6 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Espace enfants'],
          restaurants: ['Restaurant Self-Service', 'Restaurant à la carte'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 6',
          type: 'Self-service',
          capacity: 200,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
        {
          id: 2,
          name: 'Restaurant à la carte',
          deck: 'Pont 6',
          type: 'Service à table',
          capacity: 85,
          openingHours: '19:00 - 23:00',
          cuisine: 'Italienne',
          image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '33,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '36,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Gênes', to: 'Palerme', duration: '11h30', frequency: 'Quotidien' },
        { from: 'Palerme', to: 'Gênes', duration: '11h30', frequency: 'Quotidien' },
      ],
    },
    {
      id: 8,
      name: 'GNV Fantastic',
      type: 'Cruise-Ferry',
      capacity: 2300,
      passengers: 1680,
      crew: 140,
      length: '185 m',
      width: '27.5 m',
      speed: '23 nœuds',
      year: 1996,
      status: 'En service',
      route: 'Gênes - Porto Torres',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvfantastic.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvfantastic.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-lounge-bar-2.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-cabina-2-letti-interna.jpg',
      ],
      description:
        "Le GNV Fantastic assure les liaisons entre l'Italie continentale et la Sardaigne. Navire fiable et confortable.",
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Espace enfants', 'Bar', 'Terrasse'],
      decks: [
        {
          id: 1,
          name: 'Pont 6 - Pont supérieur',
          facilities: ['Bar', 'Terrasse', 'Cabines'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 5 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Espace enfants'],
          restaurants: ['Restaurant Self-Service'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 5',
          type: 'Self-service',
          capacity: 180,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '31,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '35,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Gênes', to: 'Porto Torres', duration: '10h', frequency: 'Quotidien' },
        { from: 'Porto Torres', to: 'Gênes', duration: '10h', frequency: 'Quotidien' },
      ],
    },
    {
      id: 9,
      name: 'GNV Splendid',
      type: 'Cruise-Ferry',
      capacity: 2200,
      passengers: 1620,
      crew: 135,
      length: '182 m',
      width: '27 m',
      speed: '22 nœuds',
      year: 1994,
      status: 'En service',
      route: 'Livourne - Olbia',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvsplendid.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvsplendid.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-cabina-4-letti-interna.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-shop2.jpg',
      ],
      description:
        'Le GNV Splendid est un navire emblématique de la flotte GNV, assurant les liaisons vers la Sardaigne depuis plus de 30 ans.',
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Bar', 'Terrasse'],
      decks: [
        {
          id: 1,
          name: 'Pont 6 - Pont supérieur',
          facilities: ['Bar', 'Terrasse', 'Cabines'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 5 - Pont principal',
          facilities: ['Restaurants', 'Boutiques'],
          restaurants: ['Restaurant Self-Service'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 5',
          type: 'Self-service',
          capacity: 170,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '30,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '34,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Livourne', to: 'Olbia', duration: '8h', frequency: 'Quotidien' },
        { from: 'Olbia', to: 'Livourne', duration: '8h', frequency: 'Quotidien' },
      ],
    },
    {
      id: 10,
      name: 'GNV Majestic',
      type: 'Cruise-Ferry',
      capacity: 2100,
      passengers: 1550,
      crew: 130,
      length: '180 m',
      width: '26.5 m',
      speed: '22 nœuds',
      year: 1993,
      status: 'En service',
      route: 'Gênes - Bastia',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvmajestic.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvmajestic.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-suite-famigliare.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra_animali-esterna.jpg',
      ],
      description:
        'Le GNV Majestic est un navire historique de la flotte GNV, assurant les liaisons vers la Corse avec fiabilité et confort.',
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Bar', 'Terrasse'],
      decks: [
        {
          id: 1,
          name: 'Pont 6 - Pont supérieur',
          facilities: ['Bar', 'Terrasse', 'Cabines'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 5 - Pont principal',
          facilities: ['Restaurants', 'Boutiques'],
          restaurants: ['Restaurant Self-Service'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 5',
          type: 'Self-service',
          capacity: 160,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '29,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '33,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Gênes', to: 'Bastia', duration: '6h30', frequency: 'Quotidien' },
        { from: 'Bastia', to: 'Gênes', duration: '6h30', frequency: 'Quotidien' },
      ],
    },
    {
      id: 11,
      name: 'GNV Sirio',
      type: 'Ferry Rapide',
      capacity: 1200,
      passengers: 950,
      crew: 80,
      length: '145 m',
      width: '24 m',
      speed: '28 nœuds',
      year: 2004,
      status: 'En service',
      route: 'Gênes - Palerme',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvsirio.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvsirio.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-pmr.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-animali-interna.jpg',
      ],
      description:
        'Le GNV Sirio est un ferry rapide moderne, idéal pour les traversées express vers la Sicile. Vitesse et confort combinés.',
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Bar'],
      decks: [
        {
          id: 1,
          name: 'Pont 5 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Bar', 'Cabines'],
          restaurants: ['Restaurant Self-Service'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 5',
          type: 'Self-service',
          capacity: 120,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '18,000 GT',
        engines: '4 x Wärtsilä 16V32',
        power: '28,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Gênes', to: 'Palerme', duration: '10h', frequency: 'Quotidien' },
        { from: 'Palerme', to: 'Gênes', duration: '10h', frequency: 'Quotidien' },
      ],
    },
    {
      id: 12,
      name: 'GNV Atlas',
      type: 'Ferry',
      capacity: 1900,
      passengers: 1420,
      crew: 115,
      length: '170 m',
      width: '25 m',
      speed: '21 nœuds',
      year: 2010,
      status: 'En service',
      route: 'Sète - Tanger',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvatlas.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvatlas.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-bar-centrale.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-cabina-4-letti-esterna.jpg',
      ],
      description:
        'Le GNV Atlas assure les liaisons entre la France et le Maroc. Navire moderne avec des équipements de qualité.',
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Espace enfants', 'Bar', 'Terrasse'],
      decks: [
        {
          id: 1,
          name: 'Pont 6 - Pont supérieur',
          facilities: ['Bar', 'Terrasse', 'Cabines'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 5 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Espace enfants'],
          restaurants: ['Restaurant Self-Service'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 5',
          type: 'Self-service',
          capacity: 150,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '26,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '30,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Sète', to: 'Tanger', duration: '36h', frequency: 'Quotidien' },
        { from: 'Tanger', to: 'Sète', duration: '36h', frequency: 'Quotidien' },
      ],
    },
    {
      id: 13,
      name: 'GNV Azzurra',
      type: 'Ferry',
      capacity: 2000,
      passengers: 1500,
      crew: 125,
      length: '175 m',
      width: '26 m',
      speed: '22 nœuds',
      year: 2008,
      status: 'En service',
      route: 'Gênes - Barcelone',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvazzurra.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvazzurra.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-lounge-bar.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-reception.jpg',
      ],
      description:
        "Le GNV Azzurra offre des traversées confortables entre l'Italie et l'Espagne. Navire élégant avec des espaces spacieux.",
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Espace enfants', 'Bar', 'Terrasse'],
      decks: [
        {
          id: 1,
          name: 'Pont 6 - Pont supérieur',
          facilities: ['Bar', 'Terrasse', 'Cabines'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 5 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Espace enfants'],
          restaurants: ['Restaurant Self-Service', 'Restaurant à la carte'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 5',
          type: 'Self-service',
          capacity: 160,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
        {
          id: 2,
          name: 'Restaurant à la carte',
          deck: 'Pont 5',
          type: 'Service à table',
          capacity: 75,
          openingHours: '19:00 - 23:00',
          cuisine: 'Méditerranéenne',
          image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '27,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '31,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Gênes', to: 'Barcelone', duration: '19h', frequency: 'Quotidien' },
        { from: 'Barcelone', to: 'Gênes', duration: '19h', frequency: 'Quotidien' },
      ],
    },
    {
      id: 14,
      name: 'GNV Cristal',
      type: 'Ferry',
      capacity: 1800,
      passengers: 1350,
      crew: 110,
      length: '168 m',
      width: '25 m',
      speed: '21 nœuds',
      year: 2006,
      status: 'En service',
      route: 'Livourne - Olbia',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvcristal.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvcristal.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-ristorante.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-suite-presidenziale.jpg',
      ],
      description:
        'Le GNV Cristal assure les liaisons vers la Sardaigne. Navire compact et efficace, idéal pour les traversées courtes.',
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Bar'],
      decks: [
        {
          id: 1,
          name: 'Pont 5 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Bar', 'Cabines'],
          restaurants: ['Restaurant Self-Service'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 5',
          type: 'Self-service',
          capacity: 130,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '24,000 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '27,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Livourne', to: 'Olbia', duration: '8h', frequency: 'Quotidien' },
        { from: 'Olbia', to: 'Livourne', duration: '8h', frequency: 'Quotidien' },
      ],
    },
    {
      id: 15,
      name: 'GNV Aries',
      type: 'Ferry',
      capacity: 1950,
      passengers: 1480,
      crew: 120,
      length: '172 m',
      width: '25.5 m',
      speed: '22 nœuds',
      year: 2005,
      status: 'En service',
      route: 'Gênes - Tunis',
      image: 'https://www.gnv.it/-/media/foundation/entities/ships/gnvaries.jpg',
      gallery: [
        'https://www.gnv.it/-/media/foundation/entities/ships/gnvaries.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-steak-house.jpg',
        'https://www.gnv.it/-/media/foundation/entities/ships/allegra-suite-famigliare.jpg',
      ],
      description:
        "Le GNV Aries connecte l'Italie à la Tunisie. Navire moderne avec des services de qualité pour une traversée confortable.",
      facilities: ['Wi-Fi', 'Restaurants', 'Boutiques', 'Cabines', 'Espace enfants', 'Bar', 'Terrasse'],
      decks: [
        {
          id: 1,
          name: 'Pont 6 - Pont supérieur',
          facilities: ['Bar', 'Terrasse', 'Cabines'],
          restaurants: [],
        },
        {
          id: 2,
          name: 'Pont 5 - Pont principal',
          facilities: ['Restaurants', 'Boutiques', 'Espace enfants'],
          restaurants: ['Restaurant Self-Service', 'Pizzeria'],
        },
      ],
      restaurants: [
        {
          id: 1,
          name: 'Restaurant Self-Service',
          deck: 'Pont 5',
          type: 'Self-service',
          capacity: 165,
          openingHours: '06:00 - 22:00',
          cuisine: 'Internationale',
          image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
        },
        {
          id: 2,
          name: 'Pizzeria',
          deck: 'Pont 5',
          type: 'Service rapide',
          capacity: 55,
          openingHours: '11:00 - 23:00',
          cuisine: 'Italienne',
          image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=400&fit=crop',
        },
      ],
      technicalInfo: {
        tonnage: '25,500 GT',
        engines: '4 x Wärtsilä 8L46',
        power: '29,000 kW',
        fuel: 'Diesel',
        flag: 'Italie',
        operator: 'GNV (Grandi Navi Veloci)',
      },
      routes: [
        { from: 'Gênes', to: 'Tunis', duration: '21h', frequency: 'Quotidien' },
        { from: 'Tunis', to: 'Gênes', duration: '21h', frequency: 'Quotidien' },
      ],
    },
  ];

  useEffect(() => {
    fetchShips();
  }, []);

  const fetchShips = async () => {
    try {
      setLoading(true);
      const response = await apiService.getShips();
      const list = response?.data?.data ?? response?.data ?? response;
      const nextShips = Array.isArray(list) && list.length > 0 ? list : defaultShips;
      setShips(nextShips);
      if (nextShips.length > 0 && !selectedShip) {
        setSelectedShip(nextShips[0]);
      } else if (nextShips.length > 0 && selectedShip) {
        const stillSelected = nextShips.find((s) => (s._id || s.id) === (selectedShip._id || selectedShip.id));
        if (!stillSelected) setSelectedShip(nextShips[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des navires:', error);
      setShips(defaultShips);
      if (defaultShips.length > 0) {
        setSelectedShip(defaultShips[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Extraire toutes les destinations uniques
  const allDestinations = Array.from(
    new Set(ships.flatMap((ship) => ship.routes.flatMap((route) => [route.from, route.to])))
  ).sort();

  const filteredShips = ships.filter((ship) => {
    const matchesSearch =
      ship.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ship.route.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDestination =
      destinationFilter === 'all' ||
      ship.routes.some(
        (route) =>
          route.from.toLowerCase() === destinationFilter.toLowerCase() ||
          route.to.toLowerCase() === destinationFilter.toLowerCase()
      );

    return matchesSearch && matchesDestination;
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
          <h1 className="text-3xl font-bold text-gray-900">Flotte GNV</h1>
          <p className="text-gray-600 mt-2">Gestion des navires et informations</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Ajouter un navire
        </motion.button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un navire..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <MapPin size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
          >
            <option value="all">Toutes les destinations</option>
            {allDestinations.map((dest) => (
              <option key={dest} value={dest.toLowerCase()}>
                {dest}
              </option>
            ))}
          </select>
        </div>
        {destinationFilter !== 'all' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setDestinationFilter('all')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Filter size={18} />
            Réinitialiser
          </motion.button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des navires */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Navires ({filteredShips.length})</h2>
          <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
            {filteredShips.map((ship) => (
              <motion.div
                key={ship.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  setSelectedShip(ship);
                  setSelectedImageIndex(0);
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedShip?.id === ship.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Ship size={24} className="text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{ship.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{ship.route}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          ship.status === 'En service' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ship.status}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Détails du navire sélectionné */}
        {selectedShip && (
          <div className="lg:col-span-2 space-y-6">
            {/* Image et info principale */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="relative h-64 bg-gradient-to-r from-blue-600 to-cyan-500">
                {selectedShip.gallery && selectedShip.gallery.length > 0 ? (
                  <>
                    <img
                      src={selectedShip.gallery[selectedImageIndex] || selectedShip.image}
                      alt={selectedShip.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    {selectedShip.gallery.length > 1 && (
                      <>
                        <button
                          onClick={() =>
                            setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : selectedShip.gallery.length - 1))
                          }
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          onClick={() =>
                            setSelectedImageIndex((prev) => (prev < selectedShip.gallery.length - 1 ? prev + 1 : 0))
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                        >
                          <ChevronRight size={20} />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                          {selectedShip.gallery.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedImageIndex(idx)}
                              className={`w-2 h-2 rounded-full transition-all ${
                                idx === selectedImageIndex ? 'bg-white w-6' : 'bg-white/50'
                              }`}
                            />
                          ))}
                        </div>
                        {selectedShip.gallery.length > 1 && (
                          <button
                            onClick={() => setShowImageModal(true)}
                            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors flex items-center gap-2"
                          >
                            <ImageIcon size={18} />
                            <span className="text-sm">Galerie</span>
                          </button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <img
                    src={selectedShip.image}
                    alt={selectedShip.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold text-white">{selectedShip.name}</h2>
                    {selectedShip.type && (
                      <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-xs rounded-full">
                        {selectedShip.type}
                      </span>
                    )}
                  </div>
                  <p className="text-blue-100 text-sm">{selectedShip.description}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex space-x-1 px-4">
                  {[
                    { id: 'overview', label: "Vue d'ensemble", icon: Info },
                    { id: 'plan', label: 'Plan du navire', icon: Map },
                    { id: 'restaurants', label: 'Restaurants', icon: UtensilsCrossed },
                    { id: 'info', label: 'Informations', icon: Navigation },
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
                          <Users size={18} />
                          <span className="text-sm">Capacité</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{selectedShip.capacity}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <Ship size={18} />
                          <span className="text-sm">Longueur</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{selectedShip.length}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <Navigation size={18} />
                          <span className="text-sm">Vitesse</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{selectedShip.speed}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <Calendar size={18} />
                          <span className="text-sm">Année</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{selectedShip.year}</p>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-5 border border-blue-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Navigation size={20} className="text-blue-600" />
                        <h3 className="font-semibold text-gray-900 text-lg">Lignes maritimes</h3>
                      </div>
                      <div className="space-y-3">
                        {selectedShip.routes.map((route, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <MapPin size={18} className="text-blue-600" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900">{route.from}</span>
                                    <ChevronRight size={16} className="text-blue-500" />
                                    <span className="font-bold text-gray-900">{route.to}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Clock3 size={14} />
                                <span className="font-medium">{route.duration}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Calendar size={14} />
                                <span className="font-medium">{route.frequency}</span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Facilities */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Équipements</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedShip.facilities.map((facility, idx) => (
                          <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                            {facility}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'plan' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Plans des ponts</h3>
                    <div className="space-y-4">
                      {selectedShip.decks.map((deck) => (
                        <motion.div
                          key={deck.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-gray-900">{deck.name}</h4>
                            <Map size={18} className="text-gray-400" />
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Équipements :</p>
                              <div className="flex flex-wrap gap-2">
                                {deck.facilities.map((facility, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 bg-white text-gray-700 rounded text-xs border border-gray-200"
                                  >
                                    {facility}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {deck.restaurants && deck.restaurants.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Restaurants :</p>
                                <div className="flex flex-wrap gap-2">
                                  {deck.restaurants.map((restaurant, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                      {restaurant}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'restaurants' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Restaurants à bord</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedShip.restaurants.map((restaurant) => (
                        <motion.div
                          key={restaurant.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
                        >
                          <div className="relative h-32 bg-gradient-to-r from-orange-400 to-red-500">
                            <img
                              src={restaurant.image}
                              alt={restaurant.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-gray-900">{restaurant.name}</h4>
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                {restaurant.deck}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                              <p className="flex items-center gap-2">
                                <UtensilsCrossed size={14} />
                                {restaurant.type}
                              </p>
                              <p className="flex items-center gap-2">
                                <Users size={14} />
                                Capacité: {restaurant.capacity} personnes
                              </p>
                              <p className="flex items-center gap-2">
                                <Calendar size={14} />
                                {restaurant.openingHours}
                              </p>
                              <p className="flex items-center gap-2">
                                <Coffee size={14} />
                                {restaurant.cuisine}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'info' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Informations techniques</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(selectedShip.technicalInfo).map(([key, value]) => (
                          <div key={key} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-1 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                            <p className="font-semibold text-gray-900">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Statistiques</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-600 mb-1">Passagers actuels</p>
                          <p className="text-2xl font-bold text-gray-900">{selectedShip.passengers}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-600 mb-1">Équipage</p>
                          <p className="text-2xl font-bold text-gray-900">{selectedShip.crew}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Gallery Modal */}
      {showImageModal && selectedShip && selectedShip.gallery && selectedShip.gallery.length > 0 && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative max-w-6xl w-full max-h-[90vh]"
          >
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
            <div className="relative h-[80vh]">
              <img
                src={selectedShip.gallery[selectedImageIndex]}
                alt={`${selectedShip.name} - Image ${selectedImageIndex + 1}`}
                className="w-full h-full object-contain rounded-lg"
              />
              {selectedShip.gallery.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : selectedShip.gallery.length - 1))
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() =>
                      setSelectedImageIndex((prev) => (prev < selectedShip.gallery.length - 1 ? prev + 1 : 0))
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors"
                  >
                    <ChevronRight size={24} />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 px-4 py-2 rounded-full">
                    {selectedShip.gallery.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === selectedImageIndex ? 'bg-white w-6' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute top-4 left-4 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
                    {selectedImageIndex + 1} / {selectedShip.gallery.length}
                  </div>
                </>
              )}
            </div>
            {/* Thumbnail Gallery */}
            {selectedShip.gallery.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {selectedShip.gallery.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === selectedImageIndex ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Bateaux;
