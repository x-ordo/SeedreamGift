# SystemApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**healthControllerCheck**](#healthcontrollercheck) | **GET** /health | 시스템 상태 진단 (DB, 메모리, 디스크)|

# **healthControllerCheck**
> HealthControllerCheck200Response healthControllerCheck()


### Example

```typescript
import {
    SystemApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SystemApi(configuration);

const { status, data } = await apiInstance.healthControllerCheck();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**HealthControllerCheck200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | The Health Check is successful |  -  |
|**503** | The Health Check is not successful |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

