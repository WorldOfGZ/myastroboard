"""Regression tests for lunar eclipse scoring."""

from moon_eclipse import LunarEclipseService


class TestLunarEclipseService:
    """Tests for lunar eclipse service regressions."""

    def test_astrophotography_score_is_case_insensitive_for_eclipse_type(self):
        service = LunarEclipseService(latitude=48.0, longitude=2.0, timezone="Europe/Paris")

        title_case = service._calculate_astrophotography_score(
            eclipse_type="Total",
            visible=True,
            peak_altitude=50.0,
            partial_duration_minutes=120,
            total_duration_minutes=80,
        )
        lower_case = service._calculate_astrophotography_score(
            eclipse_type="total",
            visible=True,
            peak_altitude=50.0,
            partial_duration_minutes=120,
            total_duration_minutes=80,
        )

        assert title_case == lower_case

    def test_astrophotography_score_handles_extra_spaces_in_eclipse_type(self):
        service = LunarEclipseService(latitude=48.0, longitude=2.0, timezone="Europe/Paris")

        padded = service._calculate_astrophotography_score(
            eclipse_type="  Partial  ",
            visible=True,
            peak_altitude=45.0,
            partial_duration_minutes=110,
            total_duration_minutes=0,
        )
        normalized = service._calculate_astrophotography_score(
            eclipse_type="partial",
            visible=True,
            peak_altitude=45.0,
            partial_duration_minutes=110,
            total_duration_minutes=0,
        )

        assert padded == normalized
