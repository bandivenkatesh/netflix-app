import { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [movies, setMovies] = useState([]);
  const [health, setHealth] = useState(null);
  const [version, setVersion] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
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
      }
    };

    fetchData();
  }, []);

  const featuredMovies = useMemo(() => movies.filter((movie) => movie.featured), [movies]);
  const trendingMovies = useMemo(() => movies.filter((movie) => movie.trending), [movies]);
  const continueWatching = useMemo(() => movies.filter((movie) => movie.continueWatching), [movies]);

  return (
    <div className="app-shell">
      <header className="hero">
        <nav className="nav-bar">
          <div className="brand">NETFLIX</div>
          <div className="nav-links">
            <span>Home</span>
            <span>Series</span>
            <span>Films</span>
            <span>My List</span>
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-copy">
            <p className="eyebrow">Now streaming</p>
            <h1>{selectedMovie?.title || 'A cinematic escape'}</h1>
            <p>{selectedMovie?.description || 'Discover stories that keep you on the edge of your seat.'}</p>
            <div className="hero-actions">
              <button className="primary-btn">▶ Play</button>
              <button className="secondary-btn">＋ My List</button>
            </div>
            <div className="hero-meta">
              <span>{selectedMovie?.genre}</span>
              <span>{selectedMovie?.year}</span>
              <span>⭐ {selectedMovie?.rating}</span>
            </div>
          </div>
          <div className="hero-poster">
            <img src={selectedMovie?.image} alt={selectedMovie?.title} />
          </div>
        </div>
      </header>

      <main className="content">
        <section className="status-bar">
          <span>API Status: {health?.status || 'Checking...'}</span>
          <span>Version: {version?.version || '...'}</span>
        </section>

        <section className="movie-row">
          <h2>Trending Now</h2>
          <div className="movie-grid">
            {trendingMovies.map((movie) => (
              <article key={movie.id} className="movie-card" onClick={() => setSelectedMovie(movie)}>
                <img src={movie.image} alt={movie.title} />
                <div className="movie-info">
                  <h3>{movie.title}</h3>
                  <p>{movie.genre} • {movie.year}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="movie-row">
          <h2>Popular Picks</h2>
          <div className="movie-grid">
            {featuredMovies.map((movie) => (
              <article key={movie.id} className="movie-card" onClick={() => setSelectedMovie(movie)}>
                <img src={movie.image} alt={movie.title} />
                <div className="movie-info">
                  <h3>{movie.title}</h3>
                  <p>{movie.genre} • {movie.year}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="movie-row">
          <h2>Continue Watching</h2>
          <div className="movie-grid">
            {continueWatching.map((movie) => (
              <article key={movie.id} className="movie-card" onClick={() => setSelectedMovie(movie)}>
                <img src={movie.image} alt={movie.title} />
                <div className="movie-info">
                  <h3>{movie.title}</h3>
                  <p>{movie.genre} • {movie.year}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>© 2026 StreamSphere. Built for a modern cinematic experience.</p>
      </footer>
    </div>
  );
}

export default App;
