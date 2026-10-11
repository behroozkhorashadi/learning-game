from app.profiles.profile_passwords_service_effect import make_scrypt_password_hasher

SALT = b"\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f"


def test_hash_is_salted_scrypt_and_matches_only_its_password() -> None:
    hasher = make_scrypt_password_hasher(new_salt=lambda: SALT)
    stored = hasher.hash("tiger42")
    assert stored.startswith(f"scrypt${SALT.hex()}$")
    assert hasher.matches("tiger42", stored)
    assert not hasher.matches("tiger43", stored)


def test_malformed_hashes_never_match() -> None:
    hasher = make_scrypt_password_hasher(new_salt=lambda: SALT)
    for stored in ("", "plain", "md5$00$11", "scrypt$zz$11", "scrypt$00", "scrypt$00$11$22"):
        assert not hasher.matches("tiger42", stored)
