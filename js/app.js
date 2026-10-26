/* Prism Bots Panel — vanilla JS, hash router, Discord OAuth2 (implicit grant), live + demo modes. */
(function () {
    const D = window.PRISM_DATA;
    const C = window.PRISM_CONFIG;
    const DEMO = window.PRISM_DEMO;
    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];
    const app = $('#app');

    const BOTS = [
        ...D.music.map(b => ({ ...b, kind: 'free' })),
        ...D.private.map(b => ({ ...b, kind: 'private' }))
    ];
    const bot = id => BOTS.find(b => b.id === id);
    const cfg = id => (C.bots && C.bots[id]) || {};
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = n => `${C.currency}${Number(n).toLocaleString('en-IN')}`;
    const logo = b => `assets/bots/${b.id}-logo.webp`;
    const fmt = s => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
    const ago = sec => { const d = Math.floor(sec / 86400); const h = Math.floor((sec % 86400) / 3600); return d ? `${d}d ${h}h` : `${h}h`; };
    const PERMS = { music: '3230720', sentinel: '1099780189206', arena: '268651536', roomtone: '3230720' };

    function accent(b) {
        const r = document.documentElement.style;
        r.setProperty('--accent', b ? b.hex : '#6c63ff');
        r.setProperty('--accent-2', b ? (b.id === 'royalwave' ? '#ffe39a' : b.hex2) : '#00d2ff');
    }

    function inviteUrl(b) {
        const id = cfg(b.id).clientId;
        if (!id) return null;
        const perms = PERMS[b.kind === 'free' ? 'music' : b.id];
        return `https://discord.com/oauth2/authorize?client_id=${id}&scope=bot+applications.commands&permissions=${perms}`;
    }

    function toast(msg, err = false) {
        const t = $('#toast');
        t.textContent = msg;
        t.className = `toast show${err ? ' err' : ''}`;
        clearTimeout(t._h);
        t._h = setTimeout(() => { t.className = 'toast'; }, 3200);
    }

    // ── Auth (Discord OAuth2 implicit grant; token stays in this tab) ────────────
    const auth = {
        get token() {
            try {
                const t = JSON.parse(sessionStorage.getItem('prism_token'));
                return t && t.exp > Date.now() ? t.value : null;
            } catch { return null; }
        },
        get demo() { return sessionStorage.getItem('prism_demo') === '1'; },
        user: null,
        login(returnTo) {
            if (!C.oauthClientId) {
                openModal(`<h2>Live login is not connected yet</h2>
                    <p class="muted">The bot owner still needs to add a Discord OAuth app in <code class="mono">js/config.js</code>. You can explore every page of the dashboard in demo mode right now.</p>
                    <div class="row"><button class="btn ghost" data-close>Close</button><button class="btn primary" data-demo="${esc(returnTo)}">Open demo</button></div>`);
                return;
            }
            const state = btoa(JSON.stringify({ r: returnTo, n: Math.random().toString(36).slice(2) }));
            sessionStorage.setItem('prism_state', state);
            const redirect = location.origin + location.pathname;
            location.href = `https://discord.com/oauth2/authorize?client_id=${C.oauthClientId}&response_type=token&scope=identify%20guilds&prompt=none&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}`;
        },
        logout() {
            sessionStorage.removeItem('prism_token');
            sessionStorage.removeItem('prism_demo');
            auth.user = null;
            renderWho();
            location.hash = '#/dashboard';
        },
        startDemo(returnTo) {
            sessionStorage.setItem('prism_demo', '1');
            auth.user = DEMO.user;
            renderWho();
            location.hash = returnTo || '#/dashboard';
            route();
        },
        async loadUser() {
            if (auth.demo) { auth.user = DEMO.user; return; }
            if (!auth.token) return;
            try {
                const r = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${auth.token}` } });
                if (!r.ok) throw new Error();
                auth.user = await r.json();
            } catch { sessionStorage.removeItem('prism_token'); auth.user = null; }
        }
    };

    function consumeOAuthRedirect() {
        if (!location.hash.includes('access_token=')) return;
        const p = new URLSearchParams(location.hash.slice(1));
        const expected = sessionStorage.getItem('prism_state');
        let returnTo = '#/dashboard';
        if (p.get('state') && p.get('state') === expected) {
            sessionStorage.setItem('prism_token', JSON.stringify({ value: p.get('access_token'), exp: Date.now() + (Number(p.get('expires_in')) || 3600) * 1000 }));
            sessionStorage.removeItem('prism_demo');
            try { returnTo = JSON.parse(atob(expected)).r || returnTo; } catch { /* default */ }
        }
        sessionStorage.removeItem('prism_state');
        history.replaceState(null, '', location.pathname + returnTo);
    }

    function renderWho() {
        const el = $('#who');
        const u = auth.user;
        if (!u) { el.innerHTML = `<button class="btn discord sm" data-login="#/dashboard"><span class="lg-long">Login with Discord</span><span class="lg-short">Login</span></button>`; return; }
        const av = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null;
        el.innerHTML = `${auth.demo ? '<span class="chip gold">Demo</span>' : ''}
            ${av ? `<img src="${av}" alt="">` : `<span class="av" aria-hidden="true">${esc((u.username || '?')[0].toUpperCase())}</span>`}
            <span class="name">${esc(u.global_name || u.username)}</span>
            <button class="btn ghost sm" data-logout>Log out</button>`;
    }

    // ── API (live bot API or demo) ───────────────────────────────────────────────
    function api(botId) {
        const base = (cfg(botId).apiUrl || '').replace(/\/$/, '');
        const live = !auth.demo && base && auth.token;
        const call = async (path, opts = {}) => {
            const r = await fetch(base + path, { ...opts, headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
            return body;
        };
        return {
            live, configured: Boolean(base),
            async status() {
                if (auth.demo || !base) return DEMO.status(botId);
                const r = await fetch(base + (botId === 'roomtone' ? '/api/music/status' : '/api/status'));
                return r.json();
            },
            async guilds() {
                if (auth.demo) return { guilds: DEMO.guilds };
                return call('/api/me/guilds');
            },
            async guild(id) { return auth.demo ? DEMO.guildData(botId, id) : call(`/api/guilds/${id}`); },
            async save(id, patch) { return auth.demo ? { settings: DEMO.update(botId, id, patch) } : call(`/api/guilds/${id}/settings`, { method: 'PATCH', body: JSON.stringify(patch) }); },
            async action(id, name, body = {}) {
                if (auth.demo) return name === 'redeem' ? DEMO.redeem(botId, id, body.key) : { ok: true };
                return call(`/api/guilds/${id}/actions/${name}`, { method: 'POST', body: JSON.stringify(body) });
            }
        };
    }

    // ── Modal ────────────────────────────────────────────────────────────────────
    function openModal(html) {
        const m = $('#modal');
        $('.modal-card', m).innerHTML = html;
        m.hidden = false;
        const h = $('h2', m); if (h) h.id = 'modal-title';
        ($('[data-focus]', m) || $('button, a, input', m))?.focus();
    }
    const closeModal = () => { $('#modal').hidden = true; };

    // ── Shared pieces ────────────────────────────────────────────────────────────
    function botCard(b) {
        const inv = inviteUrl(b);
        const feats = (b.kind === 'free' ? b.signature : b.features).slice(0, 3);
        return `<article class="bot-card fade" style="--accent:${b.hex};--accent-2:${b.hex2}">
            <span class="ribbon">${b.kind === 'free' ? '<span class="chip green">Free</span> <span class="chip gold">💎 Premium</span>' : '<span class="chip lock">Private</span>'}</span>
            <div class="head"><img class="logo" src="${logo(b)}" alt="" width="60" height="60" loading="lazy">
                <div><h3><a href="#/bot/${b.id}">${esc(b.name)}</a></h3><p class="tag">${esc(b.tagline)}</p></div></div>
            <ul>${feats.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
            <div class="actions">
                ${b.kind === 'free'
                    ? `${inv ? `<a class="btn primary sm" href="${inv}" target="_blank" rel="noopener">Invite</a>` : `<a class="btn primary sm" href="${C.supportUrl}" target="_blank" rel="noopener">Get invite</a>`}
                       <a class="btn sm" href="#/dashboard/${b.id}">Dashboard</a>
                       <a class="btn sm" href="#/premium/${b.id}">💎 Premium</a>`
                    : `<a class="btn sm" href="#/dashboard/${b.id}">Dashboard</a>
                       <a class="btn sm ghost" href="#/bot/${b.id}">Details</a>
                       <a class="btn sm ghost" href="${C.supportUrl}" target="_blank" rel="noopener">Join Prism Protocol</a>`}
            </div></article>`;
    }

    function commandsBlock(b) {
        const cmds = b.kind === 'free' ? D.musicCommands : b.commands;
        const cats = [...new Set(cmds.map(c => c.category || 'commands'))];
        return `<div class="panel"><h3>⌘ Slash commands <span class="chip">${cmds.length}</span></h3>
            ${cats.length > 1 ? `<div class="tabs" role="tablist">${['all', ...cats].map((c, i) => `<button role="tab" class="${i ? '' : 'on'}" data-cat="${c}">${c}</button>`).join('')}</div>` : ''}
            <div class="cmds">${cmds.map(c => `<div class="cmd" data-c="${c.category || 'commands'}"><code>/${esc(c.name)}</code><span>${esc(c.description)}</span>${c.premium ? '<span class="chip gold">💎</span>' : '<span></span>'}</div>`).join('')}</div></div>`;
    }

    // ── Views ────────────────────────────────────────────────────────────────────
    function viewHome() {
        accent(null);
        const totalCmds = D.musicCommands.length;
        app.innerHTML = `
        <section class="hero wrap fade">
            <div class="eyebrow">Prism Protocol · Discord bots</div>
            <h1>One panel for <span class="grad">every Prism bot.</span></h1>
            <p>Five free music bots with optional Premium, plus the private toolkit that runs the Prism Protocol community. Invite, configure your server and manage Premium from one place.</p>
            <div class="row">
                <a class="btn primary" href="#/dashboard">Open dashboard</a>
                <a class="btn gold" href="#/premium">💎 See Premium</a>
                <a class="btn ghost" href="${C.supportUrl}" target="_blank" rel="noopener">Join the Discord</a>
            </div>
            <div class="term" aria-label="Example commands"><span class="p">#music</span> <span class="c">/play</span> query:<span class="k">lofi rain</span><br><span class="p">#music</span> <span class="c">/filter</span> effect:<span class="k">nightcore</span> 💎<br><span class="p">#music</span> <span class="c">/247</span> enabled:<span class="k">true</span> 💎<br><span class="dim">→ ${totalCmds} slash commands · SoundCloud search · 24/7 radio · 9 audio filters</span></div>
            <div class="stats">
                <div><b>${BOTS.length}</b><span>Bots</span></div>
                <div><b>${D.music.length}</b><span>Free music bots</span></div>
                <div><b>${D.music.reduce((a, b) => a + b.stations.length, 0)}</b><span>Radio stations</span></div>
                <div><b>${money(C.prices.premium.monthly)}</b><span>Premium from / mo</span></div>
            </div>
        </section>
        <section class="section wrap" id="free">
            <div class="section-head"><div><div class="eyebrow">Free for everyone</div><h2>Music bots</h2><p>Same rock-solid engine, five different personalities. Free forever, with Premium for 24/7, filters, playlists and more.</p></div><a class="btn sm" href="#/premium">Compare plans →</a></div>
            <div class="grid">${D.music.map(b => botCard({ ...b, kind: 'free' })).join('')}</div>
        </section>
        <section class="section wrap" id="private">
            <div class="section-head"><div><div class="eyebrow">Prism Protocol only</div><h2>Server toolkit</h2><p>Private bots built for the Prism Protocol server: music nights, moderation and hackathons. Join the community to see them in action.</p></div></div>
            <div class="grid">${D.private.map(b => botCard({ ...b, kind: 'private' })).join('')}</div>
        </section>`;
    }

    function viewBot(id) {
        const b = bot(id);
        if (!b) return viewNotFound();
        accent(b);
        const inv = inviteUrl(b);
        const free = b.kind === 'free';
        app.innerHTML = `<div class="wrap fade">
            <section class="bot-hero">
                <img class="banner" src="assets/bots/${b.id}-banner.webp" alt="${esc(b.name)} banner" width="1280" height="400">
                <div class="bar"><p>${esc(b.description)}</p>
                    <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">
                        ${free ? (inv ? `<a class="btn primary" href="${inv}" target="_blank" rel="noopener">Invite ${esc(b.short)}</a>` : `<a class="btn primary" href="${C.supportUrl}" target="_blank" rel="noopener">Get invite</a>`) : '<span class="chip lock">Private · Prism Protocol</span>'}
                        <a class="btn" href="#/dashboard/${b.id}">Dashboard</a>
                        ${free ? `<a class="btn gold" href="#/premium/${b.id}">💎 Premium</a>` : ''}
                        <a class="btn ghost" href="https://github.com/krishyaa06/${b.repo}" target="_blank" rel="noopener">Source</a>
                    </div></div>
            </section>
            <section class="section two">
                ${commandsBlock(b)}
                <div style="display:grid;gap:18px">
                    <div class="panel"><h3>✦ Highlights</h3><ul class="list">${(free ? b.signature : b.features).map(f => `<li><span style="color:var(--accent-2)">◆</span><span>${esc(f)}</span></li>`).join('')}</ul></div>
                    ${free ? `<div class="panel"><h3>${b.emoji.radio} Radio stations</h3><ul class="list">${b.stations.map(s => `<li><span class="mono dim">${esc(s.id)}</span><span><b>${esc(s.name)}</b> · ${esc(s.genre)}</span></li>`).join('')}</ul><p class="note">Streams by SomaFM, listener-supported radio.</p></div>
                    <div class="panel"><h3>💎 Premium unlocks</h3><ul class="list"><li>24/7 mode and autoplay radio</li><li>9 audio filters: nightcore, 8D, bass boost…</li><li>Saved playlists, queue up to 2,000</li><li>Volume up to 200%</li></ul><a class="btn gold sm" style="margin-top:14px" href="#/premium/${b.id}">From ${money(C.prices.premium.monthly)}/month</a></div>` : ''}
                </div>
            </section></div>`;
    }

    let period = 'monthly';
    function viewPremium(id) {
        const b = bot(id) && bot(id).kind === 'free' ? bot(id) : D.music[0] && { ...D.music[0], kind: 'free' };
        accent(b);
        const P = C.prices;
        const T = D.tiers;
        const per = period === 'monthly' ? '/month' : '/year';
        const row = (label, f) => `<tr><td>${label}</td>${['free', 'premium', 'plus'].map(t => { const v = f(T[t]); return `<td class="${v === true ? 'y' : v === false ? 'n' : ''}">${v === true ? '✓' : v === false ? '—' : v}</td>`; }).join('')}</tr>`;
        app.innerHTML = `<div class="wrap fade">
            <section class="hero" style="padding-bottom:20px">
                <div class="eyebrow">💎 Premium</div>
                <h1 style="max-width:18ch">More music, <span class="grad">zero limits.</span></h1>
                <p>Every music bot is free forever. Premium is per server and keeps the bots running for everyone. Pick a bot, pick a plan.</p>
            </section>
            <div class="bot-picker" role="tablist" aria-label="Choose a bot">${D.music.map(m => `<button role="tab" aria-selected="${m.id === b.id}" class="${m.id === b.id ? 'on' : ''}" data-pick="${m.id}" style="--accent:${m.hex}"><img src="${logo(m)}" alt="">${esc(m.short)}</button>`).join('')}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:26px">
                <h2 style="margin:0;font-size:var(--text-xl)">${esc(b.name)} plans</h2>
                <div class="period" role="group" aria-label="Billing period"><button class="${period === 'monthly' ? 'on' : ''}" data-period="monthly">Monthly</button><button class="${period === 'yearly' ? 'on' : ''}" data-period="yearly">Yearly <span class="save">2 months free</span></button></div>
            </div>
            <div class="plans">
                <div class="plan"><h3>Free</h3><div class="price">${money(0)}<small> forever</small></div><p>Everything you need to listen together.</p>
                    <ul><li>All ${D.musicCommands.filter(c => !c.premium).length} core commands</li><li>SoundCloud search & links</li><li>${b.stations.length} radio stations</li><li>Queue up to ${T.free.queueLimit}</li><li class="no">Filters, 24/7, playlists</li></ul>
                    ${inviteUrl(b) ? `<a class="btn" href="${inviteUrl(b)}" target="_blank" rel="noopener">Invite free</a>` : `<a class="btn" href="${C.supportUrl}" target="_blank" rel="noopener">Get invite</a>`}</div>
                <div class="plan hot"><span class="badge">POPULAR</span><h3>Premium</h3><div class="price">${money(P.premium[period])}<small>${per}</small></div><p>For servers that never stop the music.</p>
                    <ul><li>24/7 mode</li><li>9 audio filters</li><li>Autoplay radio</li><li>${T.premium.playlists} saved playlists</li><li>Queue ${T.premium.queueLimit} · volume ${T.premium.maxVolume}%</li></ul>
                    <button class="btn primary" data-buy="premium">Get Premium</button></div>
                <div class="plan"><h3>Premium+</h3><div class="price">${money(P.plus[period])}<small>${per}</small></div><p>Big communities and power DJs.</p>
                    <ul><li>Everything in Premium</li><li>${T.plus.playlists} playlists × ${T.plus.playlistSize} tracks</li><li>Queue up to ${T.plus.queueLimit.toLocaleString()}</li><li>Volume up to ${T.plus.maxVolume}%</li><li>Priority support</li></ul>
                    <button class="btn" data-buy="plus">Get Premium+</button></div>
                <div class="plan pass"><span class="badge">BEST VALUE</span><h3>Prism Pass</h3><div class="price">${money(P.pass[period])}<small>${per}</small></div><p>Premium+ on all ${D.music.length} music bots for one server.</p>
                    <ul>${D.music.map(m => `<li>${esc(m.name)}</li>`).join('')}</ul>
                    <button class="btn gold" data-buy="pass">Get Prism Pass</button></div>
            </div>
            <section class="section"><div class="section-head"><div><div class="eyebrow">Compare</div><h2>What you get</h2></div></div>
                <div class="panel" style="overflow-x:auto"><table class="compare"><thead><tr><th>Feature</th><th>Free</th><th>Premium</th><th>Premium+</th></tr></thead><tbody>
                ${row('Queue size', t => t.queueLimit.toLocaleString())}
                ${row('Max volume', t => `${t.maxVolume}%`)}
                ${row('Audio filters (nightcore, 8D, bass boost…)', t => t.filters)}
                ${row('24/7 mode', t => t.alwaysOn)}
                ${row('Autoplay radio', t => t.autoplay)}
                ${row('Saved playlists', t => t.playlists || false)}
                ${row('Radio stations', () => b.stations.length)}
                ${row('Web dashboard', () => true)}
                </tbody></table></div></section>
            <section class="section"><div class="section-head"><div><div class="eyebrow">How it works</div><h2>Buy, get a key, redeem</h2></div></div>
                <div class="steps">
                    <div class="step"><h4>Pay securely</h4><p>Choose a plan and complete checkout. UPI and cards are supported.</p></div>
                    <div class="step"><h4>Receive your key</h4><p>You get a key like <span class="mono">${b.keyPrefix}-XXXX-XXXX-XXXX</span> in a Discord DM or ticket.</p></div>
                    <div class="step"><h4>Redeem it</h4><p>Run <span class="mono">/redeem</span> in your server, or paste the key in the dashboard. Premium is active instantly.</p></div>
                </div></section>
            <section class="section" style="padding-top:0"><div class="section-head"><div><div class="eyebrow">FAQ</div><h2>Questions</h2></div></div>
                <details><summary>Is Premium per server or per user?</summary><p>Per server. Anyone with Manage Server can redeem a key, and every member enjoys the perks.</p></details>
                <details><summary>Does time stack if I redeem two keys?</summary><p>Yes. Redeeming another key of the same plan adds its days to the current expiry.</p></details>
                <details><summary>Can I cancel?</summary><p>Plans are prepaid and simply expire. When they do, the server goes back to Free, saved playlists are kept.</p></details>
                <details><summary>Why no YouTube or Spotify?</summary><p>Their terms forbid bots from streaming them. The bots use SoundCloud search, direct audio links and licensed internet radio instead, so they stay online.</p></details>
            </section></div>`;
        app.dataset.bot = b.id;
    }

    function buy(tier) {
        const b = bot(app.dataset.bot);
        const name = { premium: 'Premium', plus: 'Premium+', pass: 'Prism Pass' }[tier];
        const price = C.prices[tier][period];
        const link = C.payments[tier];
        const target = link ? `${link}${link.includes('?') ? '&' : '?'}bot=${b.id}&plan=${tier}&period=${period}` : C.supportUrl;
        openModal(`<h2>${tier === 'pass' ? 'Prism Pass' : `${esc(b.name)} ${name}`}</h2>
            <p class="muted">${tier === 'pass' ? `Premium+ on all ${D.music.length} music bots for one server.` : 'Unlocks Premium for one server.'}</p>
            <div class="sum"><span>${name} · ${period}</span><b>${money(price)}</b></div>
            <ol><li>${link ? 'Complete the payment on the secure checkout page.' : 'Join the Prism Protocol server and open a <b>Premium</b> ticket. UPI and cards are accepted.'}</li>
                <li>Mention your server name. You will receive a key in DM.</li>
                <li>Redeem it with <span class="mono">/redeem</span> or in the dashboard.</li></ol>
            <div class="row"><button class="btn ghost" data-close>Cancel</button><a class="btn ${tier === 'pass' ? 'gold' : 'primary'}" data-focus href="${target}" target="_blank" rel="noopener">${link ? `Pay ${money(price)}` : 'Open a ticket'}</a></div>`);
    }

    // ── Dashboard ────────────────────────────────────────────────────────────────
    const dashState = {};

    function sidebar(activeId) {
        const item = b => `<a href="#/dashboard/${b.id}" class="${b.id === activeId ? 'on' : ''}" style="--accent:${b.hex}"><img src="${logo(b)}" alt=""><span>${esc(b.short || b.name)}</span></a>`;
        return `<aside class="side" aria-label="Bots"><h4>Free bots</h4>${D.music.map(item).join('')}<h4>Private</h4>${D.private.map(item).join('')}</aside>`;
    }

    function shell(activeId, inner) {
        app.innerHTML = `<div class="dash">${sidebar(activeId)}<section class="content fade">${auth.demo ? `<div class="demo-bar"><span>Demo mode · sample data, changes stay in this browser.</span><button class="btn sm ghost" data-logout>Exit demo</button></div>` : ''}${inner}</section></div>`;
    }

    function viewDashboardHome() {
        accent(null);
        shell(null, `<div class="dash-head"><div><h1>Dashboard</h1><div class="meta">Pick a bot to manage its servers.</div></div></div>
            <div class="grid">${BOTS.map(b => `<a class="server" href="#/dashboard/${b.id}" style="--accent:${b.hex}"><span class="ic"><img src="${logo(b)}" alt=""></span><span><b>${esc(b.name)}</b><small>${b.kind === 'free' ? 'Free · Premium' : 'Private'}</small></span></a>`).join('')}</div>`);
    }

    function loginGate(b, back) {
        shell(b.id, `<div class="login panel"><img class="logo" src="${logo(b)}" alt=""><h1>${esc(b.name)} dashboard</h1>
            <p>Log in with Discord to manage servers where you have <b>Manage Server</b>. We only ask for your username and server list.</p>
            <div class="row"><button class="btn discord" data-login="${back}">Login with Discord</button><button class="btn" data-demo="${back}">Try the demo</button></div>
            <p class="note">Your Discord token stays in this browser tab and is only sent to ${esc(b.name)}’s own API.</p></div>`);
    }

    async function viewDashboard(id, gid, tab) {
        const b = bot(id);
        if (!b) return viewNotFound();
        accent(b);
        const back = `#/dashboard/${id}${gid ? `/${gid}` : ''}`;
        if (b.id === 'roomtone') return viewRoomtone(b);
        if (!auth.user) return loginGate(b, back);

        const a = api(id);
        if (!auth.demo && !a.configured) {
            return shell(id, `<div class="login panel"><img class="logo" src="${logo(b)}" alt=""><h1>${esc(b.name)} is not connected yet</h1>
                <p>The bot owner needs to start the bot with <span class="mono">PANEL_API_PORT</span> and add its public URL to <span class="mono">js/config.js</span>. Meanwhile you can explore the dashboard with sample data.</p>
                <div class="row"><button class="btn primary" data-demo="${back}">Open demo</button><a class="btn ghost" href="https://github.com/krishyaa06/${b.repo}#-web-dashboard" target="_blank" rel="noopener">Setup guide</a></div></div>`);
        }

        if (!gid) {
            shell(id, `<div class="dash-head"><img class="logo" src="${logo(b)}" alt=""><div><h1>${esc(b.name)}</h1><div class="meta">Choose a server</div></div></div><div class="servers">${'<div class="server" aria-hidden="true"><span class="ic"></span><span><b>Loading…</b></span></div>'.repeat(3)}</div>`);
            try {
                const { guilds } = await a.guilds();
                const inv = inviteUrl(b);
                const list = guilds.map(g => {
                    const ic = g.icon ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=96" alt="">` : esc(g.initials || g.name.slice(0, 2).toUpperCase());
                    const isIn = g.botIn !== false;
                    const tier = g.tier && g.tier !== 'free' ? `<span class="chip gold">💎 ${g.tier === 'plus' ? 'Premium+' : 'Premium'}</span>` : '';
                    return isIn
                        ? `<a class="server" href="#/dashboard/${id}/${g.id}"><span class="ic">${ic}</span><span><b>${esc(g.name)}</b><small>${b.kind === 'free' ? (tier || 'Free plan') : 'Manage'}</small></span></a>`
                        : `<a class="server" href="${inv || C.supportUrl}" target="_blank" rel="noopener" style="opacity:.65"><span class="ic">${ic}</span><span><b>${esc(g.name)}</b><small>Invite ${esc(b.short || b.name)} →</small></span></a>`;
                }).join('');
                shell(id, `<div class="dash-head"><img class="logo" src="${logo(b)}" alt=""><div><h1>${esc(b.name)}</h1><div class="meta">Servers you manage</div></div></div>
                    ${guilds.length ? `<div class="servers">${list}</div>` : `<div class="empty panel"><h3>No servers found</h3><p>You need Manage Server permission in a server to configure it.</p></div>`}`);
            } catch (err) {
                shell(id, `<div class="empty panel"><h3>Could not reach ${esc(b.name)}</h3><p>${esc(err.message)}</p><button class="btn" data-login="${back}">Log in again</button></div>`);
            }
            return;
        }

        shell(id, `<div class="empty"><p class="mono dim">Loading server…</p></div>`);
        let data;
        try { data = await a.guild(gid); } catch (err) {
            return shell(id, `<div class="empty panel"><h3>Could not load this server</h3><p>${esc(err.message)}</p><a class="btn" href="#/dashboard/${id}">Back to servers</a></div>`);
        }
        dashState.data = data; dashState.botId = id; dashState.gid = gid;

        const tabs = b.kind === 'free'
            ? [['overview', 'Overview'], ['player', 'Player'], ['settings', 'Settings'], ['premium', '💎 Premium'], ['commands', 'Commands']]
            : b.id === 'sentinel' ? [['overview', 'Overview'], ['settings', 'Settings'], ['commands', 'Commands']]
                : [['overview', 'Event'], ['settings', 'Settings'], ['commands', 'Commands']];
        tab = tabs.some(t => t[0] === tab) ? tab : 'overview';
        const g = data.guild;
        const prem = data.extra?.premium;
        shell(id, `<div class="dash-head">
                <span class="server" style="width:auto;padding:0;border:0;background:none"><span class="ic">${g.icon ? `<img src="${g.icon}" alt="">` : esc(g.initials || g.name.slice(0, 2))}</span></span>
                <div><h1>${esc(g.name)}</h1><div class="meta"><img src="${logo(b)}" alt="" width="18" height="18" style="border-radius:5px"> ${esc(b.name)} · ${g.members?.toLocaleString() || '—'} members ${prem ? (prem.tier !== 'free' ? `<span class="chip gold">💎 ${esc(prem.name)}</span>` : '<span class="chip">Free plan</span>') : ''}</div></div>
                <div class="right"><a class="btn sm ghost" href="#/dashboard/${id}">Switch server</a>${b.kind === 'free' && prem?.tier === 'free' ? `<a class="btn sm gold" href="#/premium/${id}">Upgrade</a>` : ''}</div>
            </div>
            <div class="dtabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
            <div id="tab"></div>`);
        renderTab(b, tab);
    }

    function renderTab(b, tab) {
        const el = $('#tab');
        const data = dashState.data;
        const x = data.extra || {};
        history.replaceState(null, '', `#/dashboard/${b.id}/${dashState.gid}/${tab}`);
        if (tab === 'commands') { el.innerHTML = commandsBlock(b); return; }
        if (tab === 'settings') { el.innerHTML = settingsForm(b, data); return; }
        if (tab === 'premium') { el.innerHTML = premiumTab(b, x.premium); return; }
        if (tab === 'player') { el.innerHTML = playerPanel(b, x.player, true); return; }

        if (b.kind === 'free') {
            const s = data.settings;
            const week = x.weekly || [];
            const max = Math.max(1, ...week.map(w => w.value));
            el.innerHTML = `<div class="kpis">
                    <div class="kpi"><span>Plan</span><b>${esc(x.premium.name)}</b><small>${x.premium.expiresAt ? `until ${new Date(x.premium.expiresAt).toLocaleDateString()}` : x.premium.tier === 'free' ? 'free forever' : 'lifetime'}</small></div>
                    <div class="kpi"><span>Queue limit</span><b>${x.premium.limits.queueLimit.toLocaleString()}</b><small>tracks</small></div>
                    <div class="kpi"><span>24/7</span><b>${s.alwaysOn ? 'On' : 'Off'}</b><small>${x.premium.limits.alwaysOn ? 'available' : 'needs Premium'}</small></div>
                    <div class="kpi"><span>Default volume</span><b>${s.defaultVolume}%</b><small>max ${x.premium.limits.maxVolume}%</small></div>
                </div>
                <div class="two">${playerPanel(b, x.player, false)}
                ${week.length ? `<div class="panel"><h3>Tracks played · 7 days</h3><div class="chart">${week.map(w => `<div style="height:${(w.value / max) * 100}%" title="${w.value} tracks"></div>`).join('')}</div><div class="chart-x">${week.map(w => `<span>${w.day}</span>`).join('')}</div></div>` : `<div class="panel"><h3>Quick links</h3><ul class="list"><li>Change the DJ role and volume in Settings</li><li>Redeem a key in the Premium tab</li></ul></div>`}</div>`;
            return;
        }
        if (b.id === 'sentinel') {
            el.innerHTML = `<div class="kpis"><div class="kpi"><span>Members</span><b>${data.guild.members?.toLocaleString() || '—'}</b></div><div class="kpi"><span>Warnings</span><b>${x.warnings ?? 0}</b><small>all time</small></div><div class="kpi"><span>Open tickets</span><b>${x.openTickets ?? 0}</b></div><div class="kpi"><span>Ranked members</span><b>${x.leaderboard?.length ?? 0}</b><small>top 10 shown</small></div></div>
                <div class="panel"><h3>⚡ XP leaderboard</h3>${x.leaderboard?.length ? `<ol class="lb">${x.leaderboard.map((r, i) => `<li><b>#${i + 1}</b><span>${esc(r.name)}</span><span class="mono">Lv ${r.level} · ${r.xp} xp</span></li>`).join('')}</ol>` : '<p class="muted">No XP yet. Members earn XP by chatting.</p>'}</div>`;
            return;
        }
        // arena
        const e = x.event;
        const statusChip = { live: 'green', upcoming: 'accent', judging: 'gold', ended: '' };
        el.innerHTML = `${e ? `<div class="panel" style="margin-bottom:18px"><h3>⚔️ ${esc(e.name)} <span class="chip ${statusChip[e.status] || ''}">${e.status}</span></h3>
                <p class="muted" style="margin:0">${new Date(e.startsAt).toLocaleString()} → ${new Date(e.endsAt).toLocaleString()} · teams up to ${e.maxTeamSize}</p></div>` : `<div class="panel" style="margin-bottom:18px"><h3>No event running</h3><p class="muted" style="margin:0">Start one in Discord with <span class="mono">/event create</span>.</p></div>`}
            <div class="kpis"><div class="kpi"><span>Teams</span><b>${x.teams ?? 0}</b></div><div class="kpi"><span>Submissions</span><b>${x.submissions ?? 0}</b></div><div class="kpi"><span>Past events</span><b>${x.pastEvents ?? 0}</b></div><div class="kpi"><span>Challenge solvers</span><b>${x.challengeLeaders?.length ?? 0}</b></div></div>
            <div class="two"><div class="panel"><h3>🏆 Rankings</h3>${x.rankings?.length ? `<ol class="lb">${x.rankings.map((r, i) => `<li><b>#${i + 1}</b><span>${esc(r.team)}</span><span class="mono">${r.average} · ${r.judges} judges</span></li>`).join('')}</ol>` : '<p class="muted">No scored submissions yet.</p>'}</div>
            <div class="panel"><h3>🧩 Challenge points</h3>${x.challengeLeaders?.length ? `<ol class="lb">${x.challengeLeaders.map((r, i) => `<li><b>#${i + 1}</b><span>${esc(r.name)}</span><span class="mono">${r.points} pts</span></li>`).join('')}</ol>` : '<p class="muted">No challenges solved yet.</p>'}</div></div>`;
    }

    function playerPanel(b, p, full) {
        if (!p || !p.current) {
            return `<div class="panel"><h3>${b.emoji.brand} Player</h3><div class="empty" style="padding:24px 10px"><h3>Nothing playing</h3><p>Join a voice channel and run <span class="mono">/play</span> in Discord.</p></div></div>`;
        }
        const t = p.current;
        const pct = t.duration ? Math.min(100, (t.position / t.duration) * 100) : 100;
        return `<div class="panel"><h3>${b.emoji.brand} Now playing ${p.filter && p.filter !== 'off' ? `<span class="chip gold">${esc((D.filters.find(f => f.id === p.filter) || {}).label || p.filter)}</span>` : ''}</h3>
            <div class="np"><div class="art" aria-hidden="true">${b.emoji.brand}</div><div><h4>${esc(t.title)}</h4><p>${esc(t.author || '')}</p>
            <div class="prog"><i style="width:${pct}%"></i></div><div class="times"><span>${fmt(t.position)}</span><span>${t.live ? 'LIVE' : fmt(t.duration)}</span></div>
            <div class="ctrl"><button class="btn sm" data-act="${p.paused ? 'resume' : 'pause'}">${p.paused ? '▶ Resume' : '❚❚ Pause'}</button><button class="btn sm" data-act="skip">⏭ Skip</button><button class="btn sm" data-act="stop">■ Stop</button><span class="chip">Vol ${p.volume}%</span><span class="chip">Loop ${p.loop}</span></div></div></div>
            ${full ? `<h3 style="margin-top:22px">Up next <span class="chip">${p.queueLength}</span></h3>${p.queue.length ? `<ol class="queue">${p.queue.map(q => `<li>${esc(q.title)}<span>${q.live ? 'LIVE' : fmt(q.duration)}</span></li>`).join('')}</ol>` : '<p class="muted">Queue is empty.</p>'}` : ''}</div>`;
    }

    function settingsForm(b, data) {
        const premiumTier = data.extra?.premium?.tier;
        const isFree = b.kind === 'free' && premiumTier === 'free';
        const opt = (list, val, none = 'None') => `<option value="">${none}</option>${list.map(o => `<option value="${esc(o.id)}" ${o.id === val ? 'selected' : ''}>${esc(o.label || o.name)}</option>`).join('')}`;
        const rows = data.schema.map(f => {
            const v = data.settings[f.key];
            const locked = f.premium && isFree;
            let input;
            if (f.type === 'boolean') input = `<span class="switch"><input type="checkbox" name="${f.key}" ${v ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-label="${esc(f.label)}"><i></i></span>`;
            else if (f.type === 'number') input = `<input type="number" name="${f.key}" value="${esc(v)}" min="${f.min}" max="${Math.min(f.max, data.extra?.premium?.limits?.maxVolume || f.max)}">`;
            else if (f.type === 'text') input = `<textarea name="${f.key}" maxlength="${f.max || 1000}">${esc(v)}</textarea>`;
            else if (f.type === 'role') input = `<select name="${f.key}">${opt(data.roles.map(r => ({ id: r.id, label: `@${r.name}` })), v, f.key === 'djRoleId' ? 'Everyone' : 'None')}</select>`;
            else if (f.type === 'channel') input = `<select name="${f.key}">${opt(data.channels.map(c => ({ id: c.id, label: `#${c.name}` })), v, 'Off')}</select>`;
            else if (f.type === 'category') input = `<select name="${f.key}">${opt(data.categories || [], v, 'None')}</select>`;
            else if (f.type === 'select') {
                const list = (data.options || {})[f.options] || [];
                input = `<select name="${f.key}" ${locked ? 'disabled' : ''}>${f.options === 'filters' ? list.map(o => `<option value="${o.id}" ${o.id === v ? 'selected' : ''}>${esc(o.label)}</option>`).join('') : opt(list, v, 'Default')}</select>`;
            }
            return `<div class="field ${locked ? 'locked' : ''}"><div><label>${esc(f.label)} ${f.premium ? '<span class="chip gold">💎 Premium</span>' : ''}</label><p>${esc(f.help || '')}</p></div>${input}</div>`;
        }).join('');
        return `<form class="panel form" id="settings" novalidate>${rows}
            <div class="savebar"><span class="muted" style="font-size:var(--text-sm)">${isFree ? 'Some options need Premium. <a href="#/premium/' + b.id + '">Upgrade</a>' : 'Changes apply instantly in Discord.'}</span><button class="btn primary" type="submit">Save changes</button></div></form>`;
    }

    function readForm(form, schema) {
        const patch = {};
        for (const f of schema) {
            const el = form.elements[f.key];
            if (!el || el.disabled) continue;
            if (f.type === 'boolean') patch[f.key] = el.checked;
            else if (f.type === 'number') patch[f.key] = Number(el.value);
            else if (f.type === 'text') patch[f.key] = el.value;
            else patch[f.key] = el.value === '' ? (f.options === 'filters' ? 'off' : null) : el.value;
        }
        return patch;
    }

    function premiumTab(b, prem) {
        const active = prem.tier !== 'free';
        return `<div class="two"><div class="panel"><h3>💎 Plan</h3>
            <p style="font-size:1.4rem;margin:0 0 4px"><b>${esc(prem.name)}</b></p>
            <p class="muted" style="margin:0 0 16px">${active ? (prem.expiresAt ? `Active until ${new Date(prem.expiresAt).toLocaleDateString(undefined, { dateStyle: 'long' })}.` : 'Lifetime.') : 'This server is on the free plan.'}</p>
            <ul class="list"><li>Queue: <b>${prem.limits.queueLimit.toLocaleString()}</b> tracks</li><li>Volume: up to <b>${prem.limits.maxVolume}%</b></li><li>Filters: <b>${prem.limits.filters ? 'unlocked' : 'locked'}</b></li><li>24/7 + autoplay: <b>${prem.limits.alwaysOn ? 'unlocked' : 'locked'}</b></li><li>Playlists: <b>${prem.limits.playlists}</b></li></ul>
            <a class="btn gold" style="margin-top:16px" href="#/premium/${b.id}">${active ? 'Extend or upgrade' : 'See plans'}</a></div>
            <div class="panel"><h3>🔑 Redeem a key</h3><p class="muted" style="margin-top:0">Paste the key you received after buying. Time stacks on the same plan.</p>
            <form class="redeem" id="redeem"><input name="key" placeholder="${b.keyPrefix}-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" aria-label="Premium key" required><button class="btn primary" type="submit">Redeem</button></form>
            ${auth.demo ? `<p class="note">Demo: try <span class="mono">${DEMO.sampleKey(b.id)}</span></p>` : ''}</div></div>`;
    }

    async function viewRoomtone(b) {
        const a = api('roomtone');
        shell(b.id, `<div class="dash-head"><img class="logo" src="${logo(b)}" alt=""><div><h1>${esc(b.name)}</h1><div class="meta">Prism Protocol music nights · live status</div></div></div><div id="rt" class="empty"><p class="mono dim">Checking status…</p></div>`);
        let s;
        try { s = await a.status(); } catch { s = null; }
        const demo = auth.demo || !a.configured;
        const online = Boolean(s && (s.online === true || s.state === 'online' || s.state === 'connected' || s.state === 'ready'));
        $('#rt').outerHTML = `${demo ? `<div class="demo-bar"><span>${a.configured ? 'Demo data' : 'Roomtone’s status API is not linked yet, showing sample data.'}</span></div>` : ''}
            <div class="kpis"><div class="kpi"><span>Status</span><b><span class="dot ${online ? 'on' : ''}"></span> ${online ? 'Online' : 'Offline'}</b></div>
            <div class="kpi"><span>Latency</span><b>${s?.ping ?? s?.latencyMs ?? '—'}${(s?.ping ?? s?.latencyMs) != null ? 'ms' : ''}</b></div>
            <div class="kpi"><span>Servers</span><b>${s?.servers ?? s?.guildCount ?? '—'}</b></div>
            <div class="kpi"><span>Uptime</span><b>${s?.uptime ? ago(s.uptime) : '—'}</b></div></div>
            <div class="two">${commandsBlock(b)}<div class="panel"><h3>About</h3><p class="muted">${esc(b.description)}</p><p class="muted">Playback is controlled in Discord. This page is read-only.</p><a class="btn sm" href="https://github.com/krishyaa06/${b.repo}" target="_blank" rel="noopener">Source</a></div></div>`;
    }

    function viewNotFound() {
        accent(null);
        app.innerHTML = `<div class="wrap empty" style="padding-block:80px"><div class="eyebrow">404</div><h3>Page not found</h3><p><a class="btn" href="#/">Back to bots</a></p></div>`;
    }

    // ── Router ───────────────────────────────────────────────────────────────────
    function route() {
        const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
        const page = parts[0] || 'home';
        $$('.nav a[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === page));
        closeModal();
        window.scrollTo(0, 0);
        if (page === 'home') return viewHome();
        if (page === 'bot') return viewBot(parts[1]);
        if (page === 'premium') return viewPremium(parts[1]);
        if (page === 'dashboard') return parts[1] ? viewDashboard(parts[1], parts[2], parts[3]) : viewDashboardHome();
        return viewNotFound();
    }

    // ── Events ───────────────────────────────────────────────────────────────────
    document.addEventListener('click', async e => {
        const t = e.target.closest('button, a');
        if (!t) { if (e.target.id === 'modal') closeModal(); return; }
        if (t.dataset.login !== undefined) { e.preventDefault(); return auth.login(t.dataset.login || location.hash); }
        if (t.dataset.demo !== undefined) { e.preventDefault(); return auth.startDemo(t.dataset.demo); }
        if (t.dataset.logout !== undefined) return auth.logout();
        if (t.dataset.close !== undefined) return closeModal();
        if (t.dataset.pick) { location.hash = `#/premium/${t.dataset.pick}`; return; }
        if (t.dataset.period) { period = t.dataset.period; return viewPremium(app.dataset.bot); }
        if (t.dataset.buy) return buy(t.dataset.buy);
        if (t.dataset.cat) {
            const panel = t.closest('.panel');
            $$('.tabs button', panel).forEach(b => b.classList.toggle('on', b === t));
            $$('.cmd', panel).forEach(c => { c.hidden = t.dataset.cat !== 'all' && c.dataset.c !== t.dataset.cat; });
            return;
        }
        if (t.dataset.tab) {
            $$('.dtabs button').forEach(b => { b.classList.toggle('on', b === t); b.setAttribute('aria-selected', b === t); });
            return renderTab(bot(dashState.botId), t.dataset.tab);
        }
        if (t.dataset.act) {
            try {
                const r = await api(dashState.botId).action(dashState.gid, t.dataset.act);
                if (r.ok === false) throw new Error(r.error || 'Action failed');
                toast({ pause: 'Paused', resume: 'Resumed', skip: 'Skipped', stop: 'Stopped' }[t.dataset.act]);
                if (!auth.demo) { dashState.data = await api(dashState.botId).guild(dashState.gid); renderTab(bot(dashState.botId), $('.dtabs .on')?.dataset.tab || 'overview'); }
            } catch (err) { toast(err.message, true); }
        }
    });

    document.addEventListener('submit', async e => {
        const form = e.target;
        if (form.id === 'settings') {
            e.preventDefault();
            const btn = $('button[type=submit]', form);
            btn.disabled = true; btn.textContent = 'Saving…';
            try {
                const { settings } = await api(dashState.botId).save(dashState.gid, readForm(form, dashState.data.schema));
                dashState.data.settings = settings;
                toast('Settings saved ✓');
            } catch (err) { toast(err.message, true); }
            btn.disabled = false; btn.textContent = 'Save changes';
        }
        if (form.id === 'redeem') {
            e.preventDefault();
            const key = form.elements.key.value.trim();
            try {
                const r = await api(dashState.botId).action(dashState.gid, 'redeem', { key });
                if (!r.ok) throw new Error(r.error);
                toast(`${r.tier.name} activated 💎`);
                dashState.data = await api(dashState.botId).guild(dashState.gid);
                viewDashboard(dashState.botId, dashState.gid, 'premium');
            } catch (err) { toast(err.message, true); }
        }
    });

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    window.addEventListener('hashchange', route);

    (async () => {
        consumeOAuthRedirect();
        await auth.loadUser();
        renderWho();
        route();
    })();
})();
