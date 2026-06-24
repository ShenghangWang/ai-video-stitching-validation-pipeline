"""Command-line entrypoint for the video stitching validation worker."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from app.config import JobConfig, load_config
from app.errors import AppError, ConfigError
from app.metadata import failure_metadata, success_metadata, write_metadata
from app.stitcher import process_ordered_concat, process_shuffled_reorder_concat, process_timeline_assembly
from app.video_probe import collect_available_clip_metadata


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AI video stitching validation worker")
    parser.add_argument("--config", required=True, help="Path to a job JSON config")
    parser.add_argument("--workdir", default="/app/tmp", help="Directory for intermediate files")
    parser.add_argument("--verbose", action="store_true", help="Print progress details")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    started_at = time.perf_counter()
    job: JobConfig | None = None

    try:
        job = load_config(args.config)
        Path(args.workdir).mkdir(parents=True, exist_ok=True)

        if job.mode == "ordered_concat":
            result = process_ordered_concat(job, args.workdir)
            metadata = success_metadata(
                job,
                started_at=started_at,
                warnings=[],
                clip_metadata=[clip.to_metadata() for clip in result.clip_metadata],
                stage="video_stitched",
                extra={
                    "clip_order": result.clip_order,
                    "normalized_clips": [clip.to_metadata() for clip in result.normalized_clips],
                    "concat_file_path": result.concat_file_path,
                    "concat_ffmpeg": result.ffmpeg_result.to_metadata(),
                    "output_video_path": result.output_video_path,
                },
            )
            write_metadata(job.output.metadata_path, metadata)

            if args.verbose:
                print(f"Processed ordered job {job.job_id!r}.")
                print(f"Wrote video to {job.output.video_path}.")
                print(f"Wrote metadata to {job.output.metadata_path}.")
            return 0

        if job.mode == "shuffled_reorder_concat":
            result = process_shuffled_reorder_concat(job, args.workdir)
            metadata = success_metadata(
                job,
                started_at=started_at,
                warnings=result.order_solution.warnings,
                clip_metadata=[clip.to_metadata() for clip in result.clip_metadata],
                stage="video_stitched",
                extra=result.to_metadata(),
            )
            write_metadata(job.output.metadata_path, metadata)

            if args.verbose:
                print(f"Processed shuffled job {job.job_id!r}.")
                print(f"Predicted order: {', '.join(result.predicted_order)}.")
                print(f"Wrote video to {job.output.video_path}.")
                print(f"Wrote metadata to {job.output.metadata_path}.")
            return 0

        if job.mode == "timeline_assembly":
            result = process_timeline_assembly(job, args.workdir)
            metadata = success_metadata(
                job,
                started_at=started_at,
                warnings=[],
                clip_metadata=[clip.to_metadata() for clip in result.clip_metadata],
                stage="video_stitched",
                extra=result.to_metadata(),
            )
            write_metadata(job.output.metadata_path, metadata)

            if args.verbose:
                print(f"Processed timeline job {job.job_id!r}.")
                print(f"Wrote video to {job.output.video_path}.")
                print(f"Wrote metadata to {job.output.metadata_path}.")
            return 0

        warnings = [
            "This mode is validated only; video processing is scheduled for a later execution."
        ]
        clip_metadata, probe_warnings = collect_available_clip_metadata(job.clips)
        warnings.extend(probe_warnings)
        metadata = success_metadata(job, started_at=started_at, warnings=warnings, clip_metadata=clip_metadata)
        write_metadata(job.output.metadata_path, metadata)

        if args.verbose:
            print(f"Validated job {job.job_id!r} in mode {job.mode!r}.")
            print(f"Wrote metadata to {job.output.metadata_path}.")
        return 0

    except AppError as exc:
        return _handle_app_error(exc, job=job, started_at=started_at, verbose=args.verbose)
    except OSError as exc:
        error = ConfigError("Filesystem error while preparing the job.", details={"error": str(exc)})
        return _handle_app_error(error, job=job, started_at=started_at, verbose=args.verbose)


def _handle_app_error(exc: AppError, *, job: JobConfig | None, started_at: float, verbose: bool) -> int:
    metadata = failure_metadata(job=job, error=exc, started_at=started_at)

    if job is not None:
        try:
            write_metadata(job.output.metadata_path, metadata)
        except OSError:
            pass

    if verbose:
        print(f"Job failed: {exc.message}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
