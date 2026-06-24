from __future__ import annotations

import numpy as np

from app.similarity import average_hash, histogram_similarity, perceptual_hash_similarity, transition_score


def solid(value: int) -> np.ndarray:
    return np.full((16, 16, 3), value, dtype=np.uint8)


def test_histogram_similarity_identical_images_is_one() -> None:
    image = solid(128)

    assert histogram_similarity(image, image.copy()) == 1.0


def test_histogram_similarity_different_solid_images_is_low() -> None:
    assert histogram_similarity(solid(0), solid(255)) == 0.0


def test_perceptual_hash_similarity_identical_images_is_one() -> None:
    image = np.arange(16 * 16, dtype=np.uint8).reshape(16, 16)

    assert perceptual_hash_similarity(image, image.copy()) == 1.0


def test_perceptual_hash_similarity_detects_different_structure() -> None:
    dark_left = np.zeros((16, 16), dtype=np.uint8)
    dark_left[:, 8:] = 255
    dark_right = np.zeros((16, 16), dtype=np.uint8)
    dark_right[:, :8] = 255

    assert perceptual_hash_similarity(dark_left, dark_right) < 0.5


def test_transition_score_combines_histogram_and_hash() -> None:
    image = solid(64)

    assert transition_score(image, image.copy()) == 1.0


def test_average_hash_is_deterministic() -> None:
    image = np.arange(32 * 32, dtype=np.uint8).reshape(32, 32)

    assert np.array_equal(average_hash(image), average_hash(image))
