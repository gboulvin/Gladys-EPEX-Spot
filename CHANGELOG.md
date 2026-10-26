# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Changed

- Requires Gladys 5.3.0 or later: the manifest declares search keywords and
  the countries where the integration works, for the new catalog of Gladys
  5.3.
- Integration SDK 0.16.

## [1.0.1] - 2026-10-22

### Security

- The image is rebuilt on the latest `node:24-alpine` (Node.js and Alpine
  security patches); development tools and CI actions up to date.

## [1.0.0] - 2026-10-16

### Added

- Day-ahead electricity prices of 10 bidding zones (France, Germany /
  Luxembourg, Belgium, Netherlands, Austria, Switzerland, Spain, Poland,
  Denmark West, Finland), downloaded from the free energy-charts.info API on
  the 15-minute grid of the European day-ahead market. Hourly zones are spread
  on quarter-hours.
- A "EPEX Spot" device per zone: current price, next quarter-hour price,
  today's minimum / average / maximum and tomorrow's average, with an optional
  markup and VAT for the displayed prices.
- Energy contracts (Gladys 5.2): one 15-minute spot calendar per zone
  (`spot-fr`, `spot-de`...) fed with the prices, and one dynamic contract
  template per zone (spot price × coefficient + margin, grid fees,
  subscription, VAT) in the Gladys contract wizard.
- Scene triggers: price level changed, cheapest hours started (1, 2, 3, 4 or
  6 hours), tomorrow's prices published.
- Scene actions: get the spot price, find the cheapest hours, is it a cheap
  hour, download the prices.
- Dashboard widgets: spot price (tiles, today / tomorrow curve, price level)
  and cheapest hours of the next 24 hours, with a refresh button.
- Configuration buttons: test the price API, download the prices now.
- English, French, German and Spanish texts and user documentation.
- Known prices kept in `/data`: a restart neither re-downloads nor re-announces
  tomorrow's prices.

[Unreleased]: https://github.com/gboulvin/Gladys-EPEX-Spot/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/gboulvin/Gladys-EPEX-Spot/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/gboulvin/Gladys-EPEX-Spot/releases/tag/v1.0.0
