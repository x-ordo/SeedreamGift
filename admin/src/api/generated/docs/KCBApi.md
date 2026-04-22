# KCBApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**kycKcbCheckStatusGet**](#kyckcbcheckstatusget) | **GET** /kyc/kcb/check-status | KCB 인증 상태 조회|
|[**kycKcbCompletePost**](#kyckcbcompletepost) | **POST** /kyc/kcb/complete | KCB 본인인증 완료|
|[**kycKcbStartPost**](#kyckcbstartpost) | **POST** /kyc/kcb/start | KCB 본인인증 세션 시작|

# **kycKcbCheckStatusGet**
> InternalApiHandlersAPIResponse kycKcbCheckStatusGet()


### Example

```typescript
import {
    KCBApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new KCBApi(configuration);

let kcbAuthId: string; //KCB 인증 ID (default to undefined)

const { status, data } = await apiInstance.kycKcbCheckStatusGet(
    kcbAuthId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **kcbAuthId** | [**string**] | KCB 인증 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **kycKcbCompletePost**
> InternalApiHandlersAPIResponse kycKcbCompletePost(body)


### Example

```typescript
import {
    KCBApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new KCBApi(configuration);

let body: object; //KCB 인증 결과 데이터

const { status, data } = await apiInstance.kycKcbCompletePost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| KCB 인증 결과 데이터 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **kycKcbStartPost**
> InternalApiHandlersAPIResponse kycKcbStartPost()


### Example

```typescript
import {
    KCBApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new KCBApi(configuration);

const { status, data } = await apiInstance.kycKcbStartPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

