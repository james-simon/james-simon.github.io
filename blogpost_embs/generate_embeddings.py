#!/usr/bin/env python3
"""
Generate embeddings for all blog posts using OpenAI's API.
Run this script locally whenever you want to update the embeddings.

Usage:
    export OPENAI_API_KEY="your-key-here"
    python generate_embeddings.py
"""

import os
import json
import re
from pathlib import Path
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def extract_front_matter_and_content(file_path):
    """Extract YAML front matter and markdown content from a post."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split front matter and content
    parts = content.split('---', 2)
    if len(parts) < 3:
        return None, content

    front_matter = parts[1].strip()
    markdown_content = parts[2].strip()

    # Parse front matter
    metadata = {}
    for line in front_matter.split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            metadata[key.strip()] = value.strip().strip('"').strip("'")

    return metadata, markdown_content

def clean_content(content):
    """Clean markdown content for embedding."""
    # Remove code blocks
    content = re.sub(r'```[\s\S]*?```', '', content)
    content = re.sub(r'`[^`]+`', '', content)

    # Remove images and links (keep link text)
    content = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', r'\1', content)
    content = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', content)

    # Remove HTML tags
    content = re.sub(r'<[^>]+>', '', content)

    # Remove math (LaTeX)
    content = re.sub(r'\$\$[\s\S]*?\$\$', '', content)
    content = re.sub(r'\$[^\$]+\$', '', content)

    # Clean up whitespace
    content = re.sub(r'\n\s*\n', '\n\n', content)
    content = content.strip()

    return content

def get_embedding(text, model="text-embedding-3-small"):
    """Get embedding from OpenAI API."""
    text = text.replace("\n", " ")
    response = client.embeddings.create(input=[text], model=model)
    return response.data[0].embedding

def main():
    # Navigate to parent directory to access _posts
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    posts_dir = project_root / '_posts'
    embeddings_data = []

    # Get all markdown files
    post_files = sorted(posts_dir.glob('*.md'))

    print(f"Found {len(post_files)} blog posts")
    print("Generating embeddings...")

    for i, post_file in enumerate(post_files, 1):
        print(f"Processing {i}/{len(post_files)}: {post_file.name}")

        metadata, content = extract_front_matter_and_content(post_file)

        if not metadata:
            print(f"  Skipping {post_file.name} - no front matter")
            continue

        # Clean content for embedding
        clean_text = clean_content(content)

        # Combine title and content for embedding
        embedding_text = f"{metadata.get('title', '')}\n\n{clean_text[:2000]}"  # Limit length

        # Get embedding
        try:
            embedding = get_embedding(embedding_text)

            # Create URL from filename
            date_match = re.match(r'(\d{4}-\d{2}-\d{2})-(.+)\.md', post_file.name)
            if date_match:
                slug = date_match.group(2)
                url = f"/blog/{slug}/"
            else:
                url = f"/blog/{post_file.stem}/"

            embeddings_data.append({
                'title': metadata.get('title', ''),
                'date': metadata.get('date', ''),
                'category': metadata.get('category', ''),
                'emoji': metadata.get('emoji', ''),
                'url': url,
                'embedding': embedding
            })

        except Exception as e:
            print(f"  Error generating embedding: {e}")
            continue

    # Save to JSON in the blogpost_embs directory
    output_file = script_dir / 'blog_embeddings.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(embeddings_data, f, indent=2)

    print(f"\nDone! Generated embeddings for {len(embeddings_data)} posts")
    print(f"Saved to {output_file}")
    print(f"\nEstimated cost: ~${len(embeddings_data) * 0.00002:.4f} (very rough estimate)")

if __name__ == '__main__':
    main()
