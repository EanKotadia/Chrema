# CHRÈMA 
### Built by students. *For students.*

Chréma Magazine is a student-driven publication exploring technology, science, design, and research through honest, thoughtful writing. We believe ideas matter more than credentials. Every student has something worth saying — **Chréma is where they say it.**

### [**Website Link**](https://chrema.vercel.app)
---

## 01 / THE CORE PILLS
* **I. Voice:** Every student deserves a platform. We help young writers find their voice and share it with the world.
* **II. Empowerment:** Writing builds confidence. Putting words on a page is an act of courage — and we celebrate that.
* **III. Curiosity:** From science to culture, we cover what students are actually thinking about.
* **IV. Community:** Chréma isn't just a magazine. It’s a space where students support each other’s growth as thinkers and creators.

---

## 02 / DEVELOPMENT SETUP

To contribute to the architecture and backend infrastructure of Chréma, follow the steps below.

### Prerequisites
* Node.js (LTS)
* npm

### Installation
Clone the repository and install the dependencies to generate the `node_modules` directory:

```bash
git clone [https://github.com/EanKotadia/Chrema.git](https://github.com/EanKotadia/Chrema.git)
cd Chrema
npm install
```

### Environment Configuration
Create a .env file in the root directory to connect to the database and enable administrative access.

### Required Keys:
```bash
REACT_APP_SUPABASE_URL=YOUR_SUPABASE_URL
REACT_APP_SUPABASE_KEY=YOUR_SUPABASE_ANON_KEY
REACT_APP_PASSCODE=YOUR_ADMIN_PASSCODE
```
```bash
npm start
```

## 03 / PROJECT ARCHITECTURE
Based on the Chréma design system, the repository is structured as follows:

```bash

Chrema/
├── src/
│   ├── components/     # UI Elements (Footer, TeamCard, Nav)
│   ├── pages/          # View Layers (AboutPage, Magazine)
│   ├── App.js          # Logic & Routing
│   ├── index.js        # Pixel-perfect rendering
│   └── AboutPage.css   # Accents, Tickers, & Grid Layouts
├── public/             # Static Assets
├── .env                # Local Credentials (Ignored)
└── package.json        # Dependencies
```
## 04 / THE TEAM
Amitesh — Founder & Editor-in-Chief A passionate advocate for young voices who believes giving students space to write is the most powerful investment in the next generation.

Ean — Co-Founder & Technology The mind behind the pixels. A tech-savvy science student who built the backend infrastructure and architecture of Chréma from the ground up.

## 05 / JOIN THE MISSION
Have something to say? We’re always looking for curious, passionate writers. No experience needed — just a perspective worth sharing.

[Submit an Article](https://chrema.vercel.app/submit)
