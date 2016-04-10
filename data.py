from google.appengine.ext import ndb
from google.appengine.api import urlfetch
import json
from datetime import datetime
from flask import Blueprint

data = Blueprint('data', __name__, template_folder='templates')


class TrafficFlow(ndb.Model):
    timestamp = ndb.DateTimeProperty(auto_now=True)
    flowdata = ndb.JsonProperty()


class ApiKey(ndb.Model):
    apikey = ndb.TextProperty()


@data.route('/data')
def fetch():
    recentflow = TrafficFlow.query().order(-TrafficFlow.timestamp).get()
    if recentflow is None or (datetime.utcnow() - recentflow.timestamp).total_seconds() > 10*60:  # More than 10 minutes old
        q = ApiKey.query()
        key = q.get().apikey
        flows = urlfetch.fetch(
            'http://wsdot.com/traffic/api/TrafficFlow/TrafficFlowREST.svc/GetTrafficFlowsAsJson?AccessCode=' + key)
        if flows.status_code == 200:
            tf = TrafficFlow(flowdata=json.loads(flows.content))
            tf.put()
            return flows.content
        else:
            return 'Error from WSDOT API! Status code: ' + str(flows.status_code)
    else:
        return json.dumps(recentflow.flowdata)
