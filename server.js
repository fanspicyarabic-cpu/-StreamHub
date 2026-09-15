const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { getMovies, getMovieById, isFirestoreActive } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Read template for watch page SSR meta tag injection
const watchTemplatePath = path.join(__dirname, 'public', 'watch.html');

/**
 * Dynamic SSR Route for Watch Page with Open Graph & Twitter Cards for X sharing
 */
app.get('/watch/:id', async (req, res) => {
  try {
    const movieId = req.params.id;
    const movie = await getMovieById(movieId);

    if (!fs.existsSync(watchTemplatePath)) {
      return res.status(404).send('Watch template not found');
    }

    let html = fs.readFileSync(watchTemplatePath, 'utf8');

    if (movie) {
      const siteUrl = `${req.protocol}://${req.get('host')}`;
      const canonicalUrl = `${siteUrl}/watch/${movie.id}`;
      const cleanDesc = (movie.description || '').replace(/"/g, '&quot;').substring(0, 200);
      const moviePoster = movie.backdropUrl || movie.posterUrl || `${siteUrl}/img/default-poster.jpg`;
      const movieTitle = `${movie.title} (${movie.year}) - Watch Full Movie Online Free HD | StreamHub`;

      // Replace SEO & Open Graph Meta Tags
      html = html
        .replace(/<title>.*?<\/title>/, `<title>${movieTitle}</title>`)
        .replace(/__OG_TITLE__/g, `${movie.title} (${movie.year}) - StreamHub HD`)
        .replace(/__OG_DESC__/g, cleanDesc)
        .replace(/__OG_IMAGE__/g, moviePoster)
        .replace(/__OG_URL__/g, canonicalUrl)
        .replace(/__TWITTER_TITLE__/g, `Watch ${movie.title} (${movie.year}) Online Free HD`)
        .replace(/__TWITTER_DESC__/g, cleanDesc)
        .replace(/__TWITTER_IMAGE__/g, moviePoster)
        .replace(/__MOVIE_ID__/g, movie.id)
        .replace(/__MOVIE_DATA__/g, JSON.stringify(movie).replace(/</g, '\\u003c'));
    } else {
      html = html
        .replace(/__OG_TITLE__/g, 'Watch Movies Online Free HD - StreamHub')
        .replace(/__OG_DESC__/g, 'Stream top foreign movies in HD with fast streaming and subtitles.')
        .replace(/__OG_IMAGE__/g, '/img/default-poster.jpg')
        .replace(/__OG_URL__/g, `${req.protocol}://${req.get('host')}/`)
        .replace(/__TWITTER_TITLE__/g, 'StreamHub - Free Movies')
        .replace(/__TWITTER_DESC__/g, 'Watch thousands of foreign movies in HD.')
        .replace(/__TWITTER_IMAGE__/g, '/img/default-poster.jpg')
        .replace(/__MOVIE_ID__/g, '')
        .replace(/__MOVIE_DATA__/g, 'null');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error) {
    console.error('[Server] Error rendering watch page:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * API: Get Movies with pagination, search, genre, sort
 */
app.get('/api/movies', async (req, res) => {
  try {
    const { page = 1, limit = 24, genre = '', search = '', sort = 'latest', language = '' } = req.query;
    const data = await getMovies({ page, limit, genre, search, sort, language });
    res.json({
      success: true,
      ...data,
      isFirestoreActive: isFirestoreActive()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * API: Get Single Movie by ID
 */
app.get('/api/movies/:id', async (req, res) => {
  try {
    const movie = await getMovieById(req.params.id);
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    res.json({ success: true, movie });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * API: Get Spotlight / Hero Movie
 */
app.get('/api/featured', async (req, res) => {
  try {
    const { movies } = await getMovies({ page: 1, limit: 10, sort: 'rating' });
    const featured = movies && movies.length > 0 ? movies[0] : null;
    res.json({ success: true, movie: featured });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * API: Get Genres List
 */
app.get('/api/genres', (req, res) => {
  const genres = [
    'All',
    'Action',
    'Adventure',
    'Animation',
    'Comedy',
    'Crime',
    'Drama',
    'Fantasy',
    'Horror',
    'Mystery',
    'Romance',
    'Sci-Fi',
    'Thriller',
    'Western'
  ];
  res.json({ success: true, genres });
});

/**
 * API: Adsterra Direct Link & Config
 */
app.get('/api/ad-config', (req, res) => {
  res.json({
    directLink: process.env.ADSTERRA_DIRECT_LINK || 'https://www.highperformancegate.com/your-adsterra-direct-link-id',
    popunderEnabled: true,
    socialBarEnabled: true
  });
});

/**
 * API: Stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    const { total } = await getMovies({ page: 1, limit: 1 });
    res.json({
      success: true,
      totalMovies: total,
      storage: isFirestoreActive() ? 'Firebase Firestore' : 'Local Hybrid Cache',
      adsterraReady: true
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server if run directly
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🎬 StreamHub Cinema Web Server running on:`);
    console.log(`   👉 http://localhost:${PORT}`);
    console.log(`[Firestore] Database active: ${isFirestoreActive() ? 'YES (Cloud Firestore)' : 'NO (Using local cache in /data)'}`);
    console.log(`[Monetization] Adsterra placements loaded and ready.`);
    console.log('====================================================');
  });
}

module.exports = app;
