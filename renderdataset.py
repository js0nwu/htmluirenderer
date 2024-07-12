import requests
import glob
from tqdm import tqdm
import os

def post_html_to_server(file_path, url):
    """
    Reads HTML content from a file and posts it to the specified URL.

    :param file_path: Path to the HTML file.
    :param url: URL of the server endpoint.
    """
    try:
        with open(file_path, 'r') as file:
            html_content = file.read()

        response = requests.post(url, json={'html': html_content})

        if response.status_code == 200:
            # Assuming the response is an image, write it to a file
            with open(file_path + ".jpg", 'wb') as f:
                f.write(response.content)
        else:
            print(f"Error: Server responded with status code {response.status_code}")
    except requests.RequestException as e:
        print(f"Error: {e}")
    except FileNotFoundError:
        print("Error: The specified file does not exist.")

        

json_files = glob.glob("/storage/together_api_runner_output_2024-01-14/*/*.json")
for json_file in tqdm(json_files):
    output_html = json_file + ".html"
    if os.path.exists(output_html + ".jpg"):
        continue
    os.system(f"python together_api_html_extractor.py --response_json {json_file} > {output_html}")
    # Example usage
    post_html_to_server(output_html, 'http://localhost:3000/render')
