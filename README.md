# Web Gallery

A self-hosted web application designed to capture your favorites from various social media and gallery sites and manage them locally

Websites go down, creators are banned, users lose access to their favorite content more and more these days. **Web Gallery** aims to provide a safe haven for your media collection.

By leveraging powerful scraping tools like `gallery-dl` and `yt-dlp`, this application allows you to create a local, permanent copy of the content you value. It provides a simple web interface to browse, search, and rediscover your favorite media, free from the risks of censorship or data lockout.

## Table of Contents

- [Project Status](#project-status)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Option A: Docker Compose (Recommended)](#option-a-docker-compose-recommended)
  - [Option B: Direct Installation (Node.js/npm)](#option-b-direct-installation-nodejsnpm)
  - [Usage](#usage)
- [Technology Stack](#technology-stack)
- [Development Mode](#development-mode)
- [Documentation](#documentation)
- [Disclaimer](#disclaimer)
- [License](#license)

## Project Status

> [!IMPORTANT]
> This project is currently in an **Early Alpha** stage.
>
> - Most implemented features provide only basic functionality.
> - Many features listed in the roadmap have not yet been started.
> - Expect bugs, breaking changes, and incomplete UI.

## Features

- **Automated Scraping**: Seamlessly download media from various social media, streaming, and gallery sites using `gallery-dl` (with `yt-dlp` integration planned).
- **Multiple Viewing Modes**:
  - **Waterfall Gallery**: A modern masonry layout that preserves the original aspect ratio of your images and videos.
  - **Chronological Timeline**: View your collected items in the order they were originally posted or captured.
- **Playlists**: Organize media into custom playlists, customize item ordering, and view/play them seamlessly.
- **Deep Metadata Integration**: Automatically extracts and stores rich metadata (e.g., Twitter user profiles, tweet details, timestamps) in a local SQLite database for advanced search.
- **Background Scraping**: Support for continuing long-running backfills and historical data extraction.
- **Privacy & Ownership**: Everything is stored locally on your machine. You own the data, the metadata, and the archive.

## Getting Started

We support two setup options: **Docker Compose** (recommended, as it bundles all dependencies) and **Node.js/npm** installation.

---

### Option A: Docker Compose (Recommended)

Docker is the simplest way to deploy Web Gallery. The image bundles the Next.js standalone application along with all system dependencies needed by the scrapers (`python3`, `gallery-dl`, `yt-dlp`, and `ffmpeg`).

#### 1. Clone the Repository
```bash
git clone https://github.com/Darkkal/web-gallery.git
cd web-gallery
```

#### 2. Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
*(Optional)* Open `.env` and adjust `WEBGALLERY_DATA_DIR` and `WEBGALLERY_MEDIA_DIR` to your preferred host paths. By default, they will save to `./webgallery-data` and `./webgallery-media` inside the project folder.

> [!TIP]
> For advanced configurations, including cookie-based authentication for websites requiring login, see [docs/configuration.md](./docs/configuration.md).

#### 3. Launch the App
Run the following command to build and launch the container in the background:
```bash
docker compose up -d --build
```
The database will automatically initialize and apply any pending migrations on startup. Open [http://localhost:3000](http://localhost:3000) in your browser to begin.

---

### Option B: Direct Installation (Node.js/npm)

If you prefer to run the application directly on your host system without Docker, follow these steps.

#### 1. System Prerequisites
Ensure the following are installed and accessible in your system's `PATH`:
- **Node.js** (LTS version recommended)
- **Python 3** (required for scrapers)
- **gallery-dl** (e.g. via `pip3 install gallery-dl` or your package manager)
- **yt-dlp** (e.g. via `pip3 install yt-dlp` or your package manager)
- **ffmpeg** (highly recommended for merging video and audio streams)

#### 2. Clone and Install
```bash
# Clone the repository
git clone https://github.com/Darkkal/web-gallery.git
cd web-gallery

# Install dependencies
npm install
```

#### 3. Build and Start the Production Server
```bash
# Build the production-optimized Next.js app
npm run build

# Start the production server
npm run start
```
The database migrations are applied automatically at startup when the application boots up. Open [http://localhost:3000](http://localhost:3000) to view the app.

> [!NOTE]
> For production deployment, you can configure custom data/media storage folders by setting the `DATA_DIR` and `MEDIA_DIR` environment variables before starting the server. See [docs/configuration.md](./docs/configuration.md) for full reference.

### Usage

To start populating your timeline and gallery views with posts, you need to scrape some posts from a source.

#### 1. Add a source

Go to the sources page and add a source. 

Example Sources:

- a link to a social media feed 
  - user profile
  - a search
  - your likes feed (requires cookes)
- a search on a gallery site like danbooru
- any site supported by `gallery-dl` or `yt-dlp`
> [!NOTE]
> If you want to access content like your favorites or sources that require authentication, you will have to go to the settings page and choose which browser to use cookies from. Individual cookies/auth token support may come in a future release

#### 2. Start a scrape task

1. Go to the scrape page and create a scrape task. 
  - The download limits can let you test to see if it works before trying to scrape the entire history. 
2. When you create a scrape task, it will appear below in the task list. You can press the play button to start the scrape task, or use the lightning button for a quick update (stops after skipping 15 files already downloaded).
3. You can view the scrape task in progress by switching to the history tab on the right.
4. When the scrape task is stopped or finishes, it will trigger a library scan. After the library scan, your posts should appear in the timeline and gallery pages.

---

## Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: [SQLite](https://www.sqlite.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Scraper Engine**: [gallery-dl](https://github.com/mikf/gallery-dl)
- **Styling**: Vanilla CSS Modules
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Playwright](https://playwright.dev/)

## Development Mode

If you are looking to contribute or run the application in a development environment:

1. Follow steps 1-3 from **Option B: Direct Installation**.
2. Start the hot-reloading development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system architecture, subsystem design, data flow, and key design decisions
- [docs/configuration.md](./docs/configuration.md) — environment variables, gallery-dl config, Docker volumes, and backup guidance
- [docs/adding-a-platform.md](./docs/adding-a-platform.md) — step-by-step guide for adding support for a new scraping platform
- [CONTRIBUTING.md](./CONTRIBUTING.md) — coding patterns and conventions for contributors

## Disclaimer

### Usage

**Web Gallery** is a tool intended for personal use and the archival of content for which you have legal access. The developers of this software are not responsible for how you use the tool, nor for any content you choose to scrape or store.

Users are responsible for:

- Complying with the Terms of Service of any website they scrape.
- Adhering to local and international copyright laws.
- Ensuring their use of the software is legal in their jurisdiction.

This software is provided "as is," without warranty of any kind.

### AI Assistance Notice

This codebase has been developed with AI assistance. 

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
