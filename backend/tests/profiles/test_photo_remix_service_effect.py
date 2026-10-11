import pytest

from app.profiles.photo_remix_service_effect import make_photo_remix_service
from app.profiles.profiles_ports_pure import InvalidProfileError, RemixUnavailableError
from app.profiles.profiles_schemas_pure import ProfilePhotoRemixRequest
from tests.profiles.profiles_fakes import PHOTO_DATA_URL, FakeRemixer


def test_bad_photo_or_prompt_is_rejected_before_calling_the_remixer() -> None:
    remixer = FakeRemixer()
    service = make_photo_remix_service(remixer=remixer)
    with pytest.raises(InvalidProfileError):
        service.remix_preview(ProfilePhotoRemixRequest(image_data_url="nope", style="cartoon"))
    with pytest.raises(InvalidProfileError):
        service.remix_preview(ProfilePhotoRemixRequest(image_data_url=PHOTO_DATA_URL))
    assert remixer.prompts == []


def test_unavailable_remixer_is_reported() -> None:
    with pytest.raises(RemixUnavailableError):
        make_photo_remix_service(remixer=FakeRemixer(result=None)).remix_preview(
            ProfilePhotoRemixRequest(image_data_url=PHOTO_DATA_URL, idea="a cape")
        )
