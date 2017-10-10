using System;
using System.Collections.Generic;
using MobilePN.CampaignDataLoader;
using MobilePN.Contract;


namespace PNDataLoaderTester
{
    class Program
    {
        static String RegistrationId = "dARiEevCnFo:APA91bFTev5UB_plXxXKmYTrkx79isGzjIeCSy0UST-KNaVQsnGICoF7qgbEYyFu-3n1y807iPNmFI5IbzIlNLpJQ6q-OMqAZmWZeEURmoO3TIlA2TmR9ZSL4Bq4INzHqPmtRsAIxg0Y";
        static String serverKey = "AAAAioL9mYI:APA91bFkXrwgDtC8oFwLEbMHGvPb44uccFNQB_6VWww9tqmIuyR03QsCwoTRUhhTppq9hrSQW_PajfB2WpP17wS6_XN9Y3XF559v0l5JQtTvxJAkQLVSW41Dlszrd_535H7tatfZCxKE";
        static String DefaultProjectId = "mobilepush-161510";
        static String DefaultTopicName = "myTopic";
        static void Main(string[] args)
        {


            Console.WriteLine("Hello World!");

            TargetedUserData user = new TargetedUserData("yossi", UserTypeEnum.Customer, true, true);
            user.SetPersonalizedValue("name", "yossi");

            TargetedUserData user2 = new TargetedUserData("yossi2", UserTypeEnum.Customer, true, true);
            user2.SetPersonalizedValue("name", "yossi2");


            TargetedUserData user3 = new TargetedUserData("yossi2", UserTypeEnum.Customer, false, false);

            CampaignLoaderIf _campaignLoader = new CampaignLoaderHelper();

            _campaignLoader.Init(DefaultProjectId, DefaultTopicName);

            _campaignLoader.PushBulk(1, new List<TargetedUserData>() { user, user2, user3 });

        }

    }
}