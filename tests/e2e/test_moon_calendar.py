"""Browser end-to-end tests for the monthly Moon-phase calendar (static/js/moon.js).

Covers behaviour that only breaks in a real browser:

- Each day cell must render its OWN Moon phase. moon.svg ships fixed element
  ids (moon-disc-clip / shadow-mask / lit-region); with ~30 moons on one page
  the duplicated ids collide and every mask/clip-path url(#...) reference
  resolves to the first instance, so all days render an identical phase.
  createMoonPhaseSvg() namespaces each clone's ids to prevent that.
- The month switch is capped to a 2-month window (current month and the next).
"""

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.e2e


def _open_moon_calendar(page, live_server_url, login):
    login(page, live_server_url)
    page.click('#forecast-astro-subtabs .sub-tab-btn[data-subtab="moon"]')
    page.wait_for_selector('#moon-phase-calendar .moon-phase-calendar-card', state='visible')
    page.wait_for_selector('#moon-phase-calendar .moon-phase-cal-moon svg')
    return page.locator('#moon-phase-calendar')


def test_calendar_renders_a_full_month_of_day_cells(page, live_server_url, login):
    calendar = _open_moon_calendar(page, live_server_url, login)
    day_cells = calendar.locator('.moon-phase-cal-cell:not(.moon-phase-cal-blank)')
    assert 28 <= day_cells.count() <= 31
    # Seven weekday headers, regardless of the first-day-of-week preference.
    assert calendar.locator('.moon-phase-cal-weekday').count() == 7


def test_each_day_draws_its_own_moon_phase(page, live_server_url, login):
    """Regression: duplicated SVG ids used to make every day render one phase."""
    _open_moon_calendar(page, live_server_url, login)

    mask_ids = page.eval_on_selector_all(
        '#moon-phase-calendar .moon-phase-cal-moon svg mask', 'els => els.map(e => e.id)'
    )
    assert len(mask_ids) >= 28
    assert len(mask_ids) == len(set(mask_ids)), 'moon SVG mask ids must be unique per day cell'

    terminator_paths = page.eval_on_selector_all(
        '#moon-phase-calendar .moon-phase-cal-moon svg [id^="lit-region"]',
        'els => els.map(e => e.getAttribute("d") || "")',
    )
    assert len(terminator_paths) >= 28
    # A calendar month spans new -> full -> new, so the terminator shape varies
    # widely; a single repeated value would mean the id collision is back.
    assert len(set(terminator_paths)) >= 10


def test_navigation_is_capped_to_current_and_next_month(page, live_server_url, login):
    calendar = _open_moon_calendar(page, live_server_url, login)
    current_month_btn = calendar.locator('.moon-phase-cal-nav-btn').nth(0)
    next_month_btn = calendar.locator('.moon-phase-cal-nav-btn').nth(1)

    starting_month = calendar.locator('.moon-phase-cal-month').inner_text()
    expect(current_month_btn).to_be_disabled()
    expect(next_month_btn).to_be_enabled()

    # One step forward is allowed; a second step is not.
    next_month_btn.click()
    expect(calendar.locator('.moon-phase-cal-month')).not_to_have_text(starting_month)
    expect(calendar.locator('.moon-phase-cal-nav-btn').nth(1)).to_be_disabled()
    expect(calendar.locator('.moon-phase-cal-nav-btn').nth(0)).to_be_enabled()

    # Back to the current month.
    calendar.locator('.moon-phase-cal-nav-btn').nth(0).click()
    expect(calendar.locator('.moon-phase-cal-month')).to_have_text(starting_month)
    expect(calendar.locator('.moon-phase-cal-nav-btn').nth(0)).to_be_disabled()
