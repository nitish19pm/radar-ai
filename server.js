const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ── RSS newsletters ───────────────────────────────────────────────────────
const RSS_FEEDS = [
  { url: 'https://tldr.tech/api/rss/ai',              name: 'TLDR AI' },
  { url: 'https://bensbites.beehiiv.com/feed',         name: "Ben's Bites" },
  { url: 'https://www.therundown.ai/rss',              name: 'The Rundown AI' },
  { url: 'https://importai.substack.com/feed',         name: 'Import AI' },
];

async function fetchRssFeed({ url, name }) {
  const resp = await axios.get(url, {
    headers: { 'User-Agent': 'ClaudePulse/1.0' },
    timeout: 10000,
  });
  const $ = cheerio.load(resp.data, { xmlMode: true });
  const posts = [];
  $('item').each((_, el) => {
    const title = $(el).find('title').first().text().trim();
    const link  = $(el).find('link').first().text().trim() || $(el).find('link').attr('href');
    const pubDate = $(el).find('pubDate').first().text().trim();
    if (!title || !link) return;
    posts.push({
      id: link,
      title,
      url: link,
      permalink: link,
      upvotes: 0,
      createdAt: pubDate ? new Date(pubDate).getTime() : null,
      source: 'rss',
      newsletter: name,
    });
  });
  return posts;
}

app.get('/api/rss', async (req, res) => {
  const results = await Promise.allSettled(RSS_FEEDS.map(fetchRssFeed));
  const posts = [];
  for (const result of results) {
    if (result.status === 'fulfilled') posts.push(...result.value);
  }
  posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.json({ posts: posts.slice(0, 60), fetchedAt: Date.now() });
});

// ── Product Hunt (coming soon) ────────────────────────────────────────────
app.get('/api/producthunt', (req, res) => {
  res.json({ posts: [], fetchedAt: Date.now(), disabled: true });
});

// ── Reddit (disabled until OAuth credentials are configured) ──────────────
app.get('/api/reddit', async (req, res) => {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.json({ posts: [], fetchedAt: Date.now(), disabled: true, message: 'Reddit credentials not configured' });
  }
  // OAuth logic can be added here later
  res.json({ posts: [], fetchedAt: Date.now(), disabled: true });
});

// Local dev
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Claude Pulse running at http://localhost:${PORT}`);
  });
}

module.exports = app;
