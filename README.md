# Personal Web Gallery

A self-hosted web application designed to empower individuals to own and manage their local archive of social media and creator-driven media.

## The Vision

In an era of digital volatility—where websites go down, creators are banned, and users lose access to their favorite content—**Personal Web Gallery** aims to provide a safe haven for your media collection.

By leveraging powerful scraping tools like `gallery-dl` and `yt-dlp`, this application allows you to create a local, permanent copy of the content you value. It provides a beautiful, organized interface to browse, search, and discover your media, free from the risks of censorship or data lockout.

## Features

- **Automated Scraping**: Seamlessly download media from various social media, streaming, and gallery sites using `gallery-dl` (with `yt-dlp` integration planned).
- **Multiple Viewing Modes**:
  - **Waterfall Gallery**: A modern masonry layout that preserves the original aspect ratio of your images and videos.
  - **Chronological Timeline**: View your collected items in the order they were originally posted or captured.
  - **Collections**: Curate and organize media into logical groups, regardless of their source or type.
- **Deep Metadata Integration**: Automatically extracts and stores rich metadata (e.g., Twitter user profiles, tweet details, timestamps) in a local SQLite database for advanced search.
- **Smart Management**:
  - Isolated scraper configurations to keep your system clean.
  - Automatic synchronization between your local disk and the database.
  - Support for continuing long-running backfills and historical data extraction.
- **Privacy & Ownership**: Everything is stored locally on your machine. You own the data, the metadata, and the archive.

## Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: [SQLite](https://www.sqlite.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Scraper Engine**: [gallery-dl](https://github.com/mikf/gallery-dl)
- **Styling**: Vanilla CSS

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [gallery-dl](https://github.com/mikf/gallery-dl) installed and available in your PATH.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/web-gallery.git
   cd web-gallery
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Initialize the database:
   ```bash
   npm run db:push
   ```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Roadmap

- [ ] `yt-dlp` integration for video-heavy sources.
- [ ] Scheduled scraping tasks for automated updates.
- [ ] Advanced tagging and categorization for individual posts.
- [ ] Rate limiting and proxy support for heavy scraping sessions.

## Disclaimer

**Personal Web Gallery** is a tool intended for personal use and the archival of content for which you have legal access. The developers of this software are not responsible for how you use the tool, nor for any content you choose to scrape or store. 

Users are responsible for:
- Complying with the Terms of Service of any website they scrape.
- Adhering to local and international copyright laws.
- Ensuring their use of the software is legal in their jurisdiction.

This software is provided "as is," without warranty of any kind.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
