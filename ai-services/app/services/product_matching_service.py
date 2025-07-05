"""
Product Matching Service
Handles product matching and aggregation across different e-commerce platforms
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import json
import aiohttp
import structlog
from urllib.parse import urlparse, parse_qs
import re

from app.core.config import settings
from app.utils.azure_client import AzureClient
from app.models.products import ProductMatch, MatchResult
from app.core.database import get_database

logger = structlog.get_logger()

class ProductMatchingService:
    """Service for product matching across platforms"""
    
    def __init__(self):
        self.azure_client = AzureClient.get_instance()
        self.platform_adapters = {
            "amazon": AmazonAdapter(),
            "ebay": EbayAdapter(),
            "walmart": WalmartAdapter(),
            "target": TargetAdapter(),
            "bestbuy": BestBuyAdapter(),
            "newegg": NeweggAdapter()
        }
        self.matching_cache: Dict[str, MatchResult] = {}
        
    async def find_matches(
        self,
        source_url: str,
        target_platforms: List[str],
        criteria: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Find matching products across platforms"""
        try:
            match_id = str(uuid.uuid4())
            
            logger.info("Starting product matching", match_id=match_id, source_url=source_url)
            
            # Extract product information from source URL
            source_product = await self._extract_product_info(source_url)
            if not source_product:
                raise ValueError("Could not extract product information from source URL")
            
            # Find matches on target platforms
            matches = []
            for platform in target_platforms:
                if platform in self.platform_adapters:
                    platform_matches = await self._find_platform_matches(
                        source_product, platform, criteria
                    )
                    matches.extend(platform_matches)
            
            # Sort matches by relevance score
            matches.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
            
            # Store match result
            result = MatchResult(
                id=match_id,
                source_url=source_url,
                source_product=source_product,
                matches=matches,
                target_platforms=target_platforms,
                criteria=criteria or {},
                created_at=datetime.utcnow()
            )
            
            # Cache result
            self.matching_cache[match_id] = result
            
            # Save to database
            await self._save_match_result(result)
            
            logger.info("Product matching completed", match_id=match_id, match_count=len(matches))
            
            return matches
            
        except Exception as e:
            logger.error("Product matching failed", error=str(e), source_url=source_url)
            raise
    
    async def get_match_history(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get user's match history"""
        try:
            db = get_database()
            
            query = """
                SELECT id, source_url, source_product, matches, target_platforms, created_at
                FROM product_matches
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            """
            
            results = await db.fetch(query, user_id, limit)
            
            return [
                {
                    "id": row["id"],
                    "source_url": row["source_url"],
                    "source_product": row["source_product"],
                    "matches": row["matches"],
                    "target_platforms": row["target_platforms"],
                    "created_at": row["created_at"].isoformat()
                }
                for row in results
            ]
            
        except Exception as e:
            logger.error("Failed to get match history", error=str(e), user_id=user_id)
            return []
    
    async def compare_prices(
        self,
        product_id: str,
        platforms: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Compare prices for a product across platforms"""
        try:
            # Get product information
            product = await self._get_product_by_id(product_id)
            if not product:
                raise ValueError("Product not found")
            
            # Get current prices from all platforms
            price_comparison = {}
            target_platforms = platforms or list(self.platform_adapters.keys())
            
            for platform in target_platforms:
                if platform in self.platform_adapters:
                    price_info = await self._get_platform_price(product, platform)
                    if price_info:
                        price_comparison[platform] = price_info
            
            # Find best deals
            prices = [info["price"] for info in price_comparison.values() if info["price"]]
            if prices:
                min_price = min(prices)
                max_price = max(prices)
                avg_price = sum(prices) / len(prices)
                
                best_deals = [
                    platform for platform, info in price_comparison.items()
                    if info["price"] == min_price
                ]
            else:
                min_price = max_price = avg_price = 0
                best_deals = []
            
            return {
                "product": product,
                "price_comparison": price_comparison,
                "statistics": {
                    "min_price": min_price,
                    "max_price": max_price,
                    "avg_price": round(avg_price, 2),
                    "price_range": max_price - min_price if prices else 0,
                    "best_deals": best_deals
                },
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error("Price comparison failed", error=str(e), product_id=product_id)
            raise
    
    async def track_price_history(
        self,
        product_id: str,
        platform: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Track price history for a product on a specific platform"""
        try:
            db = get_database()
            
            query = """
                SELECT price, currency, availability, tracked_at
                FROM price_history
                WHERE product_id = $1 AND platform = $2
                AND tracked_at >= $3
                ORDER BY tracked_at ASC
            """
            
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            results = await db.fetch(query, product_id, platform, cutoff_date)
            
            return [
                {
                    "price": row["price"],
                    "currency": row["currency"],
                    "availability": row["availability"],
                    "tracked_at": row["tracked_at"].isoformat()
                }
                for row in results
            ]
            
        except Exception as e:
            logger.error("Failed to get price history", error=str(e), product_id=product_id, platform=platform)
            return []
    
    async def _extract_product_info(self, url: str) -> Optional[Dict[str, Any]]:
        """Extract product information from URL"""
        try:
            parsed_url = urlparse(url)
            domain = parsed_url.netloc.lower()
            
            # Determine platform and extract product info
            if "amazon" in domain:
                return await self._extract_amazon_product(url)
            elif "ebay" in domain:
                return await self._extract_ebay_product(url)
            elif "walmart" in domain:
                return await self._extract_walmart_product(url)
            elif "target" in domain:
                return await self._extract_target_product(url)
            elif "bestbuy" in domain:
                return await self._extract_bestbuy_product(url)
            elif "newegg" in domain:
                return await self._extract_newegg_product(url)
            else:
                # Generic extraction
                return await self._extract_generic_product(url)
                
        except Exception as e:
            logger.error("Failed to extract product info", error=str(e), url=url)
            return None
    
    async def _extract_amazon_product(self, url: str) -> Dict[str, Any]:
        """Extract product information from Amazon URL"""
        try:
            # Extract ASIN from URL
            asin_match = re.search(r'/dp/([A-Z0-9]{10})', url)
            asin = asin_match.group(1) if asin_match else None
            
            if not asin:
                raise ValueError("Could not extract ASIN from Amazon URL")
            
            # Use Amazon API or web scraping to get product details
            product_info = await self._get_amazon_product_details(asin)
            
            return {
                "platform": "amazon",
                "product_id": asin,
                "name": product_info.get("title", ""),
                "description": product_info.get("description", ""),
                "price": product_info.get("price"),
                "currency": "USD",
                "image_url": product_info.get("image_url", ""),
                "category": product_info.get("category", ""),
                "brand": product_info.get("brand", ""),
                "rating": product_info.get("rating"),
                "review_count": product_info.get("review_count"),
                "availability": product_info.get("availability", "unknown"),
                "url": url
            }
            
        except Exception as e:
            logger.error("Failed to extract Amazon product", error=str(e), url=url)
            raise
    
    async def _extract_ebay_product(self, url: str) -> Dict[str, Any]:
        """Extract product information from eBay URL"""
        try:
            # Extract item ID from URL
            item_match = re.search(r'/itm/(\d+)', url)
            item_id = item_match.group(1) if item_match else None
            
            if not item_id:
                raise ValueError("Could not extract item ID from eBay URL")
            
            # Use eBay API to get product details
            product_info = await self._get_ebay_product_details(item_id)
            
            return {
                "platform": "ebay",
                "product_id": item_id,
                "name": product_info.get("title", ""),
                "description": product_info.get("description", ""),
                "price": product_info.get("price"),
                "currency": "USD",
                "image_url": product_info.get("image_url", ""),
                "category": product_info.get("category", ""),
                "brand": product_info.get("brand", ""),
                "condition": product_info.get("condition", ""),
                "seller_rating": product_info.get("seller_rating"),
                "availability": product_info.get("availability", "unknown"),
                "url": url
            }
            
        except Exception as e:
            logger.error("Failed to extract eBay product", error=str(e), url=url)
            raise
    
    async def _extract_walmart_product(self, url: str) -> Dict[str, Any]:
        """Extract product information from Walmart URL"""
        try:
            # Extract product ID from URL
            product_match = re.search(r'/ip/([^/]+)', url)
            product_id = product_match.group(1) if product_match else None
            
            if not product_id:
                raise ValueError("Could not extract product ID from Walmart URL")
            
            # Use Walmart API to get product details
            product_info = await self._get_walmart_product_details(product_id)
            
            return {
                "platform": "walmart",
                "product_id": product_id,
                "name": product_info.get("name", ""),
                "description": product_info.get("description", ""),
                "price": product_info.get("price"),
                "currency": "USD",
                "image_url": product_info.get("image_url", ""),
                "category": product_info.get("category", ""),
                "brand": product_info.get("brand", ""),
                "rating": product_info.get("rating"),
                "review_count": product_info.get("review_count"),
                "availability": product_info.get("availability", "unknown"),
                "url": url
            }
            
        except Exception as e:
            logger.error("Failed to extract Walmart product", error=str(e), url=url)
            raise
    
    async def _extract_target_product(self, url: str) -> Dict[str, Any]:
        """Extract product information from Target URL"""
        try:
            # Extract product ID from URL
            product_match = re.search(r'/p/([^/]+)', url)
            product_id = product_match.group(1) if product_match else None
            
            if not product_id:
                raise ValueError("Could not extract product ID from Target URL")
            
            # Use Target API to get product details
            product_info = await self._get_target_product_details(product_id)
            
            return {
                "platform": "target",
                "product_id": product_id,
                "name": product_info.get("name", ""),
                "description": product_info.get("description", ""),
                "price": product_info.get("price"),
                "currency": "USD",
                "image_url": product_info.get("image_url", ""),
                "category": product_info.get("category", ""),
                "brand": product_info.get("brand", ""),
                "rating": product_info.get("rating"),
                "review_count": product_info.get("review_count"),
                "availability": product_info.get("availability", "unknown"),
                "url": url
            }
            
        except Exception as e:
            logger.error("Failed to extract Target product", error=str(e), url=url)
            raise
    
    async def _extract_bestbuy_product(self, url: str) -> Dict[str, Any]:
        """Extract product information from Best Buy URL"""
        try:
            # Extract SKU from URL
            sku_match = re.search(r'/p/([^/]+)', url)
            sku = sku_match.group(1) if sku_match else None
            
            if not sku:
                raise ValueError("Could not extract SKU from Best Buy URL")
            
            # Use Best Buy API to get product details
            product_info = await self._get_bestbuy_product_details(sku)
            
            return {
                "platform": "bestbuy",
                "product_id": sku,
                "name": product_info.get("name", ""),
                "description": product_info.get("description", ""),
                "price": product_info.get("price"),
                "currency": "USD",
                "image_url": product_info.get("image_url", ""),
                "category": product_info.get("category", ""),
                "brand": product_info.get("brand", ""),
                "rating": product_info.get("rating"),
                "review_count": product_info.get("review_count"),
                "availability": product_info.get("availability", "unknown"),
                "url": url
            }
            
        except Exception as e:
            logger.error("Failed to extract Best Buy product", error=str(e), url=url)
            raise
    
    async def _extract_newegg_product(self, url: str) -> Dict[str, Any]:
        """Extract product information from Newegg URL"""
        try:
            # Extract product ID from URL
            product_match = re.search(r'/p/([^/]+)', url)
            product_id = product_match.group(1) if product_match else None
            
            if not product_id:
                raise ValueError("Could not extract product ID from Newegg URL")
            
            # Use Newegg API to get product details
            product_info = await self._get_newegg_product_details(product_id)
            
            return {
                "platform": "newegg",
                "product_id": product_id,
                "name": product_info.get("name", ""),
                "description": product_info.get("description", ""),
                "price": product_info.get("price"),
                "currency": "USD",
                "image_url": product_info.get("image_url", ""),
                "category": product_info.get("category", ""),
                "brand": product_info.get("brand", ""),
                "rating": product_info.get("rating"),
                "review_count": product_info.get("review_count"),
                "availability": product_info.get("availability", "unknown"),
                "url": url
            }
            
        except Exception as e:
            logger.error("Failed to extract Newegg product", error=str(e), url=url)
            raise
    
    async def _extract_generic_product(self, url: str) -> Dict[str, Any]:
        """Extract product information from generic URL"""
        try:
            # Basic web scraping for generic sites
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        html = await response.text()
                        
                        # Extract basic information using regex patterns
                        title_match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.IGNORECASE)
                        title = title_match.group(1).strip() if title_match else ""
                        
                        # Try to extract price
                        price_match = re.search(r'\$(\d+(?:\.\d{2})?)', html)
                        price = float(price_match.group(1)) if price_match else None
                        
                        return {
                            "platform": "generic",
                            "product_id": str(uuid.uuid4()),
                            "name": title,
                            "description": "",
                            "price": price,
                            "currency": "USD",
                            "image_url": "",
                            "category": "",
                            "brand": "",
                            "url": url
                        }
                    else:
                        raise ValueError(f"Failed to fetch URL: {response.status}")
                        
        except Exception as e:
            logger.error("Failed to extract generic product", error=str(e), url=url)
            raise
    
    async def _find_platform_matches(
        self,
        source_product: Dict[str, Any],
        platform: str,
        criteria: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Find matches on a specific platform"""
        try:
            adapter = self.platform_adapters.get(platform)
            if not adapter:
                return []
            
            # Search for similar products
            search_results = await adapter.search_products(
                source_product["name"],
                source_product.get("brand", ""),
                source_product.get("category", ""),
                criteria
            )
            
            # Calculate relevance scores
            matches = []
            for result in search_results:
                relevance_score = self._calculate_relevance_score(source_product, result)
                if relevance_score > 0.3:  # Minimum relevance threshold
                    matches.append({
                        **result,
                        "relevance_score": relevance_score,
                        "platform": platform
                    })
            
            return matches
            
        except Exception as e:
            logger.error("Failed to find platform matches", error=str(e), platform=platform)
            return []
    
    def _calculate_relevance_score(
        self,
        source_product: Dict[str, Any],
        target_product: Dict[str, Any]
    ) -> float:
        """Calculate relevance score between two products"""
        try:
            score = 0.0
            
            # Name similarity (40% weight)
            name_similarity = self._calculate_text_similarity(
                source_product["name"], target_product["name"]
            )
            score += name_similarity * 0.4
            
            # Brand similarity (20% weight)
            if source_product.get("brand") and target_product.get("brand"):
                brand_similarity = self._calculate_text_similarity(
                    source_product["brand"], target_product["brand"]
                )
                score += brand_similarity * 0.2
            
            # Category similarity (15% weight)
            if source_product.get("category") and target_product.get("category"):
                category_similarity = self._calculate_text_similarity(
                    source_product["category"], target_product["category"]
                )
                score += category_similarity * 0.15
            
            # Price similarity (15% weight)
            if source_product.get("price") and target_product.get("price"):
                price_diff = abs(source_product["price"] - target_product["price"])
                price_similarity = max(0, 1 - (price_diff / source_product["price"]))
                score += price_similarity * 0.15
            
            # Description similarity (10% weight)
            if source_product.get("description") and target_product.get("description"):
                desc_similarity = self._calculate_text_similarity(
                    source_product["description"], target_product["description"]
                )
                score += desc_similarity * 0.1
            
            return min(1.0, score)
            
        except Exception as e:
            logger.error("Failed to calculate relevance score", error=str(e))
            return 0.0
    
    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate text similarity using basic algorithms"""
        try:
            # Convert to lowercase and split into words
            words1 = set(text1.lower().split())
            words2 = set(text2.lower().split())
            
            if not words1 or not words2:
                return 0.0
            
            # Calculate Jaccard similarity
            intersection = len(words1.intersection(words2))
            union = len(words1.union(words2))
            
            return intersection / union if union > 0 else 0.0
            
        except Exception as e:
            logger.error("Failed to calculate text similarity", error=str(e))
            return 0.0
    
    async def _get_platform_price(
        self,
        product: Dict[str, Any],
        platform: str
    ) -> Optional[Dict[str, Any]]:
        """Get current price for a product on a specific platform"""
        try:
            adapter = self.platform_adapters.get(platform)
            if not adapter:
                return None
            
            price_info = await adapter.get_product_price(product["product_id"])
            return price_info
            
        except Exception as e:
            logger.error("Failed to get platform price", error=str(e), platform=platform)
            return None
    
    async def _get_product_by_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        """Get product information by ID"""
        try:
            db = get_database()
            
            query = """
                SELECT id, name, description, price, image_url, category, brand, platform
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
                    "brand": result["brand"],
                    "platform": result["platform"]
                }
            
            return None
            
        except Exception as e:
            logger.error("Failed to get product by ID", error=str(e), product_id=product_id)
            return None
    
    async def _save_match_result(self, result: MatchResult):
        """Save match result to database"""
        try:
            db = get_database()
            
            query = """
                INSERT INTO product_matches (
                    id, source_url, source_product, matches, target_platforms, criteria, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            """
            
            await db.execute(
                query,
                result.id,
                result.source_url,
                json.dumps(result.source_product),
                json.dumps(result.matches),
                result.target_platforms,
                json.dumps(result.criteria),
                result.created_at
            )
            
        except Exception as e:
            logger.error("Failed to save match result", error=str(e), match_id=result.id)
            raise
    
    # Platform-specific API methods (stubs for now)
    async def _get_amazon_product_details(self, asin: str) -> Dict[str, Any]:
        """Get Amazon product details using API"""
        # Implementation would use Amazon Product Advertising API
        return {}
    
    async def _get_ebay_product_details(self, item_id: str) -> Dict[str, Any]:
        """Get eBay product details using API"""
        # Implementation would use eBay Finding API
        return {}
    
    async def _get_walmart_product_details(self, product_id: str) -> Dict[str, Any]:
        """Get Walmart product details using API"""
        # Implementation would use Walmart API
        return {}
    
    async def _get_target_product_details(self, product_id: str) -> Dict[str, Any]:
        """Get Target product details using API"""
        # Implementation would use Target API
        return {}
    
    async def _get_bestbuy_product_details(self, sku: str) -> Dict[str, Any]:
        """Get Best Buy product details using API"""
        # Implementation would use Best Buy API
        return {}
    
    async def _get_newegg_product_details(self, product_id: str) -> Dict[str, Any]:
        """Get Newegg product details using API"""
        # Implementation would use Newegg API
        return {}


# Platform adapter classes
class AmazonAdapter:
    async def search_products(self, name: str, brand: str, category: str, criteria: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # Implementation for Amazon product search
        return []
    
    async def get_product_price(self, product_id: str) -> Optional[Dict[str, Any]]:
        # Implementation for Amazon price lookup
        return None


class EbayAdapter:
    async def search_products(self, name: str, brand: str, category: str, criteria: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # Implementation for eBay product search
        return []
    
    async def get_product_price(self, product_id: str) -> Optional[Dict[str, Any]]:
        # Implementation for eBay price lookup
        return None


class WalmartAdapter:
    async def search_products(self, name: str, brand: str, category: str, criteria: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # Implementation for Walmart product search
        return []
    
    async def get_product_price(self, product_id: str) -> Optional[Dict[str, Any]]:
        # Implementation for Walmart price lookup
        return None


class TargetAdapter:
    async def search_products(self, name: str, brand: str, category: str, criteria: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # Implementation for Target product search
        return []
    
    async def get_product_price(self, product_id: str) -> Optional[Dict[str, Any]]:
        # Implementation for Target price lookup
        return None


class BestBuyAdapter:
    async def search_products(self, name: str, brand: str, category: str, criteria: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # Implementation for Best Buy product search
        return []
    
    async def get_product_price(self, product_id: str) -> Optional[Dict[str, Any]]:
        # Implementation for Best Buy price lookup
        return None


class NeweggAdapter:
    async def search_products(self, name: str, brand: str, category: str, criteria: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # Implementation for Newegg product search
        return []
    
    async def get_product_price(self, product_id: str) -> Optional[Dict[str, Any]]:
        # Implementation for Newegg price lookup
        return None 