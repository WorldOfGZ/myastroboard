# MyAstroBoard - Roadmap

This document describes features that could potentially be integrated into MyAstroBoard. There are no guarantees; consider this file a list of ideas that may evolve based on my own ideas or future discussions.

## 🗓️ Release Plan

### v1.0 - Stabilization & Overall Quality
**Objective: First stable release + smooth user experience**
- Stabilization of critical bugs
- Improved mobile interface (responsive)

## New Features

### Multilocation
**Add multiple location possible**
- Location configurable by an admin
- Each location can be attributed to individual users
- Location are stored in uuid
- Limit to X location (check with weather api limit call)
- Cache scheduler & SkyTonight scheduler by location
- Switch to select location on main page with persistant selection between main-tabs (astro, weather, SkyTonight)
- Add location field to astrodex
- User can order as he want location on it's profile

### User profile
- Notification (when/if available in future)

### Space tabs
**New tab with space information**
Launch Library provide for example API with low rate but free to use
Example which could be implemented in subtabs: 
- Launch
- Space Events
- Astronauts in ISS

## Upgrade Features

### PWA application
**Objective: Real PWA application for mobile**
- PWA notifications for improving conditions (weather, ... ?)

### Ideas in raw
2	Equipment FOV matching      Medium      Very high — practical astrophotography fit
3	Bortle/SQM in AstroScore    Low	        High — corrects score_object for light pollution
4	Solar elongation filter     Low	        Medium — correctness for planets
5	Seeing forecast (7Timer)    Medium      Medium — planetary imaging only
