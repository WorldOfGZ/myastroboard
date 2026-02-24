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

### Multilanguage
**Add multiple language**
- Use of I18n
- Automatic switch based on local browser settings
- IA translation possible ?

### Various
- Package for debugging purpose on github (see birdnet-go which is great)

## Upgrade Features

### Enhanced Astrodex
**Objective: Advanced Management of Astro Collections**
- Photo Session Timeline (idea https://bootsnipp.com/snippets/P2nW7)
- Interactive Map of Sky Objects
- Suggestions based on weather and conditions
- Shared or not option with others users

### Enhanced Uptonight Execution
**Objective: Better managment, not only a cycle**
- Currently every 6 hours with current weather
- Idea is to launch at startup, with forecast meteo (from next x hours)
- Second launch closer to night session with current weather

### Astro Events 
- Possibility to edit a picture for social networks. Usefull ?
- Check for new events possibilities for location, as usual, based on location & timezone + cache managment: 
  - Planetary Events
    - **Planetary Conjunctions** – when two planets appear very close in the sky.
    - **Planetary Oppositions** – best visibility of outer planets.
    - **Planetary Elongations** – maximum angular distance from the Sun.
    - **Retrograde Motion** – apparent backward motion of planets.
  - Special Phenomena
    - **Equinoxes and Solstices** – start of seasons.
    - **Zodiacal Light Visibility Windows** – faint diffuse light from interplanetary dust.
    - **Ecliptic and Galactic Alignments** – e.g., Milky Way core visibility.
  - Solar System Events
    - **Meteor Showers** – peak times and radiant positions.
    - **Comet Appearances** – perihelion passages or brightest dates.
    - **Asteroid Occultations** – when an asteroid passes in front of a star.
  - **Sidereal Time** – useful for equatorial mounts and star tracking.
    - Integrated on existing section ?
- Section with a calendar resume for all events (with visible/not visible from location)
  - Celestial Events (already implemented)
    - **Solar and Lunar Eclipses** – total, partial, and annular eclipses.
    - **Lunar Phases** – New Moon, Full Moon, First Quarter, Last Quarter.
    - **Supermoons** – unusually large apparent size of the Moon.
    - **Blue Moon** – second full moon in a calendar month.
    - **Blood Moon / Lunar Eclipse Coloring** – total lunar eclipses causing reddish tint.
  - Planetary Events (to be implemented)
  - Special Phenomena (to be implemented)
  - Solar System Events (to be implemented)