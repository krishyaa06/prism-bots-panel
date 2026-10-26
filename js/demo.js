/**
 * Demo mode: realistic sample data so the panel can be explored before a bot
 * API is connected. Settings changes are kept in this browser only.
 */
(function () {
    const D = window.PRISM_DATA;
    const KEY = 'prism_demo_state_v1';
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
    const store = load();
    const persist = () => localStorage.setItem(KEY, JSON.stringify(store));

    const user = { id: '1000000000000000001', username: 'krishyaa', avatar: null, demo: true };

    const guilds = [
        { id: '1100000000000000001', name: 'Prism Protocol', initials: 'PP', members: 1284, tier: 'plus' },
        { id: '1100000000000000002', name: 'Night Owls Club', initials: 'NO', members: 342, tier: 'premium' },
        { id: '1100000000000000003', name: 'Valorant Squad', initials: 'VS', members: 58, tier: 'free' },
        { id: '1100000000000000004', name: 'Study & Chill', initials: 'SC', members: 911, tier: 'free', botIn: false }
    ];

    const channels = ['welcome', 'rules', 'announcements', 'general', 'music', 'mod-logs', 'level-ups', 'hackathon'].map((name, i) => ({ id: `12000000000000000${10 + i}`, name }));
    const categories = ['Community', 'Teams', 'Voice'].map((name, i) => ({ id: `12100000000000000${10 + i}`, name }));
    const roles = [['Admin', '#ff3366'], ['Moderator', '#6c63ff'], ['DJ', '#00d2ff'], ['Judge', '#ffc857'], ['Organizer', '#ff5ea8'], ['Member', '#a7a3c9']]
        .map(([name, color], i) => ({ id: `13000000000000000${10 + i}`, name, color }));

    const tracks = [
        ['Midnight City (Synth Cover)', 'neonwave', 214], ['Lofi Rain at 2AM', 'sleepyfox', 156], ['Orbit', 'Kaizen Beats', 198],
        ['Vapor Dreams', 'Sundial', 245], ['Golden Hour Lounge', 'RoyaleSax', 233], ['Respawn', 'Pixel Arcade', 172], ['Night Drive', 'Hollow Coves', 205]
    ].map(([title, author, duration]) => ({ title, author, duration, source: 'soundcloud', url: '#' }));

    function musicSettings(gid, tier) {
        const def = { djRoleId: null, defaultVolume: 80, announceTracks: true, voteSkip: false, autoLeave: true, alwaysOn: tier !== 'free', autoplay: tier === 'plus', defaultFilter: 'off', favouriteStation: null };
        return { ...def, ...(store[`m:${gid}`] || {}) };
    }

    function weekly(seed) {
        const out = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            out.push({ day: d.toLocaleDateString('en', { weekday: 'short' }), value: Math.round(40 + Math.abs(Math.sin(seed + i)) * 160) });
        }
        return out;
    }

    function guildData(botId, gid) {
        const g = guilds.find(x => x.id === gid) || guilds[0];
        const base = { guild: { id: g.id, name: g.name, icon: null, initials: g.initials, members: g.members }, channels, roles, categories };
        const music = D.music.find(b => b.id === botId);
        if (music) {
            const tier = store[`tier:${botId}:${gid}`] || g.tier;
            const playing = tier !== 'free' || gid.endsWith('3');
            return {
                ...base,
                schema: D.musicSchema,
                options: { filters: D.filters, stations: music.stations.map(s => ({ id: s.id, label: `${s.name} · ${s.genre}` })) },
                settings: musicSettings(gid, tier),
                extra: {
                    premium: { tier, name: D.tiers[tier].name, expiresAt: tier === 'free' ? null : Date.now() + 23 * 86400000, limits: D.tiers[tier] },
                    tiers: D.tiers,
                    player: playing ? {
                        current: { ...tracks[(gid.length + botId.length) % tracks.length], position: 74, requestedBy: { id: user.id, tag: 'krishyaa' } },
                        queue: tracks.slice(0, 5), queueLength: 5, loop: 'off', volume: 80, filter: tier === 'free' ? 'off' : 'bassboost', paused: false
                    } : null,
                    weekly: weekly(gid.length + botId.length)
                }
            };
        }
        if (botId === 'sentinel') {
            const def = { welcomeChannelId: channels[0].id, logChannelId: channels[5].id, autoRoleId: roles[5].id, levelUpChannelId: channels[6].id, welcomeMessage: 'Welcome to **{server}**, {user}! You are member **#{count}** 🎉' };
            return {
                ...base,
                schema: [
                    { key: 'welcomeChannelId', type: 'channel', label: 'Welcome channel', help: 'Where welcome cards are posted. Empty = off.' },
                    { key: 'welcomeMessage', type: 'text', label: 'Welcome message', max: 1000, help: 'Placeholders: {user} {username} {server} {count}' },
                    { key: 'autoRoleId', type: 'role', label: 'Auto-role', help: 'Given to every new member.' },
                    { key: 'logChannelId', type: 'channel', label: 'Moderation log channel', help: 'Warns, timeouts, kicks and bans are logged here.' },
                    { key: 'levelUpChannelId', type: 'channel', label: 'Level-up channel', help: 'Empty = same channel as the message.' }
                ],
                settings: { ...def, ...(store[`s:${gid}`] || {}) },
                extra: {
                    leaderboard: ['aarav.dev', 'riya_builds', 'krishyaa', 'kabir.codes', 'meera', 'ishaan', 'tanvi.ui', 'dev_om'].map((name, i) => ({ name, level: 24 - i * 2, xp: 900 - i * 80 })),
                    warnings: 17, openTickets: 3, weekly: weekly(9)
                }
            };
        }
        if (botId === 'arena') {
            const def = { announceChannelId: channels[2].id, organizerRoleId: roles[4].id, judgeRoleId: roles[3].id, teamCategoryId: categories[1].id };
            return {
                ...base,
                schema: [
                    { key: 'announceChannelId', type: 'channel', label: 'Announcements channel', help: 'Event start, reminders and winners are posted here.' },
                    { key: 'organizerRoleId', type: 'role', label: 'Organizer role', help: 'Can create and end events.' },
                    { key: 'judgeRoleId', type: 'role', label: 'Judge role', help: 'Can score submitted projects with /judge.' },
                    { key: 'teamCategoryId', type: 'category', label: 'Team channels category', help: 'Private team channels are created here.' }
                ],
                settings: { ...def, ...(store[`a:${gid}`] || {}) },
                extra: {
                    event: { name: 'Prism Hack Week #4', status: 'live', startsAt: Date.now() - 2 * 86400000, endsAt: Date.now() + 3 * 86400000 + 4 * 3600000, maxTeamSize: 4 },
                    teams: 23, submissions: 9, pastEvents: 3,
                    rankings: [['Byte Busters', 34.5, 3], ['Null Pointers', 33.25, 3], ['Team Quasar', 31, 2], ['404 Sleep', 29.5, 3], ['Code Monks', 27, 2]].map(([team, average, judges]) => ({ team, average, judges })),
                    challengeLeaders: [['riya_builds', 145], ['aarav.dev', 120], ['kabir.codes', 95], ['tanvi.ui', 80]].map(([name, points]) => ({ name, points }))
                }
            };
        }
        return base;
    }

    function update(botId, gid, patch) {
        const k = { sentinel: 's', arena: 'a' }[botId] || 'm';
        store[`${k}:${gid}`] = { ...(store[`${k}:${gid}`] || {}), ...patch };
        persist();
        return guildData(botId, gid).settings;
    }

    function redeem(botId, gid, key) {
        const m = String(key || '').trim().toUpperCase().match(/^([A-Z]{3})-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
        const bot = D.music.find(b => b.id === botId);
        if (!m || m[1] !== bot.keyPrefix) return { ok: false, error: `Keys for ${bot.name} look like ${bot.keyPrefix}-XXXX-XXXX-XXXX.` };
        store[`tier:${botId}:${gid}`] = 'premium';
        persist();
        return { ok: true, tier: D.tiers.premium, expiresAt: Date.now() + 30 * 86400000 };
    }

    function status(botId) {
        const music = D.music.find(b => b.id === botId);
        return {
            online: true, servers: { cosmicmix: 214, echoarena: 168, midnight: 131, neonpulse: 187, royalwave: 96, roomtone: 1, sentinel: 1, arena: 1 }[botId] || 1,
            ping: 38 + (botId.length * 7) % 40, uptime: 86400 * 6 + 3600 * 5,
            playing: music ? 12 + botId.length : undefined, listeners: music ? 40 + botId.length * 6 : undefined
        };
    }

    window.PRISM_DEMO = { user, guilds, guildData, update, redeem, status, sampleKey: id => `${D.music.find(b => b.id === id).keyPrefix}-7F3A-C21D-9B04` };
})();
