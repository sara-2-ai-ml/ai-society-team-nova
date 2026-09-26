import { Building2, FileBarChart, FilePlus2, FileSpreadsheet, Inbox, LayoutDashboard, List, MessageCircleQuestion } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { DATA_CHANGED } from './api/client';
import type { Stats, Unit, User } from './api/types';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { t } from './i18n';
import { Layout, type NavItem } from './components/Layout';
import { ErrorNote, Spinner } from './components/ui';
import { AppProvider } from './lib/AppContext';
import { useApi } from './lib/useApi';
import { useHashRoute } from './lib/useHashRoute';
import { AssistantPage } from './pages/AssistantPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/mayor/OverviewPage';
import { UnitsPage } from './pages/mayor/UnitsPage';
import { ImportPage } from './pages/operator/ImportPage';
import { RegisterPage } from './pages/operator/RegisterPage';
import { RegistryPage } from './pages/RegistryPage';
import { ReportPage } from './pages/ReportPage';
import { UnitDashboard } from './pages/UnitDashboard';
import { InboxPage } from './pages/unit/InboxPage';

interface RoleView {
  nav: NavItem[];
  home: string;
  render: (route: string[]) => ReactNode;
}

/** Each role gets its own menu and pages; the server enforces the same limits. */
function viewFor(user: User, stats: Stats | null): RoleView {
  const assistant: NavItem = { path: 'asistenti', label: t('nav.assistant'), icon: MessageCircleQuestion };
  const report: NavItem = { path: 'raporti', label: t('nav.report'), icon: FileBarChart };

  if (user.role === 'OPERATOR') {
    return {
      home: 'regjistro',
      nav: [
        { path: 'regjistro', label: t('nav.register'), icon: FilePlus2 },
        { path: 'excel', label: t('nav.excel'), icon: FileSpreadsheet },
        { path: 'regjistri', label: t('nav.registry'), icon: List, badge: stats?.returned },
        assistant,
      ],
      render: ([page, arg]) =>
        page === 'excel' ? <ImportPage /> : page === 'regjistri' ? <RegistryPage key={arg} initialStatus={arg} /> : page === 'asistenti' ? <AssistantPage /> : <RegisterPage />,
    };
  }

  if (user.role === 'DREJTORIA') {
    const unitId = user.unitId ?? '';
    return {
      home: 'paneli',
      nav: [
        { path: 'paneli', label: t('nav.dashboard'), icon: LayoutDashboard },
        { path: 'kerkesat', label: t('nav.inbox'), icon: Inbox, badge: stats?.new },
        report,
        assistant,
      ],
      render: ([page, arg]) =>
        page === 'kerkesat' ? (
          <InboxPage unitId={unitId} initialStatus={arg} />
        ) : page === 'raporti' ? (
          <ReportPage />
        ) : page === 'asistenti' ? (
          <AssistantPage />
        ) : (
          <UnitDashboard unitId={unitId} own />
        ),
    };
  }

  return {
    home: 'pasqyra',
    nav: [
      { path: 'pasqyra', label: t('nav.overview'), icon: LayoutDashboard },
      { path: 'drejtorite', label: t('nav.units'), icon: Building2 },
      { path: 'regjistri', label: t('nav.registry'), icon: List },
      report,
      assistant,
    ],
    render: ([page, arg]) =>
      page === 'drejtorite' ? (
        arg ? <UnitDashboard key={arg} unitId={arg} own={false} /> : <UnitsPage />
      ) : page === 'regjistri' ? (
        <RegistryPage key={arg} initialStatus={arg} />
      ) : page === 'raporti' ? (
        <ReportPage />
      ) : page === 'asistenti' ? (
        <AssistantPage />
      ) : (
        <OverviewPage />
      ),
  };
}

function Shell({ user }: { user: User }) {
  const { logout } = useAuth();
  const route = useHashRoute();
  const units = useApi<Unit[]>('/units');
  // Counts for the menu badges, refreshed whenever the page changes.
  const stats = useApi<Stats>('/requests/stats');
  const { reload } = stats;
  const routeKey = route.join('/');
  useEffect(() => reload(), [routeKey, reload]);
  useEffect(() => {
    window.addEventListener(DATA_CHANGED, reload);
    return () => window.removeEventListener(DATA_CHANGED, reload);
  }, [reload]);

  if (units.error) return <div className="p-8"><ErrorNote error={units.error} /></div>;
  if (!units.data) return <Spinner />;

  const view = viewFor(user, stats.data);
  const current = view.nav.some((n) => n.path === route[0]) ? route[0] : view.home;

  return (
    <AppProvider units={units.data}>
      <Layout user={user} items={view.nav} current={current} onLogout={logout}>
        {view.render(route[0] === current ? route : [current])}
      </Layout>
    </AppProvider>
  );
}

function Root() {
  const { user, checking } = useAuth();
  if (checking) return <Spinner label={t('common.checkingSession')} />;
  return user ? <Shell user={user} /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
