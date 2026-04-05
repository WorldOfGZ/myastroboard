# MyAstroBoard

MyAstroBoard is a self-hosted astronomy dashboard with Docker-first deployment.
It combines weather and astronomical conditions, automated SkyTonight execution,
and planning tools for observation and astrophotography sessions.

This project is inspired by `mawinkler/uptonight`. Previously this project run UpTonight in Docker CLI to generate data.
Now MyAStroBoard removed all dependancies to UpTonight to use exactly what project need, and have the full hand on display & calculation.

![Demo MyAstroBoard](docs/img/overview.gif)

## Features

- SkyTonight integration with automated runs and report/log browsing
- Weather and observing-condition analysis (Open-Meteo)
- Moon, sun, eclipses, aurora, ISS passes, and astronomy event endpoints
- Astrodex: personal astrophotography catalog and image management
- Plan My Night timeline builder with CSV/PDF export
- Equipment profiles and field-of-view calculator
- Multi-user auth system with admin/user roles
- i18n support (English/French plus community translations)

## Quick Start

- Installation: docs/1.INSTALLATION.md
- Quick Start: docs/2.QUICKSTART.md
- Update Guide: docs/3.UPDATE.md
- Reverse Proxy: docs/6.REVERSE_PROXY.md
- API Endpoints: docs/API_ENDPOINTS.md
- Visual Tour: docs/VISUAL_TOUR.md

## SkyTonight Data Model

SkyTonight data is stored under `data/skytonight/`

Execution is done 2 times by day:
- 1 hour after last astronic night
- 1 hour previous next astronimic night

Data generated (table of objects, altitude vs time graph, interactive plot, ...) are based on user location and constrainst.
Deep-sky data is produced from the current SkyTonight/PyOngc pipeline.

## Requirements

- Docker and Docker Compose
- Linux host or compatible Docker environment

Python dependencies are listed in `requirements.txt`.

## Versioning

This project follows Semantic Versioning.
Current version is stored in `VERSION`.

## Contributing

See `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.

## License

Licensed under AGPL-3.0.
See `LICENSE` for details.

## Source Code Availability

In accordance with AGPL network-use requirements, source code for deployed versions
is available in this repository:
https://github.com/WorldOfGZ/myastroboard

## Support

Open issues and feature requests on GitHub:
https://github.com/WorldOfGZ/myastroboard/issues
