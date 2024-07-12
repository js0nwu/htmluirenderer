import requests

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
            with open('screenshot.png', 'wb') as f:
                f.write(response.content)
            print("Screenshot saved as 'screenshot.png'")
        else:
            print(f"Error: Server responded with status code {response.status_code}")
    except requests.RequestException as e:
        print(f"Error: {e}")
    except FileNotFoundError:
        print("Error: The specified file does not exist.")

# Example usage
post_html_to_server('anothertest.html', 'http://localhost:3000/render')
