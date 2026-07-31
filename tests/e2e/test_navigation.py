"""Browser end-to-end tests for tab/sub-tab navigation and URL-hash syncing.

Covers app.js's syncNavigationHash() / handleHashNavigation() - the routing
layer behind main-tab/sub-tab switching, browser history, and hash deep-links
(PWA shortcuts like #astrodex, #weather rely on handleHashNavigation()).
"""

import re

import pytest

pytestmark = pytest.mark.e2e


def test_boot_sequence_never_triggers_pushstate_before_first_click(page, live_server_url, login):
    """Regression test: app boot must only ever call history.replaceState, never pushState.

    A freshly loaded tab has a "trivial" session history (a single entry), so a
    pushState call there is silently downgraded by the browser to replaceState
    and logged as a console warning ("Use of history.pushState in a trivial
    session history context ... is treated as history.replaceState"). Before
    the fix, applyUserStartupPreferences() called switchMainTab() with history
    syncing enabled during the automatic startup tab restore, triggering
    exactly this pushState call before the user had clicked anything. Fixed by
    skipping history sync on that automatic call and relying on the explicit
    replaceState that already runs right after (see app.js).
    """
    console_messages = []
    page.on("console", lambda msg: console_messages.append(msg.text))

    login(page, live_server_url)

    warning_hits = [m for m in console_messages if "trivial session history" in m]
    assert not warning_hits, f"Unexpected history.pushState warning during boot: {warning_hits}"


def test_clicking_a_main_tab_updates_the_url_hash(logged_in_page):
    page = logged_in_page

    page.click('.main-tab-btn[data-tab="astrodex"]')
    page.wait_for_url(re.compile(r"#astrodex"))

    assert re.search(r"#astrodex(/|$)", page.url)


def test_switching_a_sub_tab_updates_the_url_hash(logged_in_page):
    page = logged_in_page

    page.click('.main-tab-btn[data-tab="astrodex"]')
    page.click('#astrodex-tab .sub-tab-btn[data-subtab="photo-map"]')
    page.wait_for_url(re.compile(r"#astrodex/photo-map"))

    assert "#astrodex/photo-map" in page.url


def test_reloading_the_page_keeps_the_active_tab(logged_in_page):
    """F5/hash reload stability: handleHashNavigation()'s generic resolver must
    restore whichever tab/sub-tab was active before a real page reload."""
    page = logged_in_page

    page.click('.main-tab-btn[data-tab="astrodex"]')
    page.click('#astrodex-tab .sub-tab-btn[data-subtab="photo-map"]')
    page.wait_for_url(re.compile(r"#astrodex/photo-map"))

    page.reload()
    page.wait_for_selector('.main-tab-btn[data-tab="astrodex"].active', state="visible")

    active_tab = page.locator(".main-tab-btn.active").get_attribute("data-tab")
    active_subtab = page.locator("#astrodex-tab .sub-tab-btn.active").get_attribute("data-subtab")
    assert active_tab == "astrodex"
    assert active_subtab == "photo-map"


def test_hash_deep_link_opens_directly_on_the_target_tab(open_authenticated_page):
    """A fresh, already-authenticated page load at `/#astrodex` (as used by PWA
    shortcuts) must land directly on the Astrodex tab via handleHashNavigation()."""
    deep_link_page = open_authenticated_page("astrodex")
    deep_link_page.wait_for_selector('.main-tab-btn[data-tab="astrodex"].active', state="visible")

    active_tab = deep_link_page.locator(".main-tab-btn.active").get_attribute("data-tab")
    assert active_tab == "astrodex"


def test_friendly_hash_alias_resolves_to_correct_tab_and_subtab(open_authenticated_page):
    """The `#plan-my-night` shortcut alias must resolve to astrodex/plan-my-night,
    same as the generic `#astrodex/plan-my-night` form (see handleHashNavigation())."""
    deep_link_page = open_authenticated_page("plan-my-night")
    deep_link_page.wait_for_selector('#astrodex-tab .sub-tab-btn[data-subtab="plan-my-night"].active', state="visible")

    active_tab = deep_link_page.locator(".main-tab-btn.active").get_attribute("data-tab")
    active_subtab = deep_link_page.locator("#astrodex-tab .sub-tab-btn.active").get_attribute("data-subtab")
    assert active_tab == "astrodex"
    assert active_subtab == "plan-my-night"
