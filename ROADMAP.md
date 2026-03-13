# MyAstroBoard - Roadmap

This document describes features that could potentially be integrated into MyAstroBoard. There are no guarantees; consider this file a list of ideas that may evolve based on my own ideas or future discussions.

## 🗓️ Release Plan

### v1.0 – Stabilization & Overall Quality
**Objective: First stable release + smooth user experience**
- Stabilization of critical bugs
- Improved mobile interface (responsive)
- Customizable dashboard
- User profile configuration 

## New Features

### Multilocation
**Add multiple location possible**
- Location configurable by an admin
- Each location can be attributed to individual users
- Location are stored in uuid
- Limit to X location (check with weather api limit call)
- Cache scheduler & Uptonight scheduler by location
- Switch to select location on main page with persistant selection between main-tabs (astro, weather, uptonight)
- Add location field to astrodex
- User can order as he want location on it's profile

### PWA application
**Objective: Real PWA application for mobile**
- PWA notifications for improving conditions (weather, ... ?)
- Progressive weather updates during sessions
- Sudden weather change warnings

### User profile
- Allow to change his own password
- Notification (when/if available in future)
- Modify Roles: Admin, User (no app settings, but use Astrodex and others), Read-Only (can only consult, not fill Astrodex)
- Customize interface: usefull ??

### Backup & Sync Features
**Easy backup/restore of data config**
- Configuration backup and restore
- Automated backup scheduling
- Configuration & Astrodex

## Upgrade Features

### Enhanced Uptonight Execution
**Objective: Better managment, not only a cycle**
- Currently every 6 hours with current weather
- Idea is to launch at startup, with forecast meteo (from next x hours)
- Second launch closer to night session with current weather
