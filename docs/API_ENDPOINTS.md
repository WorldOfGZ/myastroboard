# API Endpoints

This page lists the HTTP routes currently declared in `backend/app.py`.

## Web & PWA Routes

- `GET /`
- `GET /login`
- `GET /manifest.webmanifest`
- `GET /sw.js`
- `GET /offline.html`

## Authentication

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/status`
- `POST /api/auth/change-password`
- `GET /api/auth/preferences`
- `PUT /api/auth/preferences`

## User Management (admin)

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/<user_id>`
- `DELETE /api/users/<user_id>`

## Configuration

- `GET /api/config`
- `POST /api/config`
- `GET /api/config/view`
- `GET /api/config/export`

## Platform & Utility

- `GET /api/metrics`
- `GET /api/logs`
- `POST /api/logs/clear`
- `POST /api/convert-coordinates`
- `GET /api/timezones`
- `GET /api/health`
- `GET /health`
- `GET /api/cache`
- `GET /api/version`
- `GET /api/version/check-updates`
- `GET /api/catalogues`

## Scheduler

- `GET /api/scheduler/status`
- `POST /api/scheduler/trigger`

## UpTonight

- `GET /api/uptonight/outputs`
- `GET /api/uptonight/outputs/<target>/<filename>`
- `GET /api/uptonight/reports/<catalogue>`
- `GET /api/uptonight/logs/<catalogue>`
- `GET /api/uptonight/logs/<catalogue>/exists`
- `GET /api/uptonight/reports/<catalogue>/<report_type>`
- `GET /api/uptonight/reports/<catalogue>/available`

## Weather, Moon, Sun, and Astronomy

- `GET /api/weather/forecast`
- `GET /api/weather/astro-analysis`
- `GET /api/weather/astro-current`
- `GET /api/weather/alerts`
- `GET /api/moon/report`
- `GET /api/moon/dark-window`
- `GET /api/moon/next-7-nights`
- `GET /api/aurora/predictions`
- `GET /api/iss/passes`
- `GET /api/sun/today`
- `GET /api/sun/next-eclipse`
- `GET /api/moon/next-eclipse`
- `GET /api/events/upcoming`
- `GET /api/events/planetary`
- `GET /api/events/phenomena`
- `GET /api/events/solarsystem`
- `GET /api/astro/sidereal-time`
- `GET /api/astro/horizon-graph`
- `GET /api/tonight/best-window`

## Astrodex

- `GET /api/astrodex`
- `POST /api/astrodex/items`
- `POST /api/astrodex/items/<item_id>/catalogue-name`
- `GET /api/astrodex/items/<item_id>`
- `PUT /api/astrodex/items/<item_id>`
- `DELETE /api/astrodex/items/<item_id>`
- `POST /api/astrodex/items/<item_id>/pictures`
- `PUT /api/astrodex/items/<item_id>/pictures/<picture_id>`
- `DELETE /api/astrodex/items/<item_id>/pictures/<picture_id>`
- `POST /api/astrodex/items/<item_id>/pictures/<picture_id>/main`
- `POST /api/astrodex/upload`
- `GET /api/astrodex/images/<filename>`
- `GET /api/astrodex/check/<item_name>`
- `GET /api/astrodex/constellations`

## Equipment

- `GET /api/equipment/telescopes`
- `POST /api/equipment/telescopes`
- `GET /api/equipment/telescopes/<telescope_id>`
- `PUT /api/equipment/telescopes/<telescope_id>`
- `DELETE /api/equipment/telescopes/<telescope_id>`
- `GET /api/equipment/cameras`
- `POST /api/equipment/cameras`
- `GET /api/equipment/cameras/<camera_id>`
- `PUT /api/equipment/cameras/<camera_id>`
- `DELETE /api/equipment/cameras/<camera_id>`
- `GET /api/equipment/mounts`
- `POST /api/equipment/mounts`
- `GET /api/equipment/mounts/<mount_id>`
- `PUT /api/equipment/mounts/<mount_id>`
- `DELETE /api/equipment/mounts/<mount_id>`
- `GET /api/equipment/filters`
- `POST /api/equipment/filters`
- `GET /api/equipment/filters/<filter_id>`
- `PUT /api/equipment/filters/<filter_id>`
- `DELETE /api/equipment/filters/<filter_id>`
- `GET /api/equipment/accessories`
- `POST /api/equipment/accessories`
- `GET /api/equipment/accessories/<accessory_id>`
- `PUT /api/equipment/accessories/<accessory_id>`
- `DELETE /api/equipment/accessories/<accessory_id>`
- `GET /api/equipment/combinations`
- `POST /api/equipment/combinations`
- `GET /api/equipment/combinations/<combination_id>`
- `PUT /api/equipment/combinations/<combination_id>`
- `DELETE /api/equipment/combinations/<combination_id>`
- `POST /api/equipment/fov-calculator`
- `GET /api/equipment/summary`
