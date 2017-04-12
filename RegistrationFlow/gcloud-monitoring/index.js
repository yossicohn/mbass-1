
var functions = require('firebase-functions');
const Monitoring = require('@google-cloud/monitoring');

// Your Google Cloud Platform project ID
const projectId = 'mobilepush-161510';

// Instantiates a client
const client = Monitoring.v3().metricServiceClient();

var getMetrics = function (callback) {
  // Instantiates a client
 
  // Create two datestrings, a start and end range
  let oneWeekAgo = new Date();
  oneWeekAgo.setHours(oneWeekAgo.getHours() - (7 * 24));

  const options = {
    name: client.projectPath('mobilepush-161510'),
    // There is also: cloudfunctions.googleapis.com/function/execution_count
    filter: 'metric.type="cloudfunctions.googleapis.com/function/execution_times"',
    interval: {
      startTime: {
        seconds: oneWeekAgo.getTime() / 1000
      },
      endTime: {
        seconds: Date.now() / 1000
      }
    },
    view: 1
  };

  console.log('Data:');

  let error;

  // Iterate over all elements.
  client.listTimeSeries(options)
    .on('error', (err) => {
      error = err;
    })
    .on('data', (element) => console.log(element))
    .on('end', () => callback(error));
}



exports.getRegisterTokenMetrics = functions.https.onRequest((request, response) => {
    
   try{
       
    getMetrics((err)=>{

   
    if(err != undefined)
    {
       console.error('getMetrics Failed:', err);
       throw err;
    }
    

    });
    }catch(err){
        console.error('getMetrics Failed:', err);
    }
   response.send("Finished getRegisterTokenMetrics");

})



exports.setRegisterTokenMetrics = functions.https.onRequest((request, response) => {

  // Prepares an individual data point
const dataPoint = {
  interval: {
    endTime: {
      seconds: Date.now() / 1000
    }
  },
  value: {
    // The amount of sales
    doubleValue: 123.45
  }
};

// Prepares the time series request
const requestMonitor = {
  name: client.projectPath(projectId),
  timeSeries: [
    {
      // Ties the data point to a custom metric
      metric: {
        type: 'custom.googleapis.com/stores/daily_sales',
        labels: {
          store_id: 'Pittsburgh'
        }
      },
      resource: {
        type: 'global',
        labels: {
          project_id: projectId
        }
      },
      points: [
        dataPoint
      ]
    }
  ]
};

// Writes time series data
client.createTimeSeries(requestMonitor)
  .then((results) => {
    console.log(`Done writing time series data.`);
  });

   response.send("Finished setRegisterTokenMetrics");
})