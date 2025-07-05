"""
Structured logging configuration for Wyoiwyget AI Services
"""

import sys
import logging
from typing import Any, Dict
import structlog
from structlog.stdlib import LoggerFactory


def setup_logging() -> None:
    """Setup structured logging configuration"""
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )
    
    # Set log level based on environment
    log_level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
    logging.getLogger().setLevel(log_level)


def get_logger(name: str = None) -> structlog.BoundLogger:
    """Get a structured logger instance"""
    return structlog.get_logger(name)


def log_request(request_data: Dict[str, Any], logger: structlog.BoundLogger = None) -> None:
    """Log incoming request data"""
    if logger is None:
        logger = get_logger()
    
    logger.info(
        "Incoming request",
        method=request_data.get("method"),
        url=request_data.get("url"),
        user_id=request_data.get("user_id"),
        ip=request_data.get("ip"),
        user_agent=request_data.get("user_agent"),
    )


def log_response(response_data: Dict[str, Any], logger: structlog.BoundLogger = None) -> None:
    """Log outgoing response data"""
    if logger is None:
        logger = get_logger()
    
    logger.info(
        "Outgoing response",
        status_code=response_data.get("status_code"),
        response_time=response_data.get("response_time"),
        user_id=response_data.get("user_id"),
    )


def log_error(error: Exception, context: Dict[str, Any] = None, logger: structlog.BoundLogger = None) -> None:
    """Log error with context"""
    if logger is None:
        logger = get_logger()
    
    log_data = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "error_traceback": getattr(error, "__traceback__", None),
    }
    
    if context:
        log_data.update(context)
    
    logger.error("Error occurred", **log_data)


def log_ai_task_start(task_type: str, task_id: str, user_id: str, logger: structlog.BoundLogger = None) -> None:
    """Log AI task start"""
    if logger is None:
        logger = get_logger()
    
    logger.info(
        "AI task started",
        task_type=task_type,
        task_id=task_id,
        user_id=user_id,
    )


def log_ai_task_complete(task_type: str, task_id: str, user_id: str, duration: float, logger: structlog.BoundLogger = None) -> None:
    """Log AI task completion"""
    if logger is None:
        logger = get_logger()
    
    logger.info(
        "AI task completed",
        task_type=task_type,
        task_id=task_id,
        user_id=user_id,
        duration_seconds=duration,
    )


def log_ai_task_error(task_type: str, task_id: str, user_id: str, error: Exception, logger: structlog.BoundLogger = None) -> None:
    """Log AI task error"""
    if logger is None:
        logger = get_logger()
    
    logger.error(
        "AI task failed",
        task_type=task_type,
        task_id=task_id,
        user_id=user_id,
        error_type=type(error).__name__,
        error_message=str(error),
    )


def log_azure_service_call(service: str, operation: str, duration: float, success: bool, logger: structlog.BoundLogger = None) -> None:
    """Log Azure service API calls"""
    if logger is None:
        logger = get_logger()
    
    log_level = logger.info if success else logger.error
    
    log_level(
        "Azure service call",
        service=service,
        operation=operation,
        duration_seconds=duration,
        success=success,
    )


def log_file_upload(file_info: Dict[str, Any], user_id: str, logger: structlog.BoundLogger = None) -> None:
    """Log file upload events"""
    if logger is None:
        logger = get_logger()
    
    logger.info(
        "File uploaded",
        file_name=file_info.get("filename"),
        file_size=file_info.get("size"),
        file_type=file_info.get("content_type"),
        user_id=user_id,
    )


def log_model_inference(model: str, input_size: Dict[str, Any], output_size: Dict[str, Any], duration: float, logger: structlog.BoundLogger = None) -> None:
    """Log ML model inference"""
    if logger is None:
        logger = get_logger()
    
    logger.info(
        "Model inference",
        model=model,
        input_size=input_size,
        output_size=output_size,
        duration_seconds=duration,
    ) 