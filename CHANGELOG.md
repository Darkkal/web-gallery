# Changelog

## [0.5.0](https://github.com/Darkkal/web-gallery/compare/v0.4.0...v0.5.0) (2026-06-18)


### Features

* **actions:** implement server action to remove tags from posts ([32ac035](https://github.com/Darkkal/web-gallery/commit/32ac03590341c1732ab84c58ee087eb2eb6990f2))
* **actions:** implement tag mutation server actions ([8c27d8b](https://github.com/Darkkal/web-gallery/commit/8c27d8b7201e93b388af274be3e332e79b8f526e))
* **config:** implement recursive configuration deepMerge helper ([dee800e](https://github.com/Darkkal/web-gallery/commit/dee800e7a18fd89951224cfcde9b1eeaf5a8514d))
* **db:** add postDetailsEHentai table and FTS5 triggers ([dee800e](https://github.com/Darkkal/web-gallery/commit/dee800e7a18fd89951224cfcde9b1eeaf5a8514d))
* **db:** add repository function for bulk unlinking tags ([32ac035](https://github.com/Darkkal/web-gallery/commit/32ac03590341c1732ab84c58ee087eb2eb6990f2))
* **db:** add repository write operations for tags ([8c27d8b](https://github.com/Darkkal/web-gallery/commit/8c27d8b7201e93b388af274be3e332e79b8f526e))
* **gallery:** add bulk tagging support to gallery ([8c27d8b](https://github.com/Darkkal/web-gallery/commit/8c27d8b7201e93b388af274be3e332e79b8f526e))
* **library:** add e-hentai metadata processor and scanner logic ([dee800e](https://github.com/Darkkal/web-gallery/commit/dee800e7a18fd89951224cfcde9b1eeaf5a8514d))
* **lightbox:** allow editing tags on posts ([8c27d8b](https://github.com/Darkkal/web-gallery/commit/8c27d8b7201e93b388af274be3e332e79b8f526e))
* **lightbox:** implement tag removal toggle and multi-select deletion ([32ac035](https://github.com/Darkkal/web-gallery/commit/32ac03590341c1732ab84c58ee087eb2eb6990f2))
* **release:** include package version in standalone binary and archive filenames ([b5d3c98](https://github.com/Darkkal/web-gallery/commit/b5d3c98a1dc5413c7349623461239cc118258a01))
* **search:** sanitize special characters using unicode properties to prevent FTS5 crashes ([dff77ff](https://github.com/Darkkal/web-gallery/commit/dff77ff90c3c81000ea796a332e215b5ae3ecd18))
* **sources:** implement domain mapping, timeline repository, and UI styling ([dee800e](https://github.com/Darkkal/web-gallery/commit/dee800e7a18fd89951224cfcde9b1eeaf5a8514d))
* **statistics:** link ranking cards and items to gallery search queries ([dff77ff](https://github.com/Darkkal/web-gallery/commit/dff77ff90c3c81000ea796a332e215b5ae3ecd18))
* **ui:** add reusable TagAutocompleteInput component ([8c27d8b](https://github.com/Darkkal/web-gallery/commit/8c27d8b7201e93b388af274be3e332e79b8f526e))


### Performance Improvements

* **db:** add foreign key indexes to improve query performance ([#112](https://github.com/Darkkal/web-gallery/issues/112)) ([7dd1382](https://github.com/Darkkal/web-gallery/commit/7dd13822ccc2e8c2fd0dd4a03537ae32bdba8604))

## [0.4.0](https://github.com/Darkkal/web-gallery/compare/v0.3.0...v0.4.0) (2026-06-15)


### Features

* **lightbox:** button to refetch metadata ([31c66cf](https://github.com/Darkkal/web-gallery/commit/31c66cf696c67d94ff831df8255e053210d06441))
* **release:** adapt db migration and default config lookups for ([33b5288](https://github.com/Darkkal/web-gallery/commit/33b5288689d4d562b95ee393c289683d7679ea38))
* **release:** add standalone build scripts and dependency installation ([33b5288](https://github.com/Darkkal/web-gallery/commit/33b5288689d4d562b95ee393c289683d7679ea38))
* **release:** support execution of portable binaries inside local bin ([33b5288](https://github.com/Darkkal/web-gallery/commit/33b5288689d4d562b95ee393c289683d7679ea38))
* **search:** add autocomplete suggestions while typing ([ad66e3e](https://github.com/Darkkal/web-gallery/commit/ad66e3e725a59b51d9870cf3448c46927c5f47c3))
* **search:** add spinner in filter bar while processing search ([ad66e3e](https://github.com/Darkkal/web-gallery/commit/ad66e3e725a59b51d9870cf3448c46927c5f47c3))
* **statistics:** implement post statistics dashboard and fix query sorts ([80ef3ca](https://github.com/Darkkal/web-gallery/commit/80ef3caa29d73ec4ad028cd6b1770738f937586a))


### Bug Fixes

* **config:** add captions flag to pixiv extractor for missing data ([7efd136](https://github.com/Darkkal/web-gallery/commit/7efd13656532264ce8df7db3e9c949fd2679e2ba))

## [0.3.0](https://github.com/Darkkal/web-gallery/compare/v0.2.0...v0.3.0) (2026-05-31)


### Features

* **gallery:** change column slider to +/- buttons ([78375ae](https://github.com/Darkkal/web-gallery/commit/78375ae080c43fec7ab2f1e9753702757c8416f1))
* **gallery:** integrate autoplay hook into GalleryItem video component ([f2e4aaf](https://github.com/Darkkal/web-gallery/commit/f2e4aaf784d0451069fbc196393b42920c1686aa))
* **gallery:** read and pass autoplay settings down to gallery page client ([f35262f](https://github.com/Darkkal/web-gallery/commit/f35262f507ae55df69c5c8dd826bc39e1c9d4b83))
* **gallery:** simplified sorting selection and added asc/desc sort ([e090ff6](https://github.com/Darkkal/web-gallery/commit/e090ff63acfd7fa332447d353a8eb178dcf7e2a9))
* **hooks:** implement useAutoplayVideo IntersectionObserver hook ([ffa6c9a](https://github.com/Darkkal/web-gallery/commit/ffa6c9af9f60a5dda1973e268781878ce3630ee4))
* **lightbox:** allow loading more items while navigating with buffer ([#95](https://github.com/Darkkal/web-gallery/issues/95)) ([60fb542](https://github.com/Darkkal/web-gallery/commit/60fb542bacc6bb154854aebd550988d24c9f589e))
* **lightbox:** show both import date and publish/create date ([e090ff6](https://github.com/Darkkal/web-gallery/commit/e090ff63acfd7fa332447d353a8eb178dcf7e2a9))
* **scraper:** add scheduling scrape tasks based on interval or date ([860d953](https://github.com/Darkkal/web-gallery/commit/860d953355c37929287af1a05abc245892d59708))
* **scraper:** add tasks/history card view for responsive mobile layout ([860d953](https://github.com/Darkkal/web-gallery/commit/860d953355c37929287af1a05abc245892d59708))
* **scrape:** show scrape duration while running, use hh:mm:ss format ([8b54ef9](https://github.com/Darkkal/web-gallery/commit/8b54ef93b831ca035e9773af20db553047843a6a))
* set server timezone to host configuration ([860d953](https://github.com/Darkkal/web-gallery/commit/860d953355c37929287af1a05abc245892d59708))
* **settings:** add autoplay and mute settings schema and defaults ([03213f7](https://github.com/Darkkal/web-gallery/commit/03213f7b5a40dc17be9cc4806ba93f80aeba9032))
* **settings:** add UI toggles for autoplay and mute preferences ([f8ad4ce](https://github.com/Darkkal/web-gallery/commit/f8ad4ced0219f8b39ebbfa02a86731ec77667617))
* **timeline,gallery:** loading buffer for uninterrupted scrolling ([39a2c99](https://github.com/Darkkal/web-gallery/commit/39a2c9907bf2a22068f09d503769f85759a59154))
* **timeline,gallery:** loading buffer for uninterrupted scrolling ([8a514c9](https://github.com/Darkkal/web-gallery/commit/8a514c9bd496a59da0dc6d59679ec5ec1719b17d))
* **timeline:** add configurable shown character limit to posts ([e36e561](https://github.com/Darkkal/web-gallery/commit/e36e56145921dccb32f3cc92b7e37a8d8f758252))
* **timeline:** also update sorting ui for timeline ([e090ff6](https://github.com/Darkkal/web-gallery/commit/e090ff63acfd7fa332447d353a8eb178dcf7e2a9))
* **timeline:** changed post character display limit to line instead ([219c99b](https://github.com/Darkkal/web-gallery/commit/219c99b13d5492619d1aaf168ef23ed0a706a879))
* **timeline:** integrate autoplay hook into PostCard video component ([48cc4e8](https://github.com/Darkkal/web-gallery/commit/48cc4e8e6e3304b04ca912d11b8bba5e1489e289))
* **timeline:** read and pass autoplay settings down to timeline page client ([6e46cd3](https://github.com/Darkkal/web-gallery/commit/6e46cd3b0a65504126e98cb2e025006caeb41e16))


### Bug Fixes

* **gallery,timeline:** asc/desc button now on same line as sort ([d3d3196](https://github.com/Darkkal/web-gallery/commit/d3d319626b9cd7642f83254b73e1e77b6794b3ab))
* **gallery:** sorting by date ([e090ff6](https://github.com/Darkkal/web-gallery/commit/e090ff63acfd7fa332447d353a8eb178dcf7e2a9))
* **gallery:** try to evenly fit media items across columns ([d3001bf](https://github.com/Darkkal/web-gallery/commit/d3001bf30eefd717e512f6718a0e5b76ee2aac56))
* **gallery:** try to evenly fit media items across columns ([a08a5ed](https://github.com/Darkkal/web-gallery/commit/a08a5ed67f5828d4c0433331fefc6697cfdd0e2d))

## [0.2.0](https://github.com/Darkkal/web-gallery/compare/v0.1.0...v0.2.0) (2026-05-25)


### Features

* loop video playback by default, add setting to toggle ([317916d](https://github.com/Darkkal/web-gallery/commit/317916deda031380f86a346a26f9c863c19dbcef))
* loop video playback by default, add setting to toggle ([b281e1a](https://github.com/Darkkal/web-gallery/commit/b281e1a1a639c37cfe6ea6405a6171c543679017))
* **player:** add visual progress timer to control bar ([1fa9a27](https://github.com/Darkkal/web-gallery/commit/1fa9a279b0cf92add259475b900d53ef439ca399))
* **player:** hide custom controls and progress bar during active video playback ([63b9642](https://github.com/Darkkal/web-gallery/commit/63b96429bfe1a12ae1199eeed054721a516b1e1e))
* **playlists:** add playlist CRUD backend ([8bf328b](https://github.com/Darkkal/web-gallery/commit/8bf328b9e13b6fa14e7550d6b17b7f6f98f98af8))
* **playlists:** add playlist detail view with reordering ([278430f](https://github.com/Darkkal/web-gallery/commit/278430ffdab351e568450ee02122fd99f749a1f0))
* **playlists:** add playlist gallery page ([0d84c14](https://github.com/Darkkal/web-gallery/commit/0d84c1424bb9729affabc097c9191dbc254bce47))
* **playlists:** add playlist player ([3cb90da](https://github.com/Darkkal/web-gallery/commit/3cb90dae21b80a0a5ccf81713d8b27ec4c62f464))
* **playlists:** add to playlist from gallery and lightbox ([09fb2db](https://github.com/Darkkal/web-gallery/commit/09fb2db7995804a7d52a38402fb15624d0aaaf63))
* **playlists:** make the entire playlist card clickable ([02bfde7](https://github.com/Darkkal/web-gallery/commit/02bfde79ee400b217d9741af6f456ea5511fc798))


### Bug Fixes

* **db:** tolerate no such table/column errors in migrations ([9aaf303](https://github.com/Darkkal/web-gallery/commit/9aaf3033c6d0e6d205f87db6ef795b05e88b7734))
* **gallery:** resolve playlistId filtering in gallery browse view ([5f6c0f4](https://github.com/Darkkal/web-gallery/commit/5f6c0f4b3485d0a51cc70b93f8e4521a5bcc8fbb))
* **migration:** add drizzle statement breakpoints to migration ([4fe3394](https://github.com/Darkkal/web-gallery/commit/4fe3394135fd9110fa58eb0a132e4eb36737c625))
* **player:** prevent duplicate back-to-back playback on shuffle-repeat transition ([700f9b8](https://github.com/Darkkal/web-gallery/commit/700f9b8e914191896211370e7c3f06ff42f285be))
* **player:** sync native video events and improve controls auto-hide with hover support ([3fade73](https://github.com/Darkkal/web-gallery/commit/3fade73609507c11de373749b61e834bd9fde06e))
* **playlists:** qualify table columns in playlist list query ([fdd7089](https://github.com/Darkkal/web-gallery/commit/fdd70890d0a84be277df4cd97d5621c0ab464031))
* **playlists:** render video thumbnails using HTML5 video tags with seeking ([f4c4fd2](https://github.com/Darkkal/web-gallery/commit/f4c4fd2e83a546dcf65a6fd74dcf3b84ab08d864))
