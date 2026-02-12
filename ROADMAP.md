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

### Multi-Night Project Manager
**Project Tracking**
- Create imaging projects with target integration time goals
- Track progress: hours captured vs. target hours
- Session history and statistics
- Seasonal availability calendar
- Priority queue for incomplete projects
- Export PDF / CSV

### PWA application
**Objective: Real PWA application for mobile**
- PWA notifications for improving conditions (weather, ... ?)
- Progressive weather updates during sessions
- Sudden weather change warnings
- Profile settings (notifications, and others)

### Backup & Sync Features
**Easy backup/restore of data config**
- Configuration backup and restore
- Automated backup scheduling
- Configuration & Astrodex

## Upgrade Features

### Enhanced Astrodex
**Objective: Advanced Management of Astro Collections**
- Photo Session Timeline (idea https://bootsnipp.com/snippets/P2nW7)
- Interactive Map of Sky Objects
- Suggestions based on weather and conditions

### Enhanced Uptonight Execution
**Objective: Better managment, not only a cycle**
- Currently every 6 hours with current weather
- Idea is to launch at startup, with forecast meteo (from next x hours)
- Second launch closer to night session with current weather

### Enhanced Sun/Moon page
**Additional informations usefull**
- Next solar Eclipse (astronomy-engine)
- Next lunar Eclipse (astronomy-engine)
- Astrophotography score classification
- Graphic altitude vs time (local time)
- Usefull info for solar, to be checked: 
  - Visible from lat/lon
  - Type → visual impact and rarity
  - Altitude → height above the horizon
  - Azimuth → direction for setting up
  - Obscuration → percentage of the sun obscured
  - Duration → shooting window
  - Start time (local time)
  - End time (local time)
- Usefull info for lunar, to be checked: 
  - Visible from lat/lon
  - Peak local time
  - Type (penumbral / partial / total)
  - Time of maximum
  - Overall visibility
- Check with astronomy already computed
  - eclipse.partial_begin
  - eclipse.total_begin
  - eclipse.peak
  - eclipse.total_end
  - eclipse.partial_end