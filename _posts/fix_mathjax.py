import re
import sys

def escape_underscores_in_single_dollar(text):
    """
    Escapes underscores ONLY inside single-dollar math environments: $ ... $.
    Skips $$ ... $$ display math completely.
    """

    # Regex to match exactly one dollar sign on each side (no second $ before/after).
    pattern = re.compile(r'(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)', re.DOTALL)

    def replace_underscores(match):
        content = match.group(1)
        # Escape underscores that are not already escaped
        escaped_content = re.sub(r'(?<!\\)_', r'\_', content)
        return f'${escaped_content}$'

    return pattern.sub(replace_underscores, text)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python escape_underscores_in_single_dollar.py <filename>")
        sys.exit(1)

    filename = sys.argv[1]

    with open(filename, 'r', encoding='utf-8') as f:
        original = f.read()

    updated = escape_underscores_in_single_dollar(original)

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(updated)

    print(f"Escaped underscores only in single-$ math for: {filename}")
