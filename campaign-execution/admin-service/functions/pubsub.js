
'use strict';

const PubSub = require('@google-cloud/pubsub');

const campaignControlTopicName = "campaign-control";
const campaignQueueTopicName = "campaign-queue";
// Imports the Google Cloud client library

// Your Google Cloud Platform project ID
const projectId = 'mobilepush-161510';

// Instantiates a client
const pubsubClient = PubSub({
    projectId: projectId
});

var pubsubV1 = require('@google-cloud/pubsub').v1({
    // optional auth parameters.
});



// ----------------------------------------------------------------
// function: createCampaignSubscriber
// args:topicName, subscriptionName
// return: respons Array.
// We first check if subscription exist if not we failed and then we create it.
// ----------------------------------------------------------------
exports.createCampaignSubscriber = function (topicName, subscriptionName) {
    return new Promise(function (resolve, reject) {

        var client = pubsubV1.subscriberClient();
        var formattedSubscription = client.subscriptionPath(projectId, subscriptionName);
        client.getSubscription({
                subscription: formattedSubscription
            })
            .then(function (data) {
                var subscription = data[0];
                resolve(subscription);
            })
            .catch(function (err) {
                // Not Exist hence we need to create
                pubsubClient.createSubscription(topicName, subscriptionName)
                    .then(function (data) {
                        var subscription = data[0];
                        var apiResponse = data[1];
                        resolve(subscription);
                    })
                    .catch((error) => {
                        console.log("createCampaignSubscriber Failed " + error)
                        reject(error);
                    });
            });
    });
}



// ----------------------------------------------------------------
// function: getTargetedUserBulkArray
// args: projectId, subscription, maxMessages
// return: respons Array.
// ----------------------------------------------------------------
exports.getTargetedUserBulkArray = function (projectId, subscription, maxMessages) {
    return new Promise(function (resolve, reject) {
        var client = pubsubV1.subscriberClient();
        var formattedSubscription = client.subscriptionPath(projectId, subscription);
        //var maxMessages = 0;

        var options = {
            timeout: 10
        };
        var request = {
            subscription: formattedSubscription,
            maxMessages: maxMessages,
            returnImmediately: true

        };
        client.pull(request, options)
            .then(function (responses) {

                var response = responses[0];
                if (response.receivedMessages.length == 0) {
                    console.log("receivedMessages=0");
                } else {

                }
                resolve({
                    response: response,

                });
            })
            .catch(function (err) {
                console.error(err);
            });
    });
}