#!/usr/bin/env python3
"""
Generate embeddings for all blog posts using OpenAI's API.
Run this script locally whenever you want to update the embeddings.

Only posts that are new or whose text has changed are sent to the API;
everything else reuses the embedding already in blog_embeddings.json.
Pass --all to force a full re-embed.

Usage:
    export OPENAI_API_KEY="your-key-here"
    python generate_embeddings.py
"""

import os
import sys
import json
import re
import hashlib
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
    force_all = '--all' in sys.argv

    # Navigate to parent directory to access _posts
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    posts_dir = project_root / '_posts'
    output_file = script_dir / 'blog_embeddings.json'

    # Reuse embeddings from a previous run when the post text is unchanged
    cache = {}
    if output_file.exists() and not force_all:
        try:
            with open(output_file, encoding='utf-8') as f:
                for entry in json.load(f):
                    if entry.get('url'):
                        cache[entry['url']] = entry
        except (json.JSONDecodeError, OSError) as e:
            print(f"Could not read existing embeddings ({e}); re-embedding everything")

    embeddings_data = []
    reused = embedded = 0

    # Get all markdown files
    post_files = sorted(posts_dir.glob('*.md'))

    print(f"Found {len(post_files)} blog posts")

    for i, post_file in enumerate(post_files, 1):
        metadata, content = extract_front_matter_and_content(post_file)

        if not metadata:
            print(f"  Skipping {post_file.name} - no front matter")
            continue

        if metadata.get('published', 'true').lower() == 'false':
            print(f"  Skipping {post_file.name} - unpublished")
            continue

        # Clean content for embedding
        clean_text = clean_content(content)

        # Combine title and content for embedding
        embedding_text = f"{metadata.get('tab_title') or metadata.get('title', '')}\n\n{clean_text[:2000]}"  # Limit length
        text_hash = hashlib.sha256(embedding_text.encode('utf-8')).hexdigest()

        # Create URL from filename
        date_match = re.match(r'(\d{4}-\d{2}-\d{2})-(.+)\.md', post_file.name)
        if date_match:
            slug = date_match.group(2)
            url = f"/blog/{slug}/"
        else:
            url = f"/blog/{post_file.stem}/"

        # tab_title is the plain-text variant used when the title contains math
        display_title = metadata.get('tab_title') or metadata.get('title', '')

        entry = {
            'title': display_title,
            'date': metadata.get('date', ''),
            'category': metadata.get('category', ''),
            'emoji': metadata.get('emoji', ''),
            'url': url,
            'text_hash': text_hash,
        }

        cached = cache.get(url)
        if cached and cached.get('text_hash') == text_hash and cached.get('embedding'):
            entry['embedding'] = cached['embedding']
            embeddings_data.append(entry)
            reused += 1
            continue

        print(f"Embedding {i}/{len(post_files)}: {post_file.name}")
        try:
            entry['embedding'] = get_embedding(embedding_text)
            embeddings_data.append(entry)
            embedded += 1
        except Exception as e:
            print(f"  Error generating embedding: {e}")
            if cached and cached.get('embedding'):
                print("  Keeping the previous embedding for this post")
                entry['embedding'] = cached['embedding']
                embeddings_data.append(entry)
                reused += 1
            continue

    # Save to JSON in the blogpost_embs directory
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(embeddings_data, f, indent=2)

    print(f"\nDone! {len(embeddings_data)} posts in the file "
          f"({embedded} newly embedded, {reused} reused)")
    print(f"Saved to {output_file}")
    print(f"Estimated cost this run: ~${embedded * 0.00002:.4f} (very rough estimate)")


if __name__ == '__main__':
    main()
