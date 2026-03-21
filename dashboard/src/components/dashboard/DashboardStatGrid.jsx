import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { statIconBg, statIconColor } from './statCardStyles';

/**
 * @param {object} props
 * @param {Array<{ title: string, value: unknown, change: string, changeType: string, icon: import('react').ComponentType, color: string }>} props.statCards
 * @param {string} props.sectionHeading — titre accessible de la section
 * @param {string} props.vsLastMonthLabel — ex. t('common.vsLastMonth')
 */
export default function DashboardStatGrid({ statCards, sectionHeading, vsLastMonthLabel }) {
  return (
    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="text-sm font-semibold text-gray-700 mb-4">
        {sectionHeading}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.3) }}
              className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-sm hover:shadow-md hover:border-gray-300/80 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{stat.title}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {stat.changeType === 'positive' && (
                      <TrendingUp size={14} className="text-emerald-500 flex-shrink-0" aria-hidden />
                    )}
                    {stat.changeType === 'negative' && (
                      <TrendingDown size={14} className="text-red-500 flex-shrink-0" aria-hidden />
                    )}
                    <span
                      className={`text-xs font-medium ${stat.changeType === 'positive' ? 'text-emerald-600' : stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-500'}`}
                    >
                      {stat.change}
                    </span>
                    <span className="text-xs text-gray-400">{vsLastMonthLabel}</span>
                  </div>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${statIconBg[stat.color]}`}
                >
                  <Icon size={20} className={statIconColor[stat.color]} aria-hidden />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
