#### Eclipses: no more stale "next eclipse"

The Sun and Moon forecast pages kept announcing an eclipse that had already happened, for up to a
full day afterwards. Their cache is recomputed once every 24 hours, and nothing told it that the
event it was holding was over - so an eclipse that ended in the evening was still served as "the
next eclipse" until the next day's refresh. The eclipse caches now also expire when the eclipse they
describe ends, and a finished eclipse is no longer listed among the upcoming events.

The opposite case is fixed too: an eclipse **in progress** used to disappear halfway through. The
underlying search is anchored on the eclipse's maximum, so once the peak was passed it jumped
straight to the following eclipse - even though the partial phases still had an hour to run. Both
the solar and lunar services now look a few hours back, so a running eclipse stays on screen until
it actually ends.

Eclipse timings also read as ambiguous when the next one was years away: a date shown as "02/08"
looked like next week. Solar and lunar eclipse times now carry a 2-digit year whenever the eclipse
does not fall in the current year, and stay short (day/month only) when it does.

While checking that path, the eclipse push notifications (N4/N5, "eclipse peak in X minutes") turned
out to have never fired: they were reading a key that no longer existed in the cache payload, and
silently skipped every cycle. They now read the payload the cache actually writes.

#### Various changes

- The Docker image now runs on Python 3.14 (up from 3.13); the build stage also no longer installs a C/Rust compiler toolchain, since every dependency now ships prebuilt wheels for it
