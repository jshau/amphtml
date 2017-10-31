import webapp2
import os

class StaticHandler(webapp2.RequestHandler):
  def get(self, **kwargs):
    if kwargs['path'].endswith('.js'):
      self.response.headers['Content-Type'] = 'application/javascript'
    elif kwargs['path'].endswith('.css'):
      self.response.headers['Content-Type'] = 'text/css'
    origin = self.request.headers.get('Origin', '')
    if origin.startswith('http://localhost') or origin.endswith('.googleplex.com'):
      self.response.headers['Access-Control-Allow-Origin'] = origin
      self.response.headers['Access-Control-Allow-Credentials'] = 'true'
    path = os.path.join(os.path.dirname(__file__), 'dist/' + kwargs['path'])
    file = open(path, 'rb')
    self.response.body_file.write( file.read() )
    file.close()

class EmptyHandler(webapp2.RequestHandler):
  def get(self, **kwargs):
    origin = self.request.headers.get('Origin', '')
    if origin.startswith('http://localhost') or origin.endswith('.googleplex.com'):
      self.response.headers['Access-Control-Allow-Origin'] = origin
      self.response.headers['Access-Control-Allow-Credentials'] = 'true'
    self.response.body_file.write('')

app = webapp2.WSGIApplication([
  webapp2.Route('/dist/<path:.*>', handler=StaticHandler),
  webapp2.Route('/empty.js', handler=EmptyHandler),
], debug=True)
