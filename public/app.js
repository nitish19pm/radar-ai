(() => {
  const grid = document.getElementById('cards-grid');
  const lastFetchedEl = document.getElementById('last-fetched');
  const refreshBtn = document.getElementById('refresh-btn');
  const statusBar = document.getElementById('status-bar');
  const emptyState = document.getElementById('empty-state');
  const filterBtns = document.querySelectorAll('.filter-btn');

  let allPosts = [];
  let activeFilter = 'all';
  let searchQuery = '';

  // ── Chip filter state ─────────────────────────────────────────────────────

  const CHIP_GROUPS = {
    'AI Tools': ['claude', 'anthropic', 'chatgpt', 'openai', 'gemini', 'copilot', 'gpt', 'llm', 'agent'],
    'Topics':   ['product management', 'roadmap', 'saas', 'enterprise', 'workflow', 'productivity'],
  };

  // ── Theme ─────────────────────────────────────────────────────────────────
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('radarai_theme') || '';
  document.body.dataset.theme = savedTheme;
  themeToggle.textContent = savedTheme === 'light' ? '☀️' : '🌙';

  themeToggle.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'light' ? '' : 'light';
    document.body.dataset.theme = next;
    localStorage.setItem('radarai_theme', next);
    themeToggle.textContent = next === 'light' ? '☀️' : '🌙';
  });

  // ── Search ────────────────────────────────────────────────────────────────
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.toLowerCase().trim();
    renderPosts();
  });

  let activeChips  = new Set(JSON.parse(localStorage.getItem('radarai_chips') || '[]'));
  let filterOpen   = JSON.parse(localStorage.getItem('radarai_filter_open') || 'false');
  let activeDays   = parseInt(localStorage.getItem('radarai_days') || '0', 10);

  function saveChips() {
    localStorage.setItem('radarai_chips', JSON.stringify([...activeChips]));
  }

  function updateChipUI() {
    const count = activeChips.size;
    const countEl = document.getElementById('chip-active-count');
    const clearBtn = document.getElementById('chip-clear');
    const arrow = document.getElementById('chip-arrow');
    const body = document.getElementById('chip-body');

    countEl.textContent = `${count} active`;
    countEl.classList.toggle('hidden', count === 0);
    clearBtn.classList.toggle('hidden', count === 0);
    arrow.style.transform = filterOpen ? 'rotate(180deg)' : '';
    body.classList.toggle('open', filterOpen);

    document.querySelectorAll('.chip').forEach(btn => {
      btn.classList.toggle('active', activeChips.has(btn.dataset.chip));
    });

    document.querySelectorAll('.time-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.days) === activeDays);
    });
  }

  // ── Time filter ───────────────────────────────────────────────────────────
  document.addEventListener('click', e => {
    const btn = e.target.closest('.time-btn');
    if (!btn) return;
    activeDays = parseInt(btn.dataset.days);
    localStorage.setItem('radarai_days', activeDays);
    updateChipUI();
    renderPosts();
  });

  function renderChips() {
    const groupEls = { 'AI Tools': document.getElementById('chip-group-ai'), 'Topics': document.getElementById('chip-group-topics') };
    for (const [groupName, chips] of Object.entries(CHIP_GROUPS)) {
      const el = groupEls[groupName];
      if (!el) continue;
      el.innerHTML = `<span class="chip-label">${groupName}</span>` +
        chips.map(c => `<button class="chip${activeChips.has(c) ? ' active' : ''}" data-chip="${c}">${c}</button>`).join('');
    }
    document.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const chip = btn.dataset.chip;
        if (activeChips.has(chip)) activeChips.delete(chip);
        else activeChips.add(chip);
        saveChips();
        updateChipUI();
        renderPosts();
      });
    });
  }

  document.getElementById('chip-toggle').addEventListener('click', () => {
    filterOpen = !filterOpen;
    localStorage.setItem('radarai_filter_open', JSON.stringify(filterOpen));
    updateChipUI();
  });

  document.getElementById('chip-clear').addEventListener('click', () => {
    activeChips.clear();
    saveChips();
    updateChipUI();
    renderPosts();
  });

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
    rss:         { label: 'Newsletter',  cls: 'badge-rss' },
  };

  function buildCard(post) {
    const src = SOURCES[post.source] ?? { label: post.source, cls: '' };
    const subLabel = post.subreddit ? `<span class="card-sub">${post.subreddit}</span>`
                   : post.newsletter ? `<span class="card-sub">${escapeHtml(post.newsletter)}</span>` : '';
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
    let filtered = activeFilter === 'all'
      ? allPosts
      : allPosts.filter((p) => p.source === activeFilter);

    if (activeDays > 0) {
      const cutoff = Date.now() - activeDays * 86400000;
      filtered = filtered.filter(p => p.createdAt && p.createdAt >= cutoff);
    }

    if (activeChips.size > 0) {
      filtered = filtered.filter(p =>
        (p.tags || []).some(t => activeChips.has(t.toLowerCase()))
      );
    }

    if (searchQuery) {
      filtered = filtered.filter(p => p.title.toLowerCase().includes(searchQuery));
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      grid.innerHTML = filtered.map(buildCard).join('');
    }
  }

  // ── PM + AI keyword filter ────────────────────────────────────────────────

  const AI_KEYWORDS = ['claude', 'anthropic', 'chatgpt', 'openai', 'gpt-4', 'gpt-4o', 'gpt4', 'gemini', 'copilot', 'llm', 'ai tool', 'large language model', 'generative ai', 'gen ai', 'agent', 'agentic', 'gpt', ' ai '];
  const PM_TAG_KEYWORDS = ['product management', 'product manager', 'roadmap', 'saas', 'enterprise', 'workflow', 'productivity', 'product strategy', 'product owner'];

  function getMatchedTags(title) {
    const t = title.toLowerCase();
    const aiTags = AI_KEYWORDS.filter(k => t.includes(k));
    const pmTags = PM_TAG_KEYWORDS.filter(k => t.includes(k));
    return [...new Set([...aiTags, ...pmTags])].slice(0, 5);
  }

  // ── Client-side fetchers (CORS-friendly APIs) ─────────────────────────────

  async function fetchHackerNews() {
    const queries = ['anthropic', 'chatgpt', 'openai', 'gemini ai', 'github copilot', 'claude ai'];
    const seenIds = new Set();
    const posts = [];

    const results = await Promise.allSettled(
      queries.map(q =>
        fetch(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&hitsPerPage=25`)
          .then(r => r.json())
      )
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const hit of result.value.hits ?? []) {
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
    return { posts, fetchedAt: Date.now() };
  }

  async function fetchDevTo() {
    const tags = ['claude', 'chatgpt', 'openai', 'gemini', 'copilot', 'productmanagement'];
    let results;
    try {
      results = await Promise.allSettled(
        tags.map(tag =>
          fetch(`https://dev.to/api/articles?tag=${tag}&per_page=30`).then(r => r.json())
        )
      );
    } catch (err) {
      return { posts: [], fetchedAt: Date.now() };
    }

    const seenIds = new Set();
    const posts = [];

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const article of (Array.isArray(result.value) ? result.value : [])) {
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
    return { posts, fetchedAt: Date.now() };
  }

  // ── Main fetch ────────────────────────────────────────────────────────────

  async function fetchAll() {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('spinning');
    hideStatus();
    searchInput.value = '';
    searchQuery = '';
    renderSkeletons();
    emptyState.classList.add('hidden');

    const errors = [];
    let latestFetchedAt = null;

    const [hnResult, devtoResult, rssResult] = await Promise.allSettled([
      fetchHackerNews(),
      fetchDevTo(),
      fetch('/api/rss').then(r => r.json()),
    ]);

    const labeled = [
      { result: hnResult,    label: 'Hacker News' },
      { result: devtoResult, label: 'Dev.to' },
      { result: rssResult,   label: 'Newsletters' },
    ];

    const posts = [];

    for (const { result, label } of labeled) {
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (data.disabled) continue;
        if (data.error) {
          errors.push(`${label}: ${data.error}`);
        } else {
          // Enrich tags for all posts after fetch
          const enriched = (data.posts ?? []).map(p => {
            const baseTags = (p.tags && p.tags.length > 0) ? p.tags : getMatchedTags(p.title);
            const newsletterTag = p.newsletter ? [p.newsletter.toLowerCase()] : [];
            return { ...p, tags: [...new Set([...baseTags, ...newsletterTag])].slice(0, 5) };
          });
          posts.push(...enriched);
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
  renderChips();
  updateChipUI();
  fetchAll();
})();
