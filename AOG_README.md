# Running Locally

1. Run `gulp build`
2. Run `dev_appserver.py app.yaml` (automatically installed when you install gcloud)

# Deploying to Internal App Engine

1.  Run `gulp build`
2.  Run `gcloud app deploy --no-promote --project google.com:aog-amp-actions-amphtml`
3.  Go to the [App Engine versions page for the GCP
    project](https://pantheon.corp.google.com/appengine/versions?project=amphtml-dev).
    You should see a new version deployed by you, but the traffic allocation
    will be set to 0% (so it won't actually be serving to users of
    go/fandango-amp-demo).
4.  Click the checkbox next to your version, and then click Migrate Traffic to
    migrate all traffic to that version.
5.  Go to go/fandango-amp-demo and make sure everything works. If something doesn't work, Migrate Traffic back to the previous version.
