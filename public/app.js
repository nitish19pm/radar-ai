(() => {
  const grid = document.getElementById('cards-grid');
  const lastFetchedEl = document.getElementById('last-fetched');
  const refreshBtn = document.getElementById('refresh-btn');
  const statusBar = document.getElementById('status-bar');
  const emptyState = document.getElementById('empty-state');
  const filterBtns = document.querySelectorAll('.filter-btn');

  let allPosts = [];
  let activeFilter = 'all';

  // ── Helpers ───────────────────────────────────────────────────────────────

  function timeAgo(ts) {
    if (!ts) return 'unknown time';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function showStatus(msg, isError = false) {
    statusBar.textContent = msg;
    statusBar.className = 'status-bar' + (isError ? ' error' : '');
    statusBar.classList.remove('hidden');
  }

  function hideStatus() {
    statusBar.classList.add('hidden');
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Skeletons ─────────────────────────────────────────────────────────────

  function renderSkeletons(count = 9) {
    grid.innerHTML = Array.from({ length: count }, () => `
      <div class="skeleton">
        <div class="skel-line" style="width:30%;height:14px"></div>
        <div class="skel-line" style="width:100%;height:18px"></div>
        <div class="skel-line" style="width:80%;height:18px"></div>
        <div class="skel-line" style="width:40%;height:12px;margin-top:4px"></div>
      </div>
    `).join('');
  }

  // ── Card ─────────────────────────────────────────────────────────────────

  const SOURCES = {
    hackernews:  { label: 'Hacker News', cls: 'badge-hn' },
    devto:       { label: 'Dev.to',      cls: 'badge-devto' },
    producthunt: { label: 'Product Hunt',cls: 'badge-ph' },
    reddit:      { label: 'Reddit',      cls: 'badge-reddit' },
  };

  function buildCard(post) {
    const src = SOURCES[post.source] ?? { label: post.source, cls: '' };
    const subLabel = post.subreddit ? `<span class="card-sub">${post.subreddit}</span>` : '';
    const upvoteStr = post.upvotes > 0 ? `<span class="upvotes">▲ ${post.upvotes.toLocaleString()}</span>` : '<span></span>';
    const timestamp = post.createdAt ? `<span class="timestamp">${timeAgo(post.createdAt)}</span>` : '<span></span>';
    const permalink = post.permalink || post.url;
    const tagsHtml = (post.tags || []).length > 0
      ? `<div class="card-tags">${post.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    return `
      <article class="card" data-source="${post.source}">
        <div class="card-meta">
          <span class="badge ${src.cls}">${src.label}</span>
          ${subLabel}
        </div>
        <div class="card-title">
          <a href="${permalink}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.title)}</a>
        </div>
        ${tagsHtml}
        <div class="card-footer">
          ${upvoteStr}
          ${timestamp}
          <a class="open-link" href="${permalink}" target="_blank" rel="noopener noreferrer">Open ↗</a>
        </div>
      </article>
    `;
  }

  function renderPosts() {
    const filtered = activeFilter === 'all'
      ? allPosts
      : allPosts.filter((p) => p.source === activeFilter);

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      grid.innerHTML = filtered.map(buildCard).join('');
    }
  }

  // ── PM + AI keyword filter ────────────────────────────────────────────────

  const AI_KEYWORDS = ['claude', 'anthropic', 'chatgpt', 'openai', 'gpt-4', 'gpt4', 'gemini', 'copilot', 'llm', 'ai tool', 'large language model'];
  const PM_KEYWORDS = ['product manager', 'product management', 'product strategy', 'roadmap', 'product owner', 'prd', 'go-to-market', 'gtm', 'product lead', 'product team', 'product thinking', 'product design', ' pm ', 'pms ', 'product build', 'product dev', 'product work', 'product folk', 'product people', 'build product', 'ship product', 'saas', 'b2b', 'enterprise', 'workflow', 'productivity', 'use case', 'use cases', 'decision making', 'stakeholder', 'feature priorit', 'product launch', 'go to market'];

  function isPmAiArticle(title) {
    const t = title.toLowerCase();
    return AI_KEYWORDS.some(k => t.includes(k)) && PM_KEYWORDS.some(k => t.includes(k));
  }

  function getMatchedTags(title) {
    const t = title.toLowerCase();
    const ai = AI_KEYWORDS.filter(k => t.includes(k));
    const pm = PM_KEYWORDS.filter(k => t.includes(k));
    return [...new Set([...ai, ...pm])].slice(0, 4);
  }

  // ── Client-side fetchers (CORS-friendly APIs) ─────────────────────────────

  async function fetchHackerNews() {
    const queries = [
      'claude product manager', 'chatgpt product manager',
      'gemini product manager', 'copilot product manager',
      'AI product management', 'LLM product manager',
      'anthropic', 'openai product',
    ];
    const seenIds = new Set();
    const posts = [];

    for (const q of queries) {
      const r = await fetch(
        `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&hitsPerPage=30`
      );
      const data = await r.json();
      for (const hit of data.hits ?? []) {
        if (!hit.title || seenIds.has(hit.objectID)) continue;
        seenIds.add(hit.objectID);
        posts.push({
          id: hit.objectID,
          title: hit.title,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          permalink: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          upvotes: hit.points || 0,
          createdAt: new Date(hit.created_at).getTime(),
          source: 'hackernews',
          tags: getMatchedTags(hit.title),
        });
      }
    }
    return { posts: posts.filter(p => isPmAiArticle(p.title)), fetchedAt: Date.now() };
  }

  async function fetchDevTo() {
    const tags = ['claude', 'anthropic', 'chatgpt', 'openai', 'gemini', 'copilot', 'productmanagement'];
    const responses = await Promise.all(
      tags.map(tag => fetch(`https://dev.to/api/articles?tag=${tag}&per_page=30`).then(r => r.json()))
    );

    const seenIds = new Set();
    const posts = [];

    for (const articles of responses) {
      for (const article of (Array.isArray(articles) ? articles : [])) {
        if (!article.title || seenIds.has(article.id)) continue;
        seenIds.add(article.id);
        posts.push({
          id: String(article.id),
          title: article.title,
          url: article.url,
          permalink: article.url,
          upvotes: article.positive_reactions_count || 0,
          createdAt: new Date(article.published_at).getTime(),
          source: 'devto',
          tags: (article.tag_list || []).slice(0, 4),
        });
      }
    }
    return { posts: posts.filter(p => isPmAiArticle(p.title)), fetchedAt: Date.now() };
  }

  // ── Main fetch ────────────────────────────────────────────────────────────

  async function fetchAll() {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('spinning');
    hideStatus();
    renderSkeletons();
    emptyState.classList.add('hidden');

    const errors = [];
    let latestFetchedAt = null;

    const [hnResult, devtoResult] = await Promise.allSettled([
      fetchHackerNews(),
      fetchDevTo(),
    ]);

    const labeled = [
      { result: hnResult,    label: 'Hacker News' },
      { result: devtoResult, label: 'Dev.to' },
    ];

    const posts = [];

    for (const { result, label } of labeled) {
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (data.disabled) continue; // silently skip disabled sources
        if (data.error) {
          errors.push(`${label}: ${data.error}`);
        } else {
          posts.push(...(data.posts ?? []));
          if (data.fetchedAt) latestFetchedAt = Math.max(latestFetchedAt ?? 0, data.fetchedAt);
        }
      } else {
        errors.push(`${label}: network error`);
      }
    }

    posts.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt - a.createdAt;
    });

    allPosts = posts;
    renderPosts();

    if (latestFetchedAt) {
      lastFetchedEl.textContent = `Last fetched: ${new Date(latestFetchedAt).toLocaleTimeString()}`;
    }

    if (errors.length) {
      showStatus('Some sources had errors: ' + errors.join(' | '), true);
    } else if (posts.length === 0) {
      showStatus('No posts found from any source.', true);
    }

    refreshBtn.disabled = false;
    refreshBtn.classList.remove('spinning');
  }

  // ── WIP popup ────────────────────────────────────────────────────────────

  const wipPopup = document.getElementById('wip-popup');
  const wipClose = document.getElementById('wip-close');
  let wipTimer = null;

  function showWip() {
    wipPopup.classList.remove('hidden');
    clearTimeout(wipTimer);
    wipTimer = setTimeout(() => wipPopup.classList.add('hidden'), 3000);
  }

  wipClose.addEventListener('click', () => wipPopup.classList.add('hidden'));

  // ── Filters ───────────────────────────────────────────────────────────────

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.wip) { showWip(); return; }
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.source;
      renderPosts();
    });
  });

  refreshBtn.addEventListener('click', fetchAll);
  fetchAll();
})();
