"""
AI Image Generation Service for Ice Cream Products
Supports multiple providers: Together AI, Hugging Face, OpenRouter, Google Gemini
With Cost Tracking: ₹1.15 per image
"""
import requests
import base64
import os
from django.conf import settings
from typing import Optional, Dict, Any
import time
from decimal import Decimal
from datetime import datetime


class AIImageGenerator:
    """
    Generate product images using AI models
    Supports: Together AI (FLUX), Hugging Face (Stable Diffusion), OpenRouter, Google Gemini (Imagen 3)
    """

    def __init__(self, provider: str = 'huggingface', cost_per_image: Decimal = Decimal('1.15'), track_costs: bool = True, use_ai_prompts: bool = True):
        """
        Initialize AI Image Generator

        Args:
            provider: 'huggingface', 'together', 'openrouter', or 'gemini' (default: huggingface)
            cost_per_image: Cost per image in INR (default: ₹1.15)
            track_costs: Whether to track costs in database
            use_ai_prompts: Use AI to generate optimized prompts (default: True)
        """
        self.provider = provider
        self.cost_per_image = cost_per_image
        self.track_costs = track_costs
        self.use_ai_prompts = use_ai_prompts
        self.api_keys = {
            'together': os.getenv('TOGETHER_AI_API_KEY', ''),
            'huggingface': os.getenv('HUGGINGFACE_API_KEY', ''),
            'openrouter': os.getenv('OPENROUTER_API_KEY', ''),
            'gemini': os.getenv('GOOGLE_GEMINI_API_KEY', '')
        }

    def generate_ice_cream_image(
        self,
        product_name: str,
        category: str = 'ice cream',
        style: str = 'professional product photography',
        size: str = '1024x1024'
    ) -> Optional[Dict[str, Any]]:
        """
        Generate product image for ice cream items

        Args:
            product_name: Name of the product (e.g., "Vanilla Ice Cream")
            category: Product category (ice cream, shake, cone, candy)
            style: Image style/quality
            size: Image dimensions

        Returns:
            Dict with 'url' or 'base64' image data, or None if failed
        """

        # Craft the prompt
        prompt = self._create_prompt(product_name, category, style)

        # Generate based on provider
        if self.provider == 'together':
            return self._generate_together_ai(prompt, size)
        elif self.provider == 'huggingface':
            return self._generate_huggingface(prompt, size)
        elif self.provider == 'openrouter':
            return self._generate_openrouter(prompt, size)
        elif self.provider == 'gemini':
            return self._generate_gemini(prompt, size)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

    def _create_prompt(self, product_name: str, category: str, style: str) -> str:
        """
        Create optimized prompt for ice cream product images
        Uses AI prompt generator if enabled, otherwise falls back to templates
        """

        if self.use_ai_prompts:
            try:
                from apps.menu.ai_prompt_service import generate_image_prompt

                # Use AI to generate optimized prompt
                ai_prompt = generate_image_prompt(product_name, category, use_ai=True)
                if ai_prompt:
                    return ai_prompt
            except Exception as e:
                print(f"AI prompt generation failed, using template: {e}")

        # Fallback to template-based prompts
        category_prompts = {
            'ice cream': f"Professional food photography of {product_name} ice cream, creamy texture, vibrant colors, served in a premium glass bowl, studio lighting, white background, appetizing, commercial product shot, high resolution, 4k quality",
            'shake': f"Professional beverage photography of {product_name} thick shake with ice cream, tall glass, whipped cream topping, colorful, garnished, studio lighting, white background, commercial product shot, 4k quality",
            'cone': f"Professional food photography of {product_name} ice cream cone, waffle cone, perfectly shaped scoops, colorful, studio lighting, white background, commercial product shot, 4k quality",
            'candy': f"Professional product photography of {product_name} ice cream candy bar, frozen treat, colorful packaging, studio lighting, white background, commercial shot, 4k quality",
            'cassata': f"Professional food photography of {product_name} cassata ice cream slice, layered, colorful, elegant presentation, studio lighting, white background, 4k quality",
        }

        return category_prompts.get(category.lower(),
            f"Professional food photography of {product_name}, high quality, studio lighting, white background, 4k")

    def _generate_together_ai(self, prompt: str, size: str) -> Optional[Dict[str, Any]]:
        """
        Generate image using Together AI (FLUX.1 Schnell - FREE for 3 months)
        Docs: https://docs.together.ai/reference/images-1
        """
        api_key = self.api_keys['together']
        if not api_key:
            return {'error': 'Together AI API key not configured', 'success': False}

        url = "https://api.together.xyz/v1/images/generations"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        # Parse size
        width, height = map(int, size.split('x'))

        payload = {
            "model": "black-forest-labs/FLUX.1-schnell-Free",  # Free unlimited model
            "prompt": prompt,
            "width": width,
            "height": height,
            "steps": 4,  # Schnell is optimized for 4 steps
            "n": 1,
            "response_format": "b64_json"  # or "url"
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()

            if 'data' in data and len(data['data']) > 0:
                image_data = data['data'][0]

                return {
                    'success': True,
                    'base64': image_data.get('b64_json'),
                    'url': image_data.get('url'),
                    'provider': 'together_ai',
                    'model': 'FLUX.1-schnell',
                    'prompt': prompt
                }
            else:
                return {'error': 'No image generated', 'success': False}

        except requests.exceptions.RequestException as e:
            return {'error': str(e), 'success': False}

    def _generate_huggingface(self, prompt: str, size: str) -> Optional[Dict[str, Any]]:
        """
        Generate image using Hugging Face Inference API
        Models: Stable Diffusion XL, FLUX
        Docs: https://huggingface.co/docs/api-inference/
        """
        api_key = self.api_keys['huggingface']
        if not api_key:
            return {'error': 'Hugging Face API key not configured', 'success': False}

        # Use available Hugging Face models
        # Trying Dreamlike Photoreal 2.0 (optimized for product photography)
        model = "dreamlike-art/dreamlike-photoreal-2.0"

        url = f"https://api-inference.huggingface.co/models/{model}"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "inputs": prompt,
            "parameters": {
                "num_inference_steps": 30,  # SD 1.5 works well with 30 steps
                "guidance_scale": 7.5,      # Better prompt adherence
            }
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=120)

            # Check if model is loading
            if response.status_code == 503:
                estimated_time = response.json().get('estimated_time', 20)
                return {
                    'error': f'Model loading, retry in {estimated_time}s',
                    'success': False,
                    'retry_after': estimated_time
                }

            response.raise_for_status()

            # Response is binary image data
            image_bytes = response.content
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')

            return {
                'success': True,
                'base64': image_base64,
                'provider': 'huggingface',
                'model': model,
                'prompt': prompt
            }

        except requests.exceptions.RequestException as e:
            return {'error': str(e), 'success': False}

    def _generate_openrouter(self, prompt: str, size: str) -> Optional[Dict[str, Any]]:
        """
        Generate image using OpenRouter
        Supports multiple image models
        Docs: https://openrouter.ai/docs/image-generation
        """
        api_key = self.api_keys['openrouter']
        if not api_key:
            return {'error': 'OpenRouter API key not configured', 'success': False}

        url = "https://openrouter.ai/api/v1/images/generations"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://atul-icecream-pos.com",  # Your site URL
            "X-Title": "Atul Ice Cream POS"
        }

        # Parse size
        width, height = map(int, size.split('x'))

        payload = {
            "model": "bytedance/seedream-4.5",  # $0.04 per image (cheapest)
            # Alternatives: "sourceful/riverflow-v2" ($0.15)
            "prompt": prompt,
            "size": f"{width}x{height}",
            "n": 1
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()

            if 'data' in data and len(data['data']) > 0:
                image_url = data['data'][0].get('url')

                return {
                    'success': True,
                    'url': image_url,
                    'provider': 'openrouter',
                    'model': 'seedream-4.5',
                    'prompt': prompt,
                    'cost': 0.04  # USD per image
                }
            else:
                return {'error': 'No image generated', 'success': False}

        except requests.exceptions.RequestException as e:
            return {'error': str(e), 'success': False}

    def _generate_gemini(self, prompt: str, size: str) -> Optional[Dict[str, Any]]:
        """
        Generate image using Google Gemini Imagen 3
        Docs: https://ai.google.dev/gemini-api/docs/imagen
        """
        api_key = self.api_keys['gemini']
        if not api_key:
            return {'error': 'Google Gemini API key not configured', 'success': False}

        # Gemini Imagen 3 endpoint
        url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key={api_key}"

        headers = {
            "Content-Type": "application/json"
        }

        # Parse size - Gemini supports specific sizes
        # Supported: 256x256, 512x512, 1024x1024, 1024x768, 768x1024
        if size not in ['256x256', '512x512', '1024x1024', '1024x768', '768x1024']:
            size = '1024x1024'  # Default to square

        payload = {
            "instances": [
                {
                    "prompt": prompt
                }
            ],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": "1:1" if size == "1024x1024" else "4:3",
                "negativePrompt": "blurry, low quality, distorted, ugly, bad composition",
                "safetyFilterLevel": "block_some",
                "personGeneration": "allow_adult"
            }
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            response.raise_for_status()

            data = response.json()

            # Gemini returns base64 encoded images
            if 'predictions' in data and len(data['predictions']) > 0:
                prediction = data['predictions'][0]

                # Extract base64 image data
                if 'bytesBase64Encoded' in prediction:
                    image_base64 = prediction['bytesBase64Encoded']
                elif 'mimeType' in prediction and 'bytesBase64Encoded' in prediction:
                    image_base64 = prediction['bytesBase64Encoded']
                else:
                    return {'error': 'No image data in response', 'success': False}

                return {
                    'success': True,
                    'base64': image_base64,
                    'provider': 'gemini',
                    'model': 'imagen-3.0',
                    'prompt': prompt
                }
            else:
                return {'error': 'No image generated', 'success': False}

        except requests.exceptions.RequestException as e:
            error_msg = str(e)

            # Parse error response for better debugging
            try:
                if hasattr(e, 'response') and e.response is not None:
                    error_data = e.response.json()
                    if 'error' in error_data:
                        error_msg = error_data['error'].get('message', str(e))
            except:
                pass

            return {'error': error_msg, 'success': False}

    def save_image_to_file(self, image_data: Dict[str, Any], filename: str, media_dir: str = 'product_images') -> Optional[str]:
        """
        Save generated image to Django media directory

        Args:
            image_data: Response from generate_ice_cream_image()
            filename: Output filename (without extension)
            media_dir: Subdirectory in MEDIA_ROOT

        Returns:
            Relative path to saved image, or None if failed
        """
        if not image_data.get('success'):
            return None

        from django.core.files.base import ContentFile
        from django.core.files.storage import default_storage
        import os

        # Get base64 data
        base64_data = image_data.get('base64')
        url = image_data.get('url')

        if base64_data:
            # Decode base64
            image_bytes = base64.b64decode(base64_data)
        elif url:
            # Download from URL
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            image_bytes = response.content
        else:
            return None

        # Save to media directory
        file_path = os.path.join(media_dir, f"{filename}.png")
        path = default_storage.save(file_path, ContentFile(image_bytes))

        return path

    def track_generation_cost(self, product_id: str, image_data: Dict[str, Any], generation_time: float = None) -> Optional[Any]:
        """
        Track cost of image generation in database

        Args:
            product_id: UUID of the product
            image_data: Result from generate_ice_cream_image()
            generation_time: Time taken in seconds

        Returns:
            AIImageGenerationCost instance or None
        """
        if not self.track_costs:
            return None

        try:
            from apps.menu.models_ai_cost import AIImageGenerationCost, AIImageGenerationBudget
            from apps.menu.models import Product

            # Get product
            try:
                product = Product.objects.get(id=product_id)
            except Product.DoesNotExist:
                product = None

            # Determine status
            status = 'success' if image_data.get('success') else 'failed'

            # Create cost record
            cost_record = AIImageGenerationCost.objects.create(
                product=product,
                provider=self.provider,
                model_name=image_data.get('model', 'unknown'),
                prompt=image_data.get('prompt', ''),
                image_url=image_data.get('url', ''),
                image_path=image_data.get('file_path', ''),
                image_size=image_data.get('size', '1024x1024'),
                status=status,
                error_message=image_data.get('error', ''),
                cost_per_image=self.cost_per_image,
                total_cost=self.cost_per_image if status == 'success' else Decimal('0.00'),
                generation_time_seconds=Decimal(str(generation_time)) if generation_time else None,
                request_metadata='{}',
            )

            # Update monthly budget if successful
            if status == 'success':
                budget = AIImageGenerationBudget.get_or_create_current_month()
                budget.update_usage(self.cost_per_image)

            return cost_record

        except Exception as e:
            print(f"Warning: Failed to track cost: {e}")
            return None


# Example usage functions
def generate_product_image(product_name: str, category: str, provider: str = 'huggingface') -> Dict[str, Any]:
    """
    Convenient wrapper to generate and save product image

    Usage:
        result = generate_product_image("Vanilla Ice Cream", "ice cream")
        if result['success']:
            print(f"Image saved to: {result['file_path']}")
    """
    generator = AIImageGenerator(provider=provider)

    # Generate image
    image_data = generator.generate_ice_cream_image(product_name, category)

    if not image_data or not image_data.get('success'):
        return image_data

    # Save to file
    safe_filename = product_name.lower().replace(' ', '_').replace('(', '').replace(')', '')
    file_path = generator.save_image_to_file(image_data, safe_filename)

    if file_path:
        image_data['file_path'] = file_path

    return image_data
