using System;
using System.Collections.Generic;

using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace MobilePN
{

    namespace Contract
    {

        class IgnoreJsonAttributesResolver : DefaultContractResolver
        {
            public new static readonly IgnoreJsonAttributesResolver instance = new IgnoreJsonAttributesResolver(){IsPersonalDataExist = true};
            public bool IsPersonalDataExist { get; set; }
            protected override IList<JsonProperty> CreateProperties(Type type, MemberSerialization memberSerialization)
            {
                IList<JsonProperty> props = base.CreateProperties(type, memberSerialization);
               
                foreach (var prop in props)
                {
                    if (prop.PropertyName.Equals("PersonalizeValues"))
                    {
                        instance.IsPersonalDataExist = IsPersonalDataExist;
                        prop.Ignored = IsPersonalDataExist;
                        prop.ShouldSerialize =  instance => {
                            return (instance as IgnoreJsonAttributesResolver).IsPersonalDataExist;
                            };
                    }

                    prop.Converter = null;  // Ignore [JsonConverter]
                    prop.PropertyName = prop.UnderlyingName;  // restore original property name
                }
                return props;
            }
        }

        public class TargetedUserData
        {

            protected String _id = String.Empty;
            protected UserTypeEnum _type = UserTypeEnum.None;
            protected bool _hasPersonalizedData = false;
            protected UserPersonalizedData _userPersonalizedData = null;

            [JsonIgnore]
            public bool IsPersonalizeDataExist
            {
                get { return _hasPersonalizedData; }
                set { _hasPersonalizedData = value; }
            }
            public string Id
            {
                get { return _id; }
                set { _id = value; }
            }

            public Dictionary<String, String> PersonalizeValues
            {
                get
                {
                    if (_userPersonalizedData != null)
                    {
                        return _userPersonalizedData.PersonalizedValues;
                    }
                    else
                    {
                        return null;
                    }

                }
            }

            [JsonIgnore]
            public UserTypeEnum UserType
            {
                get { return _type; }
                set { _type = value; }
            }

            public TargetedUserData(string id, UserTypeEnum type, bool isPersonalized, bool hasPersonalizedData)
            {

                _id = id;
                _type = type;
                IsPersonalizeDataExist = hasPersonalizedData;

                if (hasPersonalizedData)
                {
                    _userPersonalizedData = new UserPersonalizedData();
                }
            }

            public bool SetPersonalizedData(UserPersonalizedData data)
            {


                bool status = true;

                _userPersonalizedData = data;

                return status;
            }

            public bool AddPersonalizedData(UserPersonalizedData addedData)
            {


                bool status = true;

                _userPersonalizedData.AddPersonalizedData(ref addedData);

                return status;
            }


            public bool SetPersonalizedValue(String key, String value)
            {


                bool status = true;



                _userPersonalizedData.SetPersonalizedValue(key, value);

                return status;
            }



            public bool RemovePersonalizedValue(String key, String value)
            {


                bool status = true;
                _userPersonalizedData.RemovePersonalizedValue(key, value);

                return status;
            }


            public String SerializeTargetUserToJson()
            {
                // JsonSerializerSettings settings = new JsonSerializerSettings();
                // settings.ContractResolver = new IgnoreJsonAttributesResolver();
                // settings.Formatting = Formatting.Indented;
                // (settings.ContractResolver as IgnoreJsonAttributesResolver).IsPersonalDataExist = (this.IsPersonalizeDataExist == true);
                // string json = JsonConvert.SerializeObject(this, settings);
                string json = JsonConvert.SerializeObject(this);
                return json;
            }


        }

    }
}