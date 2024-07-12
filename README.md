# htmluirenderer

The purpose of this code is to easily render HTML code to a screenshot.

You need to run npm install to install dependencies. Then run the renderserver.js file
When the server is running, use testclient.py to send some HTML code to the server, which will render a screenshot.

Sometimes HTML code will contain image assets which are needed for rendering. If you want to replace the image sources in the HTML file, you can use something like example_replace_images.py

An example input and output of this process is shown in testinput.html and testoutput.png (which was renamed)
