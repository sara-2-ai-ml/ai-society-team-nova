import { Building2, Landmark, LogIn, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { DemoAccount } from '../api/types';
import skyline from '../assets/skyline.png';
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

  const pick = (a: DemoAccount) => {
    setUsername(a.username);
    document.getElementById('login-password')?.focus();
  };
  const nameOf = (a: DemoAccount) => (getLang() === 'en' ? a.fullNameEn : a.fullName);
  // Under a "Drejtoritë"/"Agjencitë" label the prefix is implied: "Shërbimeve Sociale", "Social Services".
  const shortOf = (a: DemoAccount) =>
    a.unitId ? nameOf(a).replace(/^(Drejtoria|Agjencia) e /, '').replace(/ (Department|Agency)$/, '') : nameOf(a);
  const isAgency = (a: DemoAccount) => a.username.startsWith('agjencia.');

  const chip = (a: DemoAccount) => (
    <button
      key={a.username}
      type="button"
      onClick={() => pick(a)}
      title={nameOf(a)}
      className={cx(
        'truncate rounded-xl px-3 py-2 text-left text-[13px] transition',
        username === a.username
          ? 'bg-brand-900 font-medium text-white'
          : 'bg-slate-100 text-slate-700 hover:bg-gold-100 hover:text-brand-900',
      )}
    >
      {shortOf(a)}
    </button>
  );

  // One screen, no scrolling: the story on the navy side, the form in a card on the right.
  return (
    <div className="grid min-h-screen bg-page lg:h-screen lg:grid-cols-[1.1fr_1fr] lg:overflow-hidden">
      <section className="relative hidden flex-col overflow-hidden bg-brand-900 px-12 pt-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500 text-brand-900">
            <Landmark size={22} aria-hidden />
          </span>
        </div>

        <div className="mt-auto">
          <h1 className="leading-[0.95] font-extrabold tracking-tighter">
            <span className="block text-[64px] text-white xl:text-[76px]">Bashkia</span>
            <span className="block bg-gradient-to-r from-gold-300 via-gold-500 to-gold-600 bg-clip-text text-[104px] text-transparent xl:text-[128px]">
              360°
            </span>
          </h1>
          <p className="mt-6 max-w-md text-xl font-light tracking-wide text-brand-100 italic">“{t('login.headline')}”</p>
        </div>

        <img src={skyline} alt="" aria-hidden className="pointer-events-none mt-auto w-full max-w-2xl self-center pt-8 opacity-80 select-none" />
      </section>

      <section className="relative flex items-center justify-center px-4 py-10 sm:px-8 lg:py-6">
        <LanguageSwitch className="absolute top-5 right-5" />
        <div className="w-full max-w-[440px] rounded-3xl bg-white p-7 shadow-[0_8px_30px_rgba(20,33,61,0.08)] sm:p-8">
          <h2 className="text-2xl font-bold text-brand-900">{t('login.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('login.subtitle')}</p>

          <form onSubmit={submit} className="mt-6 space-y-3.5">
            <Field label={t('login.username')}>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
            </Field>
            <Field label={t('login.password')}>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            {error && <ErrorNote error={error} />}
            <Button type="submit" icon={LogIn} loading={busy} className="!mt-5 h-11 w-full">
              {t('login.submit')}
            </Button>
          </form>

          {accounts.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{t('login.demo')}</p>
              <div className="grid grid-cols-2 gap-2">
                {GROUPS.slice(0, 2).flatMap((g) => accounts.filter(g.match)).map(chip)}
              </div>
              {[
                { label: t('units.departments'), list: accounts.filter((a) => GROUPS[2].match(a) && !isAgency(a)) },
                { label: t('units.agencies'), list: accounts.filter((a) => GROUPS[2].match(a) && isAgency(a)) },
              ].map((g) => (
                <div key={g.label}>
                  <p className="mt-3 mb-2 flex items-center gap-1.5 text-xs text-slate-400">
                    <Building2 size={13} aria-hidden /> {g.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2">{g.list.map(chip)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
