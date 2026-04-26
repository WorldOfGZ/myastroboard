# MyAstroBoard - Roadmap

This document describes features that could potentially be integrated into MyAstroBoard. There are no guarantees; consider this file a list of ideas that may evolve based on my own ideas or future discussions.

## 🗓️ Release Plan

### v1.0 – Stabilization & Overall Quality
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

## Upgrade Features

### PWA application
**Objective: Real PWA application for mobile**
- PWA notifications for improving conditions (weather, ... ?)

### Plan my night
**Use telescopes in plan my night**
- If user have more than one telescope, the plan my night is incorrect because we can have only one plan.
- Add possibility to have one plan by telescope
- SkyTonight table: 
  - If zero or one telescope created by user, just create/add target to plan on the telescope used. 
  - If there is two or more telescope created by user, button "Add" for plan my night, open a popup to ask which telescope we need to use (with rating provided on "more" popup, but without reason)
- Plan my Night page
  - If zero or one telescope created by user, display name of telescope, or "no telescope created". 
  - If there is two or more telescope created by user, add a selector to select telescope to display plan. Add also an information is a plan already exists, and/or expired for this telescope
- On export/print, the telescope name must be displayed
- After "Clear plan" (to be renamed on "Clear this plan" on all language) button, a new button "Clear all plans" can clear all plans for all telescope (this button is displayed only if user have more than one telescope)
- The system remain unchanged
- In Equipment/telescope, if a telescope is removed, the associated plan must be removed if exists.

### Settings
**Improve handle to set location**
- Use lib Geolocation_API https://developer.mozilla.org/fr/docs/Web/API/Geolocation_API
- If user allow Geolocation API:
  - At right of field id "latitude-input", use bootstrap "input-group-text" to add icon "bi-pin-map"
  - Click on this icon try to overfill "latitude-input", "longitude-input", and if possible "location-name"
  - Before overfill, a confirm with these new values should be displayed to decline if necessary.
**Improve advanced settings**
- Horizon profile:
  - Table "horizon-profile-table" is displayed even it there is no points. This should be displayed only if there is a profile, or when we add point.
  - Button clearHorizonProfile() don't respect graphic charter, exemple of delete button correct: <button class="btn btn-sm btn-danger" data-action="delete-item" data-item-id="3ac560d3-53c4-4f63-be4a-0a85642565df"><i class="bi bi-trash icon-inline" aria-hidden="true"></i>Supprimer</button>
  - Button addHorizonRow() don't respect graphic charter, exemple of add button correct: <button class="btn btn-sm btn-primary me-3" data-action="add-picture" data-item-id="3ac560d3-53c4-4f63-be4a-0a85642565df"><i class="bi bi-plus-lg icon-inline" aria-hidden="true"></i>Ajouter une photo</button>
  - Buttons clearHorizonProfile() and addHorizonRow() use "onclick", must be changed with events
**Logs**
- Page #parameters/logs:
  - An indication on numbers of lines in log must be displayed (between row and "logs-display")
  - On selector id "log-limit", an option at the end must be "All" and dispaly the entire log. Must be translated i18n
**Metrics**
- Add a section to see the last execution for each cache object.

### Ideas in raw
2	Equipment FOV matching      Medium      Very high — practical astrophotography fit
3	Bortle/SQM in AstroScore    Low	        High — corrects score_object for light pollution
4	Solar elongation filter     Low	        Medium — correctness for planets
5	Seeing forecast (7Timer)    Medium      Medium — planetary imaging only
