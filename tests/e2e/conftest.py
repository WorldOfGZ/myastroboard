"""Shared fixtures for browser end-to-end tests (Playwright).

These tests drive a real running instance of the Flask app through a real
Chromium browser (via pytest-playwright's `page` fixture), instead of Flask's
test client. They are excluded from the default `pytest` run - see the
`-m "not e2e"` default in pytest.ini. Run them explicitly with:

    pytest tests/e2e/ -m e2e

Requires `playwright install chromium` once, after `pip install -r requirements-dev.txt`.
"""

import socket
import threading

import pytest
from werkzeug.serving import make_server


def _free_port():
    """Ask the OS for an unused TCP port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture(scope="session")
def live_server_url():
    """Serve the real Flask app on a background thread; yield its base URL.

    Reuses the same `app` object as the rest of the pytest suite, so it
    inherits the DATA_DIR isolation set up in tests/conftest.py (temp root,
    wiped before the session starts) - no real user data is touched.
    """
    from app import app as flask_app

    port = _free_port()
    server = make_server("127.0.0.1", port, flask_app, threaded=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    yield f"http://127.0.0.1:{port}"

    server.shutdown()
    thread.join(timeout=5)


_STARTUP_READY_EXPR = "window.__myastroboardStartupApplied === true"


def _wait_for_dashboard_ready(page):
    """Wait for app.js's applyUserStartupPreferences() to have fully resolved.

    `.main-tab-btn.active` is NOT a safe "app ready" signal: the default tab is
    already marked `active` in the server-rendered HTML before any JS runs, so
    waiting on it can resolve before checkAuthStatus()/initializeApp() (and
    checkFirstRun(), which decides whether to pop up the Guided Setup Wizard)
    have even started. `window.__myastroboardStartupApplied` is set at the very
    end of that chain (see app.js), after the wizard decision is made - a
    reliable "safe to interact" signal.
    """
    page.wait_for_function(_STARTUP_READY_EXPR, timeout=30000)


def _login(page, base_url, username="admin", password="admin"):
    """Authenticate via the real API and load the dashboard.

    Deliberately not the `<form>` submit path: login.js's success handler
    schedules `window.location.href = '/'` a full second after the request
    resolves, so a form-driven login followed by our own navigation would
    leave that stray timer armed, ready to reload the page out from under a
    test a second later. The real login form's own behavior (fill, submit,
    error/success handling) is covered directly by tests/e2e/test_auth.py
    instead.

    Also marks the per-user Guided Setup Wizard as already completed, so it
    doesn't pop up over tab content and intercept clicks - a fresh admin user
    with no location configured would otherwise see it on this first load.
    """
    login_response = page.request.post(f"{base_url}/api/auth/login", data={"username": username, "password": password})
    assert login_response.ok, f"login failed: {login_response.status} {login_response.text()}"

    prefs_response = page.request.put(
        f"{base_url}/api/auth/preferences",
        data={"preferences": {"wizard": {"completed": True, "skipped": False}}},
    )
    assert prefs_response.ok, f"could not pre-complete the wizard: {prefs_response.status} {prefs_response.text()}"

    page.goto(f"{base_url}/")
    _wait_for_dashboard_ready(page)


@pytest.fixture
def login():
    """Callable fixture: login(page, base_url) - see `_login` above."""
    return _login


@pytest.fixture
def logged_in_page(page, live_server_url, login):
    """A Playwright page already authenticated as the default admin user."""
    login(page, live_server_url)
    return page


@pytest.fixture
def open_authenticated_page(page, live_server_url, login):
    """Factory fixture: open_authenticated_page(hash_fragment="") -> Page.

    Logs in on the given `page` (establishing the session cookie in this
    browser context), then opens a *new* page whose very first navigation is
    `{base_url}/#{hash_fragment}`. This is deliberately a fresh page rather
    than `page.goto()` on the already-loaded dashboard: navigating to a URL
    that only differs by fragment on a document already loaded is a
    same-document hash change (fires `hashchange`), not a real page load, so
    it would not exercise the initial-load hash resolution in
    handleHashNavigation() the way an actual PWA-shortcut cold start does.
    Opened pages are closed automatically at teardown.
    """
    login(page, live_server_url)
    opened_pages = []

    def _open(hash_fragment=""):
        target = f"{live_server_url}/" + (f"#{hash_fragment}" if hash_fragment else "")
        new_page = page.context.new_page()
        opened_pages.append(new_page)
        new_page.goto(target)
        _wait_for_dashboard_ready(new_page)
        return new_page

    yield _open

    for opened_page in opened_pages:
        opened_page.close()
