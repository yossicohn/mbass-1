using System;

using System.Collections.Generic;

namespace MobilePN
{

    namespace Contract
    {

        public class UserPersonalizedData
        {


            protected Dictionary<String, String> _personalizedValues = null;

            public Dictionary<String, String> PersonalizedValues
            {

                get
                {
                    return _personalizedValues;
                }
                set
                {
                    _personalizedValues = value;
                }
            }
            public UserPersonalizedData()
            {
                PersonalizedValues = new Dictionary<String, String>();

            }

            public bool SetPersonalizedValue(String key, String value)
            {


                bool status = true;
                RemovePersonalizedValue(key, value);
                _personalizedValues.Add(key, value);

                return status;
            }



            public bool RemovePersonalizedValue(String key, String value)
            {


                bool status = true;
                if (_personalizedValues.ContainsKey(key) == true)
                {
                    status = _personalizedValues.Remove(key);
                }

                return status;
            }

            public bool AddPersonalizedData(ref UserPersonalizedData addedData)
            {
                if (addedData == null)
                {
                    throw new ArgumentNullException(nameof(addedData));
                }

                bool status = true;

                foreach (var personalData in addedData._personalizedValues)
                {
                    status = SetPersonalizedValue(personalData.Key, personalData.Value);
                }

                return status;
            }
        }

    }
}
