"""Visual similarity scoring for clip boundary frames."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from app.errors import AppError


class SimilarityError(AppError):
    """Raised when images cannot be loaded or compared."""

    code = "similarity_error"


def transition_score(last_frame: str | Path | np.ndarray, first_frame: str | Path | np.ndarray) -> float:
    image_a = load_image(last_frame)
    image_b = load_image(first_frame)
    histogram = histogram_similarity(image_a, image_b)
    phash = perceptual_hash_similarity(image_a, image_b)
    return round((0.6 * histogram) + (0.4 * phash), 6)


def histogram_similarity(image_a: np.ndarray, image_b: np.ndarray, *, bins: int = 16) -> float:
    a = _as_rgb_array(image_a)
    b = _as_rgb_array(image_b)
    similarities = []
    for channel in range(3):
        hist_a, _ = np.histogram(a[:, :, channel], bins=bins, range=(0, 256), density=False)
        hist_b, _ = np.histogram(b[:, :, channel], bins=bins, range=(0, 256), density=False)
        hist_a = hist_a.astype(np.float64)
        hist_b = hist_b.astype(np.float64)
        if hist_a.sum() == 0 or hist_b.sum() == 0:
            similarities.append(0.0)
            continue
        hist_a /= hist_a.sum()
        hist_b /= hist_b.sum()
        similarities.append(float(np.minimum(hist_a, hist_b).sum()))
    return round(float(np.mean(similarities)), 6)


def perceptual_hash_similarity(image_a: np.ndarray, image_b: np.ndarray, *, hash_size: int = 8) -> float:
    hash_a = average_hash(image_a, hash_size=hash_size)
    hash_b = average_hash(image_b, hash_size=hash_size)
    if hash_a.shape != hash_b.shape:
        raise SimilarityError("Hash shapes do not match.")
    distance = int(np.count_nonzero(hash_a != hash_b))
    max_distance = hash_a.size
    return round(1.0 - (distance / max_distance), 6)


def average_hash(image: np.ndarray, *, hash_size: int = 8) -> np.ndarray:
    gray = _to_grayscale(_as_rgb_array(image))
    small = _nearest_resize(gray, hash_size, hash_size)
    return small >= float(small.mean())


def load_image(value: str | Path | np.ndarray) -> np.ndarray:
    if isinstance(value, np.ndarray):
        return value

    try:
        import cv2  # type: ignore
    except ImportError as exc:
        raise SimilarityError("OpenCV is required to load image files for similarity scoring.") from exc

    path = Path(value)
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise SimilarityError("Image could not be loaded.", details={"path": str(path)})
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def pairwise_transition_scores(boundary_frames: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    scores = []
    for from_clip_id in sorted(boundary_frames):
        for to_clip_id in sorted(boundary_frames):
            if from_clip_id == to_clip_id:
                continue
            score = transition_score(
                boundary_frames[from_clip_id]["last_frame_path"],
                boundary_frames[to_clip_id]["first_frame_path"],
            )
            scores.append({"from": from_clip_id, "to": to_clip_id, "score": score})
    return scores


def _as_rgb_array(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        image = np.stack([image, image, image], axis=2)
    if image.ndim != 3 or image.shape[2] < 3:
        raise SimilarityError("Image must be grayscale or RGB-like.")
    return image[:, :, :3].astype(np.uint8)


def _to_grayscale(image: np.ndarray) -> np.ndarray:
    rgb = _as_rgb_array(image).astype(np.float64)
    return (0.299 * rgb[:, :, 0]) + (0.587 * rgb[:, :, 1]) + (0.114 * rgb[:, :, 2])


def _nearest_resize(image: np.ndarray, width: int, height: int) -> np.ndarray:
    if image.shape[0] == 0 or image.shape[1] == 0:
        raise SimilarityError("Image cannot be empty.")
    y_indices = np.linspace(0, image.shape[0] - 1, height).astype(int)
    x_indices = np.linspace(0, image.shape[1] - 1, width).astype(int)
    return image[np.ix_(y_indices, x_indices)]
