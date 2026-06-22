"""Generate ordered and shuffled validation clips from one source video."""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import ClipConfig  # noqa: E402
from app.ffmpeg_utils import run_ffmpeg  # noqa: E402
from app.video_probe import probe_clip  # noqa: E402


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Cut a source video into validation clips and job configs")
    parser.add_argument("--source", required=True, help="Source MP4 path")
    parser.add_argument("--output-dir", required=True, help="Directory for generated clips and configs")
    parser.add_argument("--clip-length", type=float, required=True, help="Clip length in seconds")
    parser.add_argument("--shuffle", default="true", choices=("true", "false"), help="Whether to shuffle job order")
    parser.add_argument("--seed", type=int, default=123, help="Deterministic shuffle seed")
    parser.add_argument("--max-clips", type=int, default=None, help="Optional maximum number of clips")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    source = Path(args.source)
    output_dir = Path(args.output_dir)

    manifest = generate_test_clips(
        source=source,
        output_dir=output_dir,
        clip_length=args.clip_length,
        shuffle=args.shuffle == "true",
        seed=args.seed,
        max_clips=args.max_clips,
    )
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


def generate_test_clips(
    *,
    source: Path,
    output_dir: Path,
    clip_length: float,
    shuffle: bool = True,
    seed: int = 123,
    max_clips: int | None = None,
) -> dict:
    if clip_length <= 0:
        raise ValueError("clip_length must be positive")
    if max_clips is not None and max_clips <= 0:
        raise ValueError("max_clips must be positive when provided")

    source = source.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    source_metadata = probe_clip(ClipConfig(clip_id="source", path=str(source)))
    if source_metadata.duration_seconds is None or source_metadata.duration_seconds <= 0:
        raise ValueError("Source duration could not be determined")

    clip_specs = _clip_specs(source_metadata.duration_seconds, clip_length, max_clips=max_clips)
    clips = []
    for index, start_seconds, duration_seconds in clip_specs:
        clip_id = f"clip_{index:03d}"
        clip_path = output_dir / f"{clip_id}.mp4"
        command = [
            "ffmpeg",
            "-y",
            "-ss",
            _format_seconds(start_seconds),
            "-i",
            str(source),
            "-t",
            _format_seconds(duration_seconds),
            "-c",
            "copy",
            str(clip_path),
        ]
        run_ffmpeg(command, log_path=output_dir / f"{clip_id}_cut_ffmpeg.log")
        clips.append({"clip_id": clip_id, "path": str(clip_path), "order": index})

    ground_truth_order = [clip["clip_id"] for clip in clips]
    ordered_job = _ordered_job(clips, output_dir, ground_truth_order)
    shuffled_job = _shuffled_job(clips, output_dir, ground_truth_order, shuffle=shuffle, seed=seed)

    ordered_path = output_dir / "ordered_job.json"
    shuffled_path = output_dir / "shuffled_job.json"
    ordered_path.write_text(json.dumps(ordered_job, indent=2) + "\n", encoding="utf-8")
    shuffled_path.write_text(json.dumps(shuffled_job, indent=2) + "\n", encoding="utf-8")

    manifest = {
        "source": str(source),
        "output_dir": str(output_dir),
        "clip_length_seconds": clip_length,
        "clip_count": len(clips),
        "ground_truth_order": ground_truth_order,
        "ordered_job_path": str(ordered_path),
        "shuffled_job_path": str(shuffled_path),
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def _clip_specs(duration_seconds: float, clip_length: float, *, max_clips: int | None) -> list[tuple[int, float, float]]:
    specs = []
    start = 0.0
    index = 1
    while start + clip_length <= duration_seconds + 0.001:
        specs.append((index, start, clip_length))
        index += 1
        start += clip_length
        if max_clips is not None and len(specs) >= max_clips:
            break
    if not specs:
        raise ValueError("Source is shorter than the requested clip length")
    return specs


def _ordered_job(clips: list[dict], output_dir: Path, ground_truth_order: list[str]) -> dict:
    return {
        "job_id": "generated_ordered_job",
        "mode": "ordered_concat",
        "clips": clips,
        "ground_truth_order": ground_truth_order,
        "output": {
            "video_path": str(output_dir / "final_ordered.mp4"),
            "metadata_path": str(output_dir / "final_ordered_metadata.json"),
        },
        "settings": {
            "resolution": "1280x720",
            "fps": 30,
            "video_codec": "libx264",
            "audio_codec": "aac",
            "transition": "cut",
        },
    }


def _shuffled_job(
    clips: list[dict], output_dir: Path, ground_truth_order: list[str], *, shuffle: bool, seed: int
) -> dict:
    shuffled_clips = [{key: value for key, value in clip.items() if key != "order"} for clip in clips]
    if shuffle:
        rng = random.Random(seed)
        rng.shuffle(shuffled_clips)

    return {
        "job_id": "generated_shuffled_job",
        "mode": "shuffled_reorder_concat",
        "clips": shuffled_clips,
        "ground_truth_order": ground_truth_order,
        "output": {
            "video_path": str(output_dir / "final_reordered.mp4"),
            "metadata_path": str(output_dir / "final_reordered_metadata.json"),
        },
        "settings": {
            "resolution": "1280x720",
            "fps": 30,
            "video_codec": "libx264",
            "audio_codec": "aac",
            "transition": "cut",
            "ordering_method": "visual_boundary_similarity",
        },
    }


def _format_seconds(value: float) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".")


if __name__ == "__main__":
    raise SystemExit(main())
