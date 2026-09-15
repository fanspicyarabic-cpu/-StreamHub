const { TwitterApi } = require('twitter-api-v2');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Twitter API Credentials
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || "fhGoRryd6hINE3aqW0EFauABg";
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || "6cnRTsA2BygzQVA512rwR2vqgZF44SQjyDHRcjqhdaVN2YXLgd";
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || "2099777594702929920-1xDXMaInKrcQLqABq55kK46vLEWiB6";
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || "pTKSj521ZgpYqUiCDc85MmoHNUpQhg8VN4C1TnY4DY1FW";

/**
 * Robust Multi-tier Movie Fetcher:
 * 1. Try Live Production API
 * 2. Try Firestore DB module
 * 3. Try Local data/movies.json
 */
async function getRandomMovie() {
  // Tier 1: Fetch from live production API
  try {
    const apiRes = await axios.get('https://streamhub-rosy.vercel.app/api/movies?limit=100', { timeout: 8000 });
    if (apiRes.data && apiRes.data.movies && apiRes.data.movies.length > 0) {
      const list = apiRes.data.movies;
      console.log(`[Twitter Bot] Fetched ${list.length} movies from live API.`);
      return list[Math.floor(Math.random() * list.length)];
    }
  } catch (err) {
    console.warn('[Twitter Bot] Live API fetch skipped or unreachable:', err.message);
  }

  // Tier 2: Fetch via internal db.js
  try {
    const { getMovies } = require('../db');
    const result = await getMovies({ page: 1, limit: 100 });
    if (result && result.movies && result.movies.length > 0) {
      console.log(`[Twitter Bot] Fetched ${result.movies.length} movies via DB module.`);
      return result.movies[Math.floor(Math.random() * result.movies.length)];
    }
  } catch (err) {
    console.warn('[Twitter Bot] DB module fetch error:', err.message);
  }

  // Tier 3: Fetch directly from local JSON cache file
  try {
    const localPath = path.resolve(__dirname, '..', 'data', 'movies.json');
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        console.log(`[Twitter Bot] Fetched from local JSON cache (${list.length} movies).`);
        return list[Math.floor(Math.random() * list.length)];
      }
    }
  } catch (err) {
    console.error('[Twitter Bot] Local JSON cache read error:', err.message);
  }

  // Fallback default placeholder if database is empty
  return {
    id: 'trending',
    title: 'أقوى الأفلام الأجنبية الحصرية بجودة فائقة'
  };
}

async function tweetDailyMovie() {
  console.log('====================================================');
  console.log('🤖 Starting StreamHub Automated Daily Twitter Bot...');
  console.log('====================================================');

  try {
    // 1. Pick a movie
    const movie = await getRandomMovie();
    console.log(`[Twitter Bot] Target Movie: "${movie.title}" (ID: ${movie.id})`);

    // 2. Format Tweet Text
    const movieTitle = movie.title || 'أحدث الأفلام';
    const movieUrl = `https://streamhub-rosy.vercel.app/movie/${movie.id}`;
    
    const tweetText = `🎬 ${movieTitle}
🍿 شاهد الفيلم الآن بجودة عالية وبدون إعلانات مزعجة عبر سيرفرنا المباشر:
🔗 ${movieUrl}

#أفلام #StreamHub #CinemaHD #مشاهدة_أفلام`;

    console.log('\n--- Tweet Content ---');
    console.log(tweetText);
    console.log('---------------------\n');

    // 3. Initialize Twitter Client
    const client = new TwitterApi({
      appKey: TWITTER_API_KEY,
      appSecret: TWITTER_API_SECRET,
      accessToken: TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
    });

    // 4. Post Tweet via Twitter API v2
    const response = await client.v2.tweet(tweetText);
    
    console.log('✅ Tweet published successfully!');
    console.log(`[Twitter Bot] Tweet ID: ${response.data.id}`);
    console.log(`[Twitter Bot] Tweet URL: https://twitter.com/user/status/${response.data.id}`);
    console.log('====================================================');
    return response;
  } catch (error) {
    console.error('\n❌ Twitter API Error Details:');
    if (error.code === 401 || (error.data && error.data.status === 401)) {
      console.error('⚠️ [401 Unauthorized]: The Twitter App needs "Read and Write" permissions.');
      console.error('👉 Fix: Go to developer.x.com -> User Authentication Settings -> Set permissions to "Read and Write" -> Regenerate Access Token & Secret.');
    } else if (error.code === 403 || (error.data && error.data.status === 403)) {
      console.error('⚠️ [403 Forbidden]: Duplicate tweet or API limit reached.');
    } else {
      console.error(error.message || error);
    }

    if (error.data) {
      console.error('Raw Response:', JSON.stringify(error.data, null, 2));
    }

    // Exit with code 1 for CI tracking
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  tweetDailyMovie();
}

module.exports = { tweetDailyMovie, getRandomMovie };
