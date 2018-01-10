import webapp2
import os
from google.appengine.api.modules import modules

X_API_KEY = 'X-API-Key'
VALID_API_KEYS = ['a3c99ad6-4c71-43f7-9a5d-4a6e9e01c8d1']

def is_dev_mode():
  return modules.get_current_version_name() == None  

def has_valid_api_key(req):
  # If this is running locally, don't validate API keys
  if is_dev_mode():
    return True
  if X_API_KEY in req.headers and req.headers[X_API_KEY] in VALID_API_KEYS:
    return True
  if X_API_KEY in req.GET and req.GET[X_API_KEY] in VALID_API_KEYS:
    return True
  return False

# The prototype app uses this to determine if the code has changed (and thus whether it should
# used the cached version or not)
class VersionHandler(webapp2.RequestHandler):
  def get(self, **kwargs):
    if not has_valid_api_key(self.request):
      self.response.status = 401
      self.response.out.write('Invalid API key')
      return
    self.response.out.write(modules.get_current_version_name())

class StaticHandler(webapp2.RequestHandler):
  def get(self, **kwargs):
    if not has_valid_api_key(self.request):
      self.response.status = 401
      self.response.out.write('Invalid API key')
      return
    
    # set the correct content type based on the file name
    if kwargs['path'].endswith('.js'):
      self.response.headers['Content-Type'] = 'application/javascript'
    elif kwargs['path'].endswith('.css'):
      self.response.headers['Content-Type'] = 'text/css'
    
    # in dev mode, set the cross origin headers
    if is_dev_mode():
      origin = self.request.headers.get('Origin', '')
      if origin.startswith('http://localhost') or origin.endswith('.googleplex.com') or '.corp.google.com:' in origin:
        self.response.headers['Access-Control-Allow-Origin'] = origin
        self.response.headers['Access-Control-Allow-Credentials'] = 'true'

    path = os.path.join(os.path.dirname(__file__), 'dist/' + kwargs['path'])
    file = open(path, 'rb')
    self.response.body_file.write( file.read() )
    file.close()

app = webapp2.WSGIApplication([
  webapp2.Route('/version', handler=VersionHandler),
  webapp2.Route('/dist/<path:.*>', handler=StaticHandler),
], debug=True)
