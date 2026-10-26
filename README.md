<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f0c29,50:6C63FF,100:00D4FF&height=200&section=header&text=Prism%20Bots%20Panel&fontSize=48&fontColor=ffffff&animation=fadeIn&fontAlignY=36&desc=One%20dashboard%20for%20every%20Prism%20Protocol%20Discord%20bot&descAlignY=58&descSize=16" width="100%" />

[![Open the panel](https://img.shields.io/badge/Open-Prism_Bots_Panel-6C63FF?style=for-the-badge&logo=googlechrome&logoColor=white)](https://krishyaa06.github.io/prism-bots-panel/)
[![Premium](https://img.shields.io/badge/💎_Premium-from_₹99-FFC857?style=for-the-badge)](https://krishyaa06.github.io/prism-bots-panel/#/premium)
[![Discord](https://img.shields.io/badge/Prism_Protocol-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://dc.gg/prismprotocol)

</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png" width="100%" />

A static web dashboard for all eight Prism Protocol bots. Invite the bots, compare plans, buy and redeem Premium, and manage server settings after logging in with Discord. No build step, no server: plain HTML, CSS and JavaScript on GitHub Pages.

<p align="center"><img src="assets/screens/home.jpg" width="100%" alt="Prism Bots Panel home page" /></p>
<p align="center"><img src="assets/screens/dashboard.jpg" width="100%" alt="Server dashboard for Midnight Vibes" /></p>

## 🤖 Bots

| Bot | Type | Repo |
| --- | --- | --- |
| <img src="assets/bots/cosmicmix-logo.webp" width="22" /> CosmicMix DJ | Free music · 💎 Premium | [cosmicmix-dj-bot](https://github.com/krishyaa06/cosmicmix-dj-bot) |
| <img src="assets/bots/echoarena-logo.webp" width="22" /> EchoArena Player | Free music · 💎 Premium | [echoarena-player](https://github.com/krishyaa06/echoarena-player) |
| <img src="assets/bots/midnight-logo.webp" width="22" /> Midnight Vibes | Free music · 💎 Premium | [midnight-vibes-bot](https://github.com/krishyaa06/midnight-vibes-bot) |
| <img src="assets/bots/neonpulse-logo.webp" width="22" /> NeonPulse | Free music · 💎 Premium | [neonpulse-music-bot](https://github.com/krishyaa06/neonpulse-music-bot) |
| <img src="assets/bots/royalwave-logo.webp" width="22" /> RoyalWave DJ | Free music · 💎 Premium | [royalwave-dj-bot](https://github.com/krishyaa06/royalwave-dj-bot) |
| <img src="assets/bots/roomtone-logo.webp" width="22" /> Roomtone | Private · Prism Protocol | [roomtone-discord-music-bot](https://github.com/krishyaa06/roomtone-discord-music-bot) |
| <img src="assets/bots/sentinel-logo.webp" width="22" /> Prism Sentinel | Private · Prism Protocol | [prism-sentinel](https://github.com/krishyaa06/prism-sentinel) |
| <img src="assets/bots/arena-logo.webp" width="22" /> Prism Arena | Private · Prism Protocol | [prism-arena](https://github.com/krishyaa06/prism-arena) |

## ✨ What it does

- **Bot pages** with commands, radio stations and invite links
- **Premium page** with Free / Premium / Premium+ / Prism Pass plans, monthly or yearly
- **Dashboard**: Discord login, server picker, live player, settings, Premium redeem, stats
- **Demo mode** so anyone can try the dashboard with sample data
- Works on phones, keyboard friendly, respects reduced motion

## ⚙️ Setup

Everything lives in [`js/config.js`](js/config.js). Nothing in it is secret.

1. **Login:** create a Discord application for the panel, copy its ID into `oauthClientId`, and add `https://krishyaa06.github.io/prism-bots-panel/` under OAuth2 → Redirects.
2. **Invite buttons:** set each bot's `clientId` (its Application ID).
3. **Live data:** start a bot with `PANEL_API_PORT`, put it behind HTTPS and set its `apiUrl`. Each bot README has a "Web dashboard" section.
4. **Payments:** paste checkout links (Razorpay payment page, UPI, Ko-fi…) into `payments`. If empty, buyers are sent to the Discord server to open a ticket. After payment, create a key with `/genkey` and send it to the buyer.

## 🔒 How login works

The panel uses Discord's implicit OAuth2 flow with the `identify guilds` scope. The access token stays in the browser tab (session storage) and is only sent to the bot's own API, which checks **Manage Server** on every request.

## 🧑‍💻 Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png" width="100%" />

<div align="center">

Built by [Soumya Bhandare](https://github.com/krishyaa06) · [Prism Protocol](https://dc.gg/prismprotocol) · MIT License

</div>
