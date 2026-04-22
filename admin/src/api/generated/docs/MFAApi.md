# MFAApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**authMfaDisablePost**](#authmfadisablepost) | **POST** /auth/mfa/disable | MFA 비활성화|
|[**authMfaStatusGet**](#authmfastatusget) | **GET** /auth/mfa/status | MFA 활성화 상태 조회|

# **authMfaDisablePost**
> InternalApiHandlersAPIResponse authMfaDisablePost(body)


### Example

```typescript
import {
    MFAApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MFAApi(configuration);

let body: object; //현재 TOTP 코드

const { status, data } = await apiInstance.authMfaDisablePost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 현재 TOTP 코드 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authMfaStatusGet**
> InternalApiHandlersAPIResponse authMfaStatusGet()


### Example

```typescript
import {
    MFAApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MFAApi(configuration);

const { status, data } = await apiInstance.authMfaStatusGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

