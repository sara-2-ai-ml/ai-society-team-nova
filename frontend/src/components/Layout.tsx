import { Landmark, LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { User } from '../api/types';
import { useApp } from '../lib/AppContext';
import { LanguageSwitch, getLang, t } from '../i18n';
import { cx } from './ui';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

const ROLE_BADGE = {
  OPERATOR: 'bg-violet-50 text-violet-800 ring-violet-200',
  DREJTORIA: 'bg-amber-50 text-amber-800 ring-amber-200',
  KRYETARI: 'bg-brand-50 text-brand-800 ring-brand-200',
};

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white" aria-hidden>
        <Landmark size={20} />
      </span>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold text-slate-900">{t('brand.title')}</div>
        <div className="text-xs text-slate-500">{t('brand.subtitle')}</div>
      </div>
    </div>
  );
}

function Nav({ items, current, onGo }: { items: NavItem[]; current: string; onGo?: () => void }) {
  return (
    <nav aria-label={t('nav.menu')} className="flex flex-col gap-1">
      {items.map((item) => {
        const active = current === item.path;
        return (
          <a
            key={item.path}
            href={`#/${item.path}`}
            onClick={onGo}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition',
              active ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <item.icon size={18} strokeWidth={1.9} aria-hidden className={active ? 'text-brand-700' : 'text-slate-400'} />
            <span className="flex-1">{item.label}</span>
            {!!item.badge && (
              <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-medium text-white tabular-nums">{item.badge}</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

function UserBox({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { units } = useApp();
  const unit = units.find((u) => u.id === user.unitId);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span className={cx('inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', ROLE_BADGE[user.role])}>
        {unit ? (unit.type === 'agjenci' ? t('role.agency') : t('role.DREJTORIA')) : t(`role.${user.role}`)}
      </span>
      <p className="mt-2 text-sm font-medium text-slate-900">{unit ? unit.name : getLang() === 'en' ? user.fullNameEn : user.fullName}</p>
      <p className="text-xs text-slate-500">{user.username}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button onClick={onLogout} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
          <LogOut size={15} aria-hidden /> {t('user.logout')}
        </button>
        <LanguageSwitch />
      </div>
    </div>
  );
}

export function Layout({
  user,
  items,
  current,
  onLogout,
  children,
}: {
  user: User;
  items: NavItem[];
  current: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col gap-6 border-r border-slate-200 bg-white px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <Nav items={items} current={current} />
        <div className="mt-auto">
          <UserBox user={user} onLogout={onLogout} />
        </div>
      </aside>

      {/* Phones and tablets: a top bar with a menu */}
      <div className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={t('nav.menuButton')}
            className="rounded-lg border border-slate-300 p-2 text-slate-700"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="space-y-4 border-t border-slate-100 px-4 py-4">
            <Nav items={items} current={current} onGo={() => setMenuOpen(false)} />
            <UserBox user={user} onLogout={onLogout} />
          </div>
        )}
      </div>

      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
