import json
from argparse import ArgumentParser
from bs4 import BeautifulSoup
import hashlib

parser = ArgumentParser()

parser.add_argument("--response_json", type=str)

args = parser.parse_args()


def process(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')

    # Find and extract all script tags
    for script_tag in soup.find_all("script"):
        script_tag.decompose()
        
    # Remove all link tags that link to stylesheets
    for link_tag in soup.find_all('link', {'rel': 'stylesheet'}):
        link_tag.decompose()
        
    # Create a new link tags
    new_tailwind_tag1 = soup.new_tag("link", href="http://localhost:8000/tailwind.min.css", rel="stylesheet")
    new_tailwind_tag2 = soup.new_tag("link", href="http://localhost:8000/utils.min.css", rel="stylesheet")
    

    # Find the head tag, or create one if it doesn't exist
    head_tag = soup.head
    if head_tag is None:
        head_tag = soup.new_tag("head")
        soup.html.insert(0, head_tag)

    # Insert the new link tag into the head
    head_tag.append(new_tailwind_tag1)
    head_tag.append(new_tailwind_tag2)
    
    # Find all img tags
    for img_tag in soup.find_all('img'):
        # Get the alt text
        alt_text = img_tag.get('alt', '')

        # Replace src with generated image file
        digest = hashlib.md5(alt_text.lower().encode("utf")).hexdigest()
        imgsrc = "http://localhost:8000/img_assets/" + digest + ".jpg"
        img_tag['src'] = imgsrc

    return soup


try:
    with open(args.response_json, "r") as f:
        d = json.load(f)

    output_text = d['output']['choices'][0]['text']
    
    PREFIX = "```html\n"
    SUFFIX = "</html>"
    
    html_content = output_text.split(PREFIX)[1].split(SUFFIX)[0] + SUFFIX
    html_content = process(html_content)
    html_content = html_content.prettify()

    result = html_content
except:
    result = ""
    
print(result)

