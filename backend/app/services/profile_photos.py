"""A profile's saved pictures — every camera photo and AI remix a kid chose
to keep, so they can switch their profile picture back and forth. Files live
under `profile_avatars.PROFILE_AVATARS_DIR`; `ProfilePhoto` rows track which
profile owns which file.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models.profile import NewProfilePhoto, Profile, ProfilePhoto
from app.services.profile_avatars import decode_avatar_data_url, delete_profile_avatar, save_profile_avatar

PHOTO_URL_PREFIX = "/static/profile-avatars/"
# One request's worth: an original plus its remixes, a few retakes over.
MAX_NEW_PHOTOS_PER_REQUEST = 12
MAX_LABEL_LENGTH = 80


def validate_new_photos(new_photos: list[NewProfilePhoto]) -> None:
    """Checks everything up front, so a bad photo late in the list never
    leaves the earlier ones' files orphaned on disk."""
    if len(new_photos) > MAX_NEW_PHOTOS_PER_REQUEST:
        raise HTTPException(status_code=422, detail=f"at most {MAX_NEW_PHOTOS_PER_REQUEST} photos per save")
    if sum(photo.use_as_avatar for photo in new_photos) > 1:
        raise HTTPException(status_code=422, detail="at most one new photo can be the avatar")
    for photo in new_photos:
        if not photo.label.strip() or len(photo.label) > MAX_LABEL_LENGTH:
            raise HTTPException(status_code=422, detail=f"photo label must be 1-{MAX_LABEL_LENGTH} characters")
        try:
            decode_avatar_data_url(photo.image_data_url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc


def add_photos(session: Session, profile_id: int, new_photos: list[NewProfilePhoto]) -> str | None:
    """Saves already-validated photos and returns the URL of the one marked
    `use_as_avatar`, if any. The caller commits."""
    avatar_url = None
    for photo in new_photos:
        url = save_profile_avatar(photo.image_data_url)
        session.add(ProfilePhoto(profile_id=profile_id, url=url, label=photo.label.strip()))
        if photo.use_as_avatar:
            avatar_url = url
    return avatar_url


def list_photos(session: Session, profile_id: int) -> list[ProfilePhoto]:
    query = select(ProfilePhoto).where(ProfilePhoto.profile_id == profile_id).order_by(ProfilePhoto.id)
    return list(session.exec(query).all())


def owns_photo(session: Session, profile_id: int, url: str) -> bool:
    query = select(ProfilePhoto).where(ProfilePhoto.profile_id == profile_id, ProfilePhoto.url == url)
    return session.exec(query).first() is not None


def delete_photo(session: Session, profile: Profile, photo_id: int) -> None:
    photo = session.get(ProfilePhoto, photo_id)
    if photo is None or photo.profile_id != profile.id:
        raise HTTPException(status_code=404, detail=f"no photo {photo_id} on profile {profile.id}")
    if photo.url == profile.avatar:
        raise HTTPException(status_code=409, detail="that's the current profile picture — switch to another one first")
    session.delete(photo)
    session.commit()
    delete_profile_avatar(photo.url)


def delete_all_photos(session: Session, profile: Profile) -> None:
    """For profile deletion — removes every row and file, including a
    current avatar that predates the saved-pictures list. The caller commits."""
    urls = {profile.avatar}
    for photo in list_photos(session, profile.id):
        urls.add(photo.url)
        session.delete(photo)
    for url in urls:
        delete_profile_avatar(url)


def backfill_existing_avatars(session: Session) -> None:
    """Profiles given a photo before saved pictures existed have just the
    file — add it to their list so it shows up and can be switched back to."""
    for profile in session.exec(select(Profile).where(Profile.avatar.startswith(PHOTO_URL_PREFIX))).all():
        if not owns_photo(session, profile.id, profile.avatar):
            session.add(ProfilePhoto(profile_id=profile.id, url=profile.avatar, label="Photo"))
    session.commit()
