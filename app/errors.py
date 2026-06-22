"""Structured application errors for the video stitching worker."""

from __future__ import annotations


class AppError(Exception):
    """Base error that can be serialized into job metadata."""

    code = "app_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_metadata(self) -> dict:
        payload = {
            "code": self.code,
            "message": self.message,
        }
        if self.details:
            payload["details"] = self.details
        return payload


class ConfigError(AppError):
    """Raised when a job config is malformed or unsupported."""

    code = "config_error"


class ProcessingNotImplementedError(AppError):
    """Raised for modes whose real video processing is not wired yet."""

    code = "processing_not_implemented"

