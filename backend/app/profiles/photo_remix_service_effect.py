"""The remix preview: decode the kid's photo, build the prompt from their chosen look
and/or idea, and hand the AI result straight back. Nothing is saved; the versions they
keep come back as `new_photos` on the profile create/update."""

from app.profiles.profiles_ports_pure import PhotoRemixer, PhotoRemixService, RemixUnavailableError
from app.profiles.profiles_reducers_pure import decode_avatar_data_url, encode_avatar_data_url, remix_prompt
from app.profiles.profiles_schemas_pure import ProfilePhotoRemixRequest, ProfilePhotoRemixResponse


def make_photo_remix_service(*, remixer: PhotoRemixer) -> PhotoRemixService:
    def remix_preview(payload: ProfilePhotoRemixRequest) -> ProfilePhotoRemixResponse:
        image = decode_avatar_data_url(payload.image_data_url)
        remixed = remixer(image, remix_prompt(payload.style, payload.idea))
        if remixed is None:
            raise RemixUnavailableError
        return ProfilePhotoRemixResponse(image_data_url=encode_avatar_data_url(remixed))

    return PhotoRemixService(remix_preview=remix_preview)
