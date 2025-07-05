"""
Wyoiwyget AI Services - Azure ML Backend
Main FastAPI application for AI-powered avatar generation and virtual try-on
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uvicorn
from pydantic import BaseModel, Field
import structlog

from app.core.config import settings
from app.core.database import init_database, close_database
from app.core.auth import verify_token
from app.services.avatar_service import AvatarService
from app.services.virtual_tryon_service import VirtualTryOnService
from app.services.body_measurement_service import BodyMeasurementService
from app.services.product_matching_service import ProductMatchingService
from app.utils.azure_client import AzureClient
from app.utils.logging import setup_logging

# Setup structured logging
setup_logging()
logger = structlog.get_logger()

# Security
security = HTTPBearer()

# Pydantic models
class BodyMeasurementRequest(BaseModel):
    """Request model for body measurements"""
    height: float = Field(..., ge=100, le=250, description="Height in cm")
    weight: float = Field(..., ge=30, le=300, description="Weight in kg")
    chest: Optional[float] = Field(None, ge=60, le=150, description="Chest circumference in cm")
    waist: Optional[float] = Field(None, ge=50, le=150, description="Waist circumference in cm")
    hips: Optional[float] = Field(None, ge=60, le=150, description="Hip circumference in cm")
    shoulder_width: Optional[float] = Field(None, ge=30, le=60, description="Shoulder width in cm")
    arm_length: Optional[float] = Field(None, ge=50, le=100, description="Arm length in cm")
    inseam: Optional[float] = Field(None, ge=50, le=100, description="Inseam length in cm")
    shoe_size: Optional[float] = Field(None, ge=30, le=50, description="Shoe size (EU)")
    body_type: Optional[str] = Field(None, description="Body type (slim, athletic, average, curvy, plus_size)")
    gender: Optional[str] = Field(None, description="Gender (male, female, other)")

class AvatarGenerationRequest(BaseModel):
    """Request model for avatar generation"""
    user_id: str = Field(..., description="User ID")
    body_measurements: BodyMeasurementRequest
    face_image_url: Optional[str] = Field(None, description="URL to face image")
    body_image_url: Optional[str] = Field(None, description="URL to body image")
    preferences: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Avatar preferences")

class VirtualTryOnRequest(BaseModel):
    """Request model for virtual try-on"""
    user_id: str = Field(..., description="User ID")
    avatar_id: str = Field(..., description="Avatar ID")
    product_id: str = Field(..., description="Product ID")
    product_url: Optional[str] = Field(None, description="Product URL")
    try_on_settings: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Try-on settings")

class ProductMatchingRequest(BaseModel):
    """Request model for product matching"""
    source_product_url: str = Field(..., description="Source product URL")
    target_platforms: list[str] = Field(..., description="Target platforms to search")
    matching_criteria: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Matching criteria")

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    timestamp: str
    services: Dict[str, str]

# Application lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Wyoiwyget AI Services")
    
    # Initialize database connections
    await init_database()
    
    # Initialize Azure clients
    await AzureClient.initialize()
    
    # Initialize AI services
    app.state.avatar_service = AvatarService()
    app.state.virtual_tryon_service = VirtualTryOnService()
    app.state.body_measurement_service = BodyMeasurementService()
    app.state.product_matching_service = ProductMatchingService()
    
    logger.info("Wyoiwyget AI Services started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Wyoiwyget AI Services")
    await close_database()
    logger.info("Wyoiwyget AI Services shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="Wyoiwyget AI Services",
    description="AI-powered avatar generation and virtual try-on services for e-commerce",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Dependency for authentication
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get current authenticated user"""
    try:
        token = credentials.credentials
        user = await verify_token(token)
        return user
    except Exception as e:
        logger.error("Authentication failed", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    import datetime
    
    services_status = {
        "database": "healthy",
        "azure_storage": "healthy",
        "azure_openai": "healthy",
        "avatar_service": "healthy",
        "virtual_tryon_service": "healthy"
    }
    
    # Check Azure services
    try:
        azure_client = AzureClient.get_instance()
        if not azure_client.is_initialized():
            services_status["azure_storage"] = "unhealthy"
            services_status["azure_openai"] = "unhealthy"
    except Exception as e:
        logger.error("Azure services health check failed", error=str(e))
        services_status["azure_storage"] = "unhealthy"
        services_status["azure_openai"] = "unhealthy"
    
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        timestamp=datetime.datetime.utcnow().isoformat(),
        services=services_status
    )

# Body measurement analysis endpoint
@app.post("/api/v1/body-measurements/analyze")
async def analyze_body_measurements(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Analyze body measurements from uploaded image"""
    try:
        logger.info("Analyzing body measurements", user_id=current_user["id"])
        
        # Validate file
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Process image
        body_measurement_service = app.state.body_measurement_service
        measurements = await body_measurement_service.analyze_image(file)
        
        logger.info("Body measurements analyzed successfully", user_id=current_user["id"])
        return JSONResponse(content=measurements)
        
    except Exception as e:
        logger.error("Body measurement analysis failed", error=str(e), user_id=current_user["id"])
        raise HTTPException(status_code=500, detail="Failed to analyze body measurements")

# Avatar generation endpoint
@app.post("/api/v1/avatars/generate")
async def generate_avatar(
    request: AvatarGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate AI avatar for user"""
    try:
        logger.info("Generating avatar", user_id=current_user["id"])
        
        # Validate user ownership
        if request.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to generate avatar for this user")
        
        avatar_service = app.state.avatar_service
        
        # Start avatar generation in background
        task_id = await avatar_service.start_generation(
            user_id=request.user_id,
            body_measurements=request.body_measurements.dict(),
            face_image_url=request.face_image_url,
            body_image_url=request.body_image_url,
            preferences=request.preferences
        )
        
        logger.info("Avatar generation started", user_id=current_user["id"], task_id=task_id)
        return JSONResponse(content={"task_id": task_id, "status": "processing"})
        
    except Exception as e:
        logger.error("Avatar generation failed", error=str(e), user_id=current_user["id"])
        raise HTTPException(status_code=500, detail="Failed to generate avatar")

# Avatar status endpoint
@app.get("/api/v1/avatars/{avatar_id}/status")
async def get_avatar_status(
    avatar_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get avatar generation status"""
    try:
        logger.info("Getting avatar status", user_id=current_user["id"], avatar_id=avatar_id)
        
        avatar_service = app.state.avatar_service
        status = await avatar_service.get_status(avatar_id, current_user["id"])
        
        return JSONResponse(content=status)
        
    except Exception as e:
        logger.error("Failed to get avatar status", error=str(e), user_id=current_user["id"])
        raise HTTPException(status_code=500, detail="Failed to get avatar status")

# Virtual try-on endpoint
@app.post("/api/v1/virtual-tryon")
async def virtual_try_on(
    request: VirtualTryOnRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Perform virtual try-on with product"""
    try:
        logger.info("Starting virtual try-on", user_id=current_user["id"], product_id=request.product_id)
        
        # Validate user ownership
        if request.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to perform try-on for this user")
        
        virtual_tryon_service = app.state.virtual_tryon_service
        
        # Start virtual try-on in background
        task_id = await virtual_tryon_service.start_try_on(
            user_id=request.user_id,
            avatar_id=request.avatar_id,
            product_id=request.product_id,
            product_url=request.product_url,
            settings=request.try_on_settings
        )
        
        logger.info("Virtual try-on started", user_id=current_user["id"], task_id=task_id)
        return JSONResponse(content={"task_id": task_id, "status": "processing"})
        
    except Exception as e:
        logger.error("Virtual try-on failed", error=str(e), user_id=current_user["id"])
        raise HTTPException(status_code=500, detail="Failed to perform virtual try-on")

# Virtual try-on status endpoint
@app.get("/api/v1/virtual-tryon/{task_id}/status")
async def get_try_on_status(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get virtual try-on status"""
    try:
        logger.info("Getting try-on status", user_id=current_user["id"], task_id=task_id)
        
        virtual_tryon_service = app.state.virtual_tryon_service
        status = await virtual_tryon_service.get_status(task_id, current_user["id"])
        
        return JSONResponse(content=status)
        
    except Exception as e:
        logger.error("Failed to get try-on status", error=str(e), user_id=current_user["id"])
        raise HTTPException(status_code=500, detail="Failed to get try-on status")

# Product matching endpoint
@app.post("/api/v1/products/match")
async def match_products(
    request: ProductMatchingRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Match products across different platforms"""
    try:
        logger.info("Matching products", user_id=current_user["id"])
        
        product_matching_service = app.state.product_matching_service
        
        matches = await product_matching_service.find_matches(
            source_url=request.source_product_url,
            target_platforms=request.target_platforms,
            criteria=request.matching_criteria
        )
        
        logger.info("Product matching completed", user_id=current_user["id"], match_count=len(matches))
        return JSONResponse(content={"matches": matches})
        
    except Exception as e:
        logger.error("Product matching failed", error=str(e), user_id=current_user["id"])
        raise HTTPException(status_code=500, detail="Failed to match products")

# Fit prediction endpoint
@app.post("/api/v1/fit/predict")
async def predict_fit(
    avatar_id: str,
    product_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Predict fit for product on avatar"""
    try:
        logger.info("Predicting fit", user_id=current_user["id"], avatar_id=avatar_id, product_id=product_id)
        
        virtual_tryon_service = app.state.virtual_tryon_service
        
        fit_prediction = await virtual_tryon_service.predict_fit(
            avatar_id=avatar_id,
            product_id=product_id,
            user_id=current_user["id"]
        )
        
        logger.info("Fit prediction completed", user_id=current_user["id"])
        return JSONResponse(content=fit_prediction)
        
    except Exception as e:
        logger.error("Fit prediction failed", error=str(e), user_id=current_user["id"])
        raise HTTPException(status_code=500, detail="Failed to predict fit")

# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error("Unhandled exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP exception handler"""
    logger.warning("HTTP exception", status_code=exc.status_code, detail=exc.detail, path=request.url.path)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Main entry point
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8001)),
        reload=settings.ENVIRONMENT == "development",
        log_level="info"
    ) 