import { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const PAGE_TITLES = {
  home: 'Home',
  discover: 'Discover',
  'my-list': 'My List',
  'coming-soon': 'Coming Soon',
  detail: 'Detail',
};

function getCurrentPage() {
  const hash = window.location.hash.replace('#', '').trim();
  if (!hash) return 'home';
  if (hash.startsWith('detail/')) return 'detail';
  return PAGE_TITLES[hash] ? hash : 'home';
}

function getRouteMovieId() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash.startsWith('detail/')) {
    return hash.split('/')[1];
  }
  return null;
}

function getStoredUsers() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem('streamsphere-users') || '[]');
  } catch {
    return [];
  }
}

function getStoredAuthUser() {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem('streamsphere-auth');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function getTrailerUrl(movie) {
  const trailers = {
    'The Midnight Circuit': 'https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1',
    'Neon Harbor': 'https://www.youtube.com/embed/2LqzF5WzX6Q?autoplay=1',
    'Velvet Skyline': 'https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1',
    'The Last Compass': 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1',
    'Shadowline': 'https://www.youtube.com/embed/9bZkp7q19f0?autoplay=1',
    'Echoes of Tomorrow': 'https://www.youtube.com/embed/3fumBcKC6RE?autoplay=1',
  };
  return trailers[movie?.title] || 'https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1';
}

function App() {
  const [movies, setMovies] = useState([]);
  const [health, setHealth] = useState(null);
  const [version, setVersion] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [myList, setMyList] = useState([]);
  const [currentPage, setCurrentPage] = useState(getCurrentPage());
  const [currentMovieId, setCurrentMovieId] = useState(getRouteMovieId());
  const [searchTerm, setSearchTerm] = useState('');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [activeGenre, setActiveGenre] = useState('All');
  const [autoPlay, setAutoPlay] = useState(true);
  const [activeTrailer, setActiveTrailer] = useState(null);
  const [theme, setTheme] = useState(() => (typeof window !== 'undefined' ? window.localStorage.getItem('streamsphere-theme') || 'dark' : 'dark'));
  const [registeredUsers, setRegisteredUsers] = useState(getStoredUsers);
  const [authUser, setAuthUser] = useState(getStoredAuthUser);
  const [authMode, setAuthMode] = useState('sign-in');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    const loadApp = async () => {
      try {
        const savedList = window.localStorage.getItem('streamsphere-watchlist');
        const savedHistory = window.localStorage.getItem('streamsphere-history');
        if (savedList) setMyList(JSON.parse(savedList));
        if (savedHistory) setRecentlyViewed(JSON.parse(savedHistory));

        const [healthRes, versionRes, moviesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/health`),
          fetch(`${API_BASE_URL}/api/version`),
          fetch(`${API_BASE_URL}/api/movies`),
        ]);

        if (healthRes.ok) setHealth(await healthRes.json());
        if (versionRes.ok) setVersion(await versionRes.json());
        if (moviesRes.ok) {
          const data = await moviesRes.json();
          setMovies(data);
          setSelectedMovie(data[0]);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setBootstrapped(true);
      }
    };

    loadApp();
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setCurrentPage(getCurrentPage());
      setCurrentMovieId(getRouteMovieId());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('streamsphere-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('streamsphere-watchlist', JSON.stringify(myList));
  }, [myList]);

  useEffect(() => {
    window.localStorage.setItem('streamsphere-history', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  useEffect(() => {
    window.localStorage.setItem('streamsphere-users', JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  useEffect(() => {
    if (authUser) {
      window.localStorage.setItem('streamsphere-auth', JSON.stringify(authUser));
    } else {
      window.localStorage.removeItem('streamsphere-auth');
    }
  }, [authUser]);

  const featuredMovies = useMemo(() => movies.filter((movie) => movie.featured), [movies]);
  const trendingMovies = useMemo(() => movies.filter((movie) => movie.trending), [movies]);
  const continueWatchingMovies = useMemo(() => movies.filter((movie) => movie.continueWatching), [movies]);
  const upcomingMovies = useMemo(() => movies.filter((movie) => movie.year >= 2024), [movies]);
  const discoverMovies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return movies.filter((movie) => {
      const matchesGenre = activeGenre === 'All' || movie.genre.toLowerCase().includes(activeGenre.toLowerCase());
      const matchesSearch = !term || [movie.title, movie.genre, movie.description].some((value) => value.toLowerCase().includes(term));
      return matchesGenre && matchesSearch;
    });
  }, [movies, searchTerm, activeGenre]);
  const myListMovies = useMemo(() => movies.filter((movie) => myList.includes(movie.id)), [movies, myList]);
  const recentMovies = useMemo(() => movies.filter((movie) => recentlyViewed.includes(movie.id)), [movies, recentlyViewed]);
  const topRatedMovies = useMemo(() => [...movies].sort((a, b) => b.rating - a.rating).slice(0, 4), [movies]);
  const genreFilters = useMemo(() => ['All', ...new Set(movies.map((movie) => movie.genre.split(' • ')[0]))], [movies]);

  const heroMovie = selectedMovie || featuredMovies[0] || movies[0] || null;
  const detailMovie = useMemo(() => movies.find((movie) => movie.id === currentMovieId) || null, [movies, currentMovieId]);
  const carouselMovies = useMemo(() => [...trendingMovies, ...featuredMovies].slice(0, 6), [trendingMovies, featuredMovies]);

  const toggleMyList = (movie) => {
    if (!movie) return;
    setMyList((prev) => (prev.includes(movie.id) ? prev.filter((id) => id !== movie.id) : [...prev, movie.id]));
  };

  const trackView = (movie) => {
    if (!movie) return;
    setRecentlyViewed((prev) => [movie.id, ...prev.filter((id) => id !== movie.id)].slice(0, 6));
  };

  const setPage = (page) => {
    window.location.hash = page;
    setCurrentPage(page);
    setCurrentMovieId(null);
  };

  const openDetail = (movie) => {
    if (!movie) return;
    window.location.hash = `detail/${movie.id}`;
    setCurrentMovieId(movie.id);
    setCurrentPage('detail');
    setSelectedMovie(movie);
    trackView(movie);
  };

  const openTrailer = (movie) => {
    if (!movie) return;
    setActiveTrailer(movie);
    trackView(movie);
  };

  const handleAuthSubmit = (event) => {
    event.preventDefault();
    const trimmedEmail = authForm.email.trim().toLowerCase();
    const trimmedName = authForm.name.trim();
    const trimmedPassword = authForm.password.trim();

    if (!trimmedEmail || !trimmedPassword || (authMode === 'sign-up' && !trimmedName)) {
      setAuthError('Please complete all required fields.');
      return;
    }

    if (trimmedPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    if (authMode === 'sign-up') {
      const emailExists = registeredUsers.some((user) => user.email.toLowerCase() === trimmedEmail);
      if (emailExists) {
        setAuthError('An account already exists for that email.');
        return;
      }
      const newUser = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
      };
      setRegisteredUsers((prev) => [...prev, newUser]);
      setAuthUser(newUser);
      setAuthError('');
      setAuthForm({ name: '', email: '', password: '' });
      return;
    }

    const foundUser = registeredUsers.find((user) => user.email.toLowerCase() === trimmedEmail && user.password === trimmedPassword);
    if (!foundUser) {
      setAuthError('Invalid email or password.');
      return;
    }

    setAuthUser(foundUser);
    setAuthError('');
    setAuthForm({ name: '', email: '', password: '' });
  };

  const handleLogout = () => {
    setAuthUser(null);
    setCurrentPage('home');
    setCurrentMovieId(null);
    setSelectedMovie(null);
    setActiveTrailer(null);
  };

  const renderMovieCard = (movie) => {
    const inList = myList.includes(movie.id);
    return (
      <article key={movie.id} className="movie-card" onClick={() => openDetail(movie)}>
        <img src={movie.image} alt={movie.title} />
        <div className="movie-info">
          <div className="movie-heading-row">
            <h3>{movie.title}</h3>
            <button
              className={`mini-btn ${inList ? 'active' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleMyList(movie);
              }}
            >
              {inList ? '♥' : '♡'}
            </button>
          </div>
          <p>{movie.genre} • {movie.year}</p>
          <p className="movie-meta">⭐ {movie.rating} • {movie.duration}</p>
        </div>
      </article>
    );
  };

  const renderMovieSection = (title, items) => (
    <section className="movie-row">
      <div className="row-heading">
        <h2>{title}</h2>
        <span className="pill">Curated just for you</span>
      </div>
      <div className="movie-grid">{items.map((movie) => renderMovieCard(movie))}</div>
    </section>
  );

  if (!bootstrapped) {
    return (
      <div className="app-shell auth-shell">
        <div className="auth-card loading-card">
          <h2>Loading StreamSphere…</h2>
          <p>Preparing your cinematic experience.</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="app-shell auth-shell">
        <div className="auth-card">
          <div className="auth-header">
            <p className="eyebrow">Welcome back</p>
            <h1>StreamSphere</h1>
            <p>Sign in or create an account to unlock your personalized watch experience.</p>
          </div>

          <div className="auth-toggle">
            <button className={authMode === 'sign-in' ? 'active' : ''} onClick={() => { setAuthMode('sign-in'); setAuthError(''); }}>
              Sign In
            </button>
            <button className={authMode === 'sign-up' ? 'active' : ''} onClick={() => { setAuthMode('sign-up'); setAuthError(''); }}>
              Create Account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === 'sign-up' && (
              <input
                type="text"
                placeholder="Full name"
                value={authForm.name}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            )}
            <input
              type="email"
              placeholder="Email address"
              value={authForm.email}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
            />
            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
            />
            {authError && <p className="auth-error">{authError}</p>}
            <button className="primary-btn auth-submit" type="submit">{authMode === 'sign-in' ? 'Sign In' : 'Create Account'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${theme === 'light' ? 'theme-light' : ''}`}>
      <header className="hero">
        <nav className="nav-bar">
          <div className="brand">STREAMSPHERE</div>
          <div className="nav-links">
            <button className={`nav-link ${currentPage === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>Home</button>
            <button className={`nav-link ${currentPage === 'discover' ? 'active' : ''}`} onClick={() => setPage('discover')}>Discover</button>
            <button className={`nav-link ${currentPage === 'my-list' ? 'active' : ''}`} onClick={() => setPage('my-list')}>My List</button>
            <button className={`nav-link ${currentPage === 'coming-soon' ? 'active' : ''}`} onClick={() => setPage('coming-soon')}>Coming Soon</button>
            <button className="nav-link theme-toggle" onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}>
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-copy">
            <p className="eyebrow">Now streaming</p>
            <h1>{heroMovie?.title || 'A cinematic escape'}</h1>
            <p>{heroMovie?.description || 'Discover stories that keep you on the edge of your seat.'}</p>
            <div className="hero-actions">
              <button className="primary-btn" onClick={() => openTrailer(heroMovie)}>▶ Watch Trailer</button>
              <button className="secondary-btn" onClick={() => toggleMyList(heroMovie)}>＋ {myList.includes(heroMovie?.id) ? 'Saved' : 'My List'}</button>
            </div>
            <div className="hero-meta">
              <span>{heroMovie?.genre}</span>
              <span>{heroMovie?.year}</span>
              <span>⭐ {heroMovie?.rating}</span>
            </div>
          </div>
          <div className="hero-poster">
            <img src={heroMovie?.image} alt={heroMovie?.title} />
          </div>
        </div>
      </header>

      <main className="content">
        <section className="status-bar">
          <span>API Status: {health?.status || 'Checking...'}</span>
          <span>Version: {version?.version || '1.0.0'}</span>
          <span>Welcome, {authUser.name}</span>
          <button className="pill-btn" onClick={handleLogout}>Sign out</button>
        </section>

        <div className="page-nav">
          <button className={`nav-pill ${currentPage === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>Home</button>
          <button className={`nav-pill ${currentPage === 'discover' ? 'active' : ''}`} onClick={() => setPage('discover')}>Discover</button>
          <button className={`nav-pill ${currentPage === 'my-list' ? 'active' : ''}`} onClick={() => setPage('my-list')}>My List</button>
          <button className={`nav-pill ${currentPage === 'coming-soon' ? 'active' : ''}`} onClick={() => setPage('coming-soon')}>Coming Soon</button>
        </div>

        {currentPage === 'home' && (
          <>
            <section className="carousel-section">
              <div className="row-heading">
                <h2>Featured Picks</h2>
                <div className="carousel-controls">
                  <button className="mini-btn" onClick={() => setAutoPlay((prev) => !prev)}>{autoPlay ? '⏸' : '▶'}</button>
                  <button className="mini-btn" onClick={() => setCarouselIndex((prev) => (prev === 0 ? carouselMovies.length - 1 : prev - 1))}>←</button>
                  <button className="mini-btn" onClick={() => setCarouselIndex((prev) => (prev + 1) % carouselMovies.length)}>→</button>
                </div>
              </div>
              <div className="carousel-card" onClick={() => openDetail(carouselMovies[carouselIndex])}>
                <img src={carouselMovies[carouselIndex]?.image} alt={carouselMovies[carouselIndex]?.title} />
                <div className="carousel-overlay">
                  <h3>{carouselMovies[carouselIndex]?.title}</h3>
                  <p>{carouselMovies[carouselIndex]?.description}</p>
                </div>
              </div>
            </section>

            <section className="highlight-grid">
              <article className="highlight-card accent">
                <p className="eyebrow">Watchlist</p>
                <h3>{myList.length} saved titles</h3>
                <p>Keep your favorites in one place and revisit them anytime.</p>
              </article>
              <article className="highlight-card">
                <p className="eyebrow">Now seeing</p>
                <h3>{recentMovies.length} recent picks</h3>
                <p>Your activity history helps surface the next binge-worthy title.</p>
              </article>
              <article className="highlight-card">
                <p className="eyebrow">Fresh arrivals</p>
                <h3>{upcomingMovies.length} coming soon</h3>
                <p>Stay ahead of the release calendar with new arrivals every week.</p>
              </article>
            </section>
          </>
        )}

        {currentPage === 'discover' && (
          <section className="panel">
            <div className="row-heading">
              <h2>Discover your next obsession</h2>
              <input
                className="search-input"
                type="search"
                placeholder="Search by title, genre, or mood"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="genre-row">
              {genreFilters.map((genre) => (
                <button key={genre} className={`pill-chip ${activeGenre === genre ? 'active' : ''}`} onClick={() => setActiveGenre(genre)}>
                  {genre}
                </button>
              ))}
            </div>
            <div className="movie-grid">{discoverMovies.map((movie) => renderMovieCard(movie))}</div>
          </section>
        )}

        {currentPage === 'my-list' && (
          <section className="panel">
            <div className="row-heading">
              <h2>Your saved picks</h2>
              <span className="pill">{myListMovies.length} saved</span>
            </div>
            {myListMovies.length > 0 ? <div className="movie-grid">{myListMovies.map((movie) => renderMovieCard(movie))}</div> : <p className="empty-state">Save a few favorites to build your personal watchlist.</p>}
          </section>
        )}

        {currentPage === 'coming-soon' && (
          <section className="panel">
            <div className="row-heading">
              <h2>What arrives next</h2>
              <span className="pill">Fresh releases</span>
            </div>
            <div className="movie-grid">{upcomingMovies.map((movie) => renderMovieCard(movie))}</div>
          </section>
        )}

        {currentPage === 'home' && (
          <>
            {recentMovies.length > 0 && renderMovieSection('Recently Viewed', recentMovies)}
            {renderMovieSection('Trending Now', trendingMovies)}
            {renderMovieSection('Popular Picks', featuredMovies)}
            {renderMovieSection('Top Rated', topRatedMovies)}
            {renderMovieSection('Continue Watching', continueWatchingMovies)}
          </>
        )}

        {currentPage === 'detail' && detailMovie && (
          <section className="panel detail-panel">
            <div className="detail-card">
              <img src={detailMovie.image} alt={detailMovie.title} />
              <div className="detail-copy">
                <h2>{detailMovie.title}</h2>
                <p>{detailMovie.description}</p>
                <div className="hero-meta">
                  <span>{detailMovie.genre}</span>
                  <span>{detailMovie.year}</span>
                  <span>{detailMovie.duration}</span>
                  <span>⭐ {detailMovie.rating}</span>
                </div>
                <div className="hero-actions">
                  <button className="primary-btn" onClick={() => toggleMyList(detailMovie)}>♥ {myList.includes(detailMovie.id) ? 'Saved' : 'Save to List'}</button>
                  <button className="secondary-btn" onClick={() => setPage('home')}>Back Home</button>
                  <button className="secondary-btn" onClick={() => openTrailer(detailMovie)}>▶ Watch Trailer</button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {selectedMovie && currentPage !== 'detail' && (
        <div className="modal-overlay" onClick={() => setSelectedMovie(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <img src={selectedMovie.image} alt={selectedMovie.title} />
            <div className="modal-content">
              <div className="modal-heading-row">
                <h3>{selectedMovie.title}</h3>
                <button className="mini-btn active" onClick={() => setSelectedMovie(null)}>✕</button>
              </div>
              <p className="modal-description">{selectedMovie.description}</p>
              <div className="hero-meta modal-meta">
                <span>{selectedMovie.genre}</span>
                <span>{selectedMovie.year}</span>
                <span>{selectedMovie.duration}</span>
                <span>⭐ {selectedMovie.rating}</span>
              </div>
              <div className="hero-actions">
                <button className="primary-btn" onClick={() => toggleMyList(selectedMovie)}>♥ {myList.includes(selectedMovie.id) ? 'Saved' : 'Save to List'}</button>
                <button className="secondary-btn" onClick={() => setSelectedMovie(null)}>Close</button>
                <button className="secondary-btn" onClick={() => openTrailer(selectedMovie)}>▶ Watch Trailer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTrailer && (
        <div className="modal-overlay trailer-overlay" onClick={() => setActiveTrailer(null)}>
          <div className="trailer-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading-row">
              <h3>{activeTrailer.title} Trailer</h3>
              <button className="mini-btn active" onClick={() => setActiveTrailer(null)}>✕</button>
            </div>
            <div className="trailer-frame">
              <iframe
                src={getTrailerUrl(activeTrailer)}
                title={`${activeTrailer.title} trailer`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>© 2026 StreamSphere. Built for a modern cinematic experience.</p>
      </footer>
    </div>
  );
}

export default App;
