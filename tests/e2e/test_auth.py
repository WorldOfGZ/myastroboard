"""Browser end-to-end tests for the login/logout session lifecycle.

Covers behavior that only exists in a real browser + real server round-trip
(session cookies, server-side redirects) - not something Flask's test client
fixtures (`client`, `client_admin`) exercise, since those inject a session
directly rather than going through the real login form.
"""

import re

import pytest

pytestmark = pytest.mark.e2e


def test_login_with_correct_credentials_redirects_to_dashboard(page, live_server_url):
    """Exercises the real `<form>` submit path (fixtures elsewhere use a faster
    API-based login instead - see conftest.py's `_login`)."""
    page.goto(f"{live_server_url}/login")
    page.fill("#username", "admin")
    page.fill("#password", "admin")
    page.click("#login-btn")

    page.wait_for_url(re.compile(r"/$"))
    page.wait_for_selector(".main-tab-btn.active", state="visible")
    assert not re.search(r"/login", page.url)


def test_login_with_wrong_password_shows_inline_error(page, live_server_url):
    page.goto(f"{live_server_url}/login")
    page.fill("#username", "admin")
    page.fill("#password", "not-the-real-password")
    page.click("#login-btn")

    page.wait_for_selector("#error-message.show", state="visible")

    assert page.locator("#error-message").inner_text().strip() != ""
    # A failed attempt must not navigate away from the login page.
    assert re.search(r"/login$", page.url)


def test_logout_ends_the_session_and_blocks_dashboard_access(logged_in_page, live_server_url):
    page = logged_in_page

    page.click("#logout-btn")
    page.wait_for_url(re.compile(r"/login"))

    # The session cookie must actually be invalidated server-side: a fresh
    # request for the dashboard should bounce back to /login, not render it.
    page.goto(f"{live_server_url}/")
    page.wait_for_url(re.compile(r"/login"))
    assert re.search(r"/login$", page.url)
