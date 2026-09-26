import { CalendarDays, Landmark, LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { User } from '../api/types';
import { LanguageSwitch, getLang, t } from '../i18n';
import { useApp } from '../lib/AppContext';
import { formatLongDate } from '../lib/dates';
import { cx } from './ui';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white" aria-hidden>
        <Landmark size={20} />
      </span>
      <div className="leading-tight">
        <div className="text-[15px] font-bold text-slate-900">{t('brand.title')}</div>
        <div className="text-xs text-slate-500">{t('brand.subtitle')}</div>
      </div>
    </div>
  );
}

function Nav({ items, current, onGo }: { items: NavItem[]; current: string; onGo?: () => void }) {
  return (
    <nav aria-label={t('nav.menu')} className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = current === item.path;
        return (
          <a
            key={item.path}
            href={`#/${item.path}`}
            onClick={onGo}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition',
              active ? 'bg-brand-700 font-semibold text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <item.icon size={18} strokeWidth={1.9} aria-hidden className={active ? 'text-white' : 'text-slate-400'} />
            <span className="flex-1">{item.label}</span>
            {!!item.badge && (
              <span
                className={cx(
                  'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                  active ? 'bg-white text-brand-800' : 'bg-slate-200 text-slate-700',
                )}
              >
                {item.badge}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

/** Name and role of the signed-in person, e.g. "Drejtoria e Infrastrukturës · Drejtoria". */
function useIdentity(user: User) {
  const { units } = useApp();
  const unit = units.find((u) => u.id === user.unitId);
  const name = unit ? unit.name : getLang() === 'en' ? user.fullNameEn : user.fullName;
  const role = unit ? (unit.type === 'agjenci' ? t('role.agency') : t('role.DREJTORIA')) : t(`role.${user.role}`);
  const initials = name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return { name, role, initials };
}

function UserChip({ user }: { user: User }) {
  const { name, role, initials } = useIdentity(user);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white" aria-hidden>
        {initials}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">{role}</p>
      </div>
    </div>
  );
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
      <button
        onClick={onLogout}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <LogOut size={15} aria-hidden /> {t('user.logout')}
      </button>
      <LanguageSwitch />
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
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col gap-8 border-r border-slate-200 bg-white px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <Nav items={items} current={current} />
        <div className="mt-auto">
          <SidebarFooter onLogout={onLogout} />
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
            className="rounded-md border border-slate-300 p-2 text-slate-700"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="space-y-4 border-t border-slate-100 px-4 py-4">
            <UserChip user={user} />
            <Nav items={items} current={current} onGo={() => setMenuOpen(false)} />
            <SidebarFooter onLogout={onLogout} />
          </div>
        )}
      </div>

      <div className="min-w-0">
        {/* Desktop: today's date and who is signed in */}
        <header className="no-print sticky top-0 z-10 hidden h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-8 backdrop-blur lg:flex">
          <p className="inline-flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays size={16} className="text-slate-400" aria-hidden /> {formatLongDate()}
          </p>
          <UserChip user={user} />
        </header>
        <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
