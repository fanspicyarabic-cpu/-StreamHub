/**
 * StreamHub - Main Frontend Application Logic
 */

let appState = {
  page: 1,
  limit: 24,
  genre: 'All',
  language: '',
  search: '',
  sort: 'latest',
  totalPages: 1,
  totalMovies: 0
};

// Search debounce timer
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  fetchFeaturedMovie();
  loadMovies();
});

function initUI() {
  // Set copyright year
  const yearElem = document.getElementById('currentYear');
  if (yearElem) yearElem.textContent = new Date().getFullYear();

  // Desktop Search
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      const val = e.target.value.trim();
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('hidden', val.length === 0);
      }
      searchDebounceTimer = setTimeout(() => {
        appState.search = val;
        appState.page = 1;
        loadMovies();
      }, 350);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      appState.search = '';
      appState.page = 1;
      loadMovies();
    });
  }

  // Mobile Search
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        appState.search = e.target.value.trim();
        appState.page = 1;
        loadMovies();
      }, 350);
    });
  }

  // Subtitled Filter Handlers (Header button and Genres bar pill)
  const headerSubtitledBtn = document.getElementById('headerSubtitledBtn');
  const genreSubtitledBtn = document.getElementById('genreSubtitledBtn');

  function toggleSubtitledFilter() {
    if (appState.language === 'ar-sub') {
      appState.language = '';
      if (headerSubtitledBtn) {
        headerSubtitledBtn.className = 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-brand-red hover:from-amber-500 hover:to-red-600 shadow-md shadow-brand-red/20 transition-all duration-300 transform hover:-translate-y-0.5';
      }
      if (genreSubtitledBtn) {
        genreSubtitledBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold shrink-0 bg-gradient-to-r from-amber-600 to-brand-red text-white shadow-md flex items-center gap-1.5 hover:brightness-110 transition-all';
      }
    } else {
      appState.language = 'ar-sub';
      appState.genre = 'All';
      if (headerSubtitledBtn) {
        headerSubtitledBtn.className = 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-brand-red ring-2 ring-brand-gold shadow-lg shadow-brand-red/40 transition-all duration-300';
      }
      if (genreSubtitledBtn) {
        genreSubtitledBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold shrink-0 bg-brand-red text-white shadow-md flex items-center gap-1.5 ring-2 ring-brand-gold';
      }
      // Reset genre pills highlights
      document.querySelectorAll('.genre-pill').forEach(p => {
        p.className = 'genre-pill px-4 py-2 rounded-xl text-xs font-semibold shrink-0 bg-brand-card hover:bg-brand-red hover:text-white border border-brand-border text-gray-300 transition-all';
      });
    }
    appState.page = 1;
    loadMovies();
    scrollToGrid();
  }

  if (headerSubtitledBtn) headerSubtitledBtn.addEventListener('click', toggleSubtitledFilter);
  if (genreSubtitledBtn) genreSubtitledBtn.addEventListener('click', toggleSubtitledFilter);

  // Genre Filter Pills
  document.querySelectorAll('.genre-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.genre-pill').forEach(p => {
        p.className = 'genre-pill px-4 py-2 rounded-xl text-xs font-semibold shrink-0 bg-brand-card hover:bg-brand-red hover:text-white border border-brand-border text-gray-300 transition-all';
      });
      pill.className = 'genre-pill px-4 py-2 rounded-xl text-xs font-bold shrink-0 bg-brand-red text-white shadow-md';

      appState.genre = pill.dataset.genre || 'All';
      appState.page = 1;
      loadMovies();
    });
  });

  // Sort Buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => {
        b.className = 'sort-btn px-3 py-1.5 rounded-lg bg-brand-card hover:bg-[#1c2233] text-gray-300 font-semibold border border-brand-border transition-all';
      });
      btn.className = 'sort-btn px-3 py-1.5 rounded-lg bg-brand-red text-white font-semibold transition-all';

      appState.sort = btn.dataset.sort || 'latest';
      appState.page = 1;
      loadMovies();
    });
  });

  // Pagination Buttons
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (appState.page > 1) {
        appState.page--;
        loadMovies();
        scrollToGrid();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (appState.page < appState.totalPages) {
        appState.page++;
        loadMovies();
        scrollToGrid();
      }
    });
  }

  // Reset Filters
  const resetBtn = document.getElementById('resetFiltersBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (mobileSearchInput) mobileSearchInput.value = '';
      appState.search = '';
      appState.genre = 'All';
      appState.language = '';
      appState.sort = 'latest';
      if (headerSubtitledBtn) {
        headerSubtitledBtn.className = 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-brand-red hover:from-amber-500 hover:to-red-600 shadow-md shadow-brand-red/20 transition-all duration-300 transform hover:-translate-y-0.5';
      }
      appState.page = 1;
      loadMovies();
    });
  }
}

function scrollToGrid() {
  const grid = document.getElementById('moviesGrid');
  if (grid) {
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Fetch Hero Featured Spotlight Movie
 */
async function fetchFeaturedMovie() {
  try {
    const res = await fetch('/api/featured');
    const data = await res.json();
    if (data.success && data.movie) {
      const m = data.movie;
      const titleElem = document.getElementById('heroTitle');
      const descElem = document.getElementById('heroDescription');
      const yearElem = document.getElementById('heroYear');
      const ratingElem = document.getElementById('heroRating');
      const backdropElem = document.getElementById('heroBackdrop');
      const watchBtn = document.getElementById('heroWatchBtn');

      if (titleElem) titleElem.textContent = m.title;
      if (descElem) descElem.textContent = m.description;
      if (yearElem) yearElem.textContent = m.year;
      if (ratingElem) ratingElem.innerHTML = `<i class="fa-solid fa-star text-brand-gold text-[10px]"></i> ${m.rating}`;
      if (backdropElem) backdropElem.style.backgroundImage = `url('${m.backdropUrl || m.posterUrl}')`;
      if (watchBtn) watchBtn.href = `/watch/${m.id}`;
    }
  } catch (err) {
    console.error('Error fetching featured movie:', err);
  }
}

/**
 * Fetch Movies Grid
 */
async function loadMovies() {
  const loading = document.getElementById('gridLoading');
  const grid = document.getElementById('moviesGrid');
  const empty = document.getElementById('emptyState');
  const pagination = document.getElementById('paginationSection');
  const countBadge = document.getElementById('movieCountBadge');

  if (loading) loading.classList.remove('hidden');
  if (grid) grid.classList.add('hidden');
  if (empty) empty.classList.add('hidden');
  if (pagination) pagination.classList.add('hidden');

  try {
    const queryParams = new URLSearchParams({
      page: appState.page,
      limit: appState.limit,
      genre: appState.genre,
      language: appState.language,
      search: appState.search,
      sort: appState.sort
    });

    const res = await fetch(`/api/movies?${queryParams}`);
    const data = await res.json();

    if (loading) loading.classList.add('hidden');

    if (data.success && Array.isArray(data.movies) && data.movies.length > 0) {
      appState.totalPages = data.totalPages || 1;
      appState.totalMovies = data.total || 0;

      if (countBadge) {
        countBadge.textContent = `${appState.totalMovies} Movies`;
      }

      renderMovieGrid(data.movies);
      updatePaginationControls();

      if (grid) grid.classList.remove('hidden');
      if (pagination && appState.totalPages > 1) pagination.classList.remove('hidden');
    } else {
      if (empty) empty.classList.remove('hidden');
      if (countBadge) countBadge.textContent = '0 Movies';
    }
  } catch (error) {
    console.error('Error loading movies:', error);
    if (loading) loading.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
  }
}

/**
 * Render Movie Cards with Embedded Adsterra In-Grid Native Banner
 */
function renderMovieGrid(movies) {
  const grid = document.getElementById('moviesGrid');
  if (!grid) return;

  grid.innerHTML = '';

  movies.forEach((movie, index) => {
    // Inject a native high-CTR Adsterra Card at index 4 (middle of row 1/2)
    if (index === 4) {
      const adCard = document.createElement('div');
      adCard.className = 'movie-card relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#181d2a] to-[#0d1017] border border-brand-gold/40 flex flex-col items-center justify-between p-4 text-center shadow-lg group';
      adCard.innerHTML = `
        <div class="w-full flex items-center justify-between">
          <span class="text-[10px] font-mono uppercase tracking-wider text-brand-gold font-bold">SPONSORED</span>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-red text-white uppercase">HOT</span>
        </div>
        
        <div class="my-3 space-y-2">
          <div class="w-12 h-12 rounded-full bg-brand-red/20 text-brand-red flex items-center justify-center mx-auto text-xl animate-bounce">
            <i class="fa-solid fa-bolt"></i>
          </div>
          <h4 class="text-xs font-bold text-white leading-tight">Instant 4K VIP Cinema Stream</h4>
          <p class="text-[11px] text-gray-400">Zero Ads • No Waiting • 1080p</p>
        </div>

        <a href="#" class="adsterra-direct-link w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-brand-red text-white text-xs font-bold tracking-wide shadow-md hover:brightness-110">
          PLAY VIP <i class="fa-solid fa-play ml-1 text-[10px]"></i>
        </a>
      `;
      grid.appendChild(adCard);
    }

    const card = document.createElement('div');
    card.className = 'movie-card group relative rounded-2xl overflow-hidden bg-brand-card border border-brand-border/60 hover:border-brand-red/60 transition-all duration-300 flex flex-col';

    const poster = movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80';
    const primaryGenre = Array.isArray(movie.genres) && movie.genres.length > 0 ? movie.genres[0] : 'Action';

    card.innerHTML = `
      <!-- Poster Container with Overlay -->
      <a href="/watch/${movie.id}" class="relative block aspect-[2/3] w-full overflow-hidden bg-black">
        <img 
          src="${poster}" 
          alt="${movie.title}"
          loading="lazy"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80'"
        >

        <!-- Rating & Quality Badges -->
        <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10 flex-wrap">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/75 text-brand-gold border border-brand-gold/40 backdrop-blur-md flex items-center gap-1">
            <i class="fa-solid fa-star text-[9px]"></i> ${movie.rating || 7.0}
          </span>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-red text-white uppercase tracking-wider">
            HD
          </span>
          ${movie.language === 'ar-sub' ? `
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-600 text-white uppercase tracking-wider flex items-center gap-1 shadow">
            <i class="fa-solid fa-closed-captioning"></i> مترجم
          </span>` : ''}
        </div>

        <!-- Release Year -->
        <div class="absolute top-2.5 right-2.5 z-10">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/75 text-gray-300 border border-white/10 backdrop-blur-md">
            ${movie.year || 2024}
          </span>
        </div>

        <!-- Hover Play Overlay Button -->
        <div class="play-overlay absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20">
          <div class="w-12 h-12 rounded-full bg-brand-red text-white flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
            <i class="fa-solid fa-play ml-0.5 text-base"></i>
          </div>
        </div>
      </a>

      <!-- Movie Card Info -->
      <div class="p-3.5 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-brand-red block mb-1">
            ${primaryGenre}
          </span>
          <a href="/watch/${movie.id}" class="block">
            <h3 class="font-outfit text-sm font-bold text-white group-hover:text-brand-red transition-colors line-clamp-1 leading-snug" title="${movie.title}">
              ${movie.title}
            </h3>
          </a>
        </div>

        <!-- Quick Direct Link CTA -->
        <div class="pt-2 border-t border-brand-border/40 flex items-center justify-between">
          <a href="/watch/${movie.id}" class="text-xs font-semibold text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
            <span>Watch</span> <i class="fa-solid fa-chevron-right text-[9px]"></i>
          </a>
          <a href="#" class="adsterra-direct-link text-[11px] font-bold text-brand-gold hover:underline flex items-center gap-1">
            <i class="fa-solid fa-download text-[10px]"></i> 1080p
          </a>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  // Re-bind direct link listeners
  if (window.AdManager) {
    window.AdManager.bindDirectLinks();
  }
}

/**
 * Update pagination UI
 */
function updatePaginationControls() {
  const curr = document.getElementById('currentPageNum');
  const total = document.getElementById('totalPagesNum');
  const prev = document.getElementById('prevPageBtn');
  const next = document.getElementById('nextPageBtn');

  if (curr) curr.textContent = appState.page;
  if (total) total.textContent = appState.totalPages;

  if (prev) prev.disabled = (appState.page <= 1);
  if (next) next.disabled = (appState.page >= appState.totalPages);
}
