/**
 * Prism Bots Panel configuration. This is the only file you need to edit.
 *
 * 1. oauthClientId  Create one Discord application for the panel login
 *                   (Developer Portal -> OAuth2). Add this page's URL as a
 *                   Redirect, e.g. https://krishyaa06.github.io/prism-bots-panel/
 * 2. bots.*.clientId  Each bot's Application ID (used for Invite buttons).
 * 3. bots.*.apiUrl    Public URL of the bot's panel API (PANEL_API_PORT),
 *                     e.g. https://cosmicmix.yourhost.com  (HTTPS required).
 * 4. payments       Checkout links for Premium (Razorpay payment page, UPI
 *                   link, Ko-fi, Patreon...). Empty = buyers are sent to the
 *                   support server to open a ticket.
 * Nothing here is secret: never put a bot token in this file.
 */
window.PRISM_CONFIG = {
    oauthClientId: '',
    supportUrl: 'https://dc.gg/prismprotocol',
    githubUrl: 'https://github.com/krishyaa06',
    currency: '₹',
    prices: {
        premium: { monthly: 99, yearly: 999 },
        plus: { monthly: 249, yearly: 2499 },
        pass: { monthly: 399, yearly: 3999 }
    },
    payments: {
        premium: '',
        plus: '',
        pass: ''
    },
    bots: {
        cosmicmix: { clientId: '', apiUrl: '' },
        echoarena: { clientId: '', apiUrl: '' },
        midnight: { clientId: '', apiUrl: '' },
        neonpulse: { clientId: '', apiUrl: '' },
        royalwave: { clientId: '', apiUrl: '' },
        roomtone: { clientId: '', apiUrl: '' },
        sentinel: { clientId: '', apiUrl: '' },
        arena: { clientId: '', apiUrl: '' }
    }
};
