from __future__ import annotations

import json

import pytest

from app.config import parse_config
from app.errors import ConfigError


def valid_ordered_config() -> dict:
    return {
        "job_id": "ordered_test",
        "mode": "ordered_concat",
        "clips": [
            {"clip_id": "clip_001", "path": "/app/input/clip_001.mp4", "order": 1},
            {"clip_id": "clip_002", "path": "/app/input/clip_002.mp4", "order": 2},
        ],
        "output": {
            "video_path": "/app/output/final.mp4",
            "metadata_path": "/app/output/final_metadata.json",
        },
        "settings": {"resolution": "1280x720", "fps": 30, "transition": "cut"},
    }


def test_parse_ordered_config_merges_defaults() -> None:
    job = parse_config(valid_ordered_config())

    assert job.job_id == "ordered_test"
    assert job.mode == "ordered_concat"
    assert [clip.clip_id for clip in job.clips] == ["clip_001", "clip_002"]
    assert job.settings["resolution"] == "1280x720"
    assert job.settings["video_codec"] == "libx264"
    assert job.settings["audio_codec"] == "aac"


def test_ordered_mode_requires_contiguous_order_values() -> None:
    raw = valid_ordered_config()
    raw["clips"][1]["order"] = 3

    with pytest.raises(ConfigError, match="contiguous order"):
        parse_config(raw)


def test_shuffled_mode_allows_missing_order_and_validates_ground_truth() -> None:
    raw = {
        "job_id": "shuffle_test",
        "mode": "shuffled_reorder_concat",
        "clips": [
            {"clip_id": "clip_b", "path": "/app/input/clip_b.mp4"},
            {"clip_id": "clip_a", "path": "/app/input/clip_a.mp4"},
        ],
        "ground_truth_order": ["clip_a", "clip_b"],
        "output": {
            "video_path": "/app/output/final.mp4",
            "metadata_path": "/app/output/final_metadata.json",
        },
    }

    job = parse_config(raw)

    assert job.mode == "shuffled_reorder_concat"
    assert [clip.order for clip in job.clips] == [None, None]
    assert job.ground_truth_order == ["clip_a", "clip_b"]


def test_ground_truth_rejects_unknown_clip_ids() -> None:
    raw = valid_ordered_config()
    raw["ground_truth_order"] = ["clip_001", "missing"]

    with pytest.raises(ConfigError, match="unknown clip IDs"):
        parse_config(raw)


def test_rejects_unsupported_mode() -> None:
    raw = valid_ordered_config()
    raw["mode"] = "magic_mode"

    with pytest.raises(ConfigError, match="Unsupported job mode"):
        parse_config(raw)


def test_rejects_duplicate_clip_ids() -> None:
    raw = valid_ordered_config()
    raw["clips"][1]["clip_id"] = "clip_001"

    with pytest.raises(ConfigError, match="unique"):
        parse_config(raw)


def test_rejects_non_cut_transition() -> None:
    raw = valid_ordered_config()
    raw["settings"]["transition"] = "crossfade"

    with pytest.raises(ConfigError, match="Only hard cut"):
        parse_config(raw)


def test_examples_are_valid() -> None:
    for path in [
        "examples/ordered_job.json",
        "examples/shuffled_job.json",
        "examples/timeline_job.json",
    ]:
        with open(path, encoding="utf-8") as handle:
            parse_config(json.load(handle))
