# Web Gallery

A self-hosted web application designed to capture your favorites from various social media and gallery sites and manage them locally

Websites go down, creators are banned, users lose access to their favorite content more and more these days. **Web Gallery** aims to provide a safe haven for your media collection.

By leveraging powerful scraping tools like `gallery-dl` and `yt-dlp`, this application allows you to create a local, permanent copy of the content you value. It provides a simple web interface to browse, search, and rediscover your favorite media, free from the risks of censorship or data lockout.

## Table of Contents

- [Project Status](#project-status)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Option A: Standalone Package (Recommended)](#option-a-standalone-package-recommended)
  - [Option B: Docker Compose](#option-b-docker-compose)
  - [Option C: Direct Installation (Node.js/npm)](#option-c-direct-installation-nodejsnpm)
  - [Usage](#usage)
- [Technology Stack](#technology-stack)
- [Development & Contributing](#development--contributing)
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

- **Automated Scraping & Scheduling**: Seamlessly download media from social media, streaming, and gallery sites using `gallery-dl` and `yt-dlp`. Features flexible scrape scheduling (Cron and interval-based), task queues, and background processing.
- **Tag Management**: Comprehensive tag management system with custom tag categories, hierarchical parent/child relationships, tag aliases, symmetric tag relations, and query-time search expansion.
- **Multiple Viewing Modes**:
  - **Waterfall Gallery**: A modern masonry layout that preserves the original aspect ratio of your images and videos.
  - **Chronological Timeline**: View your collected items in the order they were originally posted or captured.
- **Playlists**: Organize media into custom playlists, customize item ordering, and view/play them seamlessly.
- **Deep Metadata Integration**: Automatically extracts and stores rich metadata (e.g., Twitter user profiles, tweet details, timestamps) in a local SQLite database for advanced search.
- **Privacy & Ownership**: Everything is stored locally on your machine. You own the data, the metadata, and the archive.

## Getting Started

We support three setup options: **Standalone Package** (simplest method, using precompiled executables packaged via `@yao-pkg/pkg` with zero Node.js required), **Docker Compose**, and **Node.js/npm** direct installation.

---

### Option A: Standalone Package (Recommended)

The standalone binary is the simplest method to get started with Web Gallery. It packages the Next.js application into a single executable using `@yao-pkg/pkg`, requiring no Node.js or npm runtime installation.

#### 1. Download the Standalone Executable
Download the compiled release binary for your platform (Linux, macOS, or Windows) from the Releases page.

#### 2. Run the Dependency Installer
Web Gallery requires `gallery-dl`, `ffmpeg`, and `ffprobe` to perform media scraping and process dimensions. We provide helper scripts in the release to download and configure these dependencies locally:

- **Linux & macOS**:
  ```bash
  chmod +x scripts/setup-deps.sh
  ./scripts/setup-deps.sh
  ```
- **Windows** (PowerShell):
  ```powershell
  .\scripts\setup-deps.ps1
  ```

This will automatically download and place the latest precompiled binaries (`gallery-dl`, `ffmpeg`, `ffprobe`) into a local `./bin/` folder. The application will automatically detect and prioritize these local binaries.

#### 3. Run the Application
Start the standalone server (the executable name contains the version number, e.g., `v0.3.0`):

- **Linux / macOS**:
  ```bash
  ./web-gallery-v<version>-linux
  ```
- **Windows**:
  ```cmd
  web-gallery-v<version>-win.exe
  ```

By default:
- **Default Storage**: Writable application data and the database will be created in `./data/` (e.g. `./data/sqlite.db`), and downloaded media files will be saved in `./downloads/` inside the directory from which the executable is run.
- **Console URL & Browser Launch**: The application prints the exact hosting URL (e.g., `[Server] Web Gallery is running at: http://localhost:3000`) and automatically attempts to open the site in your default system web browser.

You can customize the host address and port by specifying the `HOSTNAME` and `PORT` environment variables:

```bash
# Example: Bind only to local loopback on port 8080
HOSTNAME=127.0.0.1 PORT=8080 ./web-gallery-v<version>-linux
```

Access the web interface at the printed URL (defaults to [http://localhost:3000](http://localhost:3000) or whichever hostname and port you configure).

> [!NOTE]
> You can override where the database, logs, and downloads are saved by setting `DATA_DIR` and `MEDIA_DIR` environment variables before executing the binary. Alternatively, you can place a `.env` file in the same directory as the executable, and the binary will automatically detect and load it on startup.

---

### Option B: Docker Compose

Docker Compose bundles the Next.js application along with system dependencies needed by scrapers (`python3`, `gallery-dl`, `yt-dlp`, and `ffmpeg`).

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

### Option C: Direct Installation (Node.js/npm)

If you prefer to run the application directly on your host system from source, follow these steps.

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

---

### Usage

To start populating your time#ine and gallery views with posts, you need to scrape some posts from a source.

#### 1. Add a source

Go to the sources page and add a source. 

Example Sources:

- a link to a social media feed 
  - user profile
  - a search
  - your likes feed (requires cookies)
- a search on a gallery site like danbooru
- any site supported by `gallery-dl` or `yt-dlp`
> [!NOTE]
> If you want to access content like your favorites or sources that require authentication, you will have to go to the settings page and choose which browser to use cookies from. Individual cookies/auth token support may come in a future release

#### 2. Start a scrape task

1. Go to the scrape page and create a scrape task. 
  - The download limits can let you test to see if it works before trying to scrape the entire history. 
  - Tasks can be scheduled with Cron expressions or fixed intervals for automated background updates.
2. When you create a scrape task, it will appear below in the task list. You can press the play button to start the scrape task, or use the lightning button for a quick update (stops after skipping 15 files already downloaded).
3. You can view the scrape task in progress by switching to the history tab on the right.
4. When the scrape task is stopped or finishes, it will trigger a library scan. After the library scan, your posts should appear in the timeline and gallery pages.

---

## Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: [SQLite](https://www.sqlite.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Scraper Engine**: [gallery-dl](https://github.com/mikf/gallery-dl) & [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- **Styling**: Vanilla CSS Modules
- **Icons**: [Lucide React](https://lucide.dev/)
- **Standalone Packaging**: [@yao-pkg/pkg](https://github.com/yao-pkg/pkg)
- **Testing**: [Vitest](https://vitest.dev/) (Unit & Integration) and [Playwright](https://playwright.dev/) (E2E)

## Development & Contributing

If you want to contribute to Web Gallery, set up a local development environment, or run tests, please refer to [CONTRIBUTING.md](./CONTRIBUTING.md) for full development guidelines, coding standards, and test commands.

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
