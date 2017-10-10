using System;

using System.Collections.Generic;
using Google.Cloud.PubSub.V1;
using MobilePN.Contract;

namespace MobilePN
{

    namespace CampaignDataLoader
    {
        public class CampaignLoaderHelper : CampaignLoaderIf
        {
            protected PubSubHelperIf _pubSubHelper = null;
            public String ProjectId { get; set; }

            public String TopicName { get; set; }
            public bool Init(string projectId, string topicName)
            {

                bool status = true;
                try
                {
                    ProjectId = projectId;
                    TopicName = topicName;
                    _pubSubHelper = new PubSubHelperBase();
                    _pubSubHelper.Init(projectId);
                    _pubSubHelper.SetTopicName(TopicName);

                }
                catch (Exception error)
                {
                    Console.WriteLine(error);
                    return false;
                }

                return status;

            }

            public bool Push(int bulkSize, TargetedUserData data)
            {
                bool status = true;
                try
                {
                    PublishResponse result = _pubSubHelper.PublishUserDataToPubSub(data, TopicName);

                }
                catch (Exception error)
                {
                    Console.WriteLine(error);
                    return false;
                }

                return status;

            }

            public bool PushBulk(int bulkSize, List<TargetedUserData> bulkData)
            {
                bool status = true;
                try
                {
                    PublishResponse result = _pubSubHelper.PublishUserDataBulkToPubSub(bulkData, TopicName);

                }
                catch (Exception error)
                {
                    Console.WriteLine(error);
                    return false;
                }

                return status;

            }
        }
    }
}
