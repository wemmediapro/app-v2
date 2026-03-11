import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Fragment } from 'react';
import {
  Users as UsersIcon,
  Search,
  Edit,
  Trash2,
  Mail,
  Phone,
  Plus,
  X,
  Shield,
} from 'lucide-react';
import FilterBar from '../components/FilterBar';
import { apiService } from '../services/apiService';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { usePermissions } from '../hooks/usePermissions';
import { DASHBOARD_MODULES, getDefaultAccess } from './Settings';

const ROLES = [
  { value: 'passenger', labelKey: 'users.passenger' },
  { value: 'crew', labelKey: 'users.crew' },
  { value: 'admin', labelKey: 'users.admin' },
];

const Users = () => {
  const { t } = useLanguage();
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState(() => searchParams.get('role') || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteHard, setDeleteHard] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for Add
  const [addForm, setAddForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    cabinNumber: '',
    role: 'passenger',
  });

  // Form state for Edit
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    cabinNumber: '',
    role: 'passenger',
    isActive: true,
    password: '',
    allowedModules: null, // { moduleId: boolean, ... } ou null = défaut du rôle
  });

  useEffect(() => {
    const roleFromUrl = searchParams.get('role');
    if (roleFromUrl && ['admin', 'crew', 'passenger'].includes(roleFromUrl)) {
      setRoleFilter(roleFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchUsers();
  }, [searchTerm, roleFilter, statusFilter, countryFilter, destinationFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await apiService.getUsers(params.toString());
      const data = response.data?.users ?? response.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(t('common.errorLoad'));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setAddForm({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      cabinNumber: '',
      role: 'passenger',
    });
    setShowAddModal(true);
  };

  const openEditModal = (user) => {
    setUserToEdit(user);
    const roleDefaults = getDefaultAccess()[user.role || 'passenger'] || getDefaultAccess().admin;
    const allowedModules = user.allowedModules && typeof user.allowedModules === 'object' && Object.keys(user.allowedModules).length > 0
      ? { ...roleDefaults, ...user.allowedModules }
      : { ...roleDefaults };
    setEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      cabinNumber: user.cabinNumber || '',
      role: user.role || 'passenger',
      isActive: user.isActive !== false,
      password: '',
      allowedModules,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (user) => {
    setUserToDelete(user);
    setDeleteHard(false);
    setShowDeleteModal(true);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!addForm.firstName?.trim() || !addForm.lastName?.trim() || !addForm.email?.trim() || !addForm.password) {
      toast.error(t('users.fillRequired'));
      return;
    }
    if (addForm.password.length < 8) {
      toast.error(t('users.passwordMin'));
      return;
    }
    try {
      setSaving(true);
      await apiService.createUser({
        firstName: addForm.firstName.trim(),
        lastName: addForm.lastName.trim(),
        email: addForm.email.trim().toLowerCase(),
        password: addForm.password,
        phone: addForm.phone?.trim() || undefined,
        cabinNumber: addForm.cabinNumber?.trim() || undefined,
        role: addForm.role,
      });
      toast.success(t('users.created'));
      setShowAddModal(false);
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.message || t('common.errorUpdate');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!userToEdit?._id || !editForm.firstName?.trim() || !editForm.lastName?.trim() || !editForm.email?.trim()) {
      toast.error(t('users.fillRequired'));
      return;
    }
    if (editForm.password && editForm.password.length < 8) {
      toast.error(t('users.passwordMin'));
      return;
    }
    try {
      setSaving(true);
      const payload = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone?.trim() || undefined,
        cabinNumber: editForm.cabinNumber?.trim() || undefined,
        role: editForm.role,
        isActive: editForm.isActive,
        allowedModules: editForm.allowedModules,
      };
      if (editForm.password) payload.password = editForm.password;
      await apiService.updateUser(userToEdit._id, payload);
      toast.success(t('common.roleUpdated'));
      setShowEditModal(false);
      setUserToEdit(null);
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.message || t('common.errorUpdate');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete?._id) return;
    try {
      setSaving(true);
      await apiService.deleteUser(userToDelete._id, deleteHard);
      toast.success(deleteHard ? t('users.deletedPermanent') : t('common.userDeactivated'));
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.message || t('common.errorUpdate');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      await apiService.updateUser(userId, { isActive });
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, isActive } : u)));
      toast.success(isActive ? t('common.userActivated') : t('common.userDeactivated'));
    } catch (error) {
      toast.error(t('common.errorUpdate'));
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await apiService.updateUser(userId, { role });
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, role } : u)));
      toast.success(t('common.roleUpdated'));
    } catch (error) {
      toast.error(t('common.errorUpdate'));
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'crew':
        return 'bg-blue-100 text-blue-800';
      case 'passenger':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (isActive) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  if (!can('users')) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-6 text-center" role="alert">
        <p className="text-amber-800 font-medium">{t('common.accessDenied') || 'Accès refusé'}</p>
        <p className="text-sm text-amber-700 mt-1">{t('users.noPermission') || "Vous n'avez pas la permission d'accéder à cette page."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('users.title')}</h1>
          <p className="text-gray-600 mt-2">{t('users.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
        >
          <Plus size={18} />
          {t('users.addUser')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('users.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="lg:w-48">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('users.allRoles')}</option>
              <option value="passenger">{t('users.passenger')}</option>
              <option value="crew">{t('users.crew')}</option>
              <option value="admin">{t('users.admin')}</option>
            </select>
          </div>
          <div className="lg:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('users.allStatuses')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
            </select>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <FilterBar
            countryFilter={countryFilter}
            setCountryFilter={setCountryFilter}
            destinationFilter={destinationFilter}
            setDestinationFilter={setDestinationFilter}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('users.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('users.role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('users.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('users.cabinNumber')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('users.inscription')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      {t('users.noUsers')}
                    </td>
                  </tr>
                ) : (
                  users.map((user, index) => (
                    <motion.tr
                      key={user._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500">
                            <UsersIcon size={16} className="text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.role || 'passenger'}
                          onChange={(e) => handleRoleChange(user._id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${getRoleBadgeColor(user.role || 'passenger')}`}
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {t(r.labelKey)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(user._id, !user.isActive)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${getStatusBadgeColor(user.isActive)}`}
                        >
                          {user.isActive ? t('common.active') : t('common.inactive')}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.cabinNumber || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title={t('common.edit')}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(user)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title={t('common.delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                          <a
                            href={`mailto:${user.email}`}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            title={t('users.email')}
                          >
                            <Mail size={16} />
                          </a>
                          {user.phone && (
                            <a
                              href={`tel:${user.phone}`}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              title={t('users.phone')}
                            >
                              <Phone size={16} />
                            </a>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ajouter utilisateur */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => !saving && setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{t('users.addUser')}</h2>
                <button
                  type="button"
                  onClick={() => !saving && setShowAddModal(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateUser} className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.firstName')} *</label>
                    <input
                      type="text"
                      value={addForm.firstName}
                      onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.lastName')} *</label>
                    <input
                      type="text"
                      value={addForm.lastName}
                      onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.email')} *</label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('users.password')} * <span className="text-gray-500 text-xs">(min. 8 caractères)</span>
                  </label>
                  <input
                    type="password"
                    value={addForm.password}
                    onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    minLength={8}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.phone')}</label>
                    <input
                      type="text"
                      value={addForm.phone}
                      onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.cabinNumber')}</label>
                    <input
                      type="text"
                      value={addForm.cabinNumber}
                      onChange={(e) => setAddForm((f) => ({ ...f, cabinNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.role')}</label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {t(r.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? t('common.loading') : t('common.save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Modifier utilisateur + Gestion des accès */}
      <AnimatePresence>
        {showEditModal && userToEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => !saving && setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{t('users.editUser')}</h2>
                <button
                  type="button"
                  onClick={() => !saving && setShowEditModal(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.firstName')} *</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.lastName')} *</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.email')} *</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.phone')}</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.cabinNumber')}</label>
                    <input
                      type="text"
                      value={editForm.cabinNumber}
                      onChange={(e) => setEditForm((f) => ({ ...f, cabinNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Gestion des accès */}
                <div className="border-t border-gray-200 pt-4 space-y-4">
                  <div className="flex items-center gap-2 text-gray-900 font-medium">
                    <Shield size={18} />
                    {t('users.accessManagement')}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.role')}</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {t(r.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{t('users.accountStatus')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {editForm.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={editForm.isActive}
                        onClick={() => setEditForm((f) => ({ ...f, isActive: !f.isActive }))}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          editForm.isActive ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                            editForm.isActive ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Accès par module */}
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">{t('users.accessByModule')}</p>
                    <div className="max-h-56 overflow-y-auto space-y-3">
                      {[...new Set(DASHBOARD_MODULES.map((m) => m.groupKey))].map((groupKey) => (
                        <Fragment key={groupKey}>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">
                            {t(groupKey)}
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {DASHBOARD_MODULES.filter((m) => m.groupKey === groupKey).map((mod) => (
                              <label key={mod.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!editForm.allowedModules?.[mod.id]}
                                  onChange={() => setEditForm((f) => ({
                                    ...f,
                                    allowedModules: {
                                      ...f.allowedModules,
                                      [mod.id]: !f.allowedModules?.[mod.id],
                                    },
                                  }))}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{t(mod.labelKey)}</span>
                              </label>
                            ))}
                          </div>
                        </Fragment>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({
                        ...f,
                        allowedModules: { ...getDefaultAccess()[f.role] || getDefaultAccess().admin },
                      }))}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      {t('users.applyRoleDefaults')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('users.newPassword')} <span className="text-gray-500 text-xs">(optionnel)</span>
                  </label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    minLength={8}
                  />
                </div>

                <div className="flex gap-2 pt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? t('common.loading') : t('common.save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Confirmation suppression */}
      <AnimatePresence>
        {showDeleteModal && userToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => !saving && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <Trash2 size={24} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{t('users.deleteConfirmTitle')}</h2>
              </div>
              <p className="text-gray-600 mb-4">
                {t('users.deleteConfirmMessage')}{' '}
                <strong>
                  {userToDelete.firstName} {userToDelete.lastName}
                </strong>
                ({userToDelete.email}) ?
              </p>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="deleteHard"
                  checked={deleteHard}
                  onChange={(e) => setDeleteHard(e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="deleteHard" className="text-sm text-gray-700">
                  {t('users.deletePermanent')}
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? t('common.loading') : deleteHard ? t('users.deletePermanent') : t('users.deactivate')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Users;
