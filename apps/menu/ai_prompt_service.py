"""
AI Prompt Generation Service
Uses cheap/free Hugging Face text models to generate optimized image prompts
Input: Simple keywords like "vanilla ice cream cup"
Output: Professional image generation prompt
"""
import requests
import os
from typing import Optional, Dict, Any


class AIPromptGenerator:
    """
    Generate optimized image prompts using small text models
    Much cheaper than using large models
    """

    def __init__(self, model: str = 'microsoft/Phi-3-mini-4k-instruct'):
        """
        Initialize Prompt Generator

        Args:
            model: Hugging Face model for text generation
                   Options:
                   - 'microsoft/Phi-3-mini-4k-instruct' (3.8B, fast, FREE)
                   - 'mistralai/Mistral-7B-Instruct-v0.2' (7B, good quality)
                   - 'google/flan-t5-large' (780M, very fast)
        """
        self.model = model
        self.api_key = os.getenv('HUGGINGFACE_API_KEY', '')
        self.api_url = f"https://api-inference.huggingface.co/models/{model}"

    def generate_prompt(
        self,
        product_name: str,
        category: str = 'ice cream',
        style: str = 'professional product photography'
    ) -> Optional[str]:
        """
        Generate optimized prompt for image generation

        Args:
            product_name: Simple description (e.g., "vanilla ice cream cup")
            category: Product category (ice cream, shake, cone, candy)
            style: Desired style

        Returns:
            Optimized prompt string or None if failed
        """

        # Create instruction for the AI
        instruction = self._create_instruction(product_name, category, style)

        # Generate prompt using text model
        result = self._call_text_model(instruction)

        if result and result.get('success'):
            return result.get('prompt')

        # Fallback to template-based prompt
        return self._fallback_prompt(product_name, category, style)

    def _create_instruction(self, product_name: str, category: str, style: str) -> str:
        """Create instruction for text model"""

        category_context = {
            'ice cream': 'ice cream in a premium glass bowl or cup',
            'shake': 'thick shake in a tall glass with whipped cream',
            'cone': 'ice cream cone with waffle cone',
            'candy': 'ice cream candy bar or popsicle',
            'cassata': 'cassata ice cream slice with layers',
        }

        context = category_context.get(category.lower(), 'ice cream dessert')

        # Simple instruction that works well with small models
        instruction = f"""Create a detailed image generation prompt for professional food photography.

Product: {product_name}
Type: {context}
Style: {style}

Requirements:
- Professional food photography
- Studio lighting
- White background
- Commercial quality
- High resolution (4k)
- Appetizing and vibrant colors
- Clean and minimal composition

Generate only the image prompt (no explanations):"""

        return instruction

    def _call_text_model(self, instruction: str) -> Dict[str, Any]:
        """Call Hugging Face text generation API"""

        if not self.api_key:
            return {'success': False, 'error': 'API key not configured'}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Use simple generation parameters for fast results
        payload = {
            "inputs": instruction,
            "parameters": {
                "max_new_tokens": 150,  # Short prompt
                "temperature": 0.7,
                "top_p": 0.9,
                "do_sample": True,
                "return_full_text": False
            }
        }

        try:
            response = requests.post(
                self.api_url,
                json=payload,
                headers=headers,
                timeout=30
            )

            # Check if model is loading
            if response.status_code == 503:
                # Model loading - use fallback
                return {'success': False, 'error': 'Model loading'}

            response.raise_for_status()
            data = response.json()

            # Extract generated text
            if isinstance(data, list) and len(data) > 0:
                generated_text = data[0].get('generated_text', '').strip()

                # Clean up the prompt
                prompt = self._clean_prompt(generated_text)

                return {
                    'success': True,
                    'prompt': prompt,
                    'model': self.model
                }

            return {'success': False, 'error': 'No output'}

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _clean_prompt(self, text: str) -> str:
        """Clean and format the generated prompt"""

        # Remove common unwanted prefixes/suffixes
        unwanted = [
            'Here is the image prompt:',
            'Image prompt:',
            'Prompt:',
            'Sure!',
            'Here you go:',
        ]

        for phrase in unwanted:
            text = text.replace(phrase, '')

        # Remove extra whitespace
        text = ' '.join(text.split())

        # Ensure it's not too long
        if len(text) > 500:
            text = text[:497] + '...'

        return text.strip()

    def _fallback_prompt(self, product_name: str, category: str, style: str) -> str:
        """
        Fallback to template-based prompt if AI generation fails
        This is the same as the original prompt generation
        """

        category_prompts = {
            'ice cream': f"Professional food photography of {product_name}, creamy texture, vibrant colors, served in a premium glass bowl, studio lighting, white background, appetizing, commercial product shot, high resolution, 4k quality",
            'shake': f"Professional beverage photography of {product_name} thick shake with ice cream, tall glass, whipped cream topping, colorful, garnished, studio lighting, white background, commercial product shot, 4k quality",
            'cone': f"Professional food photography of {product_name} ice cream cone, waffle cone, perfectly shaped scoops, colorful, studio lighting, white background, commercial product shot, 4k quality",
            'candy': f"Professional product photography of {product_name} ice cream candy bar, frozen treat, colorful packaging, studio lighting, white background, commercial shot, 4k quality",
            'cassata': f"Professional food photography of {product_name} cassata ice cream slice, layered, colorful, elegant presentation, studio lighting, white background, 4k quality",
        }

        return category_prompts.get(
            category.lower(),
            f"Professional food photography of {product_name}, high quality, studio lighting, white background, 4k"
        )

    def generate_batch_prompts(self, products: list) -> Dict[str, str]:
        """
        Generate prompts for multiple products efficiently

        Args:
            products: List of dicts with 'name' and 'category'

        Returns:
            Dict mapping product names to prompts
        """

        results = {}

        for product in products:
            name = product.get('name', '')
            category = product.get('category', 'ice cream')

            prompt = self.generate_prompt(name, category)
            results[name] = prompt

        return results


# Convenience function
def generate_image_prompt(product_name: str, category: str = 'ice cream', use_ai: bool = True) -> str:
    """
    Generate optimized image prompt from simple product name

    Args:
        product_name: Simple description like "vanilla ice cream"
        category: Product category
        use_ai: Whether to use AI or fallback to templates

    Returns:
        Optimized prompt string

    Usage:
        prompt = generate_image_prompt("vanilla ice cream cup")
        # Returns: "Professional food photography of vanilla ice cream cup,
        #           creamy texture, vibrant colors, served in premium glass
        #           bowl, studio lighting, white background, appetizing,
        #           commercial product shot, high resolution, 4k quality"
    """

    if use_ai:
        generator = AIPromptGenerator()
        prompt = generator.generate_prompt(product_name, category)
        return prompt or generator._fallback_prompt(product_name, category, 'professional')
    else:
        generator = AIPromptGenerator()
        return generator._fallback_prompt(product_name, category, 'professional')


# Example usage
if __name__ == '__main__':
    # Test prompt generation
    generator = AIPromptGenerator()

    test_products = [
        ('vanilla ice cream cup', 'ice cream'),
        ('chocolate thick shake', 'shake'),
        ('strawberry cone', 'cone'),
    ]

    for product, category in test_products:
        print(f"\nInput: {product}")
        prompt = generator.generate_prompt(product, category)
        print(f"Generated Prompt: {prompt}")
        print("-" * 80)
