import hashlib
import io
import os
import tempfile
from dataclasses import dataclass
from typing import Optional, Tuple
import numpy as np
from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from ..core.config import Settings
from ..schemas.config import PreprocessingConfig

ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png"}
ALLOWED_PIL_FORMATS = {"JPEG", "PNG"}

# Guard against decompression bombs
Image.MAX_IMAGE_PIXELS = 8192 * 8192


class ImageValidationError(ValueError):
    """Raised when an uploaded image fails MIME, size, encoding, or dimension validation."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class ValidatedImagePayload:
    rgb_image: Image.Image
    raw_bytes: bytes
    width: int
    height: int
    mime_type: str
    file_extension: str
    sha256: str
    byte_size: int


async def read_upload_safely(upload: UploadFile, settings: Settings) -> bytes:
    """
    Validate declared content type and stream upload into a safe temporary file
    while enforcing max_image_bytes without trusting file extensions.
    """
    declared_type = (upload.content_type or "").split(";")[0].strip().lower()
    if declared_type not in ALLOWED_MIME_TYPES:
        raise ImageValidationError(
            f"Unsupported content type '{declared_type or 'missing'}'. Accepted: image/jpeg, image/png.",
            status_code=415,
        )

    max_bytes = settings.max_image_bytes
    total_read = 0
    chunk_size = 64 * 1024

    with tempfile.NamedTemporaryFile(prefix="waste_upload_", delete=True) as tmp:
        while True:
            chunk = await upload.read(chunk_size)
            if not chunk:
                break
            total_read += len(chunk)
            if total_read > max_bytes:
                raise ImageValidationError(
                    f"Uploaded image exceeds maximum allowed size of {max_bytes} bytes.",
                    status_code=413,
                )
            tmp.write(chunk)

        if total_read == 0:
            raise ImageValidationError("Uploaded image file is empty.", status_code=400)

        tmp.flush()
        os.fsync(tmp.fileno())
        tmp.seek(0)
        return tmp.read()


def validate_image_bytes(raw_bytes: bytes, settings: Settings) -> ValidatedImagePayload:
    if not raw_bytes:
        raise ImageValidationError("Uploaded image payload is empty.", status_code=400)

    if len(raw_bytes) > settings.max_image_bytes:
        raise ImageValidationError(
            f"Uploaded image exceeds maximum allowed size of {settings.max_image_bytes} bytes.",
            status_code=413,
        )

    sha256 = hashlib.sha256(raw_bytes).hexdigest()

    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            img.verify()
        with Image.open(io.BytesIO(raw_bytes)) as img:
            detected_format = (img.format or "").upper()
            if detected_format not in ALLOWED_PIL_FORMATS:
                raise ImageValidationError(
                    f"Actual image encoding '{detected_format or 'unknown'}' is not supported. Accepted: JPEG, PNG.",
                    status_code=415,
                )
            transposed = ImageOps.exif_transpose(img)
            rgb_image = transposed.convert("RGB")
            width, height = rgb_image.size
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ImageValidationError(
            f"Malformed or corrupted image payload: {exc}",
            status_code=400,
        ) from exc

    if width < settings.min_image_width or height < settings.min_image_height:
        raise ImageValidationError(
            f"Image dimensions {width}x{height} are below minimum "
            f"{settings.min_image_width}x{settings.min_image_height}.",
            status_code=400,
        )

    if width > settings.max_image_width or height > settings.max_image_height:
        raise ImageValidationError(
            f"Image dimensions {width}x{height} exceed maximum "
            f"{settings.max_image_width}x{settings.max_image_height}.",
            status_code=400,
        )

    mime_map = {"JPEG": ("image/jpeg", "jpg"), "PNG": ("image/png", "png")}
    canonical_mime, ext = mime_map[detected_format]

    return ValidatedImagePayload(
        rgb_image=rgb_image,
        raw_bytes=raw_bytes,
        width=width,
        height=height,
        mime_type=canonical_mime,
        file_extension=ext,
        sha256=sha256,
        byte_size=len(raw_bytes),
    )


def preprocess_image(rgb_image: Image.Image, spec: PreprocessingConfig) -> np.ndarray:
    """
    Apply exact Colab-exported preprocessing configuration and tensor layout.
    """
    target_size: Tuple[int, int] = (spec.input_width, spec.input_height)
    if spec.resize_mode == "center_crop":
        processed = ImageOps.fit(rgb_image, target_size, method=Image.Resampling.BILINEAR)
    elif spec.resize_mode == "letterbox":
        processed = ImageOps.pad(
            rgb_image, target_size, method=Image.Resampling.BILINEAR, color=(0, 0, 0)
        )
    else:
        processed = rgb_image.resize(target_size, resample=Image.Resampling.BILINEAR)

    arr = np.asarray(processed, dtype=np.float32) * float(spec.rescale_factor)
    if spec.channel_order == "BGR":
        arr = arr[..., ::-1]
    mean = np.asarray(spec.normalization_mean, dtype=np.float32).reshape((1, 1, 3))
    std = np.asarray(spec.normalization_std, dtype=np.float32).reshape((1, 1, 3))
    normalized = (arr - mean) / std

    if spec.tensor_layout == "NCHW":
        tensor = np.transpose(normalized, (2, 0, 1))
    else:
        tensor = normalized

    return np.expand_dims(tensor, axis=0).astype(np.float32)
