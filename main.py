import webapp2

class StaticHandler(webapp2.RequestHandler):
  def get(self, **kwargs):
    if kwargs['path'].endswith('.js'):
      self.response.headers['Content-Type'] = 'application/javascript'
    elif kwargs['path'].endswith('.css'):
      self.response.headers['Content-Type'] = 'text/css'
    origin = self.request.headers['Origin']
    if origin.startswith('http://localhost') or origin.endswith('.googleplex.com'):
      self.response.headers['Access-Control-Allow-Origin'] = origin
      self.response.headers['Access-Control-Allow-Credentials'] = 'true'
    file = open('dist/' + kwargs['path'], 'rb')
    self.response.body_file.write( file.read() )
    file.close()


app = webapp2.WSGIApplication([
  webapp2.Route('/dist/<path:.*>', handler=StaticHandler),
], debug=True)
