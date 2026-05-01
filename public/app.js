(() => {
  const grid = document.getElementById('cards-grid');
  const lastFetchedEl = document.getElementById('last-fetched');
  const refreshBtn = document.getElementById('refresh-btn');
  const statusBar = document.getElementById('status-bar');
  const emptyState = document.getElementById('empty-state');
  const filterBtns = document.querySelectorAll('.filter-btn');

  let allPosts = [];
  let activeFilter = 'all';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function timeAgo(ts) {
    if (!ts) return 'unknown time';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function formatFetchTime(ts) {
    return `Last fetched: ${new Date(ts).toLocaleTimeString()}`;
  }

  function showStatus(msg, isError = false) {
    statusBar.textContent = msg;
    statusBar.className = 'status-bar' + (isError ? ' error' : '');
    statusBar.classList.remove('hidden');
  }

  function hideStatus() {
    statusBar.classList.add('hidden');
  }

  // ── Skeletons ─────────────────────────────────────────────────────────────

  function renderSkeletons(count = 8) {
    grid.innerHTML = Array.from({ length: count }, () => `
      <div class="skeleton">
        <div class="skel-line" style="width:30%;height:14px"></div>
        <div class="skel-line" style="width:100%;height:18px"></div>
        <div class="skel-line" style="width:80%;height:18px"></div>
        <div class="skel-line" style="width:40%;height:12px;margin-top:4px"></div>
      </div>
    `).join('');
  }

  // ── Card rendering ────────────────────────────────────────────────────────

  function buildCard(post) {
    const isReddit = post.source === 'reddit';
    const badgeClass = isReddit ? 'badge-reddit' : 'badge-ph';
    const badgeLabel = isReddit ? 'Reddit' : 'Product Hunt';
    const subLabel = isReddit && post.subreddit ? `<span class="card-sub">${post.subreddit}</span>` : '';
    const upvoteStr = post.upvotes > 0 ? `<span class="upvotes">▲ ${post.upvotes.toLocaleString()}</span>` : '<span></span>';
    const timestamp = post.createdAt ? `<span class="timestamp">${timeAgo(post.createdAt)}</span>` : '<span></span>';
    const permalink = post.permalink || post.url;

    return `
      <article class="card" data-source="${post.source}">
        <div class="card-meta">
          <span class="badge ${badgeClass}">${badgeLabel}</span>
          ${subLabel}
        </div>
        <div class="card-title">
          <a href="${permalink}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.title)}</a>
        </div>
        <div class="card-footer">
          ${upvoteStr}
          ${timestamp}
          <a class="open-link" href="${permalink}" target="_blank" rel="noopener noreferrer">Open ↗</a>
        </div>
      </article>
    `;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderPosts() {
    const filtered =
      activeFilter === 'all' ? allPosts : allPosts.filter((p) => p.source === activeFilter);

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      grid.innerHTML = filtered.map(buildCard).join('');
    }
  }

  // ── Reddit (fetched client-side — Reddit allows browser CORS) ───────────

  async function fetchReddit() {
    const headers = { 'User-Agent': 'ClaudePulse/1.0' };
    const [r1, r2] = await Promise.all([
      fetch('https://www.reddit.com/r/ClaudeAI/new.json?limit=25', { headers }),
      fetch('https://www.reddit.com/search.json?q=claude+anthropic&sort=new&limit=25', { headers }),
    ]);
    const [d1, d2] = await Promise.all([r1.json(), r2.json()]);

    const seenIds = new Set();
    const posts = [];
    for (const data of [d1, d2]) {
      for (const child of data?.data?.children ?? []) {
        const p = child.data;
        if (!p || seenIds.has(p.id)) continue;
        seenIds.add(p.id);
        posts.push({
          id: p.id,
          title: p.title,
          url: p.url,
          permalink: `https://www.reddit.com${p.permalink}`,
          upvotes: p.ups,
          subreddit: p.subreddit_name_prefixed,
          createdAt: p.created_utc * 1000,
          source: 'reddit',
        });
      }
    }
    return { posts, fetchedAt: Date.now() };
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────

  async function fetchAll() {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('spinning');
    hideStatus();
    renderSkeletons();
    emptyState.classList.add('hidden');

    const errors = [];
    let latestFetchedAt = null;

    const results = await Promise.allSettled([
      fetchReddit(),
      fetch('/api/producthunt').then((r) => r.json()),
    ]);

    const posts = [];

    results.forEach((result, i) => {
      const label = i === 0 ? 'Reddit' : 'Product Hunt';
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (data.error) {
          errors.push(`${label}: ${data.error}`);
        } else {
          posts.push(...(data.posts ?? []));
          if (data.fetchedAt) latestFetchedAt = Math.max(latestFetchedAt ?? 0, data.fetchedAt);
        }
      } else {
        errors.push(`${label}: network error`);
      }
    });

    // Sort newest first; posts without timestamps go to the end
    posts.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt - a.createdAt;
    });

    allPosts = posts;
    renderPosts();

    if (latestFetchedAt) {
      lastFetchedEl.textContent = formatFetchTime(latestFetchedAt);
    }

    if (errors.length) {
      showStatus('Some sources had errors: ' + errors.join(' | '), true);
    } else if (posts.length === 0) {
      showStatus('No posts found from any source.', true);
    }

    refreshBtn.disabled = false;
    refreshBtn.classList.remove('spinning');
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.source;
      renderPosts();
    });
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  refreshBtn.addEventListener('click', fetchAll);
  fetchAll();
})();
