"""Tests for authentication user management rules."""

import pytest

import auth
from auth import ROLE_ADMIN, UserManager


@pytest.fixture
def isolated_user_manager(tmp_path, monkeypatch):
    """Create a UserManager instance using an isolated users file."""
    users_file = tmp_path / "users.json"
    monkeypatch.setattr(auth, "USERS_FILE", str(users_file))
    return UserManager()


def test_admin_can_delete_default_admin_if_not_self(isolated_user_manager):
    manager = isolated_user_manager

    default_admin = manager.get_user_by_username("admin")
    acting_admin = manager.create_user("supervisor", "secret", ROLE_ADMIN)

    manager.delete_user(default_admin.user_id, current_user_id=acting_admin.user_id)

    assert manager.get_user_by_id(default_admin.user_id) is None


def test_admin_cannot_delete_own_account(isolated_user_manager):
    manager = isolated_user_manager

    acting_admin = manager.create_user("owner", "secret", ROLE_ADMIN)

    with pytest.raises(ValueError, match="Cannot delete your own account"):
        manager.delete_user(acting_admin.user_id, current_user_id=acting_admin.user_id)
