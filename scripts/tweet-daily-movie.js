const { TwitterApi } = require('twitter-api-v2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getMovies, getLocalMovies } = require('../db');

// Twitter API Credentials
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || "fhGoRryd6hINE3aqW0EFauABg";
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || "6cnRTsA2BygzQVA512rwR2vqgZF44SQjyDHRcjqhdaVN2YXLgd";
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || "2099777594702929920-1xDXMaInKrcQLqABq55kK46vLEWiB6";
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || "pTKSj521ZgpYqUiCDc85MmoHNUpQhg8VN4C1TnY4DY1FW";

async function getRandomMovie() {
  try {
    // Attempt to fetch from Firestore / DB helper
    const result = await getMovies({ page: 1, limit: 100 });
    let movieList = (result && result.movies && result.movies.length > 0) ? result.movies : [];

    // Fallback to local movies cache
    if (movieList.length === 0) {
      movieList = getLocalMovies();
    }

    if (!movieList || movieList.length === 0) {
      throw new Error('No movies found in database or local cache.');
    }

    const randomIndex = Math.floor(Math.random() * movieList.length);
    return movieList[randomIndex];
  } catch (error) {
    console.error('[Twitter Bot] Error fetching movie from DB:', error.message);
    // Fallback to local files
    const local = getLocalMovies();
    if (local && local.length > 0) {
      return local[Math.floor(Math.random() * local.length)];
    }
    throw error;
  }
}

async function tweetDailyMovie() {
  console.log('====================================================');
  console.log('🤖 Starting StreamHub Automated Daily Twitter Bot...');
  console.log('====================================================');

  try {
    // 1. Pick a random movie
    const movie = await getRandomMovie();
    console.log(`[Twitter Bot] Selected Movie: "${movie.title}" (ID: ${movie.id})`);

    // 2. Format Tweet Text
    const movieTitle = movie.title || 'فيلم مميز';
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
    console.error('❌ Failed to publish tweet:', error);
    if (error.data) {
      console.error('Twitter API Details:', JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  tweetDailyMovie();
}

module.exports = { tweetDailyMovie, getRandomMovie };
