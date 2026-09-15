const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

let db = null;
let isFirestoreActive = false;

// Path to local backup cache (used if serviceAccountKey.json is not configured yet)
const LOCAL_CACHE_DIR = path.join(__dirname, 'data');
const LOCAL_CACHE_FILE = path.join(LOCAL_CACHE_DIR, 'movies.json');

function initDatabase() {
  const serviceKeyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, 'serviceAccountKey.json');

  try {
    if (fs.existsSync(serviceKeyPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceKeyPath, 'utf8'));
      if (serviceAccount.project_id && !serviceAccount.project_id.includes('YOUR_')) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        isFirestoreActive = true;
        console.log(`[Firebase] Successfully connected to Firestore project: ${serviceAccount.project_id}`);
        return;
      }
    }

    // Attempt default application credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
      db = admin.firestore();
      isFirestoreActive = true;
      console.log('[Firebase] Connected to Firestore via GOOGLE_APPLICATION_CREDENTIALS');
      return;
    }

    console.warn('[Firebase] Warning: serviceAccountKey.json not detected or contains placeholder values.');
    console.warn('[Firebase] Operating in Local Hybrid Mode (data stored in /data/movies.json).');
    console.warn('[Firebase] To connect to live Firestore, download serviceAccountKey.json from Firebase Console.');
  } catch (error) {
    console.error('[Firebase] Initialization error:', error.message);
  }
}

// Initialize on module load
initDatabase();

// Ensure local directory exists
if (!fs.existsSync(LOCAL_CACHE_DIR)) {
  fs.mkdirSync(LOCAL_CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(LOCAL_CACHE_FILE)) {
  fs.writeFileSync(LOCAL_CACHE_FILE, JSON.stringify([]), 'utf8');
}

function getLocalMovies() {
  try {
    const raw = fs.readFileSync(LOCAL_CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveLocalMovies(movies) {
  fs.writeFileSync(LOCAL_CACHE_FILE, JSON.stringify(movies, null, 2), 'utf8');
}

/**
 * Check if a movie already exists in the database by title and year (Deduplication)
 */
async function movieExists(title, year) {
  const cleanTitle = (title || '').trim().toLowerCase();
  const movieYear = parseInt(year, 10) || null;

  if (isFirestoreActive && db) {
    try {
      const snapshot = await db.collection('movies')
        .where('titleLower', '==', cleanTitle)
        .limit(1)
        .get();

      if (!snapshot.empty) return true;

      // Fallback query by standard title
      const standardSnapshot = await db.collection('movies')
        .where('title', '==', title.trim())
        .limit(1)
        .get();

      return !standardSnapshot.empty;
    } catch (e) {
      console.error('[DB] Firestore query error:', e.message);
    }
  }

  // Local deduplication check
  const localMovies = getLocalMovies();
  return localMovies.some(m => 
    m.title && m.title.trim().toLowerCase() === cleanTitle && 
    (!movieYear || m.year === movieYear)
  );
}

/**
 * Save movie into the 'movies' collection
 * Schema: { title, description, posterUrl, year, rating, genres, embedUrl, createdAt }
 */
async function saveMovie(movieData) {
  const payload = {
    title: movieData.title ? movieData.title.trim() : 'Untitled',
    titleLower: movieData.title ? movieData.title.trim().toLowerCase() : 'untitled',
    description: movieData.description || 'No overview available.',
    posterUrl: movieData.posterUrl || '',
    backdropUrl: movieData.backdropUrl || movieData.posterUrl || '',
    year: parseInt(movieData.year, 10) || new Date().getFullYear(),
    rating: parseFloat(movieData.rating) || 7.0,
    genres: Array.isArray(movieData.genres) ? movieData.genres : ['Action'],
    embedUrl: movieData.embedUrl || '',
    language: movieData.language || 'en',
    category: movieData.category || 'General',
    sourceUrl: movieData.sourceUrl || '',
    createdAt: movieData.createdAt || new Date().toISOString()
  };

  let savedId = null;

  if (isFirestoreActive && db) {
    try {
      const docRef = await db.collection('movies').add(payload);
      savedId = docRef.id;
    } catch (e) {
      console.error('[DB] Firestore insert error:', e.message);
    }
  }

  // Also maintain local cache for fast offline serving and backup
  const localList = getLocalMovies();
  const localEntry = { id: savedId || 'loc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), ...payload };
  localList.unshift(localEntry);
  saveLocalMovies(localList);

  return localEntry;
}

/**
 * Fetch movies with pagination, search, genre, and language filtering
 */
async function getMovies({ page = 1, limit = 24, genre = '', search = '', sort = 'latest', language = '' } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, parseInt(limit, 10));

  let results = [];
  let total = 0;

  if (isFirestoreActive && db) {
    try {
      let query = db.collection('movies');

      if (language) {
        query = query.where('language', '==', language);
      }

      if (genre && genre !== 'All') {
        query = query.where('genres', 'array-contains', genre);
      }

      const snapshot = await query.get();
      let allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // In-memory filter for search and sort
      if (search) {
        const s = search.toLowerCase();
        allDocs = allDocs.filter(m => 
          (m.title && m.title.toLowerCase().includes(s)) ||
          (m.description && m.description.toLowerCase().includes(s))
        );
      }

      if (sort === 'rating') {
        allDocs.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else if (sort === 'year') {
        allDocs.sort((a, b) => (b.year || 0) - (a.year || 0));
      } else {
        allDocs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }

      total = allDocs.length;
      const startIndex = (pageNum - 1) * limitNum;
      results = allDocs.slice(startIndex, startIndex + limitNum);

      return { movies: results, total, page: pageNum, totalPages: Math.ceil(total / limitNum) };
    } catch (e) {
      console.error('[DB] Firestore fetch error, falling back to local:', e.message);
    }
  }

  // Fallback to local storage
  let list = getLocalMovies();

  if (language) {
    list = list.filter(m => m.language === language);
  }

  if (genre && genre !== 'All') {
    list = list.filter(m => Array.isArray(m.genres) && m.genres.includes(genre));
  }

  if (search) {
    const s = search.toLowerCase();
    list = list.filter(m => 
      (m.title && m.title.toLowerCase().includes(s)) ||
      (m.description && m.description.toLowerCase().includes(s))
    );
  }

  if (sort === 'rating') {
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sort === 'year') {
    list.sort((a, b) => (b.year || 0) - (a.year || 0));
  } else {
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  total = list.length;
  const start = (pageNum - 1) * limitNum;
  results = list.slice(start, start + limitNum);

  return { movies: results, total, page: pageNum, totalPages: Math.ceil(total / limitNum) };
}

/**
 * Fetch a single movie by ID
 */
async function getMovieById(id) {
  if (!id) return null;

  if (isFirestoreActive && db) {
    try {
      const doc = await db.collection('movies').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
    } catch (e) {
      console.error('[DB] Firestore get by id error:', e.message);
    }
  }

  const list = getLocalMovies();
  return list.find(m => m.id === id) || null;
}

module.exports = {
  db,
  isFirestoreActive: () => isFirestoreActive,
  movieExists,
  saveMovie,
  getMovies,
  getMovieById,
  getLocalMovies
};
