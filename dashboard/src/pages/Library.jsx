import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Music, Trash, Plus, Search, Play, Pause, FileAudio
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

const Library = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [mp3Library, setMp3Library] = useState(() => {
    const saved = localStorage.getItem('mp3Library');
    return saved ? JSON.parse(saved) : [];
  });

  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [libraryDurationFilter, setLibraryDurationFilter] = useState('all');
  const [librarySortBy, setLibrarySortBy] = useState('date');
  const [selectedLibraryFiles, setSelectedLibraryFiles] = useState([]);
  const [previewingFile, setPreviewingFile] = useState(null);
  const [audioElement, setAudioElement] = useState(null);

  useEffect(() => {
    localStorage.setItem('mp3Library', JSON.stringify(mp3Library));
  }, [mp3Library]);

  useEffect(() => {
    if (previewingFile && previewingFile.streamUrl) {
      const audio = new Audio(previewingFile.streamUrl);
      audio.play();
      setAudioElement(audio);
      audio.onended = () => {
        setPreviewingFile(null);
        setAudioElement(null);
      };
      return () => {
        audio.pause();
        audio.src = '';
      };
    } else if (audioElement) {
      audioElement.pause();
      setAudioElement(null);
    }
  }, [previewingFile]);

  // Fichiers music uniquement (hors radio, recording, advert, shout-out)
  const musicFiles = useMemo(() => {
    return mp3Library.filter(f => {
      if (f.deleted) return false;
      const category = (f.category || '').toLowerCase();
      return !category.includes('radio') && !category.includes('recording') && !category.includes('advert') && !category.includes('shout');
    });
  }, [mp3Library]);

  const filteredLibrary = useMemo(() => {
    let filtered = [...musicFiles];

    if (librarySearchQuery) {
      const query = librarySearchQuery.toLowerCase();
      filtered = filtered.filter(file =>
        file.name.toLowerCase().includes(query) ||
        (file.title && file.title.toLowerCase().includes(query)) ||
        (file.artist && file.artist.toLowerCase().includes(query)) ||
        (file.album && file.album.toLowerCase().includes(query)) ||
        (file.tags && file.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    if (libraryDurationFilter !== 'all') {
      const [min, max] = libraryDurationFilter.split('-').map(Number);
      filtered = filtered.filter(file => {
        const duration = file.duration || 0;
        if (max) return duration >= min * 60 && duration <= max * 60;
        return duration >= min * 60;
      });
    }

    filtered.sort((a, b) => {
      switch (librarySortBy) {
        case 'name':
          return (a.title || a.name).localeCompare(b.title || b.name);
        case 'duration':
          return (b.duration || 0) - (a.duration || 0);
        case 'size':
          return (b.fileSize || 0) - (a.fileSize || 0);
        case 'date':
        default:
          return new Date(b.uploadDate || b.dateAdded || Date.now()) - new Date(a.uploadDate || a.dateAdded || Date.now());
      }
    });

    return filtered;
  }, [musicFiles, librarySearchQuery, libraryDurationFilter, librarySortBy]);

  const trayStats = useMemo(() => {
    const totalDuration = musicFiles.reduce((sum, f) => sum + (f.duration || 0), 0);
    return { count: musicFiles.length, minutes: Math.floor(totalDuration / 60) };
  }, [musicFiles]);

  const handleLibraryMP3Upload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let uploadedCount = 0;
    let errorCount = 0;

    files.forEach((file, index) => {
      if (!file.type.includes('audio/mpeg') && !file.name.toLowerCase().endsWith('.mp3')) {
        errorCount++;
        return;
      }
      if (file.size > 250 * 1024 * 1024) {
        errorCount++;
        toast.error(`Fichier trop volumineux : ${file.name} (max 250 Mo)`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const fileNameParts = file.name.replace('.mp3', '').split(' - ');
        const artist = fileNameParts.length > 1 ? fileNameParts[0] : '';
        const title = fileNameParts.length > 1 ? fileNameParts.slice(1).join(' - ') : fileNameParts[0];

        const newFile = {
          id: `mp3_${Date.now()}_${index}`,
          name: file.name,
          title,
          artist,
          file,
          streamUrl: previewUrl,
          duration: Math.round(audio.duration),
          fileSize: file.size,
          uploadDate: new Date().toISOString(),
          dateAdded: new Date().toISOString(),
          category: 'Music',
          tags: [],
          playCount: 0,
          lastPlayed: null,
          bitrate: Math.round((file.size * 8) / audio.duration / 1000) || 128
        };
        setMp3Library(prev => [...prev, newFile]);
        uploadedCount++;
        if (uploadedCount + errorCount === files.length) {
          if (uploadedCount > 0) toast.success(`${uploadedCount} fichier(s) MP3 ajouté(s) à la bibliothèque`);
          if (errorCount > 0) toast.error(`${errorCount} fichier(s) invalide(s) ignoré(s)`);
        }
      };
      audio.onerror = () => {
        errorCount++;
        if (uploadedCount + errorCount === files.length && errorCount > 0) {
          toast.error(`${errorCount} fichier(s) invalide(s) ignoré(s)`);
        }
      };
      audio.src = previewUrl;
    });
  };

  const handleLibraryDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.includes('audio/mpeg') || file.name.toLowerCase().endsWith('.mp3')
    );
    if (files.length > 0) {
      handleLibraryMP3Upload({ target: { files } });
    }
  };

  const moveToTrash = (fileId) => {
    setMp3Library(prev => prev.map(f => f.id === fileId ? { ...f, deleted: true, deletedAt: new Date().toISOString() } : f));
    toast.success('Fichier déplacé dans la corbeille');
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const deleteLibraryFile = (fileId) => {
    moveToTrash(fileId);
  };

  return (
    <div className="space-y-6 pb-8 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('library.title')}</h1>
          <p className="text-gray-600 mt-2">{t('library.subtitle')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/radio')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Retour à Radio
        </motion.button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Music size={24} className="text-gray-700" />
              <h2 className="text-2xl font-semibold text-gray-900">♫ Music</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un titre..."
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  className="pl-9 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <label>
              <input
                type="file"
                accept="audio/mpeg,.mp3"
                multiple
                onChange={(e) => { handleLibraryMP3Upload(e); e.target.value = ''; }}
                className="hidden"
                id="library-file-input"
              />
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => document.getElementById('library-file-input')?.click()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                Ajouter des pistes
              </motion.button>
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                Trier par
                <select
                  value={librarySortBy}
                  onChange={(e) => setLibrarySortBy(e.target.value)}
                  className="py-1.5 px-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  <option value="date">Date d'ajout</option>
                  <option value="name">Nom</option>
                  <option value="duration">Durée</option>
                  <option value="size">Taille</option>
                </select>
              </label>
              <p className="text-sm text-gray-600">
                {trayStats.count} piste{trayStats.count !== 1 ? 's' : ''} — {trayStats.minutes} min
              </p>
            </div>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto min-h-[400px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleLibraryDrop}
        >
          {filteredLibrary.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              <div className="text-center">
                <FileAudio size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Aucune piste</p>
                <p className="text-sm mt-1">Ajoutez des pistes avec le bouton « Ajouter des pistes »</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedLibraryFiles.length === filteredLibrary.length && filteredLibrary.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedLibraryFiles(filteredLibrary.map(f => f.id));
                          else setSelectedLibraryFiles([]);
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artist</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Album</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added on</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredLibrary.map((file) => {
                    const isSelected = selectedLibraryFiles.includes(file.id);
                    const isPlaying = previewingFile?.id === file.id;
                    const uploadDate = file.uploadDate || file.dateAdded || new Date();
                    return (
                      <motion.tr
                        key={file.id}
                        className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''} ${isPlaying ? 'bg-purple-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedLibraryFiles(prev => [...prev, file.id]);
                              else setSelectedLibraryFiles(prev => prev.filter(id => id !== file.id));
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                              <Music size={14} className="text-gray-500" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{file.title || file.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{file.artist || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{file.album || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(uploadDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          {file.tags && file.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {file.tags.slice(0, 2).map((tag, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                              ))}
                              {file.tags.length > 2 && <span className="px-2 py-0.5 text-gray-500 text-xs">+{file.tags.length - 2}</span>}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">{formatDuration(file.duration)}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewingFile(isPlaying ? null : file);
                                }}
                                className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                                title="Écouter"
                              >
                                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteLibraryFile(file.id); }}
                                className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                                title="Supprimer"
                              >
                                <Trash size={14} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Library;
