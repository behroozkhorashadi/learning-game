"""Optional per-profile passwords: hashing and checking.

Same trust model as the admin gate: this keeps a sibling from opening or editing
someone else's profile on the family LAN, not a motivated attacker. The password is
checked when a kid picks their profile and on every profile edit, but the game
endpoints still trust whatever profile id the client sends.

hashlib.scrypt with the parameters Python's docs suggest for interactive logins:
stdlib only, so no new dependency for a LAN-grade gate. Existing hashes
(`scrypt$<salt hex>$<digest hex>`) keep verifying.
"""

import hashlib
import hmac
from collections.abc import Callable
from dataclasses import dataclass

_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2**14, 8, 1


def _digest(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P)


@dataclass(frozen=True)
class ScryptPasswordHasher:
    new_salt: Callable[[], bytes]

    def hash(self, password: str) -> str:
        salt = self.new_salt()
        return f"scrypt${salt.hex()}${_digest(password, salt).hex()}"

    def matches(self, password: str, stored: str) -> bool:
        scheme, _, rest = stored.partition("$")
        salt_hex, _, digest_hex = rest.partition("$")
        if scheme != "scrypt" or not salt_hex or not digest_hex or "$" in digest_hex:
            return False
        try:
            salt = bytes.fromhex(salt_hex)
        except ValueError:
            return False
        return hmac.compare_digest(_digest(password, salt).hex(), digest_hex)


def make_scrypt_password_hasher(*, new_salt: Callable[[], bytes]) -> ScryptPasswordHasher:
    """`new_salt` returns 16 random bytes (assembly passes `os.urandom`)."""
    return ScryptPasswordHasher(new_salt=new_salt)
