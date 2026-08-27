import { FormEvent, MouseEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Filter,
  Globe2,
  LayoutDashboard,
  Link2,
  Lock,
  LogOut,
  MousePointerClick,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  Trash2,
  TrendingUp,
  UserPlus,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Analytics, API_BASE_URL, ShortURL, api, shortURLFor } from './api';

type AuthMode = 'login' | 'register';
type LinkFilter = 'all' | 'active' | 'expired';
type SortMode = 'newest' | 'clicks';
type Notice = { type: 'success' | 'error'; text: string } | null;

const storedToken = localStorage.getItem('links_token') ?? '';
const storedEmail = localStorage.getItem('links_email') ?? '';

export default function App() {
  const [token, setToken] = useState(storedToken);
  const [email, setEmail] = useState(storedEmail);
  const [urls, setUrls] = useState<ShortURL[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LinkFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const selectedURL = urls.find((item) => item.id === selectedId) ?? urls[0];
  const summary = useMemo(() => buildSummary(urls), [urls]);
  const filteredURLs = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return urls
      .filter((item) => {
        if (filter === 'active') return !isExpired(item);
        if (filter === 'expired') return isExpired(item);
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
  }, [query, urls, filter, sortMode]);

  useEffect(() => {
    void checkHealth();
  }, []);

  useEffect(() => {
    if (!token) return;
    void refreshURLs(token);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedURL) {
      setAnalytics(null);
      return;
    }
    void loadAnalytics(token, selectedURL.id);
  }, [token, selectedURL?.id]);

  async function checkHealth() {
    try {
      await api.health();
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }
  }

  async function refreshURLs(authToken = token) {
    setLoading(true);
    try {
      const data = await api.listURLs(authToken);
      setUrls(data ?? []);
      if (data?.length && !data.some((item) => item.id === selectedId)) {
        setSelectedId(data[0].id);
      }
      await checkHealth();
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics(authToken: string, id: string) {
    try {
      setAnalytics(await api.analytics(authToken, id));
    } catch (error) {
      showError(error);
    }
  }

  function handleAuth(authToken: string, userEmail: string) {
    setToken(authToken);
    setEmail(userEmail);
    localStorage.setItem('links_token', authToken);
    localStorage.setItem('links_email', userEmail);
  }

  function logout() {
    setToken('');
    setEmail('');
    setUrls([]);
    setSelectedId('');
    setAnalytics(null);
    localStorage.removeItem('links_token');
    localStorage.removeItem('links_email');
  }

  function showError(error: unknown) {
    setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Something went wrong' });
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
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    downloadFile('links.csv', csv, 'text/csv;charset=utf-8');
  }

  if (!token) {
    return <AuthScreen onAuth={handleAuth} notice={notice} setNotice={setNotice} apiOnline={apiOnline} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Link2 size={24} />
          </span>
          <div>
            <strong>LinkPulse</strong>
            <span>Short links and analytics</span>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Main navigation">
          <a className="nav-item active" href="#overview">
            <LayoutDashboard size={18} />
            Overview
          </a>
          <a className="nav-item" href="#links">
            <Link2 size={18} />
            Links
          </a>
          <a className="nav-item" href="#analytics">
            <BarChart3 size={18} />
            Analytics
          </a>
        </nav>

        <div className="sidebar-card">
          <span className={`status-dot ${apiOnline ? 'online' : 'offline'}`} />
          <div>
            <strong>{apiOnline ? 'API online' : 'API offline'}</strong>
            <span>{API_BASE_URL.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>

        <div className="account-box">
          <span>{email}</span>
          <button className="icon-button sidebar-action" type="button" onClick={logout} aria-label="Log out" title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="hero-panel" id="overview">
          <div className="hero-copy">
            <p className="eyebrow">Link command center</p>
            <h1>Track every short link from click to conversion.</h1>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => document.getElementById('create-link')?.scrollIntoView()}>
                <Plus size={18} />
                New link
              </button>
              <button className="ghost-button" type="button" onClick={() => refreshURLs()} disabled={loading}>
                <RefreshCw size={18} />
                Refresh
              </button>
              <button className="ghost-button" type="button" onClick={exportCSV} disabled={urls.length === 0}>
                <FileDown size={18} />
                Export
              </button>
            </div>
          </div>
          <div className="hero-meter">
            <span>Clicks</span>
            <strong>{summary.totalClicks.toLocaleString()}</strong>
            <MiniSparkline data={urls.map((item) => item.click_count)} />
          </div>
        </header>

        {notice && (
          <div className={`notice ${notice.type}`} role="status">
            {notice.text}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        <section className="metric-grid" aria-label="Link summary">
          <MetricCard tone="blue" icon={<Link2 size={20} />} label="Total links" value={summary.totalLinks} />
          <MetricCard tone="green" icon={<MousePointerClick size={20} />} label="Total clicks" value={summary.totalClicks} />
          <MetricCard tone="amber" icon={<TrendingUp size={20} />} label="Top link clicks" value={summary.topClicks} />
          <MetricCard tone="rose" icon={<Timer size={20} />} label="Expired links" value={summary.expiredLinks} />
        </section>

        <CreateURLForm
          token={token}
          onCreated={async (message) => {
            setNotice({ type: 'success', text: message });
            await refreshURLs();
          }}
          onError={showError}
        />

        <div className="content-grid">
          <section className="panel url-panel" id="links">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Link library</p>
                <h2>{filteredURLs.length} showing</h2>
              </div>
              <label className="search-box">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search links" />
              </label>
            </div>

            <div className="toolbar-row">
              <div className="segmented small">
                <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>
                  <Filter size={15} />
                  All
                </button>
                <button className={filter === 'active' ? 'active' : ''} type="button" onClick={() => setFilter('active')}>
                  <Check size={15} />
                  Active
                </button>
                <button className={filter === 'expired' ? 'active' : ''} type="button" onClick={() => setFilter('expired')}>
                  <Timer size={15} />
                  Expired
                </button>
              </div>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Sort links">
                <option value="newest">Newest first</option>
                <option value="clicks">Most clicks</option>
              </select>
            </div>

            <div className="url-list">
              {filteredURLs.length === 0 ? (
                <EmptyState />
              ) : (
                filteredURLs.map((item) => (
                  <URLRow
                    key={item.id}
                    item={item}
                    selected={selectedURL?.id === item.id}
                    token={token}
                    onSelect={() => setSelectedId(item.id)}
                    onCopied={() => setNotice({ type: 'success', text: 'Short URL copied' })}
                    onDeleted={async () => {
                      setNotice({ type: 'success', text: 'Short URL deleted' });
                      await refreshURLs();
                    }}
                    onError={showError}
                  />
                ))
              )}
            </div>
          </section>

          <aside className="side-stack">
            <SelectedLinkPanel selectedURL={selectedURL} onCopied={() => setNotice({ type: 'success', text: 'Short URL copied' })} />
            <AnalyticsPanel analytics={analytics} selectedURL={selectedURL} />
          </aside>
        </div>
      </section>
    </main>
  );
}

function AuthScreen({
  onAuth,
  notice,
  setNotice,
  apiOnline,
}: {
  onAuth: (token: string, email: string) => void;
  notice: Notice;
  setNotice: (notice: Notice) => void;
  apiOnline: boolean | null;
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
          <strong>Launch, measure, and clean up campaigns faster.</strong>
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

        <div className={`api-pill ${apiOnline ? 'online' : 'offline'}`}>
          {apiOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          {apiOnline ? 'Backend connected' : 'Backend unavailable'}
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
      <div className="create-heading">
        <span>
          <Plus size={18} />
        </span>
        <div>
          <p className="eyebrow">Create</p>
          <h2>Build a trackable short link</h2>
        </div>
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
        {loading ? 'Creating' : 'Create'}
      </button>
    </form>
  );
}

function URLRow({
  item,
  selected,
  token,
  onSelect,
  onCopied,
  onDeleted,
  onError,
}: {
  item: ShortURL;
  selected: boolean;
  token: string;
  onSelect: () => void;
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

function SelectedLinkPanel({ selectedURL, onCopied }: { selectedURL?: ShortURL; onCopied: () => void }) {
  if (!selectedURL) {
    return null;
  }

  const shortURL = shortURLFor(selectedURL.short_code);

  async function copy() {
    await navigator.clipboard.writeText(shortURL);
    onCopied();
  }

  function downloadQR() {
    const svg = document.getElementById('selected-link-qr');
    if (!svg) return;
    downloadFile(`${selectedURL.short_code}-qr.svg`, new XMLSerializer().serializeToString(svg), 'image/svg+xml;charset=utf-8');
  }

  return (
    <section className="panel detail-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Selected link</p>
          <h2>{selectedURL.short_code}</h2>
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
          <strong>{selectedURL.original_url}</strong>
        </div>
        <div>
          <span>Expires</span>
          <strong>{selectedURL.expires_at ? formatFullDate(selectedURL.expires_at) : 'Never'}</strong>
        </div>
      </div>
      <div className="detail-actions">
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
    <section className="panel analytics-panel" id="analytics">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2>{selectedURL ? selectedURL.short_code : 'No link selected'}</h2>
        </div>
        <BarChart3 size={22} />
      </div>

      <div className="stats-grid">
        <Stat label="Total clicks" value={analytics?.total_clicks ?? 0} tone="teal" />
        <Stat label="Unique visitors" value={analytics?.unique_visitors ?? 0} tone="amber" />
      </div>

      <MiniTimeline data={analytics?.clicks_by_day ?? []} />

      <GroupedBars title="Devices" data={analytics?.devices ?? []} />
      <GroupedBars title="Browsers" data={analytics?.browsers ?? []} />
      <GroupedBars title="Countries" data={analytics?.countries ?? []} />
      <GroupedBars title="Operating systems" data={analytics?.operating_systems ?? []} />
      <GroupedBars title="Referrers" data={analytics?.referrers ?? []} />
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'amber' | 'rose';
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value.toLocaleString()}</strong>
      </div>
    </article>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'teal' | 'amber' }) {
  return (
    <div className={`stat ${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function MiniTimeline({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));

  return (
    <div className="timeline">
      <div className="mini-heading">
        <span>Clicks over time</span>
        <span>30 days</span>
      </div>
      <div className="timeline-bars">
        {(data.length ? data : Array.from({ length: 14 }, (_, index) => ({ date: String(index), count: 0 }))).map((item) => (
          <span
            key={item.date}
            style={{ height: `${Math.max(8, (item.count / max) * 100)}%` }}
            title={`${item.date}: ${item.count}`}
          />
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
      <strong>No links match this view</strong>
      <span>Create a short URL or adjust your filters to see links here.</span>
    </div>
  );
}

function buildSummary(urls: ShortURL[]) {
  return {
    totalLinks: urls.length,
    totalClicks: urls.reduce((sum, item) => sum + item.click_count, 0),
    topClicks: Math.max(0, ...urls.map((item) => item.click_count)),
    expiredLinks: urls.filter(isExpired).length,
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
