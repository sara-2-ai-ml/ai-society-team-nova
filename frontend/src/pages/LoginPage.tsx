import { Building2, Landmark, LogIn, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { DemoAccount } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Button, ErrorNote, Field, Input, cx } from '../components/ui';
import { LanguageSwitch, getLang, t, type Key } from '../i18n';

const GROUPS: { title: Key; icon: typeof UserRound; match: (a: DemoAccount) => boolean }[] = [
  { title: 'login.groupMayor', icon: Landmark, match: (a) => a.role === 'KRYETARI' },
  { title: 'login.groupOperator', icon: UserRound, match: (a) => a.role === 'OPERATOR' },
  { title: 'login.groupUnits', icon: Building2, match: (a) => a.role === 'DREJTORIA' },
];

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);

  useEffect(() => {
    api<DemoAccount[]>('/auth/demo-accounts').then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
            <Landmark size={22} aria-hidden />
          </span>
          <span className="text-lg font-semibold">{t('brand.title')}</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">{t('login.headline')}</h1>
          <ol className="mt-8 space-y-4 text-brand-100">
            {(['s1', 's2', 's3'] as const).map((s) => (
              <li key={s}>
                <strong className="text-white">{t(`login.${s}.who`)}</strong> {t(`login.${s}.text`)}
              </li>
            ))}
          </ol>
        </div>
        <span />
      </section>

      <section className="relative flex items-center justify-center px-4 py-12 sm:px-8">
        <LanguageSwitch className="absolute top-4 right-4" />
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-semibold text-slate-900">{t('login.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('login.subtitle')}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label={t('login.username')}>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
            </Field>
            <Field label={t('login.password')}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            {error && <ErrorNote error={error} />}
            <Button type="submit" icon={LogIn} loading={busy} className="w-full">
              {t('login.submit')}
            </Button>
          </form>

          {accounts.length > 0 && (
            <div className="mt-10 border-t border-slate-200 pt-6">
              <p className="mb-4 text-sm font-medium text-slate-700">{t('login.demo')}</p>
              <div className="space-y-4">
                {GROUPS.map((g) => {
                  const list = accounts.filter(g.match);
                  if (!list.length) return null;
                  return (
                    <div key={g.title}>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                        <g.icon size={14} aria-hidden /> {t(g.title)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {list.map((a) => (
                          <button
                            key={a.username}
                            type="button"
                            onClick={() => setUsername(a.username)}
                            title={getLang() === 'en' ? a.fullNameEn : a.fullName}
                            className={cx(
                              'rounded-lg border px-3 py-1.5 text-sm transition',
                              username === a.username
                                ? 'border-brand-500 bg-brand-50 font-medium text-brand-800'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                            )}
                          >
                            {getLang() === 'en' ? a.fullNameEn : a.fullName}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
