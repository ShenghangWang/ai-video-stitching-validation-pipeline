from __future__ import annotations

import sys
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.config import ClipConfig
from app.ffmpeg_utils import FFmpegResult
from app.frame_extractor import extract_all_boundary_frames, extract_boundary_frames


class FakeCapture:
    def __init__(self, path: str, *, opened: bool = True) -> None:
        self.path = path
        self.opened = opened
        self.positions: list[int] = []
        self.released = False

    def isOpened(self) -> bool:
        return self.opened

    def get(self, prop: int) -> int:
        return 4

    def set(self, prop: int, value: int) -> None:
        self.positions.append(value)

    def read(self):
        return True, object()

    def release(self) -> None:
        self.released = True


def fake_cv2(capture: FakeCapture):
    return SimpleNamespace(
        CAP_PROP_FRAME_COUNT=7,
        CAP_PROP_POS_FRAMES=1,
        VideoCapture=Mock(return_value=capture),
        imwrite=Mock(return_value=True),
    )


def test_extract_boundary_frames_uses_opencv(tmp_path, monkeypatch) -> None:
    capture = FakeCapture("clip.mp4")
    cv2 = fake_cv2(capture)
    monkeypatch.setitem(sys.modules, "cv2", cv2)

    frames = extract_boundary_frames(ClipConfig(clip_id="clip 001", path="clip.mp4"), tmp_path)

    assert frames.method == "opencv"
    assert frames.first_frame_path.endswith("frames/clip_001/first.png")
    assert frames.last_frame_path.endswith("frames/clip_001/last.png")
    assert frames.diagnostics["frame_count"] == 4
    assert capture.positions == [0, 3]
    assert capture.released is True
    assert cv2.imwrite.call_count == 2


def test_extract_boundary_frames_falls_back_to_ffmpeg(tmp_path, monkeypatch) -> None:
    capture = FakeCapture("clip.mp4", opened=False)
    monkeypatch.setitem(sys.modules, "cv2", fake_cv2(capture))

    with patch(
        "app.frame_extractor.run_ffmpeg", return_value=FFmpegResult(["ffmpeg"], 0, "", "")
    ) as run:
        frames = extract_boundary_frames(ClipConfig(clip_id="clip_001", path="clip.mp4"), tmp_path)

    assert frames.method == "ffmpeg"
    assert "opencv_error" in frames.diagnostics
    assert run.call_count == 2
    assert run.call_args_list[0].args[0][0:4] == ["ffmpeg", "-y", "-i", "clip.mp4"]
    assert "-sseof" in run.call_args_list[1].args[0]


def test_extract_all_boundary_frames_preserves_clip_order(tmp_path, monkeypatch) -> None:
    monkeypatch.setitem(sys.modules, "cv2", fake_cv2(FakeCapture("clip.mp4")))

    frames = extract_all_boundary_frames(
        [
            ClipConfig(clip_id="clip_a", path="a.mp4"),
            ClipConfig(clip_id="clip_b", path="b.mp4"),
        ],
        tmp_path,
    )

    assert [frame.clip_id for frame in frames] == ["clip_a", "clip_b"]
