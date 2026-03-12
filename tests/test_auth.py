"""Tests for authentication user management rules."""

import pytest
from werkzeug.security import check_password_hash

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


def test_change_own_password_updates_only_current_user(isolated_user_manager):
    manager = isolated_user_manager

    alice = manager.create_user("alice", "old-secret", "user")
    bob = manager.create_user("bob", "bob-secret", "user")

    old_bob_hash = manager.get_user_by_id(bob.user_id).password_hash

    manager.change_own_password(alice.user_id, "old-secret", "new-secret")

    updated_alice = manager.get_user_by_id(alice.user_id)
    updated_bob = manager.get_user_by_id(bob.user_id)

    assert check_password_hash(updated_alice.password_hash, "new-secret")
    assert updated_bob.password_hash == old_bob_hash


def test_change_own_password_rejects_wrong_current_password(isolated_user_manager):
    manager = isolated_user_manager
    user = manager.create_user("alice", "old-secret", "user")

    old_hash = manager.get_user_by_id(user.user_id).password_hash

    with pytest.raises(ValueError, match="Current password is incorrect"):
        manager.change_own_password(user.user_id, "bad-secret", "new-secret")

    unchanged_user = manager.get_user_by_id(user.user_id)
    assert unchanged_user.password_hash == old_hash


def test_validate_users_json_data_rejects_mismatched_user_id():
    is_valid, error_msg = UserManager.validate_users_json_data({
        "abc": {
            "user_id": "def",
            "username": "alice",
            "password_hash": "hash",
            "role": "user",
            "created_at": "2026-03-12T00:00:00"
        }
    })

    assert not is_valid
    assert "mismatched user_id" in error_msg


def test_update_user_preferences_updates_only_target_user(isolated_user_manager):
    manager = isolated_user_manager
    alice = manager.create_user("alice", "alice-secret", "user")
    bob = manager.create_user("bob", "bob-secret", "user")

    manager.update_user_preferences(alice.user_id, {
        "time_format": "24h",
        "density": "compact"
    })

    alice_prefs = manager.get_user_preferences(alice.user_id)
    bob_prefs = manager.get_user_preferences(bob.user_id)

    assert alice_prefs["time_format"] == "24h"
    assert alice_prefs["density"] == "compact"
    assert bob_prefs["time_format"] == "auto"
    assert bob_prefs["density"] == "comfortable"


def test_update_user_preferences_rejects_invalid_values(isolated_user_manager):
    manager = isolated_user_manager
    user = manager.create_user("alice", "alice-secret", "user")

    with pytest.raises(ValueError, match="Invalid time_format"):
        manager.update_user_preferences(user.user_id, {
            "time_format": "invalid-format"
        })
