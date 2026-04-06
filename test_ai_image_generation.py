#!/usr/bin/env python
"""
Test script for AI image generation
Tests all 3 providers with a sample product
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.menu.ai_image_service import AIImageGenerator


def test_provider(provider_name: str):
    """Test a specific AI provider"""
    print(f"\n{'='*70}")
    print(f"Testing: {provider_name.upper()}")
    print('='*70)

    generator = AIImageGenerator(provider=provider_name)

    # Test product
    product_name = "Vanilla Ice Cream"
    category = "ice cream"

    print(f"\nProduct: {product_name}")
    print(f"Category: {category}")

    # Check API key
    api_key = generator.api_keys.get(provider_name)
    if not api_key:
        print(f"\n⚠️  {provider_name.upper()}_API_KEY not configured")
        print(f"   Set environment variable: {provider_name.upper()}_API_KEY")
        return False

    print(f"\n✓ API Key: {'*' * 20}{api_key[-4:]}")

    # Generate image
    print(f"\n🎨 Generating image...")

    try:
        result = generator.generate_ice_cream_image(
            product_name=product_name,
            category=category,
            size="512x512"  # Smaller for testing
        )

        if result and result.get('success'):
            print(f"\n✓ Generation successful!")
            print(f"   Provider: {result.get('provider')}")
            print(f"   Model: {result.get('model')}")
            print(f"   Prompt: {result.get('prompt')[:80]}...")

            # Check if we have image data
            if result.get('base64'):
                print(f"   Base64 data: {len(result['base64'])} characters")
            if result.get('url'):
                print(f"   URL: {result['url']}")

            # Try to save
            safe_filename = f"test_{provider_name}_vanilla"
            file_path = generator.save_image_to_file(result, safe_filename, media_dir='test_images')

            if file_path:
                print(f"\n✓ Image saved to: {file_path}")
                return True
            else:
                print(f"\n✗ Failed to save image")
                return False
        else:
            error = result.get('error', 'Unknown error') if result else 'No response'
            print(f"\n✗ Generation failed: {error}")
            return False

    except Exception as e:
        print(f"\n✗ Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("="*70)
    print("AI IMAGE GENERATION - TEST SUITE")
    print("="*70)

    print("\nThis script will test AI image generation with all configured providers.")
    print("Make sure you have set the API keys in your environment:\n")
    print("  export TOGETHER_AI_API_KEY=your_key")
    print("  export HUGGINGFACE_API_KEY=your_key")
    print("  export OPENROUTER_API_KEY=your_key")

    providers = ['together', 'huggingface', 'openrouter']
    results = {}

    for provider in providers:
        success = test_provider(provider)
        results[provider] = success

    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    for provider, success in results.items():
        status = "✓ PASSED" if success else "✗ FAILED"
        print(f"  {provider.upper()}: {status}")

    successful = sum(1 for s in results.values() if s)
    print(f"\nTotal: {successful}/{len(providers)} providers working")

    if successful > 0:
        print("\n✓ At least one provider is working! You're ready to generate images.")
        print("\nNext step:")
        print("  python manage.py generate_product_images --dry-run")
    else:
        print("\n⚠️  No providers configured. Please set up API keys.")

    print("\n" + "="*70 + "\n")


if __name__ == '__main__':
    main()
