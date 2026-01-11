#!/usr/bin/env python3
"""
Create OG images from a screenshot URL.
"""

from PIL import Image
import requests
from io import BytesIO
import sys
from pathlib import Path

def create_og_from_url(image_url, output_dir):
    """
    Download image from URL and create OG images.
    """

    print(f"Downloading image from: {image_url}")

    # Download the image
    response = requests.get(image_url)
    response.raise_for_status()

    # Open the image
    screenshot = Image.open(BytesIO(response.content))
    img_width, img_height = screenshot.size

    print(f"Image size: {img_width}x{img_height}")

    # Convert to RGB if necessary
    if screenshot.mode != 'RGB':
        screenshot = screenshot.convert('RGB')

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Calculate aspect ratios
    current_ratio = img_width / img_height
    og_ratio = 1200 / 630  # Facebook/LinkedIn
    twitter_ratio = 1200 / 675  # Twitter

    # Create Facebook/LinkedIn image (1200x630)
    if current_ratio > og_ratio:
        # Image is wider, crop width
        new_width = int(img_height * og_ratio)
        left = (img_width - new_width) // 2
        cropped = screenshot.crop((left, 0, left + new_width, img_height))
    else:
        # Image is taller, crop height
        new_height = int(img_width / og_ratio)
        top = (img_height - new_height) // 2
        cropped = screenshot.crop((0, top, img_width, top + new_height))

    # Resize to exact dimensions
    og_image = cropped.resize((1200, 630), Image.Resampling.LANCZOS)
    og_file = output_path / "og-social-image.png"
    og_image.save(og_file, 'PNG', optimize=True)
    print(f"✓ Generated {og_file.name} ({1200}x{630})")

    # Create Twitter image (1200x675)
    if current_ratio > twitter_ratio:
        new_width = int(img_height * twitter_ratio)
        left = (img_width - new_width) // 2
        cropped = screenshot.crop((left, 0, left + new_width, img_height))
    else:
        new_height = int(img_width / twitter_ratio)
        top = (img_height - new_height) // 2
        cropped = screenshot.crop((0, top, img_width, top + new_height))

    twitter_image = cropped.resize((1200, 675), Image.Resampling.LANCZOS)
    twitter_file = output_path / "twitter-social-image.png"
    twitter_image.save(twitter_file, 'PNG', optimize=True)
    print(f"✓ Generated {twitter_file.name} ({1200}x{675})")

    return [og_file, twitter_file]

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python create_og_from_url.py <image_url> <output_dir>")
        sys.exit(1)

    image_url = sys.argv[1]
    output_dir = sys.argv[2]

    create_og_from_url(image_url, output_dir)
