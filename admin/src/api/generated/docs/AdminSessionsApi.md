# AdminSessionsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminSessionsGet**](#adminsessionsget) | **GET** /admin/sessions | 세션 목록 조회|
|[**adminSessionsIdDelete**](#adminsessionsiddelete) | **DELETE** /admin/sessions/{id} | 세션 삭제|
|[**adminSessionsUserUserIdDelete**](#adminsessionsuseruseriddelete) | **DELETE** /admin/sessions/user/{userId} | 회원 세션 전체 삭제|

# **adminSessionsGet**
> InternalApiHandlersAPIResponse adminSessionsGet()


### Example

```typescript
import {
    AdminSessionsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminSessionsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminSessionsGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 크기 | (optional) defaults to 20|


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
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminSessionsIdDelete**
> InternalApiHandlersAPIResponse adminSessionsIdDelete()


### Example

```typescript
import {
    AdminSessionsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminSessionsApi(configuration);

let id: number; //세션 ID (default to undefined)

const { status, data } = await apiInstance.adminSessionsIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 세션 ID | defaults to undefined|


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
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminSessionsUserUserIdDelete**
> InternalApiHandlersAPIResponse adminSessionsUserUserIdDelete()


### Example

```typescript
import {
    AdminSessionsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminSessionsApi(configuration);

let userId: number; //회원 ID (default to undefined)

const { status, data } = await apiInstance.adminSessionsUserUserIdDelete(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] | 회원 ID | defaults to undefined|


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
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

