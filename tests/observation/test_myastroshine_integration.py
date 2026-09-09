"""Tests for the MyAstroShine integration module (observation/myastroshine_integration.py).

Covers the handoff token (mint / verify / tamper / expiry / kid rotation), the
webhook return signature, the source-picture payload, and the enhanced-duplicate
creation (metadata copy, enhanced_* stamps, is_main, copy_rating, replay 409,
missing item 404).
"""

import hashlib
import hmac
import json
import os
import tempfile
import time

import pytest

from observation import astrodex
from observation import myastroshine_integration as integration

_TOKEN = "mas_abcdef123456extrachars"
_SECRET = "s" * 64


def _cfg(**overrides):
    cfg = {
        "enabled": True,
        "url": "http://192.168.1.42:8002",
        "token": _TOKEN,
        "signing_secret": _SECRET,
        "callback_url_override": "",
        "copy_rating": False,
    }
    cfg.update(overrides)
    return cfg


@pytest.fixture
def temp_data_dir(monkeypatch):
    """Isolated DATA_DIR + a clean in-memory consumed-jti store per test."""
    with tempfile.TemporaryDirectory() as tmpdir:
        monkeypatch.setenv("DATA_DIR", tmpdir)
        astrodex.ASTRODEX_DIR = os.path.join(tmpdir, "astrodex")
        astrodex.ASTRODEX_IMAGES_DIR = os.path.join(astrodex.ASTRODEX_DIR, "images")
        integration._consumed.clear()
        monkeypatch.setattr(integration, "get_integration_config", lambda config=None: _cfg())
        yield tmpdir
        integration._consumed.clear()


def _seed_item_with_picture(user_id="user-1"):
    astrodex.ensure_astrodex_directories()
    item = astrodex.create_astrodex_item(
        user_id,
        {"name": "M31 - Andromeda Galaxy", "type": "Galaxy", "catalogue": "Messier", "constellation": "Andromeda"},
    )
    picture = astrodex.add_picture_to_item(
        user_id,
        item["id"],
        {
            "filename": "src.jpg",
            "date": "2026-08-14",
            "exposition_time": 120,
            "frames": 180,
            "integration_minutes": 360,
            "iso": "800",
            "device": "RC8",
            "filters": "L",
            "notes": "first light",
            "location_id": "loc-1",
            "location_name": "Col de l'Ecre",
            "latitude": 43.75,
            "longitude": 6.9,
            "elevation": 1200,
            "rating": 3.5,
        },
    )
    # Write an actual image file so resolve_source_image_path works.
    with open(os.path.join(astrodex.ASTRODEX_IMAGES_DIR, "src.jpg"), "wb") as handle:
        handle.write(b"\xff\xd8\xff\xe0 fake jpeg")
    return item, picture


# ---------------------------------------------------------------------------
# integration_enabled
# ---------------------------------------------------------------------------


def test_integration_enabled_requires_all_fields():
    assert integration.integration_enabled(_cfg()) is True
    assert integration.integration_enabled(_cfg(enabled=False)) is False
    assert integration.integration_enabled(_cfg(url="")) is False
    assert integration.integration_enabled(_cfg(token="")) is False
    assert integration.integration_enabled(_cfg(signing_secret="")) is False


# ---------------------------------------------------------------------------
# Handoff token
# ---------------------------------------------------------------------------


def test_mint_and_verify_handoff_roundtrip():
    cfg = _cfg()
    result = integration.mint_handoff(
        cfg, user_id="u", item_id="i", picture_id="p", callback_base="https://astro.example.com/"
    )
    assert result["myastroshine_url"] == "http://192.168.1.42:8002"
    assert result["open_url"] == f"http://192.168.1.42:8002/#/?handoff={result['handoff']}"

    claims = integration.verify_handoff(cfg, result["handoff"])
    assert claims is not None
    assert claims["item_id"] == "i"
    assert claims["picture_id"] == "p"
    assert claims["user_id"] == "u"
    assert claims["callback_base"] == "https://astro.example.com"
    assert claims["kid"] == _TOKEN[:12]
    assert claims["exp"] - claims["iat"] == integration.MYASTROSHINE_HANDOFF_TTL_SECONDS


def test_verify_handoff_rejects_tampered_signature():
    cfg = _cfg()
    token = integration.mint_handoff(cfg, user_id="u", item_id="i", picture_id="p", callback_base="x")["handoff"]
    body, _, sig = token.partition(".")
    tampered = f"{body}.{sig[:-2]}xx"
    assert integration.verify_handoff(cfg, tampered) is None


def test_verify_handoff_rejects_tampered_payload():
    cfg = _cfg()
    token = integration.mint_handoff(cfg, user_id="u", item_id="i", picture_id="p", callback_base="x")["handoff"]
    body, _, sig = token.partition(".")
    forged_payload = integration._b64url_encode(json.dumps({"user_id": "attacker"}).encode())
    assert integration.verify_handoff(cfg, f"{forged_payload}.{sig}") is None


def test_verify_handoff_rejects_expired(monkeypatch):
    cfg = _cfg()
    token = integration.mint_handoff(cfg, user_id="u", item_id="i", picture_id="p", callback_base="x")["handoff"]
    real_time = time.time
    far_future = real_time() + integration.MYASTROSHINE_HANDOFF_TTL_SECONDS + 10
    monkeypatch.setattr(integration.time, "time", lambda: far_future)
    assert integration.verify_handoff(cfg, token) is None


def test_verify_handoff_rejects_kid_mismatch_after_token_rotation():
    minted = integration.mint_handoff(_cfg(), user_id="u", item_id="i", picture_id="p", callback_base="x")["handoff"]
    rotated = _cfg(token="mas_zzzzzzzzzzzznew")
    assert integration.verify_handoff(rotated, minted) is None


def test_verify_handoff_rejects_when_not_configured():
    assert integration.verify_handoff(_cfg(signing_secret=""), "a.b") is None
    assert integration.verify_handoff(_cfg(), "not-a-token") is None


# ---------------------------------------------------------------------------
# canonical_json + webhook signature
# ---------------------------------------------------------------------------


def test_canonical_json_is_sorted_and_compact():
    assert integration.canonical_json({"b": 1, "a": 2}) == '{"a":2,"b":1}'


def test_verify_return_signature_ok_and_tampered():
    cfg = _cfg()
    payload = {"parameters": {"denoise": 0.4}, "myastroshine_version": "0.3.0"}
    image = b"processed-jpeg-bytes"
    signing_input = f"{integration.canonical_json(payload)}\n{hashlib.sha256(image).hexdigest()}".encode()
    good = "sha256=" + hmac.new(_SECRET.encode(), signing_input, hashlib.sha256).hexdigest()

    assert integration.verify_return_signature(cfg, payload, image, good) is True
    assert integration.verify_return_signature(cfg, payload, b"other-bytes", good) is False
    assert integration.verify_return_signature(cfg, {"parameters": {}}, image, good) is False
    assert integration.verify_return_signature(cfg, payload, image, "sha256=deadbeef") is False
    assert integration.verify_return_signature(_cfg(signing_secret=""), payload, image, good) is False


# ---------------------------------------------------------------------------
# build_source_payload
# ---------------------------------------------------------------------------


def test_build_source_payload_shape(temp_data_dir):
    item, picture = _seed_item_with_picture()
    claims = {"user_id": "user-1", "item_id": item["id"], "picture_id": picture["id"]}
    payload = integration.build_source_payload(claims, token="TOK")

    assert payload["object"] == {
        "item_id": item["id"],
        "name": "M31 - Andromeda Galaxy",
        "type": "Galaxy",
        "catalogue": "Messier",
        "constellation": "Andromeda",
    }
    assert payload["picture"]["source_picture_id"] == picture["id"]
    assert payload["picture"]["exposition_time"] == 120
    assert payload["picture"]["location_name"] == "Col de l'Ecre"
    assert payload["image"]["url"] == "/api/astrodex/integration/source/image?handoff=TOK"
    assert payload["image"]["filename"] == "src.jpg"
    assert payload["image"]["content_type"] == "image/jpeg"


def test_build_source_payload_missing_returns_none(temp_data_dir):
    _seed_item_with_picture()
    assert integration.build_source_payload({"user_id": "user-1", "item_id": "nope", "picture_id": "nope"}) is None


def test_resolve_source_image_path(temp_data_dir):
    item, picture = _seed_item_with_picture()
    claims = {"user_id": "user-1", "item_id": item["id"], "picture_id": picture["id"]}
    path = integration.resolve_source_image_path(claims)
    assert path and os.path.isfile(path)


# ---------------------------------------------------------------------------
# create_enhanced_duplicate
# ---------------------------------------------------------------------------


def _claims_for(item, picture, user_id="user-1", jti="jti-1"):
    return {
        "user_id": user_id,
        "item_id": item["id"],
        "picture_id": picture["id"],
        "jti": jti,
        "exp": time.time() + 600,
    }


def test_create_enhanced_duplicate_copies_metadata_and_stamps(temp_data_dir):
    item, source = _seed_item_with_picture()
    payload = {"parameters": {"sharpen": 0.2}, "myastroshine_version": "0.3.0"}

    result = integration.create_enhanced_duplicate(_claims_for(item, source), b"enhanced-jpeg", payload)
    assert result["status"] == "created"

    stored = astrodex.get_astrodex_item("user-1", item["id"])
    assert len(stored["pictures"]) == 2
    dup = stored["pictures"][1]
    assert dup["is_main"] is False
    assert dup["exposition_time"] == 120
    assert dup["device"] == "RC8"
    assert dup["location_name"] == "Col de l'Ecre"
    assert dup["rating"] is None  # copy_rating defaults to False
    assert dup["enhanced_by"] == "myastroshine"
    assert dup["enhanced_from_picture_id"] == source["id"]
    assert dup["enhanced_parameters"] == {"sharpen": 0.2}
    assert dup["enhanced_source_version"] == "0.3.0"
    assert dup["filename"] != source["filename"]
    assert os.path.isfile(os.path.join(astrodex.ASTRODEX_IMAGES_DIR, dup["filename"]))


def test_create_enhanced_duplicate_copy_rating(temp_data_dir, monkeypatch):
    monkeypatch.setattr(integration, "get_integration_config", lambda config=None: _cfg(copy_rating=True))
    item, source = _seed_item_with_picture()
    integration.create_enhanced_duplicate(_claims_for(item, source), b"jpeg", {"parameters": {}})
    dup = astrodex.get_astrodex_item("user-1", item["id"])["pictures"][1]
    assert dup["rating"] == 3.5


def test_create_enhanced_duplicate_replay_is_409(temp_data_dir):
    item, source = _seed_item_with_picture()
    claims = _claims_for(item, source)
    integration.create_enhanced_duplicate(claims, b"jpeg", {"parameters": {}})
    with pytest.raises(integration.EnhancedDuplicateError) as excinfo:
        integration.create_enhanced_duplicate(claims, b"jpeg", {"parameters": {}})
    assert excinfo.value.status == 409


def test_create_enhanced_duplicate_unknown_item_is_404(temp_data_dir):
    _seed_item_with_picture()
    bad = {"user_id": "user-1", "item_id": "nope", "picture_id": "nope", "jti": "j", "exp": time.time() + 60}
    with pytest.raises(integration.EnhancedDuplicateError) as excinfo:
        integration.create_enhanced_duplicate(bad, b"jpeg", {"parameters": {}})
    assert excinfo.value.status == 404


def test_consumed_jti_persists_to_disk(temp_data_dir):
    integration.mark_handoff_consumed("jti-persist", time.time() + 300)
    on_disk = json.load(open(integration._consumed_file_path(), encoding="utf-8"))
    assert "jti-persist" in on_disk

    integration._consumed.clear()
    integration._load_consumed_from_disk()
    assert integration.is_handoff_consumed("jti-persist") is True
