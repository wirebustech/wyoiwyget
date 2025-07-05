"""
Virtual Try-On Service
Handles virtual try-on functionality using Azure ML models
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import json
import aiohttp
import structlog

from app.core.config import settings
from app.utils.azure_client import AzureClient
from app.models.tryon import TryOnTask, TryOnResult
from app.core.database import get_database

logger = structlog.get_logger()

class VirtualTryOnService:
    """Service for virtual try-on functionality"""
    
    def __init__(self):
        self.azure_client = AzureClient.get_instance()
        self.active_tasks: Dict[str, TryOnTask] = {}
        self.processing_queue: asyncio.Queue = asyncio.Queue()
        
    async def start_try_on(
        self,
        user_id: str,
        avatar_id: str,
        product_id: str,
        product_url: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None
    ) -> str:
        """Start virtual try-on process"""
        try:
            task_id = str(uuid.uuid4())
            
            # Create try-on task
            task = TryOnTask(
                id=task_id,
                user_id=user_id,
                avatar_id=avatar_id,
                product_id=product_id,
                product_url=product_url,
                settings=settings or {},
                status="processing",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            # Store task
            self.active_tasks[task_id] = task
            
            # Add to processing queue
            await self.processing_queue.put(task_id)
            
            # Start background processing
            asyncio.create_task(self._process_try_on(task_id))
            
            logger.info("Virtual try-on started", task_id=task_id, user_id=user_id)
            return task_id
            
        except Exception as e:
            logger.error("Failed to start virtual try-on", error=str(e), user_id=user_id)
            raise
    
    async def get_status(self, task_id: str, user_id: str) -> Dict[str, Any]:
        """Get try-on task status"""
        try:
            if task_id not in self.active_tasks:
                raise ValueError("Task not found")
            
            task = self.active_tasks[task_id]
            
            # Verify user ownership
            if task.user_id != user_id:
                raise ValueError("Not authorized to access this task")
            
            return {
                "task_id": task_id,
                "status": task.status,
                "progress": task.progress,
                "result_url": task.result_url,
                "error": task.error,
                "created_at": task.created_at.isoformat(),
                "updated_at": task.updated_at.isoformat()
            }
            
        except Exception as e:
            logger.error("Failed to get try-on status", error=str(e), task_id=task_id)
            raise
    
    async def predict_fit(
        self,
        avatar_id: str,
        product_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Predict fit for product on avatar"""
        try:
            logger.info("Predicting fit", avatar_id=avatar_id, product_id=product_id, user_id=user_id)
            
            # Get avatar data
            avatar_data = await self._get_avatar_data(avatar_id, user_id)
            if not avatar_data:
                raise ValueError("Avatar not found")
            
            # Get product data
            product_data = await self._get_product_data(product_id)
            if not product_data:
                raise ValueError("Product not found")
            
            # Analyze fit using ML model
            fit_prediction = await self._analyze_fit(avatar_data, product_data)
            
            logger.info("Fit prediction completed", avatar_id=avatar_id, product_id=product_id)
            return fit_prediction
            
        except Exception as e:
            logger.error("Fit prediction failed", error=str(e), avatar_id=avatar_id, product_id=product_id)
            raise
    
    async def _process_try_on(self, task_id: str):
        """Process virtual try-on task"""
        try:
            task = self.active_tasks[task_id]
            
            # Update progress
            task.progress = 10
            task.updated_at = datetime.utcnow()
            
            # Get avatar data
            avatar_data = await self._get_avatar_data(task.avatar_id, task.user_id)
            if not avatar_data:
                raise ValueError("Avatar not found")
            
            task.progress = 20
            
            # Get product data
            product_data = await self._get_product_data(task.product_id)
            if not product_data:
                raise ValueError("Product not found")
            
            task.progress = 30
            
            # Download product image if needed
            if task.product_url and not product_data.get("image_url"):
                product_image = await self._download_product_image(task.product_url)
                product_data["image_url"] = product_image
            
            task.progress = 40
            
            # Perform virtual try-on using Azure ML
            try_on_result = await self._perform_virtual_tryon(avatar_data, product_data, task.settings)
            
            task.progress = 80
            
            # Upload result to Azure Blob Storage
            result_url = await self._upload_tryon_result(try_on_result, task_id)
            
            task.progress = 100
            task.status = "completed"
            task.result_url = result_url
            task.updated_at = datetime.utcnow()
            
            # Save to database
            await self._save_tryon_result(task)
            
            logger.info("Virtual try-on completed", task_id=task_id, result_url=result_url)
            
        except Exception as e:
            logger.error("Virtual try-on processing failed", error=str(e), task_id=task_id)
            
            if task_id in self.active_tasks:
                task = self.active_tasks[task_id]
                task.status = "failed"
                task.error = str(e)
                task.updated_at = datetime.utcnow()
    
    async def _get_avatar_data(self, avatar_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get avatar data from database"""
        try:
            db = get_database()
            
            # Query avatar data
            query = """
                SELECT id, user_id, body_measurements, avatar_url, created_at
                FROM avatars
                WHERE id = $1 AND user_id = $2
            """
            
            result = await db.fetchrow(query, avatar_id, user_id)
            
            if result:
                return {
                    "id": result["id"],
                    "user_id": result["user_id"],
                    "body_measurements": result["body_measurements"],
                    "avatar_url": result["avatar_url"],
                    "created_at": result["created_at"]
                }
            
            return None
            
        except Exception as e:
            logger.error("Failed to get avatar data", error=str(e), avatar_id=avatar_id)
            return None
    
    async def _get_product_data(self, product_id: str) -> Optional[Dict[str, Any]]:
        """Get product data from database"""
        try:
            db = get_database()
            
            # Query product data
            query = """
                SELECT id, name, description, price, image_url, category, platform, specifications
                FROM products
                WHERE id = $1
            """
            
            result = await db.fetchrow(query, product_id)
            
            if result:
                return {
                    "id": result["id"],
                    "name": result["name"],
                    "description": result["description"],
                    "price": result["price"],
                    "image_url": result["image_url"],
                    "category": result["category"],
                    "platform": result["platform"],
                    "specifications": result["specifications"]
                }
            
            return None
            
        except Exception as e:
            logger.error("Failed to get product data", error=str(e), product_id=product_id)
            return None
    
    async def _download_product_image(self, product_url: str) -> str:
        """Download product image and upload to Azure Blob Storage"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(product_url) as response:
                    if response.status == 200:
                        image_data = await response.read()
                        
                        # Upload to Azure Blob Storage
                        blob_name = f"product-images/{uuid.uuid4()}.jpg"
                        blob_url = await self.azure_client.upload_blob(
                            container_name="product-images",
                            blob_name=blob_name,
                            data=image_data,
                            content_type="image/jpeg"
                        )
                        
                        return blob_url
                    else:
                        raise ValueError(f"Failed to download image: {response.status}")
                        
        except Exception as e:
            logger.error("Failed to download product image", error=str(e), product_url=product_url)
            raise
    
    async def _perform_virtual_tryon(
        self,
        avatar_data: Dict[str, Any],
        product_data: Dict[str, Any],
        settings: Dict[str, Any]
    ) -> bytes:
        """Perform virtual try-on using Azure ML model"""
        try:
            # Prepare input data for ML model
            input_data = {
                "avatar_url": avatar_data["avatar_url"],
                "product_image_url": product_data["image_url"],
                "body_measurements": avatar_data["body_measurements"],
                "product_category": product_data["category"],
                "settings": settings
            }
            
            # Call Azure ML endpoint
            ml_endpoint_url = f"{settings.AZURE_ML_ENDPOINT}/virtual-tryon"
            
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
                        result_data = await response.read()
                        return result_data
                    else:
                        error_text = await response.text()
                        raise ValueError(f"ML model failed: {error_text}")
                        
        except Exception as e:
            logger.error("Virtual try-on ML processing failed", error=str(e))
            raise
    
    async def _analyze_fit(
        self,
        avatar_data: Dict[str, Any],
        product_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze fit using ML model"""
        try:
            # Prepare input data
            input_data = {
                "body_measurements": avatar_data["body_measurements"],
                "product_specifications": product_data.get("specifications", {}),
                "product_category": product_data["category"]
            }
            
            # Call Azure ML endpoint for fit analysis
            ml_endpoint_url = f"{settings.AZURE_ML_ENDPOINT}/fit-analysis"
            
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
                        fit_data = await response.json()
                        return fit_data
                    else:
                        error_text = await response.text()
                        raise ValueError(f"Fit analysis failed: {error_text}")
                        
        except Exception as e:
            logger.error("Fit analysis failed", error=str(e))
            raise
    
    async def _upload_tryon_result(self, result_data: bytes, task_id: str) -> str:
        """Upload try-on result to Azure Blob Storage"""
        try:
            blob_name = f"tryon-results/{task_id}.jpg"
            blob_url = await self.azure_client.upload_blob(
                container_name="tryon-results",
                blob_name=blob_name,
                data=result_data,
                content_type="image/jpeg"
            )
            
            return blob_url
            
        except Exception as e:
            logger.error("Failed to upload try-on result", error=str(e), task_id=task_id)
            raise
    
    async def _save_tryon_result(self, task: TryOnTask):
        """Save try-on result to database"""
        try:
            db = get_database()
            
            # Insert try-on result
            query = """
                INSERT INTO tryon_results (
                    id, user_id, avatar_id, product_id, result_url, settings, status, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """
            
            await db.execute(
                query,
                task.id,
                task.user_id,
                task.avatar_id,
                task.product_id,
                task.result_url,
                json.dumps(task.settings),
                task.status,
                task.created_at,
                task.updated_at
            )
            
            # Clean up active task
            if task.id in self.active_tasks:
                del self.active_tasks[task.id]
                
        except Exception as e:
            logger.error("Failed to save try-on result", error=str(e), task_id=task.id)
            raise
    
    async def get_user_tryon_history(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get user's try-on history"""
        try:
            db = get_database()
            
            query = """
                SELECT tr.id, tr.avatar_id, tr.product_id, tr.result_url, tr.status, tr.created_at,
                       p.name as product_name, p.image_url as product_image, p.platform
                FROM tryon_results tr
                JOIN products p ON tr.product_id = p.id
                WHERE tr.user_id = $1
                ORDER BY tr.created_at DESC
                LIMIT $2
            """
            
            results = await db.fetch(query, user_id, limit)
            
            return [
                {
                    "id": row["id"],
                    "avatar_id": row["avatar_id"],
                    "product_id": row["product_id"],
                    "product_name": row["product_name"],
                    "product_image": row["product_image"],
                    "platform": row["platform"],
                    "result_url": row["result_url"],
                    "status": row["status"],
                    "created_at": row["created_at"].isoformat()
                }
                for row in results
            ]
            
        except Exception as e:
            logger.error("Failed to get try-on history", error=str(e), user_id=user_id)
            return []
    
    async def cleanup_old_tasks(self, days: int = 7):
        """Clean up old completed tasks"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Remove old tasks from memory
            tasks_to_remove = [
                task_id for task_id, task in self.active_tasks.items()
                if task.updated_at < cutoff_date
            ]
            
            for task_id in tasks_to_remove:
                del self.active_tasks[task_id]
            
            logger.info("Cleaned up old tasks", removed_count=len(tasks_to_remove))
            
        except Exception as e:
            logger.error("Failed to cleanup old tasks", error=str(e)) 