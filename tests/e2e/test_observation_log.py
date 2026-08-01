"""Browser end-to-end tests for the Observation Log sub-tab (v1.3).

This repo has no JS test framework, so these cover the parts of
`static/js/observation_sessions.js` that only a real browser exercises: the
sub-tab wiring, the DOM-built list/detail/modal rendering, and the automatic
"in Astrodex" badge that appears once a frame count is logged.
"""

import re

import pytest

pytestmark = pytest.mark.e2e

SUBTAB_BUTTON = '#astrodex-tab .sub-tab-btn[data-subtab="observation-log"]'


def _open_observation_log(page):
    """Navigate to Astrodex -> Observation Log and wait for the list to render."""
    page.click('.main-tab-btn[data-tab="astrodex"]')
    page.click(SUBTAB_BUTTON)
    page.wait_for_selector('#observation-log-new-session', state="visible")


def _create_session(page, date_value):
    """Drive the New Session modal.

    Creating a session drops straight into its detail view - the natural next step is
    logging what was captured - so this returns with the entry toolbar on screen, not
    the list.
    """
    page.click('#observation-log-new-session')
    page.wait_for_selector('#observation-session-form', state="visible")
    page.fill('#observation-session-date', date_value)
    page.fill('#observation-session-notes', 'clear and cold')
    page.click('#observation-session-form button[type="submit"]')
    page.wait_for_selector('#observation-log-add-target', state="visible")


def test_observation_log_subtab_renders_without_console_errors(logged_in_page):
    """Opening the sub-tab must render its stats + list with a clean console.

    A syntax error or a missing global in observation_sessions.js surfaces here and
    nowhere else - the Python suite never loads the file.
    """
    page = logged_in_page
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

    _open_observation_log(page)

    assert page.locator('#observation-log-stats .observation-log-stat-value').count() == 4
    assert not errors, f"Console/page errors on the Observation Log sub-tab: {errors}"


def test_subtab_switch_updates_the_url_hash(logged_in_page):
    """The 5th Astrodex sub-tab routes through the generic switchSubTab() path."""
    page = logged_in_page

    page.click('.main-tab-btn[data-tab="astrodex"]')
    page.click(SUBTAB_BUTTON)
    page.wait_for_url(re.compile(r"#astrodex/observation-log"))

    assert "#astrodex/observation-log" in page.url


def test_create_session_then_log_a_target_links_it_to_astrodex(logged_in_page):
    """Full happy path: create a session, add a target with frames, see the Astrodex badge.

    The badge is the user-visible proof of the automatic item registration - the entry
    is never pushed to Astrodex by a button, only by having a frame count.
    """
    page = logged_in_page
    _open_observation_log(page)
    _create_session(page, '2026-07-14')

    page.click('#observation-log-add-target')
    page.wait_for_selector('#observation-entry-form', state="visible")
    page.fill('#observation-entry-name', 'M31')
    page.fill('#observation-entry-catalogue', 'Messier')
    page.fill('#observation-entry-frames', '42')
    page.click('#observation-entry-form button[type="submit"]')

    page.wait_for_selector('.observation-log-entry-row', state="visible")
    # The name is deliberately not asserted verbatim: leaving the name field fires the
    # catalogue lookup, which may replace what was typed with the catalogue's preferred
    # name (that autofill is the point of the field).
    assert page.locator('.observation-log-entry-name').first.inner_text().strip()
    assert page.locator('.observation-log-entry-row .badge.bg-secondary', has_text='42').count() >= 1
    # frame_count > 0 -> the target is now registered in Astrodex, with no user action
    page.wait_for_selector('.observation-log-entry-row .badge.bg-success', state="visible")


def test_filters_narrow_the_session_list(logged_in_page):
    """The client-side search filter refreshes only the results container."""
    page = logged_in_page
    _open_observation_log(page)
    _create_session(page, '2026-03-02')

    # Back out of the detail view the create flow left us in
    page.click('#observation-log-back')
    page.wait_for_selector('#observation-log-search', state="visible")

    page.fill('#observation-log-search', 'definitely-no-such-session')
    page.wait_for_selector('.observation-log-empty', state="visible")
    assert page.locator('.observation-log-session-card').count() == 0

    # The search box keeps focus and content across a filter refresh
    assert page.input_value('#observation-log-search') == 'definitely-no-such-session'

    page.fill('#observation-log-search', '')
    page.wait_for_selector('.observation-log-session-card', state="visible")
