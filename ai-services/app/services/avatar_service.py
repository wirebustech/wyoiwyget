"""
Avatar Generation Service
Handles AI-powered avatar creation using Azure AI services
"""

import asyncio
import uuid
import time
from typing import Dict, Any, Optional, List
from datetime import datetime
import aiohttp
import structlog
from azure.ai.openai import AsyncOpenAIClient
from azure.core.credentials import AzureKeyCredential
from azure.storage.blob.aio import BlobServiceClient
from azure.storage.blob import ContentSettings

from app.core.config import settings
from app.utils.logging import log_ai_task_start, log_ai_task_complete, log_ai_task_error

logger = structlog.get_logger()


class AvatarService:
    """Service for generating AI-powered avatars"""
    
    def __init__(self):
        self.openai_client = AsyncOpenAIClient(
            endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=AzureKeyCredential(settings.AZURE_OPENAI_API_KEY),
            api_version=settings.AZURE_OPENAI_API_VERSION
        )
        self.blob_service_client = BlobServiceClient.from_connection_string(
            settings.AZURE_STORAGE_CONNECTION_STRING
        )
        self.container_client = self.blob_service_client.get_container_client(
            settings.AZURE_STORAGE_CONTAINER_NAME
        )
        
        # Task storage (in production, use Redis or database)
        self.active_tasks: Dict[str, Dict[str, Any]] = {}
    
    async def start_generation(
        self,
        user_id: str,
        body_measurements: Dict[str, Any],
        face_image_url: Optional[str] = None,
        body_image_url: Optional[str] = None,
        preferences: Optional[Dict[str, Any]] = None
    ) -> str:
        """Start avatar generation process"""
        task_id = str(uuid.uuid4())
        
        task_data = {
            'id': task_id,
            'user_id': user_id,
            'status': 'processing',
            'progress': 0,
            'created_at': datetime.utcnow(),
            'body_measurements': body_measurements,
            'face_image_url': face_image_url,
            'body_image_url': body_image_url,
            'preferences': preferences or {},
            'result': None,
            'error': None,
        }
        
        self.active_tasks[task_id] = task_data
        
        # Start generation in background
        asyncio.create_task(self._generate_avatar(task_id))
        
        log_ai_task_start('avatar_generation', task_id, user_id)
        
        return task_id
    
    async def _generate_avatar(self, task_id: str):
        """Generate avatar in background"""
        task = self.active_tasks[task_id]
        user_id = task['user_id']
        
        try:
            start_time = time.time()
            
            # Step 1: Analyze body measurements and create base avatar (20%)
            await self._update_task_progress(task_id, 20, "Analyzing body measurements...")
            base_avatar_prompt = await self._create_base_avatar_prompt(
                task['body_measurements'],
                task['preferences']
            )
            
            # Step 2: Generate base avatar image (40%)
            await self._update_task_progress(task_id, 40, "Generating base avatar...")
            base_avatar_image = await self._generate_avatar_image(base_avatar_prompt)
            
            # Step 3: Apply face features if provided (60%)
            if task['face_image_url']:
                await self._update_task_progress(task_id, 60, "Applying face features...")
                avatar_with_face = await self._apply_face_features(
                    base_avatar_image,
                    task['face_image_url']
                )
            else:
                avatar_with_face = base_avatar_image
            
            # Step 4: Apply body features if provided (80%)
            if task['body_image_url']:
                await self._update_task_progress(task_id, 80, "Applying body features...")
                final_avatar = await self._apply_body_features(
                    avatar_with_face,
                    task['body_image_url'],
                    task['body_measurements']
                )
            else:
                final_avatar = avatar_with_face
            
            # Step 5: Upload to Azure Storage (90%)
            await self._update_task_progress(task_id, 90, "Saving avatar...")
            avatar_url = await self._upload_avatar(final_avatar, task_id)
            
            # Step 6: Complete (100%)
            await self._update_task_progress(task_id, 100, "Avatar generation complete!")
            
            # Update task with result
            task['status'] = 'completed'
            task['result'] = {
                'avatar_url': avatar_url,
                'generated_at': datetime.utcnow().isoformat(),
                'preferences': task['preferences'],
                'body_measurements': task['body_measurements'],
            }
            
            duration = time.time() - start_time
            log_ai_task_complete('avatar_generation', task_id, user_id, duration)
            
        except Exception as e:
            logger.error("Avatar generation failed", 
                        task_id=task_id, 
                        user_id=user_id, 
                        error=str(e))
            
            task['status'] = 'failed'
            task['error'] = str(e)
            
            log_ai_task_error('avatar_generation', task_id, user_id, e)
    
    async def _create_base_avatar_prompt(
        self,
        body_measurements: Dict[str, Any],
        preferences: Dict[str, Any]
    ) -> str:
        """Create prompt for base avatar generation"""
        
        # Extract measurements
        height = body_measurements.get('height', 170)
        weight = body_measurements.get('weight', 70)
        body_type = body_measurements.get('body_type', 'average')
        gender = body_measurements.get('gender', 'other')
        
        # Extract preferences
        style = preferences.get('style', 'casual')
        hair_style = preferences.get('hairStyle', 'natural')
        skin_tone = preferences.get('skinTone', 'medium')
        eye_color = preferences.get('eyeColor', 'brown')
        hair_color = preferences.get('hairColor', 'brown')
        
        # Calculate BMI for body proportions
        height_m = height / 100
        bmi = weight / (height_m * height_m)
        
        # Determine body proportions based on BMI
        if bmi < 18.5:
            body_description = "slim and slender"
        elif bmi < 25:
            body_description = "average and well-proportioned"
        elif bmi < 30:
            body_description = "athletic and toned"
        else:
            body_description = "full-figured and curvy"
        
        # Create detailed prompt
        prompt = f"""
        Create a realistic, full-body portrait of a {gender} person with the following characteristics:
        
        Body: {body_description}, {height}cm tall, {weight}kg
        Style: {style} clothing, modern and fashionable
        Hair: {hair_style} {hair_color} hair
        Eyes: {eye_color} eyes
        Skin: {skin_tone} skin tone
        
        The person should be standing in a natural pose, facing slightly to the side,
        with good lighting and high-quality details. The image should be suitable
        for virtual try-on applications.
        
        Style: Photorealistic, high resolution, professional photography style,
        neutral background, full body shot, front-facing pose.
        """
        
        return prompt.strip()
    
    async def _generate_avatar_image(self, prompt: str) -> bytes:
        """Generate avatar image using Azure OpenAI DALL-E"""
        try:
            response = await self.openai_client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1024x1024",
                quality="standard",
                n=1,
            )
            
            # Download the generated image
            image_url = response.data[0].url
            async with aiohttp.ClientSession() as session:
                async with session.get(image_url) as resp:
                    if resp.status == 200:
                        return await resp.read()
                    else:
                        raise Exception(f"Failed to download generated image: {resp.status}")
                        
        except Exception as e:
            logger.error("Failed to generate avatar image", error=str(e))
            raise Exception(f"Avatar image generation failed: {str(e)}")
    
    async def _apply_face_features(self, base_image: bytes, face_image_url: str) -> bytes:
        """Apply face features from uploaded image to base avatar"""
        try:
            # Download face image
            async with aiohttp.ClientSession() as session:
                async with session.get(face_image_url) as resp:
                    if resp.status != 200:
                        raise Exception(f"Failed to download face image: {resp.status}")
                    face_image = await resp.read()
            
            # TODO: Implement face swapping/merging using Azure Computer Vision
            # For now, return the base image
            logger.info("Face features application not yet implemented")
            return base_image
            
        except Exception as e:
            logger.error("Failed to apply face features", error=str(e))
            # Return base image if face application fails
            return base_image
    
    async def _apply_body_features(
        self,
        avatar_image: bytes,
        body_image_url: str,
        body_measurements: Dict[str, Any]
    ) -> bytes:
        """Apply body features from uploaded image"""
        try:
            # Download body image
            async with aiohttp.ClientSession() as session:
                async with session.get(body_image_url) as resp:
                    if resp.status != 200:
                        raise Exception(f"Failed to download body image: {resp.status}")
                    body_image = await resp.read()
            
            # TODO: Implement body feature extraction and application
            # For now, return the avatar image
            logger.info("Body features application not yet implemented")
            return avatar_image
            
        except Exception as e:
            logger.error("Failed to apply body features", error=str(e))
            # Return avatar image if body application fails
            return avatar_image
    
    async def _upload_avatar(self, image_data: bytes, task_id: str) -> str:
        """Upload generated avatar to Azure Blob Storage"""
        try:
            blob_name = f"avatars/{task_id}/avatar.png"
            blob_client = self.container_client.get_blob_client(blob_name)
            
            # Upload with proper content settings
            await blob_client.upload_blob(
                image_data,
                overwrite=True,
                content_settings=ContentSettings(
                    content_type="image/png",
                    cache_control="public, max-age=31536000"
                )
            )
            
            # Return the public URL
            return f"{blob_client.url}?sv=2020-08-04&ss=b&srt=sco&sp=rwdlacupitfx&se=2024-12-31T23:59:59Z&st=2024-01-01T00:00:00Z&spr=https&sig=placeholder"
            
        except Exception as e:
            logger.error("Failed to upload avatar", task_id=task_id, error=str(e))
            raise Exception(f"Avatar upload failed: {str(e)}")
    
    async def _update_task_progress(self, task_id: str, progress: int, message: str):
        """Update task progress"""
        if task_id in self.active_tasks:
            self.active_tasks[task_id]['progress'] = progress
            self.active_tasks[task_id]['message'] = message
            logger.info("Avatar generation progress", 
                       task_id=task_id, 
                       progress=progress, 
                       message=message)
    
    async def get_status(self, task_id: str, user_id: str) -> Dict[str, Any]:
        """Get avatar generation status"""
        if task_id not in self.active_tasks:
            raise Exception("Task not found")
        
        task = self.active_tasks[task_id]
        
        # Verify user owns this task
        if task['user_id'] != user_id:
            raise Exception("Not authorized to access this task")
        
        return {
            'task_id': task_id,
            'status': task['status'],
            'progress': task.get('progress', 0),
            'message': task.get('message', ''),
            'created_at': task['created_at'].isoformat(),
            'result': task.get('result'),
            'error': task.get('error'),
        }
    
    async def list_user_avatars(self, user_id: str) -> List[Dict[str, Any]]:
        """List all avatars for a user"""
        user_avatars = []
        
        for task_id, task in self.active_tasks.items():
            if task['user_id'] == user_id and task['status'] == 'completed':
                user_avatars.append({
                    'id': task_id,
                    'avatar_url': task['result']['avatar_url'],
                    'created_at': task['created_at'].isoformat(),
                    'preferences': task['result']['preferences'],
                    'body_measurements': task['result']['body_measurements'],
                })
        
        return sorted(user_avatars, key=lambda x: x['created_at'], reverse=True)
    
    async def delete_avatar(self, task_id: str, user_id: str) -> bool:
        """Delete an avatar"""
        if task_id not in self.active_tasks:
            raise Exception("Avatar not found")
        
        task = self.active_tasks[task_id]
        
        # Verify user owns this avatar
        if task['user_id'] != user_id:
            raise Exception("Not authorized to delete this avatar")
        
        try:
            # Delete from blob storage
            if task['status'] == 'completed' and task['result']:
                blob_name = f"avatars/{task_id}/avatar.png"
                blob_client = self.container_client.get_blob_client(blob_name)
                await blob_client.delete_blob()
            
            # Remove from active tasks
            del self.active_tasks[task_id]
            
            logger.info("Avatar deleted", task_id=task_id, user_id=user_id)
            return True
            
        except Exception as e:
            logger.error("Failed to delete avatar", task_id=task_id, error=str(e))
            raise Exception(f"Avatar deletion failed: {str(e)}")
    
    async def cleanup_old_tasks(self, max_age_hours: int = 24):
        """Clean up old completed/failed tasks"""
        cutoff_time = datetime.utcnow().timestamp() - (max_age_hours * 3600)
        
        tasks_to_remove = []
        for task_id, task in self.active_tasks.items():
            if task['created_at'].timestamp() < cutoff_time:
                tasks_to_remove.append(task_id)
        
        for task_id in tasks_to_remove:
            del self.active_tasks[task_id]
        
        if tasks_to_remove:
            logger.info("Cleaned up old tasks", count=len(tasks_to_remove)) 