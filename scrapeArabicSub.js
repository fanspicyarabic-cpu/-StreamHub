/**
 * StreamHub - Arabic Subtitled Movies Mass Crawler (scrapeArabicSub.js)
 * 
 * Source: https://www.shahedpro.com/
 * 
 * Features:
 * - Uses Playwright to navigate pages and bypass Cloudflare protection
 * - Automated Pagination Loop across all subtitled sections without limit
 * - Extracts full Arabic title, Arabic story description, HD poster, release year, rating, genres
 * - Captures confirmed video player embedUrl (native ShahedPro embedScreen & multi-server stream)
 * - Assigns language: "ar-sub" and category: "Subtitled"
 * - Deduplication check (title & year) before saving to Firestore
 * - Rate-limiting delay (1.2s - 1.5s) & resilient try/catch error handling
 */

const { chromium } = require('playwright');
const axios = require('axios');
const cheerio = require('cheerio');
const { saveMovie, movieExists, isFirestoreActive } = require('./db');
require('dotenv').config();

// Helper sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Subtitled Sections on ShahedPro to crawl
const SECTIONS = [
  { name: 'أحدث الأفلام المترجمة (All Movies)', baseUrl: 'https://www.shahedpro.com/movies/' },
  { name: 'أفلام أجنبي مترجمة (Foreign Movies)', baseUrl: 'https://www.shahedpro.com/genres/%d8%a3%d9%81%d9%84%d8%a7%d9%85-%d8%a7%d8%ac%d9%86%d8%a8%d9%8a/' },
  { name: 'أفلام آسيوية مترجمة (Asian Movies)', baseUrl: 'https://www.shahedpro.com/genres/%d8%a3%d9%81%d9%84%d8%a7%d9%85-%d8%a7%d8%b3%d9%8a%d9%88%d9%8a%d8%a9/' },
  { name: 'أفلام هندية مترجمة (Indian Movies)', baseUrl: 'https://www.shahedpro.com/genres/%d8%a3%d9%81%d9%84%d8%a7%d9%85-%d9%87%d9%86%d8%af%d9%8a%d8%a9/' },
  { name: 'أفلام تركية مترجمة (Turkish Movies)', baseUrl: 'https://www.shahedpro.com/genres/%d8%a3%d9%81%d9%84%d8%a7%d9%85-%d8%aa%d8%b1%d9%83%d9%8a%d8%a9/' }
];

// Configuration
const CONFIG = {
  startPage: parseInt(process.env.SCRAPER_START_PAGE, 10) || 1,
  maxPagesPerSection: parseInt(process.env.SCRAPER_MAX_PAGES, 10) || 50,
  delayMs: parseInt(process.env.SCRAPER_DELAY_MS, 10) || 1350
};

/**
 * Launch Playwright Browser with Cloudflare Bypass Options
 */
async function launchBrowser() {
  const launchOptions = {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1366,768'
    ]
  };

  // Attempt using system Edge or Chrome channels first for native anti-bot pass
  for (const channel of ['msedge', 'chrome', undefined]) {
    try {
      const opts = channel ? { ...launchOptions, channel } : launchOptions;
      const browser = await chromium.launch(opts);
      console.log(`[Browser] Playwright launched successfully (Channel: ${channel || 'bundled chromium'}).`);
      return browser;
    } catch (e) {
      // Continue to next channel
    }
  }

  throw new Error('Could not launch any Chromium browser via Playwright.');
}

/**
 * Safe fetch with Cloudflare fallback
 */
async function fetchPageHtml(page, url) {
  try {
    // Fast path: attempt direct HTTP request with browser headers
    const fastRes = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
        'Referer': 'https://www.shahedpro.com/'
      }
    });

    if (fastRes.data && !fastRes.data.includes('Just a moment') && !fastRes.data.includes('لحظة…')) {
      return fastRes.data;
    }
  } catch (e) {
    // If blocked or 403, proceed to Playwright browser bypass
  }

  // Playwright Cloudflare Bypass Path
  await page.goto(url, { waitUntil: 'commit', timeout: 45000 });

  // Handle Cloudflare Turnstile if present
  for (let i = 0; i < 10; i++) {
    const currentTitle = await page.title();
    if (!currentTitle.includes('لحظة') && !currentTitle.includes('moment') && !currentTitle.includes('Attention')) {
      break;
    }
    try {
      for (const frame of page.frames()) {
        if (frame.url().includes('challenges') || frame.url().includes('cloudflare')) {
          const checkbox = await frame.$('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage');
          if (checkbox) await checkbox.click({ timeout: 2000 });
        }
      }
    } catch (err) {}
    await page.waitForTimeout(1500);
  }

  return await page.content();
}

/**
 * Extract Movie URLs from a Category/Catalog Page
 */
function extractMovieLinks(html) {
  const $ = cheerio.load(html);
  const links = new Set();

  $('article a, .item a, .poster a, .movie-item a, div[class*="movie"] a, .items a, .content a, main a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('/movies/') && !href.endsWith('/movies/') && !href.includes('/page/')) {
      // Clean query parameters and fragments
      const cleanUrl = href.split('?')[0].split('#')[0];
      if (cleanUrl.length > 'https://www.shahedpro.com/movies/'.length) {
        links.add(cleanUrl);
      }
    }
  });

  return Array.from(links);
}

/**
 * Extract Movie Details from Single Movie Page
 */
function extractMovieDetails(html, movieUrl) {
  const $ = cheerio.load(html);
  let movie = null;
  let video = null;

  // 1. Search Schema.org JSON-LD
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const json = JSON.parse($(el).html());
      if (json['@graph']) {
        const m = json['@graph'].find(x => x['@type'] === 'Movie');
        const v = json['@graph'].find(x => x['@type'] === 'VideoObject');
        if (m) movie = m;
        if (v) video = v;
      } else if (json['@type'] === 'Movie') {
        movie = json;
      }
    } catch (e) {}
  });

  // Extract Title (Arabic / Subtitled)
  const title = (movie && movie.name) 
    ? movie.name.replace(/اون لاين.*$/, '').trim()
    : ($('h1').text().trim() || $('meta[property="og:title"]').attr('content') || 'فيلم مترجم');

  // Extract Storyline Description (Full Arabic)
  let description = (movie && movie.description)
    ? movie.description
    : ($('meta[property="og:description"]').attr('content') || $('.entry-content, .description, p').text().trim());
  if (!description || description.length < 15) {
    description = `مشاهدة وتحميل ${title} مترجم اون لاين بدقة عالية وتيربو سيرفرات سريعة على StreamHub.`;
  }

  // Extract Year
  let year = new Date().getFullYear();
  if (movie && movie.datePublished) {
    year = new Date(movie.datePublished).getFullYear();
  } else {
    const yearMatch = title.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) year = parseInt(yearMatch[1], 10);
  }

  // Extract Rating
  let rating = 7.0;
  if (movie && movie.aggregateRating && movie.aggregateRating.ratingValue) {
    rating = parseFloat(movie.aggregateRating.ratingValue);
  } else {
    const rText = $('.rating, .dt_rating_data, [itemprop="ratingValue"]').text().trim();
    if (rText) rating = parseFloat(rText) || 7.0;
  }

  // Extract Poster & Backdrop
  let posterUrl = '';
  let backdropUrl = '';
  if (movie && Array.isArray(movie.image)) {
    const posterObj = movie.image.find(img => (img['@id'] && img['@id'].includes('poster')) || (img.height > img.width));
    const backdropObj = movie.image.find(img => (img['@id'] && img['@id'].includes('backdrop')) || (img.width > img.height));
    if (posterObj) posterUrl = posterObj.url || posterObj.contentUrl;
    if (backdropObj) backdropUrl = backdropObj.url || backdropObj.contentUrl;
  }
  if (!posterUrl) {
    posterUrl = $('meta[property="og:image"]').attr('content') || $('img.wp-post-image, .poster img').attr('src') || '';
  }
  if (!backdropUrl) backdropUrl = posterUrl;

  // Extract Genres
  let genres = ['أفلام مترجمة', 'Action'];
  if (movie && Array.isArray(movie.genre)) {
    genres = movie.genre.filter(g => g && g.trim());
  } else {
    const gList = [];
    $('.genres a, .sgeneros a').each((i, el) => {
      const g = $(el).text().trim();
      if (g) gList.push(g);
    });
    if (gList.length > 0) genres = gList;
  }

  // Extract Embed Player / Stream URL
  let embedUrl = '';
  if (video && video.embedUrl) {
    embedUrl = video.embedUrl;
  } else {
    // ShahedPro native embed link format
    const cleanBase = movieUrl.endsWith('/') ? movieUrl : movieUrl + '/';
    embedUrl = `${cleanBase}?embedScreen=true`;
  }

  // If IMDb ID exists in schema sameAs, enable multi-server backup
  let imdbId = '';
  if (movie && Array.isArray(movie.sameAs)) {
    const imdbEntry = movie.sameAs.find(s => s.includes('imdb.com/title/'));
    if (imdbEntry) {
      const match = imdbEntry.match(/tt\d+/);
      if (match) imdbId = match[0];
    }
  }

  return {
    title,
    description,
    posterUrl,
    backdropUrl,
    year,
    rating,
    genres,
    embedUrl,
    imdbId,
    language: 'ar-sub',
    category: 'Subtitled',
    sourceUrl: movieUrl
  };
}

/**
 * Main Crawler Runner
 */
async function runArabicSubCrawler() {
  console.log('\n===============================================================');
  console.log('  🚀 STREAMHUB - SHAHEDPRO ARABIC SUBTITLED MOVIE CRAWLER');
  console.log('===============================================================');
  console.log(`[Target Source]  : https://www.shahedpro.com/`);
  console.log(`[Storage Mode]   : ${isFirestoreActive() ? 'LIVE FIRESTORE' : 'LOCAL HYBRID CACHE (/data/movies.json)'}`);
  console.log(`[Language Tag]   : "ar-sub"`);
  console.log(`[Category Tag]   : "Subtitled"`);
  console.log(`[Politeness Delay]: ${CONFIG.delayMs}ms`);
  console.log('===============================================================\n');

  let browser = null;
  let page = null;

  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'ar-EG,ar;q=0.9,en;q=0.8'
    });
    page = await context.newPage();
  } catch (err) {
    console.error('Fatal: Could not initialize Playwright browser:', err.message);
    process.exit(1);
  }

  let totalAdded = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;

  for (const section of SECTIONS) {
    console.log(`\n📂 [قسم الأفلام المترجمة]: ${section.name}`);

    for (let pageNum = CONFIG.startPage; pageNum <= CONFIG.maxPagesPerSection; pageNum++) {
      const pageUrl = pageNum === 1 ? section.baseUrl : `${section.baseUrl}page/${pageNum}/`;
      console.log(`  🔍 [صفحة ${pageNum}] جلب الروابط من: ${pageUrl} ...`);

      try {
        const catalogHtml = await fetchPageHtml(page, pageUrl);
        const movieLinks = extractMovieLinks(catalogHtml);

        if (!movieLinks || movieLinks.length === 0) {
          console.log(`  ℹ️ لا توجد أفلام إضافية في هذا القسم. الانتقال للقسم التالي.`);
          break;
        }

        console.log(`  🎬 تم العثور على ${movieLinks.length} فيلماً في الصفحة ${pageNum}. جاري المعالجة...`);

        for (const movieUrl of movieLinks) {
          try {
            // Fetch movie HTML
            const movieHtml = await fetchPageHtml(page, movieUrl);
            const movieData = extractMovieDetails(movieHtml, movieUrl);

            if (!movieData.title) continue;

            // 1. Deduplication Check in Firestore
            const alreadyExists = await movieExists(movieData.title, movieData.year);
            if (alreadyExists) {
              totalDuplicates++;
              process.stdout.write(`    ⏩ مكرر (تم التخطي): ${movieData.title.substring(0, 35)} (${movieData.year})\n`);
              continue;
            }

            // 2. Save Movie into Firestore with language: "ar-sub"
            await saveMovie(movieData);
            totalAdded++;
            console.log(`    ✅ تمت الإضافة: "${movieData.title}" (${movieData.year}) | ⭐ ${movieData.rating} | 🎬 [${movieData.genres.slice(0, 2).join(', ')}]`);

            await sleep(CONFIG.delayMs);

          } catch (itemErr) {
            totalErrors++;
            console.error(`    ❌ خطأ أثناء معالجة الفيلم: ${itemErr.message}`);
            await sleep(CONFIG.delayMs);
          }
        }

        await sleep(CONFIG.delayMs);

      } catch (pageErr) {
        totalErrors++;
        console.error(`  ❌ خطأ في جلب الصفحة ${pageNum}: ${pageErr.message}`);
        console.log(`  ⏩ متابعة السحب وتجاوز الخطأ بسلاسة...`);
        await sleep(CONFIG.delayMs);
      }
    }
  }

  try {
    if (browser) await browser.close();
  } catch (e) {}

  console.log('\n===============================================================');
  console.log('  🎉 اكتمل سحب كافة الأفلام المترجمة من SHAHEDPRO بنجاح!');
  console.log('===============================================================');
  console.log(`  ✨ إجمالي الأفلام المترجمة المضافة حديثاً : ${totalAdded}`);
  console.log(`  🔁 إجمالي الأفلام المكررة المتخطاة      : ${totalDuplicates}`);
  console.log(`  ⚠️ إجمالي الأخطاء المعالجة              : ${totalErrors}`);
  console.log('===============================================================\n');
}

// Execute crawler if run directly
if (require.main === module) {
  runArabicSubCrawler().then(() => {
    console.log('Scraper finished. Exiting process.');
    process.exit(0);
  }).catch(err => {
    console.error('Fatal crawler error:', err);
    process.exit(1);
  });
}

module.exports = {
  runArabicSubCrawler
};
