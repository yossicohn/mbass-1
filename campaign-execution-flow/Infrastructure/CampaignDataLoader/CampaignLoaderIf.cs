
using System;

using System.Collections.Generic;

using MobilePN.Contract;

namespace MobilePN
{

    namespace CampaignDataLoader
    {
        public interface CampaignLoaderIf
        {
            bool Init(String projectId, String topicName);

            bool Push(int bulkSize, TargetedUserData data);
            bool PushBulk(int bulkSize, List<TargetedUserData> bulkData);
        }
    }


}
