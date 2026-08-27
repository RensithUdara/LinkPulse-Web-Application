import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarClock,
  Copy,
  ExternalLink,
  Link2,
  Lock,
  LogOut,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { Analytics, API_BASE_URL, ShortURL, api, shortURLFor } from './api';

type AuthMode = 'login' | 'register';
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

  const selectedURL = urls.find((item) => item.id === selectedId) ?? urls[0];
  const filteredURLs = useMemo(() => {
    const needle = query.toLowerCase().trim();
    if (!needle) return urls;
    return urls.filter((item) => {
      return (
        item.original_url.toLowerCase().includes(needle) ||
        item.short_code.toLowerCase().includes(needle) ||
        item.custom_alias?.toLowerCase().includes(needle)
      );
    });
  }, [query, urls]);

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

  async function refreshURLs(authToken = token) {
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

  if (!token) {
    return <AuthScreen onAuth={handleAuth} notice={notice} setNotice={setNotice} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Link2 size={24} />
          </span>
          <div>
            <strong>LinkScope</strong>
            <span>Short links with proof</span>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Main navigation">
          <a className="nav-item active" href="#workspace">
            <Activity size={18} />
            Workspace
          </a>
          <a className="nav-item" href="#analytics">
            <BarChart3 size={18} />
            Analytics
          </a>
        </nav>

        <div className="account-box">
          <span>{email}</span>
          <button className="icon-button" type="button" onClick={logout} aria-label="Log out" title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <section className="workspace" id="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">API target</p>
            <h1>{API_BASE_URL.replace(/^https?:\/\//, '')}</h1>
          </div>
          <button className="ghost-button" type="button" onClick={() => refreshURLs()} disabled={loading}>
            <RefreshCw size={18} />
            Refresh
          </button>
        </header>

        {notice && (
          <div className={`notice ${notice.type}`} role="status">
            {notice.text}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              x
            </button>
          </div>
        )}

        <CreateURLForm
          token={token}
          onCreated={async (message) => {
            setNotice({ type: 'success', text: message });
            await refreshURLs();
          }}
          onError={showError}
        />

        <div className="content-grid">
          <section className="panel url-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Links</p>
                <h2>{urls.length} total</h2>
              </div>
              <label className="search-box">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search links" />
              </label>
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

          <AnalyticsPanel analytics={analytics} selectedURL={selectedURL} />
        </div>
      </section>
    </main>
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
        <div className="signal-board">
          <div className="signal-line tall" />
          <div className="signal-line short" />
          <div className="signal-line mid" />
          <div className="signal-line peak" />
          <div className="signal-line mid" />
        </div>
        <div className="metric-tile">
          <MousePointerClick size={20} />
          <strong>12.4k</strong>
          <span>tracked clicks</span>
        </div>
        <div className="metric-tile secondary">
          <ShieldCheck size={20} />
          <strong>98%</strong>
          <span>cache hits</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="brand compact">
          <span className="brand-mark">
            <Link2 size={22} />
          </span>
          <div>
            <strong>LinkScope</strong>
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
          <button className="primary-button" disabled={loading} type="submit">
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
    <form className="create-strip" onSubmit={submit}>
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
        Alias
        <input value={customAlias} onChange={(event) => setCustomAlias(event.target.value)} placeholder="campaign-01" />
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
  onDeleted,
  onError,
}: {
  item: ShortURL;
  selected: boolean;
  token: string;
  onSelect: () => void;
  onDeleted: () => void;
  onError: (error: unknown) => void;
}) {
  const shortURL = shortURLFor(item.short_code);

  async function copy() {
    await navigator.clipboard.writeText(shortURL);
  }

  async function remove() {
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
        <span>
          <MousePointerClick size={15} />
          {item.click_count}
        </span>
        <span>
          <CalendarClock size={15} />
          {formatDate(item.created_at)}
        </span>
      </div>
      <div className="row-actions">
        <button className="icon-button" type="button" onClick={copy} aria-label="Copy short URL" title="Copy short URL">
          <Copy size={17} />
        </button>
        <a className="icon-button" href={shortURL} target="_blank" rel="noreferrer" aria-label="Open short URL" title="Open short URL">
          <ExternalLink size={17} />
        </a>
        <button className="icon-button danger" type="button" onClick={remove} aria-label="Delete short URL" title="Delete short URL">
          <Trash2 size={17} />
        </button>
      </div>
    </article>
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
        <Stat label="Total clicks" value={analytics?.total_clicks ?? 0} />
        <Stat label="Unique visitors" value={analytics?.unique_visitors ?? 0} />
      </div>

      <MiniTimeline data={analytics?.clicks_by_day ?? []} />

      <GroupedBars title="Devices" data={analytics?.devices ?? []} />
      <GroupedBars title="Browsers" data={analytics?.browsers ?? []} />
      <GroupedBars title="Countries" data={analytics?.countries ?? []} />
      <GroupedBars title="Referrers" data={analytics?.referrers ?? []} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
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
        {(data.length ? data : Array.from({ length: 12 }, (_, index) => ({ date: String(index), count: 0 }))).map(
          (item) => (
            <span
              key={item.date}
              style={{ height: `${Math.max(8, (item.count / max) * 100)}%` }}
              title={`${item.date}: ${item.count}`}
            />
          ),
        )}
      </div>
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
      <Link2 size={26} />
      <strong>No links yet</strong>
      <span>Create your first short URL to start collecting analytics.</span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}
