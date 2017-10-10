
using System;
using System.Collections.Generic;
using Google.Cloud.PubSub.V1;
using Google.Protobuf;
using MobilePN.Contract;

namespace MobilePN
{

    namespace CampaignDataLoader
    {
        public class PubSubHelperBase : PubSubHelperIf
        {
            PublisherClient _publisherClient = null;
            public String DefaultProjectId { get; set; }

            public TopicName DefaultTopicName { get; set; }

            public Topic DefaultTopic { get; set; }

            public PubSubHelperBase()
            {
                _publisherClient = PublisherClient.Create();
                DefaultProjectId = String.Empty;
                DefaultTopicName = null;
                DefaultTopic = null;
            }


            public void Init(string projectId)
            {
                DefaultProjectId = projectId;
            }

            public bool CreateTopic(string topicName, out Topic createdTopic)
            {
                bool status = false;
                createdTopic = null;
                try
                {

                    createdTopic = DefaultTopic = _publisherClient.CreateTopic(DefaultTopicName);
                    Console.WriteLine($"Topic {createdTopic.Name} created.");
                }
                catch (Grpc.Core.RpcException e)
                    when (e.Status.StatusCode == Grpc.Core.StatusCode.AlreadyExists)
                {
                    Console.WriteLine($"Topic {topicName} already exists.");
                }

                return status;

            }
            public PublishResponse PublishUserDataToPubSub(TargetedUserData userData, String topicName)
            {
                PublishResponse response = null;


                var json = userData.SerializeTargetUserToJson();
                Console.WriteLine(json);
                PubsubMessage message = new PubsubMessage
                {
                    // The data is any arbitrary ByteString. Here, we're using text.

                    Data = ByteString.CopyFromUtf8(json),
                    // The attributes provide metadata in a string-to-string dictionary.
                    Attributes =
                        {
                            { "description", "TargetedUserData" }
                        }
                };

                response = _publisherClient.Publish(DefaultTopicName,new [] {message});

                return response;
            }

            public PublishResponse PublishUserDataBulkToPubSub(List<TargetedUserData> userDataList, string topicName)
            {
                PublishResponse response = null;

                TargetedUserData currData = null;

                List<PubsubMessage> messages = new List<PubsubMessage>();

                foreach (var item in userDataList)
                {
                    currData = item;
                    var json = currData.SerializeTargetUserToJson();
                    Console.WriteLine(json);
                    PubsubMessage message = new PubsubMessage
                    {
                        // The data is any arbitrary ByteString. Here, we're using text.

                        Data = ByteString.CopyFromUtf8(json),
                        // The attributes provide metadata in a string-to-string dictionary.
                        Attributes =
                        {
                            { "description", "TargetedUserData" }
                        }
                    };

                    messages.Add(message);
                }

                response = _publisherClient.Publish(DefaultTopicName, messages);

                return response;
            }

            public bool SetTopicName(string topicName)
            {
                DefaultTopicName = new TopicName(DefaultProjectId, topicName);
                return true;
            }
        }
    }
}