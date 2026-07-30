#### Input validation audit

A full pass over user-facing inputs closed several gaps where the backend accepted values the UI never would have sent:

- SkyTonight observability constraints (altitude, airmass, size, moon separation) saved via Parameters -> Advanced now have server-side range checks, matching the min/max already on those fields
- Equipment profiles (mounts, filters, accessories, combinations) now validate numeric fields server-side (payload capacity, wavelength, focal length/ratio, etc.) - previously only telescopes and cameras were checked, so those forms could be bypassed via a direct API call
- Admin-created/reset user passwords now enforce the same 6-character minimum as self-service password changes
- The AllSky connector's `date` parameter is now validated as `YYYYMMDD` before being used to build the proxied upstream URL
- Notification lead-time and Kp-threshold preferences are now range-checked like every other preference value

#### Various changes

- Add "Milky Way" and "Nightscape / Wide-field" on astrodex type
