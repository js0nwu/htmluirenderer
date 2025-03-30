import requests
import glob
from tqdm import tqdm
import os
import time
from argparse import ArgumentParser

def post_html_to_server(file_path, url, skip_existing=True):
    """
    Reads HTML content from a file and posts it to the specified URL.
    Retries up to 3 times with a 3-second wait between attempts if not successful.

    :param file_path: Path to the HTML file.
    :param url: URL of the server endpoint.
    """
    if skip_existing and os.path.exists(file_path + ".jpg"):
        return
    try:
        with open(file_path, 'r') as file:
            html_content = file.read()
    except FileNotFoundError:
        print("Error: The specified file does not exist.")
        return

    for attempt in range(1, 4):
        try:
            response = requests.post(url, json={'html': html_content})
            if response.status_code == 200:
                # Assuming the response is an image, write it to a file
                with open(file_path + ".jpg", 'wb') as f:
                    f.write(response.content)
                print(f"Success on attempt {attempt}")
                return
            else:
                print(f"Error: Server responded with status code {response.status_code} on attempt {attempt}")
        except requests.RequestException as e:
            print(f"Error: {e} on attempt {attempt}")

        if attempt < 3:
            print("Retrying in 3 seconds...")
            time.sleep(3)
            
    print("Failed to get a successful response after 3 attempts.")

parser = ArgumentParser()
parser.add_argument("--input_file", type=str)
parser.add_argument("--render_server", type=str, default="http://localhost:3000/render")

args = parser.parse_args()
post_html_to_server(args.input_file, args.render_server)
