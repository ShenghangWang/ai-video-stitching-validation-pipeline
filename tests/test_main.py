from __future__ import annotations

import json
from unittest.mock import patch

from app.ffmpeg_utils import FFmpegResult
from app.main import main
from app.normalizer import NormalizedClip
from app.stitcher import OrderedConcatResult
from app.stitcher import ShuffledConcatResult
from app.order_solver import OrderSolution
from app.video_probe import ClipMetadata


def test_main_processes_ordered_concat_and_writes_metadata(tmp_path) -> None:
    config_path = tmp_path / "job.json"
    metadata_path = tmp_path / "metadata.json"
    config_path.write_text(
        json.dumps(
            {
                "job_id": "ordered_test",
                "mode": "ordered_concat",
                "clips": [{"clip_id": "clip_001", "path": str(tmp_path / "clip.mp4"), "order": 1}],
                "output": {
                    "video_path": str(tmp_path / "final.mp4"),
                    "metadata_path": str(metadata_path),
                },
            }
        ),
        encoding="utf-8",
    )
    result = OrderedConcatResult(
        clip_order=["clip_001"],
        clip_metadata=[
            ClipMetadata(
                clip_id="clip_001",
                path=str(tmp_path / "clip.mp4"),
                duration_seconds=5.0,
                width=1920,
                height=1080,
                fps=30.0,
                video_codec="h264",
                audio_codec="aac",
                has_audio=True,
            )
        ],
        normalized_clips=[
            NormalizedClip(
                clip_id="clip_001",
                source_path=str(tmp_path / "clip.mp4"),
                output_path=str(tmp_path / "normalized" / "clip_001.mp4"),
                log_path=str(tmp_path / "logs" / "clip_001.log"),
                ffmpeg_command=["ffmpeg"],
            )
        ],
        concat_file_path=str(tmp_path / "concat.txt"),
        output_video_path=str(tmp_path / "final.mp4"),
        ffmpeg_result=FFmpegResult(["ffmpeg"], 0, "", "", str(tmp_path / "logs" / "concat.log")),
    )

    with patch("app.main.process_ordered_concat", return_value=result):
        exit_code = main(["--config", str(config_path), "--workdir", str(tmp_path)])

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    assert exit_code == 0
    assert metadata["stage"] == "video_stitched"
    assert metadata["clip_order"] == ["clip_001"]
    assert metadata["clip_metadata"][0]["duration_seconds"] == 5.0
    assert metadata["normalized_clips"][0]["clip_id"] == "clip_001"


def test_main_processes_shuffled_reorder_concat_and_writes_metadata(tmp_path) -> None:
    config_path = tmp_path / "job.json"
    metadata_path = tmp_path / "metadata.json"
    config_path.write_text(
        json.dumps(
            {
                "job_id": "shuffle_test",
                "mode": "shuffled_reorder_concat",
                "clips": [{"clip_id": "clip_001", "path": str(tmp_path / "clip.mp4")}],
                "ground_truth_order": ["clip_001"],
                "output": {
                    "video_path": str(tmp_path / "final.mp4"),
                    "metadata_path": str(metadata_path),
                },
            }
        ),
        encoding="utf-8",
    )
    clip_metadata = ClipMetadata(
        clip_id="clip_001",
        path=str(tmp_path / "clip.mp4"),
        duration_seconds=5.0,
        width=1920,
        height=1080,
        fps=30.0,
        video_codec="h264",
        audio_codec="aac",
        has_audio=True,
    )
    result = ShuffledConcatResult(
        predicted_order=["clip_001"],
        clip_metadata=[clip_metadata],
        boundary_frames=[],
        transition_scores=[],
        order_solution=OrderSolution(["clip_001"], 0.0, 1.0, "trivial", []),
        evaluation={"exact_order_match": True, "position_accuracy": 1.0, "adjacency_accuracy": 1.0},
        normalized_clips=[],
        concat_file_path=str(tmp_path / "concat.txt"),
        output_video_path=str(tmp_path / "final.mp4"),
        ffmpeg_result=FFmpegResult(["ffmpeg"], 0, "", "", str(tmp_path / "logs" / "concat.log")),
    )

    with patch("app.main.process_shuffled_reorder_concat", return_value=result):
        exit_code = main(["--config", str(config_path), "--workdir", str(tmp_path)])

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    assert exit_code == 0
    assert metadata["stage"] == "video_stitched"
    assert metadata["predicted_order"] == ["clip_001"]
    assert metadata["confidence_score"] == 1.0
    assert metadata["evaluation"]["exact_order_match"] is True
