import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DASHBOARD_CHART_COLORS } from './statCardStyles';

/**
 * Graphique rôles utilisateurs + liste des inscriptions récentes.
 */
export default function DashboardHomeOverview({ stats, usersByRoleTitle, recentUsersTitle }) {
  const roleData = stats?.charts?.usersByRole || [];
  const recentUsers = stats?.recent?.users || [];

  return (
    <section className="grid grid-cols-1 xl:grid-cols-3 gap-6" aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="sr-only">
        Vue d’ensemble
      </h2>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className="xl:col-span-2 bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-4">{usersByRoleTitle}</h3>
        <div className="h-[280px]">
          {roleData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ _id, percent }) => `${_id} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {roleData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry._id ?? index}`}
                      fill={DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 text-center py-6">Aucune donnée disponible.</p>
          )}
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.15 }}
        className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm flex flex-col"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-4">{recentUsersTitle}</h3>
        <ul className="space-y-2 flex-1 min-h-0 overflow-y-auto">
          {recentUsers.length > 0 ? (
            recentUsers.map((user, index) => (
              <li
                key={user._id || index}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-gray-50/90 hover:bg-gray-100/90 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Users size={16} className="text-blue-600" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{new Date(user.createdAt).toLocaleDateString()}</span>
              </li>
            ))
          ) : (
            <li className="py-8 text-center text-sm text-gray-500">Aucun utilisateur récent.</li>
          )}
        </ul>
      </motion.div>
    </section>
  );
}
