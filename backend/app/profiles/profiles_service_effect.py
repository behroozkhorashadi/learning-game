"""Profile orchestration: validates through the pure rules, then reads and writes the
repository, the picture files, and the password hashes. Other features' data for a
profile is erased through an injected port before the profile itself goes.

Every check runs before the first write, so a rejected request never leaves a new
photo file orphaned on disk or a half-applied edit.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from app.profiles.profiles_ports_pure import (
    Clock,
    CurrentPhotoError,
    EraseProfileData,
    InvalidProfileError,
    IsAdminPassword,
    NotAdminError,
    PasswordHasher,
    PhotoNotFoundError,
    PhotoStore,
    ProfileNotFoundError,
    ProfileRepository,
    ProfilesService,
    WrongProfilePasswordError,
)
from app.profiles.profiles_reducers_pure import (
    DEMO_PROFILE_ID,
    DEMO_PROFILE_NAME,
    LOCAL_SEED_PROFILE_ID,
    PHOTO_URL_PREFIX,
    decode_avatar_data_url,
    demo_to_remove,
    profile_read,
    validate_avatar,
    validate_birth_year,
    validate_new_password,
    validate_new_photos,
    validated_name,
)
from app.profiles.profiles_schemas_pure import (
    LocalSeedProfile,
    NewProfile,
    NewProfilePhoto,
    ProfileCreate,
    ProfilePhotoRead,
    ProfileRead,
    ProfileRecord,
    ProfileUpdate,
)


@dataclass(frozen=True)
class _Profiles:
    repository: ProfileRepository
    photo_store: PhotoStore
    hasher: PasswordHasher
    is_admin_password: IsAdminPassword
    erase_profile_data: EraseProfileData
    clock: Clock

    # --- helpers ---

    def _require(self, profile_id: int) -> ProfileRecord:
        profile = self.repository.get(profile_id)
        if profile is None:
            raise ProfileNotFoundError(profile_id)
        return profile

    def _require_access(self, profile_id: int, profile_password: str | None, admin_password: str | None) -> None:
        """The profile has no password, or `profile_password` is it, or either header
        carries the admin password."""
        stored = self.repository.password_hash(profile_id)
        if stored is None:
            return
        if profile_password and self.hasher.matches(profile_password, stored):
            return
        if self.is_admin_password(profile_password) or self.is_admin_password(admin_password):
            return
        raise WrongProfilePasswordError

    def _save_photos(self, profile_id: int, new_photos: Sequence[NewProfilePhoto]) -> str | None:
        """Saves already-validated photos; returns the URL of the one marked
        `use_as_avatar`, if any."""
        avatar_url = None
        for photo in new_photos:
            url = self.photo_store.save(decode_avatar_data_url(photo.image_data_url))
            self.repository.add_photo(profile_id, url, photo.label.strip(), self.clock())
            if photo.use_as_avatar:
                avatar_url = url
        return avatar_url

    def _delete_everything(self, profile: ProfileRecord) -> None:
        """Other features' rows first, then every picture (including a current avatar
        that predates the saved-pictures list), then the profile."""
        self.erase_profile_data(profile.id)
        urls = {profile.avatar, *(photo.url for photo in self.repository.list_photos(profile.id))}
        self.repository.delete(profile.id)
        for url in sorted(urls):
            self.photo_store.delete(url)

    def _remove_demo_if_needed(self) -> None:
        demo = demo_to_remove(self.repository.list_all())
        if demo is not None:
            self._delete_everything(demo)

    # --- commands ---

    def list_profiles(self) -> tuple[ProfileRead, ...]:
        protected = self.repository.protected_ids()
        return tuple(profile_read(p, has_password=p.id in protected) for p in self.repository.list_all())

    def create_profile(self, payload: ProfileCreate) -> ProfileRead:
        now = self.clock()
        name = validated_name(payload.name)
        validate_birth_year(payload.birth_year, current_year=now.year)
        if payload.password is not None:
            validate_new_password(payload.password)
        validate_new_photos(payload.new_photos)
        if not any(photo.use_as_avatar for photo in payload.new_photos):
            validate_avatar(payload.avatar)

        profile = self.repository.insert(
            NewProfile(
                id=None,
                name=name,
                avatar=payload.avatar,
                birth_year=payload.birth_year,
                reading_support=payload.reading_support,
                created_at=now,
            )
        )
        photo_avatar = self._save_photos(profile.id, payload.new_photos)
        if photo_avatar is not None:
            profile = self.repository.update(profile.model_copy(update={"avatar": photo_avatar}))
        if payload.password is not None:
            self.repository.set_password_hash(profile.id, self.hasher.hash(payload.password))
        self._remove_demo_if_needed()
        return profile_read(profile, has_password=payload.password is not None)

    def unlock(self, profile_id: int, password: str) -> None:
        self._require(profile_id)
        self._require_access(profile_id, password, None)

    def update_profile(
        self, profile_id: int, change: ProfileUpdate, profile_password: str | None, admin_password: str | None
    ) -> ProfileRead:
        profile = self._require(profile_id)
        self._require_access(profile_id, profile_password, admin_password)
        if change.password is not None and change.remove_password:
            msg = "send either password or remove_password, not both"
            raise InvalidProfileError(msg)
        if change.password is not None:
            validate_new_password(change.password)
        validate_new_photos(change.new_photos)
        updates = self._field_updates(profile, change)

        photo_avatar = self._save_photos(profile_id, change.new_photos)
        if photo_avatar is not None:
            updates["avatar"] = photo_avatar
        if change.password is not None:
            self.repository.set_password_hash(profile_id, self.hasher.hash(change.password))
        elif change.remove_password:
            self.repository.delete_password(profile_id)

        updated = self.repository.update(profile.model_copy(update=updates))
        return profile_read(updated, has_password=self.repository.password_hash(profile_id) is not None)

    def _field_updates(self, profile: ProfileRecord, change: ProfileUpdate) -> dict[str, object]:
        """Validated name/birth year/reading support/avatar changes. Re-sending the current
        avatar is a no-op; any other avatar is an animal key or one of this profile's saved
        photos. Switching away from a photo keeps it saved."""
        updates: dict[str, object] = {}
        if change.name is not None:
            updates["name"] = validated_name(change.name)
        if change.birth_year is not None:
            validate_birth_year(change.birth_year, current_year=self.clock().year)
            updates["birth_year"] = change.birth_year
        if change.reading_support is not None:
            updates["reading_support"] = change.reading_support
        if change.avatar is not None and change.avatar != profile.avatar:
            if not self.repository.owns_photo(profile.id, change.avatar):
                validate_avatar(change.avatar)
            updates["avatar"] = change.avatar
        return updates

    def list_photos(
        self, profile_id: int, profile_password: str | None, admin_password: str | None
    ) -> tuple[ProfilePhotoRead, ...]:
        self._require(profile_id)
        self._require_access(profile_id, profile_password, admin_password)
        return tuple(
            ProfilePhotoRead(id=photo.id, url=photo.url, label=photo.label, created_at=photo.created_at)
            for photo in self.repository.list_photos(profile_id)
        )

    def delete_photo(
        self, profile_id: int, photo_id: int, profile_password: str | None, admin_password: str | None
    ) -> None:
        """409 for the current profile picture: switch to another first."""
        profile = self._require(profile_id)
        self._require_access(profile_id, profile_password, admin_password)
        photo = self.repository.get_photo(photo_id)
        if photo is None or photo.profile_id != profile.id:
            raise PhotoNotFoundError(photo_id, profile.id)
        if photo.url == profile.avatar:
            raise CurrentPhotoError
        self.repository.delete_photo(photo_id)
        self.photo_store.delete(photo.url)

    def delete_profile(self, profile_id: int, admin_password: str | None) -> None:
        if not self.is_admin_password(admin_password):
            raise NotAdminError
        self._delete_everything(self._require(profile_id))

    def seed(self, local: LocalSeedProfile | None) -> None:
        now = self.clock()
        if not self.repository.list_all():
            self.repository.insert(
                NewProfile(
                    id=DEMO_PROFILE_ID,
                    name=DEMO_PROFILE_NAME,
                    avatar="fox",
                    birth_year=2020,
                    reading_support=False,
                    created_at=now,
                )
            )
        if local is not None and self.repository.get(LOCAL_SEED_PROFILE_ID) is None:
            self.repository.insert(
                NewProfile(
                    id=LOCAL_SEED_PROFILE_ID,
                    name=local.name,
                    avatar=local.avatar,
                    birth_year=local.birth_year,
                    reading_support=False,
                    created_at=now,
                )
            )
        self._remove_demo_if_needed()
        # Profiles given a photo before saved pictures existed have just the file: add it
        # to their list so it shows up and can be switched back to.
        for profile in self.repository.with_avatar_prefix(PHOTO_URL_PREFIX):
            if not self.repository.owns_photo(profile.id, profile.avatar):
                self.repository.add_photo(profile.id, profile.avatar, "Photo", now)

    def exists(self, profile_id: int) -> bool:
        return self.repository.get(profile_id) is not None

    def birth_year(self, profile_id: int) -> int | None:
        profile = self.repository.get(profile_id)
        return None if profile is None else profile.birth_year

    def names(self, profile_ids: Sequence[int]) -> Mapping[int, str]:
        return self.repository.names(profile_ids)


def make_profiles_service(
    *,
    repository: ProfileRepository,
    photo_store: PhotoStore,
    hasher: PasswordHasher,
    is_admin_password: IsAdminPassword,
    erase_profile_data: EraseProfileData,
    clock: Clock,
) -> ProfilesService:
    impl = _Profiles(
        repository=repository,
        photo_store=photo_store,
        hasher=hasher,
        is_admin_password=is_admin_password,
        erase_profile_data=erase_profile_data,
        clock=clock,
    )
    return ProfilesService(
        list_profiles=impl.list_profiles,
        create_profile=impl.create_profile,
        unlock=impl.unlock,
        update_profile=impl.update_profile,
        list_photos=impl.list_photos,
        delete_photo=impl.delete_photo,
        delete_profile=impl.delete_profile,
        seed=impl.seed,
        exists=impl.exists,
        birth_year=impl.birth_year,
        names=impl.names,
    )
