/**
 * Hook Chat : Socket.io, conversations, messages, typing.
 * Conforme à docs/REFACTORING-APP.md. Logique extraite de App.jsx.
 */
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { apiService } from '../services/apiService';
import { buildPassengerSocketIoOptions } from '../lib/socketIoClientOptions';
import {
  enqueue,
  flushPendingQueue,
  setOfflineFlushHandler,
  parseReceiverFromChatRoom,
} from '../services/offlineQueue';

/** Extrait l’id utilisateur du JWT (payload) — aligné sur le backend (champ id). */
function getUserIdFromToken() {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return payload.id || payload.userId || payload._id || null;
  } catch {
    return null;
  }
}

/** Room Socket.io canonique pour une conversation 1-1 (même format que backend/src/socket/roomUtils.js). */
function chatDmRoomName(userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  return a < b ? `chat:${a}_${b}` : `chat:${b}_${a}`;
}

/** Id pair pour la room DM (string ou objet conversation). */
function peerIdFromSelection(sel) {
  if (sel == null) return null;
  return typeof sel === 'string' ? sel : (sel?.id ?? null);
}

function peerChatRoom(selectedChat) {
  const peerId = peerIdFromSelection(selectedChat);
  const myId = getUserIdFromToken();
  if (!peerId || !myId) return null;
  return chatDmRoomName(myId, peerId);
}

/**
 * @param {{ refreshOfflineQueueCount?: () => void | Promise<void> }} options
 */
export function useChat(options = {}) {
  const { refreshOfflineQueueCount } = options;
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [socket, setSocket] = useState(null);
  const [chatUsers, setChatUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [openConversationMenu, setOpenConversationMenu] = useState(null);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [mutedConversations, setMutedConversations] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const conversationMenuRefs = useRef({});
  /** Réf. pour déconnecter la socket si le cleanup s’exécute avant/après la fin de l’import dynamique. */
  const socketInstanceRef = useRef(null);
  /** Conversation active — utilisé au `connect` / reconnect pour rejoindre la room DM sans effet dépendant. */
  const selectedChatRef = useRef(selectedChat);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useLayoutEffect(() => {
    setOfflineFlushHandler(async (item) => {
      const myId = getUserIdFromToken();
      if (!myId) throw new Error('Utilisateur non authentifié');
      const receiver = parseReceiverFromChatRoom(item.room, myId);
      if (!receiver) throw new Error('Room invalide');
      await apiService.sendMessage({
        receiver,
        content: item.content,
        type: 'text',
        clientSyncId: item.id,
      });
      if (socket?.connected && item.room) {
        socket.emit('send-message', { room: item.room, content: item.content, text: item.content });
      }
    });
    return () => setOfflineFlushHandler(null);
  }, [socket]);

  // Socket.io — import dynamique pour réduire le JS initial (chunk séparé).
  useEffect(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return undefined;
    let cancelled = false;
    socketInstanceRef.current = null;
    const socketUrl = import.meta.env.DEV
      ? ''
      : import.meta.env.VITE_SOCKET_URL ||
        (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '') ||
        (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

    (async () => {
      try {
        const { io } = await import('socket.io-client');
        if (cancelled) return;
        const s = io(socketUrl || undefined, buildPassengerSocketIoOptions(token));
        socketInstanceRef.current = s;

        const joinNotificationAndDmRooms = () => {
          const myId = getUserIdFromToken();
          if (!myId) return;
          s.emit('join-room', `notifications:${myId}`);
          const peer = peerIdFromSelection(selectedChatRef.current);
          if (peer) {
            s.emit('join-room', chatDmRoomName(myId, peer));
          }
        };

        s.connect();
        s.on('connect', () => {
          if (cancelled) return;
          setSocket(s);
          joinNotificationAndDmRooms();
        });
        // Ne pas détruire la socket ici : reconnexion bornée (voir socketIoClientOptions.js).
        s.on('connect_error', () => {});
        s.on('disconnect', () => {});
        s.on('new-message', (message) => {
          if (message && message.__batch === true && Array.isArray(message.messages)) {
            setChatMessages((prev) => [...prev, ...message.messages]);
            return;
          }
          setChatMessages((prev) => [...prev, message]);
        });
        s.on('typing', (data) => {
          setTypingUsers((prev) => ({ ...prev, [data.userId]: data.isTyping }));
        });
        s.on('message-read', (data) => {
          setChatMessages((prev) => prev.map((msg) => (msg.id === data.messageId ? { ...msg, isRead: true } : msg)));
        });
        if (cancelled) {
          try {
            s.removeAllListeners();
            if (s.connected) s.disconnect();
          } catch (_) {}
          socketInstanceRef.current = null;
        }
      } catch (_err) {
        const inst = socketInstanceRef.current;
        if (inst) {
          try {
            inst.disconnect();
          } catch (_) {}
          socketInstanceRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = socketInstanceRef.current;
      socketInstanceRef.current = null;
      if (s) {
        try {
          if (s.connected) s.disconnect();
          else s.removeAllListeners();
        } catch (_) {}
      }
    };
  }, []);

  // Room DM quand la conversation change (pas sur `socket` : évite un 2e join identique au premier `connect`).
  useEffect(() => {
    const peer = peerIdFromSelection(selectedChat);
    if (!peer) return;
    const s = socketInstanceRef.current;
    if (!s?.connected) return;
    const myId = getUserIdFromToken();
    if (!myId) return;
    s.emit('join-room', chatDmRoomName(myId, peer));
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const loadChatData = async () => {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        try {
          const conversationsPromise = apiService.getConversations();
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
          const conversationsResponse = await Promise.race([conversationsPromise, timeoutPromise]);
          if (conversationsResponse?.data) {
            const transformedUsers = conversationsResponse.data.map((conv, index) => ({
              id: conv.user?._id || conv.userId,
              conversationId: conv._id || `conv-${index}`,
              name: `${conv.user?.firstName || ''} ${conv.user?.lastName || ''}`.trim() || 'Utilisateur',
              avatar: conv.user?.avatar || '',
              status: 'online',
              lastSeen: 'En ligne',
              isTyping: false,
              unreadCount: conv.unreadCount || 0,
            }));
            setChatUsers(transformedUsers);
            return;
          }
        } catch (error) {
          const status = error.response?.status;
          const isAuthOrUnavailable = status === 401 || error.code === 'ERR_NETWORK' || error.message === 'Timeout';
          if (!isAuthOrUnavailable) {
            console.warn('Erreur lors du chargement des données de chat:', error.message);
          }
        }
      }
      setChatUsers([]);
      setChatMessages([]);
    };
    loadChatData();
  }, [selectedChat]);

  useEffect(() => {
    if (showAddUser && userSearchQuery) {
      const timeoutId = setTimeout(() => searchUsers(userSearchQuery), 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [userSearchQuery, showAddUser]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openConversationMenu) {
        const menuRef = conversationMenuRefs.current[openConversationMenu];
        if (menuRef && !menuRef.contains(event.target)) {
          setOpenConversationMenu(null);
        }
      }
    };
    if (openConversationMenu) {
      const t = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
      return () => {
        clearTimeout(t);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openConversationMenu]);

  const searchUsers = useCallback(async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const isEmail = query.includes('@');
    const phoneNumber = query.replace(/\D/g, '');
    const isPhone = phoneNumber.length >= 3;
    if (!isEmail && !isPhone) {
      setSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const response = await apiService.get(`/messages/users/search?q=${encodeURIComponent(query)}`);
      if (response.data) {
        const transformed = response.data.map((user) => ({
          id: user._id || user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Utilisateur',
          avatar: user.avatar || `https://ui-avatars.com/api/?name=${user.firstName || 'User'}`,
          email: user.email,
          phone: user.phone,
          cabinNumber: user.cabinNumber,
          status: 'online',
          lastSeen: 'En ligne',
          isTyping: false,
          unreadCount: 0,
        }));
        setSearchResults(transformed);
      }
    } catch (error) {
      console.error("Erreur lors de la recherche d'utilisateurs:", error);
      if (isEmail) {
        setSearchResults([
          {
            id: 999,
            name: query.split('@')[0],
            avatar: `https://ui-avatars.com/api/?name=${query.split('@')[0]}`,
            email: query,
            phone: '0612345678',
            cabinNumber: 'A100',
            status: 'online',
            lastSeen: 'En ligne',
            isTyping: false,
            unreadCount: 0,
          },
        ]);
      } else if (isPhone) {
        setSearchResults([
          {
            id: 999,
            name: `Utilisateur ${phoneNumber}`,
            avatar: `https://ui-avatars.com/api/?name=${phoneNumber}`,
            email: `user${phoneNumber}@gnv.local`,
            phone: phoneNumber,
            cabinNumber: 'A100',
            status: 'online',
            lastSeen: 'En ligne',
            isTyping: false,
            unreadCount: 0,
          },
        ]);
      }
    } finally {
      setIsSearchingUsers(false);
    }
  }, []);

  const startNewChat = useCallback(
    (user) => {
      const existingChat = chatUsers.find((u) => u.id === user.id);
      if (existingChat) {
        setSelectedChat(user.id);
        setSelectedChatUser(existingChat);
      } else {
        const newUser = { ...user, unreadCount: 0 };
        setChatUsers((prev) => [newUser, ...prev]);
        setSelectedChat(user.id);
        setSelectedChatUser(newUser);
        setChatMessages([]);
      }
      setShowAddUser(false);
      setUserSearchQuery('');
      setSearchResults([]);
    },
    [chatUsers]
  );

  const getChatMessages = useCallback((chatId) => chatMessages.filter((msg) => msg.chatId === chatId), [chatMessages]);
  const getLastMessage = useCallback(
    (chatId) => {
      const messages = chatMessages.filter((msg) => msg.chatId === chatId);
      return messages[messages.length - 1];
    },
    [chatMessages]
  );

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedChat) return;
    const dmRoom = peerChatRoom(selectedChat);
    if (!dmRoom) return;

    const newMsg = {
      id: Date.now(),
      chatId: selectedChat,
      senderId: 0,
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      isRead: false,
      type: 'text',
      attachments: [],
      reactions: [],
    };

    const online = typeof navigator === 'undefined' ? true : navigator.onLine;

    if (!online) {
      try {
        await enqueue({
          room: dmRoom,
          content: newMsg.content,
        });
        await refreshOfflineQueueCount?.();
      } catch (e) {
        console.error("Impossible d'enregistrer le message hors ligne:", e);
      }
      setChatMessages((prev) => [...prev, newMsg]);
      setNewMessage('');
      setIsTyping(false);
      return;
    }

    try {
      await flushPendingQueue();
    } catch (e) {
      console.warn('Flush file hors ligne (non bloquant):', e);
    }
    await refreshOfflineQueueCount?.();

    setChatMessages((prev) => [...prev, newMsg]);
    setNewMessage('');
    if (socket?.connected && dmRoom) {
      socket.emit('send-message', { room: dmRoom, content: newMsg.content, text: newMsg.content });
    }
    try {
      await apiService.sendMessage({ receiver: selectedChat, content: newMsg.content, type: 'text' });
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      try {
        await enqueue({ room: dmRoom, content: newMsg.content });
        await refreshOfflineQueueCount?.();
      } catch (qerr) {
        console.error('Impossible de mettre en file après échec réseau:', qerr);
      }
    }
    setIsTyping(false);
    const tr = peerChatRoom(selectedChat);
    if (socket?.connected && tr) {
      socket.emit('typing', { room: tr, userId: 0, isTyping: false });
    }
  }, [newMessage, selectedChat, socket, refreshOfflineQueueCount]);

  const handleTyping = useCallback(
    (e) => {
      setNewMessage(e.target.value);
      if (!isTyping && e.target.value.trim()) {
        setIsTyping(true);
        const tr = peerChatRoom(selectedChat);
        if (socket?.connected && tr) {
          socket.emit('typing', { room: tr, userId: 0, isTyping: true });
        }
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        const tr = peerChatRoom(selectedChat);
        if (socket?.connected && tr) {
          socket.emit('typing', { room: tr, userId: 0, isTyping: false });
        }
      }, 1000);
    },
    [isTyping, selectedChat, socket]
  );

  const handleFileUpload = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const attachment = {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          url: reader.result,
          name: file.name,
          size: file.size,
        };
        const newMsg = {
          id: Date.now(),
          chatId: selectedChat,
          senderId: 0,
          content: '',
          timestamp: new Date().toISOString(),
          isRead: false,
          type: attachment.type,
          attachments: [attachment],
          reactions: [],
        };
        setChatMessages((prev) => [...prev, newMsg]);
        const dmRoom = peerChatRoom(selectedChat);
        if (socket?.connected && dmRoom) {
          socket.emit('send-message', { room: dmRoom, content: newMsg.content || '📎', text: newMsg.content || '📎' });
        }
      };
      reader.readAsDataURL(file);
    },
    [selectedChat, socket]
  );

  const addReaction = useCallback((messageId, emoji) => {
    setChatMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = msg.reactions || [];
        const existingReaction = reactions.find((r) => r.emoji === emoji && r.userId === 0);
        if (existingReaction) {
          return { ...msg, reactions: reactions.filter((r) => !(r.emoji === emoji && r.userId === 0)) };
        }
        return { ...msg, reactions: [...reactions, { emoji, userId: 0, timestamp: new Date().toISOString() }] };
      })
    );
  }, []);

  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setVoiceRecording({ blob: audioBlob, url: URL.createObjectURL(audioBlob) });
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setIsRecordingVoice(true);
    } catch (error) {
      console.error("Erreur lors du démarrage de l'enregistrement:", error);
      alert("Impossible d'accéder au microphone. Veuillez vérifier les permissions.");
    }
  }, []);

  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
    }
  }, []);

  const sendVoiceMessage = useCallback(() => {
    if (!voiceRecording || !selectedChat) return;
    const attachment = {
      type: 'voice',
      url: voiceRecording.url,
      blob: voiceRecording.blob,
      name: 'Voice message',
      duration: 0,
    };
    const newMsg = {
      id: Date.now(),
      chatId: selectedChat,
      senderId: 0,
      content: '🎤 Message vocal',
      timestamp: new Date().toISOString(),
      isRead: false,
      type: 'voice',
      attachments: [attachment],
      reactions: [],
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setVoiceRecording(null);
    setIsRecordingVoice(false);
    const dmRoom = peerChatRoom(selectedChat);
    if (socket?.connected && dmRoom) {
      socket.emit('send-message', { room: dmRoom, content: newMsg.content, text: newMsg.content });
    }
  }, [voiceRecording, selectedChat, socket]);

  const togglePinMessage = useCallback((messageId) => {
    setPinnedMessages((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    );
  }, []);

  const deleteConversation = useCallback(
    (chatId) => {
      setChatUsers((prev) => prev.filter((u) => u.id !== chatId));
      setChatMessages((prev) => prev.filter((msg) => msg.chatId !== chatId));
      if (selectedChat === chatId) {
        setSelectedChat(null);
        setSelectedChatUser(null);
      }
      setOpenConversationMenu(null);
    },
    [selectedChat]
  );

  const archiveConversation = useCallback(
    (chatId) => {
      setArchivedConversations((prev) => [...prev, chatId]);
      setChatUsers((prev) => prev.filter((u) => u.id !== chatId));
      if (selectedChat === chatId) {
        setSelectedChat(null);
        setSelectedChatUser(null);
      }
      setOpenConversationMenu(null);
    },
    [selectedChat]
  );

  const unarchiveConversation = useCallback((chatId) => {
    setArchivedConversations((prev) => prev.filter((id) => id !== chatId));
    setOpenConversationMenu(null);
  }, []);

  const muteConversation = useCallback((chatId) => {
    setMutedConversations((prev) => [...prev, chatId]);
    setOpenConversationMenu(null);
  }, []);

  const unmuteConversation = useCallback((chatId) => {
    setMutedConversations((prev) => prev.filter((id) => id !== chatId));
    setOpenConversationMenu(null);
  }, []);

  const markAsRead = useCallback((chatId) => {
    setChatUsers((prev) => prev.map((u) => (u.id === chatId ? { ...u, unreadCount: 0 } : u)));
    setChatMessages((prev) => prev.map((msg) => (msg.chatId === chatId ? { ...msg, isRead: true } : msg)));
    setOpenConversationMenu(null);
  }, []);

  const markAsUnread = useCallback((chatId) => {
    setChatUsers((prev) => prev.map((u) => (u.id === chatId ? { ...u, unreadCount: 1 } : u)));
    setOpenConversationMenu(null);
  }, []);

  const blockUser = useCallback(
    (userId) => {
      setBlockedUsers((prev) => [...prev, userId]);
      deleteConversation(userId);
    },
    [deleteConversation]
  );

  const unblockUser = useCallback((userId) => {
    setBlockedUsers((prev) => prev.filter((id) => id !== userId));
  }, []);

  const filteredChatUsers = chatUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(chatSearchQuery.toLowerCase()) &&
      !archivedConversations.includes(user.id) &&
      !blockedUsers.includes(user.id)
  );
  const filteredArchivedConversations = chatUsers.filter(
    (user) => archivedConversations.includes(user.id) && user.name.toLowerCase().includes(chatSearchQuery.toLowerCase())
  );
  const filteredMessages = selectedChat
    ? getChatMessages(selectedChat).filter((msg) => {
        if (!messageSearchQuery?.trim()) return true;
        return msg.content?.toLowerCase().includes(messageSearchQuery.toLowerCase());
      })
    : [];

  const formatTime = useCallback((timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    if (diffInHours < 1) return "À l'instant";
    if (diffInHours < 24) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }, []);

  return {
    selectedChat,
    setSelectedChat,
    newMessage,
    setNewMessage,
    chatSearchQuery,
    setChatSearchQuery,
    selectedChatUser,
    setSelectedChatUser,
    chatMessages,
    setChatMessages,
    messageSearchQuery,
    setMessageSearchQuery,
    isTyping,
    typingUsers,
    socket,
    chatUsers,
    setChatUsers,
    showAddUser,
    setShowAddUser,
    userSearchQuery,
    setUserSearchQuery,
    searchResults,
    isSearchingUsers,
    isRecordingVoice,
    voiceRecording,
    setVoiceRecording,
    pinnedMessages,
    showPinnedMessages,
    setShowPinnedMessages,
    openConversationMenu,
    setOpenConversationMenu,
    archivedConversations,
    mutedConversations,
    blockedUsers,
    fileInputRef,
    messagesEndRef,
    conversationMenuRefs,
    filteredChatUsers,
    filteredArchivedConversations,
    filteredMessages,
    searchUsers,
    startNewChat,
    getChatMessages,
    getLastMessage,
    sendMessage,
    handleTyping,
    handleFileUpload,
    addReaction,
    startVoiceRecording,
    stopVoiceRecording,
    sendVoiceMessage,
    togglePinMessage,
    deleteConversation,
    archiveConversation,
    unarchiveConversation,
    muteConversation,
    unmuteConversation,
    markAsRead,
    markAsUnread,
    blockUser,
    unblockUser,
    formatTime,
  };
}
