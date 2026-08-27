import { FormEvent, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  ChevronDown,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileDown,
  Globe2,
  Home,
  Link2,
  List,
  Lock,
  LogOut,
  MapPin,
  MoreVertical,
  Moon,
  Monitor,
  MousePointerClick,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShieldPlus,
  Star,
  Timer,
  Trash2,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Analytics, ShortURL, User, api, shortURLFor } from './api';

type AuthMode = 'login' | 'register';
type Page = 'overview' | 'links' | 'analytics' | 'account';
type LinkFilter = 'all' | 'active' | 'expired' | 'favorite';
type SortMode = 'newest' | 'clicks';
type Notice = { type: 'success' | 'error'; text: string } | null;

const storedToken = localStorage.getItem('links_token') ?? '';
const storedEmail = localStorage.getItem('links_email') ?? '';
const storedFavorites = JSON.parse(localStorage.getItem('linkpulse_favorites') ?? '[]') as string[];

export default function App() {
  const [token, setToken] = useState(storedToken);
  const [email, setEmail] = useState(storedEmail);
  const [user, setUser] = useState<User | null>(null);
  const [urls, setUrls] = useState<ShortURL[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [page, setPage] = useState<Page>('overview');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LinkFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(storedFavorites);
  const [darkMode, setDarkMode] = useState(false);

  const selectedURL = urls.find((item) => item.id === selectedId) ?? urls[0];
  const selectedURLId = selectedURL?.id;
  const summary = useMemo(() => buildSummary(urls, favoriteIds), [urls, favoriteIds]);
  const filteredURLs = useMemo(() => filterURLs(urls, query, filter, sortMode, favoriteIds), [urls, query, filter, sortMode, favoriteIds]);
  const recentURLs = useMemo(() => filterURLs(urls, '', 'all', 'newest', favoriteIds).slice(0, 5), [urls, favoriteIds]);

  const showError = useCallback((error: unknown) => {
    setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Something went wrong' });
  }, []);

  const refreshURLs = useCallback(async (authToken = token) => {
    setLoading(true);
    try {
      const data = await api.listURLs(authToken);
      setUrls(data ?? []);
      if (data?.length && !data.some((item) => item.id === selectedId)) {
        setSelectedId(data[0].id);
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [selectedId, showError, token]);

  const loadAnalytics = useCallback(async (authToken: string, id: string) => {
    try {
      setAnalytics(await api.analytics(authToken, id));
    } catch (error) {
      showError(error);
    }
  }, [showError]);

  const loadProfile = useCallback(async (authToken: string) => {
    try {
      const profile = await api.me(authToken);
      setUser(profile.user);
      setEmail(profile.user.email);
      localStorage.setItem('links_email', profile.user.email);
    } catch (error) {
      showError(error);
    }
  }, [showError]);

  useEffect(() => {
    if (!token) return;
    void refreshURLs(token);
    void loadProfile(token);
  }, [token, refreshURLs, loadProfile]);

  useEffect(() => {
    if (!token || !selectedURLId) {
      setAnalytics(null);
      return;
    }
    void loadAnalytics(token, selectedURLId);
  }, [token, selectedURLId, loadAnalytics]);

  function handleAuth(authToken: string, userEmail: string) {
    setToken(authToken);
    setEmail(userEmail);
    localStorage.setItem('links_token', authToken);
    localStorage.setItem('links_email', userEmail);
  }

  function logout() {
    setToken('');
    setEmail('');
    setUser(null);
    setUrls([]);
    setSelectedId('');
    setAnalytics(null);
    localStorage.removeItem('links_token');
    localStorage.removeItem('links_email');
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem('linkpulse_favorites', JSON.stringify(next));
      return next;
    });
  }

  async function deleteExpiredLinks() {
    const expired = urls.filter(isExpired);
    if (expired.length === 0) {
      setNotice({ type: 'success', text: 'No expired links to remove' });
      return;
    }
    try {
      await Promise.all(expired.map((item) => api.deleteURL(token, item.id)));
      setNotice({ type: 'success', text: `Removed ${expired.length} expired link${expired.length === 1 ? '' : 's'}` });
      await refreshURLs();
    } catch (error) {
      showError(error);
    }
  }

  function exportCSV() {
    const rows = [
      ['short_code', 'short_url', 'original_url', 'clicks', 'created_at', 'expires_at'],
      ...urls.map((item) => [
        item.short_code,
        shortURLFor(item.short_code),
        item.original_url,
        String(item.click_count),
        item.created_at,
        item.expires_at ?? '',
      ]),
    ];
    downloadFile('linkpulse-links.csv', rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }

  if (!token) {
    return <AuthScreen onAuth={handleAuth} notice={notice} setNotice={setNotice} />;
  }

  return (
    <main className={`app-shell ${darkMode ? 'dark-mode' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Link2 size={24} />
          </span>
          <div>
            <strong>LinkPulse</strong>
            <span>Smart short links</span>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Dashboard pages">
          <NavButton page="overview" activePage={page} onSelect={setPage} icon={<Home size={18} />} label="Overview" />
          <NavButton page="links" activePage={page} onSelect={setPage} icon={<Link2 size={18} />} label="Links" />
          <NavButton page="analytics" activePage={page} onSelect={setPage} icon={<BarChart3 size={18} />} label="Analytics" />
          <NavButton page="account" activePage={page} onSelect={setPage} icon={<UserRound size={18} />} label="Account" />
        </nav>

        <div className="account-box">
          <span>{email}</span>
          <button className="icon-button sidebar-action" type="button" onClick={logout} aria-label="Log out" title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <section className="workspace">
        <CommandBar
          loading={loading}
          query={query}
          email={email}
          darkMode={darkMode}
          onQuery={setQuery}
          onRefresh={() => refreshURLs()}
          onExport={exportCSV}
          onDeleteExpired={deleteExpiredLinks}
          onToggleTheme={() => setDarkMode((current) => !current)}
          canExport={urls.length > 0}
          canDeleteExpired={summary.expiredLinks > 0}
        />

        <PageHeader
          page={page}
          loading={loading}
          canExport={urls.length > 0}
          canDeleteExpired={summary.expiredLinks > 0}
          onRefresh={() => refreshURLs()}
          onExport={exportCSV}
          onDeleteExpired={deleteExpiredLinks}
        />

        {notice && (
          <div className={`notice ${notice.type}`} role="status">
            {notice.text}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {page === 'overview' && (
          <OverviewPage
            token={token}
            summary={summary}
            recentURLs={recentURLs}
            analytics={analytics}
            onCreated={async (message) => {
              setNotice({ type: 'success', text: message });
              await refreshURLs();
            }}
            onError={showError}
            onGoLinks={() => setPage('links')}
            onGoAnalytics={() => setPage('analytics')}
            favoriteIds={favoriteIds}
          />
        )}

        {page === 'links' && (
          <LinksPage
            token={token}
            urls={filteredURLs}
            selectedURL={selectedURL}
            query={query}
            filter={filter}
            sortMode={sortMode}
            onQuery={setQuery}
            onFilter={setFilter}
            onSort={setSortMode}
            onSelect={setSelectedId}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onCopied={() => setNotice({ type: 'success', text: 'Short URL copied' })}
            onDeleted={async () => {
              setNotice({ type: 'success', text: 'Short URL deleted' });
              await refreshURLs();
            }}
            onError={showError}
          />
        )}

        {page === 'analytics' && (
          <AnalyticsPage
            urls={urls}
            selectedURL={selectedURL}
            analytics={analytics}
            onSelect={setSelectedId}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onCopied={() => setNotice({ type: 'success', text: 'Short URL copied' })}
          />
        )}

        {page === 'account' && (
          <AccountPage
            token={token}
            email={email}
            user={user}
            onChanged={() => setNotice({ type: 'success', text: 'Password changed' })}
            onError={showError}
          />
        )}
      </section>
    </main>
  );
}

function NavButton({
  page,
  activePage,
  onSelect,
  icon,
  label,
}: {
  page: Page;
  activePage: Page;
  onSelect: (page: Page) => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button className={`nav-item ${activePage === page ? 'active' : ''}`} type="button" onClick={() => onSelect(page)}>
      {icon}
      {label}
    </button>
  );
}

function CommandBar({
  loading,
  query,
  email,
  darkMode,
  canExport,
  canDeleteExpired,
  onQuery,
  onRefresh,
  onExport,
  onDeleteExpired,
  onToggleTheme,
}: {
  loading: boolean;
  query: string;
  email: string;
  darkMode: boolean;
  canExport: boolean;
  canDeleteExpired: boolean;
  onQuery: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  onDeleteExpired: () => void;
  onToggleTheme: () => void;
}) {
  return (
    <header className="command-bar">
      <label className="global-search" aria-label="Search links">
        <Search size={21} />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search links, aliases or destinations..."
        />
      </label>

      <div className="command-actions">
        <button className="ghost-button" type="button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} />
          Refresh
        </button>
        <button className="ghost-button" type="button" onClick={onExport} disabled={!canExport}>
          <FileDown size={18} />
          Export
        </button>
        <button className="ghost-button danger-lite" type="button" onClick={onDeleteExpired} disabled={!canDeleteExpired}>
          <Trash2 size={18} />
          Clear expired
        </button>
        <button
          className="icon-button theme-toggle"
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          title={darkMode ? 'Use light theme' : 'Use dark theme'}
        >
          <Moon size={19} />
        </button>
        <div className="user-chip" title={email}>
          <span className="avatar">{avatarInitial(email)}</span>
          <strong>{emailName(email)}</strong>
          <ChevronDown size={17} />
        </div>
      </div>
    </header>
  );
}

function PageHeader({
  page,
  loading,
  canExport,
  canDeleteExpired,
  onRefresh,
  onExport,
  onDeleteExpired,
}: {
  page: Page;
  loading: boolean;
  canExport: boolean;
  canDeleteExpired: boolean;
  onRefresh: () => void;
  onExport: () => void;
  onDeleteExpired: () => void;
}) {
  const titles = {
    overview: ['Overview', 'Command center for your short-link performance.'],
    links: ['Links', 'Create, search, filter, and maintain every destination.'],
    analytics: ['Analytics', 'Inspect clicks, visitors, devices, browsers, and referrers.'],
    account: ['Account', 'Manage your profile and authentication settings.'],
  };
  const [title, subtitle] = titles[page];
  const icons = {
    overview: <Link2 size={48} />,
    links: <Link2 size={48} />,
    analytics: <BarChart3 size={50} />,
    account: <UserRound size={50} />,
  };

  return (
    <header className={`page-header page-header-${page}`}>
      <div>
        <p className="eyebrow">LinkPulse dashboard</p>
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>
      {page === 'links' ? (
        <div className="page-header-actions">
          <button className="ghost-button" type="button" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={18} />
            Refresh
          </button>
          <button className="ghost-button" type="button" onClick={onExport} disabled={!canExport}>
            <FileDown size={18} />
            Export
          </button>
          <button className="ghost-button danger-lite" type="button" onClick={onDeleteExpired} disabled={!canDeleteExpired}>
            <Trash2 size={18} />
            Clear expired
          </button>
        </div>
      ) : page === 'analytics' ? (
        <div className="analytics-header-art" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <div className="page-header-art" aria-hidden="true">
          {icons[page]}
        </div>
      )}
    </header>
  );
}

function OverviewPage({
  token,
  summary,
  recentURLs,
  analytics,
  onCreated,
  onError,
  onGoLinks,
  onGoAnalytics,
  favoriteIds,
}: {
  token: string;
  summary: ReturnType<typeof buildSummary>;
  recentURLs: ShortURL[];
  analytics: Analytics | null;
  onCreated: (message: string) => void;
  onError: (error: unknown) => void;
  onGoLinks: () => void;
  onGoAnalytics: () => void;
  favoriteIds: string[];
}) {
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Campaign-ready links</p>
          <h2>Shorten once. Measure every visitor signal after that.</h2>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => document.getElementById('create-link')?.scrollIntoView()}>
              <Plus size={18} />
              New link
            </button>
            <button className="soft-button" type="button" onClick={onGoAnalytics}>
              <BarChart3 size={18} />
              View analytics
            </button>
          </div>
        </div>
        <HeroArt />
      </section>

      <section className="metric-grid" aria-label="Link summary">
        <MetricCard tone="blue" icon={<Link2 size={20} />} label="Total links" value={summary.totalLinks} growth={summary.totalLinks ? '+100%' : '0%'} />
        <MetricCard tone="green" icon={<MousePointerClick size={20} />} label="Total clicks" value={summary.totalClicks} growth={summary.totalClicks ? '+200%' : '0%'} />
        <MetricCard tone="amber" icon={<TrendingUp size={20} />} label="Top link clicks" value={summary.topClicks} growth={summary.topClicks ? '+200%' : '0%'} />
        <MetricCard tone="rose" icon={<Star size={20} />} label="Favorites" value={summary.favoriteLinks} growth={summary.favoriteLinks ? '+100%' : '0%'} />
      </section>

      <CreateURLForm token={token} onCreated={onCreated} onError={onError} />

      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h2>Your latest created links</h2>
            </div>
            <button className="ghost-button compact" type="button" onClick={onGoLinks}>
              <RefreshCw size={16} />
              Open all
            </button>
          </div>
          <div className="compact-list">
            {recentURLs.length ? (
              recentURLs.map((item) => <CompactLink key={item.id} item={item} favorite={favoriteIds.includes(item.id)} />)
            ) : (
              <EmptyState />
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading vibrant">
            <div>
              <p className="eyebrow">Analytics snapshot</p>
              <h2>Last 30 days</h2>
            </div>
            <select aria-label="Analytics range" defaultValue="30">
              <option value="30">Last 30 days</option>
              <option value="7">Last 7 days</option>
            </select>
          </div>
          <div className="stats-grid">
            <Stat label="Clicks" value={analytics?.total_clicks ?? 0} tone="teal" icon={<Users size={22} />} />
            <Stat label="Visitors" value={analytics?.unique_visitors ?? 0} tone="amber" icon={<UserRound size={22} />} />
          </div>
          <MiniTimeline data={analytics?.clicks_by_day ?? []} />
        </section>
      </div>
    </div>
  );
}

function LinksPage({
  token,
  urls,
  selectedURL,
  query,
  filter,
  sortMode,
  onQuery,
  onFilter,
  onSort,
  onSelect,
  favoriteIds,
  onToggleFavorite,
  onCopied,
  onDeleted,
  onError,
}: {
  token: string;
  urls: ShortURL[];
  selectedURL?: ShortURL;
  query: string;
  filter: LinkFilter;
  sortMode: SortMode;
  onQuery: (query: string) => void;
  onFilter: (filter: LinkFilter) => void;
  onSort: (sortMode: SortMode) => void;
  onSelect: (id: string) => void;
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
  onCopied: () => void;
  onDeleted: () => void;
  onError: (error: unknown) => void;
}) {
  return (
    <div className="split-page">
      <section className="panel link-library">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Link library</p>
            <h2>{urls.length} showing</h2>
          </div>
          <label className="search-box">
            <Search size={17} />
            <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search links" />
          </label>
        </div>
        <div className="toolbar-row">
          <div className="segmented small">
            <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => onFilter('all')}>
              <List size={17} />
              All
            </button>
            <button className={filter === 'active' ? 'active' : ''} type="button" onClick={() => onFilter('active')}>
              <Check size={15} />
              Active
            </button>
            <button className={filter === 'expired' ? 'active' : ''} type="button" onClick={() => onFilter('expired')}>
              <Timer size={15} />
              Expired
            </button>
            <button className={filter === 'favorite' ? 'active' : ''} type="button" onClick={() => onFilter('favorite')}>
              <Star size={15} />
              Saved
            </button>
          </div>
          <select value={sortMode} onChange={(event) => onSort(event.target.value as SortMode)} aria-label="Sort links">
            <option value="newest">Newest first</option>
            <option value="clicks">Most clicks</option>
          </select>
        </div>
        <div className="url-list">
          {urls.length ? (
            urls.map((item) => (
              <URLRow
                key={item.id}
                item={item}
                selected={selectedURL?.id === item.id}
                token={token}
                onSelect={() => onSelect(item.id)}
                favorite={favoriteIds.includes(item.id)}
                onToggleFavorite={() => onToggleFavorite(item.id)}
                onCopied={onCopied}
                onDeleted={onDeleted}
                onError={onError}
              />
            ))
          ) : (
            <EmptyState />
          )}
        </div>
      </section>

      <SelectedLinkPanel
        selectedURL={selectedURL}
        favorite={selectedURL ? favoriteIds.includes(selectedURL.id) : false}
        onToggleFavorite={selectedURL ? () => onToggleFavorite(selectedURL.id) : undefined}
        onCopied={onCopied}
      />
    </div>
  );
}

function AnalyticsPage({
  urls,
  selectedURL,
  analytics,
  onSelect,
  favoriteIds,
  onToggleFavorite,
  onCopied,
}: {
  urls: ShortURL[];
  selectedURL?: ShortURL;
  analytics: Analytics | null;
  onSelect: (id: string) => void;
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
  onCopied: () => void;
}) {
  const [analyticsQuery, setAnalyticsQuery] = useState('');
  const visibleURLs = urls.filter((item) => {
    const needle = analyticsQuery.toLowerCase().trim();
    if (!needle) return true;
    return item.short_code.toLowerCase().includes(needle) || item.original_url.toLowerCase().includes(needle);
  });

  return (
    <div className="analytics-page">
      <section className="panel analytics-selector">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Analyze</p>
            <h2>Select link</h2>
          </div>
        </div>
        <label className="analytics-search">
          <Search size={18} />
          <input value={analyticsQuery} onChange={(event) => setAnalyticsQuery(event.target.value)} placeholder="Search your links..." />
        </label>
        <div className="mini-link-list">
          {visibleURLs.length ? (
            visibleURLs.map((item) => (
              <button className={selectedURL?.id === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => onSelect(item.id)}>
                <span className={favoriteIds.includes(item.id) ? 'favorite-dot' : ''}>{item.short_code}</span>
                <em>{item.original_url}</em>
                <strong>{item.click_count} clicks</strong>
              </button>
            ))
          ) : (
            <EmptyState />
          )}
        </div>
      </section>

      <section className="analytics-main">
        <AnalyticsPanel analytics={analytics} selectedURL={selectedURL} />
        <SelectedLinkPanel
          selectedURL={selectedURL}
          favorite={selectedURL ? favoriteIds.includes(selectedURL.id) : false}
          onToggleFavorite={selectedURL ? () => onToggleFavorite(selectedURL.id) : undefined}
          onCopied={onCopied}
        />
      </section>
    </div>
  );
}

function AccountPage({
  token,
  email,
  user,
  onChanged,
  onError,
}: {
  token: string;
  email: string;
  user: User | null;
  onChanged: () => void;
  onError: (error: unknown) => void;
}) {
  return (
    <div className="account-page">
      <section className="account-hero panel">
        <div>
          <p className="eyebrow">Security profile</p>
          <h2>{email}</h2>
        </div>
        <ShieldCheck size={54} />
      </section>
      <AccountPanel token={token} email={email} user={user} onChanged={onChanged} onError={onError} />
    </div>
  );
}

function AuthScreen({
  onAuth,
  notice,
  setNotice,
}: {
  onAuth: (token: string, email: string) => void;
  notice: Notice;
  setNotice: (notice: Notice) => void;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = mode === 'login' ? await api.login(email, password) : await api.register(email, password);
      onAuth(result.token, result.user.email);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Authentication failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-visual" aria-hidden="true">
        <div className="auth-copy">
          <span>LinkPulse</span>
          <strong>Modern link analytics built for campaigns.</strong>
        </div>
        <div className="preview-window">
          <div className="preview-top">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-chart">
            <i style={{ height: '42%' }} />
            <i style={{ height: '76%' }} />
            <i style={{ height: '54%' }} />
            <i style={{ height: '92%' }} />
            <i style={{ height: '68%' }} />
          </div>
          <div className="preview-row">
            <span />
            <strong />
          </div>
          <div className="preview-row short">
            <span />
            <strong />
          </div>
        </div>
        <div className="metric-tile">
          <MousePointerClick size={20} />
          <strong>12.4k</strong>
          <span>tracked clicks</span>
        </div>
        <div className="metric-tile secondary">
          <ShieldCheck size={20} />
          <strong>98%</strong>
          <span>cache-ready redirects</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="brand compact">
          <span className="brand-mark">
            <Link2 size={22} />
          </span>
          <div>
            <strong>LinkPulse</strong>
            <span>Analytics URL shortener</span>
          </div>
        </div>

        {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

        <div className="segmented">
          <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => setMode('login')}>
            <Lock size={16} />
            Login
          </button>
          <button className={mode === 'register' ? 'active' : ''} type="button" onClick={() => setMode('register')}>
            <UserPlus size={16} />
            Register
          </button>
        </div>

        <form onSubmit={submit} className="stack-form">
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={8}
              required
            />
          </label>
          <button className="primary-button full" disabled={loading} type="submit">
            {mode === 'login' ? <Lock size={18} /> : <UserPlus size={18} />}
            {loading ? 'Working...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
      </section>
    </main>
  );
}

function CreateURLForm({
  token,
  onCreated,
  onError,
}: {
  token: string;
  onCreated: (message: string) => void;
  onError: (error: unknown) => void;
}) {
  const [originalURL, setOriginalURL] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = {
        original_url: originalURL,
        ...(customAlias ? { custom_alias: customAlias } : {}),
        ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}),
      };
      const created = await api.createURL(token, payload);
      setOriginalURL('');
      setCustomAlias('');
      setExpiresAt('');
      onCreated(`Created ${created.short_url}`);
    } catch (error) {
      onError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="create-panel" id="create-link" onSubmit={submit}>
      <div className="create-topline">
        <div className="create-heading">
          <span>
            <Link2 size={22} />
          </span>
          <div>
            <h2>Create short link</h2>
            <p>Turn your long URL into a clean, trackable link.</p>
          </div>
        </div>
        <button className="ghost-button compact create-options" type="button">
          <Settings size={16} />
          Advanced options
        </button>
      </div>
      <label className="wide-field">
        Destination URL
        <input
          value={originalURL}
          onChange={(event) => setOriginalURL(event.target.value)}
          placeholder="https://example.com/products/12345"
          type="url"
          required
        />
      </label>
      <label>
        Custom alias
        <input value={customAlias} onChange={(event) => setCustomAlias(event.target.value)} placeholder="launch-offer" />
      </label>
      <label>
        Expiry
        <input value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" />
      </label>
      <button className="primary-button" type="submit" disabled={loading}>
        <Plus size={18} />
        {loading ? 'Creating' : 'Create link'}
      </button>
    </form>
  );
}

function URLRow({
  item,
  selected,
  token,
  onSelect,
  favorite,
  onToggleFavorite,
  onCopied,
  onDeleted,
  onError,
}: {
  item: ShortURL;
  selected: boolean;
  token: string;
  onSelect: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  onCopied: () => void;
  onDeleted: () => void;
  onError: (error: unknown) => void;
}) {
  const shortURL = shortURLFor(item.short_code);
  const expired = isExpired(item);

  async function copy(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    await navigator.clipboard.writeText(shortURL);
    onCopied();
  }

  async function remove(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    try {
      await api.deleteURL(token, item.id);
      onDeleted();
    } catch (error) {
      onError(error);
    }
  }

  return (
    <article className={`url-row ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="url-main">
        <button className="link-title" type="button" onClick={onSelect}>
          {item.short_code}
        </button>
        <span>{item.original_url}</span>
      </div>
      <div className="row-metrics">
        <span className="click-chip">
          <MousePointerClick size={15} />
          {item.click_count}
        </span>
        <span>
          <CalendarClock size={15} />
          {formatDate(item.created_at)}
        </span>
        <span className={expired ? 'expired-chip' : 'active-chip'}>{expired ? 'Expired' : 'Active'}</span>
      </div>
      <div className="row-actions">
        <button
          className={`icon-button ${favorite ? 'favorite' : ''}`}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          aria-label="Toggle favorite"
          title="Toggle favorite"
        >
          <Star size={17} />
        </button>
        <button className="icon-button" type="button" onClick={copy} aria-label="Copy short URL" title="Copy short URL">
          <Copy size={17} />
        </button>
        <a
          className="icon-button"
          href={shortURL}
          target="_blank"
          rel="noreferrer"
          aria-label="Open short URL"
          title="Open short URL"
          onClick={(event) => event.stopPropagation()}
        >
          <ExternalLink size={17} />
        </a>
        <button className="icon-button danger" type="button" onClick={remove} aria-label="Delete short URL" title="Delete short URL">
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  );
}

function CompactLink({ item, favorite }: { item: ShortURL; favorite: boolean }) {
  return (
    <div className="compact-link">
      <span className={isExpired(item) ? 'dot expired' : favorite ? 'dot favorite' : 'dot'} />
      <div>
        <strong>{item.short_code}</strong>
        <span>{item.original_url}</span>
      </div>
      <time>{relativeTime(item.created_at)}</time>
      <em>{item.click_count} clicks</em>
      <button className="icon-button compact-menu" type="button" aria-label={`More actions for ${item.short_code}`}>
        <MoreVertical size={18} />
      </button>
    </div>
  );
}

function AccountPanel({
  token,
  email,
  user,
  onChanged,
  onError,
}: {
  token: string;
  email: string;
  user: User | null;
  onChanged: () => void;
  onError: (error: unknown) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      onError(new Error('New passwords do not match'));
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(token, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onChanged();
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel account-panel">
      <div className="panel-heading vibrant">
        <div>
          <p className="eyebrow">Account</p>
          <h2>{email}</h2>
        </div>
        <ShieldPlus size={22} />
      </div>
      <div className="account-meta">
        <div>
          <span>User ID</span>
          <strong>{user?.id ?? 'Loading'}</strong>
        </div>
        <div>
          <span>Joined</span>
          <strong>{user?.created_at ? formatFullDate(user.created_at) : 'Loading'}</strong>
        </div>
      </div>
      <form className="security-form" onSubmit={submit}>
        <label>
          Current password
          <span className="input-shell">
            <Lock size={18} />
            <input
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type={showCurrent ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter current password"
              required
            />
            <button type="button" onClick={() => setShowCurrent((current) => !current)} aria-label="Toggle current password visibility">
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <label>
          New password
          <span className="input-shell">
            <Lock size={18} />
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type={showNew ? 'text' : 'password'}
              minLength={8}
              autoComplete="new-password"
              placeholder="Enter new password"
              required
            />
            <button type="button" onClick={() => setShowNew((current) => !current)} aria-label="Toggle new password visibility">
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <label>
          Confirm new password
          <span className="input-shell">
            <Lock size={18} />
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type={showConfirm ? 'text' : 'password'}
              minLength={8}
              autoComplete="new-password"
              placeholder="Confirm new password"
              required
            />
            <button type="button" onClick={() => setShowConfirm((current) => !current)} aria-label="Toggle confirm password visibility">
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <button className="primary-button full" type="submit" disabled={saving}>
          <ShieldPlus size={17} />
          {saving ? 'Saving' : 'Change password'}
        </button>
      </form>
    </section>
  );
}

function SelectedLinkPanel({
  selectedURL,
  favorite = false,
  onToggleFavorite,
  onCopied,
}: {
  selectedURL?: ShortURL;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onCopied: () => void;
}) {
  if (!selectedURL) {
    return (
      <section className="panel detail-panel">
        <EmptyState />
      </section>
    );
  }

  const link = selectedURL;
  const shortURL = shortURLFor(link.short_code);

  async function copy() {
    await navigator.clipboard.writeText(shortURL);
    onCopied();
  }

  function downloadQR() {
    const svg = document.getElementById('selected-link-qr');
    if (!svg) return;
    downloadFile(`${link.short_code}-qr.svg`, new XMLSerializer().serializeToString(svg), 'image/svg+xml;charset=utf-8');
  }

  return (
    <section className="panel detail-panel">
      <div className="panel-heading vibrant">
        <div>
          <p className="eyebrow">Selected link</p>
          <h2>{link.short_code}</h2>
        </div>
        <QrCode size={22} />
      </div>
      <div className="qr-wrap">
        <QRCodeSVG id="selected-link-qr" value={shortURL} size={148} marginSize={2} level="M" />
      </div>
      <div className="detail-list">
        <div>
          <span>Short URL</span>
          <strong>{shortURL}</strong>
        </div>
        <div>
          <span>Destination</span>
          <strong>{link.original_url}</strong>
        </div>
        <div>
          <span>Expires</span>
          <strong>{link.expires_at ? formatFullDate(link.expires_at) : 'Never'}</strong>
        </div>
      </div>
      <div className="detail-actions">
        {onToggleFavorite && (
          <button className={`ghost-button ${favorite ? 'favorite' : ''}`} type="button" onClick={onToggleFavorite}>
            <Star size={17} />
            {favorite ? 'Saved' : 'Save'}
          </button>
        )}
        <button className="ghost-button" type="button" onClick={copy}>
          <Copy size={17} />
          Copy
        </button>
        <button className="ghost-button" type="button" onClick={downloadQR}>
          <Download size={17} />
          QR
        </button>
      </div>
    </section>
  );
}

function AnalyticsPanel({ analytics, selectedURL }: { analytics: Analytics | null; selectedURL?: ShortURL }) {
  return (
    <section className="panel analytics-panel">
      <div className="panel-heading vibrant">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2>{selectedURL ? selectedURL.short_code : 'No link selected'}</h2>
        </div>
        <BarChart3 size={22} />
      </div>
      <div className="stats-grid">
        <Stat label="Total clicks" value={analytics?.total_clicks ?? 0} tone="teal" icon={<MousePointerClick size={22} />} />
        <Stat label="Unique visitors" value={analytics?.unique_visitors ?? 0} tone="amber" icon={<UserRound size={22} />} />
      </div>
      <MiniTimeline data={analytics?.clicks_by_day ?? []} />
      <AnalyticsCategoryRows
        rows={[
          { title: 'Devices', icon: <Monitor size={25} />, data: analytics?.devices ?? [] },
          { title: 'Browsers', icon: <Globe2 size={25} />, data: analytics?.browsers ?? [] },
          { title: 'Countries', icon: <MapPin size={25} />, data: analytics?.countries ?? [] },
          { title: 'Operating systems', icon: <Settings size={25} />, data: analytics?.operating_systems ?? [] },
          { title: 'Referrers', icon: <Link2 size={25} />, data: analytics?.referrers ?? [] },
        ]}
      />
    </section>
  );
}

function AnalyticsCategoryRows({
  rows,
}: {
  rows: { title: string; icon: ReactNode; data: { label: string; count: number }[] }[];
}) {
  return (
    <div className="analytics-breakdown">
      {rows.map((row) => {
        const total = row.data.reduce((sum, item) => sum + item.count, 0);
        const top = row.data.find((item) => item.label);
        return (
          <button className="analytics-breakdown-row" key={row.title} type="button">
            <span className="breakdown-icon">{row.icon}</span>
            <span>
              <strong>{row.title}</strong>
              <em>{total ? `${top?.label ?? 'Unknown'} · ${total} click${total === 1 ? '' : 's'}` : 'No clicks yet'}</em>
            </span>
            <ChevronRight size={22} />
          </button>
        );
      })}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
  growth,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'amber' | 'rose';
  growth: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <div className="metric-value">
          <strong>{value.toLocaleString()}</strong>
          <b>{growth}</b>
        </div>
      </div>
      <MiniSparkline data={[1, 3, 2, 5, 6, 9, 10, 13]} />
    </article>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: number; tone: 'teal' | 'amber'; icon?: ReactNode }) {
  return (
    <div className={`stat ${tone}`}>
      <span>
        {label}
        {icon}
      </span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-link-tile">
        <Link2 size={70} />
      </div>
      <div className="hero-feature-chip chip-shorter">
        <Zap size={22} />
        <span>Shorter</span>
      </div>
      <div className="hero-feature-chip chip-smarter">
        <BarChart3 size={22} />
        <span>Smarter</span>
      </div>
      <div className="hero-feature-chip chip-stronger">
        <ShieldCheck size={22} />
        <span>Stronger</span>
      </div>
    </div>
  );
}

function MiniTimeline({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  const rows = data.length ? data : Array.from({ length: 14 }, (_, index) => ({ date: String(index), count: 0 }));

  return (
    <div className="timeline">
      <div className="mini-heading">
        <span>Clicks over time</span>
        <span>30 days</span>
      </div>
      <div className="timeline-bars">
        {rows.map((item) => (
          <span key={item.date} style={{ height: `${Math.max(8, (item.count / max) * 100)}%` }} title={`${item.date}: ${item.count}`} />
        ))}
      </div>
    </div>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  const values = data.length ? data.slice(0, 18) : [2, 8, 4, 12, 6, 14, 10, 16];
  const max = Math.max(1, ...values);

  return (
    <div className="sparkline" aria-hidden="true">
      {values.map((value, index) => (
        <i key={`${value}-${index}`} style={{ height: `${Math.max(18, (value / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function GroupedBars({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  const rows = data.filter((item) => item.label);
  const max = Math.max(1, ...rows.map((item) => item.count));

  return (
    <div className="bar-group">
      <div className="mini-heading">
        <span>{title}</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty-copy">No clicks yet</p>
      ) : (
        rows.slice(0, 5).map((item) => (
          <div className="bar-row" key={`${title}-${item.label}`}>
            <span>{item.label || 'unknown'}</span>
            <div>
              <i style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
            <strong>{item.count}</strong>
          </div>
        ))
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <Globe2 size={30} />
      <strong>No links yet</strong>
      <span>Create a short URL to start collecting click analytics.</span>
    </div>
  );
}

function filterURLs(urls: ShortURL[], query: string, filter: LinkFilter, sortMode: SortMode, favoriteIds: string[] = []) {
  const needle = query.toLowerCase().trim();
  return [...urls]
    .filter((item) => {
      if (filter === 'active') return !isExpired(item);
      if (filter === 'expired') return isExpired(item);
      if (filter === 'favorite') return favoriteIds.includes(item.id);
      return true;
    })
    .filter((item) => {
      if (!needle) return true;
      return (
        item.original_url.toLowerCase().includes(needle) ||
        item.short_code.toLowerCase().includes(needle) ||
        item.custom_alias?.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => {
      if (sortMode === 'clicks') return b.click_count - a.click_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

function buildSummary(urls: ShortURL[], favoriteIds: string[]) {
  const expiredLinks = urls.filter(isExpired).length;
  return {
    totalLinks: urls.length,
    totalClicks: urls.reduce((sum, item) => sum + item.click_count, 0),
    topClicks: Math.max(0, ...urls.map((item) => item.click_count)),
    expiredLinks,
    activeLinks: urls.length - expiredLinks,
    favoriteLinks: urls.filter((item) => favoriteIds.includes(item.id)).length,
  };
}

function isExpired(item: ShortURL) {
  return Boolean(item.expires_at && new Date(item.expires_at).getTime() < Date.now());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function emailName(email: string) {
  return email.split('@')[0] || 'User';
}

function avatarInitial(email: string) {
  return (emailName(email).charAt(0) || 'U').toUpperCase();
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
