
using System;
using System.Collections.Generic;
using Google.Cloud.PubSub.V1;

using MobilePN.Contract;

namespace MobilePN
{
    namespace CampaignDataLoader
    {
        public interface PubSubHelperIf
        {
            void Init(String projectId);

            bool SetTopicName(String TopicName);
            bool CreateTopic(String topicName, out Topic createdTopic);

            PublishResponse PublishUserDataToPubSub(TargetedUserData userData, String topicName);

            PublishResponse PublishUserDataBulkToPubSub(List<TargetedUserData> userDataList, String topicName);
        }
    }
}