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

function Brand({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-brand-900" aria-hidden>
        <Landmark size={20} />
      </span>
      <div className="leading-tight">
        <div className={cx('text-[15px] font-bold', dark ? 'text-white' : 'text-brand-900')}>{t('brand.title')}</div>
        <div className={cx('text-xs', dark ? 'text-brand-200' : 'text-slate-500')}>{t('brand.subtitle')}</div>
      </div>
    </div>
  );
}

function Nav({ items, current, onGo, dark }: { items: NavItem[]; current: string; onGo?: () => void; dark?: boolean }) {
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
              'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition',
              active
                ? dark
                  ? 'bg-white font-semibold text-brand-900 shadow-sm'
                  : 'bg-brand-50 font-semibold text-brand-900'
                : dark
                  ? 'text-brand-100 hover:bg-white/10 hover:text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
            )}
          >
            <item.icon
              size={18}
              strokeWidth={1.9}
              aria-hidden
              className={active ? 'text-gold-600' : dark ? 'text-brand-300' : 'text-slate-400'}
            />
            <span className="flex-1">{item.label}</span>
            {!!item.badge && (
              <span
                className={cx(
                  'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                  active || dark ? 'bg-gold-500 text-brand-900' : 'bg-slate-100 text-slate-600',
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
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700" aria-hidden>
        {initials}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
        <p className="text-xs text-slate-500">{role}</p>
      </div>
    </div>
  );
}

/** The signed-in person at the top of the sidebar: avatar with a gold ring, name, role. */
function Profile({ user }: { user: User }) {
  const { name, role, initials } = useIdentity(user);
  return (
    <div className="flex flex-col items-center text-center">
      <span className="rounded-full p-1 ring-2 ring-gold-500">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-xl font-semibold text-white" aria-hidden>
          {initials}
        </span>
      </span>
      <p className="mt-3 text-sm leading-snug font-semibold text-white">{name}</p>
      <p className="mt-0.5 text-xs font-medium tracking-wide text-gold-400 uppercase">{role}</p>
    </div>
  );
}

function SidebarFooter({ onLogout, dark }: { onLogout: () => void; dark?: boolean }) {
  return (
    <div className={cx('flex items-center justify-between gap-2 border-t pt-4', dark ? 'border-white/10' : 'border-slate-200')}>
      <button
        onClick={onLogout}
        className={cx(
          'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium',
          dark ? 'text-brand-100 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800',
        )}
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
    <div className="min-h-screen bg-page lg:grid lg:grid-cols-[280px_1fr]">
      {/* Desktop: a floating navy sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen p-4 pr-0 lg:block">
        <div className="flex h-full flex-col gap-7 overflow-y-auto rounded-3xl bg-brand-900 px-4 py-6 shadow-xl shadow-brand-900/20">
          <div className="px-2">
            <Brand dark />
          </div>
          <Profile user={user} />
          <Nav items={items} current={current} dark />
          <div className="mt-auto">
            <SidebarFooter onLogout={onLogout} dark />
          </div>
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
        <header className="no-print hidden items-center justify-end px-8 pt-6 lg:flex xl:px-10">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            <CalendarDays size={16} className="text-gold-600" aria-hidden /> {formatLongDate()}
          </p>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:pt-2 xl:px-10">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
