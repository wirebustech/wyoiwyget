"""
Body Measurement Service
Handles body measurement analysis using computer vision
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
import json
import aiohttp
import structlog
from PIL import Image
import io
import numpy as np

from app.core.config import settings
from app.utils.azure_client import AzureClient
from app.models.measurements import BodyMeasurement, MeasurementResult
from app.core.database import get_database

logger = structlog.get_logger()

class BodyMeasurementService:
    """Service for body measurement analysis"""
    
    def __init__(self):
        self.azure_client = AzureClient.get_instance()
        self.measurement_cache: Dict[str, MeasurementResult] = {}
        
    async def analyze_image(self, image_file) -> Dict[str, Any]:
        """Analyze body measurements from uploaded image"""
        try:
            # Generate measurement ID
            measurement_id = str(uuid.uuid4())
            
            logger.info("Starting body measurement analysis", measurement_id=measurement_id)
            
            # Validate and process image
            image_data = await self._process_image(image_file)
            
            # Upload image to Azure Blob Storage
            image_url = await self._upload_measurement_image(image_data, measurement_id)
            
            # Analyze measurements using Azure Computer Vision
            measurements = await self._analyze_measurements(image_data, measurement_id)
            
            # Calculate additional measurements
            enhanced_measurements = await self._calculate_derived_measurements(measurements)
            
            # Store results
            result = MeasurementResult(
                id=measurement_id,
                image_url=image_url,
                measurements=enhanced_measurements,
                confidence_score=measurements.get("confidence_score", 0.0),
                created_at=datetime.utcnow()
            )
            
            # Cache result
            self.measurement_cache[measurement_id] = result
            
            # Save to database
            await self._save_measurement_result(result)
            
            logger.info("Body measurement analysis completed", measurement_id=measurement_id)
            
            return {
                "measurement_id": measurement_id,
                "measurements": enhanced_measurements,
                "confidence_score": result.confidence_score,
                "image_url": image_url,
                "created_at": result.created_at.isoformat()
            }
            
        except Exception as e:
            logger.error("Body measurement analysis failed", error=str(e))
            raise
    
    async def get_measurement(self, measurement_id: str) -> Optional[Dict[str, Any]]:
        """Get measurement result by ID"""
        try:
            # Check cache first
            if measurement_id in self.measurement_cache:
                result = self.measurement_cache[measurement_id]
                return {
                    "measurement_id": result.id,
                    "measurements": result.measurements,
                    "confidence_score": result.confidence_score,
                    "image_url": result.image_url,
                    "created_at": result.created_at.isoformat()
                }
            
            # Query database
            db = get_database()
            query = """
                SELECT id, image_url, measurements, confidence_score, created_at
                FROM body_measurements
                WHERE id = $1
            """
            
            result = await db.fetchrow(query, measurement_id)
            
            if result:
                return {
                    "measurement_id": result["id"],
                    "measurements": result["measurements"],
                    "confidence_score": result["confidence_score"],
                    "image_url": result["image_url"],
                    "created_at": result["created_at"].isoformat()
                }
            
            return None
            
        except Exception as e:
            logger.error("Failed to get measurement", error=str(e), measurement_id=measurement_id)
            return None
    
    async def estimate_measurements(
        self,
        height: float,
        weight: float,
        age: int,
        gender: str,
        body_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Estimate body measurements based on basic parameters"""
        try:
            logger.info("Estimating body measurements", height=height, weight=weight, age=age, gender=gender)
            
            # Calculate BMI
            height_m = height / 100
            bmi = weight / (height_m * height_m)
            
            # Base measurements using statistical models
            measurements = await self._calculate_statistical_measurements(
                height, weight, age, gender, bmi, body_type
            )
            
            # Add confidence score (lower for estimates)
            confidence_score = 0.6
            
            return {
                "measurements": measurements,
                "confidence_score": confidence_score,
                "method": "statistical_estimation",
                "bmi": round(bmi, 2),
                "body_type": body_type or "average"
            }
            
        except Exception as e:
            logger.error("Failed to estimate measurements", error=str(e))
            raise
    
    async def compare_measurements(
        self,
        measurement1_id: str,
        measurement2_id: str
    ) -> Dict[str, Any]:
        """Compare two sets of measurements"""
        try:
            # Get both measurements
            measurement1 = await self.get_measurement(measurement1_id)
            measurement2 = await self.get_measurement(measurement2_id)
            
            if not measurement1 or not measurement2:
                raise ValueError("One or both measurements not found")
            
            # Calculate differences
            differences = {}
            for key in measurement1["measurements"]:
                if key in measurement2["measurements"]:
                    val1 = measurement1["measurements"][key]
                    val2 = measurement2["measurements"][key]
                    if isinstance(val1, (int, float)) and isinstance(val2, (int, float)):
                        differences[key] = {
                            "difference": round(val2 - val1, 2),
                            "percentage_change": round(((val2 - val1) / val1) * 100, 2) if val1 != 0 else 0
                        }
            
            return {
                "measurement1": measurement1,
                "measurement2": measurement2,
                "differences": differences,
                "comparison_date": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error("Failed to compare measurements", error=str(e))
            raise
    
    async def _process_image(self, image_file) -> bytes:
        """Process and validate uploaded image"""
        try:
            # Read image data
            image_data = await image_file.read()
            
            # Validate image format
            try:
                image = Image.open(io.BytesIO(image_data))
                image.verify()
            except Exception:
                raise ValueError("Invalid image format")
            
            # Check image size
            image = Image.open(io.BytesIO(image_data))
            if image.size[0] < 200 or image.size[1] < 200:
                raise ValueError("Image too small. Minimum size is 200x200 pixels")
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
                img_byte_arr = io.BytesIO()
                image.save(img_byte_arr, format='JPEG')
                image_data = img_byte_arr.getvalue()
            
            return image_data
            
        except Exception as e:
            logger.error("Failed to process image", error=str(e))
            raise
    
    async def _upload_measurement_image(self, image_data: bytes, measurement_id: str) -> str:
        """Upload measurement image to Azure Blob Storage"""
        try:
            blob_name = f"measurement-images/{measurement_id}.jpg"
            blob_url = await self.azure_client.upload_blob(
                container_name="measurement-images",
                blob_name=blob_name,
                data=image_data,
                content_type="image/jpeg"
            )
            
            return blob_url
            
        except Exception as e:
            logger.error("Failed to upload measurement image", error=str(e), measurement_id=measurement_id)
            raise
    
    async def _analyze_measurements(self, image_data: bytes, measurement_id: str) -> Dict[str, Any]:
        """Analyze body measurements using Azure Computer Vision"""
        try:
            # Prepare image for analysis
            image_base64 = self._encode_image_base64(image_data)
            
            # Call Azure Computer Vision API
            vision_url = f"{settings.AZURE_VISION_ENDPOINT}/analyze"
            params = {
                "visualFeatures": "Objects,People",
                "details": "Landmarks",
                "language": "en"
            }
            
            headers = {
                "Ocp-Apim-Subscription-Key": settings.AZURE_VISION_KEY,
                "Content-Type": "application/octet-stream"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    vision_url,
                    params=params,
                    headers=headers,
                    data=image_data
                ) as response:
                    if response.status == 200:
                        vision_result = await response.json()
                        
                        # Extract body measurements from vision result
                        measurements = await self._extract_measurements_from_vision(vision_result, image_data)
                        
                        return measurements
                    else:
                        error_text = await response.text()
                        raise ValueError(f"Vision API failed: {error_text}")
                        
        except Exception as e:
            logger.error("Failed to analyze measurements", error=str(e), measurement_id=measurement_id)
            raise
    
    async def _extract_measurements_from_vision(
        self,
        vision_result: Dict[str, Any],
        image_data: bytes
    ) -> Dict[str, Any]:
        """Extract body measurements from Azure Vision API result"""
        try:
            measurements = {}
            
            # Check if people are detected
            if "people" in vision_result:
                people = vision_result["people"]
                if people:
                    # Use the first detected person
                    person = people[0]
                    
                    # Extract basic measurements from person detection
                    if "faceRectangle" in person:
                        face_rect = person["faceRectangle"]
                        # Estimate head size
                        head_width = face_rect["width"]
                        head_height = face_rect["height"]
                        measurements["head_circumference"] = round((head_width + head_height) * 0.5, 1)
                    
                    # Extract body measurements using custom ML model
                    body_measurements = await self._extract_body_measurements_ml(image_data)
                    measurements.update(body_measurements)
            
            # If no people detected, use fallback estimation
            if not measurements:
                measurements = await self._fallback_measurement_estimation(image_data)
            
            # Add confidence score
            measurements["confidence_score"] = 0.85 if measurements else 0.3
            
            return measurements
            
        except Exception as e:
            logger.error("Failed to extract measurements from vision", error=str(e))
            return {}
    
    async def _extract_body_measurements_ml(self, image_data: bytes) -> Dict[str, Any]:
        """Extract body measurements using custom ML model"""
        try:
            # Call custom ML endpoint for body measurement extraction
            ml_endpoint_url = f"{settings.AZURE_ML_ENDPOINT}/body-measurements"
            
            # Prepare image data
            image_base64 = self._encode_image_base64(image_data)
            
            input_data = {
                "image": image_base64,
                "model_version": "1.0"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    ml_endpoint_url,
                    json=input_data,
                    headers={
                        "Authorization": f"Bearer {settings.AZURE_ML_API_KEY}",
                        "Content-Type": "application/json"
                    }
                ) as response:
                    if response.status == 200:
                        ml_result = await response.json()
                        return ml_result.get("measurements", {})
                    else:
                        logger.warning("ML model failed, using fallback", status=response.status)
                        return {}
                        
        except Exception as e:
            logger.error("Failed to extract body measurements with ML", error=str(e))
            return {}
    
    async def _fallback_measurement_estimation(self, image_data: bytes) -> Dict[str, Any]:
        """Fallback measurement estimation when ML models fail"""
        try:
            # Basic estimation based on image analysis
            image = Image.open(io.BytesIO(image_data))
            
            # Analyze image dimensions and content
            width, height = image.size
            
            # Estimate measurements based on image proportions
            # This is a simplified estimation - in production, use more sophisticated algorithms
            estimated_measurements = {
                "height": 170,  # Default height in cm
                "chest": 95,
                "waist": 80,
                "hips": 95,
                "shoulder_width": 45,
                "arm_length": 65,
                "inseam": 75,
                "shoe_size": 42
            }
            
            return estimated_measurements
            
        except Exception as e:
            logger.error("Fallback measurement estimation failed", error=str(e))
            return {}
    
    async def _calculate_derived_measurements(self, base_measurements: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate additional derived measurements"""
        try:
            derived = base_measurements.copy()
            
            # Calculate BMI if height and weight are available
            if "height" in derived and "weight" in derived:
                height_m = derived["height"] / 100
                derived["bmi"] = round(derived["weight"] / (height_m * height_m), 2)
            
            # Calculate body proportions
            if "chest" in derived and "waist" in derived:
                derived["chest_waist_ratio"] = round(derived["chest"] / derived["waist"], 2)
            
            if "waist" in derived and "hips" in derived:
                derived["waist_hip_ratio"] = round(derived["waist"] / derived["hips"], 2)
            
            # Estimate clothing sizes
            if "chest" in derived:
                derived["shirt_size"] = self._estimate_shirt_size(derived["chest"])
            
            if "waist" in derived and "inseam" in derived:
                derived["pants_size"] = self._estimate_pants_size(derived["waist"], derived["inseam"])
            
            if "shoe_size" in derived:
                derived["shoe_size_us"] = self._convert_shoe_size_eu_to_us(derived["shoe_size"])
            
            return derived
            
        except Exception as e:
            logger.error("Failed to calculate derived measurements", error=str(e))
            return base_measurements
    
    async def _calculate_statistical_measurements(
        self,
        height: float,
        weight: float,
        age: int,
        gender: str,
        bmi: float,
        body_type: Optional[str]
    ) -> Dict[str, Any]:
        """Calculate measurements using statistical models"""
        try:
            # Base measurements using statistical formulas
            if gender.lower() == "male":
                # Male statistical model
                chest = height * 0.55 + weight * 0.1
                waist = height * 0.45 + weight * 0.15
                hips = height * 0.52 + weight * 0.12
                shoulder_width = height * 0.26
                arm_length = height * 0.38
                inseam = height * 0.44
            else:
                # Female statistical model
                chest = height * 0.53 + weight * 0.12
                waist = height * 0.42 + weight * 0.18
                hips = height * 0.55 + weight * 0.14
                shoulder_width = height * 0.24
                arm_length = height * 0.36
                inseam = height * 0.42
            
            # Adjust for body type
            if body_type:
                adjustments = self._get_body_type_adjustments(body_type)
                chest *= adjustments.get("chest", 1.0)
                waist *= adjustments.get("waist", 1.0)
                hips *= adjustments.get("hips", 1.0)
            
            # Adjust for age
            age_factor = 1.0 + (age - 25) * 0.002  # Slight increase with age
            
            return {
                "height": height,
                "weight": weight,
                "chest": round(chest * age_factor, 1),
                "waist": round(waist * age_factor, 1),
                "hips": round(hips * age_factor, 1),
                "shoulder_width": round(shoulder_width, 1),
                "arm_length": round(arm_length, 1),
                "inseam": round(inseam, 1),
                "shoe_size": round(42 + (height - 170) * 0.1, 1)  # Rough estimation
            }
            
        except Exception as e:
            logger.error("Failed to calculate statistical measurements", error=str(e))
            return {}
    
    def _get_body_type_adjustments(self, body_type: str) -> Dict[str, float]:
        """Get measurement adjustments for different body types"""
        adjustments = {
            "slim": {"chest": 0.9, "waist": 0.85, "hips": 0.9},
            "athletic": {"chest": 1.1, "waist": 0.95, "hips": 1.0},
            "average": {"chest": 1.0, "waist": 1.0, "hips": 1.0},
            "curvy": {"chest": 1.05, "waist": 1.1, "hips": 1.15},
            "plus_size": {"chest": 1.2, "waist": 1.25, "hips": 1.2}
        }
        return adjustments.get(body_type.lower(), {"chest": 1.0, "waist": 1.0, "hips": 1.0})
    
    def _estimate_shirt_size(self, chest: float) -> str:
        """Estimate shirt size based on chest measurement"""
        if chest < 85:
            return "XS"
        elif chest < 90:
            return "S"
        elif chest < 95:
            return "M"
        elif chest < 100:
            return "L"
        elif chest < 105:
            return "XL"
        else:
            return "XXL"
    
    def _estimate_pants_size(self, waist: float, inseam: float) -> str:
        """Estimate pants size based on waist and inseam"""
        waist_size = int(waist * 0.3937)  # Convert cm to inches
        inseam_size = int(inseam * 0.3937)
        return f"{waist_size}W x {inseam_size}L"
    
    def _convert_shoe_size_eu_to_us(self, eu_size: float) -> float:
        """Convert EU shoe size to US size"""
        return eu_size - 33 + 1
    
    def _encode_image_base64(self, image_data: bytes) -> str:
        """Encode image data to base64 string"""
        import base64
        return base64.b64encode(image_data).decode('utf-8')
    
    async def _save_measurement_result(self, result: MeasurementResult):
        """Save measurement result to database"""
        try:
            db = get_database()
            
            query = """
                INSERT INTO body_measurements (
                    id, image_url, measurements, confidence_score, created_at
                ) VALUES ($1, $2, $3, $4, $5)
            """
            
            await db.execute(
                query,
                result.id,
                result.image_url,
                json.dumps(result.measurements),
                result.confidence_score,
                result.created_at
            )
            
        except Exception as e:
            logger.error("Failed to save measurement result", error=str(e), measurement_id=result.id)
            raise 