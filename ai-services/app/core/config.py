"""
Configuration settings for Wyoiwyget AI Services
"""

import os
from typing import List, Optional
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Application settings"""
    
    # Environment
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG: bool = Field(default=True, env="DEBUG")
    
    # Server
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=8001, env="PORT")
    
    # Security
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ALGORITHM: str = Field(default="HS256", env="ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    
    # CORS
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001"],
        env="ALLOWED_ORIGINS"
    )
    ALLOWED_HOSTS: List[str] = Field(
        default=["localhost", "127.0.0.1"],
        env="ALLOWED_HOSTS"
    )
    
    # Database
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    
    # Azure Services
    AZURE_STORAGE_CONNECTION_STRING: str = Field(..., env="AZURE_STORAGE_CONNECTION_STRING")
    AZURE_STORAGE_CONTAINER_NAME: str = Field(default="wyoiwyget-assets", env="AZURE_STORAGE_CONTAINER_NAME")
    
    # Azure AI Services
    AZURE_OPENAI_API_KEY: str = Field(..., env="AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_ENDPOINT: str = Field(..., env="AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_API_VERSION: str = Field(default="2024-02-15-preview", env="AZURE_OPENAI_API_VERSION")
    
    # Azure Computer Vision
    AZURE_COMPUTER_VISION_KEY: str = Field(..., env="AZURE_COMPUTER_VISION_KEY")
    AZURE_COMPUTER_VISION_ENDPOINT: str = Field(..., env="AZURE_COMPUTER_VISION_ENDPOINT")
    
    # Azure Custom Vision
    AZURE_CUSTOM_VISION_KEY: str = Field(..., env="AZURE_CUSTOM_VISION_KEY")
    AZURE_CUSTOM_VISION_ENDPOINT: str = Field(..., env="AZURE_CUSTOM_VISION_ENDPOINT")
    AZURE_CUSTOM_VISION_PROJECT_ID: str = Field(..., env="AZURE_CUSTOM_VISION_PROJECT_ID")
    
    # Azure Form Recognizer
    AZURE_FORM_RECOGNIZER_KEY: str = Field(..., env="AZURE_FORM_RECOGNIZER_KEY")
    AZURE_FORM_RECOGNIZER_ENDPOINT: str = Field(..., env="AZURE_FORM_RECOGNIZER_ENDPOINT")
    
    # Azure Key Vault
    AZURE_KEY_VAULT_URL: str = Field(..., env="AZURE_KEY_VAULT_URL")
    
    # Redis (for caching and task queues)
    REDIS_URL: str = Field(default="redis://localhost:6379", env="REDIS_URL")
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FORMAT: str = Field(default="json", env="LOG_FORMAT")
    
    # File Upload
    MAX_FILE_SIZE: int = Field(default=10 * 1024 * 1024, env="MAX_FILE_SIZE")  # 10MB
    ALLOWED_IMAGE_TYPES: List[str] = Field(
        default=["image/jpeg", "image/png", "image/webp"],
        env="ALLOWED_IMAGE_TYPES"
    )
    
    # AI Model Settings
    AVATAR_GENERATION_MODEL: str = Field(default="dall-e-3", env="AVATAR_GENERATION_MODEL")
    VIRTUAL_TRYON_MODEL: str = Field(default="stable-diffusion-xl", env="VIRTUAL_TRYON_MODEL")
    BODY_MEASUREMENT_MODEL: str = Field(default="yolov8-pose", env="BODY_MEASUREMENT_MODEL")
    
    # Processing Settings
    MAX_CONCURRENT_TASKS: int = Field(default=5, env="MAX_CONCURRENT_TASKS")
    TASK_TIMEOUT_SECONDS: int = Field(default=300, env="TASK_TIMEOUT_SECONDS")
    
    # External APIs
    OPENAI_API_KEY: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    REPLICATE_API_TOKEN: Optional[str] = Field(default=None, env="REPLICATE_API_TOKEN")
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()

# Validate required settings
def validate_settings():
    """Validate that all required settings are present"""
    required_settings = [
        "SECRET_KEY",
        "DATABASE_URL",
        "AZURE_STORAGE_CONNECTION_STRING",
        "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_ENDPOINT",
    ]
    
    missing_settings = []
    for setting in required_settings:
        if not getattr(settings, setting, None):
            missing_settings.append(setting)
    
    if missing_settings:
        raise ValueError(f"Missing required settings: {', '.join(missing_settings)}")

# Validate settings on import
if settings.ENVIRONMENT != "test":
    validate_settings() 