import { FormEvent, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
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
  Mail,
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
  Target,
  Timer,
  Trash2,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Analytics, ShortURL, User, api, shortURLFor } from './api';
import linkPulseLogo from './assets/link-pulse-logo.png';

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
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

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
    setShowLogoutDialog(false);
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
            <img src={linkPulseLogo} alt="" />
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
          <button className="icon-button sidebar-action" type="button" onClick={() => setShowLogoutDialog(true)} aria-label="Log out" title="Log out">
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
          onProfile={() => setPage('account')}
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
            onLogout={() => setShowLogoutDialog(true)}
            onChanged={() => setNotice({ type: 'success', text: 'Password changed' })}
            onError={showError}
          />
        )}

        {showLogoutDialog && <LogoutDialog email={email} onCancel={() => setShowLogoutDialog(false)} onConfirm={logout} />}
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
  onProfile,
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
  onProfile: () => void;
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
        <button className="user-chip" type="button" title="Open profile" onClick={onProfile}>
          <span className="avatar">{avatarInitial(email)}</span>
          <strong>{emailName(email)}</strong>
          <ChevronDown size={17} />
        </button>
      </div>
    </header>
  );
}

function ConfirmDialog({
  eyebrow,
  title,
  message,
  confirmLabel,
  icon,
  onCancel,
  onConfirm,
}: {
  eyebrow: string;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  icon: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button dialog-close" type="button" onClick={onCancel} aria-label="Close confirmation dialog">
          <X size={18} />
        </button>
        <span className="confirm-dialog-icon">{icon}</span>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="confirm-title">{title}</h2>
        <p className="confirm-dialog-copy">{message}</p>
        <div className="confirm-dialog-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" type="button" onClick={onConfirm}>
            {icon}
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function LogoutDialog({ email, onCancel, onConfirm }: { email: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog
      eyebrow="End session"
      title="Log out of LinkPulse?"
      message={
        <>
          You are signed in as <strong>{email}</strong>. Your links stay saved, and you can log back in anytime.
        </>
      }
      confirmLabel="Logout"
      icon={<LogOut size={20} />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function DeleteLinkDialog({
  shortCode,
  onCancel,
  onConfirm,
}: {
  shortCode: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      eyebrow="Delete link"
      title="Delete this short link?"
      message={
        <>
          This will remove <strong>{shortCode}</strong> and its saved link details from your dashboard.
        </>
      }
      confirmLabel="Delete link"
      icon={<Trash2 size={20} />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
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
      ) : page === 'account' ? (
        <div className="account-header-art" aria-hidden="true">
          <UserRound size={64} />
          <span>
            <Settings size={34} />
          </span>
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
                <span className={`analytics-link-copy ${favoriteIds.includes(item.id) ? 'favorite-dot' : ''}`}>
                  <b>
                    {item.short_code}
                    <small>{item.click_count} clicks</small>
                  </b>
                  <em>{item.original_url}</em>
                </span>
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
  onLogout,
  onChanged,
  onError,
}: {
  token: string;
  email: string;
  user: User | null;
  onLogout: () => void;
  onChanged: () => void;
  onError: (error: unknown) => void;
}) {
  return (
    <div className="account-page">
      <AccountInfoPanel email={email} user={user} onLogout={onLogout} />
      <AccountPanel token={token} onChanged={onChanged} onError={onError} />
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
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === 'register' && password !== confirmPassword) {
      setNotice({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (mode === 'register' && !agreeTerms) {
      setNotice({ type: 'error', text: 'Please agree to the terms before creating your account' });
      return;
    }
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
      <section className="auth-visual">
        <div className="auth-brand">
          <img src={linkPulseLogo} alt="" />
          <div>
            <strong>LinkPulse</strong>
            <span>Smart short links</span>
          </div>
        </div>

        <div className="auth-kicker">Shorten <span /> Track <span /> Grow</div>

        <div className="auth-copy">
          <h1>
            {mode === 'login' ? (
              <>
                More than <br /> just shorter <mark>links.</mark>
              </>
            ) : (
              <>
                Modern link <br /> analytics built <br /> for <mark>campaigns.</mark>
              </>
            )}
          </h1>
          <p>Create short links, track performance, and gain valuable insights - all in one powerful platform.</p>
        </div>

        <div className="auth-feature-list">
          <AuthFeature icon={<Link2 size={28} />} tone="blue" title="Shorten Links" text="Clean, branded and shareable links." />
          <AuthFeature icon={<BarChart3 size={28} />} tone="green" title="Powerful Analytics" text="Track clicks, locations, devices and more." />
          <AuthFeature icon={<Target size={28} />} tone="amber" title="Built for Campaigns" text="Measure what matters." />
          <AuthFeature icon={<Zap size={28} />} tone="violet" title="Fast & Reliable" text="99.9% uptime, worldwide." />
        </div>

        <div className="auth-footer-line">
          Turn every link into an opportunity.
          <ArrowRight size={22} />
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-form-card">
          <img className="auth-card-logo" src={linkPulseLogo} alt="" />
          <h2>Link<span>Pulse</span></h2>
          <p className="auth-card-subtitle">Smart short links</p>

          <div className="auth-form-heading">
            <h3>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h3>
            <p>{mode === 'login' ? 'Sign in to your account and continue tracking your links.' : 'Join LinkPulse and start managing your links today.'}</p>
          </div>

          <div className="secure-banner">
            <span>
              <ShieldCheck size={24} />
            </span>
            <div>
              <strong>Your data is secure</strong>
              <p>We keep your information safe and private.</p>
            </div>
          </div>

          {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

          <form onSubmit={submit} className="stack-form auth-stack">
            {mode === 'register' && (
              <label>
                Full name
                <span className="auth-input-shell">
                  <UserRound size={20} />
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Rensith Udara" required />
                </span>
              </label>
            )}
            <label>
              Email address
              <span className="auth-input-shell">
                <Mail size={20} />
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="rensithudaragonalagoda@gmail.com" required />
              </span>
            </label>
            {mode === 'register' && (
              <label>
                Username
                <span className="auth-input-shell">
                  <span className="auth-at">@</span>
                  <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="rensithudara" required />
                </span>
              </label>
            )}
            <label>
              Password
              <span className="auth-input-shell">
                <Lock size={20} />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  minLength={8}
                  required
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </span>
            </label>
            {mode === 'register' && (
              <label>
                Confirm password
                <span className="auth-input-shell">
                  <Lock size={20} />
                  <input
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type={showConfirmPassword ? 'text' : 'password'}
                    minLength={8}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} aria-label="Toggle confirm password visibility">
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </span>
              </label>
            )}

            {mode === 'login' ? (
              <div className="auth-inline-row">
                <label className="auth-check">
                  <input checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" />
                  <span>Remember me</span>
                </label>
                <button type="button">Forgot password?</button>
              </div>
            ) : (
              <label className="auth-check auth-terms">
                <input checked={agreeTerms} onChange={(event) => setAgreeTerms(event.target.checked)} type="checkbox" />
                <span>
                  I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.
                </span>
              </label>
            )}

            <button className="primary-button full auth-submit" disabled={loading} type="submit">
              {mode === 'login' ? <Lock size={22} /> : <UserPlus size={22} />}
              {loading ? 'Working...' : mode === 'login' ? 'Login' : 'Create account'}
              <ArrowRight size={24} />
            </button>
          </form>

          <div className="auth-switch-row">
            <span />
            {mode === 'login' ? (
              <p>
                Don't have an account?
                <button type="button" onClick={() => setMode('register')}>
                  Register now
                  <ArrowRight size={20} />
                </button>
              </p>
            ) : (
              <p>
                Already have an account?
                <button type="button" onClick={() => setMode('login')}>
                  Login here
                  <ArrowRight size={20} />
                </button>
              </p>
            )}
            <span />
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthFeature({ icon, tone, title, text }: { icon: ReactNode; tone: 'blue' | 'green' | 'amber' | 'violet'; title: string; text: string }) {
  return (
    <div className={`auth-feature ${tone}`}>
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  async function copy(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    await navigator.clipboard.writeText(shortURL);
    onCopied();
  }

  async function remove() {
    try {
      await api.deleteURL(token, item.id);
      setShowDeleteDialog(false);
      onDeleted();
    } catch (error) {
      onError(error);
    }
  }

  return (
    <>
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
          <button
            className="icon-button danger"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowDeleteDialog(true);
            }}
            aria-label="Delete short URL"
            title="Delete short URL"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </article>
      {showDeleteDialog && (
        <DeleteLinkDialog shortCode={item.short_code} onCancel={() => setShowDeleteDialog(false)} onConfirm={remove} />
      )}
    </>
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

function AccountInfoPanel({ email, user, onLogout }: { email: string; user: User | null; onLogout: () => void }) {
  return (
    <section className="panel profile-info-panel">
      <div className="account-section-heading">
        <span>
          <UserRound size={28} />
        </span>
        <div>
          <h2>Account Information</h2>
          <p>Your account details and profile information.</p>
        </div>
      </div>

      <div className="profile-email-card">
        <span className="profile-avatar">{avatarInitial(email)}</span>
        <div>
          <p>Email address</p>
          <strong>{email}</strong>
          {user?.created_at && <small>Joined {formatFullDate(user.created_at)}</small>}
        </div>
        <em>
          <i />
          Active
        </em>
      </div>

      <div className="backend-card">
        <span>
          <Wifi size={30} />
        </span>
        <div>
          <strong>Backend connected</strong>
          <p>Your application is connected to the backend server.</p>
        </div>
      </div>

      <button className="profile-logout-button" type="button" onClick={onLogout}>
        <LogOut size={18} />
        Logout
      </button>
    </section>
  );
}

function AccountPanel({
  token,
  onChanged,
  onError,
}: {
  token: string;
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
    <section className="panel account-panel password-panel">
      <div className="account-section-heading">
        <span>
          <Lock size={27} />
        </span>
        <div>
          <h2>Change Password</h2>
          <p>Update your password to keep your account secure.</p>
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
          <ArrowRight size={20} />
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
  const [openRows, setOpenRows] = useState<string[]>([]);

  function toggle(title: string) {
    setOpenRows((current) => (current.includes(title) ? current.filter((item) => item !== title) : [...current, title]));
  }

  return (
    <div className="analytics-breakdown">
      {rows.map((row) => {
        const total = row.data.reduce((sum, item) => sum + item.count, 0);
        const top = row.data.find((item) => item.label);
        const isOpen = openRows.includes(row.title);
        return (
          <div className={`analytics-breakdown-item ${isOpen ? 'open' : ''}`} key={row.title}>
            <button className="analytics-breakdown-row" type="button" onClick={() => toggle(row.title)}>
            <span className="breakdown-icon">{row.icon}</span>
            <span>
              <strong>{row.title}</strong>
              <em>{total ? `${top?.label ?? 'Unknown'} · ${total} click${total === 1 ? '' : 's'}` : 'No clicks yet'}</em>
            </span>
              {isOpen ? <ChevronDown size={22} /> : <ChevronRight size={22} />}
            </button>
            {isOpen && (
              <div className="analytics-breakdown-detail">
                {row.data.length ? (
                  row.data.slice(0, 5).map((item) => (
                    <div key={`${row.title}-${item.label || 'unknown'}`}>
                      <span>{item.label || 'Unknown'}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))
                ) : (
                  <p>No analytics data yet</p>
                )}
              </div>
            )}
          </div>
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
  const rows = normalizeTimeline(data);
  const max = Math.max(1, ...rows.map((item) => item.count));
  const points = rows.map((item, index) => {
    const x = rows.length === 1 ? 450 : 22 + (index / (rows.length - 1)) * 856;
    const y = 140 - (item.count / max) * 108;
    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `22,150 ${line} 878,150`;
  const labelEvery = Math.max(1, Math.floor(points.length / 5));

  return (
    <div className="timeline">
      <div className="mini-heading">
        <span>Clicks over time</span>
        <span>30 days</span>
      </div>
      <div className="timeline-chart">
        <svg viewBox="0 0 900 166" role="img" aria-label="Clicks over time graph" preserveAspectRatio="none">
          <defs>
            <linearGradient id="timelineStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#176bff" />
              <stop offset="100%" stopColor="#7b3ff2" />
            </linearGradient>
            <linearGradient id="timelineFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#176bff" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#7b3ff2" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[32, 68, 104, 140].map((y) => (
            <line className="chart-grid" key={`h-${y}`} x1="22" x2="878" y1={y} y2={y} />
          ))}
          {[22, 236, 450, 664, 878].map((x) => (
            <line className="chart-grid" key={`v-${x}`} x1={x} x2={x} y1="20" y2="150" />
          ))}
          <polygon className="chart-area" points={area} />
          <polyline className="chart-line" points={line} />
          {points.map((point) => (
            <circle className="chart-point" key={point.date} cx={point.x} cy={point.y} r="4.5">
              <title>{`${point.date}: ${point.count} clicks`}</title>
            </circle>
          ))}
        </svg>
        <div className="timeline-labels">
          {points
            .filter((_, index) => index % labelEvery === 0)
            .slice(0, 5)
            .map((point) => (
              <span key={`label-${point.date}`}>{formatTimelineLabel(point.date)}</span>
            ))}
        </div>
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

function normalizeTimeline(data: { date: string; count: number }[]) {
  if (data.length) return data.slice(-30);

  const today = new Date();
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));
    return { date: date.toISOString(), count: 0 };
  });
}

function formatTimelineLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit' }).format(date);
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
