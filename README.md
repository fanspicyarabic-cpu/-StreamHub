# 🎬 StreamHub - High-Performance Foreign Movie Streaming Platform

A professional, cinematic foreign movies streaming web platform built with a high-conversion layout for **Adsterra** monetization, **Firebase Firestore** database integration, dynamic **Open Graph / X (Twitter) Cards**, and an automated mass crawler (`fullScraper.js`).

---

## ⚡ Quick Start (أوامر التشغيل المباشرة)

### 1. تثبيت الحزم (Install Dependencies)
```bash
npm install
```

### 2. تشغيل سكربت الجلب الشامل وتعبئة الأفلام الأجنبية (Run Mass Foreign Importer)
```bash
node fullScraper.js
# أو
npm run scrape
```

### 3. تشغيل سكربت سحب الأفلام المترجمة من ShahedPro (Run Arabic Subtitled Crawler)
```bash
node scrapeArabicSub.js
# أو
npm run scrape:arabic
```

### 4. تشغيل خادم الموقع (Start StreamHub Server)
```bash
npm start
# أو
node server.js
```
ثم افتح متصفحك على: `http://localhost:3000`

---

## 🌟 Features & Technical Specifications

### 1. Frontend & Cinematic Experience
- **Tailwind CSS Dark Theme**: Deep black (`#08090c`) with cinematic neon red and gold accents, glowing badges, smooth hover animations.
- **Header & Navigation**: Glowing StreamHub logo, instant search with auto-debounce, and quick genre filter pills.
- **Cinema Theater Player**: Responsive 16:9 player with multi-server switcher (VidSrc HD, SuperEmbed, 2Embed).
- **SEO & Social Sharing on X (Twitter)**: Server-Side Rendered (SSR) Open Graph meta tags (`og:title`, `og:image`, `twitter:card`) ensuring rich preview cards when links are shared on X or messaging apps.

### 2. High-Yield Adsterra Monetization Placements
Every placement is clearly labeled in the source code:
- **Popunder**: Dedicated scripts container in `public/index.html` and `public/watch.html`.
- **Social Bar**: Floating notification banner configured in `public/index.html`.
- **Leaderboard (728x90 / Responsive)**: Placed right above trending movies and above player.
- **Native In-Feed & Sidebar (300x250)**: Seamlessly embedded inside movie cards grid and sidebar.
- **Direct Links**: High-converting action buttons ("Download 1080p", "VIP Server Boost", "Subtitles Pack") managed centrally via `public/js/ads.js` and `.env`.

### 3. Firebase Firestore Integration
- Configured with `firebase-admin`.
- Strict schema adherence:
  ```json
  {
    "title": "Inception",
    "description": "A thief who steals corporate secrets...",
    "posterUrl": "https://image.tmdb.org/t/p/w500/...",
    "backdropUrl": "https://image.tmdb.org/t/p/original/...",
    "year": 2010,
    "rating": 8.8,
    "genres": ["Action", "Sci-Fi"],
    "embedUrl": "https://vidsrc.to/embed/movie/...",
    "createdAt": "2026-09-15T06:00:00.000Z"
  }
  ```
- **Local Cache Fallback**: If you haven't added `serviceAccountKey.json` yet, the app and crawler automatically save and read from `/data/movies.json`, so you can test everything immediately without setup errors!

### 4. Mass Importer / Full Crawler (`fullScraper.js`)
- **Automated Pagination Loop**: Iterates through `page=1` up to the max pages across 9 distinct categories (Action, Horror, Sci-Fi, Drama, Thriller, Comedy, Crime, Popular, Top Rated).
- **Deduplication Check**: Checks Firestore before saving to ensure zero duplicate entries.
- **Anti-Ban Delay**: Built-in 1.25-second delay between requests.
- **Fault-Tolerant (Try/Catch)**: Skips broken pages or movies without interrupting execution.

---

## 🔑 Configuration & Setup

### Connecting Live Firebase Firestore:
1. Go to your [Firebase Console](https://console.firebase.google.com/) -> Project `moves-app-2026-8a045`.
2. Navigate to **Project Settings** -> **Service Accounts**.
3. Click **Generate new private key** and download the JSON file.
4. Rename the downloaded file to `serviceAccountKey.json` and place it in the root folder of this project.

### Configuring Adsterra Links:
1. Open `.env` (or copy from `.env.example`):
   ```env
   ADSTERRA_DIRECT_LINK=https://www.highperformancegate.com/your-adsterra-direct-link-id
   ```
2. In `public/index.html` and `public/watch.html`, replace the commented `<script>` tags with your Adsterra script keys.

---

## 📁 Project Structure

```
MOVES/
├── package.json                   # Dependencies & npm scripts
├── .env.example                   # Environment configuration template
├── serviceAccountKey.json.example # Firebase Admin SDK template
├── server.js                      # Express SSR & Open Graph server
├── db.js                          # Firebase Firestore abstraction & deduplication
├── fullScraper.js                 # Mass movie crawler with pagination & anti-ban
├── public/
│   ├── index.html                 # Cinematic homepage with Adsterra slots & search
│   ├── watch.html                 # Theater player page with SSR OG tags & servers
│   ├── css/
│   │   └── style.css              # Custom styling & dark scrollbar
│   └── js/
│       ├── app.js                 # Frontend interactivity (search, genres, grid)
│       └── ads.js                 # Adsterra direct link & ad management
└── README.md                      # Documentation
```
