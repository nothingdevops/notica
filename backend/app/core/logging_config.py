import logging
import sys
from contextvars import ContextVar
from pythonjsonlogger import jsonlogger

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get("-")
        return True


def setup_logging(log_level: str = "INFO") -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)

    fmt = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(name)s %(levelname)s %(message)s %(request_id)s",
        rename_fields={
            "asctime": "timestamp",
            "levelname": "level",
            "name": "logger",
            "request_id": "request_id",
        },
        datefmt="%Y-%m-%dT%H:%M:%S.%fZ",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(fmt)
    handler.addFilter(_RequestIdFilter())

    root = logging.getLogger()
    root.handlers = []
    root.addHandler(handler)
    root.setLevel(level)

    # Silence noisy third-party loggers
    for noisy in ("apscheduler", "sqlalchemy.engine", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    # uvicorn keeps its own loggers — override them to use same handler
    for uv in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(uv)
        lg.handlers = [handler]
        lg.propagate = False
        lg.setLevel(level)
